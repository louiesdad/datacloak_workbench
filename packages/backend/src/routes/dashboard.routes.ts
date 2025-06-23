import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import * as path from 'path';

const router = Router();
const dashboardController = new DashboardController();

// Dashboard UI (public for demo, in production should be behind auth)
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Get overall dashboard metrics
router.get('/metrics', authenticate, (req, res, next) => {
  dashboardController.getMetrics(req, res).catch(next);
});

// Get job history with filtering
router.get('/jobs/history', authenticate, (req, res, next) => {
  dashboardController.getJobHistory(req, res).catch(next);
});

// Get recent activity
router.get('/recent-activity', authenticate, (req, res, next) => {
  dashboardController.getRecentActivity(req, res).catch(next);
});

// Get analytics summary
router.get('/analytics/summary', authenticate, (req, res, next) => {
  dashboardController.getAnalyticsSummary(req, res).catch(next);
});

// Get system health status
router.get('/system/health', authenticate, (req, res, next) => {
  dashboardController.getSystemHealth(req, res).catch(next);
});

// Data management endpoints
router.get('/data/datasets', authenticate, (req, res, next) => {
  dashboardController.getDatasets(req, res).catch(next);
});

router.get('/sentiment/analyses', authenticate, (req, res, next) => {
  dashboardController.getSentimentAnalyses(req, res).catch(next);
});

router.get('/data/exports', authenticate, (req, res, next) => {
  dashboardController.getDataExports(req, res).catch(next);
});

// Job management endpoints
router.get('/jobs/active', authenticate, (req, res, next) => {
  dashboardController.getActiveJobs(req, res).catch(next);
});

router.get('/jobs/stats', authenticate, (req, res, next) => {
  dashboardController.getJobStats(req, res).catch(next);
});

router.get('/jobs/types', authenticate, (req, res, next) => {
  dashboardController.getJobTypes(req, res).catch(next);
});

router.get('/jobs/:jobId/details', authenticate, (req, res, next) => {
  dashboardController.getJobDetails(req, res).catch(next);
});

router.post('/jobs/:jobId/retry', authenticate, (req, res, next) => {
  dashboardController.retryJob(req, res).catch(next);
});

router.post('/jobs/:jobId/cancel', authenticate, (req, res, next) => {
  dashboardController.cancelJob(req, res).catch(next);
});

router.get('/jobs/:jobId/progress', authenticate, (req, res, next) => {
  dashboardController.getJobProgress(req, res).catch(next);
});

// Advanced analytics
router.get('/jobs/type/:type', authenticate, (req, res, next) => {
  dashboardController.getJobsByType(req, res).catch(next);
});

router.get('/jobs/timeline', authenticate, (req, res, next) => {
  dashboardController.getJobsTimeline(req, res).catch(next);
});

// Get performance metrics
router.get('/performance', authenticate, (req, res, next) => {
  dashboardController.getPerformanceMetrics(req, res).catch(next);
});

export default router;