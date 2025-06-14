import { PerformanceProfiler } from '../benchmarks/performance-profiler';

describe('PerformanceProfiler Additional Tests', () => {
  describe('Profile Operations', () => {
    test('profiles operation with operation count', async () => {
      const operation = () => {
        return Array.from({ length: 100 }, (_, i) => i * 2);
      };

      const result = await PerformanceProfiler.profile(operation, 100);

      expect(result.result).toHaveLength(100);
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
      expect(result.metrics.operationsPerSecond).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    test('profiles async operation', async () => {
      const asyncOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async result';
      };

      const result = await PerformanceProfiler.profile(asyncOperation, 1);

      expect(result.result).toBe('async result');
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(50);
    });

    test('handles operation errors', async () => {
      const failingOperation = () => {
        throw new Error('Test error');
      };

      await expect(PerformanceProfiler.profile(failingOperation)).rejects.toThrow('Test error');
    });
  });

  describe('Benchmark with Configuration', () => {
    test('runs benchmark with custom iterations', async () => {
      const operation = () => Math.random();

      const profile = await PerformanceProfiler.benchmark(
        'random-test',
        operation,
        { 
          iterations: 3, 
          warmupIterations: 1,
          operationCount: 1,
          timeout: 5000 
        }
      );

      expect(profile.name).toBe('random-test');
      expect(profile.iterations).toBe(3);
      expect(profile.avgExecutionTime).toBeGreaterThan(0);
      expect(profile.successRate).toBe(1.0);
    });

    test('handles benchmark with failures', async () => {
      let callCount = 0;
      const flakyOperation = () => {
        callCount++;
        if (callCount <= 1) {
          throw new Error('Flaky error');
        }
        return 'success';
      };

      const profile = await PerformanceProfiler.benchmark(
        'flaky-test',
        flakyOperation,
        { iterations: 3, warmupIterations: 0 }
      );

      expect(profile.successRate).toBeLessThan(1.0);
      expect(profile.iterations).toBeLessThan(3);
    });
  });

  describe('Performance Comparison', () => {
    test('compares multiple profiles', async () => {
      const fastOp = () => 1 + 1;
      const slowOp = () => {
        const arr = Array.from({ length: 1000 }, (_, i) => i);
        return arr.reduce((sum, n) => sum + n, 0);
      };

      const fastProfile = await PerformanceProfiler.benchmark('fast', fastOp, { iterations: 2 });
      const slowProfile = await PerformanceProfiler.benchmark('slow', slowOp, { iterations: 2 });

      const comparison = PerformanceProfiler.comparePerformance([fastProfile, slowProfile]);

      expect(comparison.fastest.name).toBe('fast');
      expect(comparison.slowest.name).toBe('slow');
      expect(comparison.rankings).toHaveLength(2);
      expect(comparison.rankings[0].rank).toBe(1);
      expect(comparison.rankings[1].rank).toBe(2);
    });

    test('handles empty profiles array', () => {
      expect(() => {
        PerformanceProfiler.comparePerformance([]);
      }).toThrow('No profiles to compare');
    });
  });

  describe('Memory Profiling', () => {
    test('profiles memory usage', async () => {
      const memoryIntensiveOp = () => {
        const data = Array.from({ length: 100 }, (_, i) => ({ 
          id: i, 
          data: 'x'.repeat(50) 
        }));
        return data.length;
      };

      const memoryProfile = await PerformanceProfiler.profileMemoryLeak(
        memoryIntensiveOp,
        5, // iterations
        2  // sampling interval
      );

      expect(memoryProfile.memoryTrend.length).toBeGreaterThan(0);
      expect(memoryProfile.recommendations).toBeDefined();
      expect(typeof memoryProfile.leakDetected).toBe('boolean');
      expect(memoryProfile.memoryGrowth).toBeGreaterThanOrEqual(0);
    });

    test('handles memory profiling with small iterations', async () => {
      const simpleOp = () => 'test';

      const memoryProfile = await PerformanceProfiler.profileMemoryLeak(
        simpleOp,
        2, // Small number
        1
      );

      expect(memoryProfile.memoryTrend.length).toBeGreaterThanOrEqual(0);
      expect(memoryProfile.leakDetected).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles zero operation count', async () => {
      const operation = () => 'test';

      const result = await PerformanceProfiler.profile(operation, 0);

      expect(result.metrics.throughput).toBeGreaterThanOrEqual(0);
    });

    test('profiles operation with no return value', async () => {
      const voidOperation = () => {
        // No return
      };

      const result = await PerformanceProfiler.profile(voidOperation, 1);

      expect(result.result).toBeUndefined();
      expect(result.metrics.executionTime).toBeGreaterThan(0);
    });
  });
});