import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  data: any;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export type JobType = 'sentiment_analysis_batch' | 'file_processing' | 'security_scan' | 'data_export';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'critical';

export interface JobOptions {
  priority?: JobPriority;
  maxRetries?: number;
  timeout?: number;
  delay?: number;
}

export interface JobHandler {
  (job: Job, updateProgress: (progress: number) => void): Promise<any>;
}

export class JobQueueService extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private runningJobs: Set<string> = new Set();
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private processingInterval?: NodeJS.Timeout;

  constructor(options?: { maxConcurrentJobs?: number }) {
    super();
    if (options?.maxConcurrentJobs) {
      this.maxConcurrentJobs = options.maxConcurrentJobs;
    }
  }

  /**
   * Add a job to the queue
   */
  addJob(type: JobType, data: any, options: JobOptions = {}): string {
    const jobId = uuidv4();
    const job: Job = {
      id: jobId,
      type,
      status: 'pending',
      priority: options.priority || 'medium',
      data,
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.emit('job:added', job);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Register a handler for a specific job type
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: {
    status?: JobStatus;
    type?: JobType;
    limit?: number;
  }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }

    if (filter?.type) {
      jobs = jobs.filter(job => job.type === filter.type);
    }

    // Sort by priority and creation time
    jobs.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    if (filter?.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      this.emit('job:cancelled', job);
      return true;
    }

    if (job.status === 'running') {
      job.status = 'cancelled';
      this.runningJobs.delete(jobId);
      this.emit('job:cancelled', job);
      return true;
    }

    return false;
  }

  /**
   * Remove completed/failed jobs older than specified time
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - olderThanMs);
    let removed = 0;

    for (const [id, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }

    return stats;
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processNextJobs();
    }, 1000); // Check every second

    this.emit('queue:started');
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    if (!this.isProcessing) return;

    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    this.emit('queue:stopped');
  }

  /**
   * Process next available jobs
   */
  private async processNextJobs(): Promise<void> {
    const availableSlots = this.maxConcurrentJobs - this.runningJobs.size;
    if (availableSlots <= 0) return;

    const pendingJobs = this.getJobs({ status: 'pending', limit: availableSlots });
    
    for (const job of pendingJobs) {
      if (this.runningJobs.size >= this.maxConcurrentJobs) break;
      this.processJob(job);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.failJob(job, `No handler registered for job type: ${job.type}`);
      return;
    }

    this.runningJobs.add(job.id);
    job.status = 'running';
    job.startedAt = new Date();
    this.emit('job:started', job);

    const updateProgress = (progress: number) => {
      job.progress = Math.max(0, Math.min(100, progress));
      this.emit('job:progress', job);
    };

    try {
      const result = await handler(job, updateProgress);
      this.completeJob(job, result);
    } catch (error) {
      this.failJob(job, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Mark job as completed
   */
  private completeJob(job: Job, result: any): void {
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    job.result = result;
    this.runningJobs.delete(job.id);
    this.emit('job:completed', job);
  }

  /**
   * Mark job as failed
   */
  private failJob(job: Job, error: string): void {
    job.status = 'failed';
    job.completedAt = new Date();
    job.error = error;
    this.runningJobs.delete(job.id);
    this.emit('job:failed', job);
  }

  /**
   * Wait for job completion
   */
  async waitForJob(jobId: string, timeoutMs: number = 30000): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new AppError('Job timeout', 408, 'JOB_TIMEOUT'));
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('job:completed', onCompleted);
        this.removeListener('job:failed', onFailed);
        this.removeListener('job:cancelled', onCancelled);
      };

      const onCompleted = (completedJob: Job) => {
        if (completedJob.id === jobId) {
          cleanup();
          resolve(completedJob);
        }
      };

      const onFailed = (failedJob: Job) => {
        if (failedJob.id === jobId) {
          cleanup();
          resolve(failedJob);
        }
      };

      const onCancelled = (cancelledJob: Job) => {
        if (cancelledJob.id === jobId) {
          cleanup();
          resolve(cancelledJob);
        }
      };

      this.on('job:completed', onCompleted);
      this.on('job:failed', onFailed);
      this.on('job:cancelled', onCancelled);
    });
  }
}