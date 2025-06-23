import { Application } from 'express';
import { sentimentRoutes } from './sentiment.routes';
import { dataRoutes } from './data.routes';
import { healthRoutes } from './health.routes';
import securityRoutes from './security.routes';
import jobRoutes from './jobs.routes';
import { transformRoutes } from './transform.routes';
import monitoringRoutes from './monitoring.routes';
// import exportRoutes from './export.routes';
import sseRoutes from './sse.routes';
import { streamRoutes } from './stream.routes';
import authRoutes from './auth.routes';
import configRoutes from './config.routes';
import websocketRoutes from './websocket.routes';
import openaiRoutes from './openai.routes';
import redisQueueRoutes from './redis-queue.routes';
import cacheRoutes from './cache.routes';
import analyticsRoutes from './analytics.routes';
import dashboardRoutes from './dashboard.routes';
import connectionStatusRoutes from './connection-status.routes';
import complianceRoutes from './compliance.routes';
import riskAssessmentRoutes from './risk-assessment.routes';
import patternsRoutes from './patterns.routes';
import { circuitBreakerRoutes } from './circuit-breaker.routes';
import adminRoutes from './admin.routes';
import auditRoutes from './audit.routes';
import predictionRoutes from './prediction.routes';

export const setupRoutes = (app: Application): void => {
  // Mount routes
  app.use('/api/v1/sentiment', sentimentRoutes);
  app.use('/api/v1/data', dataRoutes);
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/security', securityRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/transform', transformRoutes);
  app.use('/api/v1/monitoring', monitoringRoutes);
  // app.use('/api/v1/export', exportRoutes);
  app.use('/api/v1/sse', sseRoutes);
  app.use('/api/v1/stream', streamRoutes);
  app.use('/api/v1/websocket', websocketRoutes);
  
  // Admin routes
  app.use('/api/auth', authRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/v1/openai', openaiRoutes);
  app.use('/api/v1/redis-queue', redisQueueRoutes);
  app.use('/api/v1/cache', cacheRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/connection', connectionStatusRoutes);
  app.use('/api/v1/compliance', complianceRoutes);
  app.use('/api/v1/risk-assessment', riskAssessmentRoutes);
  app.use('/api/v1/patterns', patternsRoutes);
  app.use('/api/v1/circuit-breaker', circuitBreakerRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/predictions', predictionRoutes);
  
  // Admin routes (protected by admin auth middleware)
  app.use('/api/admin', adminRoutes);
};