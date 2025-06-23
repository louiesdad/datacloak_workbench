import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { ServiceRegistry, getContainer } from '../../src/container';
import { MockFactory } from './mock-factory';

export interface TestAppOptions {
  useAuth?: boolean;
  useRateLimit?: boolean;
  useLogging?: boolean;
  mountRoutes?: boolean;
  customMiddleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}

export class ExpressAppFactory {
  static createTestApp(options: TestAppOptions = {}): Application {
    const app = express();

    // Register test services first
    ServiceRegistry.registerTestServices();

    // Configure basic middleware
    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cors({ origin: true, credentials: true }));
    app.use(compression());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Optional logging middleware (disabled by default for tests)
    if (options.useLogging) {
      app.use(morgan('tiny'));
    }

    // Add custom middleware if provided
    if (options.customMiddleware) {
      options.customMiddleware.forEach(middleware => {
        app.use(middleware);
      });
    }

    // Add test authentication middleware if needed
    if (options.useAuth) {
      app.use('/api', this.createAuthMiddleware());
    }

    // Add test rate limiting if needed
    if (options.useRateLimit) {
      app.use('/api', this.createRateLimitMiddleware());
    }

    // Mount routes if requested
    if (options.mountRoutes) {
      this.mountTestRoutes(app);
    }

    // Global error handler for tests
    app.use(this.createErrorHandler());

    return app;
  }

  static createAuthMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Mock authentication - check for test token
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Mock user data for tests
      if (token === 'valid-test-token') {
        (req as any).user = {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'user'
        };
        next();
      } else if (token === 'admin-test-token') {
        (req as any).user = {
          id: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      } else {
        res.status(401).json({ error: 'Invalid token' });
      }
    };
  }

  static createRateLimitMiddleware() {
    const rateLimiter = MockFactory.createService(['consume', 'getRemaining']);
    
    // Mock rate limiter that allows requests by default
    rateLimiter.consume.mockResolvedValue(true);
    rateLimiter.getRemaining.mockResolvedValue(100);

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip || 'unknown';
      
      try {
        const allowed = await rateLimiter.consume(key);
        if (allowed) {
          next();
        } else {
          res.status(429).json({ 
            error: 'Rate limit exceeded',
            retryAfter: 60
          });
        }
      } catch (error) {
        // Allow request on rate limiter error
        next();
      }
    };
  }

  static createErrorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Test app error:', error);

      // Handle different error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          details: error.details
        });
      }

      if (error.name === 'UnauthorizedError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
      }

      if (error.name === 'ForbiddenError') {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message
        });
      }

      if (error.name === 'NotFoundError') {
        return res.status(404).json({
          error: 'Not Found',
          message: error.message
        });
      }

      // Default server error
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'test' ? error.message : 'Something went wrong',
        ...(process.env.NODE_ENV === 'test' && { stack: error.stack })
      });
    };
  }

  static mountTestRoutes(app: Application) {
    // Health check route
    app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      });
    });

    // Test routes for different scenarios
    app.get('/api/test/success', (req: Request, res: Response) => {
      res.json({ message: 'Success' });
    });

    app.get('/api/test/error', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Test error');
      next(error);
    });

    app.get('/api/test/validation-error', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      next(error);
    });

    app.get('/api/test/unauthorized', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';
      next(error);
    });

    app.get('/api/test/not-found', (req: Request, res: Response, next: NextFunction) => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';
      next(error);
    });

    // Test route that requires authentication
    app.get('/api/test/protected', (req: Request, res: Response) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      res.json({ message: 'Protected data', user });
    });

    // Test route for file upload simulation
    app.post('/api/test/upload', (req: Request, res: Response) => {
      res.json({ 
        message: 'File uploaded successfully',
        filename: 'test-file.csv',
        size: 1024
      });
    });

    // Test route for async operations
    app.post('/api/test/async', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        res.json({ message: 'Async operation completed' });
      } catch (error) {
        next(error);
      }
    });

    // WebSocket handshake simulation
    app.get('/api/test/websocket', (req: Request, res: Response) => {
      res.json({ 
        message: 'WebSocket endpoint',
        upgrade: 'websocket'
      });
    });

    // SSE endpoint simulation
    app.get('/api/test/sse', (req: Request, res: Response) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      // Send initial event
      res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');

      // Cleanup on client disconnect
      req.on('close', () => {
        res.end();
      });
    });
  }

  static createIntegrationTestApp(): Application {
    return this.createTestApp({
      useAuth: true,
      useRateLimit: true,
      useLogging: false,
      mountRoutes: true
    });
  }

  static createUnitTestApp(): Application {
    return this.createTestApp({
      useAuth: false,
      useRateLimit: false,
      useLogging: false,
      mountRoutes: false
    });
  }

  static createE2ETestApp(): Application {
    return this.createTestApp({
      useAuth: true,
      useRateLimit: true,
      useLogging: true,
      mountRoutes: true
    });
  }
}

// Helper function for mounting specific route modules in tests
export function mountRoutes(app: Application, routes: Array<{ path: string, router: any }>) {
  routes.forEach(({ path, router }) => {
    app.use(path, router);
  });
}

// Helper function for setting up middleware in specific order
export function setupMiddleware(app: Application, middleware: Array<any>) {
  middleware.forEach(mw => {
    app.use(mw);
  });
}