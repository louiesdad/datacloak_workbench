import { Request, Response } from 'express';
import { MemoryMonitorService } from '../services/memory-monitor.service';
import { AppError } from '../middleware/error.middleware';

export class MonitoringController {
  private memoryMonitor: MemoryMonitorService;

  constructor() {
    this.memoryMonitor = MemoryMonitorService.getInstance();
  }

  /**
   * Get current memory metrics
   */
  async getCurrentMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.memoryMonitor.getCurrentMetrics();
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      throw new AppError(
        'Failed to get memory metrics',
        500,
        'METRICS_ERROR'
      );
    }
  }

  /**
   * Get memory history
   */
  async getMemoryHistory(req: Request, res: Response): Promise<void> {
    try {
      const duration = req.query.duration ? parseInt(req.query.duration as string) : undefined;
      const history = this.memoryMonitor.getHistory(duration);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      throw new AppError(
        'Failed to get memory history',
        500,
        'HISTORY_ERROR'
      );
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = this.memoryMonitor.getStatistics();
      const recommendations = this.memoryMonitor.getRecommendations();
      
      res.json({
        success: true,
        data: {
          statistics,
          recommendations
        }
      });
    } catch (error) {
      throw new AppError(
        'Failed to get memory statistics',
        500,
        'STATISTICS_ERROR'
      );
    }
  }

  /**
   * Start memory monitoring
   */
  async startMonitoring(req: Request, res: Response): Promise<void> {
    try {
      const { warning, critical, maxHeapSize } = req.body;
      
      this.memoryMonitor.startMonitoring({
        warning: warning || 70,
        critical: critical || 85,
        maxHeapSize: maxHeapSize || 1024 * 1024 * 1024
      });
      
      res.json({
        success: true,
        message: 'Memory monitoring started'
      });
    } catch (error) {
      throw new AppError(
        'Failed to start monitoring',
        500,
        'MONITORING_START_ERROR'
      );
    }
  }

  /**
   * Stop memory monitoring
   */
  async stopMonitoring(req: Request, res: Response): Promise<void> {
    try {
      this.memoryMonitor.stopMonitoring();
      
      res.json({
        success: true,
        message: 'Memory monitoring stopped'
      });
    } catch (error) {
      throw new AppError(
        'Failed to stop monitoring',
        500,
        'MONITORING_STOP_ERROR'
      );
    }
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection(req: Request, res: Response): Promise<void> {
    try {
      const result = this.memoryMonitor.forceGarbageCollection();
      
      res.json({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      throw new AppError(
        'Failed to force garbage collection',
        500,
        'GC_ERROR'
      );
    }
  }

  /**
   * Clear memory history
   */
  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      this.memoryMonitor.clearHistory();
      
      res.json({
        success: true,
        message: 'Memory history cleared'
      });
    } catch (error) {
      throw new AppError(
        'Failed to clear history',
        500,
        'CLEAR_HISTORY_ERROR'
      );
    }
  }

  /**
   * Export memory metrics
   */
  async exportMetrics(req: Request, res: Response): Promise<void> {
    try {
      const format = (req.query.format as 'json' | 'csv') || 'json';
      const data = this.memoryMonitor.exportMetrics(format);
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=memory-metrics.csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=memory-metrics.json');
      }
      
      res.send(data);
    } catch (error) {
      throw new AppError(
        'Failed to export metrics',
        500,
        'EXPORT_ERROR'
      );
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(req: Request, res: Response): Promise<void> {
    try {
      const os = require('os');
      
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        uptime: os.uptime(),
        nodeVersion: process.version,
        pid: process.pid,
        execPath: process.execPath,
        cwd: process.cwd()
      };
      
      res.json({
        success: true,
        data: systemInfo
      });
    } catch (error) {
      throw new AppError(
        'Failed to get system info',
        500,
        'SYSTEM_INFO_ERROR'
      );
    }
  }

  /**
   * WebSocket endpoint for real-time monitoring
   */
  setupWebSocket(ws: any): void {
    // Send initial metrics
    ws.send(JSON.stringify({
      type: 'initial',
      data: this.memoryMonitor.getCurrentMetrics()
    }));

    // Set up event listeners
    const metricsHandler = (metrics: any) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'metrics',
          data: metrics
        }));
      }
    };

    const alertHandler = (alert: any) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'alert',
          data: alert
        }));
      }
    };

    this.memoryMonitor.on('metrics:collected', metricsHandler);
    this.memoryMonitor.on('alert:triggered', alertHandler);

    // Clean up on disconnect
    ws.on('close', () => {
      this.memoryMonitor.removeListener('metrics:collected', metricsHandler);
      this.memoryMonitor.removeListener('alert:triggered', alertHandler);
    });

    // Handle incoming messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'start':
            this.memoryMonitor.startMonitoring(data.thresholds);
            break;
          case 'stop':
            this.memoryMonitor.stopMonitoring();
            break;
          case 'gc':
            const result = this.memoryMonitor.forceGarbageCollection();
            ws.send(JSON.stringify({
              type: 'gc-result',
              data: result
            }));
            break;
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
  }
}