import { EventEmitter } from 'events';
import logger from '../config/logger';

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  process: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  database: {
    connections: number;
    queries: number;
    avgResponseTime: number;
  };
  queue: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    throughput: number;
  };
  api: {
    requests: number;
    errors: number;
    avgResponseTime: number;
    activeConnections: number;
  };
}

export interface PerformanceEvent {
  type: 'api_request' | 'database_query' | 'job_processing' | 'cache_operation';
  operation: string;
  duration: number;
  success: boolean;
  timestamp: Date;
  metadata?: any;
}

class MetricsService extends EventEmitter {
  private metrics: SystemMetrics;
  private performanceEvents: PerformanceEvent[] = [];
  private maxEventHistory = 10000;
  private lastCpuUsage?: NodeJS.CpuUsage;
  private lastCpuTime?: number;
  private intervalId?: NodeJS.Timeout;
  private isCollecting = false;

  // Counters for real-time metrics
  private counters = {
    apiRequests: 0,
    apiErrors: 0,
    databaseQueries: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  // Response time tracking
  private responseTimes = {
    api: [] as number[],
    database: [] as number[],
    queue: [] as number[]
  };

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.startCollection();
  }

  private initializeMetrics(): SystemMetrics {
    return {
      cpu: {
        usage: 0,
        loadAverage: [0, 0, 0]
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      },
      process: {
        uptime: 0,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      database: {
        connections: 0,
        queries: 0,
        avgResponseTime: 0
      },
      queue: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        throughput: 0
      },
      api: {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        activeConnections: 0
      }
    };
  }

  public startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Collect every 5 seconds

