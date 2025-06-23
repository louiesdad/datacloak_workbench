import { Router } from 'express';
import { connectionStatusController } from '../controllers/connection-status.controller';

const router = Router();

// Basic status information
router.get('/status', connectionStatusController.getStatus.bind(connectionStatusController));
router.get('/health', connectionStatusController.getHealthCheck.bind(connectionStatusController));
router.get('/uptime', connectionStatusController.getUptime.bind(connectionStatusController));
router.get('/latency', connectionStatusController.getLatency.bind(connectionStatusController));
router.get('/connections', connectionStatusController.getConnectionCount.bind(connectionStatusController));

// Detailed status with computed fields
router.get('/detailed', connectionStatusController.getDetailedStatus.bind(connectionStatusController));

// Management endpoints
router.post('/check', connectionStatusController.forceStatusCheck.bind(connectionStatusController));
router.post('/clear-errors', connectionStatusController.clearErrors.bind(connectionStatusController));

export default router;