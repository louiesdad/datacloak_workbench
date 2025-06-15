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
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly intervalMs: number;
  // private requestQueue: Array<{
  //   resolve: (value: boolean) => void;
  //   timestamp: number;
  // }> = [];

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxBurst || options.maxRequests;
    this.tokens = this.maxTokens;
    this.refillRate = options.maxRequests / (options.intervalMs / 1000);
    this.intervalMs = options.intervalMs;
    this.lastRefill = Date.now();
  }

  /**
   * Check if a request can be made
   */
  async checkLimit(): Promise<RateLimitResult> {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return {
        allowed: true,
        tokensRemaining: Math.floor(this.tokens),
        resetsAt: new Date(this.lastRefill + this.intervalMs)
      };
    }

    // Calculate retry after
    const tokensNeeded = 1 - this.tokens;
    const retryAfter = Math.ceil((tokensNeeded / this.refillRate) * 1000);

    return {
      allowed: false,
      retryAfter,
      tokensRemaining: 0,
      resetsAt: new Date(this.lastRefill + this.intervalMs)
    };
  }

  /**
   * Wait for rate limit if necessary
   */
  async waitForLimit(): Promise<void> {
    const result = await this.checkLimit();
    
    if (!result.allowed && result.retryAfter) {
      await this.sleep(result.retryAfter);
      // Recursive call to check again after waiting
      await this.waitForLimit();
    }
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForLimit();
    return fn();
  }

  /**
   * Execute multiple requests with rate limiting
   */
  async executeBatch<T>(
    requests: Array<() => Promise<T>>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      const result = await this.execute(requests[i]);
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
  getStatus(): {
    tokensRemaining: number;
    maxTokens: number;
    refillRate: number;
    nextRefillIn: number;
  } {
    this.refillTokens();
    
    return {
      tokensRemaining: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      refillRate: this.refillRate,
      nextRefillIn: Math.max(0, this.intervalMs - (Date.now() - this.lastRefill))
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    // this.requestQueue = [];
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    
    if (elapsed > 0) {
      const tokensToAdd = (elapsed / 1000) * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
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
  return new RateLimiterService({
    maxRequests: 3,
    intervalMs: 1000,
    maxBurst: 5 // Allow small burst
  });
}

/**
 * Create a rate limiter for batch operations
 */
export function createBatchRateLimiter(
  requestsPerMinute: number = 60
): RateLimiterService {
  return new RateLimiterService({
    maxRequests: requestsPerMinute,
    intervalMs: 60000,
    maxBurst: Math.min(requestsPerMinute * 2, 100)
  });
}