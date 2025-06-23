import { Router } from 'express';
import { TransformController } from '../controllers/transform.controller';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();
let transformController: TransformController;

// Defer controller creation to avoid initialization issues
const getController = () => {
  if (!transformController) {
    transformController = new TransformController();
  }
  return transformController;
};

// Transform validation endpoints
router.post('/validate', asyncHandler((req, res, next) => getController().validateTransforms(req, res, next)));
router.post('/validate-single', asyncHandler((req, res, next) => getController().validateSingleTransform(req, res, next)));

// Transform information endpoints
router.get('/operations', asyncHandler((req, res, next) => getController().getSupportedOperations(req, res, next)));
router.get('/rules/:operationType', asyncHandler((req, res, next) => getController().getValidationRules(req, res, next)));

// Transform persistence endpoints
router.post('/save', asyncHandler((req, res, next) => getController().saveTransform(req, res, next)));
router.get('/saved', asyncHandler((req, res, next) => getController().listTransforms(req, res, next)));
router.get('/saved/:id', asyncHandler((req, res, next) => getController().getTransform(req, res, next)));
router.put('/saved/:id', asyncHandler((req, res, next) => getController().updateTransform(req, res, next)));
router.delete('/saved/:id', asyncHandler((req, res, next) => getController().deleteTransform(req, res, next)));
router.get('/saved/:id/history', asyncHandler((req, res, next) => getController().getTransformHistory(req, res, next)));

// Transform templates endpoints
router.get('/templates', asyncHandler((req, res, next) => getController().getTemplates(req, res, next)));

// Transform import/export endpoints
router.get('/saved/:id/export', asyncHandler((req, res, next) => getController().exportTransform(req, res, next)));
router.post('/import', asyncHandler((req, res, next) => getController().importTransform(req, res, next)));

export const transformRoutes = router;