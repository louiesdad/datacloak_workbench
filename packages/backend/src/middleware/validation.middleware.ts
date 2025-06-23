import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { AppError } from './error.middleware';
import logger from '../config/logger';
import validator from 'validator';

// Enhanced validation middleware with comprehensive input sanitization
export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  sanitize?: boolean;
  stripUnknown?: boolean;
  maxDepth?: number;
}

// Legacy async handler for backwards compatibility
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common validation schemas
export const commonSchemas = {
  // Basic types
  id: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  filename: z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename format'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(10),
    offset: z.coerce.number().int().min(0).optional()
  }),
  
  // Date ranges
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    timezone: z.string().optional()
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, 'Start date must be before end date'),
  
  // File upload
  fileMetadata: z.object({
    filename: z.string().min(1).max(255),
    size: z.number().int().min(1).max(100 * 1024 * 1024), // 100MB max
    mimeType: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/),
    encoding: z.string().optional()
  }),
  
  // Text analysis
  textAnalysis: z.object({
    text: z.string().min(1).max(10000),
    language: z.string().length(2).optional(),
    options: z.object({
      sentiment: z.boolean().default(true),
      entities: z.boolean().default(false),
      keywords: z.boolean().default(false)
    }).optional()
  }),
  
  // Batch processing
  batchRequest: z.object({
    items: z.array(z.any()).min(1).max(1000),
    options: z.object({
      parallel: z.boolean().default(true),
      failFast: z.boolean().default(false),
      timeout: z.number().int().min(1000).max(300000).default(30000) // 30s default
    }).optional()
  }),
  
  // Security
  apiKey: z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/, 'Invalid API key format'),
  token: z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Invalid token format'),
  
  // Configuration
  configUpdate: z.object({
    key: z.string().min(1).max(100),
    value: z.union([z.string(), z.number(), z.boolean()]),
    type: z.enum(['string', 'number', 'boolean']).optional()
  })
};

// Security-focused input sanitization
class InputSanitizer {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_OBJECT_DEPTH = 10;
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi
  ];
  
  public static sanitizeValue(value: any, depth = 0): any {
    // Prevent deep object recursion attacks
    if (depth > this.MAX_OBJECT_DEPTH) {
      throw new AppError('Input object depth exceeds maximum allowed', 400, 'VALIDATION_DEPTH_EXCEEDED');
    }
    
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item, depth + 1));
    }
    
    if (typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeValue(val, depth + 1);
      }
      return sanitized;
    }
    
    return value;
  }
  
  private static sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return String(str);
    }
    
    // Limit string length to prevent memory exhaustion
    if (str.length > this.MAX_STRING_LENGTH) {
      throw new AppError(`String length exceeds maximum allowed (${this.MAX_STRING_LENGTH})`, 400, 'VALIDATION_STRING_TOO_LONG');
    }
    
    let sanitized = str;
    
    // Remove dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
    
    // HTML encode special characters (basic)
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // Remove null bytes and control characters (except common whitespace)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }
  
  public static validateAndSanitizeEmail(email: string): string {
    if (!validator.isEmail(email)) {
      throw new AppError('Invalid email format', 400, 'VALIDATION_INVALID_EMAIL');
    }
    return validator.normalizeEmail(email) || email;
  }
  
  public static validateAndSanitizeUrl(url: string): string {
    if (!validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false
    })) {
      throw new AppError('Invalid URL format', 400, 'VALIDATION_INVALID_URL');
    }
    return url;
  }
  
  public static validateFilename(filename: string): string {
    // Remove path traversal attempts
    const sanitized = filename.replace(/[\/\\]/g, '').replace(/\.\./g, '');
    
    if (!sanitized || sanitized.length === 0) {
      throw new AppError('Invalid filename', 400, 'VALIDATION_INVALID_FILENAME');
    }
    
    if (sanitized.length > 255) {
      throw new AppError('Filename too long', 400, 'VALIDATION_FILENAME_TOO_LONG');
    }
    
    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      throw new AppError('Reserved filename not allowed', 400, 'VALIDATION_RESERVED_FILENAME');
    }
    
    return sanitized;
  }
}

// Rate limiting for validation requests
const validationAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_VALIDATION_ATTEMPTS = 100;
const VALIDATION_WINDOW = 60000; // 1 minute

function checkValidationRateLimit(clientIp: string): void {
  const now = Date.now();
  const attempts = validationAttempts.get(clientIp);
  
  if (!attempts || now > attempts.resetTime) {
    validationAttempts.set(clientIp, { count: 1, resetTime: now + VALIDATION_WINDOW });
    return;
  }
  
  if (attempts.count >= MAX_VALIDATION_ATTEMPTS) {
    throw new AppError('Too many validation requests', 429, 'VALIDATION_RATE_LIMIT_EXCEEDED');
  }
  
  attempts.count++;
}

