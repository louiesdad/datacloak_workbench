import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

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

// Helper functions for common validation scenarios
export const validateBody = (schema: any) => validateRequest({ body: schema });
export const validateQuery = (schema: any) => validateRequest({ query: schema });
export const validateParams = (schema: any) => validateRequest({ params: schema });