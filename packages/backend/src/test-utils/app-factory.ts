/**
 * Test App Factory
 * 
 * Creates properly configured Express applications for testing
 * with all middleware, routes, and services properly mocked.
 */

import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'express';
import multer from 'multer';
import { authenticateOrBypass } from '../middleware/auth.middleware';
import { errorMiddleware } from '../middleware/error.middleware';

// Import route handlers
import { dataRoutes } from '../routes/data.routes';
import { sentimentRoutes } from '../routes/sentiment.routes';
import { dashboardRoutes } from '../routes/dashboard.routes';
import { analyticsRoutes } from '../routes/analytics.routes';
import { exportRoutes } from '../routes/export.routes';
import { jobRoutes } from '../routes/jobs.routes';
import { securityRoutes } from '../routes/security.routes';

export async function createMockApp(): Promise<express.Application> {
  const app = express();

  // Basic middleware
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
  }));
  
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // File upload middleware
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 1
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    }
  });

  // Authentication middleware (bypassed for tests)
  app.use(authenticateOrBypass);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/data', upload.single('file'), dataRoutes);
  app.use('/api/sentiment', sentimentRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/exports', exportRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/security', securityRoutes);

  // Error handling middleware
  app.use(errorMiddleware);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.originalUrl
    });
  });

  return app;
}

export function createTestUser(role: 'admin' | 'analyst' | 'viewer' = 'admin') {
  return {
    id: `test-user-${role}`,
    username: `test-${role}`,
    email: `test-${role}@company.com`,
    role,
    permissions: [],
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString()
  };
}

export function createTestFile(options: {
  filename?: string;
  content?: string;
  mimetype?: string;
} = {}) {
  const filename = options.filename || 'test.csv';
  const content = options.content || 'text,sentiment\n"test data","positive"';
  const mimetype = options.mimetype || 'text/csv';

  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    destination: '/tmp',
    filename,
    path: `/tmp/${filename}`,
    stream: null as any,
  };
}