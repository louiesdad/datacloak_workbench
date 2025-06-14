import { Request, Response, NextFunction } from 'express';
import { JobQueueService, JobType, JobPriority } from '../services/job-queue.service';
import { SentimentService } from '../services/sentiment.service';
import { DataService } from '../services/data.service';
import { SecurityService } from '../services/security.service';
import { FileStreamService } from '../services/file-stream.service';
import { registerAllHandlers } from '../services/job-handlers';
import { AppError } from '../middleware/error.middleware';

export class JobController {
  private jobQueue: JobQueueService;
  private sentimentService: SentimentService;
  private dataService: DataService;
  private securityService: SecurityService;
  private fileStreamService: FileStreamService;

  constructor() {
    this.jobQueue = new JobQueueService({ maxConcurrentJobs: 3 });
    this.sentimentService = new SentimentService();
    this.dataService = new DataService();
    this.securityService = new SecurityService();
    this.fileStreamService = new FileStreamService();

    // Register all job handlers
    registerAllHandlers(this.jobQueue, {
      sentimentService: this.sentimentService,
      dataService: this.dataService,
      securityService: this.securityService,
      fileStreamService: this.fileStreamService
    });

    // Set up event listeners for logging
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.jobQueue.on('job:added', (job) => {
      console.log(`Job added: ${job.id} (${job.type})`);
    });

    this.jobQueue.on('job:started', (job) => {
      console.log(`Job started: ${job.id} (${job.type})`);
    });

    this.jobQueue.on('job:progress', (job) => {
      console.log(`Job progress: ${job.id} - ${job.progress}%`);
    });

    this.jobQueue.on('job:completed', (job) => {
      console.log(`Job completed: ${job.id} (${job.type})`);
    });

    this.jobQueue.on('job:failed', (job) => {
      console.error(`Job failed: ${job.id} (${job.type}) - ${job.error}`);
    });
  }

  async createJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, data, priority = 'medium' } = req.body;

      // Validate job type
      const validTypes: JobType[] = ['sentiment_analysis_batch', 'file_processing', 'security_scan', 'data_export'];
      if (!validTypes.includes(type)) {
        throw new AppError('Invalid job type', 400, 'INVALID_JOB_TYPE');
      }

      // Validate priority
      const validPriorities: JobPriority[] = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        throw new AppError('Invalid job priority', 400, 'INVALID_JOB_PRIORITY');
      }

      // Validate job data based on type
      this.validateJobData(type, data);

      const jobId = this.jobQueue.addJob(type, data, { priority });

      res.status(201).json({
        success: true,
        data: {
          jobId,
          type,
          status: 'pending',
          priority,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = this.jobQueue.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }

      res.json({
        success: true,
        data: this.formatJob(job)
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, type, limit = 50 } = req.query;

      const filter: any = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      filter.limit = Math.min(parseInt(limit as string, 10), 100); // Max 100 jobs

      const jobs = this.jobQueue.getJobs(filter);

      res.json({
        success: true,
        data: {
          jobs: jobs.map(job => this.formatJob(job)),
          total: jobs.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const cancelled = this.jobQueue.cancelJob(jobId);

      if (!cancelled) {
        throw new AppError('Job not found or cannot be cancelled', 400, 'JOB_NOT_CANCELLABLE');
      }

      res.json({
        success: true,
        message: 'Job cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = this.jobQueue.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async waitForJob(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const { timeout = 30000 } = req.body;

      const job = await this.jobQueue.waitForJob(jobId, timeout);

      res.json({
        success: true,
        data: this.formatJob(job)
      });
    } catch (error) {
      next(error);
    }
  }

  private validateJobData(type: JobType, data: any): void {
    switch (type) {
      case 'sentiment_analysis_batch':
        if (!data.texts || !Array.isArray(data.texts) || data.texts.length === 0) {
          throw new AppError('Job data must include texts array', 400, 'INVALID_JOB_DATA');
        }
        if (data.texts.length > 10000) {
          throw new AppError('Maximum 10,000 texts per batch', 400, 'BATCH_TOO_LARGE');
        }
        break;

      case 'file_processing':
        if (!data.filePath || !data.datasetId) {
          throw new AppError('Job data must include filePath and datasetId', 400, 'INVALID_JOB_DATA');
        }
        break;

      case 'security_scan':
        if (!data.filePath || !data.datasetId) {
          throw new AppError('Job data must include filePath and datasetId', 400, 'INVALID_JOB_DATA');
        }
        break;

      case 'data_export':
        if (!data.datasetId || !data.format) {
          throw new AppError('Job data must include datasetId and format', 400, 'INVALID_JOB_DATA');
        }
        const validFormats = ['csv', 'json', 'xlsx'];
        if (!validFormats.includes(data.format)) {
          throw new AppError('Invalid export format', 400, 'INVALID_EXPORT_FORMAT');
        }
        break;

      default:
        throw new AppError('Unknown job type', 400, 'UNKNOWN_JOB_TYPE');
    }
  }

  private formatJob(job: any): any {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      error: job.error,
      result: job.result
    };
  }
}