import { Router } from 'express';
import { riskAssessmentController } from '../controllers/risk-assessment.controller';

const router = Router();

// Risk assessment endpoints
router.post('/analyze', riskAssessmentController.analyzeRisk);
router.get('/analyze/:assessmentId', riskAssessmentController.getAssessment);
router.post('/batch-analyze', riskAssessmentController.batchAnalyzeRisk);
router.get('/history', riskAssessmentController.getAssessmentHistory);
router.delete('/history/:assessmentId', riskAssessmentController.deleteAssessment);

// Risk scoring and configuration
router.get('/scoring-rules', riskAssessmentController.getScoringRules);
router.put('/scoring-rules', riskAssessmentController.updateScoringRules);
router.get('/thresholds', riskAssessmentController.getRiskThresholds);
router.put('/thresholds', riskAssessmentController.updateRiskThresholds);

// Geographic risk analysis
router.get('/geographic-rules', riskAssessmentController.getGeographicRules);
router.put('/geographic-rules', riskAssessmentController.updateGeographicRules);
router.post('/geographic-analyze', riskAssessmentController.analyzeGeographicRisk);

// Risk mitigation recommendations
router.get('/recommendations/:assessmentId', riskAssessmentController.getRecommendations);
router.post('/recommendations/generate', riskAssessmentController.generateRecommendations);

export default router;