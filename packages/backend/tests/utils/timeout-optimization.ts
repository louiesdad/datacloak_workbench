/**
 * Test Timeout Optimization Utilities
 * 
 * Provides utilities to optimize test execution time by reducing
 * unnecessary waits and improving async operation handling
 */

/**
 * Environment-aware timeout values
 */
export const TEST_TIMEOUTS = {
  // Short timeouts for fast operations
  IMMEDIATE: process.env.CI ? 50 : 10,
  SHORT: process.env.CI ? 100 : 50,
  
  // Medium timeouts for async operations
  MEDIUM: process.env.CI ? 500 : 200,
  ASYNC_OPERATION: process.env.CI ? 1000 : 500,
  
  // Long timeouts for complex operations
  LONG: process.env.CI ? 2000 : 1000,
  DATABASE: process.env.CI ? 3000 : 1500,
  
  // Network timeouts
  NETWORK: process.env.CI ? 5000 : 2000,
  API_CALL: process.env.CI ? 3000 : 1000,
  
  // Special cases
  CIRCUIT_BREAKER_RESET: process.env.CI ? 200 : 100,
  RATE_LIMIT_WINDOW: process.env.CI ? 200 : 100,
  CACHE_EXPIRY: process.env.CI ? 200 : 100,
  JOB_COMPLETION: process.env.CI ? 2000 : 1000,
} as const;

/**
 * Wait for a condition to be true with polling
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    timeout = TEST_TIMEOUTS.ASYNC_OPERATION,
    interval = TEST_TIMEOUTS.IMMEDIATE,
    errorMessage = 'Condition was not met within timeout'
  } = options;

  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`${errorMessage} (timeout: ${timeout}ms)`);
}

/**
 * Fast-forward time for testing time-dependent operations
 */
export class TimeController {
  private timers: NodeJS.Timeout[] = [];
  
  /**
   * Execute a function and immediately flush all timers
   */
  async fastForward<T>(fn: () => T | Promise<T>): Promise<T> {
    const result = fn();
    
    // If using fake timers, advance them
    if (jest.isMockFunction(setTimeout)) {
      jest.runAllTimers();
    }
    
    return result;
  }
  
  /**
   * Replace setTimeout with immediate execution in tests
   */
  mockDelays(): void {
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      setImmediate(callback);
      return {} as NodeJS.Timeout;
    });
  }
  
  /**
   * Restore normal setTimeout behavior
   */
  restoreDelays(): void {
    (global.setTimeout as jest.Mock).mockRestore();
  }
}

/**
 * Optimize promise operations for tests
 */
export class PromiseOptimizer {
  /**
   * Wait for all promises with a timeout
   */
  static async allWithTimeout<T>(
    promises: Promise<T>[],
    timeout: number = TEST_TIMEOUTS.ASYNC_OPERATION
  ): Promise<T[]> {
    return Promise.race([
      Promise.all(promises),
      new Promise<T[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Promise.all timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }
  
  /**
   * Race with timeout
   */
  static async raceWithTimeout<T>(
    promise: Promise<T>,
    timeout: number = TEST_TIMEOUTS.ASYNC_OPERATION
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Promise timeout after ${timeout}ms`)), timeout)
      )
    ]);
  }
}

/**
 * Mock slow operations for faster tests
 */
export class OperationMocker {
  /**
   * Mock database operations with fast responses
   */
  static mockDatabaseOperations(): void {
    // Mock slow database operations
    jest.spyOn(require('better-sqlite3').prototype, 'prepare').mockImplementation(() => ({
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: jest.fn().mockReturnValue({}),
      all: jest.fn().mockReturnValue([])
    }));
  }
  
  /**
   * Mock network operations with fast responses
   */
  static mockNetworkOperations(): void {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        status: 200
      })
    );
  }
  
  /**
   * Mock file system operations
   */
  static mockFileOperations(): void {
    const fs = require('fs');
    jest.spyOn(fs, 'readFile').mockImplementation((path, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      setImmediate(() => callback(null, Buffer.from('test data')));
    });
    
    jest.spyOn(fs, 'writeFile').mockImplementation((path, data, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
      }
      setImmediate(() => callback(null));
    });
  }
}

/**
 * Test performance helpers
 */
export class TestPerformance {
  private static startTimes = new Map<string, number>();
  
  /**
   * Start timing a test operation
   */
  static start(label: string): void {
    this.startTimes.set(label, Date.now());
  }
  
  /**
   * End timing and log if too slow
   */
  static end(label: string, warnThreshold: number = 1000): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      console.warn(`No start time found for label: ${label}`);
      return 0;
    }
    
    const duration = Date.now() - startTime;
    this.startTimes.delete(label);
    
    if (duration > warnThreshold) {
      console.warn(`⚠️  Slow test operation "${label}": ${duration}ms (threshold: ${warnThreshold}ms)`);
    }
    
    return duration;
  }
  
  /**
   * Measure async operation time
   */
  static async measure<T>(
    label: string,
    operation: () => Promise<T>,
    warnThreshold?: number
  ): Promise<T> {
    this.start(label);
    try {
      const result = await operation();
      this.end(label, warnThreshold);
      return result;
    } catch (error) {
      this.end(label, warnThreshold);
      throw error;
    }
  }
}

/**
 * Batch test operations for efficiency
 */
export class TestBatcher {
  /**
   * Run multiple test setups in parallel
   */
  static async setupAll<T extends Record<string, () => Promise<any>>>(
    setups: T
  ): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
    const entries = Object.entries(setups);
    const results = await Promise.all(
      entries.map(([key, setup]) => setup().then(result => [key, result]))
    );
    
    return Object.fromEntries(results) as any;
  }
  
  /**
   * Clean up multiple resources in parallel
   */
  static async cleanupAll(cleanups: Array<() => Promise<void>>): Promise<void> {
    await Promise.all(cleanups.map(cleanup => 
      cleanup().catch(error => 
        console.error('Cleanup error:', error)
      )
    ));
  }
}

/**
 * Optimize test suites
 */
export function optimizeTestSuite(): void {
  // Use fake timers for faster execution
  beforeAll(() => {
    jest.useFakeTimers();
  });
  
  afterAll(() => {
    jest.useRealTimers();
  });
  
  // Clear timers after each test
  afterEach(() => {
    jest.clearAllTimers();
  });
}

/**
 * Skip slow tests in fast mode
 */
export function skipSlowTests(): void {
  const isQuickMode = process.env.QUICK_TEST === 'true';
  
  global.slowTest = isQuickMode ? test.skip : test;
  global.slowDescribe = isQuickMode ? describe.skip : describe;
}

// Type augmentation for slow test helpers
declare global {
  var slowTest: jest.It;
  var slowDescribe: jest.Describe;
}