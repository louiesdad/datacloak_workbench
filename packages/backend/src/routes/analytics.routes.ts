import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

// Analytics overview and initialization
router.post('/initialize', analyticsController.initialize);
router.get('/overview', analyticsController.getOverview);
router.get('/health', analyticsController.getMetricsHealth);

// Sentiment analysis and trends
router.get('/sentiment/trends', analyticsController.getSentimentTrends);
router.get('/sentiment/timeseries', analyticsController.getTimeSeriesData);

// Keywords and text analysis
router.get('/keywords', analyticsController.getKeywords);
router.post('/keywords/update', analyticsController.updateKeywordAnalytics);
router.get('/text', analyticsController.getTextAnalytics);

// Insights and recommendations
router.get('/insights', analyticsController.getInsights);
router.get('/insights/business', analyticsController.getBusinessInsights);

// Advanced analytics and exports
router.get('/advanced', analyticsController.getAdvancedAnalytics);
router.get('/export', analyticsController.getAnalyticsExport);

// Performance analytics endpoints - TASK-201
router.get('/performance', analyticsController.getPerformanceMetrics);
router.get('/performance/real-time', analyticsController.getRealTimePerformance);
router.get('/performance/trends', analyticsController.getPerformanceTrends);
router.get('/performance/cache', analyticsController.getCachePerformance);
router.get('/performance/api', analyticsController.getAPIPerformance);
router.get('/performance/database', analyticsController.getDatabasePerformance);
router.get('/performance/memory', analyticsController.getMemoryUsage);
router.get('/performance/alerts', analyticsController.getPerformanceAlerts);
router.post('/performance/baseline', analyticsController.setPerformanceBaseline);

export default router;