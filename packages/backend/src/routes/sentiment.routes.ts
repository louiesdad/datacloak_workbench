import { Router } from 'express';
import { SentimentController } from '../controllers/sentiment.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
const sentimentController = new SentimentController();

// Sentiment analysis endpoints
router.post('/analyze', asyncHandler(sentimentController.analyzeSentiment.bind(sentimentController)));
router.post('/analyze/preview', asyncHandler(sentimentController.analyzePreview.bind(sentimentController)));
router.post('/batch', asyncHandler(sentimentController.batchAnalyzeSentiment.bind(sentimentController)));
router.get('/history', asyncHandler(sentimentController.getAnalysisHistory.bind(sentimentController)));
router.get('/statistics', asyncHandler(sentimentController.getStatistics.bind(sentimentController)));

// Result management endpoints
router.get('/results/:id', asyncHandler(sentimentController.getAnalysisById.bind(sentimentController)));
router.delete('/results', asyncHandler(sentimentController.deleteAnalysisResults.bind(sentimentController)));
router.get('/export', asyncHandler(sentimentController.exportAnalysisResults.bind(sentimentController)));
router.get('/insights', asyncHandler(sentimentController.getAnalysisInsights.bind(sentimentController)));

// Cost estimation endpoints
router.post('/estimate-cost', asyncHandler(sentimentController.estimateCost.bind(sentimentController)));
router.get('/compare-costs', asyncHandler(sentimentController.compareCosts.bind(sentimentController)));

// OpenAI management endpoints
router.get('/openai/test', asyncHandler(sentimentController.testOpenAIConnection.bind(sentimentController)));
router.get('/openai/status', asyncHandler(sentimentController.getOpenAIStatus.bind(sentimentController)));
router.put('/openai/config', asyncHandler(sentimentController.updateOpenAIConfig.bind(sentimentController)));
router.get('/models', asyncHandler(sentimentController.getAvailableModels.bind(sentimentController)));

// DataCloak integration endpoints
router.get('/datacloak/test', asyncHandler(sentimentController.testDataCloakFlow.bind(sentimentController)));
router.get('/datacloak/stats', asyncHandler(sentimentController.getDataCloakStats.bind(sentimentController)));

export const sentimentRoutes = router;