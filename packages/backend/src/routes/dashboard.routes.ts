import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import * as path from 'path';

const router = Router();
const dashboardController = new DashboardController();

// Dashboard UI (public for demo, in production should be behind auth)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// All API routes require authentication
router.use('/api', authMiddleware);

// Get overall dashboard metrics
router.get('/metrics', (req, res, next) => {
  dashboardController.getMetrics(req, res).catch(next);
});

// Get job history with filtering
router.get('/jobs/history', (req, res, next) => {
  dashboardController.getJobHistory(req, res).catch(next);
});

// Get system health status
router.get('/health', (req, res, next) => {
  dashboardController.getSystemHealth(req, res).catch(next);
});

// Get performance metrics
router.get('/performance', (req, res, next) => {
  dashboardController.getPerformanceMetrics(req, res).catch(next);
});

export default router;