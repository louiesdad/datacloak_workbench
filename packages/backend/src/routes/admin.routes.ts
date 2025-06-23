import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/admin-auth.middleware';
import { LogViewerController } from '../controllers/log-viewer.controller';
import { SystemHealthController } from '../controllers/system-health.controller';

const router = Router();
const logViewerController = new LogViewerController();
const systemHealthController = new SystemHealthController();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

// Log viewing endpoints
router.get('/logs', logViewerController.getLogs.bind(logViewerController));
router.get('/logs/download', logViewerController.downloadLogs.bind(logViewerController));
router.get('/logs/stream', logViewerController.streamLogs.bind(logViewerController));
router.delete('/logs/clear', logViewerController.clearLogs.bind(logViewerController));

// System health and monitoring
router.get('/health', systemHealthController.getSystemHealth.bind(systemHealthController));
router.get('/metrics', systemHealthController.getMetrics.bind(systemHealthController));
router.get('/config', systemHealthController.getConfiguration.bind(systemHealthController));

// Audit log endpoints (database-stored logs)
router.get('/audit-logs', logViewerController.getAuditLogs.bind(logViewerController));
router.get('/audit-logs/export', logViewerController.exportAuditLogs.bind(logViewerController));

export default router;