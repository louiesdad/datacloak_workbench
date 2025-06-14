import request from 'supertest';
import { createApp } from '../../src/app';

describe('App Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('GET /api/v1/health/status', () => {
    it('should return service status', async () => {
      const response = await request(app)
        .get('/api/v1/health/status')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('api', 'operational');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message', 'Resource not found');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });

  describe('API Routes', () => {
    it('should handle sentiment analysis endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'This is a test message' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('sentiment');
    });

    it('should handle batch sentiment analysis', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: ['Text 1', 'Text 2'] })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle data upload endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message');
    });
  });
});