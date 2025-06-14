import { Router } from 'express';
import { SentimentController } from '../controllers/sentiment.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
const sentimentController = new SentimentController();

// Sentiment analysis endpoints
router.post('/analyze', asyncHandler(sentimentController.analyzeSentiment));
router.post('/batch', asyncHandler(sentimentController.batchAnalyzeSentiment));
router.get('/history', asyncHandler(sentimentController.getAnalysisHistory));
router.get('/statistics', asyncHandler(sentimentController.getStatistics));

export const sentimentRoutes = router;