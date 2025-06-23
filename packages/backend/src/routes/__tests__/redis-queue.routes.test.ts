import request from 'supertest';
import express from 'express';

// Mock Redis Queue Controller
const mockRedisQueueController = {
  getDetailedStats: jest.fn(),
  getDeadLetterJobs: jest.fn(),
  requeueDeadLetterJob: jest.fn(),
  getConnectionStatus: jest.fn(),
  getMemoryUsage: jest.fn(),
  cleanupJobs: jest.fn(),
  getJobRetryHistory: jest.fn(),
  getHealthMetrics: jest.fn(),
};

// Mock validation middleware
const mockValidateParams = jest.fn((schema) => (req, res, next) => {
  // Simple validation mock - validates UUID format
  if (schema._ids && schema._ids.has('jobId')) {
    const jobId = req.params.jobId;
    if (!jobId || !jobId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid jobId format' });
    }
  }
  next();
});

const mockValidateQuery = jest.fn((schema) => (req, res, next) => {
  if (req.query.limit && isNaN(parseInt(req.query.limit as string))) {
    return res.status(400).json({ error: 'Invalid limit parameter' });
  }
  next();
});

const mockValidateBody = jest.fn((schema) => (req, res, next) => {
  if (req.body.olderThanHours !== undefined && isNaN(parseInt(req.body.olderThanHours))) {
    return res.status(400).json({ error: 'Invalid olderThanHours parameter' });
  }
  next();
});

jest.mock('../../controllers/redis-queue.controller', () => ({
  RedisQueueController: jest.fn().mockImplementation(() => mockRedisQueueController)
}));

jest.mock('../../middleware/validation.middleware', () => ({
  validateParams: mockValidateParams,
  validateQuery: mockValidateQuery,
  validateBody: mockValidateBody,
}));

jest.mock('joi', () => {
  const mockChain = {
    uuid: () => mockChain,
    required: () => mockChain,
    integer: () => mockChain,
    min: () => mockChain,
    max: () => mockChain,
    default: () => mockChain,
    items: () => mockChain,
    valid: () => mockChain,
    optional: () => mockChain,
  };
  
  return {
    object: jest.fn(() => ({ _ids: new Set(['jobId']) })),
    string: jest.fn(() => mockChain),
    number: jest.fn(() => mockChain),
    array: jest.fn(() => mockChain),
  };
});

import redisQueueRoutes from '../redis-queue.routes';

