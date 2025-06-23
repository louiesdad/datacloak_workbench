import { getJobQueueService, createJobQueueService, resetJobQueueService } from '../../services/job-queue.factory';
import { ConfigService } from '../../services/config.service';
import { JobType, JobHandler } from '../../services/job-queue.service';

describe('Job Queue Performance Tests', () => {
  let configService: ConfigService;
  
  beforeAll(async () => {
    configService = ConfigService.getInstance();
    
    // Set up test configuration using update method
    await configService.update('JOB_QUEUE_MAX_CONCURRENT', 5);
    await configService.update('JOB_QUEUE_RETRY_ATTEMPTS', 3);
    await configService.update('JOB_QUEUE_RETRY_DELAY', 100);
  });

  afterEach(async () => {
    await resetJobQueueService();
  });

  describe('Memory-based Job Queue Performance', () => {
    beforeEach(async () => {
      configService.set('REDIS_ENABLED', false);
    });

    it('should handle high-volume job processing efficiently', async () => {
      const jobQueue = await getJobQueueService();
      const jobCount = 1000;
      const batchSize = 50;
      
      // Register a fast handler
      const fastHandler: JobHandler = async (job, updateProgress) => {
        updateProgress(50);
        await new Promise(resolve => setTimeout(resolve, 10)); // 10ms processing time
        updateProgress(100);
        return { processed: true, jobId: job.id };
      };
      
      jobQueue.registerHandler('file_processing', fastHandler);

      console.time('High Volume Job Processing');
      
      // Add jobs in batches
      const jobIds: string[] = [];
      for (let batch = 0; batch < jobCount / batchSize; batch++) {
        const batchJobs: string[] = [];
        
        for (let i = 0; i < batchSize; i++) {
          const jobId = jobQueue.addJob('file_processing', {
            batchId: batch,
            index: i,
            data: `Test data for job ${batch * batchSize + i}`
          });
          
          if (typeof jobId === 'string') {
            batchJobs.push(jobId);
          }
        }
        
        jobIds.push(...batchJobs);
      }

      // Wait for all jobs to complete
      await Promise.all(jobIds.map(jobId => jobQueue.waitForJob(jobId, 30000)));
      
      console.timeEnd('High Volume Job Processing');

      const stats = jobQueue.getStats();
      console.log('High Volume Processing Stats:', {
        totalJobs: jobCount,
        completedJobs: stats.completedJobs,
        failedJobs: stats.failedJobs,
        averageProcessingTime: `${stats.averageProcessingTime}ms`,
        throughput: `${(jobCount / (stats.averageProcessingTime * jobCount / 1000)).toFixed(2)} jobs/sec`
      });

      expect(stats.completedJobs).toBe(jobCount);
      expect(stats.failedJobs).toBe(0);
      expect(stats.averageProcessingTime).toBeLessThan(100); // Should average less than 100ms per job
    }, 60000);

    it('should handle concurrent job types efficiently', async () => {
      const jobQueue = await getJobQueueService();
      
      // Register multiple handlers with different processing times
      const handlers: Record<JobType, JobHandler> = {
        sentiment_analysis_batch: async (job, updateProgress) => {
          updateProgress(25);
          await new Promise(resolve => setTimeout(resolve, 50)); // 50ms
          updateProgress(75);
          await new Promise(resolve => setTimeout(resolve, 25)); // +25ms = 75ms total
          updateProgress(100);
          return { sentiment: 'positive', confidence: 0.95 };
        },
        file_processing: async (job, updateProgress) => {
          updateProgress(33);
          await new Promise(resolve => setTimeout(resolve, 30)); // 30ms
          updateProgress(66);
          await new Promise(resolve => setTimeout(resolve, 20)); // +20ms = 50ms total
          updateProgress(100);
          return { processed: true, rows: 1000 };
        },
        security_scan: async (job, updateProgress) => {
          updateProgress(20);
          await new Promise(resolve => setTimeout(resolve, 40)); // 40ms
          updateProgress(60);
          await new Promise(resolve => setTimeout(resolve, 30)); // +30ms = 70ms total
          updateProgress(100);
          return { threats: 0, piiDetected: 2 };
        },
        data_export: async (job, updateProgress) => {
          updateProgress(10);
          await new Promise(resolve => setTimeout(resolve, 60)); // 60ms
          updateProgress(50);
          await new Promise(resolve => setTimeout(resolve, 40)); // +40ms = 100ms total
          updateProgress(100);
          return { exported: true, size: '2.5MB' };
        }
      };

      // Register all handlers
      Object.entries(handlers).forEach(([type, handler]) => {
        jobQueue.registerHandler(type as JobType, handler);
      });

      console.time('Concurrent Job Types Processing');

      // Create mixed workload
      const jobIds: string[] = [];
      const jobTypes: JobType[] = ['sentiment_analysis_batch', 'file_processing', 'security_scan', 'data_export'];
      const jobsPerType = 25;

      for (const jobType of jobTypes) {
        for (let i = 0; i < jobsPerType; i++) {
          const jobId = jobQueue.addJob(jobType, {
            type: jobType,
            index: i,
            testData: `Data for ${jobType} job ${i}`
          }, {
            priority: i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low'
          });
          
          if (typeof jobId === 'string') {
            jobIds.push(jobId);
          }
        }
      }

      // Wait for all jobs to complete
      await Promise.all(jobIds.map(jobId => jobQueue.waitForJob(jobId, 15000)));
      
      console.timeEnd('Concurrent Job Types Processing');

      const stats = jobQueue.getStats();
      const jobs = jobQueue.getJobs();
      
      // Analyze by job type
      const typeStats = jobTypes.map(type => {
        const typeJobs = jobs.filter(job => job.type === type);
        const completedJobs = typeJobs.filter(job => job.status === 'completed');
        const avgTime = completedJobs.length > 0 
          ? completedJobs.reduce((acc, job) => {
              if (job.startedAt && job.completedAt) {
                return acc + (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime());
              }
              return acc;
            }, 0) / completedJobs.length
          : 0;
        
        return {
          type,
          total: typeJobs.length,
          completed: completedJobs.length,
          avgProcessingTime: Math.round(avgTime)
        };
      });

      console.log('Concurrent Job Types Stats:', typeStats);

      expect(stats.completedJobs).toBe(jobsPerType * jobTypes.length);
      expect(stats.failedJobs).toBe(0);
      
      // Verify all job types were processed
      typeStats.forEach(stat => {
        expect(stat.completed).toBe(jobsPerType);
        expect(stat.avgProcessingTime).toBeGreaterThan(0);
        expect(stat.avgProcessingTime).toBeLessThan(200); // All should complete within 200ms average
      });
    }, 30000);

    it('should handle job queue persistence through simulated restarts', async () => {
      let jobQueue = await getJobQueueService();
      
      // Register handler
      jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
        updateProgress(50);
        await new Promise(resolve => setTimeout(resolve, 100));
        updateProgress(100);
        return { processed: true };
      });

      // Add some jobs
      const jobIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const jobId = jobQueue.addJob('file_processing', { index: i });
        if (typeof jobId === 'string') {
          jobIds.push(jobId);
        }
      }

      // Wait for a few to start processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get initial stats
      const initialStats = jobQueue.getStats();
      console.log('Pre-restart stats:', initialStats);

      // Simulate restart by stopping and recreating the queue
      jobQueue.stopProcessing();
      await resetJobQueueService();

      // Create new queue instance
      jobQueue = await getJobQueueService();
      
      // Re-register handler
      jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
        updateProgress(50);
        await new Promise(resolve => setTimeout(resolve, 50));
        updateProgress(100);
        return { processed: true };
      });

      // For memory-based queue, jobs are lost on restart (expected behavior)
      // This test verifies that the system can handle restarts gracefully
      const postRestartStats = jobQueue.getStats();
      
      console.log('Post-restart stats:', postRestartStats);
      
      // Memory-based queue starts fresh after restart
      expect(postRestartStats.pendingJobs + postRestartStats.runningJobs + postRestartStats.completedJobs).toBe(0);
    }, 10000);
  });

  describe('Redis-based Job Queue Performance', () => {
    beforeEach(async () => {
      // Enable Redis for these tests
      configService.set('REDIS_ENABLED', true);
      configService.set('REDIS_HOST', 'localhost');
      configService.set('REDIS_PORT', 6379);
      configService.set('REDIS_DB', 15); // Use test database
    });

    it('should handle persistent job queue with Redis', async () => {
      try {
        const jobQueue = await getJobQueueService();
        
        // Register handler
        jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
          updateProgress(50);
          await new Promise(resolve => setTimeout(resolve, 50));
          updateProgress(100);
          return { processed: true, persistent: true };
        });

        console.time('Redis Job Queue Processing');

        // Add jobs
        const jobIds: string[] = [];
        for (let i = 0; i < 50; i++) {
          const jobId = await jobQueue.addJob('file_processing', { 
            index: i,
            persistent: true 
          });
          
          if (typeof jobId === 'string') {
            jobIds.push(jobId);
          }
        }

        // Wait for all jobs to complete
        await Promise.all(jobIds.map(jobId => jobQueue.waitForJob(jobId, 10000)));

        console.timeEnd('Redis Job Queue Processing');

        const stats = jobQueue.getStats();
        console.log('Redis Queue Performance Stats:', {
          completedJobs: stats.completedJobs,
          failedJobs: stats.failedJobs,
          averageProcessingTime: `${stats.averageProcessingTime}ms`
        });

        expect(stats.completedJobs).toBe(50);
        expect(stats.failedJobs).toBe(0);
      } catch (error) {
        if (error.message.includes('Redis connection') || error.message.includes('ECONNREFUSED')) {
          console.log('Redis not available, skipping Redis performance tests');
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle job persistence through Redis restart simulation', async () => {
      try {
        let jobQueue = await getJobQueueService();
        
        // Register handler
        jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
          updateProgress(25);
          await new Promise(resolve => setTimeout(resolve, 200)); // Longer processing time
          updateProgress(75);
          await new Promise(resolve => setTimeout(resolve, 100));
          updateProgress(100);
          return { processed: true, persistent: true };
        });

        // Add jobs
        const jobIds: string[] = [];
        for (let i = 0; i < 20; i++) {
          const jobId = await jobQueue.addJob('file_processing', { 
            index: i,
            persistent: true 
          });
          
          if (typeof jobId === 'string') {
            jobIds.push(jobId);
          }
        }

        // Wait a bit for some jobs to start
        await new Promise(resolve => setTimeout(resolve, 100));

        const preRestartStats = jobQueue.getStats();
        console.log('Pre-restart Redis stats:', preRestartStats);

        // Simulate restart
        if ('close' in jobQueue) {
          await (jobQueue as any).close();
        }
        await resetJobQueueService();

        // Create new queue instance
        jobQueue = await getJobQueueService();
        
        // Re-register handler
        jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
          updateProgress(50);
          await new Promise(resolve => setTimeout(resolve, 50));
          updateProgress(100);
          return { processed: true, recovered: true };
        });

        // Wait for remaining jobs to complete
        await Promise.all(jobIds.map(jobId => jobQueue.waitForJob(jobId, 15000)));

        const postRestartStats = jobQueue.getStats();
        console.log('Post-restart Redis stats:', postRestartStats);

        // With Redis, jobs should persist through restart
        expect(postRestartStats.completedJobs).toBe(20);
        expect(postRestartStats.failedJobs).toBe(0);

      } catch (error) {
        if (error.message.includes('Redis connection') || error.message.includes('ECONNREFUSED')) {
          console.log('Redis not available, skipping Redis persistence tests');
          return;
        }
        throw error;
      }
    }, 45000);
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance requirements', async () => {
      const jobQueue = await getJobQueueService();
      
      // Benchmark: Process 100 jobs in under 5 seconds
      const jobCount = 100;
      const maxTimeMs = 5000;
      
      jobQueue.registerHandler('file_processing', async (job, updateProgress) => {
        updateProgress(50);
        await new Promise(resolve => setTimeout(resolve, 20)); // 20ms per job
        updateProgress(100);
        return { benchmark: true };
      });

      const startTime = Date.now();
      
      const jobIds: string[] = [];
      for (let i = 0; i < jobCount; i++) {
        const jobId = jobQueue.addJob('file_processing', { benchmarkIndex: i });
        if (typeof jobId === 'string') {
          jobIds.push(jobId);
        }
      }

      await Promise.all(jobIds.map(jobId => jobQueue.waitForJob(jobId, 10000)));
      
      const totalTime = Date.now() - startTime;
      const throughput = (jobCount / totalTime) * 1000; // jobs per second

      console.log('Performance Benchmark Results:', {
        totalJobs: jobCount,
        totalTimeMs: totalTime,
        throughput: `${throughput.toFixed(2)} jobs/sec`,
        averageTimePerJob: `${(totalTime / jobCount).toFixed(2)}ms`,
        targetMet: totalTime < maxTimeMs
      });

      expect(totalTime).toBeLessThan(maxTimeMs);
      expect(throughput).toBeGreaterThan(10); // At least 10 jobs per second
    }, 15000);
  });
});