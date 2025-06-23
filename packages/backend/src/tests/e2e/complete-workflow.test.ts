import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';
import { eventEmitter, EventTypes } from '../../services/event.service';

describe('Complete E2E Workflow Tests', () => {
  let app: express.Application;
  let validToken: string;
  let adminToken: string;
  let wsService: WebSocketService;
  let sseService: SSEService;
  const jwtSecret = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
  
  // Mock data storage
  const datasets = new Map();
  const jobs = new Map();

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json({ limit: '10mb' }));

    // Create tokens
    validToken = jwt.sign({ username: 'user1', role: 'user' }, jwtSecret);
    adminToken = jwt.sign({ username: 'admin', role: 'admin' }, jwtSecret);

    // Initialize services
    wsService = new WebSocketService();
    sseService = new SSEService();

    // Auth middleware
    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
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

    // Admin middleware
    const requireAdmin = (req: any, res: any, next: any) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    };

    // Routes
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        services: {
          api: 'operational',
          websocket: wsService ? 'operational' : 'unavailable',
          sse: sseService ? 'operational' : 'unavailable'
        },
        timestamp: new Date()
      });
    });

    // Authentication
    app.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Missing credentials' });
      }
      
      const token = jwt.sign(
        { username, role: username === 'admin' ? 'admin' : 'user' },
        jwtSecret,
        { expiresIn: '1h' }
      );
      
      res.json({ token, user: { username, role: username === 'admin' ? 'admin' : 'user' } });
    });

    // Data management
    app.post('/api/data/upload', authenticate, (req, res) => {
      const { filename, data, contentType } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const datasetId = `dataset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const dataset = {
        id: datasetId,
        filename,
        contentType: contentType || 'text/csv',
        size: data.length,
        uploadedBy: req.user.username,
        uploadedAt: new Date(),
        status: 'processing'
      };

      datasets.set(datasetId, dataset);

      // Simulate processing
      setTimeout(() => {
        dataset.status = 'ready';
        eventEmitter.emit(EventTypes.DATASET_READY, { datasetId });
      }, 500);

      res.json({ success: true, dataset });
    });

    app.get('/api/data/datasets', authenticate, (req, res) => {
      const userDatasets = Array.from(datasets.values()).filter(d => 
        req.user.role === 'admin' || d.uploadedBy === req.user.username
      );
      res.json({ datasets: userDatasets, total: userDatasets.length });
    });

    app.get('/api/data/datasets/:id', authenticate, (req, res) => {
      const dataset = datasets.get(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      if (req.user.role !== 'admin' && dataset.uploadedBy !== req.user.username) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json({ dataset });
    });

    app.delete('/api/data/datasets/:id', authenticate, (req, res) => {
      const dataset = datasets.get(req.params.id);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      if (req.user.role !== 'admin' && dataset.uploadedBy !== req.user.username) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      datasets.delete(req.params.id);
      res.json({ success: true, message: 'Dataset deleted' });
    });

    // Sentiment analysis
    app.post('/api/sentiment/analyze', authenticate, async (req, res) => {
      const { datasetId, text, mode = 'single' } = req.body;
      
      if (mode === 'single' && !text) {
        return res.status(400).json({ error: 'Text is required for single analysis' });
      }
      if (mode === 'batch' && !datasetId) {
        return res.status(400).json({ error: 'Dataset ID is required for batch analysis' });
      }

      const jobId = `job-${Date.now()}`;
      const job = {
        id: jobId,
        type: 'sentiment_analysis',
        mode,
        status: 'pending',
        createdBy: req.user.username,
        createdAt: new Date(),
        progress: 0
      };

      jobs.set(jobId, job);
      
      // Emit job created event
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId,
        type: 'sentiment_analysis',
        userId: req.user.username
      });

      // Simulate processing
      setTimeout(() => {
        job.status = 'processing';
        job.progress = 50;
        eventEmitter.emit(EventTypes.JOB_PROGRESS, {
          jobId,
          progress: 50,
          message: 'Analyzing sentiment'
        });
      }, 100);

      setTimeout(() => {
        job.status = 'completed';
        job.progress = 100;
        job.result = mode === 'single' 
          ? { sentiment: text.includes('good') || text.includes('great') ? 'positive' : 'negative', confidence: 0.95 }
          : { processed: 100, positive: 60, negative: 30, neutral: 10 };
        
        eventEmitter.emit(EventTypes.JOB_COMPLETED, {
          jobId,
          result: job.result
        });
      }, 300);

      res.json({ success: true, jobId, status: 'accepted' });
    });

    // Job management
    app.get('/api/jobs/:id', authenticate, (req, res) => {
      const job = jobs.get(req.params.id);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (req.user.role !== 'admin' && job.createdBy !== req.user.username) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json({ job });
    });

    app.get('/api/jobs', authenticate, (req, res) => {
      const userJobs = Array.from(jobs.values()).filter(j => 
        req.user.role === 'admin' || j.createdBy === req.user.username
      );
      res.json({ jobs: userJobs, total: userJobs.length });
    });

    // Admin endpoints
    app.get('/api/admin/stats', authenticate, requireAdmin, (req, res) => {
      res.json({
        datasets: { total: datasets.size },
        jobs: { total: jobs.size, completed: Array.from(jobs.values()).filter(j => j.status === 'completed').length },
        users: { active: 2 }
      });
    });

    app.post('/api/admin/cleanup', authenticate, requireAdmin, (req, res) => {
      const before = { datasets: datasets.size, jobs: jobs.size };
      
      // Clear old completed jobs
      for (const [id, job] of jobs) {
        if (job.status === 'completed') {
          jobs.delete(id);
        }
      }
      
      const after = { datasets: datasets.size, jobs: jobs.size };
      res.json({ success: true, before, after });
    });

    // SSE endpoint
    app.get('/api/events', (req, res) => {
      const userId = req.query.userId as string || 'anonymous';
      const clientId = sseService.addClient(res, userId);
      
      // Cleanup on disconnect
      req.on('close', () => {
        sseService.removeClient(clientId);
      });
    });

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });

    // Setup event listeners for SSE broadcasting
    eventEmitter.on(EventTypes.JOB_CREATED, (data) => {
      sseService.broadcast('job:created', data);
    });

    eventEmitter.on(EventTypes.JOB_PROGRESS, (data) => {
      sseService.broadcast('job:progress', data);
    });

    eventEmitter.on(EventTypes.JOB_COMPLETED, (data) => {
      sseService.broadcast('job:completed', data);
    });
  });

  afterAll(() => {
    sseService.stopPingInterval();
    eventEmitter.removeAllListeners();
  });

  beforeEach(() => {
    // Clear data between tests
    datasets.clear();
    jobs.clear();
  });

  describe('Complete User Journey', () => {
    it('should handle full workflow from login to results', async () => {
      // 1. Health check
      const healthRes = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(healthRes.body.status).toBe('healthy');
      expect(healthRes.body.services.api).toBe('operational');

      // 2. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(200);

      const userToken = loginRes.body.token;
      expect(userToken).toBeDefined();
      expect(loginRes.body.user.role).toBe('user');

      // 3. Upload dataset
      const uploadRes = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          filename: 'customer-reviews.csv',
          data: 'id,review,rating\n1,Great product!,5\n2,Not satisfied,2\n3,Good value,4'
        })
        .expect(200);

      expect(uploadRes.body.success).toBe(true);
      const datasetId = uploadRes.body.dataset.id;
      expect(datasetId).toBeDefined();

      // 4. List datasets
      const listRes = await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(listRes.body.datasets).toHaveLength(1);
      expect(listRes.body.datasets[0].id).toBe(datasetId);

      // 5. Start sentiment analysis
      const analysisRes = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          datasetId,
          mode: 'batch'
        })
        .expect(200);

      expect(analysisRes.body.success).toBe(true);
      const jobId = analysisRes.body.jobId;
      expect(jobId).toBeDefined();

      // 6. Wait for job completion
      await new Promise(resolve => setTimeout(resolve, 400));

      // 7. Check job status
      const jobRes = await request(app)
        .get(`/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(jobRes.body.job.status).toBe('completed');
      expect(jobRes.body.job.result).toBeDefined();
      expect(jobRes.body.job.result.processed).toBe(100);

      // 8. Delete dataset
      const deleteRes = await request(app)
        .delete(`/api/data/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);
    });
  });

  describe('Multi-user Scenarios', () => {
    it('should isolate data between users', async () => {
      // User 1 uploads data
      const user1Upload = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filename: 'user1-data.csv',
          data: 'test data'
        })
        .expect(200);

      const user1DatasetId = user1Upload.body.dataset.id;

      // User 2 logs in
      const user2Login = await request(app)
        .post('/api/auth/login')
        .send({ username: 'user2', password: 'password' })
        .expect(200);

      const user2Token = user2Login.body.token;

      // User 2 uploads data
      const user2Upload = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          filename: 'user2-data.csv',
          data: 'other data'
        })
        .expect(200);

      // User 1 can only see their own data
      const user1List = await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(user1List.body.datasets).toHaveLength(1);
      expect(user1List.body.datasets[0].filename).toBe('user1-data.csv');

      // User 2 cannot access User 1's data
      await request(app)
        .get(`/api/data/datasets/${user1DatasetId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      // Admin can see all data
      const adminList = await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminList.body.datasets).toHaveLength(2);
    });
  });

  describe('Admin Operations', () => {
    it('should allow admin to view stats and cleanup', async () => {
      // Create some test data
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ filename: 'test.csv', data: 'data' });

      const jobRes = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ text: 'test', mode: 'single' });

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 400));

      // Get admin stats
      const statsRes = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statsRes.body.datasets.total).toBeGreaterThan(0);
      expect(statsRes.body.jobs.completed).toBeGreaterThan(0);

      // Cleanup completed jobs
      const cleanupRes = await request(app)
        .post('/api/admin/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(cleanupRes.body.success).toBe(true);
      expect(cleanupRes.body.after.jobs).toBeLessThan(cleanupRes.body.before.jobs);

      // Regular user cannot access admin endpoints
      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });
  });

  describe('Real-time Updates', () => {
    it('should broadcast job progress via SSE', async () => {
      // Setup SSE client
      const mockResponse = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn()
      };
      
      const clientId = sseService.addClient(mockResponse as any, 'test-user');

      // Start a job
      const jobRes = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ text: 'Great service!', mode: 'single' })
        .expect(200);

      // Wait for events
      await new Promise(resolve => setTimeout(resolve, 400));

      // Check SSE events were sent
      const writeCalls = mockResponse.write.mock.calls;
      expect(writeCalls.some(call => call[0].includes('job:created'))).toBe(true);
      expect(writeCalls.some(call => call[0].includes('job:progress'))).toBe(true);
      expect(writeCalls.some(call => call[0].includes('job:completed'))).toBe(true);

      // Cleanup
      sseService.removeClient(clientId);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle various error conditions', async () => {
      // Missing auth
      await request(app)
        .post('/api/data/upload')
        .send({ filename: 'test.csv', data: 'data' })
        .expect(401);

      // Invalid token
      await request(app)
        .get('/api/data/datasets')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Missing required fields
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ filename: 'test.csv' }) // missing data
        .expect(400);

      // Not found
      await request(app)
        .get('/api/data/datasets/non-existent')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      // Access denied
      await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent operations efficiently', async () => {
      const operations = [];
      
      // Create 10 concurrent uploads
      for (let i = 0; i < 10; i++) {
        operations.push(
          request(app)
            .post('/api/data/upload')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
              filename: `concurrent-${i}.csv`,
              data: `data-${i}`
            })
        );
      }

      const results = await Promise.all(operations);
      
      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // Verify all were created
      const listRes = await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(listRes.body.datasets).toHaveLength(10);
    });

    it('should complete operations quickly', async () => {
      const startTime = Date.now();
      
      // Run a complete workflow
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ filename: 'perf-test.csv', data: 'test data' })
        .expect(200);

      await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ text: 'performance test', mode: 'single' })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});