// Enhanced validation middleware factory
export function validate(options: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    try {
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Check rate limiting
      checkValidationRateLimit(clientIp);
      
      // Sanitize inputs if requested
      if (options.sanitize !== false) {
        if (req.body) {
          req.body = InputSanitizer.sanitizeValue(req.body);
        }
        if (req.query) {
          req.query = InputSanitizer.sanitizeValue(req.query);
        }
        if (req.params) {
          req.params = InputSanitizer.sanitizeValue(req.params);
        }
      }
      
      // Validate body
      if (options.body && req.body !== undefined) {
        const result = await options.body.safeParseAsync(req.body);
        if (!result.success) {
          throw new ValidationError('Body validation failed', result.error);
        }
        req.body = result.data;
      }
      
      // Validate query parameters
      if (options.query && req.query !== undefined) {
        const result = await options.query.safeParseAsync(req.query);
        if (!result.success) {
          throw new ValidationError('Query validation failed', result.error);
        }
        req.query = result.data;
      }
      
      // Validate path parameters
      if (options.params && req.params !== undefined) {
        const result = await options.params.safeParseAsync(req.params);
        if (!result.success) {
          throw new ValidationError('Path parameters validation failed', result.error);
        }
        req.params = result.data;
      }
      
      // Validate headers
      if (options.headers && req.headers !== undefined) {
        const result = await options.headers.safeParseAsync(req.headers);
        if (!result.success) {
          throw new ValidationError('Headers validation failed', result.error);
        }
        // Note: We don't modify req.headers as it may break Express functionality
      }
      
      const duration = Date.now() - startTime;
      logger.debug('Input validation completed', {
        component: 'validation',
        duration,
        clientIp,
        path: req.path,
        method: req.method
      });
      
      next();
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error instanceof ValidationError || error instanceof AppError) {
        logger.warn('Input validation failed', {
          component: 'validation',
          error: error.message,
          duration,
          path: req.path,
          method: req.method,
          clientIp: req.ip
        });
        next(error);
      } else {
        logger.error('Validation middleware error', {
          component: 'validation',
          error: error instanceof Error ? error.message : error,
          duration,
          path: req.path,
          method: req.method
        });
        next(new AppError('Validation failed', 400, 'VALIDATION_ERROR'));
      }
    }
  };
}

// Custom validation error class
export class ValidationError extends AppError {
  public details: any;
  
  constructor(message: string, zodError: ZodError) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = this.formatZodError(zodError);
  }
  
  private formatZodError(error: ZodError): any {
    return error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: (err as any).received || undefined
    }));
  }
}

// Legacy validateRequest function for backwards compatibility
export const validateRequest = (schema: {
  body?: any;
  query?: any;
  params?: any;
}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];
    let errorCode = 'VALIDATION_ERROR';

    // Validate request body
    if (schema.body) {
      const { error: bodyError } = schema.body.validate(req.body, { 
        abortEarly: true,  // Stop on first error to get specific codes
        allowUnknown: false,
      });
      
      if (bodyError) {
        const detail = bodyError.details[0];
        
        // Check for specific job validation errors based on field name
        if (req.body && detail.context?.key === 'type' && detail.type === 'any.only') {
          errorCode = 'INVALID_JOB_TYPE';
        } else if (req.body && detail.context?.key === 'priority' && detail.type === 'any.only') {
          errorCode = 'INVALID_JOB_PRIORITY';
        }
        
        errors.push(`Body: ${detail.message}`);
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error: queryError } = schema.query.validate(req.query, {
        abortEarly: false,
        allowUnknown: false,
      });
      
      if (queryError) {
        errors.push(
          ...queryError.details.map((detail: any) => `Query: ${detail.message}`)
        );
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error: paramsError } = schema.params.validate(req.params, {
        abortEarly: false,
        allowUnknown: false,
      });
      
      if (paramsError) {
        errors.push(
          ...paramsError.details.map((detail: any) => `Params: ${detail.message}`)
        );
      }
    }

    if (errors.length > 0) {
      throw new AppError(errors.join('; '), 400, errorCode);
    }

    next();
  };
};

// Predefined validation middlewares for common use cases
export const validatePagination = validate({
  query: commonSchemas.pagination,
  sanitize: true
});

export const validateId = validate({
  params: z.object({ id: commonSchemas.id }),
  sanitize: true
});

export const validateFileUpload = validate({
  body: commonSchemas.fileMetadata,
  sanitize: true
});

export const validateTextAnalysis = validate({
  body: commonSchemas.textAnalysis,
  sanitize: true
});

export const validateBatchRequest = validate({
  body: commonSchemas.batchRequest,
  sanitize: true
});

export const validateApiKey = validate({
  headers: z.object({
    'x-api-key': commonSchemas.apiKey
  }),
  sanitize: false // Don't sanitize API keys
});

// Helper functions for common validation scenarios (legacy)
export const validateBody = (schema: any) => validateRequest({ body: schema });
export const validateQuery = (schema: any) => validateRequest({ query: schema });
export const validateParams = (schema: any) => validateRequest({ params: schema });

// Utility functions
export const sanitizeInput = InputSanitizer.sanitizeValue;
export const sanitizeEmail = InputSanitizer.validateAndSanitizeEmail;
export const sanitizeUrl = InputSanitizer.validateAndSanitizeUrl;
export const sanitizeFilename = InputSanitizer.validateFilename;

export default validate;