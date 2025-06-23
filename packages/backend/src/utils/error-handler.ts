/**
 * Common Error Handling Utilities
 * 
 * Standardized error handling patterns and utilities for consistent
 * error management across the application.
 */

import { Response } from 'express';
import { AppError } from '../middleware/error.middleware';

// Standard error codes
export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  
  // Authentication errors (401)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Authorization errors (403)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_FORBIDDEN: 'RESOURCE_FORBIDDEN',
  
  // Not found errors (404)
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  
  // Conflict errors (409)
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  
  // Service unavailable (503)
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Standard error response format
export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: any;
  timestamp: string;
  requestId?: string;
}

// Error classification helpers
export const isValidationError = (error: any): boolean => {
  return error instanceof AppError && error.statusCode === 400;
};

export const isAuthenticationError = (error: any): boolean => {
  return error instanceof AppError && error.statusCode === 401;
};

export const isAuthorizationError = (error: any): boolean => {
  return error instanceof AppError && error.statusCode === 403;
};

export const isNotFoundError = (error: any): boolean => {
  return error instanceof AppError && error.statusCode === 404;
};

export const isServerError = (error: any): boolean => {
  return error instanceof AppError && error.statusCode >= 500;
};

// Error factory functions
export const createValidationError = (message: string, details?: any): AppError => {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
};

export const createNotFoundError = (resource: string, id?: string): AppError => {
  const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
  return new AppError(message, 404, ERROR_CODES.RESOURCE_NOT_FOUND);
};

export const createDuplicateError = (resource: string, field?: string): AppError => {
  const message = field 
    ? `${resource} with this ${field} already exists`
    : `${resource} already exists`;
  return new AppError(message, 409, ERROR_CODES.RESOURCE_ALREADY_EXISTS);
};

export const createAuthenticationError = (message: string = 'Authentication required'): AppError => {
  return new AppError(message, 401, ERROR_CODES.INVALID_CREDENTIALS);
};

export const createAuthorizationError = (message: string = 'Insufficient permissions'): AppError => {
  return new AppError(message, 403, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
};

export const createDatabaseError = (message: string = 'Database operation failed'): AppError => {
  return new AppError(message, 500, ERROR_CODES.DATABASE_ERROR);
};

export const createExternalServiceError = (service: string, operation?: string): AppError => {
  const message = operation 
    ? `${service} service failed during ${operation}`
    : `${service} service is unavailable`;
  return new AppError(message, 503, ERROR_CODES.EXTERNAL_SERVICE_ERROR);
};

export const createFileError = (message: string, code: ErrorCode = ERROR_CODES.FILE_SYSTEM_ERROR): AppError => {
  return new AppError(message, 400, code);
};

export const createRateLimitError = (message: string = 'Rate limit exceeded'): AppError => {
  return new AppError(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED);
};

// Error response helpers
export const formatErrorResponse = (error: AppError, requestId?: string): ErrorResponse => {
  return {
    success: false,
    error: error.message,
    code: error.code as ErrorCode,
    details: error.details,
    timestamp: new Date().toISOString(),
    requestId,
  };
};

export const sendErrorResponse = (res: Response, error: AppError, requestId?: string): void => {
  const errorResponse = formatErrorResponse(error, requestId);
  res.status(error.statusCode).json(errorResponse);
};

// Error handling decorators/wrappers
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      // Convert unknown errors to AppError
      console.error('Unexpected error:', error);
      throw new AppError(
        'An unexpected error occurred',
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR
      );
    }
  };
};

// Database error handling
export const handleDatabaseError = (error: any, operation: string): never => {
  console.error(`Database error during ${operation}:`, error);
  
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw createDuplicateError('Resource', 'unique constraint');
  }
  
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    throw createValidationError('Foreign key constraint violation');
  }
  
  if (error.code === 'SQLITE_BUSY') {
    throw new AppError('Database is busy, please try again', 503, ERROR_CODES.DATABASE_ERROR);
  }
  
  throw createDatabaseError(`Database operation failed: ${operation}`);
};

// File handling errors
export const validateFileUpload = (file: Express.Multer.File | undefined): void => {
  if (!file) {
    throw createValidationError('No file provided', { field: 'file' });
  }
  
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw createFileError('File size exceeds maximum limit of 50MB', ERROR_CODES.FILE_TOO_LARGE);
  }
  
  const allowedTypes = ['text/csv', 'application/json', 'text/plain', 'application/vnd.ms-excel'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw createFileError(
      `Unsupported file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`,
      ERROR_CODES.UNSUPPORTED_FILE_TYPE
    );
  }
};

// External service error handling
export const handleExternalServiceError = (error: any, serviceName: string, operation: string): never => {
  console.error(`${serviceName} service error during ${operation}:`, error);
  
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw createExternalServiceError(serviceName, 'connection');
  }
  
  if (error.response?.status === 401) {
    throw createAuthenticationError(`${serviceName} authentication failed`);
  }
  
  if (error.response?.status === 403) {
    throw createAuthorizationError(`${serviceName} access denied`);
  }
  
  if (error.response?.status === 429) {
    throw createRateLimitError(`${serviceName} rate limit exceeded`);
  }
  
  if (error.response?.status >= 500) {
    throw createExternalServiceError(serviceName, operation);
  }
  
  throw createExternalServiceError(serviceName, operation);
};

// Validation helpers
export const validateRequiredFields = (data: Record<string, any>, fields: string[]): void => {
  const missing = fields.filter(field => 
    data[field] === undefined || data[field] === null || data[field] === ''
  );
  
  if (missing.length > 0) {
    throw createValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing }
    );
  }
};

export const validatePagination = (page?: number, pageSize?: number): { page: number; pageSize: number } => {
  const validatedPage = Math.max(1, page || 1);
  const validatedPageSize = Math.min(Math.max(1, pageSize || 10), 100);
  
  return { page: validatedPage, pageSize: validatedPageSize };
};

export const validateId = (id: string, resourceType: string = 'Resource'): void => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    throw createValidationError(`Invalid ${resourceType.toLowerCase()} ID`);
  }
};

// Common error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Request validation failed',
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  RATE_LIMITED: 'Too many requests, please try again later',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  UNSUPPORTED_FORMAT: 'Unsupported file format',
  DATABASE_CONNECTION: 'Database connection failed',
  EXTERNAL_SERVICE: 'External service error',
} as const;

// Export everything as default for easier importing
export default {
  ERROR_CODES,
  isValidationError,
  isAuthenticationError,
  isAuthorizationError,
  isNotFoundError,
  isServerError,
  createValidationError,
  createNotFoundError,
  createDuplicateError,
  createAuthenticationError,
  createAuthorizationError,
  createDatabaseError,
  createExternalServiceError,
  createFileError,
  createRateLimitError,
  formatErrorResponse,
  sendErrorResponse,
  withErrorHandling,
  handleDatabaseError,
  validateFileUpload,
  handleExternalServiceError,
  validateRequiredFields,
  validatePagination,
  validateId,
  ERROR_MESSAGES,
};