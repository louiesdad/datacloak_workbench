import { Request, Response, NextFunction } from 'express';
import { getJobQueueService } from '../services/job-queue.factory';
import { RedisJobQueueService } from '../services/redis-queue.service';
import { ConfigService } from '../services/config.service';
import { AppError } from '../middleware/error.middleware';

export class RedisQueueController {
  
  private async getRedisQueue(): Promise<RedisJobQueueService> {
    const jobQueue = await getJobQueueService();
    
    if (!(jobQueue instanceof RedisJobQueueService)) {
      throw new AppError('Redis queue not enabled', 400, 'REDIS_NOT_ENABLED');
    }
    
    return jobQueue;
  }

  async getDetailedStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configService = ConfigService.getInstance();
      const redisEnabled = configService.get('REDIS_ENABLED');
      
      if (!redisEnabled) {
        res.json({
          success: true,
          data: {
            type: 'in-memory',
            redis: {
              enabled: false,
              message: 'Redis queue is disabled. Using in-memory queue.'
            }
          }
        });
        return;
      }

      const redisQueue = await this.getRedisQueue();
      const stats = await redisQueue.getStats();
      
      res.json({
        success: true,
        data: {
          type: 'redis',
          ...stats,
          redis: {
            enabled: true,
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
            db: configService.get('REDIS_DB'),
            keyPrefix: configService.get('REDIS_KEY_PREFIX')
          },
          configuration: {
            maxConcurrentJobs: configService.get('JOB_QUEUE_MAX_CONCURRENT'),
            retryAttempts: configService.get('JOB_QUEUE_RETRY_ATTEMPTS'),
            retryDelay: configService.get('JOB_QUEUE_RETRY_DELAY'),
            deadLetterQueueEnabled: configService.get('JOB_QUEUE_ENABLE_DEAD_LETTER')
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getDeadLetterJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit = 100 } = req.query;
      const redisQueue = await this.getRedisQueue();
      
      const deadLetterJobs = await redisQueue.getDeadLetterJobs(Number(limit));
      
      res.json({
        success: true,
        data: {
          jobs: deadLetterJobs.map(job => ({
            id: job.id,
            type: job.type,
            status: job.status,
            priority: job.priority,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
            error: job.error,
            originalError: job.originalError,
            retryInfo: job.retryInfo
          })),
          total: deadLetterJobs.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async requeueDeadLetterJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const redisQueue = await this.getRedisQueue();
      
      const requeued = await redisQueue.requeueDeadLetterJob(jobId);
      
      if (!requeued) {
        throw new AppError('Job not found in dead letter queue or cannot be requeued', 400, 'JOB_NOT_REQUEUEABLE');
      }
      
      res.json({
        success: true,
        message: 'Job successfully requeued from dead letter queue'
      });
    } catch (error) {
      next(error);
    }
  }

  async getConnectionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configService = ConfigService.getInstance();
      const redisEnabled = configService.get('REDIS_ENABLED');
      
      if (!redisEnabled) {
        res.json({
          success: true,
          data: {
            connected: false,
            type: 'in-memory',
            message: 'Redis is disabled'
          }
        });
        return;
      }

      const redisQueue = await this.getRedisQueue();
      
      // Test Redis connection by trying to ping
      try {
        const redis = (redisQueue as any).redis;
        await redis.ping();
        
        res.json({
          success: true,
          data: {
            connected: true,
            type: 'redis',
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
            db: configService.get('REDIS_DB'),
            message: 'Redis connection is healthy'
          }
        });
      } catch (pingError) {
        res.json({
          success: true,
          data: {
            connected: false,
            type: 'redis',
            message: 'Redis connection failed',
            error: pingError instanceof Error ? pingError.message : String(pingError)
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  async getMemoryUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const redisQueue = await this.getRedisQueue();
      const redis = (redisQueue as any).redis;
      
      const memoryInfo = await redis.memory('usage');
      const info = await redis.info('memory');
      
      // Parse memory info
      const memoryLines = info.split('\r\n');
      const memoryData: Record<string, string> = {};
      
      memoryLines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryData[key] = value;
        }
      });
      
      res.json({
        success: true,
        data: {
          totalMemoryUsage: memoryInfo,
          usedMemory: parseInt(memoryData.used_memory || '0'),
          usedMemoryHuman: memoryData.used_memory_human,
          usedMemoryPeak: parseInt(memoryData.used_memory_peak || '0'),
          usedMemoryPeakHuman: memoryData.used_memory_peak_human,
          memoryFragmentationRatio: parseFloat(memoryData.mem_fragmentation_ratio || '0'),
          details: memoryData
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async cleanupJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { olderThanHours = 24 } = req.body;
      const olderThanMs = olderThanHours * 60 * 60 * 1000;
      
      const jobQueue = await getJobQueueService();
      const removedCount = await jobQueue.cleanup(olderThanMs);
      
      res.json({
        success: true,
        data: {
          removedJobs: removedCount,
          olderThanHours,
          message: `Cleaned up ${removedCount} jobs older than ${olderThanHours} hours`
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobRetryHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const redisQueue = await this.getRedisQueue();
      
      const job = await redisQueue.getJob(jobId);
      
      if (!job) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }
      
      const retryHistory = {
        jobId: job.id,
        currentAttempts: job.retryInfo?.attempts || 0,
        maxAttempts: 3, // From config
        lastAttempt: job.retryInfo?.lastAttempt,
        nextRetry: job.retryInfo?.nextRetry,
        originalError: job.originalError,
        currentError: job.error,
        isInDeadLetterQueue: job.status === 'failed' && (job.retryInfo?.attempts || 0) >= 3
      };
      
      res.json({
        success: true,
        data: retryHistory
      });
    } catch (error) {
      next(error);
    }
  }

  async getHealthMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configService = ConfigService.getInstance();
      const redisEnabled = configService.get('REDIS_ENABLED');
      
      if (!redisEnabled) {
        const jobQueue = await getJobQueueService();
        const stats = await jobQueue.getStats();
        
        res.json({
          success: true,
          data: {
            type: 'in-memory',
            healthy: true,
            stats,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
          }
        });
        return;
      }

      const redisQueue = await this.getRedisQueue();
      const redis = (redisQueue as any).redis;
      
      try {
        const [stats, ping, info] = await Promise.all([
          redisQueue.getStats(),
          redis.ping(),
          redis.info('server')
        ]);
        
        // Parse server info
        const serverLines = info.split('\r\n');
        const serverData: Record<string, string> = {};
        
        serverLines.forEach(line => {
          const [key, value] = line.split(':');
          if (key && value) {
            serverData[key] = value;
          }
        });
        
        const healthy = ping === 'PONG' && stats.running < stats.total * 0.8; // Less than 80% jobs running
        
        res.json({
          success: true,
          data: {
            type: 'redis',
            healthy,
            stats,
            redis: {
              ping: ping === 'PONG',
              version: serverData.redis_version,
              uptime: parseInt(serverData.uptime_in_seconds || '0'),
              connectedClients: parseInt(serverData.connected_clients || '0'),
              host: configService.get('REDIS_HOST'),
              port: configService.get('REDIS_PORT'),
              db: configService.get('REDIS_DB')
            },
            warnings: this.generateHealthWarnings(stats, serverData)
          }
        });
      } catch (redisError) {
        res.json({
          success: true,
          data: {
            type: 'redis',
            healthy: false,
            error: redisError instanceof Error ? redisError.message : String(redisError),
            message: 'Redis health check failed'
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  private generateHealthWarnings(stats: any, serverData: Record<string, string>): string[] {
    const warnings: string[] = [];
    
    // Check job queue health
    if (stats.failed > stats.completed * 0.1) {
      warnings.push('High failure rate detected in job queue');
    }
    
    if (stats.pending > 1000) {
      warnings.push('Large number of pending jobs');
    }
    
    if (stats.deadLetter && stats.deadLetter > 100) {
      warnings.push('Many jobs in dead letter queue');
    }
    
    // Check Redis health
    const memoryUsage = parseInt(serverData.used_memory || '0');
    const maxMemory = parseInt(serverData.maxmemory || '0');
    
    if (maxMemory > 0 && memoryUsage > maxMemory * 0.8) {
      warnings.push('Redis memory usage is high');
    }
    
    const connectedClients = parseInt(serverData.connected_clients || '0');
    if (connectedClients > 100) {
      warnings.push('High number of Redis connections');
    }
    
    return warnings;
  }
}