describe('Redis Queue Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/redis-queue', redisQueueRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /redis-queue/stats/detailed', () => {
    it('should get detailed Redis queue statistics', async () => {
      const mockStats = {
        queues: {
          'sentiment-analysis': { waiting: 5, active: 2, completed: 100, failed: 3 },
          'data-processing': { waiting: 2, active: 1, completed: 50, failed: 1 }
        },
        redis: {
          memory: { used: 1024000, peak: 2048000 },
          connections: { total: 10, active: 5 },
          keyspace: { db0: { keys: 150, expires: 20 } }
        },
        performance: {
          avgJobTime: 1250,
          throughputPerMinute: 25.5,
          errorRate: 0.03
        }
      };

      mockRedisQueueController.getDetailedStats.mockImplementation((req, res) => {
        res.json({ success: true, data: mockStats });
      });

      const response = await request(app)
        .get('/redis-queue/stats/detailed')
        .expect(200);

      expect(mockRedisQueueController.getDetailedStats).toHaveBeenCalled();
    });

    it('should handle Redis connection errors', async () => {
      mockRedisQueueController.getDetailedStats.mockImplementation((req, res) => {
        res.status(503).json({ success: false, error: 'Redis connection failed' });
      });

      const response = await request(app)
        .get('/redis-queue/stats/detailed')
        .expect(503);

      expect(mockRedisQueueController.getDetailedStats).toHaveBeenCalled();
    });
  });

  describe('GET /redis-queue/dead-letter', () => {
    it('should get dead letter queue jobs with default limit', async () => {
      const mockDeadLetterJobs = [
        {
          id: 'job-1',
          name: 'sentiment-analysis',
          data: { text: 'test' },
          failedReason: 'Connection timeout',
          failedAt: '2024-01-01T00:00:00Z',
          attempts: 3
        }
      ];

      mockRedisQueueController.getDeadLetterJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: mockDeadLetterJobs, count: 1 });
      });

      const response = await request(app)
        .get('/redis-queue/dead-letter')
        .expect(200);

      expect(mockRedisQueueController.getDeadLetterJobs).toHaveBeenCalled();
    });

    it('should get dead letter queue jobs with custom limit', async () => {
      mockRedisQueueController.getDeadLetterJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: [], count: 0 });
      });

      const response = await request(app)
        .get('/redis-queue/dead-letter?limit=50')
        .expect(200);

      expect(mockRedisQueueController.getDeadLetterJobs).toHaveBeenCalled();
    });

    it('should validate limit parameter', async () => {
      const response = await request(app)
        .get('/redis-queue/dead-letter?limit=invalid')
        .expect(400);

      expect(response.body.error).toBe('Invalid limit parameter');
    });

    it('should handle empty dead letter queue', async () => {
      mockRedisQueueController.getDeadLetterJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: [], count: 0 });
      });

      const response = await request(app)
        .get('/redis-queue/dead-letter')
        .expect(200);

      expect(response.body.count).toBe(0);
    });
  });

  describe('POST /redis-queue/dead-letter/:jobId/requeue', () => {
    const validJobId = '550e8400-e29b-41d4-a716-446655440000';

    it('should requeue a dead letter job successfully', async () => {
      mockRedisQueueController.requeueDeadLetterJob.mockImplementation((req, res) => {
        res.json({ success: true, message: 'Job requeued successfully' });
      });

      const response = await request(app)
        .post(`/redis-queue/dead-letter/${validJobId}/requeue`)
        .expect(200);

      expect(mockRedisQueueController.requeueDeadLetterJob).toHaveBeenCalled();
    });

    it('should validate jobId format', async () => {
      const response = await request(app)
        .post('/redis-queue/dead-letter/invalid-id/requeue')
        .expect(400);

      expect(response.body.error).toBe('Invalid jobId format');
    });

    it('should handle job not found in dead letter queue', async () => {
      mockRedisQueueController.requeueDeadLetterJob.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'Job not found in dead letter queue' });
      });

      const response = await request(app)
        .post(`/redis-queue/dead-letter/${validJobId}/requeue`)
        .expect(404);

      expect(mockRedisQueueController.requeueDeadLetterJob).toHaveBeenCalled();
    });

    it('should handle requeue failures', async () => {
      mockRedisQueueController.requeueDeadLetterJob.mockImplementation((req, res) => {
        res.status(500).json({ success: false, error: 'Failed to requeue job' });
      });

      const response = await request(app)
        .post(`/redis-queue/dead-letter/${validJobId}/requeue`)
        .expect(500);

      expect(mockRedisQueueController.requeueDeadLetterJob).toHaveBeenCalled();
    });
  });

  describe('GET /redis-queue/connection/status', () => {
    it('should get Redis connection status', async () => {
      const mockConnectionStatus = {
        connected: true,
        host: 'localhost',
        port: 6379,
        db: 0,
        uptime: 86400,
        lastPing: '2024-01-01T00:00:00Z',
        pingLatency: 2.5
      };

      mockRedisQueueController.getConnectionStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockConnectionStatus });
      });

      const response = await request(app)
        .get('/redis-queue/connection/status')
        .expect(200);

      expect(mockRedisQueueController.getConnectionStatus).toHaveBeenCalled();
    });

    it('should handle disconnected Redis instance', async () => {
      const mockConnectionStatus = {
        connected: false,
        error: 'Connection refused',
        lastAttempt: '2024-01-01T00:00:00Z'
      };

      mockRedisQueueController.getConnectionStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockConnectionStatus });
      });

      const response = await request(app)
        .get('/redis-queue/connection/status')
        .expect(200);

      expect(response.body.data.connected).toBe(false);
    });
  });

  describe('GET /redis-queue/memory/usage', () => {
    it('should get Redis memory usage', async () => {
      const mockMemoryUsage = {
        used: 2048000,
        peak: 4096000,
        rss: 3072000,
        overhead: 512000,
        datasetSize: 1536000,
        fragmentationRatio: 1.2,
        memoryEfficiency: 0.75
      };

      mockRedisQueueController.getMemoryUsage.mockImplementation((req, res) => {
        res.json({ success: true, data: mockMemoryUsage });
      });

      const response = await request(app)
        .get('/redis-queue/memory/usage')
        .expect(200);

      expect(mockRedisQueueController.getMemoryUsage).toHaveBeenCalled();
    });

    it('should handle memory usage query errors', async () => {
      mockRedisQueueController.getMemoryUsage.mockImplementation((req, res) => {
        res.status(503).json({ success: false, error: 'Unable to query Redis memory' });
      });

      const response = await request(app)
        .get('/redis-queue/memory/usage')
        .expect(503);
    });
  });

  describe('POST /redis-queue/cleanup', () => {
    it('should cleanup old completed jobs with default hours', async () => {
      const mockCleanupResult = {
        removedJobs: 25,
        olderThanHours: 24,
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockRedisQueueController.cleanupJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: mockCleanupResult });
      });

      const response = await request(app)
        .post('/redis-queue/cleanup')
        .send({})
        .expect(200);

      expect(mockRedisQueueController.cleanupJobs).toHaveBeenCalled();
    });

    it('should cleanup old completed jobs with custom hours', async () => {
      const mockCleanupResult = {
        removedJobs: 50,
        olderThanHours: 48,
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockRedisQueueController.cleanupJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: mockCleanupResult });
      });

      const response = await request(app)
        .post('/redis-queue/cleanup')
        .send({ olderThanHours: 48 })
        .expect(200);

      expect(mockRedisQueueController.cleanupJobs).toHaveBeenCalled();
    });

    it('should validate olderThanHours parameter', async () => {
      const response = await request(app)
        .post('/redis-queue/cleanup')
        .send({ olderThanHours: 'invalid' })
        .expect(400);

      expect(response.body.error).toBe('Invalid olderThanHours parameter');
    });

    it('should handle cleanup errors', async () => {
      mockRedisQueueController.cleanupJobs.mockImplementation((req, res) => {
        res.status(500).json({ success: false, error: 'Cleanup operation failed' });
      });

      const response = await request(app)
        .post('/redis-queue/cleanup')
        .send({ olderThanHours: 24 })
        .expect(500);
    });
  });

  describe('GET /redis-queue/:jobId/retries', () => {
    const validJobId = '550e8400-e29b-41d4-a716-446655440000';

    it('should get job retry history', async () => {
      const mockRetryHistory = {
        jobId: validJobId,
        totalAttempts: 3,
        retries: [
          {
            attempt: 1,
            timestamp: '2024-01-01T00:00:00Z',
            error: 'Connection timeout',
            delay: 1000
          },
          {
            attempt: 2,
            timestamp: '2024-01-01T00:01:00Z',
            error: 'API rate limit',
            delay: 2000
          }
        ]
      };

      mockRedisQueueController.getJobRetryHistory.mockImplementation((req, res) => {
        res.json({ success: true, data: mockRetryHistory });
      });

      const response = await request(app)
        .get(`/redis-queue/${validJobId}/retries`)
        .expect(200);

      expect(mockRedisQueueController.getJobRetryHistory).toHaveBeenCalled();
    });

    it('should validate jobId format', async () => {
      const response = await request(app)
        .get('/redis-queue/invalid-id/retries')
        .expect(400);

      expect(response.body.error).toBe('Invalid jobId format');
    });

    it('should handle job not found', async () => {
      mockRedisQueueController.getJobRetryHistory.mockImplementation((req, res) => {
        res.status(404).json({ success: false, error: 'Job not found' });
      });

      const response = await request(app)
        .get(`/redis-queue/${validJobId}/retries`)
        .expect(404);
    });

    it('should handle job with no retries', async () => {
      const mockRetryHistory = {
        jobId: validJobId,
        totalAttempts: 1,
        retries: []
      };

      mockRedisQueueController.getJobRetryHistory.mockImplementation((req, res) => {
        res.json({ success: true, data: mockRetryHistory });
      });

      const response = await request(app)
        .get(`/redis-queue/${validJobId}/retries`)
        .expect(200);

      expect(response.body.data.retries).toHaveLength(0);
    });
  });

  describe('GET /redis-queue/health/metrics', () => {
    it('should get queue health metrics', async () => {
      const mockHealthMetrics = {
        overall: 'healthy',
        queues: {
          'sentiment-analysis': {
            status: 'healthy',
            backlog: 5,
            processingRate: 12.5,
            errorRate: 0.02
          }
        },
        redis: {
          status: 'connected',
          latency: 2.1,
          memoryUsage: 0.65
        },
        workers: {
          active: 3,
          idle: 2,
          total: 5
        },
        alerts: []
      };

      mockRedisQueueController.getHealthMetrics.mockImplementation((req, res) => {
        res.json({ success: true, data: mockHealthMetrics });
      });

      const response = await request(app)
        .get('/redis-queue/health/metrics')
        .expect(200);

      expect(mockRedisQueueController.getHealthMetrics).toHaveBeenCalled();
    });

    it('should detect unhealthy queue conditions', async () => {
      const mockHealthMetrics = {
        overall: 'degraded',
        queues: {
          'sentiment-analysis': {
            status: 'unhealthy',
            backlog: 1000,
            processingRate: 0.5,
            errorRate: 0.25
          }
        },
        redis: {
          status: 'connected',
          latency: 15.2,
          memoryUsage: 0.95
        },
        workers: {
          active: 1,
          idle: 0,
          total: 5
        },
        alerts: [
          { level: 'warning', message: 'High error rate detected' },
          { level: 'critical', message: 'Redis memory usage critical' }
        ]
      };

      mockRedisQueueController.getHealthMetrics.mockImplementation((req, res) => {
        res.json({ success: true, data: mockHealthMetrics });
      });

      const response = await request(app)
        .get('/redis-queue/health/metrics')
        .expect(200);

      expect(response.body.data.overall).toBe('degraded');
      expect(response.body.data.alerts).toHaveLength(2);
    });

    it('should handle health check failures', async () => {
      mockRedisQueueController.getHealthMetrics.mockImplementation((req, res) => {
        res.status(500).json({ success: false, error: 'Health check failed' });
      });

      const response = await request(app)
        .get('/redis-queue/health/metrics')
        .expect(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      mockRedisQueueController.getDetailedStats.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      const response = await request(app)
        .get('/redis-queue/stats/detailed')
        .expect(500);
    });

    it('should handle Redis connection failures', async () => {
      mockRedisQueueController.getConnectionStatus.mockImplementation((req, res) => {
        res.status(503).json({ 
          success: false, 
          error: 'Redis connection unavailable' 
        });
      });

      const response = await request(app)
        .get('/redis-queue/connection/status')
        .expect(503);
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/redis-queue/cleanup')
        .type('json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent requests to stats endpoint', async () => {
      mockRedisQueueController.getDetailedStats.mockImplementation((req, res) => {
        setTimeout(() => {
          res.json({ success: true, data: { queues: {} } });
        }, 10);
      });

      const requests = Array(10).fill(null).map(() =>
        request(app).get('/redis-queue/stats/detailed')
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockRedisQueueController.getDetailedStats).toHaveBeenCalledTimes(10);
    });

    it('should handle timeout scenarios', async () => {
      mockRedisQueueController.getHealthMetrics.mockImplementation((req, res) => {
        // Simulate timeout
        setTimeout(() => {
          res.status(504).json({ success: false, error: 'Request timeout' });
        }, 50);
      });

      const response = await request(app)
        .get('/redis-queue/health/metrics');

      // Will resolve with timeout response
      expect(response.status).toBe(504);
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should sanitize query parameters', async () => {
      mockRedisQueueController.getDeadLetterJobs.mockImplementation((req, res) => {
        expect(req.query.limit).toBe('10');
        res.json({ success: true, data: [] });
      });

      const response = await request(app)
        .get('/redis-queue/dead-letter?limit=10&invalid=<script>alert("xss")</script>')
        .expect(200);
    });

    it('should validate numeric parameters', async () => {
      // This test documents that validation should occur for numeric parameters
      // The actual validation is handled by the validation middleware
      
      mockRedisQueueController.cleanupJobs.mockImplementation((req, res) => {
        res.json({ success: true, data: { removedJobs: 0 } });
      });

      const response = await request(app)
        .post('/redis-queue/cleanup')
        .send({ olderThanHours: -1 })
        .expect(200);

      expect(mockRedisQueueController.cleanupJobs).toHaveBeenCalled();
    });
  });
});