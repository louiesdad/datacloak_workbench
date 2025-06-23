import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { websocketService } from './websocket.service';
import { eventEmitter, EventTypes } from './event.service';
import { getJobQueueService } from './job-queue.factory';
import { getCacheService } from './cache.service';

export interface DashboardMetric {
  id: string;
  name: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  timestamp: Date;
}

export interface JobProgressUpdate {
  jobId: string;
  type: string;
  status: string;
  progress: number;
  message?: string;
  estimatedTimeRemaining?: number;
  currentStep?: string;
  totalSteps?: number;
  metadata?: any;
}

export interface CostUpdate {
  service: string;
  operation: string;
  cost: number;
  currency: string;
  units: number;
  unitType: string;
  timestamp: Date;
  details?: any;
}

export interface SystemMetricUpdate {
  category: 'cpu' | 'memory' | 'disk' | 'network' | 'cache' | 'queue';
  metrics: {
    [key: string]: {
      value: number;
      unit: string;
      threshold?: number;
      status?: 'normal' | 'warning' | 'critical';
    };
  };
  timestamp: Date;
}

export interface DashboardSubscription {
  clientId: string;
  userId?: string;
  metrics: Set<string>;
  updateInterval: number;
  lastUpdate: Date;
  filters?: {
    jobTypes?: string[];
    services?: string[];
    metricCategories?: string[];
  };
}

