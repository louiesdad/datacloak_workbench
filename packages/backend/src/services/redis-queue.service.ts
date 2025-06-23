import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import Redis, { Redis as RedisClient } from 'ioredis';
import { AppError } from '../middleware/error.middleware';
import { Job, JobType, JobStatus, JobPriority, JobOptions, JobHandler } from './job-queue.service';
import { getSSEService } from './sse.service';
import { eventEmitter, EventTypes } from './event.service';
import { ConfigService } from './config.service';

export interface RedisJobQueueConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxConcurrentJobs?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableDeadLetterQueue?: boolean;
}

export interface JobRetryInfo {
  attempts: number;
  lastAttempt?: Date;
  nextRetry?: Date;
}

export interface RedisJob extends Job {
  retryInfo?: JobRetryInfo;
  originalError?: string;
}

export interface RedisJobQueueDependencies {
  redis?: RedisClient;
  subscriberRedis?: RedisClient;
}

export class RedisJobQueueService extends EventEmitter {
  private redis: RedisClient;
  private subscriberRedis: RedisClient;
  private handlers: Map<JobType, JobHandler> = new Map();
  private runningJobs: Set<string> = new Set();
  private isProcessing = false;
  private maxConcurrentJobs: number;
  private retryAttempts: number;
  private retryDelay: number;
  private enableDeadLetterQueue: boolean;
  private keyPrefix: string;
  private processingInterval?: NodeJS.Timeout;
  private reconnectionTimeout?: NodeJS.Timeout;

  // Redis keys
  private readonly QUEUE_KEY = 'job:queue';
  private readonly PROCESSING_KEY = 'job:processing';
  private readonly COMPLETED_KEY = 'job:completed';
  private readonly FAILED_KEY = 'job:failed';
  private readonly DEAD_LETTER_KEY = 'job:dead-letter';
  private readonly JOB_DATA_KEY = 'job:data';
  private readonly STATS_KEY = 'job:stats';

  constructor(config?: RedisJobQueueConfig, dependencies?: RedisJobQueueDependencies) {
    super();
    
    // If Redis instances are provided via dependency injection, use them
    if (dependencies?.redis && dependencies?.subscriberRedis) {
      this.redis = dependencies.redis;
      this.subscriberRedis = dependencies.subscriberRedis;
    } else {
      // Otherwise, create new instances
      const configService = ConfigService.getInstance();
      const redisConfig = {
        host: config?.host || configService?.get('REDIS_HOST' as any) || 'localhost',
        port: config?.port || configService?.get('REDIS_PORT' as any) || 6379,
        password: config?.password || configService?.get('REDIS_PASSWORD' as any),
        db: config?.db || configService?.get('REDIS_DB' as any) || 0,
      };

      this.redis = new Redis(redisConfig);
      this.subscriberRedis = new Redis(redisConfig);
    }
    
    this.keyPrefix = config?.keyPrefix || 'dsw:';
    this.maxConcurrentJobs = config?.maxConcurrentJobs || 3;
    this.retryAttempts = config?.retryAttempts || 3;
    this.retryDelay = config?.retryDelay || 5000;
    this.enableDeadLetterQueue = config?.enableDeadLetterQueue !== false;

    this.setupRedisEvents();
    this.recoverJobs();
  }

