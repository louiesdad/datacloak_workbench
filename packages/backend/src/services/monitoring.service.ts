import { EventEmitter } from 'events';
import { JobQueueService } from './job-queue.service';
import { metricsService, SystemMetrics } from './metrics.service';
import logger from '../config/logger';

export interface MonitoringOptions {
  jobQueueService: JobQueueService;
  queueDepthThreshold?: number;
  monitoringInterval?: number;
  metricsService?: typeof metricsService;
  apiResponseTimeThreshold?: number;
  apiErrorRateThreshold?: number;
  cpuUsageThreshold?: number;
  memoryUsageThreshold?: number;
}

export interface QueueDepthMetrics {
  depth: number;
  running: number;
  completed: number;
  failed: number;
  timestamp: Date;
}

export interface Alert {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  metrics: any;
}

export class MonitoringService extends EventEmitter {
  private jobQueueService: JobQueueService;
  private queueDepthThreshold: number;
  private monitoringInterval: number;
  private intervalId?: NodeJS.Timeout;
  private isMonitoring = false;
  private metrics: typeof metricsService;
  private apiResponseTimeThreshold: number;
  private apiErrorRateThreshold: number;
  private cpuUsageThreshold: number;
  private memoryUsageThreshold: number;
  private resourceMonitoringInterval?: NodeJS.Timeout;
  private isResourceMonitoring = false;
  
  // Track API metrics
  private apiMetrics: Map<string, {
    responseTimes: number[];
    successCount: number;
    errorCount: number;
  }> = new Map();

  constructor(options: MonitoringOptions) {
    super();
    this.jobQueueService = options.jobQueueService;
    this.queueDepthThreshold = options.queueDepthThreshold || 100;
    this.monitoringInterval = options.monitoringInterval || 10000; // 10 seconds default
    this.metrics = options.metricsService || metricsService;
    this.apiResponseTimeThreshold = options.apiResponseTimeThreshold || 5000; // 5 seconds default
    this.apiErrorRateThreshold = options.apiErrorRateThreshold || 0.05; // 5% default
    this.cpuUsageThreshold = options.cpuUsageThreshold || 90; // 90% default
    this.memoryUsageThreshold = options.memoryUsageThreshold || 90; // 90% default
  }

  async getQueueDepthMetrics(): Promise<QueueDepthMetrics> {
    const metrics = this.jobQueueService.getQueueMetrics();
    
    return {
      depth: metrics.pending,
      running: metrics.running,
      completed: metrics.completed,
      failed: metrics.failed,
      timestamp: new Date()
    };
  }

  async checkQueueDepth(): Promise<void> {
    const startTime = Date.now();
    const metrics = await this.getQueueDepthMetrics();
    const duration = Date.now() - startTime;
    
    // Record the queue depth check as a performance event
    this.metrics.recordJobProcessing('queue_depth_check', duration, true, {
      queueDepth: metrics.depth,
      running: metrics.running,
      completed: metrics.completed,
      failed: metrics.failed
    });
    
    if (metrics.depth > this.queueDepthThreshold) {
      const alert: Alert = {
        type: 'queue_depth_high',
        severity: 'warning',
        message: `Queue depth (${metrics.depth}) exceeds threshold (${this.queueDepthThreshold})`,
        metrics: {
          depth: metrics.depth,
          threshold: this.queueDepthThreshold,
          timestamp: metrics.timestamp
        }
      };
      
      this.emit('alert:queue_depth_high', alert);
      
      logger.warn('High queue depth detected', {
        component: 'monitoring',
        queueDepth: metrics.depth,
        threshold: this.queueDepthThreshold
      });
    }
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Monitoring already started', { component: 'monitoring' });
      return;
    }

    this.isMonitoring = true;
    
