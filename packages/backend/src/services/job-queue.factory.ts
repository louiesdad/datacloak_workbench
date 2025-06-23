import { JobQueueService } from './job-queue.service';
import { RedisJobQueueService } from './redis-queue.service';
import { ConfigService } from './config.service';
import { EventEmitter } from 'events';

export interface IJobQueueService extends EventEmitter {
  addJob(type: any, data: any, options?: any): string | Promise<string>;
  registerHandler(type: any, handler: any): void;
  getJob(jobId: string): any;
  getJobs(filter?: any): any[] | Promise<any[]>;
  cancelJob(jobId: string): boolean | Promise<boolean>;
  cleanup(olderThanMs?: number): number | Promise<number>;
  getStats(): any;
  stopProcessing(): void;
  waitForJob(jobId: string, timeoutMs?: number): Promise<any>;
}

let jobQueueInstance: IJobQueueService | null = null;

/**
 * Factory function to create the appropriate job queue service
 * based on configuration
 */
export async function createJobQueueService(): Promise<IJobQueueService> {
  const configService = ConfigService.getInstance();
  const redisEnabled = configService.get('REDIS_ENABLED');
  
  if (redisEnabled) {
    console.log('Creating Redis-based job queue...');
    
    const redisQueue = new RedisJobQueueService({
      host: configService.get('REDIS_HOST'),
      port: configService.get('REDIS_PORT'),
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB'),
      keyPrefix: configService.get('REDIS_KEY_PREFIX'),
      maxConcurrentJobs: configService.get('JOB_QUEUE_MAX_CONCURRENT'),
      retryAttempts: configService.get('JOB_QUEUE_RETRY_ATTEMPTS'),
      retryDelay: configService.get('JOB_QUEUE_RETRY_DELAY'),
      enableDeadLetterQueue: configService.get('JOB_QUEUE_ENABLE_DEAD_LETTER'),
    });
    
    // Wait for Redis to connect
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);
      
      redisQueue.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      redisQueue.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    console.log('Redis job queue connected successfully');
    return redisQueue;
  } else {
    console.log('Creating in-memory job queue...');
    return new JobQueueService({
      maxConcurrentJobs: configService.get('JOB_QUEUE_MAX_CONCURRENT') || 10,
    });
  }
}

/**
 * Get the singleton job queue instance
 */
export async function getJobQueueService(): Promise<IJobQueueService> {
  if (!jobQueueInstance) {
    jobQueueInstance = await createJobQueueService();
    
    // Listen for configuration changes
    const configService = ConfigService.getInstance();
    configService.on('config.updated', async ({ key }) => {
      if (key === 'REDIS_ENABLED' || key.startsWith('REDIS_') || key.startsWith('JOB_QUEUE_')) {
        console.log('Job queue configuration changed, recreating service...');
        
        // Stop the current queue
        if (jobQueueInstance) {
          jobQueueInstance.stopProcessing();
          if ('close' in jobQueueInstance) {
            await (jobQueueInstance as RedisJobQueueService).close();
          }
        }
        
        // Create new queue
        jobQueueInstance = await createJobQueueService();
      }
    });
  }
  
  return jobQueueInstance;
}

/**
 * Reset the job queue instance (useful for testing)
 */
export async function resetJobQueueService(): Promise<void> {
  if (jobQueueInstance) {
    jobQueueInstance.stopProcessing();
    if ('close' in jobQueueInstance) {
      await (jobQueueInstance as RedisJobQueueService).close();
    }
    jobQueueInstance = null;
  }
}