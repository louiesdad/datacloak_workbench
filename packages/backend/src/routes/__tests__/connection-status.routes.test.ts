import request from 'supertest';
import express from 'express';
import connectionStatusRoutes from '../connection-status.routes';

const app = express();
app.use(express.json());
app.use('/api/connection-status', connectionStatusRoutes);

// Mock the connection status controller
jest.mock('../../controllers/connection-status.controller', () => ({
  connectionStatusController: {
    getStatus: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          status: 'healthy',
          timestamp: Date.now(),
          services: {
            database: 'connected',
            redis: 'connected',
            openai: 'connected'
          }
        }
      });
    }),
    getHealthCheck: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          healthy: true,
          checks: {
            database: { status: 'pass', responseTime: 12 },
            redis: { status: 'pass', responseTime: 5 },
            openai: { status: 'pass', responseTime: 250 }
          },
          overall: 'pass'
        }
      });
    }),
    getUptime: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          uptime: 86400000,
          startTime: Date.now() - 86400000,
          formattedUptime: '1 day, 0 hours, 0 minutes'
        }
      });
    }),
    getLatency: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          database: 12,
          redis: 5,
          openai: 250,
          average: 89,
          timestamp: Date.now()
        }
      });
    }),
    getConnectionCount: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          active: 45,
          total: 50,
          max: 100,
          usage: 0.45
        }
      });
    }),
    getDetailedStatus: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          status: 'healthy',
          uptime: 86400000,
          connections: {
            active: 45,
            max: 100
          },
          services: {
            database: {
              status: 'connected',
              latency: 12,
              pool: { active: 5, idle: 15, total: 20 }
            },
            redis: {
              status: 'connected',
              latency: 5,
              memory: '256MB'
            },
            openai: {
              status: 'connected',
              latency: 250,
              rateLimit: { remaining: 950, total: 1000 }
            }
          },
          performance: {
            cpu: 35.2,
            memory: 768 * 1024 * 1024,
            load: [1.2, 1.5, 1.8]
          }
        }
      });
    }),
    forceStatusCheck: jest.fn((req, res) => {
      res.status(200).json({
        message: 'Status check completed',
        result: {
          status: 'healthy',
          duration: 156,
          timestamp: Date.now()
        }
      });
    }),
    clearErrors: jest.fn((req, res) => {
      res.status(200).json({
        message: 'Errors cleared successfully',
        clearedCount: 12
      });
    })
  }
}));

describe('Connection Status Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Status Information', () => {
    test('GET /api/connection-status/status should return connection status', async () => {
      const response = await request(app)
        .get('/api/connection-status/status')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          status: 'healthy',
          services: {
            database: 'connected',
            redis: 'connected',
            openai: 'connected'
          }
        }
      });
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('GET /api/connection-status/health should return health check results', async () => {
      const response = await request(app)
        .get('/api/connection-status/health')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          healthy: true,
          checks: {
            database: { status: 'pass', responseTime: 12 },
            redis: { status: 'pass', responseTime: 5 },
            openai: { status: 'pass', responseTime: 250 }
          },
          overall: 'pass'
        }
      });
    });

    test('GET /api/connection-status/uptime should return uptime information', async () => {
      const response = await request(app)
        .get('/api/connection-status/uptime')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          uptime: 86400000,
          formattedUptime: '1 day, 0 hours, 0 minutes'
        }
      });
      expect(response.body.data).toHaveProperty('startTime');
    });

    test('GET /api/connection-status/latency should return latency metrics', async () => {
      const response = await request(app)
        .get('/api/connection-status/latency')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          database: 12,
          redis: 5,
          openai: 250,
          average: 89
        }
      });
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('GET /api/connection-status/connections should return connection count', async () => {
      const response = await request(app)
        .get('/api/connection-status/connections')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          active: 45,
          total: 50,
          max: 100,
          usage: 0.45
        }
      });
    });
  });

  describe('Detailed Status', () => {
    test('GET /api/connection-status/detailed should return comprehensive status', async () => {
      const response = await request(app)
        .get('/api/connection-status/detailed')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          status: 'healthy',
          uptime: 86400000,
          connections: {
            active: 45,
            max: 100
          },
          services: {
            database: {
              status: 'connected',
              latency: 12,
              pool: expect.objectContaining({
                active: expect.any(Number),
                idle: expect.any(Number),
                total: expect.any(Number)
              })
            },
            redis: {
              status: 'connected',
              latency: 5,
              memory: '256MB'
            },
            openai: {
              status: 'connected',
              latency: 250,
              rateLimit: expect.objectContaining({
                remaining: expect.any(Number),
                total: expect.any(Number)
              })
            }
          },
          performance: {
            cpu: 35.2,
            memory: expect.any(Number),
            load: expect.any(Array)
          }
        }
      });
    });
  });

  describe('Management Endpoints', () => {
    test('POST /api/connection-status/check should force status check', async () => {
      const response = await request(app)
        .post('/api/connection-status/check')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Status check completed',
        result: {
          status: 'healthy',
          duration: 156
        }
      });
      expect(response.body.result).toHaveProperty('timestamp');
    });

    test('POST /api/connection-status/clear-errors should clear errors', async () => {
      const response = await request(app)
        .post('/api/connection-status/clear-errors')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Errors cleared successfully',
        clearedCount: 12
      });
    });
  });

  describe('Controller Method Calls', () => {
    test('should call correct controller methods for each endpoint', async () => {
      const { connectionStatusController } = require('../../controllers/connection-status.controller');
      
      await request(app).get('/api/connection-status/status');
      await request(app).get('/api/connection-status/health');
      await request(app).get('/api/connection-status/uptime');
      await request(app).get('/api/connection-status/latency');
      await request(app).get('/api/connection-status/connections');
      await request(app).get('/api/connection-status/detailed');
      await request(app).post('/api/connection-status/check');
      await request(app).post('/api/connection-status/clear-errors');

      expect(connectionStatusController.getStatus).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.getHealthCheck).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.getUptime).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.getLatency).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.getConnectionCount).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.getDetailedStatus).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.forceStatusCheck).toHaveBeenCalledTimes(1);
      expect(connectionStatusController.clearErrors).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Format Consistency', () => {
    test('all GET endpoints should return data object', async () => {
      const endpoints = [
        '/status',
        '/health',
        '/uptime',
        '/latency',
        '/connections',
        '/detailed'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(`/api/connection-status${endpoint}`)
          .expect(200);
        
        expect(response.body).toHaveProperty('data');
        expect(typeof response.body.data).toBe('object');
      }
    });

    test('POST endpoints should return message', async () => {
      const endpoints = ['/check', '/clear-errors'];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .post(`/api/connection-status${endpoint}`)
          .expect(200);
        
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid sequential requests', async () => {
      const promises = Array(5).fill(null).map(() => 
        request(app).get('/api/connection-status/status')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });

    test('should handle concurrent health checks', async () => {
      const promises = [
        request(app).get('/api/connection-status/health'),
        request(app).get('/api/connection-status/latency'),
        request(app).post('/api/connection-status/check')
      ];

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});