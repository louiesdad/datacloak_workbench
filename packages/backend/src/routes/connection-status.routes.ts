import { Router } from 'express';
import { connectionStatusController } from '../controllers/connection-status.controller';

const router = Router();

// Basic status information
router.get('/status', connectionStatusController.getStatus);
router.get('/health', connectionStatusController.getHealthCheck);
router.get('/uptime', connectionStatusController.getUptime);
router.get('/latency', connectionStatusController.getLatency);
router.get('/connections', connectionStatusController.getConnectionCount);

// Detailed status with computed fields
router.get('/detailed', connectionStatusController.getDetailedStatus);

// Management endpoints
router.post('/check', connectionStatusController.forceStatusCheck);
router.post('/clear-errors', connectionStatusController.clearErrors);

export default router;