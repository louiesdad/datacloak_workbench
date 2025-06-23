import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';
// Controllers will be mocked directly

// Mock services
jest.mock('../../services/data.service');
jest.mock('../../services/security.service');
jest.mock('../../services/openai.service');
jest.mock('../../services/datacloak.service');
jest.mock('../../services/insights.service');
jest.mock('../../services/job-queue.service');
jest.mock('../../services/event.service');
jest.mock('../../services/cache.service');
jest.mock('../../database');

describe('API E2E Workflows', () => {
  let app: express.Application;
  let server: Server;
  let validToken: string;
  let wsService: WebSocketService;
  let sseService: SSEService;
  const jwtSecret = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';

  // Mock implementations
  const mockDataService = {
    uploadDataset: jest.fn().mockResolvedValue({ id: 'dataset-123', status: 'uploaded' }),
    getDatasets: jest.fn().mockResolvedValue({
      datasets: [{ id: 'dataset-123', name: 'test.csv', status: 'ready' }],
      total: 1
    }),
    getDatasetById: jest.fn().mockResolvedValue({
      id: 'dataset-123',
      name: 'test.csv',
      status: 'ready',
      preview: { headers: ['name', 'email', 'review', 'rating'], rows: [] }
    }),
    deleteDataset: jest.fn().mockResolvedValue({ success: true }),
    exportData: jest.fn().mockResolvedValue({ data: 'exported data' }),
    validateDataset: jest.fn().mockResolvedValue({ valid: true })
  };

  const mockSecurityService = {
    scanForPII: jest.fn().mockResolvedValue({ hasPII: false, fields: [] }),
    validateData: jest.fn().mockResolvedValue({ valid: true }),
    generateComplianceReport: jest.fn().mockResolvedValue({ compliant: true })
  };

  const mockOpenAIService = {
    analyzeSentiment: jest.fn().mockResolvedValue({
      sentiment: 'positive',
      confidence: 0.95,
      model: 'gpt-4'
    })
  };

  const mockDataCloakService = {
    transformData: jest.fn().mockResolvedValue({ transformed: true }),
    validatePrivacy: jest.fn().mockResolvedValue({ private: true })
  };

  const mockInsightsService = {
    generateInsights: jest.fn().mockResolvedValue({
      insights: ['Mostly positive sentiment', 'High engagement']
    })
  };

  const mockJobQueueService = {
    addJob: jest.fn().mockResolvedValue({ id: 'job-123', status: 'pending' }),
    getJob: jest.fn().mockResolvedValue({ id: 'job-123', status: 'completed', result: {} })
  };

  beforeAll(async () => {
    // Create auth token
    validToken = jwt.sign({ username: 'testuser', role: 'admin' }, jwtSecret);

    // Setup Express app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Simple auth middleware
    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      try {
        const token = authHeader.substring(7);
        req.user = jwt.verify(token, jwtSecret);
        next();
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    };

    // Create mock controllers that send proper responses
    const dataController = {
      uploadData: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockDataService.uploadDataset();
        res.json({ success: true, data: result });
      }),
      getDatasets: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockDataService.getDatasets();
        res.json(result);
      }),
      getDatasetById: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockDataService.getDatasetById(req.params.id);
        res.json({ success: true, data: result });
      }),
      deleteDataset: jest.fn().mockImplementation(async (req, res) => {
        await mockDataService.deleteDataset(req.params.id);
        res.json({ success: true });
      }),
      exportData: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockDataService.exportData();
        res.json({ success: true, data: result });
      })
    };

    const securityController = {
      scanData: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockSecurityService.scanForPII();
        res.json({ success: true, data: result });
      }),
      getComplianceReport: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockSecurityService.generateComplianceReport();
        res.json({ success: true, data: result });
      })
    };

    const sentimentController = {
      analyzeSentiment: jest.fn().mockImplementation(async (req, res) => {
        const result = await mockOpenAIService.analyzeSentiment();
        res.json({ success: true, data: result });
      })
    };

    // Setup routes
    const router = express.Router();

    // Data routes
    router.post('/upload', authenticate, dataController.uploadData);
    router.get('/datasets', authenticate, dataController.getDatasets);
    router.get('/datasets/:id', authenticate, dataController.getDatasetById);
    router.delete('/datasets/:id', authenticate, dataController.deleteDataset);
    router.post('/export', authenticate, dataController.exportData);

    // Security routes
    router.post('/security/scan', authenticate, securityController.scanData);
    router.post('/security/compliance', authenticate, securityController.getComplianceReport);

    // Sentiment routes
    router.post('/sentiment/analyze', authenticate, sentimentController.analyzeSentiment);

    // Health route
    router.get('/health', (req, res) => res.json({ status: 'healthy' }));

    // SSE endpoint
    router.get('/events', (req, res) => {
      const clientId = sseService.addClient(res, req.query.userId as string);
      res.on('close', () => sseService.removeClient(clientId));
    });

    app.use('/api', router);

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    });

    // Start server
    server = app.listen(0);

    // Initialize services
    wsService = new WebSocketService();
    sseService = new SSEService();
    wsService.initialize(server);
  });

  afterAll(async () => {
    wsService?.shutdown();
    sseService?.stopPingInterval();
    await new Promise<void>(resolve => server?.close(() => resolve()));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Data Processing Workflow', () => {
    it('should handle end-to-end data upload and sentiment analysis', async () => {
      // 1. Health check
      const healthRes = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(healthRes.body.status).toBe('healthy');

      // 2. Upload dataset
      const uploadRes = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filename: 'reviews.csv',
          data: 'name,review\nJohn,"Great product!"\nJane,"Not satisfied"',
          contentType: 'text/csv'
        })
        .expect(200);

      expect(uploadRes.body.success).toBe(true);
      expect(mockDataService.uploadDataset).toHaveBeenCalled();

      // 3. Get datasets
      const datasetsRes = await request(app)
        .get('/api/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(datasetsRes.body.datasets).toHaveLength(1);

      // 4. Security scan
      const scanRes = await request(app)
        .post('/api/security/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ datasetId: 'dataset-123' })
        .expect(200);

      expect(scanRes.body.success).toBe(true);
      expect(mockSecurityService.scanForPII).toHaveBeenCalled();

      // 5. Sentiment analysis
      const sentimentRes = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          datasetId: 'dataset-123',
          text: 'Great product!'
        })
        .expect(200);

      expect(sentimentRes.body.success).toBe(true);
      expect(mockOpenAIService.analyzeSentiment).toHaveBeenCalled();

      // 6. Export results
      const exportRes = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          datasetId: 'dataset-123',
          format: 'csv'
        })
        .expect(200);

      expect(exportRes.body.success).toBe(true);
      expect(mockDataService.exportData).toHaveBeenCalled();

      // 7. Delete dataset
      const deleteRes = await request(app)
        .delete('/api/datasets/dataset-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);
      expect(mockDataService.deleteDataset).toHaveBeenCalledWith('dataset-123');
    });
  });

  describe('Real-time Communication', () => {
    it('should handle SSE connections for progress updates', (done) => {
      // SSE connections don't close immediately, so we'll test the initial response
      request(app)
        .get('/api/events?userId=test-user')
        .set('Accept', 'text/event-stream')
        .expect(200)
        .expect('Content-Type', /text\/event-stream/)
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive')
        .end((err, res) => {
          if (err) return done(err);
          // Close the connection immediately to avoid timeout
          if (res && res.req) {
            res.req.abort();
          }
          done();
        });
    });

    it('should broadcast events to connected clients', async () => {
      // Add test client
      const mockResponse = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn()
      };
      
      const clientId = sseService.addClient(mockResponse as any, 'test-user');
      
      // Send progress event
      sseService.sendProgress(clientId, 'job-123', 50, 'Processing...');
      
      // Verify message was sent
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('event: progress')
      );
      
      sseService.removeClient(clientId);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      await request(app)
        .get('/api/datasets')
        .expect(401);
    });

    it('should handle invalid tokens', async () => {
      await request(app)
        .get('/api/datasets')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should handle service errors gracefully', async () => {
      mockDataService.uploadDataset.mockRejectedValueOnce(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ filename: 'test.csv', data: 'test' })
        .expect(500);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array(5).fill(null).map((_, i) => 
        request(app)
          .get('/api/datasets')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
      
      expect(mockDataService.getDatasets).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed operation types concurrently', async () => {
      const operations = [
        request(app).get('/api/health'),
        request(app).get('/api/datasets').set('Authorization', `Bearer ${validToken}`),
        request(app).post('/api/sentiment/analyze')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ text: 'test' }),
        request(app).post('/api/security/scan')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ datasetId: 'test' })
      ];

      const results = await Promise.all(operations);
      
      expect(results[0].status).toBe(200); // health
      expect(results[1].status).toBe(200); // datasets
      expect(results[2].status).toBe(200); // sentiment
      expect(results[3].status).toBe(200); // security
    });
  });

  describe('Performance Testing', () => {
    it('should handle rapid sequential requests', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/health')
          .expect(200);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle large payload processing', async () => {
      const largeData = 'header1,header2\n' + 
        Array(1000).fill('value1,value2').join('\n');

      const res = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filename: 'large.csv',
          data: largeData,
          contentType: 'text/csv'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});