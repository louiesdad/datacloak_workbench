import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { eventEmitter } from '../services/event.service';

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  error?: string;
}

// In-memory metrics storage (consider using Redis for production)
class MetricsCollector {
  private metrics: RequestMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10k requests

  addMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift(); // Remove oldest
    }
  }

  getMetrics(options?: {
    startTime?: Date;
    endTime?: Date;
    path?: string;
    method?: string;
    statusCode?: number;
  }): RequestMetrics[] {
    let filtered = this.metrics;

    if (options?.startTime) {
      filtered = filtered.filter(m => m.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      filtered = filtered.filter(m => m.timestamp <= options.endTime!);
    }
    if (options?.path) {
      filtered = filtered.filter(m => m.path === options.path);
    }
    if (options?.method) {
      filtered = filtered.filter(m => m.method === options.method);
    }
    if (options?.statusCode) {
      filtered = filtered.filter(m => m.statusCode === options.statusCode);
    }

    return filtered;
  }

  getAggregatedMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    statusCodeDistribution: Record<number, number>;
    endpointDistribution: Record<string, number>;
    errorRate: number;
  } {
    const total = this.metrics.length;
    
    if (total === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        statusCodeDistribution: {},
        endpointDistribution: {},
        errorRate: 0
      };
    }

    const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;
    
    const statusCodeDist = this.metrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const endpointDist = this.metrics.reduce((acc, m) => {
      const key = `${m.method} ${m.path}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / total) * 100;

    return {
      totalRequests: total,
      averageResponseTime: avgResponseTime,
      statusCodeDistribution: statusCodeDist,
      endpointDistribution: endpointDist,
      errorRate: errorRate
    };
  }

  reset(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

// Request monitoring middleware
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  const originalSend = res.send;
  const originalJson = res.json;

  // Override response methods to capture metrics
  res.send = function(data: any): Response {
    res.send = originalSend;
    const duration = performance.now() - startTime;
    
    captureMetrics(req, res, duration);
    
    return res.send(data);
  };

  res.json = function(data: any): Response {
    res.json = originalJson;
    const duration = performance.now() - startTime;
    
    captureMetrics(req, res, duration);
    
    return res.json(data);
  };

  next();
};

function captureMetrics(req: Request, res: Response, duration: number): void {
  const metric: RequestMetrics = {
    method: req.method,
    path: req.route?.path || req.path,
    statusCode: res.statusCode,
    duration: Math.round(duration),
    timestamp: new Date(),
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress
  };

  // Add error if present
  if (res.statusCode >= 400 && res.locals.error) {
    metric.error = res.locals.error;
  }

  metricsCollector.addMetric(metric);

  // Emit metrics event
  eventEmitter.emit('metrics:request', metric);

  // Log slow requests
  if (duration > 1000) { // Over 1 second
    console.warn(`Slow request detected: ${metric.method} ${metric.path} took ${duration}ms`);
  }
}

// Performance monitoring endpoint handler
export const getMetricsHandler = (req: Request, res: Response): void => {
  const {
    startTime,
    endTime,
    path,
    method,
    statusCode,
    aggregate
  } = req.query;

  if (aggregate === 'true') {
    res.json(metricsCollector.getAggregatedMetrics());
  } else {
    const metrics = metricsCollector.getMetrics({
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
      path: path as string,
      method: method as string,
      statusCode: statusCode ? parseInt(statusCode as string) : undefined
    });

    res.json({
      count: metrics.length,
      metrics: metrics.slice(-100) // Return last 100 metrics
    });
  }
};

// System health metrics
export const getSystemMetrics = async (): Promise<{
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: Date;
}> => {
  const memUsage = process.memoryUsage();
  const totalMem = require('os').totalmem();
  const freeMem = require('os').freemem();
  const usedMem = totalMem - freeMem;

  return {
    cpu: {
      usage: process.cpuUsage().user / 1000000, // Convert to seconds
      cores: require('os').cpus().length
    },
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100
    },
    uptime: process.uptime(),
    timestamp: new Date()
  };
};