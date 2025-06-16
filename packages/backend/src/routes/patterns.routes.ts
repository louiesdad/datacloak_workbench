import { Router } from 'express';
import { patternsController } from '../controllers/patterns.controller';

const router = Router();

// Custom pattern CRUD endpoints
router.get('/custom', patternsController.getCustomPatterns);
router.post('/custom', patternsController.createCustomPattern);
router.get('/custom/:id', patternsController.getCustomPattern);
router.put('/custom/:id', patternsController.updateCustomPattern);
router.delete('/custom/:id', patternsController.deleteCustomPattern);

// Pattern validation and testing
router.post('/custom/validate', patternsController.validatePattern);
router.post('/custom/test', patternsController.testPattern);
router.post('/custom/batch-test', patternsController.batchTestPatterns);

// Pattern categories and industry sets
router.get('/categories', patternsController.getPatternCategories);
router.get('/industry-sets', patternsController.getIndustryPatternSets);
router.get('/industry-sets/:industry', patternsController.getIndustryPatterns);

// Pattern performance and optimization
router.get('/performance', patternsController.getPatternPerformance);
router.post('/performance/benchmark', patternsController.benchmarkPatterns);
router.get('/performance/recommendations', patternsController.getPerformanceRecommendations);

// Pattern priority management
router.get('/priorities', patternsController.getPatternPriorities);
router.put('/priorities', patternsController.updatePatternPriorities);
router.post('/priorities/optimize', patternsController.optimizePriorities);

export default router;