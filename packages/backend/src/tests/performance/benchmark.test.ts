/**
 * Performance Benchmark Tests
 * 
 * Validates system performance under various load conditions,
 * measures response times, throughput, and resource utilization.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockApp } from '../../test-utils/app-factory';
import { createMockDataService, createMockSentimentService } from '../../test-utils/shared-test-utilities';

// Mock external services
jest.mock('../../services/websocket.service');
jest.mock('../../services/sse.service');
jest.mock('../../config/logger');

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  UPLOAD_MAX_TIME: 5000,      // 5 seconds for file upload
  ANALYSIS_MAX_TIME: 30000,   // 30 seconds for sentiment analysis
  DASHBOARD_MAX_TIME: 2000,   // 2 seconds for dashboard metrics
  EXPORT_MAX_TIME: 10000,     // 10 seconds for data export
  CONCURRENT_UPLOADS: 10,     // Maximum concurrent uploads to test
  LARGE_DATASET_ROWS: 10000,  // Large dataset size for stress testing
  MEMORY_THRESHOLD: 200 * 1024 * 1024, // 200MB memory increase limit
};

describe('Performance Benchmark Tests', () => {
  let app: express.Application;
  let mockDataService: any;
  let mockSentimentService: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test application
    app = await createMockApp();
    
    // Setup service mocks
    mockDataService = createMockDataService();
    mockSentimentService = createMockSentimentService();
    
    // Mock authentication
    authToken = 'Bearer test-token-123';

    // Set longer timeout for performance tests
    jest.setTimeout(60000);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Upload Performance Tests', () => {
    it('should upload small files within performance threshold', async () => {
      const testData = 'text,sentiment\n' + Array.from({ length: 100 }, (_, i) => 
        `"Test text ${i}","positive"`
      ).join('\n');

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'small-performance.csv')
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.UPLOAD_MAX_TIME);
      expect(response.body.success).toBe(true);
    });

    it('should handle large file uploads efficiently', async () => {
      // Create large dataset (10MB+)
      const largeData = 'text,sentiment\n' + Array.from({ length: PERFORMANCE_THRESHOLDS.LARGE_DATASET_ROWS }, (_, i) => 
        `"Large dataset test text entry number ${i} with additional content to increase file size","neutral"`
      ).join('\n');

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();

      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(largeData), 'large-performance.csv')
        .expect(201);

      const endTime = Date.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.UPLOAD_MAX_TIME * 2); // Allow 2x time for large files
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD);
      expect(response.body.success).toBe(true);
    });

    it('should handle concurrent uploads without degradation', async () => {
      const testData = 'text,sentiment\n"Concurrent test","positive"';
      const uploadPromises = [];

      const startTime = Date.now();

      // Create multiple concurrent upload requests
      for (let i = 0; i < PERFORMANCE_THRESHOLDS.CONCURRENT_UPLOADS; i++) {
        const uploadPromise = request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData), `concurrent-${i}.csv`);
        
        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All uploads should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable for concurrent operations
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.UPLOAD_MAX_TIME * 2);
    });

    it('should validate upload throughput', async () => {
      const testData = 'text,sentiment\n"Throughput test","positive"';
      const uploadCount = 5;
      const startTime = Date.now();

      // Sequential uploads to measure throughput
      for (let i = 0; i < uploadCount; i++) {
        await request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData), `throughput-${i}.csv`)
          .expect(201);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const throughput = uploadCount / (duration / 1000); // uploads per second

      // Should achieve reasonable throughput
      expect(throughput).toBeGreaterThan(1); // At least 1 upload per second
    });
  });

  describe('Analysis Performance Tests', () => {
    it('should complete sentiment analysis within time threshold', async () => {
      const testData = 'text\n' + Array.from({ length: 1000 }, (_, i) => 
        `"Analysis performance test text ${i}"`
      ).join('\n');

      // Upload dataset
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'analysis-performance.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;
      const startTime = Date.now();

      // Start analysis
      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ANALYSIS_MAX_TIME);
      expect(analysisResponse.body.success).toBe(true);
    });

    it('should handle batch analysis efficiently', async () => {
      const largeData = 'text\n' + Array.from({ length: 5000 }, (_, i) => 
        `"Batch analysis test entry ${i}"`
      ).join('\n');

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(largeData), 'batch-analysis.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;
      const startTime = Date.now();

      // Start batch analysis
      const batchResponse = await request(app)
        .post('/api/sentiment/batch')
        .set('Authorization', authToken)
        .send({
          datasetId,
          batchSize: 500,
          model: 'openai-gpt-3.5'
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ANALYSIS_MAX_TIME);
      expect(batchResponse.body.success).toBe(true);
    });

    it('should maintain consistent analysis performance', async () => {
      const analysisCount = 5;
      const durations: number[] = [];

      for (let i = 0; i < analysisCount; i++) {
        const testData = `text\n"Consistency test ${i}"`;
        
        const uploadResponse = await request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData), `consistency-${i}.csv`)
          .expect(201);

        const startTime = Date.now();

        await request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', authToken)
          .send({ datasetId: uploadResponse.body.data.id })
          .expect(200);

        const endTime = Date.now();
        durations.push(endTime - startTime);
      }

      // Calculate variance in performance
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const standardDeviation = Math.sqrt(variance);

      // Performance should be consistent (low standard deviation)
      expect(standardDeviation).toBeLessThan(avgDuration * 0.5); // Less than 50% of average
    });
  });

  describe('Dashboard Performance Tests', () => {
    it('should load dashboard metrics within time threshold', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DASHBOARD_MAX_TIME);
      expect(response.body.success).toBe(true);
    });

    it('should handle concurrent dashboard requests efficiently', async () => {
      const concurrentRequests = 10;
      const requestPromises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        const requestPromise = request(app)
          .get('/api/dashboard/metrics')
          .set('Authorization', authToken);
        
        requestPromises.push(requestPromise);
      }

      const responses = await Promise.all(requestPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Concurrent requests should not take much longer than a single request
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DASHBOARD_MAX_TIME * 2);
    });

    it('should efficiently load analytics data', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/analytics/sentiment/trends')
        .set('Authorization', authToken)
        .query({ timeRange: 'day', limit: 100 })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DASHBOARD_MAX_TIME);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Export Performance Tests', () => {
    it('should export data within time threshold', async () => {
      const testData = 'text,sentiment\n' + Array.from({ length: 1000 }, (_, i) => 
        `"Export test ${i}","positive"`
      ).join('\n');

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'export-performance.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;
      const startTime = Date.now();

      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EXPORT_MAX_TIME);
      expect(exportResponse.body.success).toBe(true);
    });

    it('should handle large dataset exports efficiently', async () => {
      const largeData = 'text,sentiment\n' + Array.from({ length: 5000 }, (_, i) => 
        `"Large export test ${i}","neutral"`
      ).join('\n');

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(largeData), 'large-export.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;
      const startTime = Date.now();

      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'xlsx',
          datasetId
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EXPORT_MAX_TIME * 2); // Allow more time for Excel format
      expect(exportResponse.body.success).toBe(true);
    });

    it('should support concurrent exports', async () => {
      const testData = 'text,sentiment\n"Concurrent export","positive"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'concurrent-export.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;
      const exportPromises = [];

      const startTime = Date.now();

      // Create multiple concurrent export requests
      for (let i = 0; i < 3; i++) {
        const exportPromise = request(app)
          .post('/api/data/export')
          .set('Authorization', authToken)
          .send({
            format: i % 2 === 0 ? 'csv' : 'json',
            datasetId
          });
        
        exportPromises.push(exportPromise);
      }

      const responses = await Promise.all(exportPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All exports should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EXPORT_MAX_TIME * 1.5);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform series of operations
      const testData = 'text,sentiment\n' + Array.from({ length: 2000 }, (_, i) => 
        `"Memory test ${i}","positive"`
      ).join('\n');

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'memory-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({ format: 'csv', datasetId })
        .expect(200);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD);
    });

    it('should handle garbage collection effectively', async () => {
      const iterations = 10;
      const memoryReadings = [];

      for (let i = 0; i < iterations; i++) {
        const testData = `text\n"GC test ${i}"`;
        
        await request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData), `gc-test-${i}.csv`)
          .expect(201);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        memoryReadings.push(process.memoryUsage().heapUsed);
      }

      // Memory should not continuously increase
      const firstHalf = memoryReadings.slice(0, iterations / 2);
      const secondHalf = memoryReadings.slice(iterations / 2);
      
      const firstHalfAvg = firstHalf.reduce((sum, mem) => sum + mem, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, mem) => sum + mem, 0) / secondHalf.length;

      // Memory should not grow excessively
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under high load', async () => {
      const highLoadOperations = 20;
      const operations = [];

      // Mix of different operations
      for (let i = 0; i < highLoadOperations; i++) {
        const testData = `text\n"Stress test ${i}"`;
        
        const operation = async () => {
          const uploadResponse = await request(app)
            .post('/api/data/upload')
            .set('Authorization', authToken)
            .attach('file', Buffer.from(testData), `stress-${i}.csv`)
            .expect(201);

          await request(app)
            .get('/api/dashboard/metrics')
            .set('Authorization', authToken)
            .expect(200);

          return uploadResponse.body.data.id;
        };

        operations.push(operation());
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should succeed
      expect(results.length).toBe(highLoadOperations);
      results.forEach(datasetId => {
        expect(datasetId).toBeDefined();
      });

      // Operations should complete in reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds for all operations
    });

    it('should handle rapid-fire requests without errors', async () => {
      const rapidRequests = 50;
      const requestPromises = [];

      for (let i = 0; i < rapidRequests; i++) {
        const requestPromise = request(app)
          .get('/api/dashboard/metrics')
          .set('Authorization', authToken);
        
        requestPromises.push(requestPromise);
      }

      const responses = await Promise.all(requestPromises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times for key endpoints', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/dashboard/metrics', expectedMaxTime: 2000 },
        { method: 'GET', path: '/api/sentiment/history?page=1&pageSize=10', expectedMaxTime: 3000 },
        { method: 'GET', path: '/api/analytics/sentiment/trends?timeRange=day', expectedMaxTime: 3000 }
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();

        const response = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', authToken)
          .expect(200);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(endpoint.expectedMaxTime);
        expect(response.body.success).toBe(true);
      }
    });

    it('should maintain acceptable error rates under load', async () => {
      const totalRequests = 100;
      let errorCount = 0;

      const requests = Array.from({ length: totalRequests }, async (_, i) => {
        try {
          const response = await request(app)
            .get('/api/dashboard/metrics')
            .set('Authorization', authToken);
          
          if (response.status !== 200) {
            errorCount++;
          }
          
          return response;
        } catch (error) {
          errorCount++;
          throw error;
        }
      });

      await Promise.allSettled(requests);

      // Error rate should be very low (less than 5%)
      const errorRate = (errorCount / totalRequests) * 100;
      expect(errorRate).toBeLessThan(5);
    });
  });
});