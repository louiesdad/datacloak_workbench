import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import { getSSEService } from './sse.service';
import { eventEmitter, EventTypes } from './event.service';

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

export type JobType = 'sentiment_analysis_batch' | 'file_processing' | 'security_scan' | 'data_export' | 'large_dataset_risk_assessment' | 'batch_pattern_validation' | 'compliance_framework_analysis';
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
    
    // Emit WebSocket event for job creation
    eventEmitter.emit(EventTypes.JOB_CREATED, {
      jobId,
      type,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt
    });

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
   * Get all jobs
   */
  getAllJobs(): Job[] {
    return this.getJobs();
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: JobStatus): Job[] {
    return this.getJobs({ status });
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
      
      // Emit WebSocket event for job cancellation
      eventEmitter.emit(EventTypes.JOB_CANCELLED, {
        jobId,
        type: job.type,
        status: job.status,
        cancelledAt: new Date()
      });
      
      return true;
    }

    if (job.status === 'running') {
      // Don't allow cancelling running jobs in current implementation
      return false;
    }

    return false;
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): number {
    let removed = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === 'completed') {
        this.jobs.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Get job history (completed and failed jobs)
   */
  getJobHistory(limit?: number): Job[] {
    const history = Array.from(this.jobs.values())
      .filter(job => job.status === 'completed' || job.status === 'failed')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
    
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Update job data
   */
  updateJobData(jobId: string, data: any): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    
    job.data = data;
    return true;
  }

  /**
   * Retry a failed job
   */
  retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') return false;
    
    job.status = 'pending';
    job.error = undefined;
    job.startedAt = undefined;
    job.completedAt = undefined;
    job.progress = 0;
    
    this.emit('job:retry', job);
    return true;
  }

  /**
   * Update job priority
   */
  updateJobPriority(jobId: string, priority: JobPriority): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'running') return false;
    
    job.priority = priority;
    return true;
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
   * Process jobs (public for testing)
   */
  async processJobs(): Promise<void> {
    return this.processNextJobs();
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
      // Leave job as pending if no handler is registered
      return;
    }

    this.runningJobs.add(job.id);
    job.status = 'running';
    job.startedAt = new Date();
    this.emit('job:started', job);
    
    // Send SSE event
    try {
      const sseService = getSSEService();
      if (sseService && 'broadcast' in sseService && typeof sseService.broadcast === 'function') {
        sseService.broadcast({
          event: 'job:update',
          data: {
            jobId: job.id,
            type: job.type,
            status: 'running',
            progress: 0
          }
        });
      }
    } catch (error) {
      // SSE service might not be available in tests
    }

    const updateProgress = (progress: number) => {
      job.progress = Math.max(0, Math.min(100, progress));
      this.emit('job:progress', { jobId: job.id, progress: job.progress, job });
      
      // Send SSE progress event
      try {
        const sseService = getSSEService();
        if (sseService && 'sendJobProgress' in sseService && typeof sseService.sendJobProgress === 'function') {
          sseService.sendJobProgress(job.id, job.progress, `Processing ${job.type}`);
        }
      } catch (error) {
        // SSE service might not be available in tests
      }
      
      // Emit WebSocket event for job progress
      eventEmitter.emit(EventTypes.JOB_PROGRESS, {
        jobId: job.id,
        type: job.type,
        progress: job.progress,
        status: job.status
      });
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
    
    // Send SSE completion event
    try {
      const sseService = getSSEService();
      if (sseService) {
        if ('sendJobStatus' in sseService && typeof sseService.sendJobStatus === 'function') {
          sseService.sendJobStatus(job.id, 'completed', result);
        } else if ('broadcast' in sseService && typeof sseService.broadcast === 'function') {
          sseService.broadcast({
            event: 'job:update',
            data: {
              jobId: job.id,
              type: job.type,
              status: 'completed',
              result
            }
          });
        }
      }
    } catch (error) {
      // SSE service might not be available in tests
    }
    
    // Emit WebSocket event for job completion
    eventEmitter.emit(EventTypes.JOB_COMPLETE, {
      jobId: job.id,
      type: job.type,
      status: job.status,
      result: result,
      completedAt: job.completedAt
    });
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
    
    // Send SSE failure event
    const sseService = getSSEService();
    if (sseService) {
      if (typeof sseService.sendJobStatus === 'function') {
        sseService.sendJobStatus(job.id, 'failed', undefined, error);
      } else {
        sseService.broadcast({
          event: 'job:update',
          data: {
            jobId: job.id,
            type: job.type,
            status: 'failed',
            error
          }
        });
      }
    }
    
    // Emit WebSocket event for job failure
    eventEmitter.emit(EventTypes.JOB_FAILED, {
      jobId: job.id,
      type: job.type,
      status: job.status,
      error: error,
      completedAt: job.completedAt
    });
    
    this.processNextJobs();
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