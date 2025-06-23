import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

describe('Simple API Workflow E2E Tests', () => {
  let app: express.Application;
  let validToken: string;
  const jwtSecret = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Create auth token
    validToken = jwt.sign({ username: 'testuser', role: 'admin' }, jwtSecret);

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

    // Define routes
    app.get('/api/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });

    app.post('/api/data/upload', authenticate, (req, res) => {
      const { filename, data } = req.body;
      if (!filename || !data) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      res.json({ 
        success: true, 
        dataset: { id: 'dataset-123', filename, size: data.length }
      });
    });

    app.get('/api/data/datasets', authenticate, (req, res) => {
      res.json({
        datasets: [
          { id: 'dataset-123', filename: 'test.csv', status: 'ready' }
        ],
        total: 1
      });
    });

    app.get('/api/data/datasets/:id', authenticate, (req, res) => {
      const { id } = req.params;
      if (id !== 'dataset-123') {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      res.json({
        dataset: {
          id,
          filename: 'test.csv',
          status: 'ready',
          headers: ['name', 'review', 'rating']
        }
      });
    });

    app.post('/api/sentiment/analyze', authenticate, (req, res) => {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      res.json({
        success: true,
        result: {
          sentiment: text.includes('good') || text.includes('great') ? 'positive' : 'negative',
          confidence: 0.95,
          model: 'gpt-4'
        }
      });
    });

    app.delete('/api/data/datasets/:id', authenticate, (req, res) => {
      const { id } = req.params;
      if (id !== 'dataset-123') {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      res.json({ success: true, message: 'Dataset deleted' });
    });

    // Error handler
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({ error: 'Internal server error' });
    });
  });

  describe('Complete User Workflow', () => {
    it('should complete a full data processing workflow', async () => {
      // 1. Health check
      const healthRes = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(healthRes.body.status).toBe('healthy');
      expect(healthRes.body.timestamp).toBeDefined();

      // 2. Upload dataset
      const uploadRes = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filename: 'reviews.csv',
          data: 'name,review,rating\nJohn,Great product!,5\nJane,Not satisfied,2'
        })
        .expect(200);

      expect(uploadRes.body.success).toBe(true);
      expect(uploadRes.body.dataset.id).toBe('dataset-123');
      expect(uploadRes.body.dataset.filename).toBe('reviews.csv');

      // 3. List datasets
      const listRes = await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(listRes.body.datasets).toHaveLength(1);
      expect(listRes.body.datasets[0].id).toBe('dataset-123');

      // 4. Get dataset details
      const detailRes = await request(app)
        .get('/api/data/datasets/dataset-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(detailRes.body.dataset.id).toBe('dataset-123');
      expect(detailRes.body.dataset.headers).toEqual(['name', 'review', 'rating']);

      // 5. Analyze sentiment
      const sentimentRes = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ text: 'This is a great product!' })
        .expect(200);

      expect(sentimentRes.body.success).toBe(true);
      expect(sentimentRes.body.result.sentiment).toBe('positive');
      expect(sentimentRes.body.result.confidence).toBeGreaterThan(0.9);

      // 6. Delete dataset
      const deleteRes = await request(app)
        .delete('/api/data/datasets/dataset-123')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.message).toBe('Dataset deleted');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(app)
        .get('/api/data/datasets')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/api/data/datasets')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should accept requests with valid token', async () => {
      await request(app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const res = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ filename: 'test.csv' }) // missing data
        .expect(400);

      expect(res.body.error).toBe('Missing required fields');
    });

    it('should handle not found errors', async () => {
      const res = await request(app)
        .get('/api/data/datasets/non-existent')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(res.body.error).toBe('Dataset not found');
    });

    it('should handle missing text for sentiment analysis', async () => {
      const res = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${validToken}`)
        .send({}) // missing text
        .expect(400);

      expect(res.body.error).toBe('Text is required');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
      });
    });

    it('should handle mixed authenticated requests', async () => {
      const operations = [
        request(app).get('/api/health'),
        request(app)
          .get('/api/data/datasets')
          .set('Authorization', `Bearer ${validToken}`),
        request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ text: 'good product' })
      ];

      const [healthRes, datasetsRes, sentimentRes] = await Promise.all(operations);
      
      expect(healthRes.status).toBe(200);
      expect(datasetsRes.status).toBe(200);
      expect(sentimentRes.status).toBe(200);
      expect(sentimentRes.body.result.sentiment).toBe('positive');
    });
  });

  describe('Performance', () => {
    it('should respond quickly to requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/health')
        .expect(200);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should respond within 100ms
    });

    it('should handle rapid sequential requests', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/health')
          .expect(200);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // 10 requests in 500ms
    });
  });

  describe('Data Validation', () => {
    it('should handle various sentiment texts', async () => {
      const testCases = [
        { text: 'This is great!', expectedSentiment: 'positive' },
        { text: 'Very good service', expectedSentiment: 'positive' },
        { text: 'Terrible experience', expectedSentiment: 'negative' },
        { text: 'Not happy', expectedSentiment: 'negative' }
      ];

      for (const testCase of testCases) {
        const res = await request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ text: testCase.text })
          .expect(200);

        expect(res.body.result.sentiment).toBe(testCase.expectedSentiment);
      }
    });

    it('should handle large payloads', async () => {
      const largeData = 'header1,header2\n' + Array(100).fill('value1,value2').join('\n');

      const res = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          filename: 'large.csv',
          data: largeData
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.dataset.size).toBe(largeData.length);
    });
  });
});