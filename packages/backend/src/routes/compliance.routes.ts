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

// Enhanced API Endpoints - TASK-201
// Framework management endpoints
router.get('/frameworks', complianceController.getFrameworks);
router.post('/frameworks', complianceController.createFramework);
router.put('/frameworks/:id', complianceController.updateFramework);
router.delete('/frameworks/:id', complianceController.deleteFramework);
router.get('/frameworks/:id/config', complianceController.getFrameworkConfig);
router.put('/frameworks/:id/config', complianceController.updateFrameworkConfig);

// Report generation endpoint
router.post('/report', complianceController.generateComplianceReport);
router.get('/reports', complianceController.getReports);
router.get('/reports/:id', complianceController.getReport);

export default router;