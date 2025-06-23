// import rateLimit from 'express-rate-limit'; // TODO: Install express-rate-limit package
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/config.service';

// Temporary mock rate limiter until express-rate-limit is installed
const rateLimit = (options: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple mock implementation - just pass through for now
    next();
  };
};

// Create different rate limiters for different endpoints
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // Limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: options.standardHeaders !== false, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: options.legacyHeaders !== false, // Disable the `X-RateLimit-*` headers
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health/status' || req.path === '/api/health/ready';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter: res.getHeader('Retry-After')
      });
    }
  });
};

// Specific rate limiters for different operations
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts, please try again after 15 minutes'
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  message: 'Upload limit exceeded, please try again later'
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 API requests per windowMs
  message: 'API rate limit exceeded'
});

export const exportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 exports per hour
  message: 'Export limit exceeded, please try again later'
});

// Dynamic rate limiter based on configuration
export const createDynamicRateLimiter = () => {
  const configService = ConfigService.getInstance();
  
  return createRateLimiter({
    windowMs: configService.get('RATE_LIMIT_WINDOW_MS') || 15 * 60 * 1000,
    max: configService.get('RATE_LIMIT_MAX_REQUESTS') || 100,
    message: 'Too many requests, please try again later.' // TODO: Add RATE_LIMIT_MESSAGE to config
  });
};