import { describe, beforeAll, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';
import { initializeDatabases } from '../../src/database';

describe('Simple API Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SQLITE_DB_PATH = ':memory:';
    
    // Initialize databases
    await initializeDatabases();
    
    // Create app
    app = createApp();
  });

  describe('Basic Health Checks', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return detailed service status', async () => {
      const response = await request(app)
        .get('/api/v1/health/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('API Structure', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/v1/sentiment/analyze')
        .set('Origin', 'http://localhost:5173')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('*'); // CORS is configured as wildcard in test env
    });
  });

  describe('Validation Endpoints', () => {
    it('should validate sentiment analysis input', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: '' }) // Invalid empty text
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate batch sentiment input', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: [] }) // Invalid empty array
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate file upload', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        // No file attached
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});