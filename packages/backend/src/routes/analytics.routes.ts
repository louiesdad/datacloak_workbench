import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';

const router = Router();

// Analytics overview and initialization
router.post('/initialize', analyticsController.initialize.bind(analyticsController));
router.get('/overview', analyticsController.getOverview.bind(analyticsController));
router.get('/health', analyticsController.getMetricsHealth.bind(analyticsController));

// Sentiment analysis and trends
router.get('/sentiment/trends', analyticsController.getSentimentTrends.bind(analyticsController));
router.get('/sentiment/timeseries', analyticsController.getTimeSeriesData.bind(analyticsController));

// Keywords and text analysis
router.get('/keywords', analyticsController.getKeywords.bind(analyticsController));
router.post('/keywords/update', analyticsController.updateKeywordAnalytics.bind(analyticsController));
router.get('/text', analyticsController.getTextAnalytics.bind(analyticsController));

// Insights and recommendations
router.get('/insights', analyticsController.getInsights.bind(analyticsController));
router.get('/insights/business', analyticsController.getBusinessInsights.bind(analyticsController));

// Advanced analytics and exports
router.get('/advanced', analyticsController.getAdvancedAnalytics.bind(analyticsController));
router.get('/export', analyticsController.getAnalyticsExport.bind(analyticsController));

// Performance analytics endpoints - TASK-201
router.get('/performance', analyticsController.getPerformanceMetrics.bind(analyticsController));
router.get('/performance/real-time', analyticsController.getRealTimePerformance.bind(analyticsController));
router.get('/performance/trends', analyticsController.getPerformanceTrends.bind(analyticsController));
router.get('/performance/cache', analyticsController.getCachePerformance.bind(analyticsController));
router.get('/performance/api', analyticsController.getAPIPerformance.bind(analyticsController));
router.get('/performance/database', analyticsController.getDatabasePerformance.bind(analyticsController));
router.get('/performance/memory', analyticsController.getMemoryUsage.bind(analyticsController));
router.get('/performance/alerts', analyticsController.getPerformanceAlerts.bind(analyticsController));
router.post('/performance/baseline', analyticsController.setPerformanceBaseline.bind(analyticsController));

export default router;