import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../monitoring.routes';

const app = express();
app.use(express.json());
app.use('/api/monitoring', monitoringRoutes);

// Mock the monitoring controller
jest.mock('../../controllers/monitoring.controller', () => ({
  MonitoringController: jest.fn().mockImplementation(() => ({
    getCurrentMetrics: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          used: 256 * 1024 * 1024,
          total: 1024 * 1024 * 1024,
          free: 768 * 1024 * 1024,
          heapUsed: 180 * 1024 * 1024,
          heapTotal: 512 * 1024 * 1024,
          external: 15 * 1024 * 1024,
          timestamp: Date.now()
        }
      });
    }),
    getMemoryHistory: jest.fn(async (req, res) => {
      const { duration = 3600000 } = req.query;
      res.status(200).json({
        data: {
          history: [
            { timestamp: Date.now() - 60000, used: 240 * 1024 * 1024, heapUsed: 170 * 1024 * 1024 },
            { timestamp: Date.now(), used: 256 * 1024 * 1024, heapUsed: 180 * 1024 * 1024 }
          ],
          duration: Number(duration),
          interval: 60000
        }
      });
    }),
    getMemoryStatistics: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          average: 245 * 1024 * 1024,
          peak: 280 * 1024 * 1024,
          minimum: 200 * 1024 * 1024,
          trend: 'increasing',
          recommendations: [
            'Consider increasing heap size',
            'Monitor for memory leaks'
          ]
        }
      });
    }),
    startMonitoring: jest.fn(async (req, res) => {
      const { warning = 80, critical = 90, maxHeapSize } = req.body;
      res.status(200).json({
        message: 'Memory monitoring started',
        config: {
          warning,
          critical,
          maxHeapSize,
          interval: 60000
        }
      });
    }),
    stopMonitoring: jest.fn(async (req, res) => {
      res.status(200).json({
        message: 'Memory monitoring stopped',
        runtime: 3600000
      });
    }),
    forceGarbageCollection: jest.fn(async (req, res) => {
      res.status(200).json({
        message: 'Garbage collection completed',
        memoryBefore: 256 * 1024 * 1024,
        memoryAfter: 220 * 1024 * 1024,
        freedMemory: 36 * 1024 * 1024
      });
    }),
    clearHistory: jest.fn(async (req, res) => {
      res.status(200).json({
        message: 'Memory history cleared',
        clearedEntries: 1440
      });
    }),
    exportMetrics: jest.fn(async (req, res) => {
      const { format = 'json' } = req.query;
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=memory-metrics.csv');
        res.status(200).send('timestamp,used,heapUsed\n2024-01-01T00:00:00Z,256MB,180MB');
      } else {
        res.status(200).json({
          data: {
            exportFormat: format,
            metrics: [
              { timestamp: Date.now(), used: 256 * 1024 * 1024, heapUsed: 180 * 1024 * 1024 }
            ]
          }
        });
      }
    }),
    getSystemInfo: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          platform: 'linux',
          arch: 'x64',
          nodeVersion: 'v18.17.0',
          cpuUsage: 45.2,
          loadAverage: [1.2, 1.5, 1.8],
          uptime: 86400,
          totalMemory: 8 * 1024 * 1024 * 1024,
          freeMemory: 4 * 1024 * 1024 * 1024
        }
      });
    })
  }))
}));

// Mock async middleware
jest.mock('../../middleware/async.middleware', () => ({
  asyncHandler: jest.fn((fn) => fn),
  validate: jest.fn(() => (req, res, next) => next())
}));

