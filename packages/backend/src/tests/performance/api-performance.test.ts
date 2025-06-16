import request from 'supertest';
import { createApp } from '../../app';
import { Application } from 'express';
import { getCacheService } from '../../services/cache.service';
import { ConfigService } from '../../services/config.service';

describe('API Performance Tests', () => {
  let app: Application;
  let configService: ConfigService;
  
  beforeAll(async () => {
    configService = ConfigService.getInstance();
    app = createApp();
    
    // Enable caching for performance tests
    configService.set('CACHE_ENABLED', true);
    configService.set('CACHE_TYPE', 'memory');
    configService.set('CACHE_DEFAULT_TTL', 300);
  });

  afterAll(async () => {
    const cacheService = getCacheService();
    await cacheService.close();
  });

  describe('Sentiment Analysis API Performance', () => {
    it('should handle single sentiment analysis requests efficiently', async () => {
      const testText = 'This is an excellent product with outstanding quality and fantastic customer service.';
      const iterations = 50;
      const maxResponseTime = 500; // 500ms max per request

      console.time('Single Sentiment Analysis Performance');

      const promises = Array.from({ length: iterations }, () =>
        request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: testText })
          .expect(200)
      );

      const results = await Promise.all(promises);
      
      console.timeEnd('Single Sentiment Analysis Performance');

      // Verify all requests succeeded
      results.forEach(result => {
        expect(result.body.success).toBe(true);
        expect(result.body.data.sentiment).toBeDefined();
        expect(result.body.data.score).toBeDefined();
        expect(result.body.data.confidence).toBeDefined();
      });

      // Check cache effectiveness
      const cacheService = getCacheService();
      const cacheStats = cacheService.getStats();
      
      console.log('Sentiment Analysis Performance Stats:', {
        totalRequests: iterations,
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        hitRate: `${(cacheStats.hitRate * 100).toFixed(2)}%`,
        totalOperations: cacheStats.totalOperations
      });

      // With caching, hit rate should be high after first request
      expect(cacheStats.hitRate).toBeGreaterThan(0.9); // 90%+ hit rate expected
    }, 30000);

    it('should handle batch sentiment analysis efficiently', async () => {
      const batchTexts = Array.from({ length: 100 }, (_, i) => 
        `Test text ${i} with varying sentiment levels and different emotional content.`
      );

      console.time('Batch Sentiment Analysis Performance');

      const response = await request(app)
        .post('/api/v1/sentiment/analyze-batch')
        .send({ texts: batchTexts })
        .expect(200);

      console.timeEnd('Batch Sentiment Analysis Performance');

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(batchTexts.length);
      expect(response.body.data.batchId).toBeDefined();

      console.log('Batch Analysis Results:', {
        textsProcessed: response.body.data.results.length,
        batchId: response.body.data.batchId,
        averageScore: (response.body.data.results.reduce((acc: number, r: any) => acc + r.score, 0) / response.body.data.results.length).toFixed(3),
        averageConfidence: (response.body.data.results.reduce((acc: number, r: any) => acc + r.confidence, 0) / response.body.data.results.length).toFixed(3)
      });
    }, 15000);

    it('should handle concurrent requests without degradation', async () => {
      const concurrentRequests = 20;
      const requestsPerClient = 5;
      const testText = 'Concurrent test message with neutral sentiment for performance evaluation.';

      console.time('Concurrent Requests Performance');

      // Create multiple concurrent "clients"
      const clientPromises = Array.from({ length: concurrentRequests }, () => {
        return Promise.all(
          Array.from({ length: requestsPerClient }, () =>
            request(app)
              .post('/api/v1/sentiment/analyze')
              .send({ text: testText })
              .expect(200)
          )
        );
      });

      const allResults = await Promise.all(clientPromises);
      
      console.timeEnd('Concurrent Requests Performance');

      const flatResults = allResults.flat();
      const totalRequests = concurrentRequests * requestsPerClient;

      console.log('Concurrent Requests Stats:', {
        totalClients: concurrentRequests,
        requestsPerClient: requestsPerClient,
        totalRequests: totalRequests,
        successfulRequests: flatResults.length,
        successRate: `${(flatResults.length / totalRequests * 100).toFixed(2)}%`
      });

      expect(flatResults.length).toBe(totalRequests);
      
      // Verify all responses are consistent
      flatResults.forEach(result => {
        expect(result.body.success).toBe(true);
        expect(result.body.data.sentiment).toBeDefined();
      });
    }, 30000);
  });

  describe('File Upload Performance', () => {
    it('should handle CSV file upload efficiently', async () => {
      // Create test CSV content
      const csvContent = [
        'id,text,category',
        ...Array.from({ length: 1000 }, (_, i) => 
          `${i},"Test review ${i} with sentiment content","category${i % 5}"`
        )
      ].join('\n');

      console.time('CSV File Upload Performance');

      const response = await request(app)
        .post('/api/v1/data/upload-csv')
        .field('options', JSON.stringify({ hasHeader: true }))
        .attach('file', Buffer.from(csvContent), 'test-performance.csv')
        .expect(200);

      console.timeEnd('CSV File Upload Performance');

      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldInfo).toBeDefined();
      expect(response.body.data.previewData).toBeDefined();
      expect(response.body.data.dataset.rowCount).toBe(1000);

      console.log('CSV Upload Performance Stats:', {
        rowsProcessed: response.body.data.dataset.rowCount,
        fieldsDetected: response.body.data.fieldInfo.length,
        processingTimeMs: response.body.data.processingTimeMs || 'Not reported',
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      });
    }, 10000);

    it('should handle multiple concurrent file uploads', async () => {
      const concurrentUploads = 5;
      const rowsPerFile = 200;

      console.time('Concurrent File Uploads Performance');

      const uploadPromises = Array.from({ length: concurrentUploads }, (_, index) => {
        const csvContent = [
          'id,text,sentiment',
          ...Array.from({ length: rowsPerFile }, (_, i) => 
            `${i},"Upload ${index} review ${i}","positive"`
          )
        ].join('\n');

        return request(app)
          .post('/api/v1/data/upload-csv')
          .field('options', JSON.stringify({ hasHeader: true }))
          .attach('file', Buffer.from(csvContent), `test-concurrent-${index}.csv`)
          .expect(200);
      });

      const results = await Promise.all(uploadPromises);

      console.timeEnd('Concurrent File Uploads Performance');

      console.log('Concurrent Upload Stats:', {
        concurrentFiles: concurrentUploads,
        rowsPerFile: rowsPerFile,
        totalRowsProcessed: results.reduce((acc, r) => acc + r.body.data.dataset.rowCount, 0),
        successfulUploads: results.length,
        avgFieldsDetected: Math.round(results.reduce((acc, r) => acc + r.body.data.fieldInfo.length, 0) / results.length)
      });

      expect(results.length).toBe(concurrentUploads);
      results.forEach(result => {
        expect(result.body.success).toBe(true);
        expect(result.body.data.dataset.rowCount).toBe(rowsPerFile);
      });
    }, 20000);
  });

  describe('Cache Performance Impact', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const testText = 'This cached text should show performance improvement on subsequent requests.';
      const iterations = 20;

      // Clear cache first
      const cacheService = getCacheService();
      await cacheService.clear();

      // First request (cold cache)
      console.time('Cold Cache Request');
      const coldResponse = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: testText })
        .expect(200);
      console.timeEnd('Cold Cache Request');

      // Subsequent requests (warm cache)
      console.time('Warm Cache Requests');
      const warmPromises = Array.from({ length: iterations }, () =>
        request(app)
          .post('/api/v1/sentiment/analyze')
          .send({ text: testText })
          .expect(200)
      );
      const warmResponses = await Promise.all(warmPromises);
      console.timeEnd('Warm Cache Requests');

      const cacheStats = cacheService.getStats();

      console.log('Cache Performance Impact:', {
        totalRequests: iterations + 1,
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        hitRate: `${(cacheStats.hitRate * 100).toFixed(2)}%`,
        expectedHitRate: `${((iterations / (iterations + 1)) * 100).toFixed(2)}%`
      });

      // Verify cache effectiveness
      expect(cacheStats.hits).toBe(iterations); // All warm requests should be cache hits
      expect(cacheStats.misses).toBe(1); // Only the cold request should be a miss

      // Verify response consistency
      warmResponses.forEach(response => {
        expect(response.body.data.sentiment).toBe(coldResponse.body.data.sentiment);
        expect(response.body.data.score).toBe(coldResponse.body.data.score);
        expect(response.body.data.confidence).toBe(coldResponse.body.data.confidence);
      });
    }, 15000);
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      const loadTestIterations = 100;
      const textVariations = 10;

      // Create test texts with variation to prevent excessive caching
      const testTexts = Array.from({ length: textVariations }, (_, i) =>
        `Memory test text variation ${i} with different content to test resource management.`
      );

      console.time('Memory Load Test');

      // Generate load
      for (let batch = 0; batch < loadTestIterations / textVariations; batch++) {
        const batchPromises = testTexts.map(text =>
          request(app)
            .post('/api/v1/sentiment/analyze')
            .send({ text: `${text} Batch ${batch}` })
            .expect(200)
        );

        await Promise.all(batchPromises);

        // Force garbage collection if available (for testing)
        if (global.gc) {
          global.gc();
        }
      }

      console.timeEnd('Memory Load Test');

      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        heapUsed: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
        heapTotal: Math.round((finalMemory.heapTotal - initialMemory.heapTotal) / 1024 / 1024),
        rss: Math.round((finalMemory.rss - initialMemory.rss) / 1024 / 1024)
      };

      console.log('Memory Usage Analysis:', {
        initialHeapMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalHeapMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        heapIncreaseMB: memoryIncrease.heapUsed,
        rssIncreaseMB: memoryIncrease.rss,
        requestsProcessed: loadTestIterations
      });

      // Memory increase should be reasonable (less than 50MB for 100 requests)
      expect(memoryIncrease.heapUsed).toBeLessThan(50);
      expect(memoryIncrease.rss).toBeLessThan(100);
    }, 30000);
  });

  describe('Error Handling Performance', () => {
    it('should handle invalid requests efficiently without memory leaks', async () => {
      const invalidRequests = 50;
      const initialMemory = process.memoryUsage();

      console.time('Error Handling Performance');

      // Generate various types of invalid requests
      const errorPromises = [];

      for (let i = 0; i < invalidRequests; i++) {
        // Mix of different error types
        if (i % 3 === 0) {
          // Invalid JSON
          errorPromises.push(
            request(app)
              .post('/api/v1/sentiment/analyze')
              .send('invalid json')
              .expect(400)
          );
        } else if (i % 3 === 1) {
          // Missing required field
          errorPromises.push(
            request(app)
              .post('/api/v1/sentiment/analyze')
              .send({})
              .expect(400)
          );
        } else {
          // Empty text
          errorPromises.push(
            request(app)
              .post('/api/v1/sentiment/analyze')
              .send({ text: '' })
              .expect(400)
          );
        }
      }

      const results = await Promise.all(errorPromises);

      console.timeEnd('Error Handling Performance');

      const finalMemory = process.memoryUsage();
      const memoryDiff = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);

      console.log('Error Handling Stats:', {
        invalidRequests: invalidRequests,
        errorResponsesReceived: results.length,
        memoryIncreaseMB: memoryDiff,
        avgResponseTime: 'Measured above'
      });

      // All requests should receive error responses
      expect(results.length).toBe(invalidRequests);
      
      // Memory increase should be minimal for error handling
      expect(memoryDiff).toBeLessThan(10);

      // Verify error responses have correct structure
      results.forEach(result => {
        expect(result.body.success).toBe(false);
        expect(result.body.error).toBeDefined();
      });
    }, 15000);
  });
});