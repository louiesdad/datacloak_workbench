import express from 'express';
import { RedisQueueController } from '../controllers/redis-queue.controller';
import { validateParams, validateQuery, validateBody } from '../middleware/validation.middleware';
import * as Joi from 'joi';

const router = express.Router();
const redisQueueController = new RedisQueueController();

// Validation schemas
const jobIdSchema = Joi.object({
  jobId: Joi.string().uuid().required()
});

const deadLetterQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(1000).default(100)
});

const requeueSchema = Joi.object({
  jobId: Joi.string().uuid().required()
});

// Get queue statistics with Redis-specific details
router.get('/stats/detailed', 
  redisQueueController.getDetailedStats.bind(redisQueueController)
);

// Get dead letter queue jobs
router.get('/dead-letter', 
  validateQuery(deadLetterQuerySchema),
  redisQueueController.getDeadLetterJobs.bind(redisQueueController)
);

// Requeue a job from dead letter queue
router.post('/dead-letter/:jobId/requeue', 
  validateParams(jobIdSchema),
  redisQueueController.requeueDeadLetterJob.bind(redisQueueController)
);

// Get Redis connection status
router.get('/connection/status', 
  redisQueueController.getConnectionStatus.bind(redisQueueController)
);

// Get Redis memory usage
router.get('/memory/usage', 
  redisQueueController.getMemoryUsage.bind(redisQueueController)
);

// Clean up old completed jobs
router.post('/cleanup', 
  validateBody(Joi.object({
    olderThanHours: Joi.number().integer().min(1).default(24)
  })),
  redisQueueController.cleanupJobs.bind(redisQueueController)
);

// Get job retry history
router.get('/:jobId/retries', 
  validateParams(jobIdSchema),
  redisQueueController.getJobRetryHistory.bind(redisQueueController)
);

// Get queue health metrics
router.get('/health/metrics', 
  redisQueueController.getHealthMetrics.bind(redisQueueController)
);

export default router;