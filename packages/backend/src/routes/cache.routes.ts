import express from 'express';
import { CacheController } from '../controllers/cache.controller';
import { validateQuery, validateParams, validateBody } from '../middleware/validation.middleware';
import * as Joi from 'joi';

const router = express.Router();
const cacheController = new CacheController();

// Validation schemas
const keyPatternSchema = Joi.object({
  pattern: Joi.string().optional().default('*')
});

const keySchema = Joi.object({
  key: Joi.string().required()
});

const setCacheSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
  ttl: Joi.number().integer().min(1).optional()
});

const cleanupSchema = Joi.object({
  pattern: Joi.string().optional(),
  olderThanMinutes: Joi.number().integer().min(1).optional()
});

// Get cache statistics
router.get('/stats', 
  cacheController.getStats.bind(cacheController)
);

// Get cache configuration
router.get('/config', 
  cacheController.getConfig.bind(cacheController)
);

// Get all cache keys (with optional pattern)
router.get('/keys', 
  validateQuery(keyPatternSchema),
  cacheController.getKeys.bind(cacheController)
);

// Get cache value by key
router.get('/key/:key', 
  validateParams(keySchema),
  cacheController.getValue.bind(cacheController)
);

// Set cache value
router.post('/key', 
  validateBody(setCacheSchema),
  cacheController.setValue.bind(cacheController)
);

// Delete cache key
router.delete('/key/:key', 
  validateParams(keySchema),
  cacheController.deleteKey.bind(cacheController)
);

// Check if key exists
router.head('/key/:key', 
  validateParams(keySchema),
  cacheController.keyExists.bind(cacheController)
);

// Clear all cache
router.delete('/clear', 
  cacheController.clearCache.bind(cacheController)
);

// Cache cleanup (remove old entries)
router.post('/cleanup', 
  validateBody(cleanupSchema),
  cacheController.cleanup.bind(cacheController)
);

// Get cache performance metrics
router.get('/metrics/performance', 
  cacheController.getPerformanceMetrics.bind(cacheController)
);

// Get cache hit/miss analytics
router.get('/metrics/analytics', 
  cacheController.getAnalytics.bind(cacheController)
);

// Invalidate cache by pattern
router.post('/invalidate', 
  validateBody(Joi.object({
    pattern: Joi.string().required(),
    reason: Joi.string().optional()
  })),
  cacheController.invalidatePattern.bind(cacheController)
);

// Warm up cache with common queries
router.post('/warmup', 
  validateBody(Joi.object({
    queries: Joi.array().items(Joi.object({
      type: Joi.string().valid('sentiment', 'pii_detection', 'masking').required(),
      data: Joi.object().required()
    })).required()
  })),
  cacheController.warmupCache.bind(cacheController)
);

export default router;