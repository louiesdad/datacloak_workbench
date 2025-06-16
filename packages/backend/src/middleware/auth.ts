import { Request, Response, NextFunction } from 'express';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Mock authentication middleware
  // In a real implementation, this would verify JWT tokens, API keys, etc.
  
  // For now, just add a mock user to the request
  (req as any).user = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'admin'
  };
  
  next();
};