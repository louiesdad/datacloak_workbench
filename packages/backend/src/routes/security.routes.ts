import { Router } from 'express';
import { SecurityController } from '../controllers/security.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { securitySchemas } from '../validation/schemas';

const router = Router();
const securityController = new SecurityController();

// PII Detection Routes
router.post(
  '/detect',
  validateRequest(securitySchemas.detectPII),
  securityController.detectPII.bind(securityController)
);

router.post(
  '/mask',
  validateRequest(securitySchemas.maskText),
  securityController.maskText.bind(securityController)
);

// File and Dataset Security Routes
router.post(
  '/audit/file',
  validateRequest(securitySchemas.auditFile),
  securityController.auditFile.bind(securityController)
);

router.post(
  '/scan/dataset/:datasetId',
  validateRequest(securitySchemas.scanDataset),
  securityController.scanDataset.bind(securityController)
);

// Metrics and Monitoring Routes
router.get(
  '/metrics',
  securityController.getMetrics.bind(securityController)
);

router.get(
  '/audit/history',
  securityController.getAuditHistory.bind(securityController)
);

router.get(
  '/status',
  securityController.getSecurityStatus.bind(securityController)
);

export default router;