    logger.info('Metrics collection started', { component: 'metrics' });
  }

  public stopCollection(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Metrics collection stopped', { component: 'metrics' });
  }

  private async collectMetrics(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Collect system metrics
      await this.collectSystemMetrics();
      
      // Collect application metrics
      this.collectApplicationMetrics();
      
      // Emit metrics event
      this.emit('metrics:collected', this.metrics);
      
      const duration = Date.now() - startTime;
      logger.debug('Metrics collection completed', { 
        component: 'metrics', 
        duration,
        metricsCount: Object.keys(this.metrics).length
      });
    } catch (error) {
      logger.error('Failed to collect metrics', { 
        component: 'metrics', 
        error: error instanceof Error ? error.message : error 
      });
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    // CPU metrics
    const currentTime = Date.now();
    const currentCpuUsage = process.cpuUsage();
    
    if (this.lastCpuUsage && this.lastCpuTime) {
      const timeDelta = currentTime - this.lastCpuTime;
      const cpuDelta = (currentCpuUsage.user - this.lastCpuUsage.user) + 
                      (currentCpuUsage.system - this.lastCpuUsage.system);
      this.metrics.cpu.usage = (cpuDelta / (timeDelta * 1000)) * 100;
    }
    
    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTime = currentTime;
    this.metrics.cpu.loadAverage = require('os').loadavg();

    // Memory metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    this.metrics.memory = {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usage: (usedMemory / totalMemory) * 100
    };

    // Process metrics
    this.metrics.process = {
      uptime: process.uptime(),
      memoryUsage,
      cpuUsage: currentCpuUsage
    };
  }

  private collectApplicationMetrics(): void {
    // API metrics
    this.metrics.api.requests = this.counters.apiRequests;
    this.metrics.api.errors = this.counters.apiErrors;
    this.metrics.api.avgResponseTime = this.calculateAverageResponseTime('api');

    // Database metrics
    this.metrics.database.queries = this.counters.databaseQueries;
    this.metrics.database.avgResponseTime = this.calculateAverageResponseTime('database');

    // Queue metrics
    this.metrics.queue.completed = this.counters.jobsCompleted;
    this.metrics.queue.failed = this.counters.jobsFailed;
    this.metrics.queue.throughput = this.calculateThroughput();
  }

  private calculateAverageResponseTime(type: keyof typeof this.responseTimes): number {
    const times = this.responseTimes[type];
    if (times.length === 0) return 0;
    
    const sum = times.reduce((acc, time) => acc + time, 0);
    return sum / times.length;
  }

  private calculateThroughput(): number {
    // Calculate jobs per minute based on recent performance events
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentEvents = this.performanceEvents.filter(
      event => event.timestamp > oneMinuteAgo && event.type === 'job_processing'
    );
    return recentEvents.length;
  }

  // Public methods for recording performance events
  public recordApiRequest(operation: string, duration: number, success: boolean, metadata?: any): void {
    this.counters.apiRequests++;
    if (!success) this.counters.apiErrors++;
    
    this.responseTimes.api.push(duration);
    this.trimResponseTimes('api');
    
    this.recordPerformanceEvent('api_request', operation, duration, success, metadata);
  }

  public recordDatabaseQuery(operation: string, duration: number, success: boolean, metadata?: any): void {
    this.counters.databaseQueries++;
    
    this.responseTimes.database.push(duration);
    this.trimResponseTimes('database');
    
    this.recordPerformanceEvent('database_query', operation, duration, success, metadata);
  }

  public recordJobProcessing(operation: string, duration: number, success: boolean, metadata?: any): void {
    if (success) {
      this.counters.jobsCompleted++;
    } else {
      this.counters.jobsFailed++;
    }
    
    this.responseTimes.queue.push(duration);
    this.trimResponseTimes('queue');
    
    this.recordPerformanceEvent('job_processing', operation, duration, success, metadata);
  }

  public recordCacheOperation(operation: string, duration: number, success: boolean, hit: boolean, metadata?: any): void {
    if (hit) {
      this.counters.cacheHits++;
    } else {
      this.counters.cacheMisses++;
    }
    
    this.recordPerformanceEvent('cache_operation', operation, duration, success, { hit, ...metadata });
  }

  private recordPerformanceEvent(
    type: PerformanceEvent['type'], 
    operation: string, 
    duration: number, 
    success: boolean, 
    metadata?: any
  ): void {
    const event: PerformanceEvent = {
      type,
      operation,
      duration,
      success,
      timestamp: new Date(),
      metadata
    };

    this.performanceEvents.push(event);
    
    // Trim event history to prevent memory leaks
    if (this.performanceEvents.length > this.maxEventHistory) {
      this.performanceEvents = this.performanceEvents.slice(-this.maxEventHistory);
    }

    this.emit('performance:event', event);
    
    // Log performance events with threshold warnings
    const logLevel = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger[logLevel](`Performance event: ${type}`, {
      component: 'metrics',
      operation,
      duration,
      success,
      ...metadata
    });
  }

  private trimResponseTimes(type: keyof typeof this.responseTimes): void {
    const maxSamples = 1000;
    if (this.responseTimes[type].length > maxSamples) {
      this.responseTimes[type] = this.responseTimes[type].slice(-maxSamples);
    }
  }

  // Getter methods
  public getCurrentMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  public getPerformanceEvents(limit: number = 100, type?: PerformanceEvent['type']): PerformanceEvent[] {
    let events = this.performanceEvents;
    
    if (type) {
      events = events.filter(event => event.type === type);
    }
    
    return events.slice(-limit);
  }

  public getCounters() {
    return { ...this.counters };
  }

  public getHealthScore(): number {
    // Calculate overall health score based on various metrics
    let score = 100;
    
    // CPU health (deduct points for high CPU usage)
    if (this.metrics.cpu.usage > 90) score -= 30;
    else if (this.metrics.cpu.usage > 70) score -= 15;
    else if (this.metrics.cpu.usage > 50) score -= 5;
    
    // Memory health
    if (this.metrics.memory.usage > 90) score -= 25;
    else if (this.metrics.memory.usage > 70) score -= 10;
    else if (this.metrics.memory.usage > 50) score -= 3;
    
    // Error rate health
    const errorRate = this.counters.apiErrors / Math.max(this.counters.apiRequests, 1);
    if (errorRate > 0.1) score -= 20; // 10% error rate
    else if (errorRate > 0.05) score -= 10; // 5% error rate
    else if (errorRate > 0.01) score -= 5; // 1% error rate
    
    // Response time health
    const avgApiResponseTime = this.calculateAverageResponseTime('api');
    if (avgApiResponseTime > 5000) score -= 15;
    else if (avgApiResponseTime > 2000) score -= 8;
    else if (avgApiResponseTime > 1000) score -= 3;
    
    return Math.max(0, Math.min(100, score));
  }

  public generateReport(): {
    summary: SystemMetrics;
    health: number;
    performance: {
      avgResponseTimes: Record<string, number>;
      throughput: number;
      errorRates: Record<string, number>;
    };
    recommendations: string[];
  } {
    const health = this.getHealthScore();
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (this.metrics.cpu.usage > 80) {
      recommendations.push('High CPU usage detected. Consider scaling or optimizing CPU-intensive operations.');
    }
    
    if (this.metrics.memory.usage > 80) {
      recommendations.push('High memory usage detected. Consider implementing memory optimization or scaling.');
    }
    
    const errorRate = this.counters.apiErrors / Math.max(this.counters.apiRequests, 1);
    if (errorRate > 0.05) {
      recommendations.push('High error rate detected. Review application logs and implement error handling improvements.');
    }
    
    const avgApiResponseTime = this.calculateAverageResponseTime('api');
    if (avgApiResponseTime > 2000) {
      recommendations.push('Slow API response times detected. Consider implementing caching or query optimization.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System is performing well. Continue monitoring for any degradation.');
    }
    
    return {
      summary: this.getCurrentMetrics(),
      health,
      performance: {
        avgResponseTimes: {
          api: this.calculateAverageResponseTime('api'),
          database: this.calculateAverageResponseTime('database'),
          queue: this.calculateAverageResponseTime('queue')
        },
        throughput: this.calculateThroughput(),
        errorRates: {
          api: errorRate,
          cache: this.counters.cacheMisses / Math.max(this.counters.cacheHits + this.counters.cacheMisses, 1)
        }
      },
      recommendations
    };
  }

  public resetCounters(): void {
    this.counters = {
      apiRequests: 0,
      apiErrors: 0,
      databaseQueries: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.responseTimes = {
      api: [],
      database: [],
      queue: []
    };
    
    this.performanceEvents = [];
    
    logger.info('Metrics counters reset', { component: 'metrics' });
  }
}

// Singleton instance
export const metricsService = new MetricsService();
export default metricsService;