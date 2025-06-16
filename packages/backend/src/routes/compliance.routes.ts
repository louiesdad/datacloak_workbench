import { Router } from 'express';
import { complianceController } from '../controllers/compliance.controller';

const router = Router();

// Dashboard and overview
router.get('/dashboard', complianceController.getDashboard);
router.get('/health', complianceController.getComplianceHealth);

// Compliance audits
router.post('/audit', complianceController.performAudit);
router.get('/audit/report', complianceController.generateAuditReport);
router.get('/audit/download', complianceController.downloadAuditReport);

// Framework-specific endpoints
router.get('/framework/:framework', complianceController.getFrameworkDetails);
router.get('/rules', complianceController.getComplianceRules);

export default router;