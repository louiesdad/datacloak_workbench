import request from 'supertest';
import { startTestServer, stopTestServer, waitFor, TestServer } from '../utils/integration-helpers';
import { WebSocket } from 'ws';

describe('Example Integration Test', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer({
      initializeWebSocket: true,
      initializeSSE: true,
      initializeDatabase: true
    });
  });

  afterAll(async () => {
    await stopTestServer(server);
  });

  describe('Health Check Integration', () => {
    it('should return healthy status with all services running', async () => {
      const response = await request(server.app)
        .get('/api/health/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        services: expect.objectContaining({
          database: expect.objectContaining({
            sqlite: 'connected'
          })
        })
      });
    });
  });

  describe('WebSocket Integration', () => {
    it('should handle WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${server.port}/ws`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      // Send a message
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      }));

      // Wait for response
      const response = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(response.type).toBe('pong');
      
      ws.close();
    });
  });

  describe('Data Upload Integration', () => {
    it('should handle file upload end-to-end', async () => {
      // 1. Login
      const loginResponse = await request(server.app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'test-admin-password-for-testing'
        })
        .expect(200);

      const token = loginResponse.body.token;

      // 2. Upload file
      const csvData = 'name,email,comment\nJohn,john@example.com,Great product!\nJane,jane@example.com,Needs improvement';
      
      const uploadResponse = await request(server.app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(csvData), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      expect(uploadResponse.body.data).toMatchObject({
        id: expect.any(String),
        filename: expect.stringContaining('.csv'),
        recordCount: 2
      });

      const datasetId = uploadResponse.body.data.id;

      // 3. Verify dataset was created
      const datasetsResponse = await request(server.app)
        .get('/api/data/datasets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(datasetsResponse.body.data).toContainEqual(
        expect.objectContaining({
          id: datasetId
        })
      );

      // 4. Delete dataset
      await request(server.app)
        .delete(`/api/data/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Service Coordination', () => {
    it('should coordinate between multiple services', async () => {
      // This test demonstrates how services work together
      const { getCacheService } = await import('../../services/cache.service');
      const cacheService = getCacheService();
      
      // Set a value in cache
      await cacheService.set('test-key', 'test-value', 60);
      
      // Verify it's accessible
      const value = await cacheService.get('test-key');
      expect(value).toBe('test-value');
      
      // Make an API call that uses cache
      const response = await request(server.app)
        .get('/api/health/status')
        .expect(200);
      
      // The health check might cache its result
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle service failures gracefully', async () => {
      // Test that the system handles errors properly
      const response = await request(server.app)
        .post('/api/data/upload')
        .send({ invalid: 'data' })
        .expect(401);  // Unauthorized without token
      
      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(server.app)
          .get('/api/health/status')
          .expect(200)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body.status).toBe('healthy');
      });
    });
  });
});