import request from 'supertest';
import express from 'express';
import { circuitBreakerRoutes } from '../circuit-breaker.routes';

const app = express();
app.use(express.json());
app.use('/api/circuit-breaker', circuitBreakerRoutes);

// Mock the circuit breaker service
const mockBreaker = {
  getMetrics: jest.fn(() => ({
    state: 'closed',
    failureCount: 0,
    successCount: 100,
    timeout: 5000,
    threshold: 5
  })),
  reset: jest.fn(),
  forceOpen: jest.fn(),
  forceClose: jest.fn()
};

jest.mock('../../services/circuit-breaker.service', () => ({
  circuitBreakerManager: {
    getAllMetrics: jest.fn(() => ({
      'api-service': {
        state: 'closed',
        failureCount: 0,
        successCount: 100
      },
      'database-service': {
        state: 'half-open',
        failureCount: 3,
        successCount: 97
      }
    })),
    getBreaker: jest.fn((name: string) => {
      if (name === 'nonexistent') return null;
      return mockBreaker;
    }),
    resetAll: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateOrBypass: jest.fn((req, res, next) => next())
}));

describe('Circuit Breaker Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/circuit-breaker/status', () => {
    test('should return status of all circuit breakers', async () => {
      const response = await request(app)
        .get('/api/circuit-breaker/status')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        breakers: {
          'api-service': {
            state: 'closed',
            failureCount: 0,
            successCount: 100
          },
          'database-service': {
            state: 'half-open',
            failureCount: 3,
            successCount: 97
          }
        }
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should handle errors when getting status', async () => {
      const { circuitBreakerManager } = require('../../services/circuit-breaker.service');
      circuitBreakerManager.getAllMetrics.mockImplementationOnce(() => {
        throw new Error('Service unavailable');
      });

      const response = await request(app)
        .get('/api/circuit-breaker/status')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get circuit breaker status',
        message: 'Service unavailable'
      });
    });
  });

  describe('GET /api/circuit-breaker/status/:name', () => {
    test('should return status of specific circuit breaker', async () => {
      const response = await request(app)
        .get('/api/circuit-breaker/status/api-service')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'api-service',
        metrics: {
          state: 'closed',
          failureCount: 0,
          successCount: 100,
          timeout: 5000,
          threshold: 5
        }
      });
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return 404 for non-existent circuit breaker', async () => {
      const response = await request(app)
        .get('/api/circuit-breaker/status/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Circuit breaker not found',
        name: 'nonexistent'
      });
    });

    test('should handle errors when getting specific breaker status', async () => {
      const { circuitBreakerManager } = require('../../services/circuit-breaker.service');
      circuitBreakerManager.getBreaker.mockImplementationOnce(() => {
        throw new Error('Access denied');
      });

      const response = await request(app)
        .get('/api/circuit-breaker/status/api-service')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get circuit breaker status',
        message: 'Access denied'
      });
    });
  });

  describe('POST /api/circuit-breaker/reset/:name', () => {
    test('should reset specific circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/reset/api-service')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Circuit breaker api-service has been reset',
        metrics: {
          state: 'closed',
          failureCount: 0,
          successCount: 100,
          timeout: 5000,
          threshold: 5
        }
      });

      expect(mockBreaker.reset).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/reset/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Circuit breaker not found',
        name: 'nonexistent'
      });
    });

    test('should handle errors when resetting breaker', async () => {
      mockBreaker.reset.mockImplementationOnce(() => {
        throw new Error('Reset failed');
      });

      const response = await request(app)
        .post('/api/circuit-breaker/reset/api-service')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to reset circuit breaker',
        message: 'Reset failed'
      });
    });
  });

  describe('POST /api/circuit-breaker/reset', () => {
    test('should reset all circuit breakers', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/reset')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'All circuit breakers have been reset',
        metrics: {
          'api-service': {
            state: 'closed',
            failureCount: 0,
            successCount: 100
          },
          'database-service': {
            state: 'half-open',
            failureCount: 3,
            successCount: 97
          }
        }
      });

      const { circuitBreakerManager } = require('../../services/circuit-breaker.service');
      expect(circuitBreakerManager.resetAll).toHaveBeenCalledTimes(1);
    });

    test('should handle errors when resetting all breakers', async () => {
      const { circuitBreakerManager } = require('../../services/circuit-breaker.service');
      circuitBreakerManager.resetAll.mockImplementationOnce(() => {
        throw new Error('Reset all failed');
      });

      const response = await request(app)
        .post('/api/circuit-breaker/reset')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to reset circuit breakers',
        message: 'Reset all failed'
      });
    });
  });

  describe('POST /api/circuit-breaker/force-open/:name', () => {
    test('should force open specific circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/force-open/api-service')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Circuit breaker api-service has been forced open',
        metrics: {
          state: 'closed',
          failureCount: 0,
          successCount: 100,
          timeout: 5000,
          threshold: 5
        }
      });

      expect(mockBreaker.forceOpen).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/force-open/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Circuit breaker not found',
        name: 'nonexistent'
      });
    });

    test('should handle errors when forcing open breaker', async () => {
      mockBreaker.forceOpen.mockImplementationOnce(() => {
        throw new Error('Force open failed');
      });

      const response = await request(app)
        .post('/api/circuit-breaker/force-open/api-service')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to force open circuit breaker',
        message: 'Force open failed'
      });
    });
  });

  describe('POST /api/circuit-breaker/force-close/:name', () => {
    test('should force close specific circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/force-close/api-service')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Circuit breaker api-service has been forced closed',
        metrics: {
          state: 'closed',
          failureCount: 0,
          successCount: 100,
          timeout: 5000,
          threshold: 5
        }
      });

      expect(mockBreaker.forceClose).toHaveBeenCalledTimes(1);
    });

    test('should return 404 for non-existent circuit breaker', async () => {
      const response = await request(app)
        .post('/api/circuit-breaker/force-close/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Circuit breaker not found',
        name: 'nonexistent'
      });
    });

    test('should handle errors when forcing close breaker', async () => {
      mockBreaker.forceClose.mockImplementationOnce(() => {
        throw new Error('Force close failed');
      });

      const response = await request(app)
        .post('/api/circuit-breaker/force-close/api-service')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to force close circuit breaker',
        message: 'Force close failed'
      });
    });
  });

  describe('Authentication and Middleware', () => {
    test('should call auth middleware for all endpoints', async () => {
      const { authenticateOrBypass } = require('../../middleware/auth.middleware');
      
      await request(app).get('/api/circuit-breaker/status');
      await request(app).get('/api/circuit-breaker/status/api-service');
      await request(app).post('/api/circuit-breaker/reset/api-service');
      await request(app).post('/api/circuit-breaker/reset');
      await request(app).post('/api/circuit-breaker/force-open/api-service');
      await request(app).post('/api/circuit-breaker/force-close/api-service');

      expect(authenticateOrBypass).toHaveBeenCalledTimes(6);
    });
  });

  describe('Edge Cases', () => {
    test('should handle special characters in breaker names', async () => {
      await request(app)
        .get('/api/circuit-breaker/status/api-service-v2.0')
        .expect(200);
    });

    test('should handle empty breaker name', async () => {
      // Note: Express may handle trailing slashes differently
      const response = await request(app)
        .get('/api/circuit-breaker/status/');
      
      // Accept either 404 (route not found) or 200 (handled by route)
      expect([200, 404]).toContain(response.status);
    });

    test('should handle unknown error types', async () => {
      const { circuitBreakerManager } = require('../../services/circuit-breaker.service');
      circuitBreakerManager.getAllMetrics.mockImplementationOnce(() => {
        throw 'Unknown error type';
      });

      const response = await request(app)
        .get('/api/circuit-breaker/status')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get circuit breaker status',
        message: 'Unknown error'
      });
    });
  });
});