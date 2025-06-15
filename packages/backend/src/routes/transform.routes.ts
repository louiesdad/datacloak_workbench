import { Router } from 'express';
import { TransformController } from '../controllers/transform.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
const transformController = new TransformController();

// Transform validation endpoints
router.post('/validate', asyncHandler(transformController.validateTransforms.bind(transformController)));
router.post('/validate-single', asyncHandler(transformController.validateSingleTransform.bind(transformController)));

// Transform information endpoints
router.get('/operations', asyncHandler(transformController.getSupportedOperations.bind(transformController)));
router.get('/rules/:operationType', asyncHandler(transformController.getValidationRules.bind(transformController)));

// Transform persistence endpoints
router.post('/save', asyncHandler(transformController.saveTransform.bind(transformController)));
router.get('/saved', asyncHandler(transformController.listTransforms.bind(transformController)));
router.get('/saved/:id', asyncHandler(transformController.getTransform.bind(transformController)));
router.put('/saved/:id', asyncHandler(transformController.updateTransform.bind(transformController)));
router.delete('/saved/:id', asyncHandler(transformController.deleteTransform.bind(transformController)));
router.get('/saved/:id/history', asyncHandler(transformController.getTransformHistory.bind(transformController)));

// Transform templates endpoints
router.get('/templates', asyncHandler(transformController.getTemplates.bind(transformController)));

// Transform import/export endpoints
router.get('/saved/:id/export', asyncHandler(transformController.exportTransform.bind(transformController)));
router.post('/import', asyncHandler(transformController.importTransform.bind(transformController)));

export const transformRoutes = router;