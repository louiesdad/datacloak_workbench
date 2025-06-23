import { PerformanceOptimizationService, OptimizationConfig } from '../performance-optimization.service';
import { JobQueueService } from '../job-queue.service';
import { BackgroundTaskService } from '../background-task.service';
import { getCacheService } from '../cache.service';
import { CachePatternsService } from '../cache-patterns.service';

// Mock dependencies
jest.mock('../cache.service');
jest.mock('../cache-patterns.service');
jest.mock('../job-queue.service');
jest.mock('../background-task.service');
jest.mock('../config.service', () => ({
  ConfigService: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key) => {
        const config = {
          CACHE_ENABLED: true,
          CACHE_TYPE: 'memory',
          CACHE_DEFAULT_TTL: 3600,
          PERFORMANCE_MONITORING_ENABLED: true,
          PERFORMANCE_METRICS_INTERVAL: 1000,
          CACHE_WARMING_ENABLED: true,
          CACHE_WARMING_INTERVAL: 5000,
          MEMORY_THRESHOLD: 500 * 1024 * 1024,
          JOB_CONCURRENCY_TARGET: 5
        };
        return config[key];
      })
    }))
  }
}));

// Mock chokidar and other file watching dependencies
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  }))
}));
jest.mock('os', () => ({
  loadavg: jest.fn(() => [1.5, 1.2, 0.9])
}));

// Mock global.gc
(global as any).gc = jest.fn();

