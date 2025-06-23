import request from 'supertest';
import express from 'express';
import cacheRoutes from '../cache.routes';

const app = express();
app.use(express.json());
app.use('/api/cache', cacheRoutes);

// Mock the cache controller
jest.mock('../../controllers/cache.controller', () => ({
  CacheController: jest.fn().mockImplementation(() => ({
    getStats: jest.fn((req, res) => res.status(200).json({ 
      data: { 
        totalKeys: 100, 
        memoryUsage: '50MB', 
        hitRate: 0.85 
      } 
    })),
    getConfig: jest.fn((req, res) => res.status(200).json({ 
      data: { 
        type: 'redis', 
        maxMemory: '256MB', 
        ttl: 3600 
      } 
    })),
    getKeys: jest.fn((req, res) => res.status(200).json({ 
      data: { 
        keys: ['key1', 'key2', 'key3'], 
        count: 3 
      } 
    })),
    getValue: jest.fn((req, res) => {
      const { key } = req.params;
      if (key === 'nonexistent') {
        return res.status(404).json({ error: 'Key not found' });
      }
      res.status(200).json({ 
        data: { 
          key, 
          value: 'cached-value', 
          ttl: 1800 
        } 
      });
    }),
    setValue: jest.fn((req, res) => res.status(201).json({ 
      success: true, 
      message: 'Cache key set successfully' 
    })),
    deleteKey: jest.fn((req, res) => {
      const { key } = req.params;
      if (key === 'nonexistent') {
        return res.status(404).json({ error: 'Key not found' });
      }
      res.status(200).json({ 
        success: true, 
        message: 'Cache key deleted' 
      });
    }),
    keyExists: jest.fn((req, res) => {
      const { key } = req.params;
      if (key === 'nonexistent') {
        return res.status(404).end();
      }
      res.status(200).end();
    }),
    clearCache: jest.fn((req, res) => res.status(200).json({ 
      success: true, 
      message: 'Cache cleared successfully', 
      cleared: 100 
    })),
    cleanup: jest.fn((req, res) => res.status(200).json({ 
      success: true, 
      message: 'Cache cleanup completed', 
      removed: 25 
    })),
    getPerformanceMetrics: jest.fn((req, res) => res.status(200).json({ 
      data: { 
        hitRate: 0.85, 
        missRate: 0.15, 
        avgResponseTime: 2.5, 
        throughput: 1000 
      } 
    })),
    getAnalytics: jest.fn((req, res) => res.status(200).json({ 
      data: { 
        totalRequests: 10000, 
        hits: 8500, 
        misses: 1500, 
        evictions: 50 
      } 
    })),
    invalidatePattern: jest.fn((req, res) => res.status(200).json({ 
      success: true, 
      message: 'Pattern invalidated', 
      invalidated: 10 
    })),
    warmupCache: jest.fn((req, res) => res.status(200).json({ 
      success: true, 
      message: 'Cache warmed up', 
      cached: 5 
    }))
  }))
}));

// Mock validation middleware
jest.mock('../../middleware/validation.middleware', () => ({
  validateQuery: jest.fn(() => (req, res, next) => next()),
  validateParams: jest.fn(() => (req, res, next) => next()),
  validateBody: jest.fn(() => (req, res, next) => next())
}));

