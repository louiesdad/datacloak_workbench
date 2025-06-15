import { Application } from 'express';
import { sentimentRoutes } from './sentiment.routes';
import { dataRoutes } from './data.routes';
import { healthRoutes } from './health.routes';
import securityRoutes from './security.routes';
import jobRoutes from './jobs.routes';
import { transformRoutes } from './transform.routes';
import monitoringRoutes from './monitoring.routes';
import exportRoutes from './export.routes';
import sseRoutes from './sse.routes';

export const setupRoutes = (app: Application): void => {
  // Mount routes
  app.use('/api/v1/sentiment', sentimentRoutes);
  app.use('/api/v1/data', dataRoutes);
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/security', securityRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/transform', transformRoutes);
  app.use('/api/v1/monitoring', monitoringRoutes);
  app.use('/api/v1/export', exportRoutes);
  app.use('/api/v1/sse', sseRoutes);
};