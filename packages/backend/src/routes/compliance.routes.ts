import { Router } from 'express';
import { complianceController } from '../controllers/compliance.controller';

const router = Router();

// Dashboard and overview
router.get('/dashboard', complianceController.getDashboard.bind(complianceController));
router.get('/health', complianceController.getComplianceHealth.bind(complianceController));

// Compliance audits
router.post('/audit', complianceController.performAudit.bind(complianceController));
router.get('/audit/report', complianceController.generateAuditReport.bind(complianceController));
router.get('/audit/download', complianceController.downloadAuditReport.bind(complianceController));

// Framework-specific endpoints
router.get('/framework/:framework', complianceController.getFrameworkDetails.bind(complianceController));
router.get('/rules', complianceController.getComplianceRules.bind(complianceController));

// Enhanced API Endpoints - TASK-201
// Framework management endpoints
router.get('/frameworks', complianceController.getFrameworks.bind(complianceController));
router.post('/frameworks', complianceController.createFramework.bind(complianceController));
router.put('/frameworks/:id', complianceController.updateFramework.bind(complianceController));
router.delete('/frameworks/:id', complianceController.deleteFramework.bind(complianceController));
router.get('/frameworks/:id/config', complianceController.getFrameworkConfig.bind(complianceController));
router.put('/frameworks/:id/config', complianceController.updateFrameworkConfig.bind(complianceController));

// Report generation endpoint
router.post('/report', complianceController.generateComplianceReport.bind(complianceController));
router.get('/reports', complianceController.getReports.bind(complianceController));
router.get('/reports/:id', complianceController.getReport.bind(complianceController));

export default router;