  private setupRedisEvents(): void {
    // Enhanced Redis connection management with better error handling
    if (typeof this.redis.on === 'function') {
      this.redis.on('error', (error) => {
        console.error('Redis connection error:', error);
        this.emit('error', error);
        
        // Implement exponential backoff for reconnection
        this.scheduleReconnection();
      });

      this.redis.on('connect', () => {
        if (process.env.NODE_ENV !== 'test') {
          console.log('Connected to Redis');
        }
        this.emit('connected');
        this.resetReconnectionAttempts();
      });

      this.redis.on('close', () => {
        console.log('Redis connection closed');
        this.emit('disconnected');
      });

      this.redis.on('reconnecting', (time) => {
        console.log(`Redis reconnecting in ${time}ms`);
        this.emit('reconnecting', { time });
      });

      // Set connection timeout
      this.redis.on('lazyConnect', () => {
        console.log('Redis lazy connect initiated');
      });
    }

    // Enhanced subscriber Redis event handling
    if (typeof this.subscriberRedis.on === 'function') {
      this.subscriberRedis.on('error', (error) => {
        console.error('Redis subscriber error:', error);
        this.emit('subscriber:error', error);
      });

      this.subscriberRedis.on('connect', () => {
        if (process.env.NODE_ENV !== 'test') {
          console.log('Redis subscriber connected');
        }
        // Re-subscribe to channels after reconnection
        this.resubscribeToChannels();
      });
    }

    // Subscribe to job events with error handling
    this.resubscribeToChannels();

    if (typeof this.subscriberRedis.on === 'function') {
      this.subscriberRedis.on('message', (channel, message) => {
        try {
          const eventType = channel.replace(this.keyPrefix, '');
          const data = JSON.parse(message);
          this.emit(eventType, data);
        } catch (error) {
          console.error('Failed to parse Redis message:', error, { channel, message });
        }
      });
    }
  }

  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 10;
  private reconnectionDelay = 1000; // Start with 1 second

  private scheduleReconnection(): void {
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('Max reconnection attempts reached, giving up');
      this.emit('max_reconnection_attempts_reached');
      return;
    }

