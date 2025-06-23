import { resetServices } from '../src/tests/utils/integration-helpers';

// Longer timeout for integration tests
jest.setTimeout(30000);

// Reset services before each integration test
beforeEach(async () => {
  await resetServices();
});

// Ensure all connections are closed after integration tests
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Force close any remaining connections
  const { closeSQLiteConnection } = await import('../src/database');
  await closeSQLiteConnection();
  
  // Close Redis connections
  const { getCacheService } = await import('../src/services/cache.service');
  const cacheService = getCacheService();
  cacheService.shutdown();
});

// Add custom matchers for integration tests
expect.extend({
  async toEventuallyEqual(received: () => any, expected: any, timeout: number = 5000) {
    const startTime = Date.now();
    let lastValue: any;
    
    while (Date.now() - startTime < timeout) {
      try {
        lastValue = await received();
        if (this.equals(lastValue, expected)) {
          return {
            pass: true,
            message: () => `expected ${this.utils.printReceived(lastValue)} not to eventually equal ${this.utils.printExpected(expected)}`
          };
        }
      } catch (error) {
        // Continue trying
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return {
      pass: false,
      message: () => `expected ${this.utils.printReceived(lastValue)} to eventually equal ${this.utils.printExpected(expected)} within ${timeout}ms`
    };
  }
});

// Declare the custom matcher type
declare global {
  namespace jest {
    interface Matchers<R> {
      toEventuallyEqual(expected: any, timeout?: number): Promise<R>;
    }
  }
}