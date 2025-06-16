import { Request, Response, NextFunction } from 'express';
import { JobType, JobPriority } from '../services/job-queue.service';
import { getJobQueueService, IJobQueueService } from '../services/job-queue.factory';
import { SentimentService } from '../services/sentiment.service';
import { DataService } from '../services/data.service';
import { SecurityService } from '../services/security.service';
import { FileStreamService } from '../services/file-stream.service';
import { registerAllHandlers } from '../services/job-handlers';
import { AppError } from '../middleware/error.middleware';

export class JobController {
  private jobQueue: IJobQueueService | null = null;
  private sentimentService: SentimentService;
  private dataService: DataService;
  private securityService: SecurityService;
  private fileStreamService: FileStreamService;

  constructor() {
    this.sentimentService = new SentimentService();
    this.dataService = new DataService();
    this.securityService = new SecurityService();
    this.fileStreamService = new FileStreamService();

    // Initialize async - will be ready when first request comes in
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.jobQueue = await getJobQueueService();
      
      // Register all job handlers
      registerAllHandlers(this.jobQueue, {
        sentimentService: this.sentimentService,
        dataService: this.dataService,
        securityService: this.securityService,
        fileStreamService: this.fileStreamService
      });

      // Set up event listeners for logging
      this.setupEventListeners();
      
      console.log('Job controller initialized successfully');
    } catch (error) {
      console.error('Failed to initialize job controller:', error);
    }
  }

  private async ensureJobQueue(): Promise<IJobQueueService> {
    if (!this.jobQueue) {
      this.jobQueue = await getJobQueueService();
    }
    return this.jobQueue;
  }

  private setupEventListeners(): void {
    if (!this.jobQueue) return;
    
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

      const jobQueue = await this.ensureJobQueue();
      const jobId = await jobQueue.addJob(type, data, { priority });

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
      const jobQueue = await this.ensureJobQueue();
      const job = await jobQueue.getJob(jobId);

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

  async getJobProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await this.ensureJobQueue();
      const job = await jobQueue.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }

      // Calculate detailed progress information
      const progressDetails = this.calculateProgressDetails(job);

      res.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          details: progressDetails,
          timestamps: {
            created: job.createdAt.toISOString(),
            started: job.startedAt?.toISOString(),
            completed: job.completedAt?.toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobId } = req.params;
      const jobQueue = await this.ensureJobQueue();
      const job = await jobQueue.getJob(jobId);

      if (!job) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }

      // Generate job event timeline
      const events = this.generateJobEvents(job);

      res.json({
        success: true,
        data: {
          jobId: job.id,
          events
        }
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

      const jobQueue = await this.ensureJobQueue();
      const jobs = await jobQueue.getJobs(filter);

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
      const jobQueue = await this.ensureJobQueue();
      const cancelled = await jobQueue.cancelJob(jobId);

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
      const jobQueue = await this.ensureJobQueue();
      const stats = await jobQueue.getStats();

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

      const jobQueue = await this.ensureJobQueue();
      const job = await jobQueue.waitForJob(jobId, timeout);

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

  private calculateProgressDetails(job: any): any {
    const now = new Date();
    const details: any = {
      phase: this.getJobPhase(job),
      percentage: job.progress,
    };

    // Calculate timing information
    if (job.startedAt) {
      const elapsedMs = now.getTime() - job.startedAt.getTime();
      details.elapsedTime = {
        seconds: Math.floor(elapsedMs / 1000),
        humanReadable: this.formatDuration(elapsedMs)
      };

      // Estimate remaining time based on progress
      if (job.progress > 0 && job.progress < 100) {
        const estimatedTotalMs = (elapsedMs / job.progress) * 100;
        const remainingMs = estimatedTotalMs - elapsedMs;
        details.estimatedTimeRemaining = {
          seconds: Math.floor(remainingMs / 1000),
          humanReadable: this.formatDuration(remainingMs)
        };
      }
    }

    // Add job-specific progress details
    if (job.type === 'sentiment_analysis_batch' && job.data) {
      const totalTexts = job.data.texts?.length || 0;
      const processedTexts = Math.floor((job.progress / 100) * totalTexts);
      details.itemsProcessed = processedTexts;
      details.totalItems = totalTexts;
      details.remainingItems = totalTexts - processedTexts;
    }

    return details;
  }

  private generateJobEvents(job: any): any[] {
    const events: Array<{
      type: string;
      timestamp: string;
      description: string;
    }> = [];

    events.push({
      type: 'created',
      timestamp: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
      description: `Job ${job.type} created with priority ${job.priority}`
    });

    if (job.startedAt) {
      events.push({
        type: 'started',
        timestamp: job.startedAt instanceof Date ? job.startedAt.toISOString() : job.startedAt,
        description: 'Job processing started'
      });
    }

    // Add progress milestones
    if (job.progress > 0) {
      const milestones = [25, 50, 75];
      milestones.forEach(milestone => {
        if (job.progress >= milestone) {
          let progressTimestamp: string;
          
          if (job.startedAt) {
            const startTime = job.startedAt instanceof Date ? job.startedAt.getTime() : new Date(job.startedAt).getTime();
            const endTime = job.completedAt ? 
              (job.completedAt instanceof Date ? job.completedAt.getTime() : new Date(job.completedAt).getTime()) :
              Date.now();
            const duration = endTime - startTime;
            const milestoneTime = startTime + (milestone / 100) * duration;
            progressTimestamp = new Date(milestoneTime).toISOString();
          } else {
            progressTimestamp = new Date().toISOString();
          }
          
          events.push({
            type: 'progress',
            timestamp: progressTimestamp,
            description: `${milestone}% completed`
          });
        }
      });
    }

    if (job.completedAt) {
      events.push({
        type: job.status,
        timestamp: job.completedAt.toISOString(),
        description: `Job ${job.status}${job.error ? ': ' + job.error : ''}`
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getJobPhase(job: any): string {
    switch (job.status) {
      case 'pending':
        return 'Queued';
      case 'running':
        if (job.progress < 25) return 'Initializing';
        if (job.progress < 75) return 'Processing';
        return 'Finalizing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}