import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestDatabase, teardownTestDatabase } from './database.setup';


describe('API Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createApp();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });


  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });

    it('should return service status', async () => {
      const response = await request(app)
        .get('/api/v1/health/status')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze sentiment successfully', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'This is amazing and wonderful!' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toMatchObject({
        text: 'This is amazing and wonderful!',
        sentiment: expect.stringMatching(/^(positive|negative|neutral)$/),
        score: expect.any(Number),
        confidence: expect.any(Number),
        id: expect.any(Number),
      });
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should handle batch analysis', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: ['Great service!', 'Terrible experience!'] })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should get analysis history', async () => {
      const response = await request(app)
        .get('/api/v1/sentiment/history')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should get statistics', async () => {
      const response = await request(app)
        .get('/api/v1/sentiment/statistics')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalAnalyses');
    });
  });

  describe('Data Management', () => {
    it('should handle file upload', async () => {
      const csvContent = 'name,age\nJohn,30\nJane,25';
      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('dataset');
      expect(response.body.data).toHaveProperty('previewData');
      expect(response.body.data).toHaveProperty('fieldInfo');
    });

    it('should get datasets', async () => {
      const response = await request(app)
        .get('/api/v1/data/datasets')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should handle export request', async () => {
      const response = await request(app)
        .post('/api/v1/data/export')
        .send({ format: 'csv' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('downloadUrl');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should handle missing file upload', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});