    // Clear existing timeout if any
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
    }

    const delay = Math.min(this.reconnectionDelay * Math.pow(2, this.reconnectionAttempts), 30000);
    this.reconnectionAttempts++;

    this.reconnectionTimeout = setTimeout(() => {
      console.log(`Attempting Redis reconnection (attempt ${this.reconnectionAttempts})`);
      // Redis client will automatically attempt to reconnect
      this.reconnectionTimeout = undefined;
    }, delay);
  }

  private resetReconnectionAttempts(): void {
    this.reconnectionAttempts = 0;
  }

  private resubscribeToChannels(): void {
    if (typeof this.subscriberRedis.subscribe === 'function') {
      try {
        this.subscriberRedis.subscribe(
          `${this.keyPrefix}job:added`,
          `${this.keyPrefix}job:completed`,
          `${this.keyPrefix}job:failed`
        );
      } catch (error) {
        console.error('Failed to resubscribe to Redis channels:', error);
      }
    }
  }

  private async recoverJobs(): Promise<void> {
    try {
      // Check if Redis methods exist (for mock compatibility)
      if (typeof this.redis.lrange !== 'function') {
        console.log('Redis mock detected, skipping job recovery');
        return;
      }

      // Move any stuck processing jobs back to queue
      const processingJobs = await this.redis.lrange(
        `${this.keyPrefix}${this.PROCESSING_KEY}`,
        0,
        -1
      );

      // Ensure processingJobs is an array
      const jobIds = Array.isArray(processingJobs) ? processingJobs : [];
      
      for (const jobId of jobIds) {
        const jobData = await this.redis.hget(
          `${this.keyPrefix}${this.JOB_DATA_KEY}`,
          jobId
        );
        
        if (jobData) {
          const job: RedisJob = JSON.parse(jobData);
          console.log(`Recovering stuck job: ${job.id}`);
          
          // Reset job status and move back to queue
          job.status = 'pending';
          job.startedAt = undefined;
          
          await this.redis.multi()
            .lrem(`${this.keyPrefix}${this.PROCESSING_KEY}`, 0, jobId)
            .zadd(`${this.keyPrefix}${this.QUEUE_KEY}`, this.getPriorityScore(job.priority), jobId)
            .hset(`${this.keyPrefix}${this.JOB_DATA_KEY}`, jobId, JSON.stringify(job))
            .exec();
        }
      }

      if (process.env.NODE_ENV !== 'test') {
        console.log('Job recovery complete');
      }
    } catch (error) {
      console.error('Failed to recover jobs:', error);
    }
  }

  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Add a job to the queue
   */
  async addJob(type: JobType, data: any, options: JobOptions = {}): Promise<string> {
    const jobId = uuidv4();
    const job: RedisJob = {
      id: jobId,
      type,
      status: 'pending',
      priority: options.priority || 'medium',
      data,
      progress: 0,
      createdAt: new Date(),
      retryInfo: {
        attempts: 0
      }
    };

    // Store job data
    await this.redis.hset(
      this.getRedisKey(this.JOB_DATA_KEY),
      jobId,
      JSON.stringify(job)
    );

    // Add to priority queue
    const score = this.getPriorityScore(job.priority);
    await this.redis.zadd(
      this.getRedisKey(this.QUEUE_KEY),
      score,
      jobId
    );

    // Increment stats
    await this.redis.hincrby(
      this.getRedisKey(this.STATS_KEY),
      'total',
      1
    );

    // Publish event
    await this.redis.publish(
      this.getRedisKey('job:added'),
      JSON.stringify(job)
    );

    this.emit('job:added', job);
    
    // Emit WebSocket event
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

  private getPriorityScore(priority: JobPriority): number {
    const now = Date.now();
    const priorityWeights = {
      critical: 0,
      high: 1000000,
      medium: 2000000,
      low: 3000000
    };
    return priorityWeights[priority] + now;
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
  async getJob(jobId: string): Promise<RedisJob | undefined> {
    const jobData = await this.redis.hget(
      this.getRedisKey(this.JOB_DATA_KEY),
      jobId
    );
    
    if (jobData) {
      return JSON.parse(jobData);
    }
    
    return undefined;
  }

  /**
   * Get all jobs
   */
  async getAllJobs(): Promise<RedisJob[]> {
    return this.getJobs();
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus): Promise<RedisJob[]> {
    return this.getJobs({ status });
  }

  /**
   * Get all jobs with optional filtering
   */
  async getJobs(filter?: {
    status?: JobStatus;
    type?: JobType;
    limit?: number;
  }): Promise<RedisJob[]> {
    const allJobIds = await this.redis.hkeys(
      this.getRedisKey(this.JOB_DATA_KEY)
    );

    // Ensure allJobIds is an array
    const jobIds = Array.isArray(allJobIds) ? allJobIds : [];
    const jobs: RedisJob[] = [];
    
    for (const jobId of jobIds) {
      const jobData = await this.redis.hget(
        this.getRedisKey(this.JOB_DATA_KEY),
        jobId
      );
      
      if (jobData) {
        const job: RedisJob = JSON.parse(jobData);
        
        if (filter?.status && job.status !== filter.status) continue;
        if (filter?.type && job.type !== filter.type) continue;
        
        jobs.push(job);
      }
    }

    // Sort by priority and creation time
    jobs.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (filter?.limit) {
      return jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    if (job.status === 'pending' || job.status === 'running') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      
      await this.redis.multi()
        .zrem(this.getRedisKey(this.QUEUE_KEY), jobId)
        .lrem(this.getRedisKey(this.PROCESSING_KEY), 0, jobId)
        .hset(this.getRedisKey(this.JOB_DATA_KEY), jobId, JSON.stringify(job))
        .exec();
      
      this.runningJobs.delete(jobId);
      this.emit('job:cancelled', job);
      return true;
    }

    return false;
  }

  /**
   * Remove completed/failed jobs older than specified time
   */
  async cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const allJobIds = await this.redis.hkeys(
      this.getRedisKey(this.JOB_DATA_KEY)
    );
    
    const jobIds = Array.isArray(allJobIds) ? allJobIds : [];
    let removed = 0;
    const multi = this.redis.multi();

    for (const jobId of jobIds) {
      const jobData = await this.redis.hget(
        this.getRedisKey(this.JOB_DATA_KEY),
        jobId
      );
      
      if (jobData) {
        const job: RedisJob = JSON.parse(jobData);
        if ((job.status === 'completed' || job.status === 'failed') && 
            job.completedAt && new Date(job.completedAt) < cutoff) {
          multi.hdel(this.getRedisKey(this.JOB_DATA_KEY), jobId);
          removed++;
        }
      }
    }

    await multi.exec();
    return removed;
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<number> {
    const completedJobIds: string[] = [];
    const allJobIds = await this.redis.hkeys(this.getRedisKey(this.JOB_DATA_KEY));
    const jobIds = Array.isArray(allJobIds) ? allJobIds : [];
    
    for (const jobId of jobIds) {
      const jobData = await this.redis.hget(
        this.getRedisKey(this.JOB_DATA_KEY),
        jobId
      );
      
      if (jobData) {
        const job: RedisJob = JSON.parse(jobData);
        if (job.status === 'completed') {
          completedJobIds.push(jobId);
        }
      }
    }

    if (completedJobIds.length > 0) {
      await this.redis.hdel(
        this.getRedisKey(this.JOB_DATA_KEY),
        ...completedJobIds
      );
      await this.redis.del(this.getRedisKey(this.COMPLETED_KEY));
    }

    return completedJobIds.length;
  }

  /**
   * Get job history (completed and failed jobs)
   */
  async getJobHistory(limit: number = 100): Promise<RedisJob[]> {
    const allJobIds = await this.redis.hkeys(this.getRedisKey(this.JOB_DATA_KEY));
    const jobIds = Array.isArray(allJobIds) ? allJobIds : [];
    const jobs: RedisJob[] = [];
    
    for (const jobId of jobIds) {
      const jobData = await this.redis.hget(
        this.getRedisKey(this.JOB_DATA_KEY),
        jobId
      );
      
      if (jobData) {
        const job: RedisJob = JSON.parse(jobData);
        if (job.status === 'completed' || job.status === 'failed') {
          jobs.push(job);
        }
      }
    }

    // Sort by completion time (most recent first)
    jobs.sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });

    return jobs.slice(0, limit);
  }

  /**
   * Update job data
   */
  async updateJobData(jobId: string, data: any): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    job.data = data;
    await this.updateJob(job);
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'failed') return false;

    job.status = 'pending';
    job.error = undefined;
    job.completedAt = undefined;
    job.retryInfo = { attempts: 0 };

    const score = this.getPriorityScore(job.priority);
    await this.redis.zadd(
      this.getRedisKey(this.QUEUE_KEY),
      score,
      jobId
    );

    await this.updateJob(job);
    this.emit('job:retry', job);

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return true;
  }

  /**
   * Update job priority
   */
  async updateJobPriority(jobId: string, priority: JobPriority): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job || job.status === 'running') return false;

    job.priority = priority;
    await this.updateJob(job);

    // If job is still pending, update its position in the queue
    if (job.status === 'pending') {
      await this.redis.zrem(this.getRedisKey(this.QUEUE_KEY), jobId);
      const score = this.getPriorityScore(priority);
      await this.redis.zadd(this.getRedisKey(this.QUEUE_KEY), score, jobId);
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    deadLetter?: number;
  }> {
    const stats = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      deadLetter: 0,
    };

    // Get counts from different queues
    stats.pending = await this.redis.zcard(this.getRedisKey(this.QUEUE_KEY));
    stats.running = await this.redis.llen(this.getRedisKey(this.PROCESSING_KEY));
    
    if (this.enableDeadLetterQueue) {
      stats.deadLetter = await this.redis.llen(this.getRedisKey(this.DEAD_LETTER_KEY));
    }

    // Count by status from job data
    const allJobIds = await this.redis.hkeys(this.getRedisKey(this.JOB_DATA_KEY));
    const jobIds = Array.isArray(allJobIds) ? allJobIds : [];
    
    for (const jobId of jobIds) {
      const jobData = await this.redis.hget(
        this.getRedisKey(this.JOB_DATA_KEY),
        jobId
      );
      
      if (jobData) {
        const job: RedisJob = JSON.parse(jobData);
        stats.total++;
        if (job.status === 'completed') stats.completed++;
        else if (job.status === 'failed') stats.failed++;
        else if (job.status === 'cancelled') stats.cancelled++;
      }
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
    }, 1000);

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

    for (let i = 0; i < availableSlots; i++) {
      // Get highest priority job
      const jobIds = await this.redis.zrange(
        this.getRedisKey(this.QUEUE_KEY),
        0,
        0
      );
      
      if (jobIds.length === 0) break;
      
      const jobId = jobIds[0];
      
      // Move from queue to processing
      const moved = await this.redis.multi()
        .zrem(this.getRedisKey(this.QUEUE_KEY), jobId)
        .lpush(this.getRedisKey(this.PROCESSING_KEY), jobId)
        .exec();
      
      if (moved && moved[0][1] === 1) {
        const job = await this.getJob(jobId);
        if (job) {
          this.processJob(job);
        }
      }
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: RedisJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.failJob(job, `No handler registered for job type: ${job.type}`);
      return;
    }

    this.runningJobs.add(job.id);
    job.status = 'running';
    job.startedAt = new Date();
    
    await this.updateJob(job);
    this.emit('job:started', job);

    const updateProgress = async (progress: number) => {
      job.progress = Math.max(0, Math.min(100, progress));
      await this.updateJob(job);
      this.emit('job:progress', job);
      
      // Send SSE progress event
      const sseService = getSSEService();
      sseService.sendJobProgress(job.id, job.progress, `Processing ${job.type}`);
      
      // Emit WebSocket event
      eventEmitter.emit(EventTypes.JOB_PROGRESS, {
        jobId: job.id,
        type: job.type,
        progress: job.progress,
        status: job.status
      });
    };

    try {
      const result = await handler(job, updateProgress);
      await this.completeJob(job, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if we should retry
      if (job.retryInfo && job.retryInfo.attempts < this.retryAttempts) {
        await this.retryJobWithBackoff(job, errorMessage);
      } else {
        await this.failJob(job, errorMessage, true);
      }
    }
  }

  /**
   * Retry a job with exponential backoff
   */
  private async retryJobWithBackoff(job: RedisJob, error: string): Promise<void> {
    if (!job.retryInfo) {
      job.retryInfo = { attempts: 0 };
    }
    
    job.retryInfo.attempts++;
    job.retryInfo.lastAttempt = new Date();
    
    // Calculate exponential backoff
    const backoffMs = this.retryDelay * Math.pow(2, job.retryInfo.attempts - 1);
    const retryTime = Date.now() + backoffMs;
    job.retryInfo.nextRetry = new Date(retryTime);
    
    job.status = 'pending';
    job.error = `Retry ${job.retryInfo.attempts}/${this.retryAttempts}: ${error}`;
    
    // Update job and move back to queue with delay
    await this.redis.multi()
      .lrem(this.getRedisKey(this.PROCESSING_KEY), 0, job.id)
      .zadd(this.getRedisKey(this.QUEUE_KEY), retryTime, job.id)
      .hset(this.getRedisKey(this.JOB_DATA_KEY), job.id, JSON.stringify(job))
      .exec();
    
    this.runningJobs.delete(job.id);
    
    console.log(`Job ${job.id} scheduled for retry in ${backoffMs}ms`);
    this.emit('job:retry', job);
  }

  /**
   * Mark job as completed
   */
  private async completeJob(job: RedisJob, result: any): Promise<void> {
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    job.result = result;
    
    await this.redis.multi()
      .lrem(this.getRedisKey(this.PROCESSING_KEY), 0, job.id)
      .lpush(this.getRedisKey(this.COMPLETED_KEY), job.id)
      .hset(this.getRedisKey(this.JOB_DATA_KEY), job.id, JSON.stringify(job))
      .hincrby(this.getRedisKey(this.STATS_KEY), 'completed', 1)
      .exec();
    
    this.runningJobs.delete(job.id);
    this.emit('job:completed', job);
    
    // Send SSE completion event
    const sseService = getSSEService();
    sseService.sendJobStatus(job.id, 'completed', result);
    
    // Emit WebSocket event
    eventEmitter.emit(EventTypes.JOB_COMPLETE, {
      jobId: job.id,
      type: job.type,
      status: job.status,
      result: result,
      completedAt: job.completedAt
    });
    
    // Publish event
    await this.redis.publish(
      this.getRedisKey('job:completed'),
      JSON.stringify(job)
    );
  }

  /**
   * Mark job as failed
   */
  private async failJob(job: RedisJob, error: string, moveToDeadLetter = false): Promise<void> {
    job.status = 'failed';
    job.completedAt = new Date();
    job.error = error;
    
    if (job.retryInfo) {
      job.originalError = job.originalError || error;
    }
    
    const multi = this.redis.multi()
      .lrem(this.getRedisKey(this.PROCESSING_KEY), 0, job.id)
      .hset(this.getRedisKey(this.JOB_DATA_KEY), job.id, JSON.stringify(job))
      .hincrby(this.getRedisKey(this.STATS_KEY), 'failed', 1);
    
    if (moveToDeadLetter && this.enableDeadLetterQueue) {
      multi.lpush(this.getRedisKey(this.DEAD_LETTER_KEY), job.id);
    } else {
      multi.lpush(this.getRedisKey(this.FAILED_KEY), job.id);
    }
    
    await multi.exec();
    
    this.runningJobs.delete(job.id);
    this.emit('job:failed', job);
    
    // Send SSE failure event
    const sseService = getSSEService();
    sseService.sendJobStatus(job.id, 'failed', undefined, error);
    
    // Emit WebSocket event
    eventEmitter.emit(EventTypes.JOB_FAILED, {
      jobId: job.id,
      type: job.type,
      status: job.status,
      error: error,
      completedAt: job.completedAt
    });
    
    // Publish event
    await this.redis.publish(
      this.getRedisKey('job:failed'),
      JSON.stringify(job)
    );
  }

  /**
   * Update job in Redis
   */
  private async updateJob(job: RedisJob): Promise<void> {
    await this.redis.hset(
      this.getRedisKey(this.JOB_DATA_KEY),
      job.id,
      JSON.stringify(job)
    );
  }

  /**
   * Wait for job completion
   */
  async waitForJob(jobId: string, timeoutMs: number = 30000): Promise<RedisJob> {
    const job = await this.getJob(jobId);
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

      const checkJob = async (eventJob: Job) => {
        if (eventJob.id === jobId) {
          cleanup();
          const updatedJob = await this.getJob(jobId);
          if (updatedJob) {
            resolve(updatedJob);
          }
        }
      };

      const onCompleted = (job: Job) => checkJob(job);
      const onFailed = (job: Job) => checkJob(job);
      const onCancelled = (job: Job) => checkJob(job);

      this.on('job:completed', onCompleted);
      this.on('job:failed', onFailed);
      this.on('job:cancelled', onCancelled);
    });
  }

  /**
   * Get dead letter queue jobs
   */
  async getDeadLetterJobs(limit: number = 100): Promise<RedisJob[]> {
    if (!this.enableDeadLetterQueue) return [];
    
    const jobIds = await this.redis.lrange(
      this.getRedisKey(this.DEAD_LETTER_KEY),
      0,
      limit - 1
    );
    
    const jobs: RedisJob[] = [];
    
    for (const jobId of jobIds) {
      const job = await this.getJob(jobId);
      if (job) {
        jobs.push(job);
      }
    }
    
    return jobs;
  }

  /**
   * Requeue a job from dead letter queue
   */
  async requeueDeadLetterJob(jobId: string): Promise<boolean> {
    if (!this.enableDeadLetterQueue) return false;
    
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'failed') return false;
    
    // Reset job
    job.status = 'pending';
    job.error = undefined;
    job.completedAt = undefined;
    job.retryInfo = { attempts: 0 };
    
    // Move from dead letter to main queue
    const score = this.getPriorityScore(job.priority);
    
    await this.redis.multi()
      .lrem(this.getRedisKey(this.DEAD_LETTER_KEY), 0, jobId)
      .zadd(this.getRedisKey(this.QUEUE_KEY), score, jobId)
      .hset(this.getRedisKey(this.JOB_DATA_KEY), jobId, JSON.stringify(job))
      .exec();
    
    this.emit('job:requeued', job);
    
    // Start processing if needed
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return true;
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    this.stopProcessing();
    
    // Clear reconnection timeout to prevent leaks
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = undefined;
    }
    
    // Remove event listeners before closing to prevent memory leaks
    if (typeof this.redis.removeAllListeners === 'function') {
      this.redis.removeAllListeners();
    }
    if (typeof this.subscriberRedis.removeAllListeners === 'function') {
      this.subscriberRedis.removeAllListeners();
    }
    
    // Check if quit method exists (for mock compatibility)
    if (typeof this.redis.quit === 'function') {
      await this.redis.quit();
    }
    if (typeof this.subscriberRedis.quit === 'function') {
      await this.subscriberRedis.quit();
    }
  }

  /**
   * Disconnect from Redis (alias for close)
   */
  async disconnect(): Promise<void> {
    return this.close();
  }

  /**
   * Process priority jobs (for testing)
   */
  private async processPriorityJobs(): Promise<void> {
    // This method is used in tests to verify priority queue processing
    await this.processNextJobs();
  }
}