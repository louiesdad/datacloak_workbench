import request from 'supertest';
import { createApp } from '../../src/app';
import { setupTestDatabase, teardownTestDatabase } from './database.setup';

describe('Error Handling Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    await setupTestDatabase();
    app = await createApp();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Validation Errors', () => {
    it('should handle missing required fields in sentiment analysis', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({}) // Missing 'text' field
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(response.body.error.message).toContain('text');
    });

    it('should handle invalid text in sentiment analysis', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: '' }) // Empty text
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle invalid batch size in batch sentiment analysis', async () => {
      const largeArray = new Array(1001).fill('test text'); // Exceeds limit
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: largeArray })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'BATCH_TOO_LARGE');
    });

    it('should handle missing file in data upload', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        .send({}) // No file attached
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('file');
    });

    it('should handle invalid file type in data upload', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from('invalid content'), 'test.txt')
        .set('Content-Type', 'application/pdf') // Unsupported type
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_FILE_TYPE');
    });
  });

  describe('Not Found Errors', () => {
    it('should handle dataset not found', async () => {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';
      const response = await request(app)
        .get(`/api/v1/data/datasets/${nonExistentId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'DATASET_NOT_FOUND');
    });

    it('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/v1/data/datasets/invalid-uuid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Content Type Errors', () => {
    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .set('Content-Type', 'application/json')
        .send('invalid json content')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing Content-Type for file upload', async () => {
      const response = await request(app)
        .post('/api/v1/data/upload')
        .send('raw data without proper headers')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting and Large Payloads', () => {
    it('should handle extremely large text in sentiment analysis', async () => {
      const largeText = 'a'.repeat(100000); // 100KB text
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: largeText })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle request body too large', async () => {
      const veryLargeArray = new Array(10000).fill('test text'.repeat(1000));
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: veryLargeArray })
        .expect(413);

      // Should get payload too large error or validation error
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Endpoint Errors', () => {
    it('should handle missing text in PII detection', async () => {
      const response = await request(app)
        .post('/api/v1/security/detect')
        .send({}) // Missing 'text' field
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle invalid compliance framework', async () => {
      const response = await request(app)
        .post('/api/v1/security/audit/file')
        .send({ 
          filePath: '/test/path',
          complianceFramework: 'INVALID_FRAMEWORK'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Job Queue Errors', () => {
    it('should handle invalid job type', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({
          type: 'invalid_job_type',
          data: {}
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_JOB_TYPE');
    });

    it('should handle invalid job priority', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({
          type: 'sentiment_analysis_batch',
          data: { texts: ['test'] },
          priority: 'invalid_priority'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'INVALID_JOB_PRIORITY');
    });

    it('should handle missing job data', async () => {
      const response = await request(app)
        .post('/api/v1/jobs')
        .send({
          type: 'sentiment_analysis_batch'
          // Missing 'data' field
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle job not found', async () => {
      const nonExistentJobId = '12345678-1234-1234-1234-123456789012';
      const response = await request(app)
        .get(`/api/v1/jobs/${nonExistentJobId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'JOB_NOT_FOUND');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for all endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({}) // This will cause a validation error
        .expect(400);

      // Check error response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('status', 400);
      
      // Ensure error message is a string
      expect(typeof response.body.error.message).toBe('string');
      expect(response.body.error.message.length).toBeGreaterThan(0);
      
      // Ensure code is a string
      expect(typeof response.body.error.code).toBe('string');
      expect(response.body.error.code.length).toBeGreaterThan(0);
    });

    it('should handle internal server errors gracefully', async () => {
      // Try to trigger an internal error by providing malformed data
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: [null, undefined, {}] }) // Invalid text types
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('status', 500);
      expect(response.body.error.message).not.toContain('stack'); // No stack traces in production
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include proper security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for security headers added by helmet
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/sentiment/analyze')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Error Recovery', () => {
    it('should recover from database errors gracefully', async () => {
      // This test checks that the app doesn't crash on database errors
      // and returns appropriate error responses
      const response = await request(app)
        .get('/api/v1/sentiment/history?page=999999') // Very large page number
        .expect(200); // Should handle gracefully

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle concurrent requests without errors', async () => {
      // Send multiple concurrent requests to ensure no race conditions
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: `Test message ${i}` })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      });
    });
  });
});