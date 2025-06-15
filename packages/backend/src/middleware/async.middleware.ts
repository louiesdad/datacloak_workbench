/**
 * Async middleware wrapper to handle async route handlers
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | any>;

/**
 * Wraps async route handlers to catch errors and pass them to Express error handler
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation middleware type for express-validator compatibility
 */
export interface ValidationSchema {
  body?: any;
  query?: any;
  params?: any;
}

/**
 * Simple validation middleware to replace express-validator temporarily
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Basic validation placeholder - in production, use express-validator
    // For now, just pass through to avoid compilation errors
    next();
  };
};

export default asyncHandler;