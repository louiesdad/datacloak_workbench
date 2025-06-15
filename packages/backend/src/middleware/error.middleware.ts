import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void => {
  let statusCode: number;
  let message: string;
  let code: string;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'INTERNAL_ERROR';
  } else if (err instanceof SyntaxError && 'body' in err) {
    // Handle JSON parsing errors
    statusCode = 400;
    message = 'Invalid JSON format';
    code = 'INVALID_JSON';
  } else {
    statusCode = 500;
    message = err.message || 'Internal Server Error';
    code = 'INTERNAL_ERROR';
  }

  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(statusCode).json({
    error: {
      message,
      code,
      status: statusCode,
    },
  });
};