export class DashboardBroadcastingService extends EventEmitter {
  private subscriptions = new Map<string, DashboardSubscription>();
  private metricsCache = new Map<string, DashboardMetric>();
  private costAccumulator = new Map<string, number>();
  private updateIntervals = new Map<string, NodeJS.Timeout>();
  private systemMetricsInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupEventListeners();
    this.startSystemMetricsCollection();
  }

  private setupEventListeners(): void {
    // Job Queue Events
    eventEmitter.on(EventTypes.JOB_CREATED, (data) => {
      this.broadcastJobUpdate({
        jobId: data.jobId,
        type: data.type,
        status: 'created',
        progress: 0,
        message: 'Job created and queued'
      });
    });

    eventEmitter.on(EventTypes.JOB_PROGRESS, (data) => {
      this.broadcastJobUpdate({
        jobId: data.jobId,
        type: data.type,
        status: data.status,
        progress: data.progress,
        message: data.message,
        currentStep: data.currentStep,
        totalSteps: data.totalSteps
      });
    });

    eventEmitter.on(EventTypes.JOB_COMPLETE, (data) => {
      this.broadcastJobUpdate({
        jobId: data.jobId,
        type: data.type,
        status: 'completed',
        progress: 100,
        message: 'Job completed successfully',
        metadata: data.result
      });
    });

    eventEmitter.on(EventTypes.JOB_FAILED, (data) => {
      this.broadcastJobUpdate({
        jobId: data.jobId,
        type: data.type,
        status: 'failed',
        progress: data.progress || 0,
        message: data.error || 'Job failed'
      });
    });

    // Cost tracking events
    eventEmitter.on('cost:incurred', (data: CostUpdate) => {
      this.trackCost(data);
      this.broadcastCostUpdate(data);
    });

    // WebSocket message handling
    eventEmitter.on('ws:message', ({ clientId, message }: any) => {
      switch (message.type) {
        case 'subscribe_dashboard':
          this.subscribeToDashboard(clientId, message.data);
          break;
        case 'unsubscribe_dashboard':
          this.unsubscribeFromDashboard(clientId);
          break;
        case 'update_dashboard_filters':
          this.updateSubscriptionFilters(clientId, message.data?.filters);
          break;
      }
    });

    // Client disconnect
    eventEmitter.on(EventTypes.WS_CLIENT_DISCONNECTED, ({ clientId }: any) => {
      this.unsubscribeFromDashboard(clientId);
    });
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 5 seconds
    this.systemMetricsInterval = setInterval(() => {
      this.collectAndBroadcastSystemMetrics();
    }, 5000);
  }

  private async collectAndBroadcastSystemMetrics(): Promise<void> {
    try {
      // CPU metrics
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      // Memory metrics
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // Queue metrics
      const jobQueue = getJobQueueService();
      const queueStats = jobQueue.getStats();

      // Cache metrics
      const cacheService = getCacheService();
      const cacheStats = await cacheService.getStats();

      const systemUpdate: SystemMetricUpdate = {
        category: 'cpu',
        metrics: {
          cpu: {
            value: cpuPercent,
            unit: 'percent',
            threshold: 80,
            status: cpuPercent > 80 ? 'warning' : 'normal'
          },
          memory: {
            value: memPercent,
            unit: 'percent',
            threshold: 90,
            status: memPercent > 90 ? 'warning' : 'normal'
          },
          heapUsed: {
            value: memUsage.heapUsed / 1024 / 1024,
            unit: 'MB'
          },
          rss: {
            value: memUsage.rss / 1024 / 1024,
            unit: 'MB'
          }
        },
        timestamp: new Date()
      };

      this.broadcastSystemMetrics(systemUpdate);

      // Queue metrics
      const queueUpdate: SystemMetricUpdate = {
        category: 'queue',
        metrics: {
          total: { value: queueStats.total, unit: 'jobs' },
          pending: { value: queueStats.pending, unit: 'jobs' },
          running: { value: queueStats.running, unit: 'jobs' },
          completed: { value: queueStats.completed, unit: 'jobs' },
          failed: { value: queueStats.failed, unit: 'jobs' }
        },
        timestamp: new Date()
      };

      this.broadcastSystemMetrics(queueUpdate);

      // Cache metrics
      const cacheUpdate: SystemMetricUpdate = {
        category: 'cache',
        metrics: {
          hitRate: {
            value: cacheStats.hitRate * 100,
            unit: 'percent',
            threshold: 70,
            status: cacheStats.hitRate < 0.7 ? 'warning' : 'normal'
          },
          size: { value: cacheStats.size, unit: 'keys' },
          memoryUsage: { value: cacheStats.memoryUsage / 1024 / 1024, unit: 'MB' }
        },
        timestamp: new Date()
      };

      this.broadcastSystemMetrics(cacheUpdate);

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  subscribeToDashboard(clientId: string, options: {
    userId?: string;
    metrics?: string[];
    updateInterval?: number;
    filters?: any;
  } = {}): void {
    const subscription: DashboardSubscription = {
      clientId,
      userId: options.userId,
      metrics: new Set(options.metrics || ['all']),
      updateInterval: options.updateInterval || 5000,
      lastUpdate: new Date(),
      filters: options.filters
    };

    this.subscriptions.set(clientId, subscription);
    websocketService.subscribeToTopic(clientId, 'dashboard', { subscription });

    // Send initial dashboard state
    this.sendInitialDashboardState(clientId);

    // Start periodic updates if requested
    if (subscription.updateInterval > 0) {
      this.startPeriodicUpdates(clientId);
    }

    websocketService.sendToClient(clientId, {
      type: 'dashboard_subscribed',
      data: {
        metrics: Array.from(subscription.metrics),
        updateInterval: subscription.updateInterval
      }
    });

    logger.info(`Dashboard subscription created for client: ${clientId}`);
  }

  unsubscribeFromDashboard(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    // Clear update interval
    const interval = this.updateIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(clientId);
    }

    websocketService.unsubscribeFromTopic(clientId, 'dashboard');
    this.subscriptions.delete(clientId);

    logger.info(`Dashboard subscription removed for client: ${clientId}`);
  }

  private sendInitialDashboardState(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    // Send current metrics
    const metrics = Array.from(this.metricsCache.values())
      .filter(metric => 
        subscription.metrics.has('all') || 
        subscription.metrics.has(metric.name)
      );

    // Send current job queue state
    const jobQueue = getJobQueueService();
    const queueStats = jobQueue.getStats();
    const activeJobs = jobQueue.getJobs({ status: 'running' });

    // Send current cost summary
    const costSummary = this.getCostSummary();

    websocketService.sendToClient(clientId, {
      type: 'dashboard_initial_state',
      data: {
        metrics,
        queueStats,
        activeJobs: activeJobs.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          progress: job.progress,
          startedAt: job.startedAt
        })),
        costSummary,
        timestamp: new Date()
      }
    });
  }

  private startPeriodicUpdates(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    const interval = setInterval(() => {
      this.sendDashboardUpdate(clientId);
    }, subscription.updateInterval);

    this.updateIntervals.set(clientId, interval);
  }

  private sendDashboardUpdate(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    const now = new Date();
    const metrics = Array.from(this.metricsCache.values())
      .filter(metric => 
        metric.timestamp > subscription.lastUpdate &&
        (subscription.metrics.has('all') || subscription.metrics.has(metric.name))
      );

    if (metrics.length > 0) {
      websocketService.sendToClient(clientId, {
        type: 'dashboard_metrics_update',
        data: {
          metrics,
          timestamp: now
        }
      });
    }

    subscription.lastUpdate = now;
  }

  updateSubscriptionFilters(clientId: string, filters: any): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    subscription.filters = filters;

    websocketService.sendToClient(clientId, {
      type: 'dashboard_filters_updated',
      data: { filters }
    });
  }

  private broadcastJobUpdate(update: JobProgressUpdate): void {
    // Update metrics
    const metric: DashboardMetric = {
      id: `job_${update.jobId}`,
      name: `job_progress_${update.type}`,
      value: update.progress,
      unit: 'percent',
      timestamp: new Date()
    };
    this.metricsCache.set(metric.id, metric);

    // Broadcast to subscribers
    this.subscriptions.forEach((subscription, clientId) => {
      // Apply filters
      if (subscription.filters?.jobTypes && 
          !subscription.filters.jobTypes.includes(update.type)) {
        return;
      }

      websocketService.sendToClient(clientId, {
        type: 'job_progress_update',
        data: update
      });
    });
  }

  private trackCost(cost: CostUpdate): void {
    const key = `${cost.service}_${cost.operation}`;
    const current = this.costAccumulator.get(key) || 0;
    this.costAccumulator.set(key, current + cost.cost);
  }

  private broadcastCostUpdate(cost: CostUpdate): void {
    // Update metrics
    const metric: DashboardMetric = {
      id: `cost_${cost.service}_${cost.operation}`,
      name: `cost_${cost.service}`,
      value: cost.cost,
      unit: cost.currency,
      timestamp: cost.timestamp
    };
    this.metricsCache.set(metric.id, metric);

    // Broadcast to subscribers
    this.subscriptions.forEach((subscription, clientId) => {
      // Apply filters
      if (subscription.filters?.services && 
          !subscription.filters.services.includes(cost.service)) {
        return;
      }

      websocketService.sendToClient(clientId, {
        type: 'cost_update',
        data: cost
      });

      // Send accumulated cost summary
      const summary = this.getCostSummary();
      websocketService.sendToClient(clientId, {
        type: 'cost_summary',
        data: summary
      });
    });
  }

  private broadcastSystemMetrics(metrics: SystemMetricUpdate): void {
    // Update cache
    Object.entries(metrics.metrics).forEach(([name, data]) => {
      const metric: DashboardMetric = {
        id: `system_${metrics.category}_${name}`,
        name: `${metrics.category}_${name}`,
        value: data.value,
        unit: data.unit,
        timestamp: metrics.timestamp
      };
      this.metricsCache.set(metric.id, metric);
    });

    // Broadcast to subscribers
    this.subscriptions.forEach((subscription, clientId) => {
      // Apply filters
      if (subscription.filters?.metricCategories && 
          !subscription.filters.metricCategories.includes(metrics.category)) {
        return;
      }

      websocketService.sendToClient(clientId, {
        type: 'system_metrics_update',
        data: metrics
      });
    });
  }

  private getCostSummary(): {
    total: number;
    byService: { [service: string]: number };
    currency: string;
    period: string;
  } {
    const byService: { [service: string]: number } = {};
    let total = 0;

    this.costAccumulator.forEach((cost, key) => {
      const [service] = key.split('_');
      byService[service] = (byService[service] || 0) + cost;
      total += cost;
    });

    return {
      total,
      byService,
      currency: 'USD',
      period: 'current_session'
    };
  }

  // Public methods for manual metric updates
  updateMetric(name: string, value: number | string, unit?: string): void {
    const metric: DashboardMetric = {
      id: `custom_${name}`,
      name,
      value,
      unit,
      timestamp: new Date()
    };
    this.metricsCache.set(metric.id, metric);

    // Trigger updates for subscribers
    this.subscriptions.forEach((subscription, clientId) => {
      if (subscription.metrics.has('all') || subscription.metrics.has(name)) {
        websocketService.sendToClient(clientId, {
          type: 'metric_update',
          data: metric
        });
      }
    });
  }

  recordCost(service: string, operation: string, cost: number, units: number, unitType: string): void {
    const costUpdate: CostUpdate = {
      service,
      operation,
      cost,
      currency: 'USD',
      units,
      unitType,
      timestamp: new Date()
    };

    eventEmitter.emit('cost:incurred', costUpdate);
  }

  // Get current dashboard stats
  getDashboardStats(): {
    activeSubscriptions: number;
    totalMetrics: number;
    totalCost: number;
    activeJobs: number;
  } {
    const jobQueue = getJobQueueService();
    const queueStats = jobQueue.getStats();
    const costSummary = this.getCostSummary();

    return {
      activeSubscriptions: this.subscriptions.size,
      totalMetrics: this.metricsCache.size,
      totalCost: costSummary.total,
      activeJobs: queueStats.running
    };
  }

  // Cleanup
  shutdown(): void {
    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();

    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }

    // Clear subscriptions
    this.subscriptions.clear();
    this.metricsCache.clear();
    this.costAccumulator.clear();

    // Remove event listeners
    this.removeAllListeners();
  }
}

export const dashboardBroadcastingService = new DashboardBroadcastingService();