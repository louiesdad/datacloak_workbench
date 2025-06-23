import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config/env';
import { errorHandler } from './middleware/error.middleware';
import { setupRoutes } from './routes';
import { JobQueueService } from './services/job-queue.service';
import { initializeDatabases } from './database';

// Export app and job queue for testing
export let jobQueue: JobQueueService;

export const createApp = async (): Promise<Application> => {
  const app = express() as any; // Add index signature to allow property assignment
  
  // Skip database initialization here - it's done in server.ts
  // Only initialize if not already initialized (for tests)
  if (process.env.NODE_ENV === 'test') {
    try {
      await initializeDatabases();
    } catch (error) {
      console.error('Failed to initialize databases:', error);
      // For tests, continue without throwing to avoid breaking the app creation
    }
  }
  
  // Initialize job queue
  jobQueue = new JobQueueService({ maxConcurrentJobs: 3 });
  app.jobQueue = jobQueue; // Attach to app for testing

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  const corsOptions = {
    origin: '*', // In production, replace with your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  };
  app.use(cors(corsOptions));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression middleware
  app.use(compression());

  // Logging middleware
  if (config.isDevelopment) {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  });

  // API routes
  setupRoutes(app);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        message: 'Resource not found',
        code: 'NOT_FOUND',
        status: 404,
      },
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};