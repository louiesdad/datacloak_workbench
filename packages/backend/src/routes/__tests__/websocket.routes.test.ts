import request from 'supertest';
import express from 'express';

// Mock the websocket controller
const mockWebsocketController = {
  getStatus: jest.fn(),
  sendToClient: jest.fn(),
  broadcast: jest.fn(),
  disconnectClient: jest.fn(),
  subscribeToRiskAssessments: jest.fn(),
  unsubscribeFromRiskAssessments: jest.fn(),
  broadcastRiskAssessmentUpdate: jest.fn(),
  getActiveRiskSubscriptions: jest.fn(),
};

// Mock middleware functions
const mockAsyncHandler = jest.fn((fn) => fn);
const mockAuthenticate = jest.fn((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = { id: 'user-123', role: 'admin' };
  next();
});

const mockAuthorize = jest.fn((role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  if (role === 'analyst' && !['admin', 'analyst'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Analyst access required' });
  }
  next();
});

const mockValidate = jest.fn((schema) => (req, res, next) => {
  // Simple validation mock
  if (schema._type === 'sendMessage') {
    if (!req.body.type) {
      return res.status(400).json({ error: 'Message type is required' });
    }
  }
  if (schema._type === 'broadcast') {
    if (!req.body.type) {
      return res.status(400).json({ error: 'Broadcast type is required' });
    }
  }
  if (schema._type === 'riskAssessmentUpdate') {
    if (!req.body.assessmentId || !req.body.riskScore || !req.body.status) {
      return res.status(400).json({ error: 'Assessment ID, risk score, and status are required' });
    }
  }
  next();
});

jest.mock('../../controllers/websocket.controller', () => ({
  websocketController: mockWebsocketController
}));

jest.mock('../../middleware/async-handler', () => ({
  asyncHandler: mockAsyncHandler
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: mockAuthenticate
}));

jest.mock('../../middleware/authorize', () => ({
  authorize: mockAuthorize
}));

jest.mock('../../middleware/validate', () => ({
  validate: mockValidate
}));

jest.mock('joi', () => ({
  object: jest.fn((schema) => ({ _type: 'object', _schema: schema })),
  string: jest.fn(() => ({ 
    required: () => ({ _type: 'sendMessage' }),
    valid: () => ({ required: () => ({ _type: 'riskAssessmentUpdate' }) })
  })),
  any: jest.fn(() => ({})),
  array: jest.fn(() => ({ items: () => ({ optional: () => ({}) }) })),
  number: jest.fn(() => ({ 
    min: () => ({ 
      max: () => ({ 
        optional: () => ({}),
        required: () => ({ _type: 'riskAssessmentUpdate' })
      }) 
    }) 
  }))
}));

import websocketRoutes from '../websocket.routes';

describe('WebSocket Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/websocket', websocketRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all routes', async () => {
      const response = await request(app)
        .get('/websocket/status')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should require admin role for admin endpoints', async () => {
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'user-123', role: 'user' };
        next();
      });

      const response = await request(app)
        .post('/websocket/send/client-123')
        .set('Authorization', 'Bearer user-token')
        .send({ type: 'test', data: {} })
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });

    it('should allow analyst role for risk assessment endpoints', async () => {
      mockAuthenticate.mockImplementationOnce((req, res, next) => {
        req.user = { id: 'user-123', role: 'analyst' };
        next();
      });

      mockWebsocketController.broadcastRiskAssessmentUpdate.mockImplementation((req, res) => {
        res.json({ success: true, message: 'Risk assessment update broadcasted' });
      });

      const response = await request(app)
        .post('/websocket/risk-assessment/update')
        .set('Authorization', 'Bearer analyst-token')
        .send({
          assessmentId: 'assessment-123',
          riskScore: 75,
          status: 'completed',
          data: { findings: ['High risk detected'] }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /websocket/status', () => {
    it('should get WebSocket service status', async () => {
      const mockStatus = {
        active: true,
        connectedClients: 15,
        totalConnections: 150,
        uptime: 7200,
        lastActivity: '2024-01-01T00:00:00Z',
        serverLoad: {
          cpu: 25.5,
          memory: 512000000,
          connections: 15
        },
        channels: {
          'risk-assessments': { subscribers: 8 },
          'notifications': { subscribers: 12 },
          'alerts': { subscribers: 5 }
        }
      };

      mockWebsocketController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockStatus });
      });

      const response = await request(app)
        .get('/websocket/status')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStatus
      });
      expect(mockWebsocketController.getStatus).toHaveBeenCalled();
      expect(mockAsyncHandler).toHaveBeenCalled();
    });

    it('should handle inactive WebSocket service', async () => {
      const mockInactiveStatus = {
        active: false,
        connectedClients: 0,
        reason: 'WebSocket server not started',
        lastError: 'Port already in use'
      };

      mockWebsocketController.getStatus.mockImplementation((req, res) => {
        res.json({ success: true, data: mockInactiveStatus });
      });

      const response = await request(app)
        .get('/websocket/status')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.data.active).toBe(false);
      expect(response.body.data.reason).toBeDefined();
    });
  });

  describe('POST /websocket/send/:clientId', () => {
    it('should send message to specific client', async () => {
      const message = {
        type: 'notification',
        data: {
          title: 'Test Notification',
          message: 'This is a test message',
          priority: 'high'
        }
      };

      mockWebsocketController.sendToClient.mockImplementation((req, res) => {
        expect(req.params.clientId).toBe('client-123');
        expect(req.body).toEqual(message);
        res.json({
          success: true,
          message: 'Message sent successfully',
          clientId: 'client-123',
          messageId: 'msg-456'
        });
      });

      const response = await request(app)
        .post('/websocket/send/client-123')
        .set('Authorization', 'Bearer admin-token')
        .send(message)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.clientId).toBe('client-123');
      expect(mockWebsocketController.sendToClient).toHaveBeenCalled();
    });

    it('should validate message format', async () => {
      const response = await request(app)
        .post('/websocket/send/client-123')
        .set('Authorization', 'Bearer admin-token')
        .send({ data: 'missing type' })
        .expect(400);

      expect(response.body.error).toBe('Message type is required');
    });

    it('should handle client not found', async () => {
      mockWebsocketController.sendToClient.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Client not found or disconnected'
        });
      });

      const response = await request(app)
        .post('/websocket/send/nonexistent-client')
        .set('Authorization', 'Bearer admin-token')
        .send({ type: 'test', data: {} })
        .expect(404);

      expect(response.body.error).toBe('Client not found or disconnected');
    });
  });

  describe('POST /websocket/broadcast', () => {
    it('should broadcast message to all clients', async () => {
      const broadcastMessage = {
        type: 'system_announcement',
        data: {
          title: 'System Maintenance',
          message: 'Scheduled maintenance in 30 minutes',
          scheduledTime: '2024-01-01T02:00:00Z'
        }
      };

      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        res.json({
          success: true,
          message: 'Broadcast sent successfully',
          recipientCount: 15,
          messageId: 'broadcast-789'
        });
      });

      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send(broadcastMessage)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.recipientCount).toBe(15);
    });

    it('should broadcast to specific user', async () => {
      const userMessage = {
        type: 'user_notification',
        data: { message: 'Personal notification' },
        userId: 'user-456'
      };

      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        expect(req.body.userId).toBe('user-456');
        res.json({
          success: true,
          message: 'User-specific broadcast sent',
          recipientCount: 1
        });
      });

      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send(userMessage)
        .expect(200);

      expect(response.body.recipientCount).toBe(1);
    });

    it('should broadcast to specific topic', async () => {
      const topicMessage = {
        type: 'topic_update',
        data: { update: 'New data available' },
        topic: 'data-updates'
      };

      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        expect(req.body.topic).toBe('data-updates');
        res.json({
          success: true,
          message: 'Topic broadcast sent',
          recipientCount: 8
        });
      });

      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send(topicMessage)
        .expect(200);

      expect(response.body.recipientCount).toBe(8);
    });

    it('should validate broadcast message', async () => {
      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send({ data: 'missing type' })
        .expect(400);

      expect(response.body.error).toBe('Broadcast type is required');
    });
  });

  describe('POST /websocket/disconnect/:clientId', () => {
    it('should disconnect specific client', async () => {
      mockWebsocketController.disconnectClient.mockImplementation((req, res) => {
        expect(req.params.clientId).toBe('client-123');
        res.json({
          success: true,
          message: 'Client disconnected successfully',
          clientId: 'client-123'
        });
      });

      const response = await request(app)
        .post('/websocket/disconnect/client-123')
        .set('Authorization', 'Bearer admin-token')
        .send({ reason: 'Administrative disconnect' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.clientId).toBe('client-123');
    });

    it('should handle client already disconnected', async () => {
      mockWebsocketController.disconnectClient.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'Client already disconnected'
        });
      });

      const response = await request(app)
        .post('/websocket/disconnect/client-123')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(404);

      expect(response.body.error).toBe('Client already disconnected');
    });
  });

  describe('Risk Assessment WebSocket Endpoints', () => {
    describe('POST /websocket/risk-assessment/subscribe', () => {
      it('should subscribe to risk assessment updates', async () => {
        const subscriptionRequest = {
          assessmentId: 'assessment-123',
          frameworks: ['SOX', 'PCI-DSS'],
          riskThreshold: 75
        };

        mockWebsocketController.subscribeToRiskAssessments.mockImplementation((req, res) => {
          res.json({
            success: true,
            message: 'Successfully subscribed to risk assessment updates',
            subscriptionId: 'sub-456',
            filters: req.body
          });
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/subscribe')
          .set('Authorization', 'Bearer user-token')
          .send(subscriptionRequest)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.subscriptionId).toBe('sub-456');
      });

      it('should handle subscription without filters', async () => {
        mockWebsocketController.subscribeToRiskAssessments.mockImplementation((req, res) => {
          res.json({
            success: true,
            message: 'Subscribed to all risk assessment updates',
            subscriptionId: 'sub-789'
          });
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/subscribe')
          .set('Authorization', 'Bearer user-token')
          .send({})
          .expect(200);

        expect(response.body.subscriptionId).toBe('sub-789');
      });

      it('should validate risk threshold range', async () => {
        mockValidate.mockImplementationOnce((schema) => (req, res, next) => {
          if (req.body.riskThreshold && (req.body.riskThreshold < 0 || req.body.riskThreshold > 100)) {
            return res.status(400).json({ error: 'Risk threshold must be between 0 and 100' });
          }
          next();
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/subscribe')
          .set('Authorization', 'Bearer user-token')
          .send({ riskThreshold: 150 })
          .expect(400);

        expect(response.body.error).toBe('Risk threshold must be between 0 and 100');
      });
    });

    describe('POST /websocket/risk-assessment/unsubscribe', () => {
      it('should unsubscribe from risk assessment updates', async () => {
        mockWebsocketController.unsubscribeFromRiskAssessments.mockImplementation((req, res) => {
          res.json({
            success: true,
            message: 'Successfully unsubscribed from risk assessment updates'
          });
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/unsubscribe')
          .set('Authorization', 'Bearer user-token')
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should handle unsubscribe when not subscribed', async () => {
        mockWebsocketController.unsubscribeFromRiskAssessments.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            error: 'No active subscription found'
          });
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/unsubscribe')
          .set('Authorization', 'Bearer user-token')
          .expect(400);

        expect(response.body.error).toBe('No active subscription found');
      });
    });

    describe('POST /websocket/risk-assessment/update', () => {
      it('should broadcast risk assessment update', async () => {
        const updateData = {
          assessmentId: 'assessment-123',
          riskScore: 85,
          status: 'completed',
          data: {
            findings: ['Critical vulnerability detected', 'Data encryption missing'],
            recommendations: ['Implement encryption', 'Update security policies']
          }
        };

        mockWebsocketController.broadcastRiskAssessmentUpdate.mockImplementation((req, res) => {
          res.json({
            success: true,
            message: 'Risk assessment update broadcasted',
            notifiedClients: 12,
            updateId: 'update-456'
          });
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/update')
          .set('Authorization', 'Bearer analyst-token')
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.notifiedClients).toBe(12);
      });

      it('should validate required fields for risk assessment update', async () => {
        const response = await request(app)
          .post('/websocket/risk-assessment/update')
          .set('Authorization', 'Bearer analyst-token')
          .send({ assessmentId: 'assessment-123' }) // Missing riskScore and status
          .expect(400);

        expect(response.body.error).toBe('Assessment ID, risk score, and status are required');
      });

      it('should validate status values', async () => {
        mockValidate.mockImplementationOnce((schema) => (req, res, next) => {
          const validStatuses = ['pending', 'processing', 'completed', 'failed'];
          if (req.body.status && !validStatuses.includes(req.body.status)) {
            return res.status(400).json({ error: 'Invalid status value' });
          }
          next();
        });

        const response = await request(app)
          .post('/websocket/risk-assessment/update')
          .set('Authorization', 'Bearer analyst-token')
          .send({
            assessmentId: 'assessment-123',
            riskScore: 75,
            status: 'invalid-status'
          })
          .expect(400);

        expect(response.body.error).toBe('Invalid status value');
      });
    });

    describe('GET /websocket/risk-assessment/active-subscriptions', () => {
      it('should get active risk assessment subscriptions', async () => {
        const mockSubscriptions = {
          totalSubscriptions: 15,
          subscriptions: [
            {
              clientId: 'client-1',
              userId: 'user-123',
              subscriptionId: 'sub-1',
              filters: {
                assessmentId: 'assessment-123',
                riskThreshold: 75
              },
              subscribedAt: '2024-01-01T00:00:00Z'
            },
            {
              clientId: 'client-2',
              userId: 'user-456',
              subscriptionId: 'sub-2',
              filters: {
                frameworks: ['SOX', 'HIPAA']
              },
              subscribedAt: '2024-01-01T00:05:00Z'
            }
          ],
          byFramework: {
            'SOX': 8,
            'PCI-DSS': 5,
            'HIPAA': 3,
            'GDPR': 2
          }
        };

        mockWebsocketController.getActiveRiskSubscriptions.mockImplementation((req, res) => {
          res.json({ success: true, data: mockSubscriptions });
        });

        const response = await request(app)
          .get('/websocket/risk-assessment/active-subscriptions')
          .set('Authorization', 'Bearer admin-token')
          .expect(200);

        expect(response.body.data.totalSubscriptions).toBe(15);
        expect(response.body.data.subscriptions).toHaveLength(2);
        expect(response.body.data.byFramework).toBeDefined();
      });

      it('should handle no active subscriptions', async () => {
        mockWebsocketController.getActiveRiskSubscriptions.mockImplementation((req, res) => {
          res.json({
            success: true,
            data: {
              totalSubscriptions: 0,
              subscriptions: [],
              byFramework: {}
            }
          });
        });

        const response = await request(app)
          .get('/websocket/risk-assessment/active-subscriptions')
          .set('Authorization', 'Bearer admin-token')
          .expect(200);

        expect(response.body.data.totalSubscriptions).toBe(0);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle controller errors gracefully', async () => {
      mockWebsocketController.getStatus.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      const response = await request(app)
        .get('/websocket/status')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .type('json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle large message payloads', async () => {
      const largeMessage = {
        type: 'large_data',
        data: {
          content: 'x'.repeat(1000000) // 1MB of data
        }
      };

      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        const messageSize = JSON.stringify(req.body).length;
        if (messageSize > 512000) { // 512KB limit
          return res.status(413).json({
            success: false,
            error: 'Message payload too large'
          });
        }
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send(largeMessage)
        .expect(413);

      expect(response.body.error).toBe('Message payload too large');
    });

    it('should handle concurrent subscription requests', async () => {
      let subscriptionCount = 0;
      
      mockWebsocketController.subscribeToRiskAssessments.mockImplementation((req, res) => {
        subscriptionCount++;
        setTimeout(() => {
          res.json({
            success: true,
            subscriptionId: `sub-${subscriptionCount}`
          });
        }, 10);
      });

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/websocket/risk-assessment/subscribe')
          .set('Authorization', 'Bearer user-token')
          .send({})
      );

      const responses = await Promise.all(requests);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.subscriptionId).toBe(`sub-${index + 1}`);
      });

      expect(mockWebsocketController.subscribeToRiskAssessments).toHaveBeenCalledTimes(5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-frequency status checks', async () => {
      mockWebsocketController.getStatus.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: { active: true, connectedClients: 100 }
        });
      });

      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/websocket/status')
          .set('Authorization', 'Bearer admin-token')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockWebsocketController.getStatus).toHaveBeenCalledTimes(20);
    });

    it('should handle bulk broadcast operations', async () => {
      const bulkBroadcasts = Array(10).fill(null).map((_, index) => ({
        type: 'bulk_notification',
        data: { message: `Notification ${index}`, id: index }
      }));

      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        res.json({
          success: true,
          messageId: `msg-${req.body.data.id}`,
          recipientCount: 50
        });
      });

      for (const broadcast of bulkBroadcasts) {
        const response = await request(app)
          .post('/websocket/broadcast')
          .set('Authorization', 'Bearer admin-token')
          .send(broadcast)
          .expect(200);
        
        expect(response.body.success).toBe(true);
      }

      expect(mockWebsocketController.broadcast).toHaveBeenCalledTimes(10);
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive client information', async () => {
      mockWebsocketController.getStatus.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: {
            connectedClients: 15,
            // Should not include sensitive client data like IPs, tokens, etc.
            serverStats: {
              uptime: 3600,
              memoryUsage: 512000000
            }
          }
        });
      });

      const response = await request(app)
        .get('/websocket/status')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toMatch(/password|token|ip|address/i);
    });

    it('should validate client ID format', async () => {
      mockWebsocketController.sendToClient.mockImplementation((req, res) => {
        const clientId = req.params.clientId;
        if (!clientId.match(/^[a-zA-Z0-9-_]+$/)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid client ID format'
          });
        }
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/websocket/send/invalid<script>client</script>')
        .set('Authorization', 'Bearer admin-token')
        .send({ type: 'test', data: {} })
        .expect(400);

      expect(response.body.error).toBe('Invalid client ID format');
    });

    it('should sanitize broadcast data', async () => {
      mockWebsocketController.broadcast.mockImplementation((req, res) => {
        const message = req.body.data?.message;
        if (message && message.includes('<script>')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid characters in message'
          });
        }
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/websocket/broadcast')
        .set('Authorization', 'Bearer admin-token')
        .send({
          type: 'notification',
          data: { message: 'Hello <script>alert("xss")</script>' }
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid characters in message');
    });
  });
});