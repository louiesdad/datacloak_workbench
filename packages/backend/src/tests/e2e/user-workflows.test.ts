import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';

// Mock dependencies BEFORE importing modules that use them
jest.mock('../../services/config.service');
jest.mock('../../services/data.service');
jest.mock('../../controllers/data.controller');
jest.mock('../../database');
jest.mock('../../database/duckdb-pool');
jest.mock('../../config/logger');

// Import all routes AFTER mocking
import authRoutes from '../../routes/auth.routes';
import { dataRoutes } from '../../routes/data.routes';
import { healthRoutes } from '../../routes/health.routes';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';
import { ConfigService } from '../../services/config.service';
import { DataService } from '../../services/data.service';
import { DataController } from '../../controllers/data.controller';
import { getDatabaseStatus } from '../../database';
import { duckDBPool } from '../../database/duckdb-pool';

describe('End-to-End User Workflows', () => {
  let app: express.Application;
  let server: Server;
  let serverPort: number;
  let wsService: WebSocketService;
  let sseService: SSEService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockDataService: jest.Mocked<DataService>;
  let mockDataController: jest.Mocked<DataController>;

  beforeEach(() => {
    // Setup mocks - do this in beforeEach to ensure fresh state
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockDataService = {
      uploadDataset: jest.fn(),
      getDatasets: jest.fn(),
      getDatasetById: jest.fn(),
      deleteDataset: jest.fn(),
      exportData: jest.fn(),
    } as any;

    mockDataController = {
      uploadData: jest.fn(),
      getDatasets: jest.fn(),
      getDataset: jest.fn(),
      deleteDataset: jest.fn(),
      exportData: jest.fn(),
    } as any;

    // Mock the static getInstance method properly
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
    (DataService as jest.MockedClass<typeof DataService>).mockImplementation(() => mockDataService);
    (DataController as jest.MockedClass<typeof DataController>).mockImplementation(() => mockDataController);

    // Mock database functions
    (getDatabaseStatus as jest.Mock).mockResolvedValue({
      sqlite: 'connected',
      duckdb: 'connected'
    });

    (duckDBPool.getPoolStats as jest.Mock).mockResolvedValue({
      activeConnections: 2,
      idleConnections: 8,
      totalConnections: 10,
      poolHealth: 'healthy'
    });

    // Setup config
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return 'test-password';
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });
  });

  beforeAll(async () => {

    // Create Express app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Add routes
    app.use('/api/auth', authRoutes);
    app.use('/api/data', dataRoutes);
    app.use('/api/health', healthRoutes);

    // Add SSE endpoint
    app.get('/api/events', (req, res) => {
      const userId = req.query.userId as string;
      sseService.addClient(res, userId);
    });

    // Error handling
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
      });
    });

    // Create server
    server = app.listen(0);
    serverPort = (server.address() as any).port;

    // Initialize services
    wsService = new WebSocketService();
    sseService = new SSEService();
    
    // Skip WebSocket initialization for now to avoid hanging
    // wsService.initialize(server);
  });

  afterAll(async () => {
    if (wsService) {
      wsService.shutdown();
    }
    if (sseService) {
      sseService.stopPingInterval();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Data Processing Workflow', () => {
    it('should handle end-to-end data upload and analysis workflow', async () => {
      console.log('Starting E2E test...');
      
      // 1. Health Check
      console.log('Making health check request...');
      const healthResponse = await request(app)
        .get('/api/health/status')
        .timeout(2000) // Add explicit timeout
        .expect(200);
      
      console.log('Health check completed:', healthResponse.body);

      expect(healthResponse.body.status).toBe('healthy');

      // 2. Authentication
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'test-password'
        })
        .expect(200);

      const token = loginResponse.body.token;
      expect(token).toBeDefined();

      // 3. Upload CSV data
      const csvData = `name,email,review,rating
John Doe,john@example.com,"Great product, love it!",5
Jane Smith,jane@example.com,"Could be better, disappointed",2
Bob Wilson,bob@example.com,"Amazing quality and service",5
Alice Brown,alice@example.com,"Average product",3`;

      const mockUploadResult = {
        id: 'dataset-12345',
        name: 'reviews.csv',
        rowCount: 4,
        columns: ['name', 'email', 'review', 'rating'],
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Mock DataController's uploadData method to respond properly
      mockDataController.uploadData.mockImplementation(async (req, res) => {
        res.status(201).json({
          data: mockUploadResult,
          message: 'Data uploaded successfully'
        });
      });

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvData), {
          filename: 'reviews.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      expect(uploadResponse.body.data).toEqual(mockUploadResult);

      // 4. Verify dataset was created
      const mockDatasets = {
        data: [mockUploadResult],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1
        }
      };

      mockDataService.getDatasets.mockResolvedValue(mockDatasets);

      const listResponse = await request(app)
        .get('/api/data/datasets')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe('dataset-12345');

      // 5. Get dataset details
      mockDataService.getDatasetById.mockResolvedValue(mockUploadResult);

      const detailResponse = await request(app)
        .get('/api/data/datasets/dataset-12345')
        .expect(200);

      expect(detailResponse.body.data.rowCount).toBe(4);
      expect(detailResponse.body.data.columns).toContain('review');

      // 6. Export processed data
      const mockExportResult = {
        exportId: 'export-67890',
        downloadUrl: '/downloads/export-67890.csv',
        format: 'csv',
        estimatedSize: '2KB'
      };

      mockDataService.exportData.mockResolvedValue(mockExportResult);

      const exportResponse = await request(app)
        .post('/api/data/export')
        .send({
          format: 'csv',
          datasetId: 'dataset-12345'
        })
        .expect(200);

      expect(exportResponse.body.data.exportId).toBe('export-67890');

      // 7. Cleanup - delete dataset
      mockDataService.deleteDataset.mockResolvedValue({ success: true });

      const deleteResponse = await request(app)
        .delete('/api/data/datasets/dataset-12345')
        .expect(200);

      expect(deleteResponse.body.message).toContain('deleted successfully');
    }, 15000); // Increase timeout to 15 seconds
  });

  describe('Real-time Monitoring Workflow', () => {
    it('should provide real-time updates during data processing', async () => {
      // 1. Connect WebSocket client
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // 2. Subscribe to relevant topics
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      }));

      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'file_processing' }
      }));

      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Simulate file upload that triggers processing
      const csvData = 'text,sentiment\n"Great product",positive\n"Poor quality",negative';
      
      mockDataService.uploadDataset.mockResolvedValue({
        id: 'realtime-dataset',
        name: 'realtime.csv',
        rowCount: 2,
        status: 'processing'
      });

      const uploadPromise = request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvData), {
          filename: 'realtime.csv',
          contentType: 'text/csv'
        });

      // 4. Simulate real-time events during processing
      setTimeout(() => {
        wsService.broadcast({
          type: 'file_progress',
          data: {
            fileId: 'realtime-dataset',
            progress: 25,
            stage: 'parsing',
            message: 'Parsing CSV file'
          }
        }, { topic: 'file_processing' });
      }, 50);

      setTimeout(() => {
        wsService.broadcast({
          type: 'sentiment_progress',
          data: {
            jobId: 'sentiment-job-123',
            progress: 50,
            message: 'Analyzing sentiment'
          }
        }, { topic: 'sentiment' });
      }, 100);

      setTimeout(() => {
        wsService.broadcast({
          type: 'sentiment_complete',
          data: {
            jobId: 'sentiment-job-123',
            results: {
              positive: 1,
              negative: 1,
              neutral: 0
            }
          }
        }, { topic: 'sentiment' });
      }, 150);

      await uploadPromise;
      await new Promise(resolve => setTimeout(resolve, 200));

      // 5. Verify real-time updates were received
      const fileProgressMsg = messages.find(msg => msg.type === 'file_progress');
      const sentimentProgressMsg = messages.find(msg => msg.type === 'sentiment_progress');
      const sentimentCompleteMsg = messages.find(msg => msg.type === 'sentiment_complete');

      expect(fileProgressMsg).toBeDefined();
      expect(fileProgressMsg.data.progress).toBe(25);

      expect(sentimentProgressMsg).toBeDefined();
      expect(sentimentProgressMsg.data.progress).toBe(50);

      expect(sentimentCompleteMsg).toBeDefined();
      expect(sentimentCompleteMsg.data.results.positive).toBe(1);

      ws.close();
    });
  });

  describe('Multi-User Scenario', () => {
    it('should handle multiple users working simultaneously', async () => {
      // 1. User 1 authentication
      const user1Login = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-password' })
        .expect(200);

      const user1Token = user1Login.body.token;

      // 2. User 1 connects to real-time services
      const user1WS = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => user1WS.on('open', resolve));

      user1WS.send(JSON.stringify({
        type: 'authenticate',
        data: { userId: 'user1' }
      }));

      // 3. User 2 connects (simulated)
      const user2WS = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => user2WS.on('open', resolve));

      user2WS.send(JSON.stringify({
        type: 'authenticate',
        data: { userId: 'user2' }
      }));

      const user1Messages: any[] = [];
      const user2Messages: any[] = [];

      user1WS.on('message', (data) => {
        user1Messages.push(JSON.parse(data.toString()));
      });

      user2WS.on('message', (data) => {
        user2Messages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. User 1 uploads data
      mockDataService.uploadDataset.mockResolvedValue({
        id: 'user1-dataset',
        name: 'user1-data.csv',
        rowCount: 50,
        userId: 'user1'
      });

      await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('data,value\ntest,123'), {
          filename: 'user1-data.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      // 5. Send user-specific notifications
      wsService.sendToUser('user1', {
        type: 'personal_notification',
        data: { message: 'Your upload completed successfully' }
      });

      wsService.sendToUser('user2', {
        type: 'personal_notification',
        data: { message: 'System maintenance in 1 hour' }
      });

      // 6. Broadcast system-wide announcement
      wsService.broadcast({
        type: 'system_announcement',
        data: { message: 'New features available!' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // 7. Verify users received appropriate messages
      const user1Personal = user1Messages.find(msg => 
        msg.type === 'personal_notification' && 
        msg.data.message.includes('upload completed')
      );
      const user2Personal = user2Messages.find(msg => 
        msg.type === 'personal_notification' && 
        msg.data.message.includes('maintenance')
      );
      const user1Broadcast = user1Messages.find(msg => msg.type === 'system_announcement');
      const user2Broadcast = user2Messages.find(msg => msg.type === 'system_announcement');

      expect(user1Personal).toBeDefined();
      expect(user2Personal).toBeDefined();
      expect(user1Broadcast).toBeDefined();
      expect(user2Broadcast).toBeDefined();

      // Users should not receive each other's personal messages
      const user1WrongPersonal = user1Messages.find(msg => 
        msg.type === 'personal_notification' && 
        msg.data.message.includes('maintenance')
      );
      const user2WrongPersonal = user2Messages.find(msg => 
        msg.type === 'personal_notification' && 
        msg.data.message.includes('upload completed')
      );

      expect(user1WrongPersonal).toBeUndefined();
      expect(user2WrongPersonal).toBeUndefined();

      user1WS.close();
      user2WS.close();
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from service errors', async () => {
      // 1. Test system health during errors
      const healthResponse = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // 2. Simulate service error during upload
      mockDataService.uploadDataset.mockRejectedValueOnce(
        new Error('Temporary service unavailable')
      );

      const failedUploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test,data\n1,2'), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(500);

      expect(failedUploadResponse.body.success).toBe(false);
      expect(failedUploadResponse.body.error).toContain('service unavailable');

      // 3. Verify system is still operational for other requests
      const healthAfterError = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(healthAfterError.body.status).toBe('healthy');

      // 4. Retry the upload (should succeed)
      mockDataService.uploadDataset.mockResolvedValueOnce({
        id: 'retry-dataset',
        name: 'test.csv',
        rowCount: 1,
        status: 'completed'
      });

      const retryUploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test,data\n1,2'), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      expect(retryUploadResponse.body.data.id).toBe('retry-dataset');

      // 5. Verify authentication still works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-password' })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent user operations', async () => {
      const numConcurrentUsers = 10;
      const promises: Promise<any>[] = [];

      // Mock successful responses for all operations
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      // Simulate concurrent users performing various operations
      for (let i = 0; i < numConcurrentUsers; i++) {
        promises.push(
          request(app).get('/api/health/status'),
          request(app).get('/api/data/datasets'),
          request(app)
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'test-password' })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
      });

      // Should handle concurrent load reasonably fast
      expect(duration).toBeLessThan(5000); // Under 5 seconds
      expect(responses).toHaveLength(numConcurrentUsers * 3);
    });
  });
});