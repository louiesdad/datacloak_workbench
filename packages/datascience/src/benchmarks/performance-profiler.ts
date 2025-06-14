export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  peakMemoryUsage: number;
  cpuUsage?: number;
  throughput: number;
  operationsPerSecond: number;
}

export interface ProfiledExecution<T> {
  result: T;
  metrics: PerformanceMetrics;
  timestamp: string;
}

export interface BenchmarkProfile {
  name: string;
  iterations: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  stdDevExecutionTime: number;
  avgMemoryUsage: number;
  peakMemoryUsage: number;
  avgThroughput: number;
  totalOperations: number;
  successRate: number;
}

export class PerformanceProfiler {
  private static getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  static async profile<T>(
    operation: () => Promise<T> | T,
    operationCount: number = 1
  ): Promise<ProfiledExecution<T>> {
    const startTime = Date.now();
    const startMemory = this.getMemoryUsage();
    let peakMemory = startMemory;

    const memoryMonitor = setInterval(() => {
      const currentMemory = this.getMemoryUsage();
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 10);

    try {
      const result = await operation();
      const endTime = Date.now();
      const endMemory = this.getMemoryUsage();

      clearInterval(memoryMonitor);

      const executionTime = endTime - startTime;
      const memoryUsage = endMemory - startMemory;
      const throughput = operationCount / (executionTime / 1000);

      const metrics: PerformanceMetrics = {
        executionTime,
        memoryUsage,
        peakMemoryUsage: peakMemory - startMemory,
        throughput,
        operationsPerSecond: throughput
      };

      return {
        result,
        metrics,
        timestamp: new Date(startTime).toISOString()
      };
    } catch (error) {
      clearInterval(memoryMonitor);
      throw error;
    }
  }

  static async benchmark<T>(
    name: string,
    operation: () => Promise<T> | T,
    options: {
      iterations?: number;
      warmupIterations?: number;
      operationCount?: number;
      timeout?: number;
    } = {}
  ): Promise<BenchmarkProfile> {
    const {
      iterations = 10,
      warmupIterations = 3,
      operationCount = 1,
      timeout = 30000
    } = options;

    console.log(`Running benchmark: ${name}`);
    console.log(`Warmup iterations: ${warmupIterations}`);
    console.log(`Benchmark iterations: ${iterations}`);

    for (let i = 0; i < warmupIterations; i++) {
      try {
        await Promise.race([
          operation(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), timeout))
        ]);
      } catch (error) {
        console.warn(`Warmup iteration ${i + 1} failed:`, error);
      }
    }

    const results: ProfiledExecution<T>[] = [];
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        console.log(`Iteration ${i + 1}/${iterations}`);
        const result = await Promise.race([
          this.profile(operation, operationCount),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Benchmark timeout')), timeout)
          )
        ]);
        results.push(result);
        successCount++;
      } catch (error) {
        console.warn(`Iteration ${i + 1} failed:`, error);
      }
    }

    if (results.length === 0) {
      throw new Error(`All ${iterations} benchmark iterations failed`);
    }

    return this.calculateBenchmarkProfile(name, results, operationCount, successCount, iterations);
  }

  static async profileMemoryLeak<T>(
    operation: () => Promise<T> | T,
    iterations: number = 100,
    samplingInterval: number = 10
  ): Promise<{
    memoryGrowth: number;
    memoryTrend: Array<{ iteration: number; memory: number }>;
    leakDetected: boolean;
    recommendations: string[];
  }> {
    const memorySnapshots: Array<{ iteration: number; memory: number }> = [];
    let initialMemory: number | null = null;

    for (let i = 0; i < iterations; i++) {
      if (i % samplingInterval === 0) {
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const currentMemory = this.getMemoryUsage();
        if (initialMemory === null) {
          initialMemory = currentMemory;
        }
        
        memorySnapshots.push({ iteration: i, memory: currentMemory });
      }

      try {
        await operation();
      } catch (error) {
        console.warn(`Memory leak test iteration ${i} failed:`, error);
      }
    }

    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalMemory = this.getMemoryUsage();
    const memoryGrowth = finalMemory - (initialMemory || 0);
    
    const growthThreshold = 10; // MB
    const leakDetected = memoryGrowth > growthThreshold;

    const recommendations: string[] = [];
    if (leakDetected) {
      recommendations.push('Potential memory leak detected');
      recommendations.push('Review object references and event listeners');
      recommendations.push('Consider using WeakMap/WeakSet for caching');
      recommendations.push('Ensure proper cleanup in async operations');
    }

    return {
      memoryGrowth,
      memoryTrend: memorySnapshots,
      leakDetected,
      recommendations
    };
  }

  static comparePerformance(profiles: BenchmarkProfile[]): {
    fastest: BenchmarkProfile;
    slowest: BenchmarkProfile;
    mostMemoryEfficient: BenchmarkProfile;
    highestThroughput: BenchmarkProfile;
    rankings: Array<{ name: string; rank: number; score: number }>;
  } {
    if (profiles.length === 0) {
      throw new Error('No profiles to compare');
    }

    const fastest = profiles.reduce((min, profile) => 
      profile.avgExecutionTime < min.avgExecutionTime ? profile : min
    );

    const slowest = profiles.reduce((max, profile) => 
      profile.avgExecutionTime > max.avgExecutionTime ? profile : max
    );

    const mostMemoryEfficient = profiles.reduce((min, profile) => 
      profile.avgMemoryUsage < min.avgMemoryUsage ? profile : min
    );

    const highestThroughput = profiles.reduce((max, profile) => 
      profile.avgThroughput > max.avgThroughput ? profile : max
    );

    const rankings = profiles.map(profile => {
      const timeScore = 1 / profile.avgExecutionTime;
      const memoryScore = 1 / Math.max(profile.avgMemoryUsage, 0.1);
      const throughputScore = profile.avgThroughput;
      const reliabilityScore = profile.successRate;
      
      const score = (timeScore * 0.3) + (memoryScore * 0.2) + (throughputScore * 0.3) + (reliabilityScore * 0.2);
      
      return { name: profile.name, rank: 0, score };
    }).sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      fastest,
      slowest,
      mostMemoryEfficient,
      highestThroughput,
      rankings
    };
  }

  private static calculateBenchmarkProfile(
    name: string,
    results: ProfiledExecution<any>[],
    operationCount: number,
    successCount: number,
    totalIterations: number
  ): BenchmarkProfile {
    const executionTimes = results.map(r => r.metrics.executionTime);
    const memoryUsages = results.map(r => r.metrics.memoryUsage);
    const throughputs = results.map(r => r.metrics.throughput);

    const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const minExecutionTime = Math.min(...executionTimes);
    const maxExecutionTime = Math.max(...executionTimes);
    
    const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - avgExecutionTime, 2), 0) / executionTimes.length;
    const stdDevExecutionTime = Math.sqrt(variance);

    const avgMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    const peakMemoryUsage = Math.max(...results.map(r => r.metrics.peakMemoryUsage));
    const avgThroughput = throughputs.reduce((sum, tp) => sum + tp, 0) / throughputs.length;

    return {
      name,
      iterations: results.length,
      avgExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      stdDevExecutionTime,
      avgMemoryUsage,
      peakMemoryUsage,
      avgThroughput,
      totalOperations: results.length * operationCount,
      successRate: successCount / totalIterations
    };
  }
}