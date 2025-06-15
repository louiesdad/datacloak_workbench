import * as os from 'os';
import { EventEmitter } from 'events';
import { AppError } from '../middleware/error.middleware';

export interface MemoryMetrics {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  percentUsed: number;
  rss: number; // Resident Set Size
}

export interface MemoryThresholds {
  warning: number; // Percentage (0-100)
  critical: number; // Percentage (0-100)
  maxHeapSize?: number; // Bytes
}

export interface MemoryAlert {
  level: 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  recommendations: string[];
}

export interface MemoryHistory {
  metrics: MemoryMetrics[];
  alerts: MemoryAlert[];
  startTime: Date;
  averageUsage: number;
  peakUsage: number;
  gcCount: number;
}

export class MemoryMonitorService extends EventEmitter {
  private static instance: MemoryMonitorService;
  
  private readonly DEFAULT_THRESHOLDS: MemoryThresholds = {
    warning: 70,
    critical: 85,
    maxHeapSize: 1024 * 1024 * 1024 // 1GB default
  };

  private monitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private metrics: MemoryMetrics[] = [];
  private alerts: MemoryAlert[] = [];
  private thresholds: MemoryThresholds;
  private gcCount = 0;
  private startTime: Date;
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly MONITORING_INTERVAL = 1000; // 1 second

  private constructor() {
    super();
    this.thresholds = { ...this.DEFAULT_THRESHOLDS };
    this.startTime = new Date();
    this.setupGCMonitoring();
  }

  static getInstance(): MemoryMonitorService {
    if (!MemoryMonitorService.instance) {
      MemoryMonitorService.instance = new MemoryMonitorService();
    }
    return MemoryMonitorService.instance;
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(thresholds?: Partial<MemoryThresholds>): void {
    if (this.monitoring) {
      return;
    }

    if (thresholds) {
      this.thresholds = { ...this.thresholds, ...thresholds };
    }

    this.monitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.MONITORING_INTERVAL);

    this.emit('monitoring:started', { thresholds: this.thresholds });
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('monitoring:stopped');
  }

  /**
   * Get current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: new Date(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      totalMemory: totalMem,
      freeMemory: freeMem,
      usedMemory: usedMem,
      percentUsed: (usedMem / totalMem) * 100,
      rss: memUsage.rss
    };
  }

  /**
   * Get memory history
   */
  getHistory(duration?: number): MemoryHistory {
    let filteredMetrics = this.metrics;
    
    if (duration) {
      const cutoff = new Date(Date.now() - duration);
      filteredMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    }

    const avgUsage = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + m.percentUsed, 0) / filteredMetrics.length
      : 0;

    const peakUsage = filteredMetrics.length > 0
      ? Math.max(...filteredMetrics.map(m => m.percentUsed))
      : 0;

