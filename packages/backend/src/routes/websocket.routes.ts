import { Router } from 'express';
import { websocketController } from '../controllers/websocket.controller';
import { asyncHandler } from '../middleware/async-handler';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
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
  asyncHandler(websocketController.getStatus)
);

router.post(
  '/send/:clientId',
  authenticate,
  authorize('admin'),
  validate(sendMessageSchema),
  asyncHandler(websocketController.sendToClient)
);

router.post(
  '/broadcast',
  authenticate,
  authorize('admin'),
  validate(broadcastSchema),
  asyncHandler(websocketController.broadcast)
);

router.post(
  '/disconnect/:clientId',
  authenticate,
  authorize('admin'),
  validate(disconnectSchema),
  asyncHandler(websocketController.disconnectClient)
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
  asyncHandler(websocketController.subscribeToRiskAssessments)
);

router.post(
  '/risk-assessment/unsubscribe',
  authenticate,
  asyncHandler(websocketController.unsubscribeFromRiskAssessments)
);

router.post(
  '/risk-assessment/update',
  authenticate,
  authorize('analyst'),
  validate(riskAssessmentUpdateSchema),
  asyncHandler(websocketController.broadcastRiskAssessmentUpdate)
);

router.get(
  '/risk-assessment/active-subscriptions',
  authenticate,
  authorize('admin'),
  asyncHandler(websocketController.getActiveRiskSubscriptions)
);

export default router;