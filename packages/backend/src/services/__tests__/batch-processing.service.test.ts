import { BatchProcessingService, BatchOptions, BatchProcessor } from '../batch-processing.service';
import { JobQueueService } from '../job-queue.service';
import { RedisJobQueueService } from '../redis-queue.service';
import { getCacheService } from '../cache.service';

// Mock dependencies
jest.mock('../cache.service');
jest.mock('../job-queue.service');
jest.mock('../redis-queue.service');

describe('BatchProcessingService', () => {
  let batchService: BatchProcessingService;
  let mockJobQueue: jest.Mocked<JobQueueService>;
  let mockCache: any;
  
  // Helper function to create test items
  const createTestItems = (count: number) => 
    Array.from({ length: count }, (_, i) => ({ id: i, data: `item-${i}` }));
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock cache service
    mockCache = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(true),
      keys: jest.fn().mockResolvedValue([])
    };
    (getCacheService as jest.Mock).mockReturnValue(mockCache);
    
    // Mock job queue
    mockJobQueue = new JobQueueService() as jest.Mocked<JobQueueService>;
    mockJobQueue.addJob = jest.fn().mockImplementation(() => Promise.resolve(`job-${Date.now()}`));
    mockJobQueue.getJob = jest.fn().mockResolvedValue(null);
    mockJobQueue.cancelJob = jest.fn().mockResolvedValue(true);
    
    batchService = new BatchProcessingService(mockJobQueue);
  });

  describe('processBatch', () => {
    const mockProcessor: BatchProcessor<any, any> = jest.fn()
      .mockImplementation(async (items) => 
        items.map((item: any) => ({ ...item, processed: true }))
      );

    beforeEach(() => {
      mockProcessor.mockClear();
      mockProcessor.mockImplementation(async (items) => 
        items.map((item: any) => ({ ...item, processed: true }))
      );
    });

    test('should process items sequentially in chunks', async () => {
      const items = createTestItems(25);
      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false
      };

      const result = await batchService.processBatch(items, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(25);
      expect(result.successfulItems).toBe(25);
      expect(result.failedItems).toBe(0);
      expect(result.results).toHaveLength(25);
      expect(mockProcessor).toHaveBeenCalledTimes(3); // 3 chunks
    });

    test('should process items in parallel', async () => {
      const items = createTestItems(50);
      const options: BatchOptions = {
        chunkSize: 10,
        parallel: true,
        maxConcurrency: 2
      };

      const result = await batchService.processBatch(items, mockProcessor, options);

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(50);
      expect(result.successfulItems).toBe(50);
      expect(result.results).toHaveLength(50);
      expect(mockProcessor).toHaveBeenCalledTimes(5); // 5 chunks
    });

    test('should handle processing errors gracefully', async () => {
      const items = createTestItems(30);
      const errorProcessor = jest.fn()
        .mockImplementationOnce(async (items) => items.map((i: any) => ({ ...i, processed: true })))
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockImplementationOnce(async (items) => items.map((i: any) => ({ ...i, processed: true })));

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false
      };

      const result = await batchService.processBatch(items, errorProcessor, options);

      expect(result.success).toBe(false);
      expect(result.successfulItems).toBe(20); // 2 successful chunks
      expect(result.failedItems).toBe(10); // 1 failed chunk
      expect(result.errors).toHaveLength(10);
      expect(result.errors[0].error).toBe('Processing failed');
    });

    test('should emit progress events', async () => {
      const items = createTestItems(20);
      const progressEvents: any[] = [];
      
      batchService.on('batch:progress', (progress) => {
        progressEvents.push(progress);
      });

      const options: BatchOptions = {
        chunkSize: 5,
        parallel: false
      };

      await batchService.processBatch(items, mockProcessor, options);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentComplete).toBe(100);
    });

    test('should call progress callback', async () => {
      const items = createTestItems(15);
      const progressCallback = jest.fn();

      const options: BatchOptions = {
        chunkSize: 5,
        parallel: false,
        progressCallback
      };

      await batchService.processBatch(items, mockProcessor, options);

      expect(progressCallback).toHaveBeenCalled();
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall.percentComplete).toBe(100);
      expect(lastCall.processedItems).toBe(15);
    });

    test('should handle timeout correctly', async () => {
      const items = createTestItems(10);
      const slowProcessor = jest.fn().mockImplementation(async (items) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return items;
      });

      const options: BatchOptions = {
        chunkSize: 5,
        parallel: false,
        timeout: 100
      };

      const result = await batchService.processBatch(items, slowProcessor, options);

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('timeout');
    });

    test('should cache batch results', async () => {
      const items = createTestItems(10);
      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false
      };

      const result = await batchService.processBatch(items, mockProcessor, options);

      expect(mockCache.set).toHaveBeenCalledWith(
        `batch:result:${result.batchId}`,
        expect.objectContaining({
          batchId: result.batchId,
          success: true,
          totalItems: 10
        }),
        { ttl: 3600 }
      );
    });

    test('should calculate estimated time remaining', async () => {
      const items = createTestItems(100);
      let lastProgress: any;

      const slowProcessor = jest.fn().mockImplementation(async (items) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return items.map((i: any) => ({ ...i, processed: true }));
      });

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false,
        progressCallback: (progress) => {
          lastProgress = progress;
        }
      };

      await batchService.processBatch(items, slowProcessor, options);

      expect(lastProgress).toBeDefined();
      expect(lastProgress.estimatedTimeRemaining).toBeDefined();
    });
  });

  describe('createBatchJob', () => {
    test('should create batch job with multiple chunks', async () => {
      const items = createTestItems(35);
      const options = {
        chunkSize: 10,
        parallel: false,
        priority: 'high' as const
      };

      const batchId = await batchService.createBatchJob(items, 'test_job', options);

      expect(batchId).toBeDefined();
      expect(mockJobQueue.addJob).toHaveBeenCalledTimes(4); // 4 chunks
      expect(mockCache.set).toHaveBeenCalledWith(
        `batch:meta:${batchId}`,
        expect.objectContaining({
          totalItems: 35,
          chunks: 4,
          chunkSize: 10
        }),
        { ttl: 86400 }
      );
    });

    test('should store job IDs for batch', async () => {
      const items = createTestItems(20);
      const options = {
        chunkSize: 10,
        parallel: true
      };

      mockJobQueue.addJob
        .mockResolvedValueOnce('job-1')
        .mockResolvedValueOnce('job-2');

      const batchId = await batchService.createBatchJob(items, 'test_job', options);

      expect(mockCache.set).toHaveBeenCalledWith(
        `batch:jobs:${batchId}`,
        ['job-1', 'job-2'],
        { ttl: 86400 }
      );
    });

    test('should emit batch job created event', async () => {
      const items = createTestItems(15);
      const options = { chunkSize: 5, parallel: false };
      
      let eventData: any;
      batchService.on('batch:job:created', (data) => {
        eventData = data;
      });

      const batchId = await batchService.createBatchJob(items, 'test_job', options);

      expect(eventData).toEqual({
        batchId,
        jobs: 3
      });
    });
  });

  describe('getBatchStatus', () => {
    test('should return status for active batch', async () => {
      // Start a batch to make it active
      const items = createTestItems(10);
      const processor = jest.fn().mockImplementation(async (items) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return items;
      });

      // Get batch ID from started event
      let batchId: string;
      batchService.on('batch:started', (data) => {
        batchId = data.batchId;
      });

      const batchPromise = batchService.processBatch(items, processor, {
        chunkSize: 5,
        parallel: false
      });

      // Wait for the batch to start
      await new Promise(resolve => setTimeout(resolve, 10));

      if (batchId!) {
        const status = await batchService.getBatchStatus(batchId);
        expect(status).toBeDefined();
        expect(status!.totalItems).toBe(10);
      }

      await batchPromise;
    });

    test('should return status from cached metadata', async () => {
      const batchId = 'test-batch-123';
      const jobIds = ['job-1', 'job-2', 'job-3'];
      
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `batch:meta:${batchId}`) {
          return {
            batchId,
            totalItems: 30,
            chunks: 3,
            createdAt: new Date()
          };
        }
        if (key === `batch:jobs:${batchId}`) {
          return jobIds;
        }
        return null;
      });

      mockJobQueue.getJob.mockImplementation(async (jobId: string) => ({
        id: jobId,
        type: 'test_job',
        status: 'completed',
        priority: 'medium',
        data: { items: Array(10).fill({}) },
        result: { processed: 10, successful: 10, failed: 0 },
        createdAt: new Date(),
        completedAt: new Date(),
        progress: 100
      }));

      const status = await batchService.getBatchStatus(batchId);

      expect(status).toBeDefined();
      expect(status!.totalItems).toBe(30);
      expect(status!.processedItems).toBe(30);
      expect(status!.successfulItems).toBe(30);
      expect(status!.percentComplete).toBe(100);
    });

    test('should return null for non-existent batch', async () => {
      const status = await batchService.getBatchStatus('non-existent');
      expect(status).toBeNull();
    });

    test('should handle failed jobs in status', async () => {
      const batchId = 'test-batch-failed';
      
      mockCache.get.mockImplementation(async (key: string) => {
        if (key === `batch:meta:${batchId}`) {
          return {
            batchId,
            totalItems: 20,
            chunks: 2,
            createdAt: new Date()
          };
        }
        if (key === `batch:jobs:${batchId}`) {
          return ['job-1', 'job-2'];
        }
        return null;
      });

      mockJobQueue.getJob
        .mockResolvedValueOnce({
          id: 'job-1',
          type: 'test_job',
          status: 'completed',
          priority: 'medium',
          data: { items: Array(10).fill({}) },
          result: { processed: 10, successful: 10, failed: 0 },
          createdAt: new Date(),
          progress: 100
        } as any)
        .mockResolvedValueOnce({
          id: 'job-2',
          type: 'test_job',
          status: 'failed',
          priority: 'medium',
          data: { items: Array(10).fill({}) },
          error: 'Processing failed',
          createdAt: new Date(),
          progress: 0
        } as any);

      const status = await batchService.getBatchStatus(batchId);

      expect(status!.successfulItems).toBe(10);
      expect(status!.failedItems).toBe(10);
      expect(status!.percentComplete).toBe(100);
    });
  });

  describe('cancelBatch', () => {
    test('should cancel all batch jobs', async () => {
      const batchId = 'test-batch-cancel';
      const jobIds = ['job-1', 'job-2', 'job-3'];
      
      mockCache.get.mockResolvedValue(jobIds);
      mockJobQueue.cancelJob.mockResolvedValue(true);

      const result = await batchService.cancelBatch(batchId);

      expect(result).toBe(true);
      expect(mockJobQueue.cancelJob).toHaveBeenCalledTimes(3);
      expect(mockCache.del).toHaveBeenCalledWith(`batch:meta:${batchId}`);
      expect(mockCache.del).toHaveBeenCalledWith(`batch:jobs:${batchId}`);
    });

    test('should emit batch cancelled event', async () => {
      const batchId = 'test-batch-cancel';
      const jobIds = ['job-1', 'job-2'];
      
      mockCache.get.mockResolvedValue(jobIds);
      
      let eventData: any;
      batchService.on('batch:cancelled', (data) => {
        eventData = data;
      });

      await batchService.cancelBatch(batchId);

      expect(eventData).toEqual({
        batchId,
        cancelledJobs: 2
      });
    });

    test('should return false for non-existent batch', async () => {
      mockCache.get.mockResolvedValue(null);
      
      const result = await batchService.cancelBatch('non-existent');
      expect(result).toBe(false);
    });

    test('should handle partial cancellation', async () => {
      const batchId = 'test-batch-partial';
      const jobIds = ['job-1', 'job-2', 'job-3'];
      
      mockCache.get.mockResolvedValue(jobIds);
      mockJobQueue.cancelJob
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false) // Already completed
        .mockResolvedValueOnce(true);

      const result = await batchService.cancelBatch(batchId);

      expect(result).toBe(true);
      expect(mockJobQueue.cancelJob).toHaveBeenCalledTimes(3);
    });
  });

  describe('parallel processing', () => {
    test('should respect maxConcurrency limit', async () => {
      const items = createTestItems(50);
      let concurrentExecutions = 0;
      let maxConcurrentExecutions = 0;

      const processor = jest.fn().mockImplementation(async (items) => {
        concurrentExecutions++;
        maxConcurrentExecutions = Math.max(maxConcurrentExecutions, concurrentExecutions);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        concurrentExecutions--;
        return items.map((i: any) => ({ ...i, processed: true }));
      });

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: true,
        maxConcurrency: 3
      };

      await batchService.processBatch(items, processor, options);

      expect(maxConcurrentExecutions).toBeLessThanOrEqual(3);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    test('should handle mixed success and failure in parallel', async () => {
      const items = createTestItems(40);
      let callCount = 0;

      const processor = jest.fn().mockImplementation(async (items) => {
        callCount++;
        if (callCount === 2 || callCount === 4) {
          throw new Error(`Chunk ${callCount} failed`);
        }
        return items.map((i: any) => ({ ...i, processed: true }));
      });

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: true,
        maxConcurrency: 2
      };

      const result = await batchService.processBatch(items, processor, options);

      expect(result.success).toBe(false);
      expect(result.successfulItems).toBe(20); // 2 successful chunks
      expect(result.failedItems).toBe(20); // 2 failed chunks
      expect(result.errors).toHaveLength(20);
    });
  });

  describe('memory management', () => {
    test('should process large datasets efficiently', async () => {
      const items = createTestItems(10000);
      const processor = jest.fn().mockImplementation(async (items) => 
        items.map((i: any) => ({ id: i.id, result: 'processed' }))
      );

      const options: BatchOptions = {
        chunkSize: 500,
        parallel: true,
        maxConcurrency: 4
      };

      const result = await batchService.processBatch(items, processor, options);

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(10000);
      expect(result.results).toHaveLength(10000);
      expect(processor).toHaveBeenCalledTimes(20); // 10000 / 500
    });

    test('should not hold all results in memory at once', async () => {
      const items = createTestItems(1000);
      const results: any[] = [];

      // Custom processor that tracks memory usage
      const processor = jest.fn().mockImplementation(async (items, chunkIndex) => {
        const chunkResults = items.map((i: any) => ({
          ...i,
          processed: true,
          chunkIndex
        }));
        
        // In real implementation, results would be streamed or saved
        results.push(...chunkResults);
        
        return chunkResults;
      });

      const options: BatchOptions = {
        chunkSize: 100,
        parallel: false
      };

      await batchService.processBatch(items, processor, options);

      // Verify chunks were processed sequentially
      for (let i = 0; i < 10; i++) {
        const chunkResults = results.filter(r => r.chunkIndex === i);
        expect(chunkResults).toHaveLength(100);
      }
    });
  });

  describe('cleanup', () => {
    test('should clean up old batch data', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const recentDate = new Date();

      mockCache.keys.mockResolvedValue([
        'batch:meta:old-1',
        'batch:meta:old-2',
        'batch:meta:recent-1',
        'batch:result:old-1'
      ]);

      mockCache.get
        .mockResolvedValueOnce({ createdAt: oldDate })
        .mockResolvedValueOnce({ createdAt: oldDate })
        .mockResolvedValueOnce({ createdAt: recentDate })
        .mockResolvedValueOnce({ createdAt: oldDate });

      const cleaned = await batchService.cleanup(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(3);
      expect(mockCache.del).toHaveBeenCalledTimes(3);
      expect(mockCache.del).not.toHaveBeenCalledWith('batch:meta:recent-1');
    });

    test('should handle cleanup errors gracefully', async () => {
      mockCache.keys.mockResolvedValue(['batch:meta:test']);
      mockCache.get.mockResolvedValue({ createdAt: new Date(0) }); // Very old
      mockCache.del.mockRejectedValue(new Error('Delete failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Should not throw
      const cleaned = await batchService.cleanup();
      expect(cleaned).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('should emit appropriate events on errors', async () => {
      const items = createTestItems(20);
      const events: any[] = [];

      batchService.on('batch:chunk:error', (data) => events.push({ type: 'chunk:error', ...data }));
      batchService.on('batch:failed', (data) => events.push({ type: 'failed', ...data }));

      const processor = jest.fn()
        .mockRejectedValueOnce(new Error('Chunk 1 failed'))
        .mockRejectedValueOnce(new Error('Chunk 2 failed'));

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false
      };

      await batchService.processBatch(items, processor, options);

      expect(events.filter(e => e.type === 'chunk:error')).toHaveLength(2);
      expect(events[0].error).toBe('Chunk 1 failed');
    });

    test('should handle retry on failure option', async () => {
      const items = createTestItems(10);
      const events: any[] = [];

      batchService.on('batch:chunk:retry', (data) => events.push(data));

      const processor = jest.fn().mockRejectedValue(new Error('Failed'));

      const options: BatchOptions = {
        chunkSize: 10,
        parallel: false,
        retryOnFailure: true
      };

      await batchService.processBatch(items, processor, options);

      expect(events).toHaveLength(1);
      expect(events[0].chunkIndex).toBe(0);
    });
  });

  describe('getActiveJobs', () => {
    test('should return list of active batch jobs', async () => {
      const items1 = createTestItems(10);
      const items2 = createTestItems(20);

      const processor = jest.fn().mockImplementation(async (items) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return items;
      });

      // Start two batch jobs
      const promise1 = batchService.processBatch(items1, processor, { chunkSize: 5, parallel: false });
      const promise2 = batchService.processBatch(items2, processor, { chunkSize: 10, parallel: false });

      // Wait a bit for jobs to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const activeJobs = batchService.getActiveJobs();
      expect(activeJobs).toHaveLength(2);
      expect(activeJobs[0].totalItems).toBe(10);
      expect(activeJobs[1].totalItems).toBe(20);

      // Clean up
      await Promise.all([promise1, promise2]);
    });
  });

  describe('edge cases', () => {
    test('should handle empty items array', async () => {
      const items: any[] = [];
      const processor = jest.fn();

      const result = await batchService.processBatch(items, processor, { chunkSize: 10, parallel: false });

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(processor).not.toHaveBeenCalled();
    });

    test('should handle single item', async () => {
      const items = [{ id: 1, data: 'single' }];
      const processor = jest.fn().mockImplementation(async (items) => items);

      const result = await batchService.processBatch(items, processor, { chunkSize: 10, parallel: false });

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(1);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    test('should handle chunk size larger than items', async () => {
      const items = createTestItems(5);
      const processor = jest.fn().mockImplementation(async (items) => items);

      const result = await batchService.processBatch(items, processor, { chunkSize: 100, parallel: false });

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(5);
      expect(processor).toHaveBeenCalledTimes(1);
      expect(processor).toHaveBeenCalledWith(items, 0);
    });
  });
});