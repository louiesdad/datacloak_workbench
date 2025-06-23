import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { getCacheService, ICacheService } from './cache.service';
import { JobQueueService } from './job-queue.service';
import { RedisJobQueueService } from './redis-queue.service';
import { AppError } from '../middleware/error.middleware';

export interface TaskConfig {
  name: string;
  schedule: string; // Cron pattern
  handler: TaskHandler;
  enabled?: boolean;
  timezone?: string;
  maxExecutionTime?: number; // ms
  retryOnFailure?: boolean;
  retryAttempts?: number;
  metadata?: Record<string, any>;
}

export interface TaskHandler {
  (context: TaskContext): Promise<any>;
}

export interface TaskContext {
  taskId: string;
  taskName: string;
  executionId: string;
  startTime: Date;
  previousExecution?: TaskExecution;
  metadata?: Record<string, any>;
  cache: ICacheService;
  jobQueue: JobQueueService | RedisJobQueueService;
}

export interface TaskExecution {
  executionId: string;
  taskId: string;
  taskName: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  result?: any;
  error?: string;
  duration?: number;
  nextRun?: Date;
}

export interface TaskStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecution?: TaskExecution;
  nextExecution?: Date;
}

export class BackgroundTaskService extends EventEmitter {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cache: ICacheService;
  private executionHistory: Map<string, TaskExecution[]> = new Map();
  private isShuttingDown = false;

  constructor(
    private jobQueue: JobQueueService | RedisJobQueueService
  ) {
    super();
    this.cache = getCacheService();
    this.setupShutdownHandlers();
  }

  /**
   * Register a background task
   */
  registerTask(config: TaskConfig): string {
    const taskId = uuidv4();
    
    if (!cron.validate(config.schedule)) {
      throw new AppError('Invalid cron pattern', 400, 'INVALID_CRON_PATTERN');
    }

    const task = new ScheduledTask(taskId, config, this);
    this.tasks.set(taskId, task);

    if (config.enabled !== false) {
      task.start();
    }

    this.emit('task:registered', { 
      taskId, 
      name: config.name, 
      schedule: config.schedule 
    });

    return taskId;
  }

  /**
   * Register multiple tasks from configuration
   */
  registerTasks(configs: TaskConfig[]): string[] {
    return configs.map(config => this.registerTask(config));
  }

  /**
   * Unregister a task
   */
  unregisterTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.stop();
    this.tasks.delete(taskId);
    
    this.emit('task:unregistered', { taskId });
    
    return true;
  }

  /**
   * Start a specific task
   */
  startTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    return task.start();
  }

  /**
   * Stop a specific task
   */
  stopTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    return task.stop();
  }

  /**
   * Start all tasks
   */
  startAll(): void {
    for (const task of this.tasks.values()) {
      task.start();
    }
    this.emit('tasks:started', { count: this.tasks.size });
  }

  /**
   * Stop all tasks
   */
  stopAll(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.emit('tasks:stopped', { count: this.tasks.size });
  }

  /**
   * Execute a task immediately
   */
  async executeTask(taskId: string): Promise<TaskExecution> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    return task.execute();
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): {
    task: TaskConfig;
    running: boolean;
    nextRun?: Date;
    lastExecution?: TaskExecution;
  } | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    return {
      task: task.config,
      running: task.isRunning(),
      nextRun: task.getNextRun(),
      lastExecution: task.getLastExecution()
    };
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Array<{
    taskId: string;
    config: TaskConfig;
    running: boolean;
    nextRun?: Date;
  }> {
    return Array.from(this.tasks.entries()).map(([taskId, task]) => ({
      taskId,
      config: task.config,
      running: task.isRunning(),
      nextRun: task.getNextRun()
    }));
  }

  /**
   * Get task execution history
   */
  async getTaskHistory(taskId: string, limit = 10): Promise<TaskExecution[]> {
    // Try cache first
    const cached = await this.cache.get<TaskExecution[]>(`task:history:${taskId}`);
    if (cached) return cached.slice(0, limit);

    // Return from memory
    const history = this.executionHistory.get(taskId) || [];
    return history.slice(0, limit);
  }

  /**
   * Get task statistics
   */
  async getTaskStats(taskId: string): Promise<TaskStats | null> {
    const history = await this.getTaskHistory(taskId, 100);
    if (history.length === 0) return null;

    const stats: TaskStats = {
      totalExecutions: history.length,
      successfulExecutions: history.filter(e => e.status === 'completed').length,
      failedExecutions: history.filter(e => e.status === 'failed' || e.status === 'timeout').length,
      averageDuration: 0,
      lastExecution: history[0]
    };

    // Calculate average duration
    const durations = history
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    
    if (durations.length > 0) {
      stats.averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    }

    // Get next execution
    const task = this.tasks.get(taskId);
    if (task) {
      stats.nextExecution = task.getNextRun();
    }

    return stats;
  }

  /**
   * Record task execution
   */
  async recordExecution(taskId: string, execution: TaskExecution): Promise<void> {
    // Store in memory
    const history = this.executionHistory.get(taskId) || [];
    history.unshift(execution); // Add to beginning
    history.splice(100); // Keep only last 100
    this.executionHistory.set(taskId, history);

    // Store in cache
    await this.cache.set(`task:history:${taskId}`, history, { ttl: 86400 }); // 24 hours
    await this.cache.set(`task:last:${taskId}`, execution, { ttl: 86400 });

    this.emit('task:executed', execution);
  }

  /**
   * Clean up old execution history
   */
  async cleanupHistory(olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    let cleaned = 0;
    const cutoff = new Date(Date.now() - olderThanMs);

    for (const [taskId, history] of this.executionHistory.entries()) {
      const before = history.length;
      const filtered = history.filter(e => 
        e.startTime > cutoff
      );
      
      if (filtered.length < before) {
        this.executionHistory.set(taskId, filtered);
        await this.cache.set(`task:history:${taskId}`, filtered, { ttl: 86400 });
        cleaned += before - filtered.length;
      }
    }

    return cleaned;
  }

  /**
   * Validate cron pattern
   */
  static validateCronPattern(pattern: string): boolean {
    return cron.validate(pattern);
  }

  /**
   * Get next execution time for cron pattern
   */
  static getNextExecutionTime(pattern: string, timezone?: string): Date | null {
    if (!cron.validate(pattern)) return null;

    // Create temporary task to calculate next run
    const task = cron.schedule(pattern, () => {}, {
      timezone
    } as any);

    // This is a workaround - node-cron doesn't expose next run directly
    // In production, consider using a library like cron-parser
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);
    
    task.destroy();
    
    return nextMinute;
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopAll();
    
    // Wait for running tasks to complete
    const runningTasks = Array.from(this.tasks.values()).filter(t => t.isExecuting);
    
    if (runningTasks.length > 0) {
      await Promise.all(
        runningTasks.map(task => 
          new Promise(resolve => {
            const timeout = setTimeout(() => resolve(null), 30000); // 30s timeout
            task.once('execution:complete', () => {
              clearTimeout(timeout);
              resolve(null);
            });
          })
        )
      );
    }

    this.emit('shutdown');
  }

  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      console.log('Shutting down background tasks...');
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

