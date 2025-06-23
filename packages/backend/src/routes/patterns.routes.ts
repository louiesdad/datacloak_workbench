import { Router } from 'express';
import { patternsController } from '../controllers/patterns.controller';

const router = Router();

// Custom pattern CRUD endpoints
router.get('/custom', patternsController.getCustomPatterns.bind(patternsController));
router.post('/custom', patternsController.createCustomPattern.bind(patternsController));
router.get('/custom/:id', patternsController.getCustomPattern.bind(patternsController));
router.put('/custom/:id', patternsController.updateCustomPattern.bind(patternsController));
router.delete('/custom/:id', patternsController.deleteCustomPattern.bind(patternsController));

// Pattern validation and testing
router.post('/custom/validate', patternsController.validatePattern.bind(patternsController));
router.post('/custom/test', patternsController.testPattern.bind(patternsController));
router.post('/custom/batch-test', patternsController.batchTestPatterns.bind(patternsController));

// Pattern categories and industry sets
router.get('/categories', patternsController.getPatternCategories.bind(patternsController));
router.get('/industry-sets', patternsController.getIndustryPatternSets.bind(patternsController));
router.get('/industry-sets/:industry', patternsController.getIndustryPatterns.bind(patternsController));

// Pattern performance and optimization
router.get('/performance', patternsController.getPatternPerformance.bind(patternsController));
router.post('/performance/benchmark', patternsController.benchmarkPatterns.bind(patternsController));
router.get('/performance/recommendations', patternsController.getPerformanceRecommendations.bind(patternsController));

// Pattern priority management
router.get('/priorities', patternsController.getPatternPriorities.bind(patternsController));
router.put('/priorities', patternsController.updatePatternPriorities.bind(patternsController));
router.post('/priorities/optimize', patternsController.optimizePriorities.bind(patternsController));

export default router;