describe('Monitoring Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Memory Metrics', () => {
    test('GET /api/monitoring/memory/current should return current memory metrics', async () => {
      const response = await request(app)
        .get('/api/monitoring/memory/current')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          used: expect.any(Number),
          total: expect.any(Number),
          free: expect.any(Number),
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number)
        }
      });
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('GET /api/monitoring/memory/history should return memory history', async () => {
      const response = await request(app)
        .get('/api/monitoring/memory/history?duration=3600000')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          history: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Number),
              used: expect.any(Number),
              heapUsed: expect.any(Number)
            })
          ]),
          duration: 3600000,
          interval: 60000
        }
      });
    });

    test('GET /api/monitoring/memory/statistics should return memory statistics', async () => {
      const response = await request(app)
        .get('/api/monitoring/memory/statistics')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          average: expect.any(Number),
          peak: expect.any(Number),
          minimum: expect.any(Number),
          trend: 'increasing',
          recommendations: expect.arrayContaining([
            expect.any(String)
          ])
        }
      });
    });
  });

  describe('Memory Monitoring Control', () => {
    test('POST /api/monitoring/memory/start should start monitoring', async () => {
      const configData = {
        warning: 85,
        critical: 95,
        maxHeapSize: 1024 * 1024 * 1024
      };

      const response = await request(app)
        .post('/api/monitoring/memory/start')
        .send(configData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Memory monitoring started',
        config: {
          warning: 85,
          critical: 95,
          maxHeapSize: 1024 * 1024 * 1024,
          interval: 60000
        }
      });
    });

    test('POST /api/monitoring/memory/start should use default values', async () => {
      const response = await request(app)
        .post('/api/monitoring/memory/start')
        .send({})
        .expect(200);

      expect(response.body.config.warning).toBe(80);
      expect(response.body.config.critical).toBe(90);
    });

    test('POST /api/monitoring/memory/stop should stop monitoring', async () => {
      const response = await request(app)
        .post('/api/monitoring/memory/stop')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Memory monitoring stopped',
        runtime: expect.any(Number)
      });
    });

    test('POST /api/monitoring/memory/gc should force garbage collection', async () => {
      const response = await request(app)
        .post('/api/monitoring/memory/gc')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Garbage collection completed',
        memoryBefore: expect.any(Number),
        memoryAfter: expect.any(Number),
        freedMemory: expect.any(Number)
      });
    });
  });

  describe('Memory History Management', () => {
    test('DELETE /api/monitoring/memory/history should clear history', async () => {
      const response = await request(app)
        .delete('/api/monitoring/memory/history')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Memory history cleared',
        clearedEntries: expect.any(Number)
      });
    });

    test('GET /api/monitoring/memory/export should export as JSON', async () => {
      const response = await request(app)
        .get('/api/monitoring/memory/export?format=json')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          exportFormat: 'json',
          metrics: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Number),
              used: expect.any(Number),
              heapUsed: expect.any(Number)
            })
          ])
        }
      });
    });

    test('GET /api/monitoring/memory/export should export as CSV', async () => {
      const response = await request(app)
        .get('/api/monitoring/memory/export?format=csv')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toBe('attachment; filename=memory-metrics.csv');
      expect(response.text).toContain('timestamp,used,heapUsed');
    });
  });

  describe('System Information', () => {
    test('GET /api/monitoring/system should return system information', async () => {
      const response = await request(app)
        .get('/api/monitoring/system')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          platform: expect.any(String),
          arch: expect.any(String),
          nodeVersion: expect.any(String),
          cpuUsage: expect.any(Number),
          loadAverage: expect.any(Array),
          uptime: expect.any(Number),
          totalMemory: expect.any(Number),
          freeMemory: expect.any(Number)
        }
      });
    });
  });

  describe('Middleware and Validation', () => {
    test('should use asyncHandler for all endpoints', async () => {
      const { asyncHandler } = require('../../middleware/async.middleware');
      
      expect(asyncHandler).toHaveBeenCalled();
    });

    test('should use validation for POST endpoints with body', async () => {
      const { validate } = require('../../middleware/async.middleware');
      
      await request(app).post('/api/monitoring/memory/start').send({});
      
      expect(validate).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing query parameters', async () => {
      await request(app)
        .get('/api/monitoring/memory/history')
        .expect(200);
    });

    test('should handle different duration formats', async () => {
      await request(app)
        .get('/api/monitoring/memory/history?duration=7200000')
        .expect(200);
    });

    test('should handle extreme monitoring thresholds', async () => {
      await request(app)
        .post('/api/monitoring/memory/start')
        .send({ warning: 99, critical: 100 })
        .expect(200);
    });

    test('should handle large heap size values', async () => {
      await request(app)
        .post('/api/monitoring/memory/start')
        .send({ maxHeapSize: 8 * 1024 * 1024 * 1024 })
        .expect(200);
    });

    test('should handle export with default format', async () => {
      await request(app)
        .get('/api/monitoring/memory/export')
        .expect(200);
    });
  });
});