    return {
      metrics: filteredMetrics,
      alerts: this.alerts,
      startTime: this.startTime,
      averageUsage: avgUsage,
      peakUsage: peakUsage,
      gcCount: this.gcCount
    };
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): { success: boolean; message: string } {
    if (global.gc) {
      try {
        const before = process.memoryUsage().heapUsed;
        global.gc();
        const after = process.memoryUsage().heapUsed;
        const freed = before - after;
        
        return {
          success: true,
          message: `Garbage collection completed. Freed ${this.formatBytes(freed)}`
        };
      } catch (error) {
        return {
          success: false,
          message: `GC failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    } else {
      return {
        success: false,
        message: 'Garbage collection not available. Run with --expose-gc flag'
      };
    }
  }

  /**
   * Get memory recommendations based on current usage
   */
  getRecommendations(): string[] {
    const current = this.getCurrentMetrics();
    const recommendations: string[] = [];

    if (current.percentUsed > this.thresholds.critical) {
      recommendations.push('Critical memory usage detected. Consider:');
      recommendations.push('- Implementing data streaming for large operations');
      recommendations.push('- Reducing concurrent operations');
      recommendations.push('- Increasing available memory');
      recommendations.push('- Clearing caches and temporary data');
    } else if (current.percentUsed > this.thresholds.warning) {
      recommendations.push('High memory usage detected. Consider:');
      recommendations.push('- Monitoring for memory leaks');
      recommendations.push('- Optimizing data structures');
      recommendations.push('- Implementing pagination for large datasets');
    }

    if (current.heapUsed > current.heapTotal * 0.9) {
      recommendations.push('Heap memory nearly exhausted:');
      recommendations.push('- Force garbage collection if possible');
      recommendations.push('- Increase Node.js heap size with --max-old-space-size');
    }

    if (this.metrics.length > 100) {
      const recentMetrics = this.metrics.slice(-100);
      const trend = this.calculateMemoryTrend(recentMetrics);
      
      if (trend > 1) { // 1MB/minute growth
        recommendations.push('Memory usage growing rapidly:');
        recommendations.push('- Check for memory leaks');
        recommendations.push('- Review recent code changes');
        recommendations.push('- Use memory profiling tools');
      }
    }

    return recommendations;
  }

  /**
   * Clear memory history
   */
  clearHistory(): void {
    this.metrics = [];
    this.alerts = [];
    this.emit('history:cleared');
  }

  /**
   * Get memory statistics
   */
  getStatistics(): {
    current: MemoryMetrics;
    average: Partial<MemoryMetrics>;
    peak: Partial<MemoryMetrics>;
    trend: 'stable' | 'increasing' | 'decreasing';
    gcFrequency: number;
    alertCount: number;
  } {
    const current = this.getCurrentMetrics();
    
    if (this.metrics.length === 0) {
      return {
        current,
        average: {},
        peak: {},
        trend: 'stable',
        gcFrequency: 0,
        alertCount: 0
      };
    }

    const average: Partial<MemoryMetrics> = {
      heapUsed: this.metrics.reduce((sum, m) => sum + m.heapUsed, 0) / this.metrics.length,
      heapTotal: this.metrics.reduce((sum, m) => sum + m.heapTotal, 0) / this.metrics.length,
      percentUsed: this.metrics.reduce((sum, m) => sum + m.percentUsed, 0) / this.metrics.length
    };

    const peak: Partial<MemoryMetrics> = {
      heapUsed: Math.max(...this.metrics.map(m => m.heapUsed)),
      heapTotal: Math.max(...this.metrics.map(m => m.heapTotal)),
      percentUsed: Math.max(...this.metrics.map(m => m.percentUsed))
    };

    const recentMetrics = this.metrics.slice(-20);
    const trend = this.calculateTrend(recentMetrics);

    const runtime = (Date.now() - this.startTime.getTime()) / 1000 / 60; // minutes
    const gcFrequency = runtime > 0 ? this.gcCount / runtime : 0;

    return {
      current,
      average,
      peak,
      trend,
      gcFrequency,
      alertCount: this.alerts.length
    };
  }

  /**
   * Set up garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    if (global.gc) {
      const originalGC = global.gc;
      // Override the global gc function to add monitoring
      (global as any).gc = () => {
        this.gcCount++;
        this.emit('gc:performed', { count: this.gcCount });
        originalGC();
      };
    }
  }

  /**
   * Collect memory metrics
   */
  private collectMetrics(): void {
    const metrics = this.getCurrentMetrics();
    
    // Store metrics
    this.metrics.push(metrics);
    
    // Trim history if too large
    if (this.metrics.length > this.MAX_HISTORY_SIZE) {
      this.metrics = this.metrics.slice(-this.MAX_HISTORY_SIZE);
    }

    // Check thresholds
    this.checkThresholds(metrics);

    // Emit metrics event
    this.emit('metrics:collected', metrics);
  }

  /**
   * Check memory thresholds and generate alerts
   */
  private checkThresholds(metrics: MemoryMetrics): void {
    const alerts: MemoryAlert[] = [];

    // Check system memory
    if (metrics.percentUsed > this.thresholds.critical) {
      alerts.push({
        level: 'critical',
        metric: 'systemMemory',
        currentValue: metrics.percentUsed,
        threshold: this.thresholds.critical,
        message: `System memory usage (${metrics.percentUsed.toFixed(1)}%) exceeded critical threshold`,
        timestamp: new Date(),
        recommendations: [
          'Immediate action required',
          'Consider stopping non-critical operations',
          'Force garbage collection if possible'
        ]
      });
    } else if (metrics.percentUsed > this.thresholds.warning) {
      alerts.push({
        level: 'warning',
        metric: 'systemMemory',
        currentValue: metrics.percentUsed,
        threshold: this.thresholds.warning,
        message: `System memory usage (${metrics.percentUsed.toFixed(1)}%) exceeded warning threshold`,
        timestamp: new Date(),
        recommendations: [
          'Monitor memory usage closely',
          'Consider optimizing memory-intensive operations'
        ]
      });
    }

    // Check heap memory
    const heapPercent = (metrics.heapUsed / metrics.heapTotal) * 100;
    if (heapPercent > 90) {
      alerts.push({
        level: 'critical',
        metric: 'heapMemory',
        currentValue: heapPercent,
        threshold: 90,
        message: `Heap memory usage (${heapPercent.toFixed(1)}%) is critically high`,
        timestamp: new Date(),
        recommendations: [
          'Heap exhaustion imminent',
          'Force garbage collection',
          'Increase heap size with --max-old-space-size'
        ]
      });
    }

    // Check against max heap size if configured
    if (this.thresholds.maxHeapSize && metrics.heapUsed > this.thresholds.maxHeapSize) {
      alerts.push({
        level: 'critical',
        metric: 'heapSize',
        currentValue: metrics.heapUsed,
        threshold: this.thresholds.maxHeapSize,
        message: `Heap size (${this.formatBytes(metrics.heapUsed)}) exceeded maximum allowed`,
        timestamp: new Date(),
        recommendations: [
          'Application may crash soon',
          'Reduce memory usage immediately'
        ]
      });
    }

    // Store and emit alerts
    for (const alert of alerts) {
      this.alerts.push(alert);
      this.emit('alert:triggered', alert);
    }

    // Trim alerts history
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Calculate memory usage trend
   */
  private calculateTrend(metrics: MemoryMetrics[]): 'stable' | 'increasing' | 'decreasing' {
    if (metrics.length < 3) {
      return 'stable';
    }

    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

    const avgFirst = firstHalf.reduce((sum, m) => sum + m.heapUsed, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, m) => sum + m.heapUsed, 0) / secondHalf.length;

    const difference = avgSecond - avgFirst;
    const percentChange = (difference / avgFirst) * 100;

    if (percentChange > 10) {
      return 'increasing';
    } else if (percentChange < -10) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Calculate memory growth rate (bytes per minute)
   */
  private calculateMemoryTrend(metrics: MemoryMetrics[]): number {
    if (metrics.length < 2) {
      return 0;
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const timeDiff = (last.timestamp.getTime() - first.timestamp.getTime()) / 1000 / 60; // minutes
    
    if (timeDiff === 0) {
      return 0;
    }

    return (last.heapUsed - first.heapUsed) / timeDiff;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        history: this.getHistory(),
        statistics: this.getStatistics(),
        recommendations: this.getRecommendations()
      }, null, 2);
    } else {
      // CSV format
      const headers = [
        'timestamp',
        'heapUsed',
        'heapTotal',
        'percentUsed',
        'rss',
        'external',
        'arrayBuffers'
      ];
      
      const rows = [headers.join(',')];
      
      for (const metric of this.metrics) {
        rows.push([
          metric.timestamp.toISOString(),
          metric.heapUsed,
          metric.heapTotal,
          metric.percentUsed.toFixed(2),
          metric.rss,
          metric.external,
          metric.arrayBuffers
        ].join(','));
      }
      
      return rows.join('\n');
    }
  }
}