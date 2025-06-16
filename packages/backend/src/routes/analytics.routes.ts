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

export default router;