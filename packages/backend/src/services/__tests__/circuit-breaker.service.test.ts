import { 
  CircuitBreaker, 
  CircuitBreakerManager, 
  CircuitState, 
  WithCircuitBreaker,
  circuitBreakerManager 
} from '../circuit-breaker.service';
import { AppError } from '../../middleware/error.middleware';

// Mock logger
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  
  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100,
      resetTimeout: 1000,
      volumeThreshold: 5,
      errorThresholdPercentage: 50
    });
  });

  afterEach(() => {
    breaker.reset();
  });

  describe('Basic functionality', () => {
    it('should start in CLOSED state', () => {
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it('should execute successful function calls', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
      
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.successes).toBe(1);
    });

    it('should handle function failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('failure'));
      
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(1);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it('should handle timeouts', async () => {
      const fn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );
      
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker timeout');
      
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(1);
    });
  });

  describe('State transitions', () => {
    it('should transition to OPEN after consecutive failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('failure'));
      
      // Fail 3 times (failureThreshold)
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('failure');
      }
      
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.nextAttempt).toBeDefined();
    });

    it('should fail fast when circuit is OPEN', async () => {
      breaker.forceOpen();
      const fn = jest.fn().mockResolvedValue('success');
      
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Create breaker with short reset timeout
      const fastBreaker = new CircuitBreaker('fast-breaker', {
        failureThreshold: 1,
        resetTimeout: 100
      });
      
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');
      
      // Fail once to open circuit
      await expect(fastBreaker.execute(fn)).rejects.toThrow('failure');
      expect(fastBreaker.getMetrics().state).toBe(CircuitState.OPEN);
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should transition to HALF_OPEN and try again
      const result = await fastBreaker.execute(fn);
      expect(result).toBe('success');
      expect(fastBreaker.getMetrics().state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after success threshold in HALF_OPEN', async () => {
      breaker.forceOpen();
      
      // Wait to allow transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const fn = jest.fn().mockResolvedValue('success');
      
      // Need 2 successes (successThreshold)
      await breaker.execute(fn);
      expect(breaker.getMetrics().state).toBe(CircuitState.HALF_OPEN);
      
      await breaker.execute(fn);
      expect(breaker.getMetrics().state).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in HALF_OPEN', async () => {
      breaker.forceOpen();
      
      // Wait to allow transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const fn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValue(new Error('failure'));
      
      // One success
      await breaker.execute(fn);
      expect(breaker.getMetrics().state).toBe(CircuitState.HALF_OPEN);
      
      // Then failure - should reopen
      await expect(breaker.execute(fn)).rejects.toThrow('failure');
      expect(breaker.getMetrics().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Error percentage threshold', () => {
    it('should open circuit based on error percentage', async () => {
      const fn = jest.fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValue(new Error('failure'));
      
      // 2 successes, 3 failures = 60% error rate (> 50% threshold)
      // But need minimum 5 requests (volumeThreshold)
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(fn);
        } catch (e) {
          // Expected failures
        }
      }
      
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.OPEN);
      expect(metrics.errorPercentage).toBe(60);
    });
  });

  describe('Fallback function', () => {
    it('should use fallback when circuit is OPEN', async () => {
      const fallback = jest.fn().mockResolvedValue('fallback result');
      const breakerWithFallback = new CircuitBreaker('fallback-breaker', {
        failureThreshold: 1,
        fallbackFunction: fallback
      });
      
      const fn = jest.fn().mockRejectedValue(new Error('failure'));
      
      // Open circuit
      await expect(breakerWithFallback.execute(fn)).rejects.toThrow('failure');
      
      // Should use fallback
      const result = await breakerWithFallback.execute(fn);
      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('Manual controls', () => {
    it('should allow manual open', () => {
      breaker.forceOpen();
      expect(breaker.getMetrics().state).toBe(CircuitState.OPEN);
    });

    it('should allow manual close', () => {
      breaker.forceOpen();
      breaker.forceClose();
      expect(breaker.getMetrics().state).toBe(CircuitState.CLOSED);
    });

    it('should reset all metrics', () => {
      breaker.forceOpen();
      breaker.reset();
      
      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(metrics.totalRequests).toBe(0);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = CircuitBreakerManager.getInstance();
    // Clear all breakers to ensure test isolation
    const allMetrics = manager.getAllMetrics();
    Object.keys(allMetrics).forEach(key => manager.removeBreaker(key));
  });

  it('should be a singleton', () => {
    const manager2 = CircuitBreakerManager.getInstance();
    expect(manager).toBe(manager2);
  });

  it('should create and return breakers', () => {
    const breaker1 = manager.getBreaker('service1');
    const breaker2 = manager.getBreaker('service1');
    
    expect(breaker1).toBe(breaker2);
  });

  it('should create breakers with custom options', () => {
    const breaker = manager.getBreaker('custom', {
      failureThreshold: 10,
      timeout: 5000
    });
    
    const metrics = breaker.getMetrics();
    expect(metrics.state).toBe(CircuitState.CLOSED);
  });

  it('should get all metrics', () => {
    manager.getBreaker('service1');
    manager.getBreaker('service2');
    
    const allMetrics = manager.getAllMetrics();
    expect(Object.keys(allMetrics)).toEqual(['service1', 'service2']);
    expect(allMetrics.service1.state).toBe(CircuitState.CLOSED);
    expect(allMetrics.service2.state).toBe(CircuitState.CLOSED);
  });

  it('should reset all breakers', () => {
    const breaker1 = manager.getBreaker('service1');
    const breaker2 = manager.getBreaker('service2');
    
    breaker1.forceOpen();
    breaker2.forceOpen();
    
    manager.resetAll();
    
    expect(breaker1.getMetrics().state).toBe(CircuitState.CLOSED);
    expect(breaker2.getMetrics().state).toBe(CircuitState.CLOSED);
  });

  it('should remove breakers', () => {
    manager.getBreaker('temp');
    manager.removeBreaker('temp');
    
    const allMetrics = manager.getAllMetrics();
    expect(Object.keys(allMetrics)).not.toContain('temp');
  });
});

describe('WithCircuitBreaker decorator', () => {
  class TestService {
    callCount = 0;

    @WithCircuitBreaker('test-method', { failureThreshold: 2 })
    async successMethod(): Promise<string> {
      this.callCount++;
      return 'success';
    }

    @WithCircuitBreaker('test-method', { failureThreshold: 2 })
    async failureMethod(): Promise<string> {
      this.callCount++;
      throw new Error('method failure');
    }

    @WithCircuitBreaker('test-method', { failureThreshold: 1, timeout: 50 })
    async slowMethod(): Promise<string> {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'slow';
    }
  }

  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    circuitBreakerManager.resetAll();
  });

  it('should wrap successful methods', async () => {
    const result = await service.successMethod();
    expect(result).toBe('success');
    expect(service.callCount).toBe(1);
  });

  it('should wrap failing methods', async () => {
    await expect(service.failureMethod()).rejects.toThrow('method failure');
    await expect(service.failureMethod()).rejects.toThrow('method failure');
    
    // Circuit should be open now
    await expect(service.failureMethod()).rejects.toThrow('Circuit breaker is OPEN');
    expect(service.callCount).toBe(2); // Not called the third time
  });

  it('should handle timeouts in decorated methods', async () => {
    await expect(service.slowMethod()).rejects.toThrow('Circuit breaker timeout');
    
    // Circuit should be open after one timeout (failureThreshold: 1)
    await expect(service.slowMethod()).rejects.toThrow('Circuit breaker is OPEN');
  });
});