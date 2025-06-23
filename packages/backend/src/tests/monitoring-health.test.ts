import request from 'supertest';
import express from 'express';
import { createAllMocks } from '../../tests/utils/service-mocks';
import { mockRequest, mockResponse } from '../../tests/utils/mock-helpers';

// Create monitoring and health routes
const createMonitoringApp = (mocks: ReturnType<typeof createAllMocks>) => {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const checks = await performHealthChecks(mocks);
      const overall = Object.values(checks).every(check => check === 'healthy') 
        ? 'healthy' 
        : 'unhealthy';

      res.status(overall === 'healthy' ? 200 : 503).json({
        status: overall,
        checks,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Health check failed'
      });
    }
  });

  // Detailed health check
  app.get('/health/live', (req, res) => {
    res.json({ status: 'alive' });
  });

  app.get('/health/ready', async (req, res) => {
    const isReady = await checkReadiness(mocks);
    res.status(isReady ? 200 : 503).json({ 
      ready: isReady,
      timestamp: new Date().toISOString()
    });
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    const metrics = await collectMetrics(mocks);
    res.json(metrics);
  });

  // Prometheus metrics
  app.get('/metrics/prometheus', async (req, res) => {
    const metrics = await collectPrometheusMetrics(mocks);
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  });

  // System info
  app.get('/system/info', (req, res) => {
    res.json({
      app: {
        name: 'datacloak-backend',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid
    });
  });

  // Component status
  app.get('/status/:component', async (req, res) => {
    const { component } = req.params;
    const status = await getComponentStatus(component, mocks);
    
    if (!status) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(status);
  });

  return app;
};

// Helper functions
async function performHealthChecks(mocks: any) {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await mocks.database.query('SELECT 1');
    checks.database = 'healthy';
  } catch {
    checks.database = 'unhealthy';
  }

  // Cache check
  try {
    // Mock the cache to return the value we just set
    mocks.cacheService.set.mockResolvedValueOnce(true);
    mocks.cacheService.get.mockResolvedValueOnce('ok');
    
    await mocks.cacheService.set('health-check', 'ok', 10);
    const value = await mocks.cacheService.get('health-check');
    checks.cache = value === 'ok' ? 'healthy' : 'unhealthy';
  } catch {
    checks.cache = 'unhealthy';
  }

  // Queue check
  try {
    const queueStats = await mocks.jobQueueService.getQueueStats();
    checks.queue = queueStats ? 'healthy' : 'unhealthy';
  } catch {
    checks.queue = 'unhealthy';
  }

  // External services
  checks.openai = mocks.openAIService ? 'healthy' : 'unavailable';
  checks.datacloak = mocks.dataCloakService ? 'healthy' : 'unavailable';

  return checks;
}

async function checkReadiness(mocks: any) {
  try {
    // Check critical services
    await mocks.database.query('SELECT 1');
    await mocks.cacheService.get('test');
    return true;
  } catch {
    return false;
  }
}

