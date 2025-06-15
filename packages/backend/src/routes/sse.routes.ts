/**
 * SSE Routes
 * Server-Sent Events endpoints for real-time updates
 */

import { Router } from 'express';
import { SSEController } from '../controllers/sse.controller';

const router = Router();

// SSE connection endpoint
router.get('/events', SSEController.connect);

// SSE status endpoint
router.get('/status', SSEController.getStatus);

// Test event endpoint (development only)
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-event', SSEController.sendTestEvent);
}

export default router;