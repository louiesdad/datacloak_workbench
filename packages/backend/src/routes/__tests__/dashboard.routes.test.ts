import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';

// Create comprehensive mocks
const mockDashboardController = {
  getMetrics: jest.fn(),
  getJobHistory: jest.fn(),
  getSystemHealth: jest.fn(),
  getPerformanceMetrics: jest.fn(),
};

const mockConfigService = {
  getInstance: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

// Mock filesystem for sendFile
const mockSendFile = jest.fn((filePath, callback) => {
  if (callback) callback();
});

// Mock path operations
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mocked/path/dashboard.html'),
}));

// Mock dependencies
jest.mock('../../controllers/dashboard.controller', () => ({
  DashboardController: jest.fn().mockImplementation(() => mockDashboardController)
}));

jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: () => mockConfigService
  }
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, 'test-jwt-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}));

// Import dashboard routes after mocking
import dashboardRoutes from '../dashboard.routes';

describe('Dashboard Routes', () => {
  let app: express.Application;
  let validToken: string;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());
    
    // Mock res.sendFile
    app.use((req, res, next) => {
      const originalSendFile = res.sendFile;
      res.sendFile = function(path: string, ...args: any[]) {
        // Mock the file send operation
        res.status(200).send('<html><body>Dashboard</body></html>');
        return this;
      };
      next();
    });

    app.use('/dashboard', dashboardRoutes);

    // Generate valid JWT token for testing
    validToken = jwt.sign({ username: 'admin', role: 'admin' }, 'test-jwt-secret', { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup config service mock
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'JWT_SECRET':
          return 'test-jwt-secret';
        case 'ADMIN_USERNAME':
          return 'admin';
        default:
          return undefined;
      }
    });
  });

  describe('GET /dashboard/', () => {
    it('should serve dashboard HTML file', async () => {
      const response = await request(app)
        .get('/dashboard/')
        .expect(200);

      expect(response.text).toContain('Dashboard');
    });

    it('should handle dashboard file serving errors gracefully', async () => {
      // Mock a file system error
      app.use('/dashboard-error', (req, res, next) => {
        if (req.path === '/') {
          res.sendFile = function() {
            throw new Error('File not found');
          };
        }
        next();
      });

      app.use('/dashboard-error', dashboardRoutes);

      const response = await request(app)
        .get('/dashboard-error/')
        .expect(500);
    });
  });

  describe('GET /dashboard/metrics', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/dashboard/metrics')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return dashboard metrics with valid token', async () => {
      const mockMetrics = {
        jobs: {
          total: 150,
          pending: 5,
          running: 2,
          completed: 140,
          failed: 3,
          recentJobs: [
            { id: 'job1', type: 'sentiment', status: 'completed', createdAt: '2024-01-01T00:00:00Z' }
          ],
          averageProcessingTime: 5.2
        },
        cache: {
          enabled: true,
          type: 'redis',
          hits: 1000,
          misses: 200,
          hitRate: 0.83,
          totalOperations: 1200,
          memoryUsage: 52428800
        },
        system: {
          uptime: 86400,
          memoryUsage: { rss: 100000000, heapUsed: 50000000, heapTotal: 75000000, external: 5000000, arrayBuffers: 1000000 },
          nodeVersion: 'v18.17.0',
          environment: 'test'
        },
        config: {
          redisEnabled: true,
          cacheEnabled: true,
          maxConcurrentJobs: 10,
          openaiConfigured: true
        }
      };

      mockDashboardController.getMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getMetrics).toHaveBeenCalled();
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should reject malformed authorization headers', async () => {
      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });
  });

  describe('GET /dashboard/jobs/history', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/dashboard/jobs/history')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return job history with pagination', async () => {
      const mockJobHistory = {
        jobs: [
          {
            id: 'job-1',
            type: 'sentiment_analysis',
            status: 'completed',
            progress: 100,
            createdAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:05:00Z',
            processingTime: 300
          },
          {
            id: 'job-2',
            type: 'data_upload',
            status: 'failed',
            progress: 50,
            createdAt: '2024-01-01T01:00:00Z',
            error: 'Invalid file format'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 45,
          totalPages: 3
        }
      };

      mockDashboardController.getJobHistory.mockResolvedValue(mockJobHistory);

      const response = await request(app)
        .get('/dashboard/jobs/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getJobHistory).toHaveBeenCalled();
    });

    it('should support filtering by status', async () => {
      const mockFilteredHistory = {
        jobs: [
          {
            id: 'job-3',
            type: 'sentiment_analysis',
            status: 'failed',
            progress: 25,
            createdAt: '2024-01-01T02:00:00Z',
            error: 'API rate limit exceeded'
          }
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 3,
          totalPages: 1
        }
      };

      mockDashboardController.getJobHistory.mockResolvedValue(mockFilteredHistory);

      const response = await request(app)
        .get('/dashboard/jobs/history?status=failed&page=1&pageSize=20')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getJobHistory).toHaveBeenCalled();
    });

    it('should handle pagination parameters', async () => {
      mockDashboardController.getJobHistory.mockResolvedValue({
        jobs: [],
        pagination: { page: 2, pageSize: 10, total: 45, totalPages: 5 }
      });

      const response = await request(app)
        .get('/dashboard/jobs/history?page=2&pageSize=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getJobHistory).toHaveBeenCalled();
    });
  });

  describe('GET /dashboard/health', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/dashboard/health')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return system health status', async () => {
      const mockSystemHealth = {
        overall: 'healthy',
        services: {
          api: { status: 'operational', uptime: 86400, responseTime: 45 },
          database: {
            sqlite: { status: 'connected', connectionCount: 5, lastCheck: '2024-01-01T00:00:00Z' },
            duckdb: { status: 'connected', connectionCount: 2, lastCheck: '2024-01-01T00:00:00Z' }
          },
          cache: { status: 'operational', type: 'redis', memoryUsage: 52428800, hitRate: 0.85 },
          queue: { status: 'operational', pendingJobs: 5, runningJobs: 2, failedJobs: 1 }
        },
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockDashboardController.getSystemHealth.mockResolvedValue(mockSystemHealth);

      const response = await request(app)
        .get('/dashboard/health')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getSystemHealth).toHaveBeenCalled();
    });

    it('should handle partial service failures', async () => {
      const mockUnhealthySystem = {
        overall: 'degraded',
        services: {
          api: { status: 'operational' },
          database: {
            sqlite: { status: 'connected' },
            duckdb: { status: 'disconnected', error: 'Connection timeout' }
          },
          cache: { status: 'disconnected', error: 'Redis connection failed' },
          queue: { status: 'operational' }
        },
        timestamp: '2024-01-01T00:00:00Z'
      };

      mockDashboardController.getSystemHealth.mockResolvedValue(mockUnhealthySystem);

      const response = await request(app)
        .get('/dashboard/health')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getSystemHealth).toHaveBeenCalled();
    });
  });

  describe('GET /dashboard/performance', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/dashboard/performance')
        .expect(401);

      expect(response.body.error).toBe('No token provided');
    });

    it('should return performance metrics', async () => {
      const mockPerformanceMetrics = {
        api: {
          requestsPerSecond: 25.5,
          averageResponseTime: 120,
          p95ResponseTime: 250,
          p99ResponseTime: 400,
          errorRate: 0.02,
          totalRequests: 150000
        },
        jobs: {
          processingRate: 12.3,
          averageJobTime: 45.2,
          successRate: 0.95,
          queueDepth: 7,
          throughput: 1000
        },
        cache: {
          hitRate: 0.87,
          averageResponseTime: 5.2,
          evictionRate: 0.01,
          memoryEfficiency: 0.78
        },
        database: {
          connectionPoolUtilization: 0.65,
          averageQueryTime: 25.8,
          slowQueryCount: 5,
          connectionCount: 8
        },
        system: {
          cpuUsage: 45.2,
          memoryUsage: 78.5,
          diskUsage: 65.0,
          networkThroughput: 1250000
        }
      };

      mockDashboardController.getPerformanceMetrics.mockResolvedValue(mockPerformanceMetrics);

      const response = await request(app)
        .get('/dashboard/performance')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(mockDashboardController.getPerformanceMetrics).toHaveBeenCalled();
    });

    it('should handle performance metrics collection errors', async () => {
      mockDashboardController.getPerformanceMetrics.mockRejectedValue(new Error('Metrics collection failed'));

      const response = await request(app)
        .get('/dashboard/performance')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      mockDashboardController.getMetrics.mockRejectedValue(new Error('Service unavailable'));

      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);
    });

    it('should handle malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should handle expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { username: 'admin', role: 'admin' }, 
        'test-jwt-secret', 
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Route Security', () => {
    it('should not allow access without proper authentication on all protected routes', async () => {
      const protectedRoutes = [
        '/dashboard/metrics',
        '/dashboard/jobs/history',
        '/dashboard/health',
        '/dashboard/performance'
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          .get(route)
          .expect(401);

        expect(response.body.error).toBe('No token provided');
      }
    });

    it('should validate token signature', async () => {
      const tokenWithWrongSignature = jwt.sign(
        { username: 'admin', role: 'admin' },
        'wrong-secret'
      );

      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', `Bearer ${tokenWithWrongSignature}`)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Content Type and Format', () => {
    it('should return JSON content type for API endpoints', async () => {
      mockDashboardController.getMetrics.mockResolvedValue({ test: 'data' });

      const response = await request(app)
        .get('/dashboard/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle HEAD requests to API endpoints', async () => {
      const response = await request(app)
        .head('/dashboard/metrics')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests to different endpoints', async () => {
      mockDashboardController.getMetrics.mockResolvedValue({ metrics: 'data' });
      mockDashboardController.getJobHistory.mockResolvedValue({ jobs: [] });
      mockDashboardController.getSystemHealth.mockResolvedValue({ health: 'good' });

      const requests = [
        request(app).get('/dashboard/metrics').set('Authorization', `Bearer ${validToken}`),
        request(app).get('/dashboard/jobs/history').set('Authorization', `Bearer ${validToken}`),
        request(app).get('/dashboard/health').set('Authorization', `Bearer ${validToken}`)
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockDashboardController.getMetrics).toHaveBeenCalled();
      expect(mockDashboardController.getJobHistory).toHaveBeenCalled();
      expect(mockDashboardController.getSystemHealth).toHaveBeenCalled();
    });

    it('should handle multiple requests to the same endpoint', async () => {
      mockDashboardController.getMetrics.mockResolvedValue({ metrics: 'data' });

      const requests = Array(5).fill(null).map(() =>
        request(app).get('/dashboard/metrics').set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockDashboardController.getMetrics).toHaveBeenCalledTimes(5);
    });
  });
});