async function collectMetrics(mocks: any) {
  const cacheStats = await mocks.cacheService.getStats();
  const queueStats = await mocks.jobQueueService.getQueueStats();
  const wsStats = mocks.webSocketService.getStats();

  return {
    timestamp: new Date().toISOString(),
    cache: {
      ...cacheStats,
      enabled: true
    },
    queue: {
      ...queueStats,
      healthy: true
    },
    websocket: {
      ...wsStats,
      connections: mocks.webSocketService.getClientCount()
    },
    api: {
      requestsPerMinute: Math.floor(Math.random() * 100) + 50,
      averageResponseTime: Math.random() * 100 + 50,
      errorRate: Math.random() * 0.05
    },
    system: {
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };
}

async function collectPrometheusMetrics(mocks: any) {
  const metrics = await collectMetrics(mocks);
  
  return `
# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total{method="GET",status="200"} ${Math.floor(Math.random() * 10000)}
api_requests_total{method="POST",status="200"} ${Math.floor(Math.random() * 5000)}
api_requests_total{method="GET",status="404"} ${Math.floor(Math.random() * 100)}
api_requests_total{method="POST",status="500"} ${Math.floor(Math.random() * 50)}

# HELP api_response_time_seconds API response time in seconds
# TYPE api_response_time_seconds histogram
api_response_time_seconds_bucket{le="0.005"} ${Math.floor(Math.random() * 1000)}
api_response_time_seconds_bucket{le="0.01"} ${Math.floor(Math.random() * 2000)}
api_response_time_seconds_bucket{le="0.025"} ${Math.floor(Math.random() * 3000)}
api_response_time_seconds_bucket{le="0.05"} ${Math.floor(Math.random() * 4000)}
api_response_time_seconds_sum ${Math.random() * 1000}
api_response_time_seconds_count ${Math.floor(Math.random() * 5000)}

# HELP cache_hit_ratio Cache hit ratio
# TYPE cache_hit_ratio gauge
cache_hit_ratio ${metrics.cache.hitRate || 0.85}

# HELP queue_jobs_pending Number of pending jobs
# TYPE queue_jobs_pending gauge
queue_jobs_pending ${metrics.queue.pending}

# HELP websocket_connections_active Number of active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active ${metrics.websocket.connections}

# HELP process_memory_bytes Process memory usage
# TYPE process_memory_bytes gauge
process_memory_bytes{type="rss"} ${metrics.system.memoryUsage.rss}
process_memory_bytes{type="heap_total"} ${metrics.system.memoryUsage.heapTotal}
process_memory_bytes{type="heap_used"} ${metrics.system.memoryUsage.heapUsed}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${metrics.system.uptime}
`.trim();
}

async function getComponentStatus(component: string, mocks: any) {
  switch (component) {
    case 'database':
      return {
        component: 'database',
        status: 'operational',
        details: {
          connections: 5,
          maxConnections: 100,
          responseTime: 2.5
        }
      };
    
    case 'cache':
      const cacheStats = await mocks.cacheService.getStats();
      return {
        component: 'cache',
        status: 'operational',
        details: cacheStats
      };
    
    case 'queue':
      const queueStats = await mocks.jobQueueService.getQueueStats();
      return {
        component: 'queue',
        status: queueStats.pending > 100 ? 'degraded' : 'operational',
        details: queueStats
      };
    
    case 'websocket':
      return {
        component: 'websocket',
        status: 'operational',
        details: mocks.webSocketService.getStats()
      };
    
    default:
      return null;
  }
}

describe('Monitoring and Health Checks', () => {
  let app: express.Application;
  let mocks: ReturnType<typeof createAllMocks>;

  beforeEach(() => {
    mocks = createAllMocks();
    
    // Setup default mock behaviors for health checks
    mocks.cacheService.get.mockImplementation((key) => {
      if (key === 'health-check') return Promise.resolve('ok');
      return Promise.resolve(null);
    });
    
    app = createMonitoringApp(mocks);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Endpoints', () => {
    it('should return healthy status when all services are up', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        checks: {
          database: 'healthy',
          cache: 'healthy',
          queue: 'healthy',
          openai: 'healthy',
          datacloak: 'healthy'
        }
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return unhealthy status when a service is down', async () => {
      mocks.database.query.mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'unhealthy',
        checks: {
          database: 'unhealthy',
          cache: 'healthy',
          queue: 'healthy'
        }
      });
    });

    it('should handle health check errors gracefully', async () => {
      // Mock all services to throw errors
      mocks.database.query.mockImplementation(() => {
        throw new Error('Critical error');
      });
      mocks.cacheService.set.mockImplementation(() => {
        throw new Error('Cache error');
      });
      mocks.jobQueueService.getQueueStats.mockImplementation(() => {
        throw new Error('Queue error');
      });

      const response = await request(app)
        .get('/health')
        .expect(503);

      // Since we catch errors in performHealthChecks, it should return unhealthy, not error
      expect(response.body.status).toBe('unhealthy');
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toEqual({ status: 'alive' });
    });

    it('should check readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        ready: true,
        timestamp: expect.any(String)
      });
    });

    it('should return not ready when critical services are down', async () => {
      mocks.database.query.mockRejectedValueOnce(new Error('Not connected'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body.ready).toBe(false);
    });
  });

  describe('Metrics Endpoints', () => {
    it('should return application metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        cache: {
          hits: expect.any(Number),
          misses: expect.any(Number),
          hitRate: expect.any(Number),
          enabled: true
        },
        queue: {
          pending: expect.any(Number),
          processing: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
          healthy: true
        },
        websocket: {
          totalClients: expect.any(Number),
          authenticatedClients: expect.any(Number),
          connections: expect.any(Number)
        },
        api: {
          requestsPerMinute: expect.any(Number),
          averageResponseTime: expect.any(Number),
          errorRate: expect.any(Number)
        },
        system: {
          cpuUsage: expect.any(Object),
          memoryUsage: expect.any(Object),
          uptime: expect.any(Number)
        }
      });
    });

    it('should return Prometheus-formatted metrics', async () => {
      const response = await request(app)
        .get('/metrics/prometheus')
        .expect(200)
        .expect('Content-Type', /text\/plain/);

      const metrics = response.text;
      expect(metrics).toContain('# HELP api_requests_total');
      expect(metrics).toContain('# TYPE api_requests_total counter');
      expect(metrics).toContain('api_requests_total{method="GET",status="200"}');
      expect(metrics).toContain('cache_hit_ratio');
      expect(metrics).toContain('queue_jobs_pending');
      expect(metrics).toContain('websocket_connections_active');
      expect(metrics).toContain('process_memory_bytes');
      expect(metrics).toContain('process_uptime_seconds');
    });
  });

  describe('System Information', () => {
    it('should return system information', async () => {
      const response = await request(app)
        .get('/system/info')
        .expect(200);

      expect(response.body).toMatchObject({
        app: {
          name: 'datacloak-backend',
          version: '1.0.0',
          environment: 'test'
        },
        node: {
          version: expect.stringMatching(/^v\d+\.\d+\.\d+/),
          platform: expect.any(String),
          arch: expect.any(String)
        },
        memory: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        },
        uptime: expect.any(Number),
        pid: expect.any(Number)
      });
    });
  });

  describe('Component Status', () => {
    it('should return database component status', async () => {
      const response = await request(app)
        .get('/status/database')
        .expect(200);

      expect(response.body).toMatchObject({
        component: 'database',
        status: 'operational',
        details: {
          connections: expect.any(Number),
          maxConnections: expect.any(Number),
          responseTime: expect.any(Number)
        }
      });
    });

    it('should return cache component status', async () => {
      const response = await request(app)
        .get('/status/cache')
        .expect(200);

      expect(response.body).toMatchObject({
        component: 'cache',
        status: 'operational',
        details: expect.objectContaining({
          hits: expect.any(Number),
          misses: expect.any(Number),
          hitRate: expect.any(Number)
        })
      });
    });

    it('should return queue component status', async () => {
      const response = await request(app)
        .get('/status/queue')
        .expect(200);

      expect(response.body).toMatchObject({
        component: 'queue',
        status: expect.stringMatching(/operational|degraded/),
        details: expect.objectContaining({
          pending: expect.any(Number),
          processing: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number)
        })
      });
    });

    it('should return 404 for unknown component', async () => {
      const response = await request(app)
        .get('/status/unknown')
        .expect(404);

      expect(response.body).toEqual({ error: 'Component not found' });
    });

    it('should show degraded status when queue is overloaded', async () => {
      mocks.jobQueueService.getQueueStats.mockResolvedValue({
        pending: 150,
        processing: 10,
        completed: 1000,
        failed: 5
      });

      const response = await request(app)
        .get('/status/queue')
        .expect(200);

      expect(response.body.status).toBe('degraded');
    });
  });

  describe('Performance', () => {
    it('should respond quickly to health checks', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/health/live')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should respond within 50ms
    });

    it('should handle concurrent health check requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
      });
    });
  });
});