describe('Cache Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cache Statistics and Configuration', () => {
    test('GET /api/cache/stats should return cache statistics', async () => {
      const response = await request(app)
        .get('/api/cache/stats')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          totalKeys: 100,
          memoryUsage: '50MB',
          hitRate: 0.85
        }
      });
    });

    test('GET /api/cache/config should return cache configuration', async () => {
      const response = await request(app)
        .get('/api/cache/config')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          type: 'redis',
          maxMemory: '256MB',
          ttl: 3600
        }
      });
    });
  });

  describe('Cache Key Operations', () => {
    test('GET /api/cache/keys should return all cache keys', async () => {
      const response = await request(app)
        .get('/api/cache/keys')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          keys: ['key1', 'key2', 'key3'],
          count: 3
        }
      });
    });

    test('GET /api/cache/keys should handle pattern query parameter', async () => {
      await request(app)
        .get('/api/cache/keys?pattern=user:*')
        .expect(200);
    });

    test('GET /api/cache/key/:key should return cache value for existing key', async () => {
      const response = await request(app)
        .get('/api/cache/key/test-key')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          key: 'test-key',
          value: 'cached-value',
          ttl: 1800
        }
      });
    });

    test('GET /api/cache/key/:key should return 404 for non-existent key', async () => {
      const response = await request(app)
        .get('/api/cache/key/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Key not found'
      });
    });

    test('POST /api/cache/key should set cache value', async () => {
      const cacheData = {
        key: 'new-key',
        value: { data: 'test' },
        ttl: 3600
      };

      const response = await request(app)
        .post('/api/cache/key')
        .send(cacheData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Cache key set successfully'
      });
    });

    test('DELETE /api/cache/key/:key should delete existing cache key', async () => {
      const response = await request(app)
        .delete('/api/cache/key/test-key')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cache key deleted'
      });
    });

    test('DELETE /api/cache/key/:key should return 404 for non-existent key', async () => {
      const response = await request(app)
        .delete('/api/cache/key/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Key not found'
      });
    });

    test('HEAD /api/cache/key/:key should return 200 for existing key', async () => {
      await request(app)
        .head('/api/cache/key/test-key')
        .expect(200);
    });

    test('HEAD /api/cache/key/:key should return 404 for non-existent key', async () => {
      await request(app)
        .head('/api/cache/key/nonexistent')
        .expect(404);
    });
  });

  describe('Cache Management Operations', () => {
    test('DELETE /api/cache/clear should clear all cache', async () => {
      const response = await request(app)
        .delete('/api/cache/clear')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cache cleared successfully',
        cleared: 100
      });
    });

    test('POST /api/cache/cleanup should cleanup old cache entries', async () => {
      const cleanupData = {
        pattern: 'temp:*',
        olderThanMinutes: 60
      };

      const response = await request(app)
        .post('/api/cache/cleanup')
        .send(cleanupData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cache cleanup completed',
        removed: 25
      });
    });

    test('POST /api/cache/invalidate should invalidate cache by pattern', async () => {
      const invalidateData = {
        pattern: 'user:*',
        reason: 'User data updated'
      };

      const response = await request(app)
        .post('/api/cache/invalidate')
        .send(invalidateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Pattern invalidated',
        invalidated: 10
      });
    });

    test('POST /api/cache/warmup should warm up cache with queries', async () => {
      const warmupData = {
        queries: [
          {
            type: 'sentiment',
            data: { text: 'Test sentiment analysis' }
          },
          {
            type: 'pii_detection',
            data: { text: 'John Doe email@example.com' }
          }
        ]
      };

      const response = await request(app)
        .post('/api/cache/warmup')
        .send(warmupData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cache warmed up',
        cached: 5
      });
    });
  });

  describe('Cache Metrics and Analytics', () => {
    test('GET /api/cache/metrics/performance should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/cache/metrics/performance')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          hitRate: 0.85,
          missRate: 0.15,
          avgResponseTime: 2.5,
          throughput: 1000
        }
      });
    });

    test('GET /api/cache/metrics/analytics should return cache analytics', async () => {
      const response = await request(app)
        .get('/api/cache/metrics/analytics')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          totalRequests: 10000,
          hits: 8500,
          misses: 1500,
          evictions: 50
        }
      });
    });
  });

  describe('Validation and Error Handling', () => {
    test('should handle POST /api/cache/key with missing required fields', async () => {
      // Note: This would normally be caught by validation middleware
      // Since we've mocked the validation, we'll test the route exists
      await request(app)
        .post('/api/cache/key')
        .send({})
        .expect(201); // Mock returns success regardless
    });

    test('should handle invalid cache key parameter', async () => {
      // The validation middleware is mocked, so this tests route structure
      await request(app)
        .get('/api/cache/key/')
        .expect(404); // Express route not found
    });

    test('should handle POST /api/cache/warmup with invalid query type', async () => {
      const invalidData = {
        queries: [
          {
            type: 'invalid_type',
            data: { text: 'test' }
          }
        ]
      };

      // Validation middleware is mocked, so this will pass through
      await request(app)
        .post('/api/cache/warmup')
        .send(invalidData)
        .expect(200);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty pattern in cleanup', async () => {
      await request(app)
        .post('/api/cache/cleanup')
        .send({})
        .expect(200);
    });

    test('should handle cache operations with special characters in keys', async () => {
      await request(app)
        .get('/api/cache/key/test:key:with:colons')
        .expect(200);
    });

    test('should handle large cache values', async () => {
      const largeValue = 'x'.repeat(10000);
      await request(app)
        .post('/api/cache/key')
        .send({ key: 'large-key', value: largeValue })
        .expect(201);
    });
  });
});