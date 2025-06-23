import { Request, Response } from 'express';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { getSQLiteConnection } from '../database/sqlite-refactored';
import { ConfigService } from '../services/config.service';
import { connectionStatusService } from '../services/connection-status.service';
import { AppError } from '../middleware/error.middleware';

export class SystemHealthController {
  private configService: ConfigService;
  constructor() {
    this.configService = ConfigService.getInstance();
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        node: {
          version: process.version,
          memory: process.memoryUsage(),
          pid: process.pid
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus().length,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            percentUsed: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
          },
          loadAverage: os.loadavg()
        },
        services: await this.checkServices(),
        database: await this.checkDatabase(),
        storage: await this.checkStorage()
      };

      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get system metrics for monitoring
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        requests: {
          total: global.requestCount || 0,
          errors: global.errorCount || 0,
          avgResponseTime: global.avgResponseTime || 0
        },
        database: {
          connections: await this.getDatabaseMetrics(),
          queries: {
            total: global.queryCount || 0,
            slow: global.slowQueryCount || 0
          }
        },
        cache: {
          hits: global.cacheHits || 0,
          misses: global.cacheMisses || 0,
          hitRate: global.cacheHits ? 
            (global.cacheHits / (global.cacheHits + global.cacheMisses) * 100).toFixed(2) : 0
        },
        jobs: {
          queued: global.jobsQueued || 0,
          processing: global.jobsProcessing || 0,
          completed: global.jobsCompleted || 0,
          failed: global.jobsFailed || 0
        }
      };

      res.json(metrics);
    } catch (error) {
      throw new AppError('Failed to retrieve metrics', 500, 'METRICS_ERROR');
    }
  }

  /**
   * Get current configuration (sanitized)
   */
  async getConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config = this.configService.getAll();
      
      // Sanitize sensitive information
      const sanitized = this.sanitizeConfig(config);
      
      res.json({
        configuration: sanitized,
        environment: process.env.NODE_ENV,
        features: {
          datacloak: config.DATACLOAK_ENABLED || false,
          redis: config.REDIS_ENABLED || false,
          websocket: true, // Always enabled
          analytics: config.ENABLE_METRICS || true
        }
      });
    } catch (error) {
      throw new AppError('Failed to retrieve configuration', 500, 'CONFIG_ERROR');
    }
  }

  // Helper methods

  private async checkServices(): Promise<Record<string, any>> {
    const services: Record<string, any> = {};

    // Check WebSocket service
    const connStatus = connectionStatusService.getStatus();
    services.websocket = {
      status: connStatus.services.websocket,
      connections: connStatus.connectionCount
    };

    // Check Redis if enabled
    const redisEnabled = this.configService.get('REDIS_ENABLED') || false;
    if (redisEnabled) {
      services.redis = {
        status: 'checking',
        // Add Redis health check here
      };
    }

    // Check OpenAI service
    services.openai = {
      status: this.configService.get('OPENAI_API_KEY') ? 'configured' : 'not configured',
      model: this.configService.get('OPENAI_MODEL') || 'gpt-3.5-turbo'
    };

    return services;
  }

  private async checkDatabase(): Promise<Record<string, any>> {
    try {
      const db = await getSQLiteConnection();
      
      // Run a simple query to check connection
      const result = db.prepare('SELECT 1 as test').get() as { test: number };
      
      // Get database file stats
      const dbPath = path.join(__dirname, '../../data/datacloak.db');
      const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;

      return {
        status: result?.test === 1 ? 'connected' : 'error',
        type: 'SQLite',
        size: stats?.size || 0,
        lastModified: stats?.mtime || null
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkStorage(): Promise<Record<string, any>> {
    const paths = {
      data: path.join(__dirname, '../../data'),
      logs: path.join(__dirname, '../../logs'),
      uploads: path.join(__dirname, '../../uploads')
    };

    const storage: Record<string, any> = {};

    for (const [name, dirPath] of Object.entries(paths)) {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        const totalSize = files.reduce((sum, file) => {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          return sum + (stats.isFile() ? stats.size : 0);
        }, 0);

        storage[name] = {
          exists: true,
          files: files.length,
          size: totalSize,
          path: dirPath
        };
      } else {
        storage[name] = {
          exists: false,
          path: dirPath
        };
      }
    }

    return storage;
  }

  private async getDatabaseMetrics(): Promise<any> {
    try {
      // Get connection pool metrics if available
      return {
        active: 0, // Implement based on your connection pool
        idle: 0,
        total: 0
      };
    } catch (error) {
      return null;
    }
  }

  private sanitizeConfig(config: any): any {
    const sensitiveKeys = [
      'apiKey', 'password', 'secret', 'token', 'key',
      'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result: any = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveKeys.some(sensitive => 
          key.toLowerCase().includes(sensitive.toLowerCase())
        )) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = sanitize(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitize(config);
  }
}