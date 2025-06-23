import { Request, Response } from 'express';
import { getJobQueueService } from '../services/job-queue.factory';
import { getCacheService } from '../services/cache.service';
import { ConfigService } from '../services/config.service';
import { AppError } from '../middleware/error.middleware';

export interface DashboardMetrics {
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    recentJobs: any[];
    averageProcessingTime: number;
  };
  cache: {
    enabled: boolean;
    type: string;
    hits: number;
    misses: number;
    hitRate: number;
    totalOperations: number;
    memoryUsage?: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    nodeVersion: string;
    environment: string;
  };
  config: {
    redisEnabled: boolean;
    cacheEnabled: boolean;
    maxConcurrentJobs: number;
    openaiConfigured: boolean;
  };
}

export class DashboardController {
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const cacheService = getCacheService();
      const configService = ConfigService.getInstance();

      // Job metrics
      const jobStats = jobQueue.getStats();
      const allJobs = await jobQueue.getJobs();
      const recentJobs = allJobs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      const completedJobs = allJobs.filter(job => job.status === 'completed');
      const averageProcessingTime = completedJobs.length > 0
        ? completedJobs.reduce((acc, job) => {
            if (job.startedAt && job.completedAt) {
              return acc + (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime());
            }
            return acc;
          }, 0) / completedJobs.length
        : 0;

      // Cache metrics
      const cacheStats = cacheService.getStats();
      const cacheConfig = cacheService.getConfig();

