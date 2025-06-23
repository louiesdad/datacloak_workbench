import { EventEmitter } from 'events';
import { JobQueueService } from './job-queue.service';
import { metricsService } from './metrics.service';
import logger from '../config/logger';

export interface MonitoringOptions {
  jobQueueService: JobQueueService;
  queueDepthThreshold?: number;
  monitoringInterval?: number;
  metricsService?: typeof metricsService;
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

  constructor(options: MonitoringOptions) {
    super();
    this.jobQueueService = options.jobQueueService;
    this.queueDepthThreshold = options.queueDepthThreshold || 100;
    this.monitoringInterval = options.monitoringInterval || 10000; // 10 seconds default
    this.metrics = options.metricsService || metricsService;
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
}

export default MonitoringService;