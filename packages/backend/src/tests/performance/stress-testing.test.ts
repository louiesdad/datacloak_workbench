/**
 * Stress Testing Infrastructure
 * High-load stress tests to identify breaking points and resource limits
 */

import request from 'supertest';
import express from 'express';
import { EventEmitter } from 'events';

// Mock services for stress testing
jest.mock('../../services/job-queue.factory');
jest.mock('../../services/cache.service');
jest.mock('../../services/config.service');
jest.mock('../../middleware/auth.middleware');

import { getJobQueueService } from '../../services/job-queue.factory';
import { getCacheService } from '../../services/cache.service';
import { ConfigService } from '../../services/config.service';
import { authenticate } from '../../middleware/auth.middleware';

describe('Stress Testing Infrastructure', () => {
  let app: express.Application;
  let stressMetrics: {
    maxConcurrency: number;
    errorRate: number;
    avgResponseTime: number;
    memoryPeak: number;
  };

  beforeAll(() => {
    // Increase EventEmitter limits for stress testing
    EventEmitter.defaultMaxListeners = 1000;
    
    // Mock services with stress-test appropriate responses
    (authenticate as jest.Mock).mockImplementation((req, res, next) => {
      req.user = { id: 'stress-test-user', role: 'admin' };
      next();
    });

    (ConfigService.getInstance as jest.Mock).mockReturnValue({
      get: jest.fn().mockReturnValue('stress-test-value'),
      isOpenAIConfigured: jest.fn().mockReturnValue(true)
    });

    (getCacheService as jest.Mock).mockReturnValue({
      get: jest.fn().mockImplementation(() => {
        // Simulate cache access with occasional delays
        return new Promise(resolve => {
          setTimeout(() => resolve(null), Math.random() * 10);
        });
      }),
      set: jest.fn().mockResolvedValue(true),
      getStats: jest.fn().mockReturnValue({
        hits: 1000, misses: 200, hitRate: 0.83, totalOperations: 1200
      })
    });

    (getJobQueueService as jest.Mock).mockResolvedValue({
      getStats: jest.fn().mockImplementation(() => {
        // Simulate varying load conditions
        return Promise.resolve({
          waiting: Math.floor(Math.random() * 50),
          active: Math.floor(Math.random() * 20),
          completed: Math.floor(Math.random() * 1000),
          failed: Math.floor(Math.random() * 10),
          delayed: 0,
          paused: 0
        });
      }),
      getJobs: jest.fn().mockImplementation(() => {
        // Simulate job list with varying sizes
        const jobCount = Math.floor(Math.random() * 100);
        return Promise.resolve(Array.from({ length: jobCount }, (_, i) => ({
          id: `stress-job-${i}`,
          status: ['pending', 'running', 'completed'][Math.floor(Math.random() * 3)],
          type: 'stress-test'
        })));
      }),
      addJob: jest.fn().mockImplementation(() => {
        // Simulate job creation delays
        return new Promise(resolve => {
          setTimeout(() => resolve({ id: `stress-job-${Date.now()}` }), Math.random() * 50);
        });
      })
    });

    // Create stress test app
    app = express();
    app.use(express.json({ limit: '1mb' }));
    
    // Stress test endpoints
    app.get('/api/stress/light', (req, res) => {
      res.json({ message: 'light', timestamp: Date.now() });
    });
    
    app.get('/api/stress/medium', authenticate, async (req, res) => {
      // Simulate medium load with some async operations
      const cacheService = getCacheService();
      await cacheService.get('test-key');
      
      res.json({
        message: 'medium',
        timestamp: Date.now(),
        memoryUsage: process.memoryUsage()
      });
    });
    
    app.post('/api/stress/heavy', authenticate, async (req, res) => {
      // Simulate heavy load with multiple service calls
      const jobQueue = await getJobQueueService();
      const [stats, jobs] = await Promise.all([
        jobQueue.getStats(),
        jobQueue.getJobs()
      ]);
      
      // Simulate data processing
      const data = req.body.data || [];
      const processed = data.map((item: any, index: number) => ({
        ...item,
        processedAt: Date.now(),
        index
      }));
      
      res.json({
        message: 'heavy',
        timestamp: Date.now(),
        stats,
        jobCount: jobs.length,
        processedCount: processed.length,
        memoryUsage: process.memoryUsage()
      });
    });
    
    app.get('/api/stress/memory', (req, res) => {
      // Create temporary memory pressure
      const size = parseInt(req.query.size as string) || 1000;
      const data = Array.from({ length: size }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000),
        timestamp: Date.now()
      }));
      
      res.json({
        message: 'memory',
        allocatedItems: data.length,
        memoryUsage: process.memoryUsage()
      });
    });

    stressMetrics = {
      maxConcurrency: 0,
      errorRate: 0,
      avgResponseTime: 0,
      memoryPeak: 0
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Gradual Load Increase', () => {
    it('should handle increasing concurrent load gracefully', async () => {
      const maxConcurrency = 200;
      const stepSize = 25;
      const results: Array<{ concurrency: number; avgTime: number; errorRate: number }> = [];
      
      for (let concurrency = stepSize; concurrency <= maxConcurrency; concurrency += stepSize) {
        const start = performance.now();
        let successCount = 0;
        let errorCount = 0;
        
        const promises = Array.from({ length: concurrency }, async () => {
          try {
            await request(app).get('/api/stress/light').expect(200);
            successCount++;
          } catch (error) {
            errorCount++;
          }
        });
        
        await Promise.all(promises);
        const duration = performance.now() - start;
        const avgTime = duration / concurrency;
        const errorRate = errorCount / concurrency;
        
        results.push({ concurrency, avgTime, errorRate });
        
        // Track maximum successful concurrency
        if (errorRate < 0.05) { // Less than 5% error rate
          stressMetrics.maxConcurrency = concurrency;
        }
        
        console.log(`Concurrency ${concurrency}: Avg ${avgTime.toFixed(2)}ms, Error rate ${(errorRate * 100).toFixed(2)}%`);
      }
      
      // Should handle at least 100 concurrent requests with low error rate
      expect(stressMetrics.maxConcurrency).toBeGreaterThanOrEqual(100);
      
      // Response times should not degrade exponentially
      const firstResult = results[0];
      const lastSuccessfulResult = results.find(r => r.errorRate < 0.05) || results[results.length - 1];
      const degradationRatio = lastSuccessfulResult.avgTime / firstResult.avgTime;
      
      expect(degradationRatio).toBeLessThan(5); // Less than 5x degradation
    });

    it('should handle memory stress without crashing', async () => {
      const memorySizes = [1000, 5000, 10000, 20000];
      const results: Array<{ size: number; memoryUsed: number; responseTime: number }> = [];
      
      for (const size of memorySizes) {
        const initialMemory = process.memoryUsage().heapUsed;
        const start = performance.now();
        
        try {
          const response = await request(app)
            .get('/api/stress/memory')
            .query({ size })
            .expect(200);
          
          const responseTime = performance.now() - start;
          const finalMemory = process.memoryUsage().heapUsed;
          const memoryUsed = finalMemory - initialMemory;
          
          results.push({ size, memoryUsed, responseTime });
          
          expect(response.body).toHaveProperty('allocatedItems', size);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        } catch (error) {
          console.warn(`Memory stress test failed at size ${size}:`, error);
          break;
        }
      }
      
      // Should handle at least the first two memory sizes
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // Memory usage should be proportional to allocation size
      const memoryEfficiency = results.map(r => r.memoryUsed / r.size);
      const avgEfficiency = memoryEfficiency.reduce((a, b) => a + b, 0) / memoryEfficiency.length;
      
      expect(avgEfficiency).toBeGreaterThan(0); // Memory is being allocated
      expect(avgEfficiency).toBeLessThan(10000); // Reasonable memory overhead
    });
  });

  describe('Sustained Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const testDuration = 5000; // 5 seconds
      const concurrency = 20;
      const samples: number[] = [];
      let totalRequests = 0;
      let totalErrors = 0;
      
      const startTime = performance.now();
      
      const workers = Array.from({ length: concurrency }, async () => {
        while (performance.now() - startTime < testDuration) {
          const requestStart = performance.now();
          
          try {
            await request(app).get('/api/stress/medium').expect(200);
            const requestTime = performance.now() - requestStart;
            samples.push(requestTime);
            totalRequests++;
          } catch (error) {
            totalErrors++;
          }
          
          // Small random delay to simulate realistic traffic
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        }
      });
      
      await Promise.all(workers);
      
      const actualDuration = performance.now() - startTime;
      const errorRate = totalErrors / (totalRequests + totalErrors);
      const avgResponseTime = samples.reduce((a, b) => a + b, 0) / samples.length;
      const throughput = (totalRequests / actualDuration) * 1000;
      
      stressMetrics.errorRate = errorRate;
      stressMetrics.avgResponseTime = avgResponseTime;
      
      console.log(`Sustained load results:
        Duration: ${actualDuration.toFixed(2)}ms
        Total requests: ${totalRequests}
        Error rate: ${(errorRate * 100).toFixed(2)}%
        Avg response time: ${avgResponseTime.toFixed(2)}ms
        Throughput: ${throughput.toFixed(2)} req/sec`);
      
      // Performance requirements for sustained load
      expect(errorRate).toBeLessThan(0.02); // Less than 2% error rate
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms
      expect(throughput).toBeGreaterThan(10); // At least 10 req/sec
    }, 15000); // Increased timeout for sustained load test

    it('should handle resource exhaustion gracefully', async () => {
      const heavyLoadConcurrency = 50;
      const payloadSize = 1000; // Large payload
      let successCount = 0;
      let errorCount = 0;
      const responseTimes: number[] = [];
      
      const payload = {
        data: Array.from({ length: payloadSize }, (_, i) => ({
          id: i,
          content: 'stress test data '.repeat(50),
          timestamp: Date.now()
        }))
      };
      
      const promises = Array.from({ length: heavyLoadConcurrency }, async () => {
        const start = performance.now();
        
        try {
          await request(app)
            .post('/api/stress/heavy')
            .send(payload)
            .expect(200);
          
          const responseTime = performance.now() - start;
          responseTimes.push(responseTime);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      });
      
      await Promise.all(promises);
      
      const errorRate = errorCount / heavyLoadConcurrency;
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      console.log(`Resource exhaustion test:
        Success: ${successCount}
        Errors: ${errorCount}
        Error rate: ${(errorRate * 100).toFixed(2)}%
        Avg response time: ${avgResponseTime.toFixed(2)}ms`);
      
      // System should handle at least 70% of heavy requests successfully
      expect(errorRate).toBeLessThan(0.3);
      
      // Response times may be higher but should not be extreme
      expect(avgResponseTime).toBeLessThan(5000); // Under 5 seconds
    }, 45000); // Increased timeout for resource exhaustion test
  });

  describe('Breaking Point Detection', () => {
    it('should identify request rate breaking point', async () => {
      const maxRate = 500; // requests per second
      const testDuration = 2000; // 2 seconds
      let currentRate = 50;
      let breakingPoint = 0;
      
      while (currentRate <= maxRate) {
        const interval = 1000 / currentRate; // ms between requests
        const start = performance.now();
        let requestCount = 0;
        let errorCount = 0;
        
        // Send requests at target rate
        const sendRequest = async () => {
          try {
            await request(app).get('/api/stress/light').expect(200);
            requestCount++;
          } catch (error) {
            errorCount++;
          }
        };
        
        const intervalId = setInterval(sendRequest, interval);
        
        await new Promise(resolve => setTimeout(resolve, testDuration));
        clearInterval(intervalId);
        
        const errorRate = errorCount / (requestCount + errorCount);
        
        console.log(`Rate ${currentRate} req/s: ${requestCount} success, ${errorCount} errors (${(errorRate * 100).toFixed(1)}%)`);
        
        if (errorRate > 0.1) { // 10% error rate indicates breaking point
          breakingPoint = currentRate;
          break;
        }
        
        currentRate += 50;
      }
      
      console.log(`Breaking point detected at: ${breakingPoint} req/s`);
      
      // Should handle at least 100 req/s before breaking
      expect(breakingPoint).toBeGreaterThan(100);
    }, 25000); // Increased timeout for breaking point detection

    it('should recover from overload conditions', async () => {
      // Create overload condition
      const overloadConcurrency = 300;
      const overloadPromises = Array.from({ length: overloadConcurrency }, () =>
        request(app).get('/api/stress/medium').timeout(5000)
      );
      
      // Don't wait for all to complete, just start the overload
      Promise.allSettled(overloadPromises);
      
      // Wait a bit for overload to take effect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test recovery with normal load
      const recoveryTests = 10;
      let recoverySuccessCount = 0;
      
      for (let i = 0; i < recoveryTests; i++) {
        try {
          await request(app).get('/api/stress/light').timeout(2000).expect(200);
          recoverySuccessCount++;
        } catch (error) {
          // Expected during recovery
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const recoveryRate = recoverySuccessCount / recoveryTests;
      
      console.log(`Recovery rate: ${(recoveryRate * 100).toFixed(2)}%`);
      
      // Should recover to handle at least 50% of normal requests
      expect(recoveryRate).toBeGreaterThan(0.5);
    }, 10000);
  });

  afterAll(() => {
    console.log('\n=== Stress Test Summary ===');
    console.log(`Max Concurrency: ${stressMetrics.maxConcurrency}`);
    console.log(`Final Error Rate: ${(stressMetrics.errorRate * 100).toFixed(2)}%`);
    console.log(`Avg Response Time: ${stressMetrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`Memory Peak: ${(stressMetrics.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
  });
});