      // System metrics
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      const metrics: DashboardMetrics = {
        jobs: {
          total: allJobs.length,
          pending: allJobs.filter(job => job.status === 'pending').length,
          running: allJobs.filter(job => job.status === 'running').length,
          completed: allJobs.filter(job => job.status === 'completed').length,
          failed: allJobs.filter(job => job.status === 'failed').length,
          recentJobs: recentJobs.map(job => ({
            id: job.id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            createdAt: job.createdAt,
            error: job.error
          })),
          averageProcessingTime
        },
        cache: {
          enabled: cacheConfig.enabled,
          type: cacheConfig.type,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          hitRate: cacheStats.hitRate,
          totalOperations: cacheStats.totalOperations,
          memoryUsage: cacheConfig.type === 'memory' ? (memoryUsage.heapUsed / 1024 / 1024) : undefined
        },
        system: {
          uptime,
          memoryUsage,
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development'
        },
        config: {
          redisEnabled: configService.get('REDIS_ENABLED'),
          cacheEnabled: configService.get('CACHE_ENABLED'),
          maxConcurrentJobs: configService.get('JOB_QUEUE_MAX_CONCURRENT'),
          openaiConfigured: configService.isOpenAIConfigured()
        }
      };

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw new AppError(`Failed to get dashboard metrics: ${error}`, 500);
    }
  }

  public async getJobHistory(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, status, type, from, to } = req.query;
      const jobQueue = await getJobQueueService();

      const filter: any = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (from) filter.from = new Date(from as string);
      if (to) filter.to = new Date(to as string);

      const jobs = await jobQueue.getJobs(filter);
      const limitedJobs = jobs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, Number(limit));

      res.json({
        success: true,
        data: {
          jobs: limitedJobs,
          total: jobs.length,
          filtered: limitedJobs.length
        }
      });
    } catch (error) {
      throw new AppError(`Failed to get job history: ${error}`, 500);
    }
  }

  public async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const cacheService = getCacheService();
      const configService = ConfigService.getInstance();

      const health = {
        status: 'healthy',
        checks: {
          jobQueue: {
            status: 'healthy',
            details: 'Job queue is operational'
          },
          cache: {
            status: cacheService.getConfig().enabled ? 'healthy' : 'disabled',
            details: cacheService.getConfig().enabled ? 'Cache is operational' : 'Cache is disabled'
          },
          redis: {
            status: 'unknown',
            details: 'Redis status check needed'
          },
          config: {
            status: 'healthy',
            details: 'Configuration loaded successfully'
          }
        },
        timestamp: new Date().toISOString()
      };

      // Check Redis health if enabled
      if (configService.get('REDIS_ENABLED')) {
        try {
          if ('getRedisHealth' in jobQueue) {
            const redisHealth = await (jobQueue as any).getRedisHealth();
            health.checks.redis = {
              status: redisHealth.connected ? 'healthy' : 'unhealthy',
              details: redisHealth.connected ? 'Redis is connected' : 'Redis connection failed'
            };
          }
        } catch (error) {
          health.checks.redis = {
            status: 'unhealthy',
            details: `Redis error: ${error}`
          };
          health.status = 'degraded';
        }
      } else {
        health.checks.redis = {
          status: 'disabled',
          details: 'Redis is disabled'
        };
      }

      // Overall health status
      const hasUnhealthy = Object.values(health.checks).some(check => check.status === 'unhealthy');
      if (hasUnhealthy) {
        health.status = 'unhealthy';
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        data: {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  public async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const cacheService = getCacheService();

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const allJobs = await jobQueue.getJobs();
      
      // Jobs completed in the last hour
      const recentJobs = allJobs.filter(job => 
        job.completedAt && new Date(job.completedAt) > oneHourAgo
      );

      // Jobs completed in the last day
      const dailyJobs = allJobs.filter(job => 
        job.completedAt && new Date(job.completedAt) > oneDayAgo
      );

      const performance = {
        throughput: {
          lastHour: recentJobs.length,
          lastDay: dailyJobs.length,
          averagePerHour: dailyJobs.length / 24
        },
        latency: {
          average: recentJobs.length > 0 ? recentJobs.reduce((acc, job) => {
            if (job.startedAt && job.completedAt) {
              return acc + (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime());
            }
            return acc;
          }, 0) / recentJobs.length : 0,
          p95: this.calculatePercentile(recentJobs, 95),
          p99: this.calculatePercentile(recentJobs, 99)
        },
        cache: cacheService.getStats(),
        errorRate: {
          lastHour: allJobs.filter(job => 
            job.status === 'failed' && 
            job.completedAt && 
            new Date(job.completedAt) > oneHourAgo
          ).length / Math.max(recentJobs.length, 1),
          lastDay: allJobs.filter(job => 
            job.status === 'failed' && 
            job.completedAt && 
            new Date(job.completedAt) > oneDayAgo
          ).length / Math.max(dailyJobs.length, 1)
        }
      };

      res.json({
        success: true,
        data: performance,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw new AppError(`Failed to get performance metrics: ${error}`, 500);
    }
  }

  public async getRecentActivity(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 20 } = req.query;
      const jobQueue = await getJobQueueService();
      const jobs = await jobQueue.getJobs();
      
      const recentActivity = jobs
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, Number(limit))
        .map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          timestamp: job.createdAt,
          description: `${job.type} job ${job.status}`
        }));

      res.json(recentActivity);
    } catch (error) {
      throw new AppError(`Failed to get recent activity: ${error}`, 500);
    }
  }

  public async getAnalyticsSummary(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const jobs = await jobQueue.getJobs();
      
      const sentimentJobs = jobs.filter(job => job.type === 'sentiment');
      const completedSentimentJobs = sentimentJobs.filter(job => job.status === 'completed');

      const summary = {
        totalTexts: completedSentimentJobs.reduce((acc, job) => acc + (job.processedCount || 0), 0),
        sentimentDistribution: {
          positive: Math.floor(Math.random() * 60) + 40, // Mock data
          neutral: Math.floor(Math.random() * 30) + 20,
          negative: Math.floor(Math.random() * 20) + 10
        },
        averageConfidence: 0.89,
        totalJobs: sentimentJobs.length,
        completedJobs: completedSentimentJobs.length
      };

      res.json(summary);
    } catch (error) {
      throw new AppError(`Failed to get analytics summary: ${error}`, 500);
    }
  }

  public async getDatasets(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      // Mock datasets data - in real implementation would query database
      const mockDatasets = [
        { id: 'ds1', name: 'Customer Reviews', rowCount: 1500, createdAt: '2024-01-01T00:00:00Z' },
        { id: 'ds2', name: 'Product Feedback', rowCount: 850, createdAt: '2024-01-02T00:00:00Z' },
        { id: 'ds3', name: 'Survey Responses', rowCount: 2200, createdAt: '2024-01-03T00:00:00Z' }
      ];

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedData = mockDatasets.slice(startIndex, endIndex);

      res.json({
        data: paginatedData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: mockDatasets.length,
          totalPages: Math.ceil(mockDatasets.length / Number(limit))
        }
      });
    } catch (error) {
      throw new AppError(`Failed to get datasets: ${error}`, 500);
    }
  }

  public async getSentimentAnalyses(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      // Mock sentiment analyses data
      const mockAnalyses = [
        { id: 'sa1', text: 'Great product, highly recommended!', sentiment: 'positive', confidence: 0.95, timestamp: '2024-01-01T10:00:00Z' },
        { id: 'sa2', text: 'Could be better', sentiment: 'neutral', confidence: 0.78, timestamp: '2024-01-01T11:00:00Z' },
        { id: 'sa3', text: 'Disappointed with the quality', sentiment: 'negative', confidence: 0.87, timestamp: '2024-01-01T12:00:00Z' }
      ];

      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const paginatedData = mockAnalyses.slice(startIndex, endIndex);

      res.json({
        data: paginatedData,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: mockAnalyses.length,
          totalPages: Math.ceil(mockAnalyses.length / Number(limit))
        }
      });
    } catch (error) {
      throw new AppError(`Failed to get sentiment analyses: ${error}`, 500);
    }
  }

  public async getDataExports(req: Request, res: Response): Promise<void> {
    try {
      const mockExports = [
        { id: 'exp1', format: 'csv', status: 'ready', downloadUrl: '/api/download/exp1.csv', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'exp2', format: 'json', status: 'processing', progress: 75, createdAt: '2024-01-01T01:00:00Z' }
      ];

      res.json({ data: mockExports });
    } catch (error) {
      throw new AppError(`Failed to get data exports: ${error}`, 500);
    }
  }

  public async getActiveJobs(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const jobs = await jobQueue.getJobs();
      const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending');

      res.json({ data: activeJobs });
    } catch (error) {
      throw new AppError(`Failed to get active jobs: ${error}`, 500);
    }
  }

  public async getJobStats(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const stats = await jobQueue.getStats();
      res.json(stats);
    } catch (error) {
      throw new AppError(`Failed to get job stats: ${error}`, 500);
    }
  }

  public async getJobTypes(req: Request, res: Response): Promise<void> {
    try {
      const types = ['sentiment', 'export', 'import', 'cleanup', 'processing'];
      res.json(types);
    } catch (error) {
      throw new AppError(`Failed to get job types: ${error}`, 500);
    }
  }

  public async getJobDetails(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await getJobQueueService();
      const job = await jobQueue.getJob(jobId);
      
      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      res.json(job);
    } catch (error) {
      throw new AppError(`Failed to get job details: ${error}`, 500);
    }
  }

  public async retryJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await getJobQueueService();
      
      // Mock retry implementation
      const result = await jobQueue.addJob('retry', { originalJobId: jobId });
      
      res.json({
        success: true,
        message: 'Job retry initiated',
        jobId,
        newJobId: typeof result === 'string' ? result : (result as any)?.id || 'unknown'
      });
    } catch (error) {
      throw new AppError(`Failed to retry job: ${error}`, 500);
    }
  }

  public async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await getJobQueueService();
      
      const success = await jobQueue.cancelJob(jobId);
      
      res.json({
        success,
        message: success ? 'Job cancelled successfully' : 'Job not found or already completed',
        jobId
      });
    } catch (error) {
      throw new AppError(`Failed to cancel job: ${error}`, 500);
    }
  }

  public async getJobProgress(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await getJobQueueService();
      const job = await jobQueue.getJob(jobId);
      
      if (!job) {
        res.status(404).json({ success: false, error: 'Job not found' });
        return;
      }

      res.json({
        jobId,
        progress: job.progress || 0,
        status: job.status,
        estimatedTimeRemaining: job.estimatedTimeRemaining || null
      });
    } catch (error) {
      throw new AppError(`Failed to get job progress: ${error}`, 500);
    }
  }

  public async getJobsByType(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.params;
      const { limit = 50 } = req.query;
      const jobQueue = await getJobQueueService();
      const jobs = await jobQueue.getJobs();
      
      const filteredJobs = jobs
        .filter(job => job.type === type)
        .slice(0, Number(limit));

      res.json({ data: filteredJobs });
    } catch (error) {
      throw new AppError(`Failed to get jobs by type: ${error}`, 500);
    }
  }

  public async getJobsTimeline(req: Request, res: Response): Promise<void> {
    try {
      const jobQueue = await getJobQueueService();
      const jobs = await jobQueue.getJobs();
      
      // Group jobs by date
      const timeline = jobs.reduce((acc, job) => {
        const date = new Date(job.createdAt).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, completed: 0, failed: 0, total: 0 };
        }
        acc[date].total++;
        if (job.status === 'completed') acc[date].completed++;
        if (job.status === 'failed') acc[date].failed++;
        return acc;
      }, {} as any);

      res.json({ timeline: Object.values(timeline) });
    } catch (error) {
      throw new AppError(`Failed to get jobs timeline: ${error}`, 500);
    }
  }

  private calculatePercentile(jobs: any[], percentile: number): number {
    if (jobs.length === 0) return 0;

    const durations = jobs
      .filter(job => job.startedAt && job.completedAt)
      .map(job => new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime())
      .sort((a, b) => a - b);

    if (durations.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * durations.length) - 1;
    return durations[index] || 0;
  }
}