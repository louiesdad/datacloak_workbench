import { JobQueueService, Job } from '../job-queue.service';
import { progressEmitter } from '../progress-emitter.service';
import { eventEmitter } from '../event.service';

// Mock dependencies to avoid external service issues
jest.mock('../sentiment.service');
jest.mock('../data.service');
jest.mock('../security.service');
jest.mock('../file-stream.service');
jest.mock('fs');
jest.mock('path');

describe('Job Queue Progressive Integration', () => {
  let jobQueue: JobQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    jobQueue = new JobQueueService({ maxConcurrentJobs: 2 });
    
    // Mock handler for sentiment_analysis_batch
    jobQueue.registerHandler('sentiment_analysis_batch', async (job: Job, updateProgress) => {
      // Simulate progressive processing
      for (let i = 0; i <= 100; i += 20) {
        updateProgress(i);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      return {
        totalProcessed: job.data.texts?.length || 0,
        results: (job.data.texts || []).map((text: string) => ({
          originalText: text,
          sentiment: 'positive',
          confidence: 0.85
        })),
        summary: {
          successful: job.data.texts?.length || 0,
          failed: 0
        }
      };
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jobQueue.stopProcessing();
  });

  describe('Progressive Job Processing', () => {
    it('should create and process sentiment analysis job with progress tracking', async () => {
      // RED: This test should fail initially because job queue doesn't emit proper progress events
      const progressUpdates: Array<{ jobId: string; progress: number }> = [];
      
      // Listen for progress events
      jobQueue.on('job:progress', (event) => {
        progressUpdates.push({
          jobId: event.jobId,
          progress: event.progress
        });
      });

      const jobData = {
        texts: ['Happy text', 'Sad text', 'Neutral text'],
        enablePIIMasking: true,
        model: 'basic'
      };

      const jobId = jobQueue.addJob('sentiment_analysis_batch', jobData, { priority: 'high' });
      
      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Wait for job completion
      const completedJob = await jobQueue.waitForJob(jobId, 5000);
      
      expect(completedJob.status).toBe('completed');
      expect(completedJob.result).toBeDefined();
      expect(completedJob.result.totalProcessed).toBe(3);
      expect(completedJob.result.results).toHaveLength(3);
      expect(completedJob.progress).toBe(100);

      // Verify progress updates were emitted
      expect(progressUpdates.length).toBeGreaterThan(0);
      const jobProgressUpdates = progressUpdates.filter(p => p.jobId === jobId);
      expect(jobProgressUpdates.length).toBeGreaterThan(0);
    });

    it('should handle job priority ordering correctly', async () => {
      const completedJobs: string[] = [];

      jobQueue.on('job:completed', (job) => {
        completedJobs.push(job.id);
      });

      // Create jobs with different priorities
      const lowPriorityJobId = jobQueue.addJob('sentiment_analysis_batch', {
        texts: ['Low priority text']
      }, { priority: 'low' });

      const highPriorityJobId = jobQueue.addJob('sentiment_analysis_batch', {
        texts: ['High priority text']  
      }, { priority: 'high' });

      const criticalPriorityJobId = jobQueue.addJob('sentiment_analysis_batch', {
        texts: ['Critical priority text']
      }, { priority: 'critical' });

      // Wait for all jobs to complete
      await Promise.all([
        jobQueue.waitForJob(lowPriorityJobId, 5000),
        jobQueue.waitForJob(highPriorityJobId, 5000),
        jobQueue.waitForJob(criticalPriorityJobId, 5000)
      ]);

      // Critical should complete first, then high, then low
      expect(completedJobs[0]).toBe(criticalPriorityJobId);
      expect(completedJobs[1]).toBe(highPriorityJobId);
      expect(completedJobs[2]).toBe(lowPriorityJobId);
    });

    it('should emit WebSocket events for job lifecycle', async () => {
      const emittedEvents: any[] = [];

      // Mock event emitter to capture events
      const originalEmit = eventEmitter.emit;
      eventEmitter.emit = jest.fn((event, data) => {
        emittedEvents.push({ event, data });
        return originalEmit.call(eventEmitter, event, data);
      });

      const jobData = {
        texts: ['Test text for WebSocket'],
        enablePIIMasking: true
      };

      const jobId = jobQueue.addJob('sentiment_analysis_batch', jobData);
      await jobQueue.waitForJob(jobId, 5000);

      // Verify WebSocket events were emitted
      const jobEvents = emittedEvents.filter(e => 
        e.event === 'JOB_CREATED' || 
        e.event === 'JOB_PROGRESS' || 
        e.event === 'JOB_COMPLETE'
      );

      expect(jobEvents.length).toBeGreaterThan(0);
      
      // Should have at least job created and completed events
      const createdEvent = jobEvents.find(e => e.event === 'JOB_CREATED');
      const completedEvent = jobEvents.find(e => e.event === 'JOB_COMPLETE');
      
      expect(createdEvent).toBeDefined();
      expect(createdEvent.data.jobId).toBe(jobId);
      expect(completedEvent).toBeDefined();
      expect(completedEvent.data.jobId).toBe(jobId);

      // Restore original emit
      eventEmitter.emit = originalEmit;
    });

    it('should provide comprehensive job statistics', async () => {
      // Create multiple jobs
      const successJobId = jobQueue.addJob('sentiment_analysis_batch', {
        texts: ['Success text']
      });

      // Mock failure for one job by registering a failing handler temporarily
      const originalHandler = (jobQueue as any).handlers.get('sentiment_analysis_batch');
      
      let callCount = 0;
      jobQueue.registerHandler('sentiment_analysis_batch', async (job: Job, updateProgress) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Simulated failure');
        }
        return originalHandler(job, updateProgress);
      });

      const failJobId = jobQueue.addJob('sentiment_analysis_batch', {
        texts: ['Fail text']
      });

      // Wait for jobs to complete
      await jobQueue.waitForJob(successJobId, 5000);
      await jobQueue.waitForJob(failJobId, 5000);

      const stats = jobQueue.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
    });

    it('should allow cancellation of pending jobs', async () => {
      // Stop processing to keep jobs pending
      jobQueue.stopProcessing();

      const jobData = {
        texts: ['Job to be cancelled'],
        enablePIIMasking: true
      };

      const jobId = jobQueue.addJob('sentiment_analysis_batch', jobData);
      
      // Verify job is pending
      const pendingJob = jobQueue.getJob(jobId);
      expect(pendingJob?.status).toBe('pending');

      // Cancel the job
      const cancelled = jobQueue.cancelJob(jobId);
      expect(cancelled).toBe(true);

      // Verify job is cancelled
      const cancelledJob = jobQueue.getJob(jobId);
      expect(cancelledJob?.status).toBe('cancelled');
    });

    it('should integrate with progress emitter for detailed tracking', async () => {
      const progressUpdates: any[] = [];

      // Listen to progress emitter events
      eventEmitter.on('job:progress', (data) => {
        progressUpdates.push(data);
      });

      const jobData = {
        texts: ['Progress tracking test'],
        enablePIIMasking: true
      };

      const jobId = jobQueue.addJob('sentiment_analysis_batch', jobData);
      await jobQueue.waitForJob(jobId, 5000);

      // Verify progress tracking
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.progress).toBe(100);
      expect(finalProgress.jobId).toBe(jobId);
    });
  });

  describe('Progressive Emitter Integration', () => {
    it('should work with progress emitter service for sentiment jobs', async () => {
      const progressEmitterUpdates: any[] = [];

      // Listen to progress emitter
      eventEmitter.on('job:progress', (data) => {
        progressEmitterUpdates.push(data);
      });

      // Initialize a job manually with progress emitter
      const jobId = `test-${Date.now()}`;
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      
      progressEmitter.initializeJob(jobId, texts.length);

      // Simulate processing with progress updates
      for (let i = 0; i < texts.length; i++) {
        progressEmitter.updateProgress(jobId, i + 1);
      }

      progressEmitter.completeJob(jobId, {
        totalProcessed: texts.length,
        results: texts.map(text => ({ text, sentiment: 'positive' }))
      });

      // Verify events were emitted
      expect(progressEmitterUpdates.length).toBeGreaterThan(0);
      
      const jobUpdates = progressEmitterUpdates.filter(u => u.jobId === jobId);
      expect(jobUpdates.length).toBeGreaterThan(0);
    });
  });
});