    // Initial check
    this.checkQueueDepth().catch(error => {
      logger.error('Failed to check queue depth', { 
        component: 'monitoring', 
        error: error instanceof Error ? error.message : error 
      });
    });

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkQueueDepth().catch(error => {
        logger.error('Failed to check queue depth', { 
          component: 'monitoring', 
          error: error instanceof Error ? error.message : error 
        });
      });
    }, this.monitoringInterval);

    logger.info('Monitoring started', { 
      component: 'monitoring',
      interval: this.monitoringInterval,
      queueDepthThreshold: this.queueDepthThreshold
    });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      logger.warn('Monitoring not running', { component: 'monitoring' });
      return;
    }

    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Monitoring stopped', { component: 'monitoring' });
  }

  // API Response Time Monitoring Methods
  async recordApiResponse(endpoint: string, responseTime: number, success: boolean): Promise<void> {
    // Initialize metrics for endpoint if not exists
    if (!this.apiMetrics.has(endpoint)) {
      this.apiMetrics.set(endpoint, {
        responseTimes: [],
        successCount: 0,
        errorCount: 0
      });
    }

    const endpointMetrics = this.apiMetrics.get(endpoint)!;
    
    // Record response time
    endpointMetrics.responseTimes.push(responseTime);
    
    // Keep only last 100 response times to prevent memory leak
    if (endpointMetrics.responseTimes.length > 100) {
      endpointMetrics.responseTimes.shift();
    }
    
    // Update success/error counts
    if (success) {
      endpointMetrics.successCount++;
    } else {
      endpointMetrics.errorCount++;
    }
    
    // Record in metrics service
    this.metrics.recordApiRequest(endpoint, responseTime, success);
    
    // Check if response time exceeds threshold
    if (responseTime > this.apiResponseTimeThreshold) {
      const alert: Alert = {
        type: 'api_response_time_high',
        severity: 'warning',
        message: `API response time (${responseTime}ms) exceeds threshold (${this.apiResponseTimeThreshold}ms) for ${endpoint}`,
        metrics: {
          endpoint,
          responseTime,
          threshold: this.apiResponseTimeThreshold,
          timestamp: new Date()
        }
      };
      
      this.emit('alert:api_response_time_high', alert);
      
      logger.warn('High API response time detected', {
        component: 'monitoring',
        endpoint,
        responseTime,
        threshold: this.apiResponseTimeThreshold
      });
    }
  }

  async getAverageApiResponseTime(endpoint: string): Promise<number> {
    const endpointMetrics = this.apiMetrics.get(endpoint);
    
    if (!endpointMetrics || endpointMetrics.responseTimes.length === 0) {
      return 0;
    }
    
    const sum = endpointMetrics.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / endpointMetrics.responseTimes.length;
  }

  async checkApiErrorRate(): Promise<void> {
    // Calculate overall error rate across all endpoints
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const [endpoint, metrics] of this.apiMetrics) {
      const endpointTotal = metrics.successCount + metrics.errorCount;
      totalRequests += endpointTotal;
      totalErrors += metrics.errorCount;
    }
    
    if (totalRequests === 0) return;
    
    const errorRate = totalErrors / totalRequests;
    
    if (errorRate > this.apiErrorRateThreshold) {
      const alert: Alert = {
        type: 'api_error_rate_high',
        severity: 'critical',
        message: `API error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold (${(this.apiErrorRateThreshold * 100).toFixed(1)}%)`,
        metrics: {
          errorRate,
          threshold: this.apiErrorRateThreshold,
          totalRequests,
          failedRequests: totalErrors,
          timestamp: new Date()
        }
      };
      
      this.emit('alert:api_error_rate_high', alert);
      
      logger.error('High API error rate detected', {
        component: 'monitoring',
        errorRate,
        threshold: this.apiErrorRateThreshold,
        totalRequests,
        failedRequests: totalErrors
      });
    }
  }

  // Resource Usage Monitoring Methods
  async checkResourceUsage(metrics?: SystemMetrics): Promise<void> {
    // Use provided metrics or get current metrics from metrics service
    const systemMetrics = metrics || this.metrics.getCurrentMetrics();
    
    // Check CPU usage
    if (systemMetrics.cpu.usage > this.cpuUsageThreshold) {
      const alert: Alert = {
        type: 'cpu_usage_high',
        severity: 'warning',
        message: `CPU usage (${systemMetrics.cpu.usage}%) exceeds threshold (${this.cpuUsageThreshold}%)`,
        metrics: {
          cpuUsage: systemMetrics.cpu.usage,
          threshold: this.cpuUsageThreshold,
          loadAverage: systemMetrics.cpu.loadAverage,
          timestamp: new Date()
        }
      };
      
      this.emit('alert:cpu_usage_high', alert);
      
      logger.warn('High CPU usage detected', {
        component: 'monitoring',
        cpuUsage: systemMetrics.cpu.usage,
        threshold: this.cpuUsageThreshold,
        loadAverage: systemMetrics.cpu.loadAverage
      });
    }
    
    // Check memory usage
    if (systemMetrics.memory.usage > this.memoryUsageThreshold) {
      const alert: Alert = {
        type: 'memory_usage_high',
        severity: 'warning',
        message: `Memory usage (${systemMetrics.memory.usage}%) exceeds threshold (${this.memoryUsageThreshold}%)`,
        metrics: {
          memoryUsage: systemMetrics.memory.usage,
          threshold: this.memoryUsageThreshold,
          totalMemory: systemMetrics.memory.total,
          usedMemory: systemMetrics.memory.used,
          freeMemory: systemMetrics.memory.free,
          timestamp: new Date()
        }
      };
      
      this.emit('alert:memory_usage_high', alert);
      
      logger.warn('High memory usage detected', {
        component: 'monitoring',
        memoryUsage: systemMetrics.memory.usage,
        threshold: this.memoryUsageThreshold,
        totalMemory: systemMetrics.memory.total,
        usedMemory: systemMetrics.memory.used
      });
    }
  }

  async startResourceMonitoring(): Promise<void> {
    if (this.isResourceMonitoring) {
      logger.warn('Resource monitoring already started', { component: 'monitoring' });
      return;
    }

    this.isResourceMonitoring = true;
    
    // Initial check
    this.checkResourceUsage().catch(error => {
      logger.error('Failed to check resource usage', { 
        component: 'monitoring', 
        error: error instanceof Error ? error.message : error 
      });
    });

    // Set up interval for resource monitoring
    this.resourceMonitoringInterval = setInterval(() => {
      this.checkResourceUsage().catch(error => {
        logger.error('Failed to check resource usage', { 
          component: 'monitoring', 
          error: error instanceof Error ? error.message : error 
        });
      });
    }, this.monitoringInterval);

    logger.info('Resource monitoring started', { 
      component: 'monitoring',
      interval: this.monitoringInterval,
      cpuThreshold: this.cpuUsageThreshold,
      memoryThreshold: this.memoryUsageThreshold
    });
  }

  async stopResourceMonitoring(): Promise<void> {
    if (!this.isResourceMonitoring) {
      logger.warn('Resource monitoring not running', { component: 'monitoring' });
      return;
    }

    this.isResourceMonitoring = false;
    
    if (this.resourceMonitoringInterval) {
      clearInterval(this.resourceMonitoringInterval);
      this.resourceMonitoringInterval = undefined;
    }

    logger.info('Resource monitoring stopped', { component: 'monitoring' });
  }
}

export default MonitoringService;