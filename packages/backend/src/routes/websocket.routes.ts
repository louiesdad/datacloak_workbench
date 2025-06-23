import { Router } from 'express';
import { websocketController } from '../controllers/websocket.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import Joi from 'joi';

const router = Router();

// Validation schemas
const sendMessageSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.any(),
});

const broadcastSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.any(),
  userId: Joi.string().optional(),
  topic: Joi.string().optional(),
});

const disconnectSchema = Joi.object({
  reason: Joi.string().optional(),
});

// Routes
router.get(
  '/status',
  authenticate,
  asyncHandler(websocketController.getStatus.bind(websocketController))
);

router.post(
  '/send/:clientId',
  authenticate,
  authorize(['admin']),
  validate(sendMessageSchema),
  asyncHandler(websocketController.sendToClient.bind(websocketController))
);

router.post(
  '/broadcast',
  authenticate,
  authorize(['admin']),
  validate(broadcastSchema),
  asyncHandler(websocketController.broadcast.bind(websocketController))
);

router.post(
  '/disconnect/:clientId',
  authenticate,
  authorize(['admin']),
  validate(disconnectSchema),
  asyncHandler(websocketController.disconnectClient.bind(websocketController))
);

// Real-time Risk Assessment WebSocket Endpoints - TASK-201
const riskAssessmentSubscribeSchema = Joi.object({
  assessmentId: Joi.string().optional(),
  frameworks: Joi.array().items(Joi.string()).optional(),
  riskThreshold: Joi.number().min(0).max(100).optional()
});

const riskAssessmentUpdateSchema = Joi.object({
  assessmentId: Joi.string().required(),
  riskScore: Joi.number().min(0).max(100).required(),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed').required(),
  data: Joi.any().optional()
});

router.post(
  '/risk-assessment/subscribe',
  authenticate,
  validate(riskAssessmentSubscribeSchema),
  asyncHandler(websocketController.subscribeToRiskAssessments.bind(websocketController))
);

router.post(
  '/risk-assessment/unsubscribe',
  authenticate,
  asyncHandler(websocketController.unsubscribeFromRiskAssessments.bind(websocketController))
);

router.post(
  '/risk-assessment/update',
  authenticate,
  authorize(['analyst']),
  validate(riskAssessmentUpdateSchema),
  asyncHandler(websocketController.broadcastRiskAssessmentUpdate.bind(websocketController))
);

router.get(
  '/risk-assessment/active-subscriptions',
  authenticate,
  authorize(['admin']),
  asyncHandler(websocketController.getActiveRiskSubscriptions.bind(websocketController))
);

export default router;