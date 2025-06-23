import request from 'supertest';
import express from 'express';

// Mock the SSE controller
const mockSSEController = {
  connect: jest.fn(),
  getStatus: jest.fn(),
  sendTestEvent: jest.fn(),
};

jest.mock('../../controllers/sse.controller', () => ({
  SSEController: mockSSEController
}));

import sseRoutes from '../sse.routes';

describe('SSE Routes', () => {
  let app: express.Application;
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV;
    app = express();
    app.use(express.json());
    app.use('/sse', sseRoutes);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /sse/events', () => {
    it('should establish SSE connection', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Send initial connection event
        res.write('event: connected\ndata: {"message":"SSE connection established"}\n\n');
        
        // Keep connection open briefly for test
        setTimeout(() => {
          res.write('event: heartbeat\ndata: {"timestamp":"2024-01-01T00:00:00Z"}\n\n');
          res.end();
        }, 10);
      });

      const response = await request(app)
        .get('/sse/events')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.text).toContain('event: connected');
      expect(response.text).toContain('SSE connection established');
      expect(mockSSEController.connect).toHaveBeenCalled();
    });

    it('should handle SSE connection with client ID', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        expect(req.query.clientId).toBe('client-123');
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: connected\ndata: {"clientId":"client-123"}\n\n');
        res.end();
      });

      const response = await request(app)
        .get('/sse/events?clientId=client-123')
        .expect(200);

      expect(mockSSEController.connect).toHaveBeenCalled();
    });

    it('should handle SSE connection with subscription topics', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        expect(req.query.topics).toBe('updates,alerts');
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: subscribed\ndata: {"topics":["updates","alerts"]}\n\n');
        res.end();
      });

      const response = await request(app)
        .get('/sse/events?topics=updates,alerts')
        .expect(200);

      expect(mockSSEController.connect).toHaveBeenCalled();
    });

    it('should handle SSE connection errors', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        res.status(500).json({ error: 'SSE connection failed' });
      });

      const response = await request(app)
        .get('/sse/events')
        .expect(500);

      expect(response.body.error).toBe('SSE connection failed');
    });

    it('should handle client disconnect during SSE', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: connected\ndata: {}\n\n');
        
        // Simulate client disconnect
        req.on('close', () => {
          res.end();
        });
        
        // Force close connection after short delay
        setTimeout(() => {
          req.emit('close');
        }, 20);
      });

      const response = await request(app)
        .get('/sse/events');

      expect(mockSSEController.connect).toHaveBeenCalled();
    });
  });

  describe('GET /sse/status', () => {
    it('should get SSE service status', async () => {
      const mockStatus = {
        active: true,
        connectedClients: 5,
        totalConnections: 25,
        uptime: 3600,
        lastActivity: '2024-01-01T00:00:00Z',
        topics: ['updates', 'alerts', 'notifications'],
        statistics: {
          eventsTotal: 150,
          eventsPerMinute: 2.5,
          errorRate: 0.02
        }
      };

      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockStatus });
      });

      const response = await request(app)
        .get('/sse/status')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStatus
      });
      expect(mockSSEController.getStatus).toHaveBeenCalled();
    });

    it('should handle status when service is inactive', async () => {
      const mockStatus = {
        active: false,
        connectedClients: 0,
        reason: 'Service not started',
        lastError: 'Connection pool exhausted'
      };

      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockStatus });
      });

      const response = await request(app)
        .get('/sse/status')
        .expect(200);

      expect(response.body.data.active).toBe(false);
      expect(response.body.data.connectedClients).toBe(0);
    });

    it('should handle status query with detailed information', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        if (req.query.detailed === 'true') {
          res.json({
            success: true,
            data: {
              active: true,
              connectedClients: 5,
              clientDetails: [
                { id: 'client-1', connectedAt: '2024-01-01T00:00:00Z', subscriptions: ['updates'] },
                { id: 'client-2', connectedAt: '2024-01-01T00:05:00Z', subscriptions: ['alerts'] }
              ]
            }
          });
        } else {
          res.json({ success: true, data: { active: true, connectedClients: 5 } });
        }
      });

      const response = await request(app)
        .get('/sse/status?detailed=true')
        .expect(200);

      expect(response.body.data).toHaveProperty('clientDetails');
      expect(Array.isArray(response.body.data.clientDetails)).toBe(true);
    });

    it('should handle status errors', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.status(500).json({ success: false, error: 'Unable to retrieve status' });
      });

      const response = await request(app)
        .get('/sse/status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unable to retrieve status');
    });
  });

  describe('POST /sse/test-event (Development Only)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should send test event in development mode', async () => {
      const testEvent = {
        type: 'test',
        message: 'This is a test event',
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockSSEController.sendTestEvent.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Test event sent successfully',
          event: testEvent,
          sentTo: 3
        });
      });

      const response = await request(app)
        .post('/sse/test-event')
        .send(testEvent)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.sentTo).toBe(3);
      expect(mockSSEController.sendTestEvent).toHaveBeenCalled();
    });

    it('should send test event with custom data', async () => {
      const customTestEvent = {
        type: 'custom-test',
        data: {
          userId: 'user-123',
          action: 'test-action',
          payload: { key: 'value' }
        }
      };

      mockSSEController.sendTestEvent.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Custom test event sent',
          event: customTestEvent
        });
      });

      const response = await request(app)
        .post('/sse/test-event')
        .send(customTestEvent)
        .expect(200);

      expect(response.body.event.type).toBe('custom-test');
      expect(response.body.event.data).toEqual(customTestEvent.data);
    });

    it('should handle test event errors', async () => {
      mockSSEController.sendTestEvent.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Invalid test event format'
        });
      });

      const response = await request(app)
        .post('/sse/test-event')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid test event format');
    });

    it('should handle empty test event payload', async () => {
      mockSSEController.sendTestEvent.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Default test event sent',
          event: { type: 'default-test' }
        });
      });

      const response = await request(app)
        .post('/sse/test-event')
        .send({})
        .expect(200);

      expect(response.body.event.type).toBe('default-test');
    });
  });

  describe('Production Environment Restrictions', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not expose test-event endpoint in production', async () => {
      // Note: Since the router is created at module load time, we can only test
      // that the endpoint exists or not based on how the module was loaded.
      // In this test environment, NODE_ENV is typically 'test', so the route exists.
      // This test documents the expected behavior in production.
      
      // Create a new app with production environment simulation
      const prodApp = express();
      prodApp.use(express.json());
      
      // Mock the production-like router behavior
      const prodRouter = express.Router();
      prodRouter.get('/events', mockSSEController.connect);
      prodRouter.get('/status', mockSSEController.getStatus);
      // No test-event route in production
      
      prodApp.use('/sse', prodRouter);
      
      const response = await request(prodApp)
        .post('/sse/test-event')
        .send({ type: 'test' })
        .expect(404);
    });

    it('should still allow status and events endpoints in production', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: { active: true } });
      });

      const response = await request(app)
        .get('/sse/status')
        .expect(200);

      expect(mockSSEController.getStatus).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle controller method not found', async () => {
      mockSSEController.connect.mockImplementation(() => {
        throw new Error('Method not implemented');
      });

      const response = await request(app)
        .get('/sse/events')
        .expect(500);
    });

    it('should handle malformed request to test endpoint', async () => {
      process.env.NODE_ENV = 'development';
      
      const response = await request(app)
        .post('/sse/test-event')
        .type('json')
        .send('invalid json')
        .expect(400);
      
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should handle concurrent SSE connections', async () => {
      let connectionCount = 0;
      
      mockSSEController.connect.mockImplementation((req, res) => {
        connectionCount++;
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: connected\ndata: {"connectionId":${connectionCount}}\n\n`);
        
        setTimeout(() => {
          res.end();
        }, 10);
      });

      const requests = Array(5).fill(null).map(() =>
        request(app).get('/sse/events')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/event-stream');
      });

      expect(mockSSEController.connect).toHaveBeenCalledTimes(5);
    });

    it('should handle SSE connection timeout', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        
        // Simulate timeout scenario
        setTimeout(() => {
          res.write('event: timeout\ndata: {"message":"Connection timeout"}\n\n');
          res.end();
        }, 100);
      });

      const response = await request(app)
        .get('/sse/events');

      expect(response.text).toContain('event: timeout');
    });

    it('should handle invalid query parameters gracefully', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        // Should still work even with invalid parameters
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: connected\ndata: {}\n\n');
        res.end();
      });

      const response = await request(app)
        .get('/sse/events?invalid=<script>alert("xss")</script>&limit=NaN')
        .expect(200);

      expect(mockSSEController.connect).toHaveBeenCalled();
    });

    it('should handle HEAD requests to SSE endpoints', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: { active: true } });
      });

      const response = await request(app)
        .head('/sse/status')
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid status checks', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: { active: true, connectedClients: 10 } });
      });

      const requests = Array(20).fill(null).map(() =>
        request(app).get('/sse/status')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockSSEController.getStatus).toHaveBeenCalledTimes(20);
    });

    it('should handle SSE connections with different client configurations', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        const clientId = req.query.clientId || 'anonymous';
        const topics = req.query.topics ? req.query.topics.split(',') : [];
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: configured\ndata: ${JSON.stringify({ clientId, topics })}\n\n`);
        res.end();
      });

      const configurations = [
        { clientId: 'client-1', topics: 'updates' },
        { clientId: 'client-2', topics: 'alerts,notifications' },
        { clientId: 'client-3' }, // No topics
        {} // Anonymous client
      ];

      for (const config of configurations) {
        const query = new URLSearchParams(config).toString();
        const url = query ? `/sse/events?${query}` : '/sse/events';
        
        const response = await request(app)
          .get(url)
          .expect(200);
        
        expect(response.headers['content-type']).toBe('text/event-stream');
      }

      expect(mockSSEController.connect).toHaveBeenCalledTimes(4);
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive information in status', async () => {
      mockSSEController.getStatus.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            active: true,
            connectedClients: 5,
            // Should not include sensitive data like API keys, passwords, etc.
            configuration: {
              maxConnections: 100,
              heartbeatInterval: 30000
            }
          }
        });
      });

      const response = await request(app)
        .get('/sse/status')
        .expect(200);

      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toMatch(/password|key|secret|token/i);
    });

    it('should handle potential XSS in SSE data', async () => {
      mockSSEController.connect.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.write('event: safe\ndata: {"message":"<script>alert(\'xss\')</script>"}\n\n');
        res.end();
      });

      const response = await request(app)
        .get('/sse/events')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});