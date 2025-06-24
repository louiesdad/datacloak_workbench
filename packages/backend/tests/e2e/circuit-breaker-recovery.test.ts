import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { CircuitBreakerService } from '../../src/services/circuit-breaker.service';
import { EventEmitter } from 'events';

describe('E2E: Circuit Breaker Recovery and Resilience', () => {
  let app: Express;
  let circuitBreaker: CircuitBreakerService;
  let eventEmitter: EventEmitter;

  beforeAll(async () => {
    app = await createTestApp();
    eventEmitter = new EventEmitter();
    circuitBreaker = new CircuitBreakerService(eventEmitter);
  });

  afterEach(() => {
    // Reset circuit breakers between tests
    circuitBreaker.reset('openai');
    circuitBreaker.reset('datacloak');
  });

  describe('Circuit Breaker States', () => {
    it('should transition from CLOSED to OPEN after failures', async () => {
      // Simulate service failures
      process.env.SIMULATE_SERVICE_ERROR = 'true';
      
      // Get initial state
      let status = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(status.body.openai.state).toBe('CLOSED');
      
      // Trigger failures (default threshold is 5)
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: 'Test failure', model: 'gpt-3.5-turbo' });
      }
      
      // Check state changed to OPEN
      status = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(status.body.openai).toMatchObject({
        state: 'OPEN',
        failures: expect.any(Number),
        successCount: 0,
        lastFailureTime: expect.any(String)
      });
      
      delete process.env.SIMULATE_SERVICE_ERROR;
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Force circuit to OPEN state
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Test when open', model: 'gpt-3.5-turbo' })
        .expect(503);
      
      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        circuitState: 'OPEN',
        retryAfter: expect.any(Number),
        suggestion: 'Please try again later or use a different model'
      });
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      // Wait for half-open timeout (simulated)
      circuitBreaker.forceHalfOpen('openai');
      
      const status = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(status.body.openai.state).toBe('HALF_OPEN');
    });

    it('should close circuit after successful requests in HALF_OPEN', async () => {
      // Set to HALF_OPEN
      circuitBreaker.forceHalfOpen('openai');
      
      // Make successful request
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Test recovery', model: 'basic' }) // Use basic to ensure success
        .expect(200);
      
      // Record success
      circuitBreaker.recordSuccess('openai');
      
      const status = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(status.body.openai.state).toBe('CLOSED');
    });
  });

  describe('Service-Specific Circuit Breakers', () => {
    it('should maintain separate circuits for different services', async () => {
      // Fail OpenAI service
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      // DataCloak should still work
      const datacloakStatus = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(datacloakStatus.body.openai.state).toBe('OPEN');
      expect(datacloakStatus.body.datacloak.state).toBe('CLOSED');
      
      // Basic sentiment should still work
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Test with basic', model: 'basic' })
        .expect(200);
      
      expect(response.body.data.model).toBe('basic');
    });

    it('should handle cascading failures gracefully', async () => {
      // Fail multiple services
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
        circuitBreaker.recordFailure('datacloak');
      }
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Test cascading failure', model: 'gpt-3.5-turbo' })
        .expect(503);
      
      expect(response.body).toMatchObject({
        error: 'Multiple services unavailable',
        unavailableServices: expect.arrayContaining(['openai', 'datacloak']),
        availableAlternatives: expect.arrayContaining(['basic'])
      });
    });
  });

  describe('Circuit Breaker Events and Monitoring', () => {
    it('should emit events on state changes', async (done) => {
      const events: any[] = [];
      
      eventEmitter.on('circuit-breaker:state-change', (event) => {
        events.push(event);
      });
      
      // Trigger state changes
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      setTimeout(() => {
        expect(events).toContainEqual(
          expect.objectContaining({
            service: 'openai',
            previousState: 'CLOSED',
            currentState: 'OPEN'
          })
        );
        done();
      }, 100);
    });

    it('should track circuit breaker metrics', async () => {
      // Generate some activity
      circuitBreaker.recordSuccess('openai');
      circuitBreaker.recordSuccess('openai');
      circuitBreaker.recordFailure('openai');
      
      const metrics = await request(app)
        .get('/api/v1/monitoring/circuit-breaker-metrics')
        .expect(200);
      
      expect(metrics.body.openai).toMatchObject({
        totalRequests: 3,
        successfulRequests: 2,
        failedRequests: 1,
        successRate: expect.closeTo(0.67, 2),
        avgResponseTime: expect.any(Number),
        lastStateChange: expect.any(String)
      });
    });
  });

  describe('Recovery Strategies', () => {
    it('should implement exponential backoff', async () => {
      circuitBreaker.recordFailure('openai');
      
      const response = await request(app)
        .get('/api/v1/monitoring/circuit-breakers/openai/backoff')
        .expect(200);
      
      expect(response.body).toMatchObject({
        currentBackoff: expect.any(Number),
        nextRetry: expect.any(String),
        attemptNumber: 1
      });
      
      // Record another failure
      circuitBreaker.recordFailure('openai');
      
      const response2 = await request(app)
        .get('/api/v1/monitoring/circuit-breakers/openai/backoff')
        .expect(200);
      
      // Backoff should increase
      expect(response2.body.currentBackoff).toBeGreaterThan(response.body.currentBackoff);
    });

    it('should support manual circuit reset', async () => {
      // Open circuit
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      // Admin reset
      await request(app)
        .post('/api/v1/admin/circuit-breakers/openai/reset')
        .set('Authorization', 'Basic ' + Buffer.from('admin:password').toString('base64'))
        .expect(200);
      
      const status = await request(app)
        .get('/api/v1/monitoring/circuit-breakers')
        .expect(200);
      
      expect(status.body.openai.state).toBe('CLOSED');
    });

    it('should implement gradual recovery', async () => {
      // Set to HALF_OPEN
      circuitBreaker.forceHalfOpen('openai');
      
      const requests = 10;
      let successCount = 0;
      
      // Send multiple requests
      for (let i = 0; i < requests; i++) {
        const response = await request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: `Gradual recovery test ${i}`, model: 'basic' })
          .expect((res) => {
            if (res.status === 200) successCount++;
          });
      }
      
      // Should allow some requests through
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(requests); // But not all
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should automatically fallback when circuit is open', async () => {
      // Open OpenAI circuit
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
      }
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test automatic fallback',
          model: 'gpt-3.5-turbo',
          allowFallback: true
        })
        .expect(200);
      
      expect(response.body.data.model).toBe('basic');
      expect(response.body.fallbackReason).toBe('Primary service circuit breaker open');
    });

    it('should chain fallbacks if multiple services fail', async () => {
      // Fail multiple services
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure('openai');
        circuitBreaker.recordFailure('gpt-4');
      }
      
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'Test chained fallback',
          model: 'gpt-4',
          fallbackChain: ['gpt-3.5-turbo', 'basic']
        })
        .expect(200);
      
      expect(response.body.data.model).toBe('basic');
      expect(response.body.fallbackChain).toEqual(['gpt-4', 'gpt-3.5-turbo', 'basic']);
    });
  });

  describe('Health Checks and Probes', () => {
    it('should perform health checks on circuits', async () => {
      const health = await request(app)
        .get('/api/v1/health/circuits')
        .expect(200);
      
      expect(health.body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        circuits: expect.objectContaining({
          openai: expect.objectContaining({
            state: expect.any(String),
            healthy: expect.any(Boolean),
            lastCheck: expect.any(String)
          })
        })
      });
    });

    it('should probe service availability', async () => {
      const probe = await request(app)
        .post('/api/v1/monitoring/circuit-breakers/openai/probe')
        .expect(200);
      
      expect(probe.body).toMatchObject({
        service: 'openai',
        available: expect.any(Boolean),
        responseTime: expect.any(Number),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Configuration and Tuning', () => {
    it('should allow circuit breaker configuration', async () => {
      const config = await request(app)
        .put('/api/v1/admin/circuit-breakers/config')
        .set('Authorization', 'Basic ' + Buffer.from('admin:password').toString('base64'))
        .send({
          service: 'openai',
          threshold: 10,
          timeout: 60000,
          resetTimeout: 120000
        })
        .expect(200);
      
      expect(config.body).toMatchObject({
        service: 'openai',
        threshold: 10,
        timeout: 60000,
        resetTimeout: 120000
      });
    });

    it('should support different thresholds per service', async () => {
      const config = await request(app)
        .get('/api/v1/monitoring/circuit-breakers/config')
        .expect(200);
      
      expect(config.body).toMatchObject({
        openai: {
          threshold: expect.any(Number),
          timeout: expect.any(Number)
        },
        datacloak: {
          threshold: expect.any(Number),
          timeout: expect.any(Number)
        }
      });
      
      // Different services can have different thresholds
      expect(config.body.openai.threshold).not.necessarily.toBe(config.body.datacloak.threshold);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle intermittent failures', async () => {
      let requestCount = 0;
      
      // Simulate intermittent failures (fail every 3rd request)
      process.env.SIMULATE_INTERMITTENT_ERROR = '3';
      
      const results = [];
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: `Intermittent test ${i}`, model: 'gpt-3.5-turbo' });
        
        results.push({
          success: response.status === 200,
          status: response.status
        });
      }
      
      // Circuit should eventually open
      const openRequests = results.filter(r => r.status === 503);
      expect(openRequests.length).toBeGreaterThan(0);
      
      delete process.env.SIMULATE_INTERMITTENT_ERROR;
    });

    it('should recover from temporary outages', async () => {
      // Simulate temporary outage
      process.env.SIMULATE_OUTAGE_DURATION = '5000'; // 5 seconds
      
      // Trigger circuit opening
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: 'Outage test', model: 'gpt-3.5-turbo' });
      }
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Should work again
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Recovery test', model: 'gpt-3.5-turbo' })
        .expect(200);
      
      expect(response.body.data).toBeDefined();
      
      delete process.env.SIMULATE_OUTAGE_DURATION;
    }, 10000);
  });
});