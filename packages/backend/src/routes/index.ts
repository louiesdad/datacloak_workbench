import { Application } from 'express';
import { sentimentRoutes } from './sentiment.routes';
import { dataRoutes } from './data.routes';
import { healthRoutes } from './health.routes';

export const setupRoutes = (app: Application): void => {
  // Mount routes
  app.use('/api/v1/sentiment', sentimentRoutes);
  app.use('/api/v1/data', dataRoutes);
  app.use('/api/v1/health', healthRoutes);
};