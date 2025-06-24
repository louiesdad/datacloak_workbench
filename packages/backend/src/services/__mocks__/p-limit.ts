/**
 * Mock for p-limit module
 * 
 * p-limit v6+ is ESM-only and causes issues with Jest/CommonJS.
 * This mock provides the same API for testing purposes.
 */

export interface LimitFunction {
  <Arguments extends readonly unknown[], ReturnType>(
    fn: (...arguments_: Arguments) => PromiseLike<ReturnType> | ReturnType,
    ...arguments_: Arguments
  ): Promise<ReturnType>;
  
  activeCount: number;
  pendingCount: number;
  clearQueue(): void;
}

/**
 * Create a mock concurrency limiter that mimics p-limit behavior
 */
function createPLimitMock(concurrency: number): LimitFunction {
  let activeCount = 0;
  let pendingCount = 0;
  const queue: Array<() => void> = [];

  const limit = async <Arguments extends readonly unknown[], ReturnType>(
    fn: (...arguments_: Arguments) => PromiseLike<ReturnType> | ReturnType,
    ...arguments_: Arguments
  ): Promise<ReturnType> => {
    return new Promise<ReturnType>((resolve, reject) => {
      const runTask = async () => {
        activeCount++;
        try {
          const result = await fn(...arguments_);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          // Process next task in queue
          if (queue.length > 0) {
            const nextTask = queue.shift();
            nextTask?.();
          }
        }
      };

      if (activeCount < concurrency) {
        // Can run immediately
        runTask();
      } else {
        // Add to queue
        pendingCount++;
        queue.push(() => {
          pendingCount--;
          runTask();
        });
      }
    });
  };

  // Add properties to match p-limit API
  Object.defineProperty(limit, 'activeCount', {
    get: () => activeCount
  });

  Object.defineProperty(limit, 'pendingCount', {
    get: () => pendingCount
  });

  limit.clearQueue = () => {
    queue.length = 0;
    pendingCount = 0;
  };

  return limit as LimitFunction;
}

// Default export matches p-limit's API
export default createPLimitMock;