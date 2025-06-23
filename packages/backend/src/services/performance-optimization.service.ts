import { EventEmitter } from 'events';
import { getCacheService, ICacheService } from './cache.service';
import { CachePatternsService } from './cache-patterns.service';
import { JobQueueService } from './job-queue.service';
import { RedisJobQueueService } from './redis-queue.service';
import { BackgroundTaskService } from './background-task.service';

export interface PerformanceMetrics {
  timestamp: Date;
  cache: {
    hitRate: number;
    missRate: number;
    avgLatency: number;
    memoryUsage: number;
    evictionRate: number;
  };
  jobs: {
    throughput: number; // jobs/second
    avgProcessingTime: number;
    queueDepth: number;
    failureRate: number;
    concurrency: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  system: {
    cpuUsage: number;
    loadAverage: number[];
    uptime: number;
  };
}

export interface OptimizationConfig {
  enableCacheWarming?: boolean;
  cacheWarmingInterval?: number; // ms
  enableQueryOptimization?: boolean;
  enableMemoryOptimization?: boolean;
  memoryThreshold?: number; // bytes
  enableJobOptimization?: boolean;
  jobConcurrencyTarget?: number;
  metricsInterval?: number; // ms
}

export interface OptimizationSuggestion {
  type: 'cache' | 'memory' | 'jobs' | 'system';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation: string;
  impact: string;
  metrics?: Record<string, any>;
}

export class PerformanceOptimizationService extends EventEmitter {
  private cache: ICacheService;
  private cachePatterns: CachePatternsService;
  private metricsHistory: PerformanceMetrics[] = [];
  private optimizationInterval?: NodeJS.Timeout;
  private warmingInterval?: NodeJS.Timeout;
  private suggestions: OptimizationSuggestion[] = [];
  private lastCpuUsage?: NodeJS.CpuUsage;
  private lastCpuTime?: number;
  
  constructor(
    private jobQueue: JobQueueService | RedisJobQueueService,
    private backgroundTasks?: BackgroundTaskService,
    private config: OptimizationConfig = {}
  ) {
    super();
    this.cache = getCacheService();
    this.cachePatterns = new CachePatternsService(this.cache);
    
    this.setupOptimization();
  }

  /**
   * Start performance optimization
   */
  start(): void {
    // Start metrics collection
    const interval = this.config.metricsInterval || 60000; // 1 minute
    this.optimizationInterval = setInterval(async () => {
      await this.collectMetrics();
    }, interval);

    // Start cache warming if enabled
    if (this.config.enableCacheWarming) {
      this.startCacheWarming();
    }

    this.emit('optimization:started');
  }

  /**
   * Stop performance optimization
   */
  stop(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = undefined;
    }

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = undefined;
    }

    this.emit('optimization:stopped');
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    const metrics = await this.gatherMetrics();
    
