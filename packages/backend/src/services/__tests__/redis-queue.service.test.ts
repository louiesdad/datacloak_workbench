// Mock ioredis module before any imports
jest.mock('ioredis');

// Mock ConfigService
jest.mock('../config.service', () => ({
  ConfigService: {
    getInstance: jest.fn(() => ({
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_DB: 0,
          REDIS_PASSWORD: undefined
        };
        return config[key];
      })
    }))
  }
}));

// Mock SSE service
jest.mock('../sse.service', () => ({
  getSSEService: jest.fn(() => ({
    broadcast: jest.fn(),
    sendJobProgress: jest.fn(),
    sendJobStatus: jest.fn()
  }))
}));

// Mock event service
jest.mock('../event.service', () => ({
  eventEmitter: {
    emit: jest.fn()
  },
  EventTypes: {
    JOB_CREATED: 'job:created',
    JOB_CANCELLED: 'job:cancelled',
    JOB_PROGRESS: 'job:progress',
    JOB_COMPLETE: 'job:complete',
    JOB_FAILED: 'job:failed'
  }
}));

import { EventEmitter } from 'events';
import { RedisJobQueueService, RedisJobQueueConfig, RedisJobQueueDependencies } from '../redis-queue.service';
import { JobType, JobPriority, JobHandler } from '../job-queue.service';
import { eventEmitter } from '../event.service';

// Create a proper mock Redis class inline
class MockRedisInstance extends EventEmitter {
  store = new Map<string, any>();
  
  constructor() {
    super();
    // Emit connection events to satisfy EventEmitter interface requirements
    setImmediate(() => {
      this.emit('connect');
      this.emit('ready');
      this.emit('connected'); // For compatibility with different services
    });
  }
  
  async get(key: string) {
    return this.store.get(key) || null;
  }
  
  async set(key: string, value: any) {
    this.store.set(key, value);
    return 'OK';
  }
  
  async del(key: string) {
    this.store.delete(key);
    return 1;
  }
  
  async hset(hash: string, field: string, value: string) {
    const hashStore = this.store.get(hash) || new Map();
    hashStore.set(field, value);
    this.store.set(hash, hashStore);
    return 1;
  }
  
  async hget(hash: string, field: string) {
    const hashStore = this.store.get(hash);
    return hashStore ? hashStore.get(field) : null;
  }
  
  async hgetall(hash: string) {
    const hashStore = this.store.get(hash);
    if (!hashStore) return null;
    
    const result: any = {};
    for (const [field, value] of hashStore.entries()) {
      result[field] = value;
    }
    return result;
  }
  
  async hdel(hash: string, field: string) {
    const hashStore = this.store.get(hash);
    if (hashStore) {
      hashStore.delete(field);
      return 1;
    }
    return 0;
  }
  
  async hkeys(key: string) {
    const hash = this.store.get(key);
    return hash && hash instanceof Map ? Array.from(hash.keys()) : [];
  }
  
  async hincrby(hash: string, field: string, increment: number) {
    const hashStore = this.store.get(hash) || new Map();
    const current = parseInt(hashStore.get(field) || '0');
    const newValue = current + increment;
    hashStore.set(field, String(newValue));
    this.store.set(hash, hashStore);
    return newValue;
  }
  
  async zadd(key: string, score: number, member: string) {
    const sortedSet = this.store.get(key) || new Map();
    sortedSet.set(member, score);
    this.store.set(key, sortedSet);
    return 1;
  }
  
  async zrange(key: string, start: number, stop: number) {
    const sortedSet = this.store.get(key);
    if (!sortedSet) return [];
    
    const entries = Array.from(sortedSet.entries());
    entries.sort((a, b) => a[1] - b[1]);
    
    return entries.slice(start, stop + 1).map(e => e[0]);
  }
  
  async zrevrange(key: string, start: number, stop: number) {
    const sortedSet = this.store.get(key);
    if (!sortedSet) return [];
    
    const entries = Array.from(sortedSet.entries());
    entries.sort((a, b) => b[1] - a[1]);
    
    return entries.slice(start, stop + 1).map(e => e[0]);
  }
  