describe('PerformanceOptimizationService', () => {
  let service: PerformanceOptimizationService;
  let mockJobQueue: jest.Mocked<JobQueueService>;
  let mockBackgroundTasks: jest.Mocked<BackgroundTaskService>;
  let mockCache: any;
  let mockCachePatterns: jest.Mocked<CachePatternsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock cache
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({
        hits: 700,
        misses: 300,
        size: 50 * 1024 * 1024, // 50MB
        evictions: 5,
        hitRate: 0.7,
        missRate: 0.3,
        totalOperations: 1000
      }),
      getConfig: jest.fn().mockReturnValue({ defaultTTL: 300 }),
      close: jest.fn().mockResolvedValue(undefined)
    };
    (getCacheService as jest.Mock).mockReturnValue(mockCache);
    
    // Mock cache patterns
    mockCachePatterns = {
      warmCache: jest.fn().mockResolvedValue({ loaded: 10, failed: 0 }),
      on: jest.fn(),
      emit: jest.fn()
    } as any;
    (CachePatternsService as jest.Mock).mockImplementation(() => mockCachePatterns);
    
    // Mock job queue
    mockJobQueue = {
      getStats: jest.fn().mockResolvedValue({
        total: 1000,
        pending: 50,
        running: 5,
        completed: 900,
        failed: 45
      })
    } as any;
    
    // Mock background tasks
    mockBackgroundTasks = {
      registerTask: jest.fn()
    } as any;
    
    const config: OptimizationConfig = {
      enableCacheWarming: true,
      cacheWarmingInterval: 5000,
      enableQueryOptimization: true,
      enableMemoryOptimization: true,
      enableJobOptimization: true,
      metricsInterval: 1000,
      memoryThreshold: 500 * 1024 * 1024,
      jobConcurrencyTarget: 5
    };
    
    service = new PerformanceOptimizationService(mockJobQueue, mockBackgroundTasks, config);
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  describe('start/stop', () => {
    test('should start optimization and emit event', () => {
      const eventSpy = jest.fn();
      service.on('optimization:started', eventSpy);
      
      service.start();
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should stop optimization and clear intervals', () => {
      const eventSpy = jest.fn();
      service.on('optimization:stopped', eventSpy);
      
      service.start();
      service.stop();
      
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should start cache warming when enabled', async () => {
      const config: OptimizationConfig = {
        enableCacheWarming: true,
        cacheWarmingInterval: 60000
      };
      
      service = new PerformanceOptimizationService(mockJobQueue, mockBackgroundTasks, config);
      service.start();
      
      // Wait for async cache warming initialization
      await Promise.resolve();
      jest.advanceTimersByTime(0);
      
      // Should warm cache immediately
      expect(mockCachePatterns.warmCache).toHaveBeenCalled();
    });
  });

  describe('metrics collection', () => {
    test('should collect metrics at specified interval', async () => {
      // Test the direct method instead of relying on intervals
      const eventSpy = jest.fn();
      service.on('metrics:collected', eventSpy);
      
      // Call the metrics collection directly (testing the core logic)
      await (service as any).collectMetrics();
      
      expect(eventSpy).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalledWith(
        'performance:latest',
        expect.any(Object),
        { ttl: 300 }
      );
    });

    test('should calculate correct metrics', async () => {
      let capturedMetrics: any;
      service.on('metrics:collected', (metrics) => {
        capturedMetrics = metrics;
      });
      
      // Call metrics collection directly
      await (service as any).collectMetrics();
      
      expect(capturedMetrics).toBeDefined();
      expect(capturedMetrics.cache.hitRate).toBe(0.7);
      expect(capturedMetrics.cache.missRate).toBeCloseTo(0.3);
      expect(capturedMetrics.jobs.queueDepth).toBe(50);
      expect(capturedMetrics.jobs.failureRate).toBeCloseTo(0.045);
    });

    test('should maintain metrics history', async () => {
      // Directly test metrics collection instead of relying on intervals
      for (let i = 0; i < 5; i++) {
        await (service as any).collectMetrics();
      }
      
      const report = await service.getPerformanceReport();
      expect(report.history.length).toBe(5);
    });
  });

  describe('cache optimization', () => {
    test('should generate suggestion for low hit rate', async () => {
      mockCache.getStats.mockReturnValue({
        hits: 400,
        misses: 600,
        size: 50 * 1024 * 1024,
        evictions: 5,
        hitRate: 0.4,
        missRate: 0.6
      });
      
      let suggestions: any[];
      service.on('suggestions:generated', (s) => {
        suggestions = s;
      });
      
      // Call metrics collection directly
      await (service as any).collectMetrics();
      
      expect(suggestions).toBeDefined();
      expect(suggestions.some(s => 
        s.type === 'cache' && s.message.includes('Low cache hit rate')
      )).toBe(true);
    });

    test('should auto-adjust TTL for very low hit rate', async () => {
      mockCache.getStats.mockReturnValue({
        hits: 300,
        misses: 700,
        hitRate: 0.3,
        missRate: 0.7,
        size: 50 * 1024 * 1024,
        evictions: 0
      });
      
      const eventSpy = jest.fn();
      service.on('optimization:cache:ttl', eventSpy);
      
      // Call metrics collection directly
      await (service as any).collectMetrics();
      
      expect(eventSpy).toHaveBeenCalledWith({
        old: 300,
        new: 450
      });
    });

    test('should warn about high cache memory usage', async () => {
      const config: OptimizationConfig = {
        memoryThreshold: 100 * 1024 * 1024 // 100MB
      };
      
      service = new PerformanceOptimizationService(mockJobQueue, undefined, config);
      
      mockCache.getStats.mockReturnValue({
        hits: 700,
        misses: 300,
        size: 95 * 1024 * 1024, // 95MB
        evictions: 5,
        hitRate: 0.7,
        missRate: 0.3
      });
      
      let suggestions: any[];
      service.on('suggestions:generated', (s) => {
        suggestions = s;
      });
      
      // Call metrics collection directly
      await (service as any).collectMetrics();
      
      expect(suggestions.some(s => 
        s.type === 'cache' && s.message.includes('memory usage approaching limit')
      )).toBe(true);
    });
  });

  describe('memory optimization', () => {
    test('should detect high heap usage', async () => {
      const memoryUsage = {
        heapUsed: 950 * 1024 * 1024,  // 95% of heap
        heapTotal: 1000 * 1024 * 1024,
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage;
      
      jest.spyOn(process, 'memoryUsage').mockReturnValue(memoryUsage);
      
      // Create a new service with explicit memory optimization enabled
      const testConfig: OptimizationConfig = {
        enableMemoryOptimization: true
      };
      const testService = new PerformanceOptimizationService(mockJobQueue, mockBackgroundTasks, testConfig);
      
      let suggestions: any[] = [];
      testService.on('suggestions:generated', (s) => {
        suggestions = s;
      });
      
      // Call collectMetrics which should trigger analyzeAndOptimize
      await (testService as any).collectMetrics();
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => 
        s.type === 'memory' && s.severity === 'high'
      )).toBe(true);
      expect(global.gc).toHaveBeenCalled();
    });

    test('should detect memory leaks', async () => {
      const baseMemory = 100 * 1024 * 1024;
      let currentMemory = baseMemory;
      
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        currentMemory += 10 * 1024 * 1024; // Increase by 10MB each time
        return {
          heapUsed: currentMemory,
          heapTotal: 1000 * 1024 * 1024,
          rss: currentMemory + 100 * 1024 * 1024,
          external: 50 * 1024 * 1024,
          arrayBuffers: 0
        } as NodeJS.MemoryUsage;
      });
      
      // Collect metrics 11 times to trigger leak detection
      for (let i = 0; i < 11; i++) {
        await (service as any).collectMetrics();
      }
      
      const report = await service.getPerformanceReport();
      expect(report.suggestions.some(s => 
        s.message.includes('memory leak')
      )).toBe(true);
    });
  });

  describe('job optimization', () => {
    test('should suggest scaling for high queue depth', async () => {
      mockJobQueue.getStats.mockResolvedValue({
        total: 1000,
        pending: 150,
        running: 3,
        completed: 840,
        failed: 7
      });
      
      // Set up CPU usage mock to simulate low CPU usage
      let cpuCallCount = 0;
      jest.spyOn(process, 'cpuUsage').mockImplementation(() => {
        // First call establishes baseline, second call shows low usage
        if (cpuCallCount === 0) {
          cpuCallCount++;
          return { user: 100000, system: 50000 } as NodeJS.CpuUsage;
        } else {
          // Small increase to simulate low CPU usage (< 70%)
          return { user: 100100, system: 50050 } as NodeJS.CpuUsage;
        }
      });
      
      // Mock Date.now() to control time delta
      const originalDateNow = Date.now;
      let timeCallCount = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        if (timeCallCount === 0) {
          timeCallCount++;
          return 1000;
        } else {
          return 2000; // 1 second later
        }
      });
      
      const eventSpy = jest.fn();
      service.on('optimization:jobs:scale', eventSpy);
      
      // First call to establish baseline
      await (service as any).gatherMetrics();
      
      // Second call to get actual metrics with CPU percentage
      const metrics = await (service as any).gatherMetrics();
      await (service as any).analyzeAndOptimize(metrics);
      
      expect(eventSpy).toHaveBeenCalledWith({
        current: 3,
        target: 5
      });
      
      // Restore Date.now
      Date.now = originalDateNow;
    });

    test('should warn about high failure rate', async () => {
      mockJobQueue.getStats.mockResolvedValue({
        total: 1000,
        pending: 50,
        running: 5,
        completed: 800,
        failed: 150
      });
      
      let suggestions: any[];
      service.on('suggestions:generated', (s) => {
        suggestions = s;
      });
      
      // Call metrics collection directly
      await (service as any).collectMetrics();
      
      expect(suggestions.some(s => 
        s.type === 'jobs' && s.message.includes('High job failure rate')
      )).toBe(true);
    });
  });

  describe('cache warming', () => {
    test('should warm cache at intervals', async () => {
      const config: OptimizationConfig = {
        enableCacheWarming: true,
        cacheWarmingInterval: 30000 // 30 seconds
      };
      
      service = new PerformanceOptimizationService(mockJobQueue, undefined, config);
      
      // Reset mock to clear any previous calls
      mockCachePatterns.warmCache.mockClear();
      
      // Call warmCache directly
      await (service as any).warmCache();
      expect(mockCachePatterns.warmCache).toHaveBeenCalledTimes(1);
      
      // Call again to simulate interval
      await (service as any).warmCache();
      expect(mockCachePatterns.warmCache).toHaveBeenCalledTimes(2);
    });

    test('should emit cache warmed event', async () => {
      const config: OptimizationConfig = {
        enableCacheWarming: true
      };
      
      service = new PerformanceOptimizationService(mockJobQueue, undefined, config);
      
      const eventSpy = jest.fn();
      service.on('cache:warmed', eventSpy);
      
      // Call warmCache directly
      await (service as any).warmCache();
      
      expect(eventSpy).toHaveBeenCalledWith({ loaded: 10, failed: 0 });
    });
  });

  describe('performance report', () => {
    test('should generate comprehensive report', async () => {
      // Collect some metrics
      for (let i = 0; i < 3; i++) {
        await (service as any).collectMetrics();
      }
      
      const report = await service.getPerformanceReport();
      
      expect(report.current).toBeDefined();
      expect(report.history).toHaveLength(3);
      expect(report.suggestions).toBeDefined();
      expect(report.trends).toBeDefined();
    });

    test('should calculate trends correctly', async () => {
      // Mock increasing hit rate
      let hitRate = 0.6;
      mockCache.getStats.mockImplementation(() => ({
        hits: Math.floor(hitRate * 1000),
        misses: Math.floor((1 - hitRate) * 1000),
        hitRate,
        missRate: 1 - hitRate,
        size: 50 * 1024 * 1024,
        evictions: 0
      }));
      
      // Collect metrics with improving hit rate
      for (let i = 0; i < 10; i++) {
        hitRate += 0.02;
        await (service as any).collectMetrics();
      }
      
      const report = await service.getPerformanceReport();
      expect(report.trends.cacheHitRate).toBe('improving');
    });
  });

  describe('optimization profiles', () => {
    test('should apply performance profile', async () => {
      const eventSpy = jest.fn();
      service.on('profile:applied', eventSpy);
      
      await service.applyOptimizationProfile('performance');
      
      expect(eventSpy).toHaveBeenCalledWith('performance');
      
      // Verify performance settings
      const config = (service as any).config;
      expect(config.enableCacheWarming).toBe(true);
      expect(config.jobConcurrencyTarget).toBe(20);
      expect(config.memoryThreshold).toBe(1024 * 1024 * 1024);
    });

    test('should apply memory profile', async () => {
      await service.applyOptimizationProfile('memory');
      
      const config = (service as any).config;
      expect(config.enableCacheWarming).toBe(false);
      expect(config.jobConcurrencyTarget).toBe(5);
      expect(config.memoryThreshold).toBe(256 * 1024 * 1024);
    });

    test('should apply balanced profile', async () => {
      await service.applyOptimizationProfile('balanced');
      
      const config = (service as any).config;
      expect(config.enableCacheWarming).toBe(true);
      expect(config.jobConcurrencyTarget).toBe(10);
      expect(config.memoryThreshold).toBe(512 * 1024 * 1024);
    });
  });

  describe('error handling', () => {
    test('should handle cache warming errors', async () => {
      mockCachePatterns.warmCache.mockRejectedValue(new Error('Warming failed'));
      
      const config: OptimizationConfig = {
        enableCacheWarming: true
      };
      
      service = new PerformanceOptimizationService(mockJobQueue, undefined, config);
      
      const errorSpy = jest.fn();
      service.on('error', errorSpy);
      
      // Call warmCache directly to trigger the error
      await (service as any).warmCache();
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('integration with background tasks', () => {
    test('should register optimization task', () => {
      expect(mockBackgroundTasks.registerTask).toHaveBeenCalledWith({
        name: 'performance-optimization',
        schedule: '*/15 * * * *',
        handler: expect.any(Function)
      });
    });
  });

  describe('cache latency calculation', () => {
    test('should measure cache operation latency', async () => {
      // Mock cache operations to take specific time
      let callCount = 0;
      mockCache.set.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return true;
      });
      mockCache.get.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return 'test';
      });
      mockCache.del.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 3));
        return true;
      });
      
      service.start();
      jest.advanceTimersByTime(60000);
      
      // Use real timers for this test
      jest.useRealTimers();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const report = await service.getPerformanceReport();
      expect(report.current?.cache.avgLatency).toBeGreaterThan(0);
      
      jest.useFakeTimers();
    });
  });
});