    // Store metrics
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1440) { // Keep 24 hours at 1-minute intervals
      this.metricsHistory.shift();
    }

    // Analyze and optimize
    await this.analyzeAndOptimize(metrics);
    
    // Store in cache for other services
    await this.cache.set('performance:latest', metrics, { ttl: 300 });
    
    this.emit('metrics:collected', metrics);
  }

  /**
   * Gather current metrics
   */
  private async gatherMetrics(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const currentTime = Date.now();
    
    // Calculate CPU percentage
    let cpuPercent = 0;
    if (this.lastCpuUsage && this.lastCpuTime) {
      const timeDelta = currentTime - this.lastCpuTime;
      const cpuDelta = (cpuUsage.user - this.lastCpuUsage.user) + (cpuUsage.system - this.lastCpuUsage.system);
      // CPU percentage = (CPU time used / real time elapsed) * 100
      // cpuDelta is in microseconds, timeDelta is in milliseconds
      cpuPercent = (cpuDelta / (timeDelta * 1000)) * 100;
    }
    
    // Store for next calculation
    this.lastCpuUsage = cpuUsage;
    this.lastCpuTime = currentTime;
    
    // Get cache stats
    const cacheStats = await this.cache.getStats();
    
    // Get job stats
    const jobStats = await this.jobQueue.getStats();
    
    // Calculate rates
    const cacheTotal = cacheStats.hits + cacheStats.misses;
    const cacheHitRate = cacheTotal > 0 ? cacheStats.hits / cacheTotal : 0;
    const cacheMissRate = 1 - cacheHitRate;
    
    return {
      timestamp: new Date(),
      cache: {
        hitRate: cacheHitRate,
        missRate: cacheMissRate,
        avgLatency: await this.calculateCacheLatency(),
        memoryUsage: 0,
        evictionRate: 0
      },
      jobs: {
        throughput: await this.calculateJobThroughput(),
        avgProcessingTime: await this.calculateAvgJobTime(),
        queueDepth: jobStats.pending || 0,
        failureRate: jobStats.total > 0 ? jobStats.failed / jobStats.total : 0,
        concurrency: jobStats.running || 0
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      },
      system: {
        cpuUsage: cpuPercent / 100, // Convert to 0-1 range for comparison with 0.7
        loadAverage: require('os').loadavg(),
        uptime: process.uptime()
      }
    };
  }

  /**
   * Analyze metrics and apply optimizations
   */
  private async analyzeAndOptimize(metrics: PerformanceMetrics): Promise<void> {
    this.suggestions = [];

    // Cache optimization
    if (this.config.enableCacheWarming !== false) {
      await this.optimizeCache(metrics);
    }

    // Memory optimization
    if (this.config.enableMemoryOptimization !== false) {
      await this.optimizeMemory(metrics);
    }

    // Job processing optimization
    if (this.config.enableJobOptimization !== false) {
      await this.optimizeJobProcessing(metrics);
    }

    // Query optimization
    if (this.config.enableQueryOptimization !== false) {
      await this.optimizeQueries(metrics);
    }

    if (this.suggestions.length > 0) {
      this.emit('suggestions:generated', this.suggestions);
    }
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(metrics: PerformanceMetrics): Promise<void> {
    // Check cache hit rate
    if (metrics.cache.hitRate < 0.7) {
      this.suggestions.push({
        type: 'cache',
        severity: 'medium',
        message: `Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`,
        recommendation: 'Increase cache TTL or implement cache warming for frequently accessed data',
        impact: 'Could improve response times by 30-50%'
      });

      // Auto-adjust TTL if hit rate is very low
      if (metrics.cache.hitRate < 0.5) {
        const currentTTL = (await this.cache.getConfig()).defaultTTL || 300;
        const newTTL = Math.min(currentTTL * 1.5, 3600); // Max 1 hour
        
        this.emit('optimization:cache:ttl', { old: currentTTL, new: newTTL });
      }
    }

    // Check cache memory usage
    const maxMemory = this.config.memoryThreshold || 500 * 1024 * 1024; // 500MB
    if (metrics.cache.memoryUsage > maxMemory * 0.9) {
      this.suggestions.push({
        type: 'cache',
        severity: 'high',
        message: 'Cache memory usage approaching limit',
        recommendation: 'Implement more aggressive eviction or increase memory limit',
        impact: 'May cause increased cache misses and slower performance'
      });
    }

    // Check eviction rate
    if (metrics.cache.evictionRate > 0.1) {
      this.suggestions.push({
        type: 'cache',
        severity: 'medium',
        message: 'High cache eviction rate',
        recommendation: 'Increase cache size or optimize cache key distribution',
        impact: 'Reducing evictions could improve hit rate by 10-20%'
      });
    }
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemory(metrics: PerformanceMetrics): Promise<void> {
    const heapUsagePercent = metrics.memory.heapUsed / metrics.memory.heapTotal;
    
    // Check heap usage
    if (heapUsagePercent > 0.85) {
      this.suggestions.push({
        type: 'memory',
        severity: 'high',
        message: `High heap usage: ${(heapUsagePercent * 100).toFixed(1)}%`,
        recommendation: 'Trigger garbage collection or optimize memory-intensive operations',
        impact: 'Risk of out-of-memory errors and performance degradation'
      });

      // Force GC if available
      if (global.gc) {
        global.gc();
        this.emit('optimization:memory:gc');
      }
    }

    // Check for memory leaks
    if (this.metricsHistory.length > 10) {
      const recentHistory = this.metricsHistory.slice(-10);
      const memoryGrowth = recentHistory[9].memory.heapUsed - recentHistory[0].memory.heapUsed;
      const growthRate = memoryGrowth / recentHistory[0].memory.heapUsed;
      
      if (growthRate > 0.2) { // 20% growth over 10 samples
        this.suggestions.push({
          type: 'memory',
          severity: 'high',
          message: 'Potential memory leak detected',
          recommendation: 'Review recent code changes and check for unreleased resources',
          impact: 'Application may crash if memory continues to grow',
          metrics: { growthRate: (growthRate * 100).toFixed(1) + '%' }
        });
      }
    }
  }

  /**
   * Optimize job processing
   */
  private async optimizeJobProcessing(metrics: PerformanceMetrics): Promise<void> {
    const targetConcurrency = this.config.jobConcurrencyTarget || 10;
    
    // Check queue depth
    if (metrics.jobs.queueDepth > 100) {
      this.suggestions.push({
        type: 'jobs',
        severity: 'medium',
        message: `High job queue depth: ${metrics.jobs.queueDepth}`,
        recommendation: 'Increase job processing concurrency or add more workers',
        impact: 'Jobs may experience delays in processing'
      });

      // Auto-scale if possible
      if (metrics.jobs.concurrency < targetConcurrency && metrics.system.cpuUsage < 0.7) {
        this.emit('optimization:jobs:scale', { 
          current: metrics.jobs.concurrency, 
          target: Math.min(metrics.jobs.concurrency + 2, targetConcurrency)
        });
      }
    }

    // Check failure rate
    if (metrics.jobs.failureRate > 0.1) {
      this.suggestions.push({
        type: 'jobs',
        severity: 'high',
        message: `High job failure rate: ${(metrics.jobs.failureRate * 100).toFixed(1)}%`,
        recommendation: 'Review job error logs and implement retry logic',
        impact: 'Failed jobs may need manual intervention'
      });
    }

    // Check processing time
    if (metrics.jobs.avgProcessingTime > 30000) { // 30 seconds
      this.suggestions.push({
        type: 'jobs',
        severity: 'medium',
        message: 'Long average job processing time',
        recommendation: 'Optimize job handlers or break large jobs into smaller chunks',
        impact: 'Reducing processing time could increase throughput by 50%'
      });
    }
  }

  /**
   * Optimize database queries
   */
  private async optimizeQueries(metrics: PerformanceMetrics): Promise<void> {
    // This would require query profiling integration
    // For now, provide general recommendations based on patterns
    
    if (metrics.cache.missRate > 0.5) {
      this.suggestions.push({
        type: 'system',
        severity: 'low',
        message: 'Consider query result caching',
        recommendation: 'Cache frequently executed query results',
        impact: 'Could reduce database load by 40-60%'
      });
    }
  }

  /**
   * Start cache warming
   */
  private startCacheWarming(): void {
    const interval = this.config.cacheWarmingInterval || 300000; // 5 minutes
    
    this.warmingInterval = setInterval(async () => {
      await this.warmCache();
    }, interval);

    // Initial warming
    this.warmCache();
  }

  /**
   * Warm cache with frequently accessed data
   */
  private async warmCache(): Promise<void> {
    try {
      // Get access patterns from history
      const patterns = await this.analyzeAccessPatterns();
      
      // Warm top accessed keys
      const warmed = await this.cachePatterns.warmCache(
        patterns.topKeys,
        async (keys) => {
          // This would load data from database
          const result = new Map();
          for (const key of keys) {
            // Simulate loading data
            result.set(key, { warmed: true, timestamp: new Date() });
          }
          return result;
        },
        { ttl: 3600 }
      );

      this.emit('cache:warmed', warmed);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Analyze access patterns
   */
  private async analyzeAccessPatterns(): Promise<{
    topKeys: string[];
    patterns: string[];
  }> {
    // In a real implementation, this would analyze logs or metrics
    // For now, return mock data
    return {
      topKeys: ['config:app', 'user:preferences', 'dataset:metadata'],
      patterns: ['user:*', 'config:*']
    };
  }

  /**
   * Calculate cache latency
   */
  private async calculateCacheLatency(): Promise<number> {
    // Test cache latency
    const start = Date.now();
    const testKey = '__perf_test__';
    
    await this.cache.set(testKey, 'test', { ttl: 10 });
    await this.cache.get(testKey);
    await this.cache.del(testKey);
    
    return (Date.now() - start) / 3; // Average of 3 operations
  }

  /**
   * Calculate job throughput
   */
  private async calculateJobThroughput(): Promise<number> {
    if (this.metricsHistory.length < 2) return 0;
    
    const current = await this.jobQueue.getStats();
    const previous = this.metricsHistory[this.metricsHistory.length - 1];
    const timeDiff = Date.now() - previous.timestamp.getTime();
    
    const jobsProcessed = (current.completed || 0) - (previous.jobs?.throughput || 0);
    
    return jobsProcessed / (timeDiff / 1000); // jobs per second
  }

  /**
   * Calculate average job processing time
   */
  private async calculateAvgJobTime(): Promise<number> {
    // This would need integration with job queue to track times
    // For now, return estimated value
    return 5000; // 5 seconds
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(): Promise<{
    current: PerformanceMetrics | null;
    history: PerformanceMetrics[];
    suggestions: OptimizationSuggestion[];
    trends: {
      cacheHitRate: 'improving' | 'stable' | 'degrading';
      memoryUsage: 'improving' | 'stable' | 'degrading';
      jobThroughput: 'improving' | 'stable' | 'degrading';
    };
  }> {
    const current = this.metricsHistory[this.metricsHistory.length - 1] || null;
    
    // Calculate trends
    const trends = {
      cacheHitRate: this.calculateTrend('cache.hitRate'),
      memoryUsage: this.calculateTrend('memory.heapUsed', true), // Inverse - lower is better
      jobThroughput: this.calculateTrend('jobs.throughput')
    };

    return {
      current,
      history: this.metricsHistory.slice(-60), // Last hour
      suggestions: this.suggestions,
      trends
    };
  }

  /**
   * Calculate trend for a metric
   */
  private calculateTrend(
    path: string, 
    inverse = false
  ): 'improving' | 'stable' | 'degrading' {
    if (this.metricsHistory.length < 10) return 'stable';
    
    const recent = this.metricsHistory.slice(-10);
    const values = recent.map(m => this.getNestedValue(m, path));
    
    // Simple linear regression
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.001) return 'stable';
    
    if (inverse) {
      return slope > 0 ? 'degrading' : 'improving';
    } else {
      return slope > 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): number {
    return path.split('.').reduce((curr, prop) => curr?.[prop] || 0, obj);
  }

  /**
   * Apply optimization profile
   */
  async applyOptimizationProfile(profile: 'balanced' | 'performance' | 'memory'): Promise<void> {
    switch (profile) {
      case 'performance':
        this.config.enableCacheWarming = true;
        this.config.cacheWarmingInterval = 180000; // 3 minutes
        this.config.jobConcurrencyTarget = 20;
        this.config.memoryThreshold = 1024 * 1024 * 1024; // 1GB
        break;
        
      case 'memory':
        this.config.enableCacheWarming = false;
        this.config.jobConcurrencyTarget = 5;
        this.config.memoryThreshold = 256 * 1024 * 1024; // 256MB
        this.config.enableMemoryOptimization = true;
        break;
        
      case 'balanced':
      default:
        this.config.enableCacheWarming = true;
        this.config.cacheWarmingInterval = 300000; // 5 minutes
        this.config.jobConcurrencyTarget = 10;
        this.config.memoryThreshold = 512 * 1024 * 1024; // 512MB
        break;
    }

    this.emit('profile:applied', profile);
    
    // Restart with new config
    this.stop();
    this.start();
  }

  /**
   * Setup initial optimization
   */
  private setupOptimization(): void {
    // Set up event listeners
    this.cachePatterns.on('cache:hit', () => {
      // Track cache performance
    });

    this.cachePatterns.on('cache:miss', () => {
      // Track cache misses
    });

    if (this.backgroundTasks) {
      // Register optimization task
      this.backgroundTasks.registerTask({
        name: 'performance-optimization',
        schedule: '*/15 * * * *', // Every 15 minutes
        handler: async (context) => {
          const report = await this.getPerformanceReport();
          await context.cache.set('performance:report', report, { ttl: 3600 });
          return report;
        }
      });
    }
  }
}