/**
 * Individual scheduled task
 */
class ScheduledTask extends EventEmitter {
  private cronTask?: cron.ScheduledTask;
  private currentExecution?: TaskExecution;
  public isExecuting = false;

  constructor(
    public taskId: string,
    public config: TaskConfig,
    private service: BackgroundTaskService
  ) {
    super();
  }

  start(): boolean {
    if (this.cronTask) return false;

    this.cronTask = cron.schedule(this.config.schedule, async () => {
      await this.execute();
    }, {
      timezone: this.config.timezone
    } as any);

    if (this.config.enabled !== false) {
      this.cronTask.start();
    }

    return true;
  }

  stop(): boolean {
    if (!this.cronTask) return false;

    this.cronTask.stop();
    this.cronTask = undefined;
    return true;
  }

  async execute(): Promise<TaskExecution> {
    if (this.isExecuting) {
      throw new AppError('Task already executing', 409, 'TASK_ALREADY_RUNNING');
    }

    const executionId = uuidv4();
    const execution: TaskExecution = {
      executionId,
      taskId: this.taskId,
      taskName: this.config.name,
      startTime: new Date(),
      status: 'running'
    };

    this.currentExecution = execution;
    this.isExecuting = true;

    // Create context
    const context: TaskContext = {
      taskId: this.taskId,
      taskName: this.config.name,
      executionId,
      startTime: execution.startTime,
      previousExecution: await this.getPreviousExecution(),
      metadata: this.config.metadata,
      cache: (this.service as any).cache,
      jobQueue: (this.service as any).jobQueue
    };

    try {
      // Set timeout if configured
      const timeoutPromise = this.config.maxExecutionTime
        ? new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Task timeout')), this.config.maxExecutionTime)
          )
        : null;

      // Execute handler
      const handlerPromise = this.config.handler(context);
      
      const result = timeoutPromise
        ? await Promise.race([handlerPromise, timeoutPromise])
        : await handlerPromise;

      execution.status = 'completed';
      execution.result = result;
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

    } catch (error) {
      execution.status = error instanceof Error && error.message === 'Task timeout' 
        ? 'timeout' 
        : 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Retry if configured
      if (this.config.retryOnFailure && execution.status === 'failed') {
        // Could implement retry logic here
        this.emit('task:retry', { taskId: this.taskId, error: execution.error });
      }
    }

    // Record execution
    await this.service.recordExecution(this.taskId, execution);

    this.isExecuting = false;
    this.currentExecution = undefined;
    
    this.emit('execution:complete', execution);

    return execution;
  }

  isRunning(): boolean {
    return this.cronTask !== undefined;
  }

  getNextRun(): Date | undefined {
    if (!this.cronTask) return undefined;
    
    // node-cron doesn't expose next run time directly
    // This is an approximation
    return BackgroundTaskService.getNextExecutionTime(
      this.config.schedule, 
      this.config.timezone
    ) || undefined;
  }

  getLastExecution(): TaskExecution | undefined {
    return this.currentExecution;
  }

  private async getPreviousExecution(): Promise<TaskExecution | undefined> {
    const history = await this.service.getTaskHistory(this.taskId, 1);
    return history[0];
  }
}