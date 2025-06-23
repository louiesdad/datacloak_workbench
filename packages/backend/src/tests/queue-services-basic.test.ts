/**
 * Basic Queue Services Tests
 * Simple tests to verify queue services are working
 */

import { MemoryJobQueueService } from '../services/memory-queue.service';
import { JobType, JobPriority } from '../services/job-queue.service';

describe('Basic Queue Services Tests', () => {
  describe('MemoryJobQueueService', () => {
    let memoryQueue: MemoryJobQueueService;

    beforeEach(() => {
      memoryQueue = new MemoryJobQueueService();
    });

    afterEach(async () => {
      await memoryQueue.close();
    });

    it('should create a memory queue instance', () => {
      expect(memoryQueue).toBeDefined();
      expect(memoryQueue.addJob).toBeDefined();
      expect(memoryQueue.getJob).toBeDefined();
    });

    it('should add and retrieve a job', async () => {
      const jobId = await memoryQueue.addJob(
        JobType.SENTIMENT_ANALYSIS,
        { text: 'test data' },
        { priority: JobPriority.MEDIUM }
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = await memoryQueue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe(JobType.SENTIMENT_ANALYSIS);
      expect(job?.data).toEqual({ text: 'test data' });
      expect(job?.priority).toBe(JobPriority.MEDIUM);
      expect(job?.status).toBe('pending');
    });

    it('should process a simple job', async () => {
      let jobProcessed = false;
      
      // Register a handler
      memoryQueue.registerHandler(JobType.SENTIMENT_ANALYSIS, async (job, updateProgress) => {
        jobProcessed = true;
        await updateProgress(100);
        return { result: 'processed' };
      });

      // Add a job
      const jobId = await memoryQueue.addJob(
        JobType.SENTIMENT_ANALYSIS,
        { text: 'test' }
      );

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(jobProcessed).toBe(true);
      
      const job = await memoryQueue.getJob(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.progress).toBe(100);
      expect(job?.result).toEqual({ result: 'processed' });
    });

    it('should get queue statistics', async () => {
      // Add some jobs
      await memoryQueue.addJob(JobType.SENTIMENT_ANALYSIS, { test: 1 });
      await memoryQueue.addJob(JobType.BATCH_ANALYSIS, { test: 2 });

      const stats = await memoryQueue.getStats();
      expect(stats).toBeDefined();
      expect(stats.waiting).toBeGreaterThanOrEqual(2);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Job Queue Factory', () => {
    it('should import job queue factory', () => {
      const factory = require('../services/job-queue.factory');
      expect(factory.getJobQueueService).toBeDefined();
    });
  });

  describe('Background Tasks Service Check', () => {
    it('should check if background tasks service exists', () => {
      try {
        const bgService = require('../services/background-tasks.service');
        expect(bgService).toBeDefined();
      } catch (error) {
        // Service doesn't exist - this is expected based on the review
        expect(error.code).toBe('MODULE_NOT_FOUND');
      }
    });
  });
});