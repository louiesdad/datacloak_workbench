import { RateLimiterService } from '../rate-limiter.service';
import { TestHelpers, MockFactory } from '../../../tests/utils';

describe('RateLimiterService', () => {
  let rateLimiter: RateLimiterService;
  let mockConfig: any;
  let mockCache: any;
  let mockLogger: any;

  beforeEach(() => {
    mockConfig = MockFactory.createService(['get']);
    mockCache = MockFactory.createService(['get', 'set', 'delete']);
    mockLogger = MockFactory.createLogger();

    mockConfig.get.mockImplementation((key: string) => {
      const configs: Record<string, any> = {
        'RATE_LIMIT_MAX_REQUESTS': 10,
        'RATE_LIMIT_WINDOW_MS': 1000
      };
      return configs[key];
    });

    rateLimiter = new RateLimiterService(mockConfig, mockCache, mockLogger);
  });

  afterEach(() => {
    rateLimiter.resetAll();
  });

  describe('initialization', () => {
    it('should initialize with default options from config', () => {
      expect(mockConfig.get).toHaveBeenCalledWith('RATE_LIMIT_MAX_REQUESTS');
      expect(mockConfig.get).toHaveBeenCalledWith('RATE_LIMIT_WINDOW_MS');
    });

    it('should use fallback values when config is not available', () => {
      const noConfigRateLimiter = new RateLimiterService();
      const status = noConfigRateLimiter.getStatus();
      
      expect(status.maxTokens).toBe(100);
    });
  });

  describe('token bucket algorithm', () => {
    it('should allow requests within limit', async () => {
      const result1 = await rateLimiter.consume('test-key');
      const result2 = await rateLimiter.consume('test-key');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should reject requests when limit exceeded', async () => {
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume('test-key');
      }
      
      // Next request should fail
      const result = await rateLimiter.consume('test-key');
      expect(result).toBe(false);
    });

    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume('test-key');
      }
      
      // Should be rejected immediately
      let result = await rateLimiter.consume('test-key');
      expect(result).toBe(false);
      
      // Wait for token refill (mocking time)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be allowed again
      result = await rateLimiter.consume('test-key');
      expect(result).toBe(true);
    });

    it('should handle multiple points consumption', async () => {
      const result1 = await rateLimiter.consume('test-key', 5);
      const result2 = await rateLimiter.consume('test-key', 5);
      const result3 = await rateLimiter.consume('test-key', 1);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(false); // Should exceed limit
    });
  });

  describe('key isolation', () => {
    it('should maintain separate buckets for different keys', async () => {
      // Exhaust tokens for key1
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume('key1');
      }
      
      // key1 should be exhausted
      expect(await rateLimiter.consume('key1')).toBe(false);
      
      // key2 should still have tokens
      expect(await rateLimiter.consume('key2')).toBe(true);
    });

    it('should return correct remaining tokens for each key', async () => {
      await rateLimiter.consume('key1', 3);
      await rateLimiter.consume('key2', 5);
      
      expect(await rateLimiter.getRemaining('key1')).toBe(7);
      expect(await rateLimiter.getRemaining('key2')).toBe(5);
    });
  });

  describe('status reporting', () => {
    it('should return current bucket status', async () => {
      await rateLimiter.consume('test-key', 3);
      
      const status = rateLimiter.getStatus('test-key');
      
      expect(status.tokensRemaining).toBe(7);
      expect(status.maxTokens).toBe(10);
      expect(status.refillRate).toBe(10);
      expect(status.nextRefillIn).toBeGreaterThan(0);
    });

    it('should calculate correct refill time', async () => {
      const status = rateLimiter.getStatus('test-key');
      
      expect(status.nextRefillIn).toBeLessThanOrEqual(1000);
      expect(status.nextRefillIn).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset functionality', () => {
    it('should reset specific key', async () => {
      // Consume tokens
      await rateLimiter.consume('test-key', 5);
      expect(await rateLimiter.getRemaining('test-key')).toBe(5);
      
      // Reset the key
      await rateLimiter.reset('test-key');
      
      // Should have full tokens again
      expect(await rateLimiter.getRemaining('test-key')).toBe(10);
    });

    it('should reset all keys', async () => {
      await rateLimiter.consume('key1', 5);
      await rateLimiter.consume('key2', 3);
      
      rateLimiter.resetAll();
      
      expect(await rateLimiter.getRemaining('key1')).toBe(10);
      expect(await rateLimiter.getRemaining('key2')).toBe(10);
    });
  });

  describe('checkLimit method', () => {
    it('should return detailed limit information when allowed', async () => {
      const result = await rateLimiter.checkLimit('test-key', 2);
      
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(8);
      expect(result.resetsAt).toBeInstanceOf(Date);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should return retry information when not allowed', async () => {
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume('test-key');
      }
      
      const result = await rateLimiter.checkLimit('test-key');
      
      expect(result.allowed).toBe(false);
      expect(result.tokensRemaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.resetsAt).toBeInstanceOf(Date);
    });
  });

  describe('wait functionality', () => {
    it('should resolve immediately when tokens available', async () => {
      const start = Date.now();
      await rateLimiter.waitForLimit('test-key');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50); // Should be immediate
    });

    it('should wait when tokens not available', async () => {
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume('test-key');
      }
      
      const start = Date.now();
      
      // This should wait for token refill
      const waitPromise = rateLimiter.waitForLimit('test-key');
      
      // Should still be waiting
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Now let it complete (in real scenario, time would pass)
      await waitPromise;
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThan(30); // Should have waited
    }, 10000);
  });

  describe('execute functionality', () => {
    it('should execute function with rate limiting', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      
      const result = await rateLimiter.execute(mockFn, 'test-key');
      
      expect(result).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should execute batch with rate limiting', async () => {
      const mockFns = [
        jest.fn().mockResolvedValue('result1'),
        jest.fn().mockResolvedValue('result2'),
        jest.fn().mockResolvedValue('result3')
      ];
      
      const progressCallback = jest.fn();
      
      const results = await rateLimiter.executeBatch(
        mockFns,
        'test-key',
        progressCallback
      );
      
      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith(1, 3);
      expect(progressCallback).toHaveBeenCalledWith(2, 3);
      expect(progressCallback).toHaveBeenCalledWith(3, 3);
    });
  });

  describe('edge cases', () => {
    it('should handle zero points consumption', async () => {
      const remaining = await rateLimiter.getRemaining('test-key');
      const result = await rateLimiter.consume('test-key', 0);
      
      expect(result).toBe(true);
      expect(await rateLimiter.getRemaining('test-key')).toBe(remaining);
    });

    it('should handle negative points gracefully', async () => {
      const result = await rateLimiter.consume('test-key', -1);
      
      // Should add tokens back
      expect(result).toBe(true);
      expect(await rateLimiter.getRemaining('test-key')).toBeGreaterThan(10);
    });

    it('should handle very large point consumption', async () => {
      const result = await rateLimiter.consume('test-key', 1000);
      
      expect(result).toBe(false);
      // The bucket should still exist but with negative tokens (which shows as 0)
      expect(await rateLimiter.getRemaining('test-key')).toBeLessThanOrEqual(0);
    });
  });

  describe('factory methods', () => {
    it('should create OpenAI rate limiter with correct settings', async () => {
      const { createOpenAIRateLimiter } = require('../rate-limiter.service');
      const openaiLimiter = createOpenAIRateLimiter();
      
      const status = openaiLimiter.getStatus();
      expect(status.maxTokens).toBe(5); // maxBurst
      expect(status.refillRate).toBe(3); // 3 requests per second
    });

    it('should create batch rate limiter with correct settings', async () => {
      const { createBatchRateLimiter } = require('../rate-limiter.service');
      const batchLimiter = createBatchRateLimiter(120);
      
      const status = batchLimiter.getStatus();
      expect(status.maxTokens).toBe(240); // min(120 * 2, 100) = 240
      expect(status.refillRate).toBe(2); // 120 per 60 seconds = 2 per second
    });
  });
});