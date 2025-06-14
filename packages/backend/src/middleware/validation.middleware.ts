import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const validateRequest = (schema: any) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors = error.details.map((detail: any) => detail.message);
      throw new AppError(errors.join(', '), 400, 'VALIDATION_ERROR');
    }
    next();
  };
};