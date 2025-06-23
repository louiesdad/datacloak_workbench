import { Router } from 'express';
import { riskAssessmentController } from '../controllers/risk-assessment.controller';

const router = Router();

// Risk assessment endpoints
router.post('/analyze', riskAssessmentController.analyzeRisk.bind(riskAssessmentController));
router.get('/analyze/:assessmentId', riskAssessmentController.getAssessment.bind(riskAssessmentController));
router.post('/batch-analyze', riskAssessmentController.batchAnalyzeRisk.bind(riskAssessmentController));
router.get('/history', riskAssessmentController.getAssessmentHistory.bind(riskAssessmentController));
router.delete('/history/:assessmentId', riskAssessmentController.deleteAssessment.bind(riskAssessmentController));

// Risk scoring and configuration
router.get('/scoring-rules', riskAssessmentController.getScoringRules.bind(riskAssessmentController));
router.put('/scoring-rules', riskAssessmentController.updateScoringRules.bind(riskAssessmentController));
router.get('/thresholds', riskAssessmentController.getRiskThresholds.bind(riskAssessmentController));
router.put('/thresholds', riskAssessmentController.updateRiskThresholds.bind(riskAssessmentController));

// Geographic risk analysis
router.get('/geographic-rules', riskAssessmentController.getGeographicRules.bind(riskAssessmentController));
router.put('/geographic-rules', riskAssessmentController.updateGeographicRules.bind(riskAssessmentController));
router.post('/geographic-analyze', riskAssessmentController.analyzeGeographicRisk.bind(riskAssessmentController));

// Risk mitigation recommendations
router.get('/recommendations/:assessmentId', riskAssessmentController.getRecommendations.bind(riskAssessmentController));
router.post('/recommendations/generate', riskAssessmentController.generateRecommendations.bind(riskAssessmentController));

export default router;