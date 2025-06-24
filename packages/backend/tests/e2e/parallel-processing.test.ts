import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { OpenAIBatchService } from '../../src/services/openai-batch.service';
import { OpenAIService } from '../../src/services/openai.service';

describe('E2E: Parallel Processing', () => {
  let app: Express;
  let openAIService: OpenAIService;
  let batchService: OpenAIBatchService;

  beforeAll(async () => {
    app = await createTestApp();
    openAIService = new OpenAIService();
    batchService = new OpenAIBatchService(openAIService);
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Batch Processing Performance', () => {
    it('should process batch requests in parallel with 2.6x performance improvement', async () => {
      const texts = [
        'This product is amazing!',
        'Terrible customer service.',
        'Average quality product.',
        'Excellent experience overall!',
        'Worst purchase ever made.',
        'Good value for money.',
        'Outstanding quality!',
        'Very disappointing.',
        'Meets expectations.',
        'Highly recommend this!'
      ];

      // Test sequential processing (baseline)
      const sequentialStart = Date.now();
      const sequentialResponse = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: false
        })
        .expect(200);
      const sequentialTime = Date.now() - sequentialStart;

      // Test parallel processing
      const parallelStart = Date.now();
      const parallelResponse = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: true
        })
        .expect(200);
      const parallelTime = Date.now() - parallelStart;

      // Verify performance improvement
      const speedup = sequentialTime / parallelTime;
      expect(speedup).toBeGreaterThan(2.0); // At least 2x faster
      
      // Verify results consistency
      expect(parallelResponse.body.data.length).toBe(texts.length);
      expect(parallelResponse.body.stats).toMatchObject({
        totalTexts: texts.length,
        totalTime: expect.any(Number),
        avgTimePerText: expect.any(Number),
        model: 'gpt-3.5-turbo'
      });

      // Verify all texts were processed
      texts.forEach((text, index) => {
        const result = parallelResponse.body.data[index];
        expect(result).toMatchObject({
          text,
          sentiment: expect.stringMatching(/positive|negative|neutral/),
          score: expect.any(Number),
          confidence: expect.any(Number),
          model: 'gpt-3.5-turbo',
          processingTimeMs: expect.any(Number)
        });
      });
    });

    it('should handle large batch processing with chunking', async () => {
      // Generate 100 texts
      const texts = Array.from({ length: 100 }, (_, i) => 
        i % 3 === 0 ? `Positive feedback ${i}` :
        i % 3 === 1 ? `Negative feedback ${i}` :
        `Neutral feedback ${i}`
      );

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: true,
          options: {
            chunkSize: 20,
            concurrency: 10
          }
        })
        .expect(200);

      expect(response.body.data.length).toBe(100);
      expect(response.body.stats.chunksProcessed).toBe(5); // 100/20 = 5 chunks
    });

    it('should respect concurrency limits', async () => {
      const texts = Array.from({ length: 20 }, (_, i) => `Test text ${i}`);
      
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: true,
          options: {
            concurrency: 3 // Limit to 3 concurrent requests
          }
        })
        .expect(200);

      // Verify rate limiting was respected
      expect(response.body.stats.maxConcurrentRequests).toBeLessThanOrEqual(3);
    });

    it('should handle failures gracefully with retry logic', async () => {
      const texts = [
        'This will succeed',
        'TRIGGER_ERROR: This should fail and retry',
        'This will also succeed'
      ];

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: true,
          options: {
            retryAttempts: 3
          }
        })
        .expect(200);

      // Verify partial success handling
      expect(response.body.data.length).toBe(3);
      expect(response.body.stats.retries).toBeGreaterThan(0);
    });

    it('should utilize cache for duplicate texts', async () => {
      const texts = [
        'Cached text 1',
        'Cached text 2',
        'Cached text 1', // Duplicate
        'Cached text 3',
        'Cached text 2'  // Duplicate
      ];

      // First request - populate cache
      await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts: texts.slice(0, 3), model: 'gpt-3.5-turbo' })
        .expect(200);

      // Second request - should use cache
      const start = Date.now();
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'gpt-3.5-turbo' })
        .expect(200);
      const duration = Date.now() - start;

      // Cached requests should be much faster
      expect(duration).toBeLessThan(1000); // Under 1 second for 5 texts with cache
      expect(response.body.stats.cacheHits).toBe(2); // Two duplicates
    });
  });

  describe('Progressive Processing', () => {
    it('should stream results progressively via SSE', async (done) => {
      const texts = Array.from({ length: 10 }, (_, i) => `Progressive text ${i}`);
      let receivedCount = 0;
      
      const eventSource = new EventSource('http://localhost:3001/api/v1/sentiment/stream/batch');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        receivedCount++;
        
        expect(data).toMatchObject({
          index: expect.any(Number),
          text: expect.stringContaining('Progressive text'),
          sentiment: expect.any(String),
          progress: expect.any(Number)
        });
        
        if (receivedCount === texts.length) {
          eventSource.close();
          done();
        }
      };

      // Send batch request
      await request(app)
        .post('/api/v1/sentiment/stream/batch')
        .send({ texts, model: 'gpt-3.5-turbo' });
    });
  });

  describe('Rate Limiting and Circuit Breaker', () => {
    it('should handle rate limit errors gracefully', async () => {
      // Send many requests to trigger rate limit
      const texts = Array.from({ length: 100 }, (_, i) => `Rate limit test ${i}`);
      
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          useParallel: true,
          options: {
            concurrency: 50, // High concurrency to trigger rate limit
            rateLimit: {
              maxRequests: 10,
              windowMs: 1000
            }
          }
        })
        .expect(200);

      // Should still complete but with rate limiting
      expect(response.body.data.length).toBe(100);
      expect(response.body.stats.rateLimitDelays).toBeGreaterThan(0);
    });

    it('should activate circuit breaker on repeated failures', async () => {
      // Simulate OpenAI service failures
      const texts = Array.from({ length: 10 }, () => 'TRIGGER_ERROR: Force failure');
      
      // First batch - should trigger circuit breaker
      await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'gpt-3.5-turbo' })
        .expect(500);

      // Second batch - circuit should be open
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Normal text', model: 'gpt-3.5-turbo' })
        .expect(503);

      expect(response.body.error).toContain('Circuit breaker is OPEN');
    });
  });

  describe('Cost Optimization', () => {
    it('should track token usage and costs', async () => {
      const texts = [
        'Short text',
        'Medium length text with more content to analyze',
        'Very long text that contains multiple sentences and will use more tokens for processing'
      ];

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'gpt-3.5-turbo' })
        .expect(200);

      expect(response.body.stats).toMatchObject({
        totalTokens: expect.any(Number),
        estimatedCost: expect.any(Number),
        tokensPerText: expect.any(Array)
      });

      // Verify token counting
      expect(response.body.stats.tokensPerText[2]).toBeGreaterThan(
        response.body.stats.tokensPerText[0]
      ); // Longer text uses more tokens
    });

    it('should optimize costs with caching', async () => {
      const texts = ['Cost optimization test', 'Cost optimization test']; // Duplicate

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'gpt-4' }) // More expensive model
        .expect(200);

      expect(response.body.stats.estimatedSavings).toBeGreaterThan(0);
      expect(response.body.stats.cacheHits).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle mixed success/failure in batch', async () => {
      const texts = [
        'Valid text 1',
        '', // Empty text - should fail
        'Valid text 2',
        null, // Null - should fail
        'Valid text 3'
      ];

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'gpt-3.5-turbo' })
        .expect(207); // Multi-status

      expect(response.body.data.length).toBe(5);
      expect(response.body.data[0].success).toBe(true);
      expect(response.body.data[1].success).toBe(false);
      expect(response.body.data[1].error).toContain('Empty text');
    });

    it('should handle timeout errors', async () => {
      const texts = ['This should timeout'];

      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts,
          model: 'gpt-3.5-turbo',
          options: {
            timeout: 1 // 1ms timeout - guaranteed to fail
          }
        })
        .expect(200);

      expect(response.body.data[0].error).toContain('timeout');
    });
  });

  describe('Model Comparison', () => {
    it('should compare performance across models', async () => {
      const text = 'Test sentiment analysis across different models';
      const models = ['basic', 'gpt-3.5-turbo', 'gpt-4'];
      
      const results = await Promise.all(
        models.map(model =>
          request(app)
            .post('/api/v1/sentiment/analyze')
            .send({ text, model })
        )
      );

      // Basic should be fastest
      expect(results[0].body.data.processingTimeMs).toBeLessThan(
        results[1].body.data.processingTimeMs
      );

      // GPT-4 should have highest confidence
      expect(results[2].body.data.confidence).toBeGreaterThanOrEqual(
        results[1].body.data.confidence
      );
    });
  });
});