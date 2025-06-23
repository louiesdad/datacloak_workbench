/**
 * Rate Limiter Service
 * Implements token bucket algorithm for rate limiting
 */

export interface RateLimiterOptions {
  maxRequests: number;     // Maximum requests per interval
  intervalMs: number;      // Interval in milliseconds
  maxBurst?: number;       // Maximum burst capacity (defaults to maxRequests)
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;     // Milliseconds until next request can be made
  tokensRemaining: number;
  resetsAt: Date;
}

export class RateLimiterService {
  private buckets = new Map<string, {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number;
    intervalMs: number;
  }>();
  
  private defaultOptions: RateLimiterOptions;

  constructor(config?: any, cache?: any, logger?: any) {
    this.defaultOptions = {
      maxRequests: config?.get('RATE_LIMIT_MAX_REQUESTS') || 100,
      intervalMs: config?.get('RATE_LIMIT_WINDOW_MS') || 60000
    };
  }

  private getBucket(key: string, options?: RateLimiterOptions) {
    const opts = options || this.defaultOptions;
    
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: opts.maxBurst || opts.maxRequests,
        lastRefill: Date.now(),
        maxTokens: opts.maxBurst || opts.maxRequests,
        refillRate: opts.maxRequests / (opts.intervalMs / 1000),
        intervalMs: opts.intervalMs
      });
    }
    
    return this.buckets.get(key)!;
  }

  /**
   * Consume points from the rate limiter
   */
  async consume(key: string, points: number = 1): Promise<boolean> {
    const result = await this.checkLimit(key, points);
    return result.allowed;
  }

  /**
   * Reset the rate limiter for a specific key
   */
  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  /**
   * Get remaining points for a key
   */
  async getRemaining(key: string): Promise<number> {
    const bucket = this.getBucket(key);
    this.refillTokens(bucket);
    return Math.max(0, Math.floor(bucket.tokens));
  }

  /**
   * Check if a request can be made
   */
  async checkLimit(key: string = 'default', points: number = 1): Promise<RateLimitResult> {
    const bucket = this.getBucket(key);
    this.refillTokens(bucket);

    if (bucket.tokens >= points) {
      bucket.tokens -= points;
      return {
        allowed: true,
        tokensRemaining: Math.floor(bucket.tokens),
        resetsAt: new Date(bucket.lastRefill + bucket.intervalMs)
      };
    }

    // Calculate retry after
    const tokensNeeded = points - bucket.tokens;
    const retryAfter = Math.ceil((tokensNeeded / bucket.refillRate) * 1000);

    return {
      allowed: false,
      retryAfter,
      tokensRemaining: 0,
      resetsAt: new Date(bucket.lastRefill + bucket.intervalMs)
    };
  }

  /**
   * Wait for rate limit if necessary
   */
  async waitForLimit(key: string = 'default'): Promise<void> {
    const result = await this.checkLimit(key);
    
    if (!result.allowed && result.retryAfter) {
      await this.sleep(result.retryAfter);
      // Recursive call to check again after waiting
      await this.waitForLimit(key);
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>, key: string = 'default'): Promise<T> {
    await this.waitForLimit(key);
    return fn();
  }

  /**
   * Execute multiple requests with rate limiting
   */
  async executeBatch<T>(
    requests: Array<() => Promise<T>>,
    key: string = 'default',
    onProgress?: (completed: number, total: number) => void
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      const result = await this.execute(requests[i], key);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, requests.length);
      }
    }
    
    return results;
  }

  /**
   * Get current rate limit status
   */
  getStatus(key: string = 'default'): {
    tokensRemaining: number;
    maxTokens: number;
    refillRate: number;
    nextRefillIn: number;
  } {
    const bucket = this.getBucket(key);
    this.refillTokens(bucket);
    
    return {
      tokensRemaining: Math.floor(bucket.tokens),
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
      nextRefillIn: Math.max(0, bucket.intervalMs - (Date.now() - bucket.lastRefill))
    };
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(bucket: any): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    
    if (elapsed > 0) {
      const tokensToAdd = (elapsed / 1000) * bucket.refillRate;
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a rate limiter for OpenAI API (3 requests per second)
 */
export function createOpenAIRateLimiter(): RateLimiterService {
  const service = new RateLimiterService();
  (service as any).defaultOptions = {
    maxRequests: 3,
    intervalMs: 1000,
    maxBurst: 5 // Allow small burst
  };
  return service;
}

/**
 * Create a rate limiter for batch operations
 */
export function createBatchRateLimiter(
  requestsPerMinute: number = 60
): RateLimiterService {
  const service = new RateLimiterService();
  (service as any).defaultOptions = {
    maxRequests: requestsPerMinute,
    intervalMs: 60000,
    maxBurst: Math.min(requestsPerMinute * 2, 100)
  };
  return service;
}