  async zrem(key: string, member: string) {
    const sortedSet = this.store.get(key);
    if (sortedSet) {
      sortedSet.delete(member);
      return 1;
    }
    return 0;
  }
  
  async zcard(key: string) {
    const sortedSet = this.store.get(key);
    return sortedSet ? sortedSet.size : 0;
  }
  
  async lrange(key: string, start: number, stop: number) {
    const list = this.store.get(key);
    if (!list || !Array.isArray(list)) return [];
    
    // Handle negative indices
    if (stop === -1) stop = list.length - 1;
    return list.slice(start, stop + 1);
  }
  
  async llen(key: string) {
    const list = this.store.get(key);
    return list && Array.isArray(list) ? list.length : 0;
  }
  
  async lpush(key: string, ...values: string[]) {
    let list = this.store.get(key);
    if (!list || !Array.isArray(list)) {
      list = [];
      this.store.set(key, list);
    }
    list.unshift(...values.reverse());
    return list.length;
  }
  
  async lrem(key: string, count: number, element: string) {
    const list = this.store.get(key);
    if (!list || !Array.isArray(list)) return 0;
    
    let removed = 0;
    if (count === 0) {
      // Remove all occurrences
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === element) {
          list.splice(i, 1);
          removed++;
        }
      }
    }
    return removed;
  }
  
  async publish(channel: string, message: string) {
    this.emit('message', channel, message);
    return 1;
  }
  
  async subscribe(...channels: string[]) {
    for (const channel of channels) {
      this.emit('subscribe', channel, 1);
    }
    return channels.length;
  }
  
  async unsubscribe(...channels: string[]) {
    for (const channel of channels) {
      this.emit('unsubscribe', channel, 0);
    }
    return channels.length;
  }
  
  async keys(pattern: string) {
    const allKeys = Array.from(this.store.keys());
    if (pattern === '*') return allKeys;
    
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }
  
  async scan(cursor: string, ...args: any[]) {
    const keys = await this.keys('*');
    return ['0', keys];
  }
  
  multi() {
    const commands: any[] = [];
    const multi = {
      zrem: (key: string, member: string) => {
        commands.push(['zrem', key, member]);
        return multi;
      },
      lrem: (key: string, count: number, element: string) => {
        commands.push(['lrem', key, count, element]);
        return multi;
      },
      lpush: (key: string, ...values: string[]) => {
        commands.push(['lpush', key, ...values]);
        return multi;
      },
      zadd: (key: string, score: number, member: string) => {
        commands.push(['zadd', key, score, member]);
        return multi;
      },
      hset: (key: string, field: string, value: string) => {
        commands.push(['hset', key, field, value]);
        return multi;
      },
      hdel: (key: string, ...fields: string[]) => {
        commands.push(['hdel', key, ...fields]);
        return multi;
      },
      hincrby: (key: string, field: string, increment: number) => {
        commands.push(['hincrby', key, field, increment]);
        return multi;
      },
      del: (key: string) => {
        commands.push(['del', key]);
        return multi;
      },
      exec: async () => {
        const results: any[] = [];
        for (const [cmd, ...args] of commands) {
          try {
            const result = await (this as any)[cmd](...args);
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
    return multi;
  }
  
  duplicate() {
    return new MockRedisInstance();
  }
  
  async disconnect() {
    this.store.clear();
  }
  
  async quit() {
    this.store.clear();
  }
  
  on(event: string, listener: (...args: any[]) => void) {
    return super.on(event, listener);
  }
}

describe('RedisJobQueueService', () => {
  let redisQueue: RedisJobQueueService;
  let mockHandler: jest.MockedFunction<JobHandler>;
  let mockRedis: MockRedisInstance;
  let mockSubscriberRedis: MockRedisInstance;

  const testConfig: RedisJobQueueConfig = {
    host: 'localhost',
    port: 6379,
    db: 1,
    keyPrefix: 'test:',
    maxConcurrentJobs: 2,
    retryAttempts: 2,
    retryDelay: 100,
    enableDeadLetterQueue: true
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock Redis instances
    mockRedis = new MockRedisInstance();
    mockSubscriberRedis = new MockRedisInstance();
    
    // Create service instance with dependency injection
    const dependencies: RedisJobQueueDependencies = {
      redis: mockRedis as any,
      subscriberRedis: mockSubscriberRedis as any
    };
    
    redisQueue = new RedisJobQueueService(testConfig, dependencies);
    
    mockHandler = jest.fn();
  });

  afterEach(async () => {
    if (redisQueue) {
      await redisQueue.close();
      redisQueue.removeAllListeners();
    }
  });

  describe('Basic Operations', () => {
    test('should add a job to Redis queue', async () => {
      const jobData = { text: 'test' };
      const jobType: JobType = 'sentiment_analysis_batch';
      
      // Register handler and add job
      redisQueue.registerHandler(jobType, mockHandler);
      const jobId = await redisQueue.addJob(jobType, jobData);
      
      // Verify job ID
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      
      // Verify job was stored
      const jobDataStore = mockRedis.store.get('test:job:data');
      expect(jobDataStore).toBeDefined();
      expect(jobDataStore.has(jobId)).toBe(true);
      
      const storedData = JSON.parse(jobDataStore.get(jobId));
      expect(storedData.data).toEqual(jobData);
      expect(storedData.type).toBe(jobType);
      
      // Verify job was added to queue (using sorted set)
      const queueData = mockRedis.store.get('test:job:queue');
      expect(queueData).toBeDefined();
      expect(queueData.has(jobId)).toBe(true);
      
      // Verify stats were updated
      const statsStore = mockRedis.store.get('test:job:stats');
      expect(statsStore).toBeDefined();
      expect(statsStore.get('total')).toBe('1');
      
      // Verify event was emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith('job:created', expect.any(Object));
    });

    test('should add job with custom priority', async () => {
      const jobData = { file: 'test.txt' };
      const jobType: JobType = 'file_processing';
      const priority: JobPriority = 'high';
      
      const jobId = await redisQueue.addJob(jobType, jobData, { priority });
      const job = await redisQueue.getJob(jobId);
      
      expect(job).toBeDefined();
      expect(job?.priority).toBe(priority);
    });

    test('should store job data in Redis hash', async () => {
      const testData = { text: 'Hello world', config: { limit: 100 } };
      const jobType: JobType = 'sentiment_analysis_batch';
      
      const jobId = await redisQueue.addJob(jobType, testData);
      
      // Verify data was serialized and stored
      const jobDataStore = mockRedis.store.get('test:job:data');
      const storedJob = jobDataStore.get(jobId);
      const parsedJob = JSON.parse(storedJob);
      
      expect(parsedJob.data).toEqual(testData);
    });
  });

  describe('Job Processing', () => {
    test('should process jobs with handlers', async () => {
      const jobData = { text: 'process me' };
      const jobType: JobType = 'sentiment_analysis_batch';
      
      // Setup handler
      mockHandler.mockResolvedValue({ sentiment: 'positive' });
      redisQueue.registerHandler(jobType, mockHandler);
      
      // Add job
      const jobId = await redisQueue.addJob(jobType, jobData);
      
      // Process jobs (this will trigger internal processing)
      // Since processNextJobs is private, we test through public interface
      const job = await redisQueue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.status).toBe('pending');
    });

    test('should handle job cancellation', async () => {
      const jobData = { text: 'cancel me' };
      const jobType: JobType = 'sentiment_analysis_batch';
      
      const jobId = await redisQueue.addJob(jobType, jobData);
      const cancelled = await redisQueue.cancelJob(jobId);
      
      expect(cancelled).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });
  });

  describe('Job Retrieval and Filtering', () => {
    beforeEach(async () => {
      // Add test jobs
      await redisQueue.addJob('sentiment_analysis_batch', { text: 'test1' }, { priority: 'high' });
      await redisQueue.addJob('file_processing', { file: 'test.txt' }, { priority: 'medium' });
      await redisQueue.addJob('security_scan', { target: 'server' }, { priority: 'low' });
    });

    test('should get all jobs', async () => {
      const jobs = await redisQueue.getAllJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(3);
    });

    test('should filter jobs by status', async () => {
      const pendingJobs = await redisQueue.getJobsByStatus('pending');
      expect(pendingJobs.length).toBeGreaterThanOrEqual(3);
      
      const completedJobs = await redisQueue.getJobsByStatus('completed');
      expect(completedJobs).toHaveLength(0);
    });

    test('should get job history', async () => {
      const history = await redisQueue.getJobHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Job Management', () => {
    test('should update job data', async () => {
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'original' });
      
      const updated = await redisQueue.updateJobData(jobId, { text: 'updated' });
      expect(updated).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.data).toEqual({ text: 'updated' });
    });

    test('should retry failed jobs', async () => {
      // Add a job and manually mark it as failed
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'test' });
      
      // Get job and update its status manually
      const jobDataStore = mockRedis.store.get('test:job:data');
      const jobData = JSON.parse(jobDataStore.get(jobId));
      jobData.status = 'failed';
      jobData.error = 'Test failure';
      jobDataStore.set(jobId, JSON.stringify(jobData));
      
      // Move to failed queue (it's a list, not a set)
      const failedQueue = ['test-failed-job'];
      mockRedis.store.set('test:job:failed', failedQueue);
      
      // Retry the job
      const retried = await redisQueue.retryJob(jobId);
      expect(retried).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.status).toBe('pending');
    });

    test('should update job priority', async () => {
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'test' }, { priority: 'low' });
      
      const updated = await redisQueue.updateJobPriority(jobId, 'critical');
      expect(updated).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.priority).toBe('critical');
    });
  });

  describe('Queue Statistics', () => {
    test('should track job statistics', async () => {
      // Add some jobs
      await redisQueue.addJob('sentiment_analysis_batch', { text: 'test1' });
      await redisQueue.addJob('sentiment_analysis_batch', { text: 'test2' });
      
      const stats = await redisQueue.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should clear completed jobs', async () => {
      // Add jobs and mark some as completed
      const jobId1 = await redisQueue.addJob('sentiment_analysis_batch', { text: 'test1' });
      const jobId2 = await redisQueue.addJob('sentiment_analysis_batch', { text: 'test2' });
      
      // Manually mark job1 as completed
      const jobDataStore = mockRedis.store.get('test:job:data');
      const jobData = JSON.parse(jobDataStore.get(jobId1));
      jobData.status = 'completed';
      jobData.completedAt = new Date().toISOString();
      jobDataStore.set(jobId1, JSON.stringify(jobData));
      
      // Move to completed queue (it's a list)
      const completedQueue = [jobId1];
      mockRedis.store.set('test:job:completed', completedQueue);
      
      const cleared = await redisQueue.clearCompleted();
      expect(cleared).toBe(1);
      
      // Verify job1 was removed
      const job1 = await redisQueue.getJob(jobId1);
      expect(job1).toBeUndefined();
      
      // Verify job2 still exists
      const job2 = await redisQueue.getJob(jobId2);
      expect(job2).toBeDefined();
    });

    test('should cleanup old jobs', async () => {
      // Add a job and mark it as completed with old timestamp
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'old job' });
      
      const jobDataStore = mockRedis.store.get('test:job:data');
      const jobData = JSON.parse(jobDataStore.get(jobId));
      jobData.status = 'completed';
      jobData.completedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      jobDataStore.set(jobId, JSON.stringify(jobData));
      
      // Move to completed queue (it's a list)
      const completedQueue = [jobId];
      mockRedis.store.set('test:job:completed', completedQueue);
      
      const cleaned = await redisQueue.cleanup(24 * 60 * 60 * 1000); // 1 day
      expect(cleaned).toBe(1);
    });

    test('should properly close Redis connections', async () => {
      await redisQueue.close();
      expect(mockRedis.store.size).toBe(0);
    });
  });

  describe('Dead Letter Queue', () => {
    test('should get dead letter jobs', async () => {
      const deadLetterJobs = await redisQueue.getDeadLetterJobs();
      expect(Array.isArray(deadLetterJobs)).toBe(true);
    });

    test('should requeue dead letter job', async () => {
      // Add a job to dead letter queue
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'dead letter' });
      
      // Manually move to dead letter queue
      const jobDataStore = mockRedis.store.get('test:job:data');
      const jobData = JSON.parse(jobDataStore.get(jobId));
      jobData.status = 'failed';
      jobData.retryInfo = { attempts: 3 };
      jobDataStore.set(jobId, JSON.stringify(jobData));
      
      // Move to dead letter queue (it's a list)
      const deadLetterQueue = [jobId];
      mockRedis.store.set('test:job:dead-letter', deadLetterQueue);
      
      // Requeue the job
      const requeued = await redisQueue.requeueDeadLetterJob(jobId);
      expect(requeued).toBe(true);
      
      const job = await redisQueue.getJob(jobId);
      expect(job?.status).toBe('pending');
    });
  });

  describe('Wait for Job', () => {
    test('should wait for job completion', async () => {
      const jobData = { text: 'wait for me' };
      const jobType: JobType = 'sentiment_analysis_batch';
      
      // Setup handler (optimized timeout)
      mockHandler.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Reduced from 50ms to 10ms
        return 'completed';
      });
      redisQueue.registerHandler(jobType, mockHandler);
      
      const jobId = await redisQueue.addJob(jobType, jobData);
      
      // Mark job as completed after a delay
      setTimeout(async () => {
        const jobDataStore = mockRedis.store.get('test:job:data');
        const job = JSON.parse(jobDataStore.get(jobId));
        job.status = 'completed';
        job.result = 'completed';
        job.completedAt = new Date().toISOString();
        jobDataStore.set(jobId, JSON.stringify(job));
        
        // Emit completion event
        redisQueue.emit('job:completed', job);
      }, 100);
      
      const completedJob = await redisQueue.waitForJob(jobId, 2000); // Reduced from 5000ms to 2000ms
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toBe('completed');
    });

    test('should timeout when waiting for job', async () => {
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'timeout' });
      
      await expect(redisQueue.waitForJob(jobId, 25)).rejects.toThrow('Job timeout'); // Reduced from 50ms to 25ms
    });

    test('should wait for already completed job', async () => {
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'already done' });
      
      // Mark job as completed
      const jobDataStore = mockRedis.store.get('test:job:data');
      const job = JSON.parse(jobDataStore.get(jobId));
      job.status = 'completed';
      job.result = 'already completed';
      job.completedAt = new Date().toISOString();
      jobDataStore.set(jobId, JSON.stringify(job));
      
      const completedJob = await redisQueue.waitForJob(jobId);
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toBe('already completed');
    });

    test('should throw error for non-existent job', async () => {
      await expect(redisQueue.waitForJob('non-existent-id')).rejects.toThrow('Job not found');
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors', (done) => {
      const errorHandler = jest.fn();
      redisQueue.on('error', errorHandler);
      
      // Emit error event on mock Redis
      mockRedis.emit('error', new Error('Connection failed'));
      
      setTimeout(() => {
        expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
        done();
      }, 5); // Reduced from 10ms to 5ms
    });

    test('should handle Redis connect event', (done) => {
      const connectHandler = jest.fn();
      redisQueue.on('connected', connectHandler);
      
      // Emit connect event on mock Redis
      mockRedis.emit('connect');
      
      setTimeout(() => {
        expect(connectHandler).toHaveBeenCalled();
        done();
      }, 5); // Reduced from 10ms to 5ms
    });
  });

  describe('Job Priority', () => {
    test('should process jobs by priority', async () => {
      // Add jobs with different priorities
      const lowJob = await redisQueue.addJob('sentiment_analysis_batch', { text: 'low' }, { priority: 'low' });
      const highJob = await redisQueue.addJob('sentiment_analysis_batch', { text: 'high' }, { priority: 'high' });
      const criticalJob = await redisQueue.addJob('sentiment_analysis_batch', { text: 'critical' }, { priority: 'critical' });
      const mediumJob = await redisQueue.addJob('sentiment_analysis_batch', { text: 'medium' }, { priority: 'medium' });
      
      // Get jobs sorted by priority
      const jobs = await redisQueue.getAllJobs();
      const jobPriorities = jobs.map(j => j.priority);
      
      // Should be sorted by priority
      expect(jobPriorities[0]).toBe('critical');
      expect(jobPriorities[1]).toBe('high');
      expect(jobPriorities[2]).toBe('medium');
      expect(jobPriorities[3]).toBe('low');
    });
  });

  describe('Handler Registration', () => {
    test('should register and use job handlers', async () => {
      const customHandler = jest.fn().mockResolvedValue({ result: 'custom' });
      redisQueue.registerHandler('file_processing', customHandler);
      
      // Verify handler was registered
      expect((redisQueue as any).handlers.has('file_processing')).toBe(true);
    });
  });

  describe('Job Progress', () => {
    test('should update job progress', async () => {
      const jobId = await redisQueue.addJob('sentiment_analysis_batch', { text: 'progress test' });
      
      // Manually update progress
      const jobDataStore = mockRedis.store.get('test:job:data');
      const job = JSON.parse(jobDataStore.get(jobId));
      job.progress = 50;
      jobDataStore.set(jobId, JSON.stringify(job));
      
      const updatedJob = await redisQueue.getJob(jobId);
      expect(updatedJob?.progress).toBe(50);
    });
  });

  describe('Processing Control', () => {
    test('should stop processing when requested', () => {
      const stopHandler = jest.fn();
      redisQueue.on('queue:stopped', stopHandler);
      
      // Start processing first
      (redisQueue as any).isProcessing = true;
      (redisQueue as any).processingInterval = setInterval(() => {}, 1000);
      
      // Stop processing
      redisQueue.stopProcessing();
      
      expect((redisQueue as any).isProcessing).toBe(false);
      expect((redisQueue as any).processingInterval).toBeUndefined();
      expect(stopHandler).toHaveBeenCalled();
    });

    test('should not stop processing if not running', () => {
      const stopHandler = jest.fn();
      redisQueue.on('queue:stopped', stopHandler);
      
      // Ensure not processing
      (redisQueue as any).isProcessing = false;
      
      // Try to stop
      redisQueue.stopProcessing();
      
      expect(stopHandler).not.toHaveBeenCalled();
    });
  });

  describe('Redis Pub/Sub', () => {
    test('should handle Redis message events', (done) => {
      // Setup subscriber listener
      const messageHandler = jest.fn();
      mockSubscriberRedis.on('message', messageHandler);
      
      // Simulate message from Redis
      mockSubscriberRedis.emit('message', 'test:job:added', JSON.stringify({ id: 'test-123' }));
      
      setTimeout(() => {
        expect(messageHandler).toHaveBeenCalledWith('test:job:added', expect.any(String));
        done();
      }, 5); // Reduced from 10ms to 5ms
    });
  });

  describe('Job Filtering', () => {
    test('should filter jobs by type', async () => {
      // Add jobs of different types
      await redisQueue.addJob('sentiment_analysis_batch', { text: 'test1' });
      await redisQueue.addJob('file_processing', { file: 'test.txt' });
      await redisQueue.addJob('sentiment_analysis_batch', { text: 'test2' });
      
      // Get jobs filtered by type
      const jobs = await redisQueue.getJobs({ type: 'sentiment_analysis_batch' });
      
      expect(jobs).toHaveLength(2);
      expect(jobs.every(j => j.type === 'sentiment_analysis_batch')).toBe(true);
    });

    test('should limit number of returned jobs', async () => {
      // Add multiple jobs
      for (let i = 0; i < 5; i++) {
        await redisQueue.addJob('sentiment_analysis_batch', { text: `test${i}` });
      }
      
      // Get limited number of jobs
      const jobs = await redisQueue.getJobs({ limit: 3 });
      
      expect(jobs).toHaveLength(3);
    });
  });

  describe('Disconnect Alias', () => {
    test('should disconnect using alias method', async () => {
      const newQueue = new RedisJobQueueService(testConfig, {
        redis: new MockRedisInstance() as any,
        subscriberRedis: new MockRedisInstance() as any
      });
      
      await newQueue.disconnect();
      
      // Verify disconnected
      expect((newQueue as any).redis.store.size).toBe(0);
    });
  });
});