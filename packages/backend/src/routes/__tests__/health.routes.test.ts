import request from 'supertest';
import express from 'express';
import { healthRoutes } from '../health.routes';

// Mock dependencies
jest.mock('../../database', () => ({
  getDatabaseStatus: jest.fn()
}));

jest.mock('../../database/duckdb-pool', () => ({
  duckDBPool: {
    getPoolStats: jest.fn()
  }
}));

const app = express();
app.use('/health', healthRoutes);

describe('Health Routes', () => {
  const mockGetDatabaseStatus = require('../../database').getDatabaseStatus;
  const mockDuckDBPool = require('../../database/duckdb-pool').duckDBPool;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health/status', () => {
    it('should return healthy status with connected databases', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });

      const response = await request(app)
        .get('/health/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        services: {
          api: 'operational',
          database: {
            sqlite: 'connected',
            duckdb: 'connected'
          }
        }
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should return status with partial database connectivity', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'disconnected'
      });

      const response = await request(app)
        .get('/health/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        services: {
          api: 'operational',
          database: {
            sqlite: 'connected',
            duckdb: 'disconnected'
          }
        }
      });
    });

    it('should handle database status check errors gracefully', async () => {
      mockGetDatabaseStatus.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/health/status')
        .expect(500);

      // Should handle database errors gracefully in real implementation
      // For now, this will throw, but in production should return degraded status
    });

    it('should include proper timestamp format', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });

      const beforeRequest = new Date();
      const response = await request(app)
        .get('/health/status')
        .expect(200);
      const afterRequest = new Date();

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status when both databases are connected', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        ready: true
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return not ready when SQLite is disconnected', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'disconnected',
        duckdb: 'connected'
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false
      });
    });

    it('should return not ready when DuckDB is disconnected', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'disconnected'
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false
      });
    });

    it('should return not ready when both databases are disconnected', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'disconnected',
        duckdb: 'disconnected'
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        ready: false
      });
    });

    it('should handle database status check errors', async () => {
      mockGetDatabaseStatus.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/health/ready')
        .expect(500);

      // Should handle errors gracefully
    });
  });

  describe('GET /health/duckdb-pool', () => {
    it('should return healthy pool statistics', async () => {
      const mockPoolStats = {
        totalConnections: 10,
        activeConnections: 3,
        idleConnections: 7,
        waitingClients: 0,
        poolHealth: 'healthy'
      };

      mockDuckDBPool.getPoolStats.mockResolvedValue(mockPoolStats);

      const response = await request(app)
        .get('/health/duckdb-pool')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        pool: mockPoolStats
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('recommendations');
    });

    it('should return warning recommendations for stressed pool', async () => {
      const mockPoolStats = {
        totalConnections: 10,
        activeConnections: 9,
        idleConnections: 1,
        waitingClients: 5,
        poolHealth: 'warning'
      };

      mockDuckDBPool.getPoolStats.mockResolvedValue(mockPoolStats);

      const response = await request(app)
        .get('/health/duckdb-pool')
        .expect(200);

      expect(response.body.pool).toEqual(mockPoolStats);
      expect(response.body.recommendations).toHaveProperty('warning');
      expect(response.body.recommendations.warning).toContain('Pool under stress');
    });

    it('should return critical recommendations for critical pool', async () => {
      const mockPoolStats = {
        totalConnections: 10,
        activeConnections: 10,
        idleConnections: 0,
        waitingClients: 20,
        poolHealth: 'critical'
      };

      mockDuckDBPool.getPoolStats.mockResolvedValue(mockPoolStats);

      const response = await request(app)
        .get('/health/duckdb-pool')
        .expect(200);

      expect(response.body.pool).toEqual(mockPoolStats);
      expect(response.body.recommendations).toHaveProperty('critical');
      expect(response.body.recommendations.critical).toContain('critical state');
    });

    it('should handle pool statistics errors', async () => {
      const error = new Error('Pool connection failed');
      mockDuckDBPool.getPoolStats.mockRejectedValue(error);

      const response = await request(app)
        .get('/health/duckdb-pool')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        error: 'Pool connection failed'
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle unknown errors gracefully', async () => {
      mockDuckDBPool.getPoolStats.mockRejectedValue('Unknown error');

      const response = await request(app)
        .get('/health/duckdb-pool')
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        error: 'Unknown error'
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent timestamp formats across all endpoints', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });
      mockDuckDBPool.getPoolStats.mockResolvedValue({
        totalConnections: 5,
        activeConnections: 2,
        idleConnections: 3,
        waitingClients: 0,
        poolHealth: 'healthy'
      });

      const [statusResponse, readyResponse, poolResponse] = await Promise.all([
        request(app).get('/health/status'),
        request(app).get('/health/ready'),
        request(app).get('/health/duckdb-pool')
      ]);

      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(statusResponse.body.timestamp).toMatch(timestampRegex);
      expect(readyResponse.body.timestamp).toMatch(timestampRegex);
      expect(poolResponse.body.timestamp).toMatch(timestampRegex);
    });

    it('should handle concurrent requests properly', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });

      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health/status')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });
  });

  describe('Performance', () => {
    it('should respond to health checks quickly', async () => {
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'connected',
        duckdb: 'connected'
      });

      const startTime = Date.now();
      await request(app)
        .get('/health/status')
        .expect(200);
      const endTime = Date.now();

      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle timeout in database status check', async () => {
      mockGetDatabaseStatus.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          sqlite: 'connected',
          duckdb: 'timeout'
        }), 100))
      );

      const response = await request(app)
        .get('/health/status')
        .expect(200);

      expect(response.body.services.database.duckdb).toBe('timeout');
    });
  });
});