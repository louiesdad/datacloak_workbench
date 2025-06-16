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

export default router;