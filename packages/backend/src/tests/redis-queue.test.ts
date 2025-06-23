// Mock ioredis before any imports
jest.mock('ioredis');

import { RedisJobQueueService, RedisJobQueueConfig } from '../services/redis-queue.service';
import { JobType, JobPriority } from '../services/job-queue.service';
import { MockRedisInstance } from '../services/__mocks__/ioredis';

describe('RedisJobQueueService', () => {
  let redisQueue: RedisJobQueueService;
  
  // Mock Redis configuration for testing
  const testConfig: RedisJobQueueConfig = {
    host: 'localhost',
    port: 6379,
    db: 15, // Use a different database for testing
    keyPrefix: 'test:',
    maxConcurrentJobs: 2,
    retryAttempts: 2,
    retryDelay: 1000,
    enableDeadLetterQueue: true
  };

  beforeAll(async () => {
    // Create mock Redis instances for testing
    const mockRedis = new MockRedisInstance();
    const mockSubscriberRedis = new MockRedisInstance();
    
    // Use dependency injection to provide mocks
    redisQueue = new RedisJobQueueService(testConfig, {
      redis: mockRedis as any,
      subscriberRedis: mockSubscriberRedis as any
    });
    
    // Wait for connected event
    await new Promise<void>((resolve) => {
      redisQueue.once('connected', resolve);
      // Emit connected event after a short delay
      setTimeout(() => redisQueue.emit('connected'), 10);
    });
  });

  afterAll(async () => {
    if (redisQueue) {
      await redisQueue.close();
    }
  });

  beforeEach(async () => {
    if (!redisQueue) return;
    
    // Clean up Redis test data before each test
    const redis = (redisQueue as any).redis;
    await redis.flushdb();
  });

  describe('Job Management', () => {
    it('should add a job to the queue', async () => {
      if (!redisQueue) return;
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      
      const job = await redisQueue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('sentiment_analysis_batch');
      expect(job?.status).toBe('pending');
    });

    it('should handle job priorities correctly', async () => {
      if (!redisQueue) return;
      
      const lowPriorityJob = await redisQueue.addJob('file_processing', {}, { priority: 'low' });
      const highPriorityJob = await redisQueue.addJob('security_scan', {}, { priority: 'high' });
      const criticalPriorityJob = await redisQueue.addJob('data_export', {}, { priority: 'critical' });
      
      const jobs = await redisQueue.getJobs({ status: 'pending' });
      
      // Should be ordered by priority: critical, high, low
      expect(jobs[0].id).toBe(criticalPriorityJob);
      expect(jobs[1].id).toBe(highPriorityJob);
      expect(jobs[2].id).toBe(lowPriorityJob);
    });

    it('should cancel a pending job', async () => {
      if (!redisQueue) return;
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      const cancelled = await redisQueue.cancelJob(jobId);
      
      expect(cancelled).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should get queue statistics', async () => {
      if (!redisQueue) return;
      
      await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test1'] });
      await redisQueue.addJob('file_processing', { file: 'test2' });
      
      const stats = await redisQueue.getStats();
      
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.pending).toBeGreaterThanOrEqual(2);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Job Processing', () => {
    it('should process a job successfully', async () => {
      if (!redisQueue) return;
      
      let processedData: any = null;
      
      redisQueue.registerHandler('sentiment_analysis_batch', async (job, updateProgress) => {
        updateProgress(50);
        processedData = job.data;
        updateProgress(100);
        return { result: 'success' };
      });
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['hello world'] });
      
      // Wait for job completion
      const completedJob = await redisQueue.waitForJob(jobId, 5000);
      
      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      expect(completedJob.result).toEqual({ result: 'success' });
      expect(processedData).toEqual({ texts: ['hello world'] });
    });

    it('should retry failed jobs', async () => {
      if (!redisQueue) return;
      
      let attemptCount = 0;
      
      redisQueue.registerHandler('sentiment_analysis_batch', async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return { result: 'success after retries' };
      });
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      
      // Wait for job completion (with retries)
      const completedJob = await redisQueue.waitForJob(jobId, 10000);
      
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toEqual({ result: 'success after retries' });
      expect(attemptCount).toBe(3);
    });

    it('should move jobs to dead letter queue after max retries', async () => {
      if (!redisQueue) return;
      
      redisQueue.registerHandler('sentiment_analysis_batch', async () => {
        throw new Error('Always fails');
      });
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      
      // Wait for job to fail completely
      const failedJob = await redisQueue.waitForJob(jobId, 10000);
      
      expect(failedJob.status).toBe('failed');
      expect(failedJob.retryInfo?.attempts).toBeGreaterThanOrEqual(testConfig.retryAttempts || 3);
      
      // Check if job is in dead letter queue
      const deadLetterJobs = await redisQueue.getDeadLetterJobs();
      expect(deadLetterJobs.some(job => job.id === jobId)).toBe(true);
    });
  });

  describe('Dead Letter Queue', () => {
    it('should requeue a job from dead letter queue', async () => {
      if (!redisQueue) return;
      
      // Create a job that will fail and go to dead letter queue
      redisQueue.registerHandler('sentiment_analysis_batch', async () => {
        throw new Error('Always fails');
      });
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      await redisQueue.waitForJob(jobId, 10000);
      
      // Requeue the job
      const requeued = await redisQueue.requeueDeadLetterJob(jobId);
      expect(requeued).toBe(true);
      
      // Job should be back in the queue
      const requeuedJob = await redisQueue.getJob(jobId);
      expect(requeuedJob?.status).toBe('pending');
      expect(requeuedJob?.retryInfo?.attempts).toBe(0);
    });
  });

  describe('Job Recovery', () => {
    it('should recover stuck processing jobs on startup', async () => {
      if (!redisQueue) return;
      
      // Simulate a stuck job by manually adding it to processing queue
      const redis = (redisQueue as any).redis;
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      
      // Manually move job to processing state (simulating a crash during processing)
      await redis.multi()
        .zrem(`${testConfig.keyPrefix}job:queue`, jobId)
        .lpush(`${testConfig.keyPrefix}job:processing`, jobId)
        .exec();
      
      // Create a new queue instance (simulating restart)
      await redisQueue.close();
      redisQueue = new RedisJobQueueService(testConfig);
      
      // Wait a bit for recovery to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Job should be recovered and back in the queue
      const recoveredJob = await redisQueue.getJob(jobId);
      expect(recoveredJob?.status).toBe('pending');
    }, 15000);
  });

  describe('Cleanup', () => {
    it('should clean up old completed jobs', async () => {
      if (!redisQueue) return;
      
      redisQueue.registerHandler('sentiment_analysis_batch', async () => {
        return { result: 'completed' };
      });
      
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { texts: ['test'] });
      await redisQueue.waitForJob(jobId, 5000);
      
      // Manually set completion time to past
      const job = await redisQueue.getJob(jobId);
      if (job) {
        job.completedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        const redis = (redisQueue as any).redis;
        await redis.hset(`${testConfig.keyPrefix}job:data`, jobId, JSON.stringify(job));
      }
      
      const removedCount = await redisQueue.cleanup(24 * 60 * 60 * 1000); // 24 hours
      expect(removedCount).toBe(1);
      
      const cleanedJob = await redisQueue.getJob(jobId);
      expect(cleanedJob).toBeUndefined();
    });
  });
});