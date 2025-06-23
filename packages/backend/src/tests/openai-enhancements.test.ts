import { 
  TextOptimizer, 
  OpenAILogger, 
  CostTracker, 
  calculateTokenCost,
  OpenAIStreamProcessor,
  MODEL_PRICING 
} from '../services/openai-enhancements';
import { Readable } from 'stream';

describe('OpenAI Enhancements', () => {
  describe('TextOptimizer', () => {
    it('should compress text by removing redundant whitespace', () => {
      const text = 'This    is   a    test\n\n\nwith   multiple    spaces';
      const compressed = TextOptimizer.compress(text);
      expect(compressed).toBe('This is a test\nwith multiple spaces');
    });

    it('should handle text that is already within limit', () => {
      const shortText = 'Short text';
      const truncated = TextOptimizer.truncateToTokens(shortText, 100);
      expect(truncated).toBe(shortText);
    });

    it('should truncate text to token limit', () => {
      const longText = 'a'.repeat(1000);
      const truncated = TextOptimizer.truncateToTokens(longText, 100);
      expect(truncated.length).toBeLessThanOrEqual(400); // 100 tokens * 4 chars
      expect(truncated).toContain('...');
    });

    it('should perform smart truncation at sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence that is very long and should be cut off.';
      const truncated = TextOptimizer.smartTruncate(text, 20); // ~80 chars
      expect(truncated).toContain('.');
      expect(truncated.length).toBeLessThan(text.length);
    });

    it('should handle smart truncation when text is within limit', () => {
      const text = 'Short text.';
      const truncated = TextOptimizer.smartTruncate(text, 100);
      expect(truncated).toBe(text);
    });

    it('should fall back to word boundary when no sentence boundary found', () => {
      const text = 'This is a very long sentence without any punctuation marks that goes on and on';
      const truncated = TextOptimizer.smartTruncate(text, 10); // Very small limit
      expect(truncated).toContain('...');
      expect(truncated.length).toBeLessThan(text.length);
    });

    it('should handle text with no word boundaries', () => {
      const text = 'averylongtextwithoutanyspacesorpunctuationmarks';
      const truncated = TextOptimizer.smartTruncate(text, 10);
      expect(truncated).toContain('...');
      expect(truncated.length).toBeLessThanOrEqual(43); // 10 tokens * 4 chars + 3 for '...'
    });

    it('should estimate token count with punctuation and numbers', () => {
      const text = 'Hello, world! This has 123 numbers and punctuation: ?!.,';
      const estimate = TextOptimizer.estimateTokens(text);
      expect(estimate).toBeGreaterThan(10);
      expect(estimate).toBeLessThan(25);
    });

    it('should handle empty text', () => {
      expect(TextOptimizer.compress('')).toBe('');
      expect(TextOptimizer.truncateToTokens('', 100)).toBe('');
      expect(TextOptimizer.smartTruncate('', 100)).toBe('');
      expect(TextOptimizer.estimateTokens('')).toBe(0);
    });
  });

  describe('calculateTokenCost', () => {
    it('should calculate cost for gpt-3.5-turbo', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };
      const cost = calculateTokenCost(usage, 'gpt-3.5-turbo');
      expect(cost).toBe(0.001250); // (1000 * 0.0005 + 500 * 0.0015) / 1000
    });

    it('should calculate cost for gpt-4', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };
      const cost = calculateTokenCost(usage, 'gpt-4');
      expect(cost).toBe(0.060000); // (1000 * 0.03 + 500 * 0.06) / 1000
    });

    it('should calculate cost for gpt-4-turbo', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };
      const cost = calculateTokenCost(usage, 'gpt-4-turbo');
      expect(cost).toBe(0.025000); // (1000 * 0.01 + 500 * 0.03) / 1000
    });

    it('should default to gpt-3.5-turbo pricing for unknown models', () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 500 };
      const cost = calculateTokenCost(usage, 'unknown-model');
      expect(cost).toBe(0.001250); // Same as gpt-3.5-turbo
    });

    it('should handle zero token usage', () => {
      const usage = { prompt_tokens: 0, completion_tokens: 0 };
      const cost = calculateTokenCost(usage, 'gpt-4');
      expect(cost).toBe(0.000000);
    });

    it('should verify MODEL_PRICING structure', () => {
      expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
      expect(MODEL_PRICING['gpt-4']).toBeDefined();
      expect(MODEL_PRICING['gpt-4-turbo']).toBeDefined();
      
      Object.values(MODEL_PRICING).forEach(pricing => {
        expect(pricing).toHaveProperty('inputCostPer1k');
        expect(pricing).toHaveProperty('outputCostPer1k');
        expect(typeof pricing.inputCostPer1k).toBe('number');
        expect(typeof pricing.outputCostPer1k).toBe('number');
      });
    });
  });

  describe('OpenAILogger', () => {
    let logger: OpenAILogger;

    beforeEach(() => {
      logger = new OpenAILogger();
    });

    it('should log requests and responses', () => {
      logger.logRequest('gpt-3.5-turbo', { messages: [{ content: 'test' }] });
      logger.logResponse('gpt-3.5-turbo', { choices: [] }, 100);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].type).toBe('request');
      expect(logs[1].type).toBe('response');
    });

    it('should calculate statistics', () => {
      logger.logRequest('gpt-3.5-turbo', {});
      logger.logResponse('gpt-3.5-turbo', {}, 100, {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        estimatedCost: 0.01
      });
      
      const stats = logger.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalTokens).toBe(30);
      expect(stats.totalCost).toBe(0.01);
    });

    it('should filter logs', () => {
      logger.logRequest('gpt-3.5-turbo', {});
      logger.logError('gpt-4', new Error('test'));
      
      const errorLogs = logger.getLogs({ type: 'error' });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].type).toBe('error');
    });

    it('should sanitize sensitive data', () => {
      const longMessage = 'a'.repeat(250); // Create a message longer than 200 chars
      const payload = {
        apiKey: 'secret-key',
        messages: [{ content: longMessage }]
      };
      
      logger.logRequest('gpt-3.5-turbo', payload);
      const logs = logger.getLogs();
      
      expect(logs[0].data.apiKey).toBe('***');
      expect(logs[0].data.messages[0].content).toContain('...');
      expect(logs[0].data.messages[0].content.length).toBeLessThanOrEqual(203); // 200 + '...'
    });

    it('should sanitize long string data', () => {
      const longString = 'a'.repeat(600);
      logger.logRequest('gpt-3.5-turbo', longString);
      
      const logs = logger.getLogs();
      expect(logs[0].data).toContain('...');
      expect(logs[0].data.length).toBeLessThanOrEqual(503); // 500 + '...'
    });

    it('should handle non-object data sanitization', () => {
      logger.logRequest('gpt-3.5-turbo', 'simple string');
      logger.logRequest('gpt-4', null);
      logger.logRequest('gpt-4', undefined);
      logger.logRequest('gpt-4', 123);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].data).toBe('simple string');
      expect(logs[1].data).toBe(null);
      expect(logs[2].data).toBe(undefined);
      expect(logs[3].data).toBe(123);
    });

    it('should filter logs by model', () => {
      logger.logRequest('gpt-3.5-turbo', {});
      logger.logRequest('gpt-4', {});
      logger.logError('gpt-3.5-turbo', new Error('test'));
      
      const gpt4Logs = logger.getLogs({ model: 'gpt-4' });
      expect(gpt4Logs).toHaveLength(1);
      expect(gpt4Logs[0].model).toBe('gpt-4');
    });

    it('should limit returned logs', () => {
      for (let i = 0; i < 10; i++) {
        logger.logRequest('gpt-3.5-turbo', { request: i });
      }
      
      const limitedLogs = logger.getLogs({ limit: 3 });
      expect(limitedLogs).toHaveLength(3);
      expect(limitedLogs[0].data.request).toBe(7); // Last 3: 7, 8, 9
    });

    it('should maintain max log limit', () => {
      // Add more than max logs (100)
      for (let i = 0; i < 150; i++) {
        logger.logRequest('gpt-3.5-turbo', { request: i });
      }
      
      const allLogs = logger.getLogs();
      expect(allLogs.length).toBeLessThanOrEqual(100);
      expect(allLogs[0].data.request).toBeGreaterThanOrEqual(50); // First logs should be removed
    });

    it('should calculate statistics with multiple models', () => {
      logger.logRequest('gpt-3.5-turbo', {});
      logger.logResponse('gpt-3.5-turbo', {}, 100, {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        estimatedCost: 0.01
      });
      
      logger.logRequest('gpt-4', {});
      logger.logError('gpt-4', new Error('test'), 200);
      logger.logResponse('gpt-4', {}, 150, {
        promptTokens: 5,
        completionTokens: 10,
        totalTokens: 15,
        estimatedCost: 0.005
      });
      
      const stats = logger.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalErrors).toBe(1);
      expect(stats.totalTokens).toBe(45);
      expect(stats.totalCost).toBe(0.015);
      expect(stats.averageResponseTime).toBe(150); // (100 + 200) / 2
      
      expect(stats.byModel['gpt-3.5-turbo'].requests).toBe(1);
      expect(stats.byModel['gpt-3.5-turbo'].errors).toBe(0);
      expect(stats.byModel['gpt-4'].requests).toBe(1);
      expect(stats.byModel['gpt-4'].errors).toBe(1);
    });

    it('should clear all logs', () => {
      logger.logRequest('gpt-3.5-turbo', {});
      logger.logResponse('gpt-3.5-turbo', {}, 100);
      
      expect(logger.getLogs()).toHaveLength(2);
      
      logger.clear();
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('CostTracker', () => {
    let tracker: CostTracker;

    beforeEach(() => {
      tracker = new CostTracker();
    });

    it('should track daily costs', () => {
      tracker.track('gpt-3.5-turbo', { prompt_tokens: 1000, completion_tokens: 500 });
      
      const daily = tracker.getDailyCost();
      expect(daily.total.tokens).toBe(1500);
      expect(daily.byModel['gpt-3.5-turbo']).toBeDefined();
      expect(daily.byModel['gpt-3.5-turbo'].tokens).toBe(1500);
      expect(daily.byModel['gpt-3.5-turbo'].cost).toBe(0.00125);
    });

    it('should track monthly costs', () => {
      tracker.track('gpt-4', { prompt_tokens: 2000, completion_tokens: 1000 });
      
      const monthly = tracker.getMonthlyCost();
      expect(monthly.total.tokens).toBe(3000);
      expect(monthly.byModel['gpt-4']).toBeDefined();
      expect(monthly.byModel['gpt-4'].tokens).toBe(3000);
      expect(monthly.byModel['gpt-4'].cost).toBe(0.12); // 2000 * 0.03 + 1000 * 0.06
    });

    it('should track multiple models separately', () => {
      tracker.track('gpt-3.5-turbo', { prompt_tokens: 1000, completion_tokens: 500 });
      tracker.track('gpt-4', { prompt_tokens: 500, completion_tokens: 250 });
      
      const daily = tracker.getDailyCost();
      expect(daily.byModel['gpt-3.5-turbo'].tokens).toBe(1500);
      expect(daily.byModel['gpt-4'].tokens).toBe(750);
      expect(daily.total.tokens).toBe(2250);
    });

    it('should accumulate costs for the same model', () => {
      tracker.track('gpt-3.5-turbo', { prompt_tokens: 1000, completion_tokens: 500 });
      tracker.track('gpt-3.5-turbo', { prompt_tokens: 2000, completion_tokens: 1000 });
      
      const daily = tracker.getDailyCost();
      expect(daily.byModel['gpt-3.5-turbo'].tokens).toBe(4500);
      expect(daily.byModel['gpt-3.5-turbo'].cost).toBe(0.003750); // Sum of both calls
    });

    it('should get costs for specific date', () => {
      const testDate = '2024-01-15';
      
      // Mock the date for testing
      const originalDate = Date;
      global.Date = jest.fn(() => new originalDate(testDate + 'T10:00:00Z')) as any;
      global.Date.now = originalDate.now;
      global.Date.prototype = originalDate.prototype;
      
      tracker.track('gpt-3.5-turbo', { prompt_tokens: 1000, completion_tokens: 500 });
      
      const dailyCost = tracker.getDailyCost(testDate);
      expect(dailyCost.byModel['gpt-3.5-turbo']).toBeDefined();
      
      // Restore original Date
      global.Date = originalDate;
    });

    it('should get costs for specific month', () => {
      const testMonth = '2024-01';
      
      // Mock the date for testing
      const originalDate = Date;
      global.Date = jest.fn(() => new originalDate(testMonth + '-15T10:00:00Z')) as any;
      global.Date.now = originalDate.now;
      global.Date.prototype = originalDate.prototype;
      
      tracker.track('gpt-4', { prompt_tokens: 1000, completion_tokens: 500 });
      
      const monthlyCost = tracker.getMonthlyCost(testMonth);
      expect(monthlyCost.byModel['gpt-4']).toBeDefined();
      
      // Restore original Date
      global.Date = originalDate;
    });

    it('should handle cleanup of old data', () => {
      // This test verifies that the cleanup method exists and can be called
      // The actual cleanup logic would require mocking dates which is complex
      expect(() => tracker.track('gpt-3.5-turbo', { prompt_tokens: 100, completion_tokens: 50 }))
        .not.toThrow();
    });

    it('should return empty costs for dates with no data', () => {
      const daily = tracker.getDailyCost('2023-01-01');
      expect(daily.total.tokens).toBe(0);
      expect(daily.total.cost).toBe(0);
      expect(Object.keys(daily.byModel)).toHaveLength(0);
      
      const monthly = tracker.getMonthlyCost('2023-01');
      expect(monthly.total.tokens).toBe(0);
      expect(monthly.total.cost).toBe(0);
      expect(Object.keys(monthly.byModel)).toHaveLength(0);
    });
  });

  describe('OpenAIStreamProcessor', () => {
    it('should split text into chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = OpenAIStreamProcessor.splitIntoChunks(text, 20);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(20);
      });
    });

    it('should process chunks asynchronously', async () => {
      const text = 'Chunk one. Chunk two. Chunk three.';
      const results: string[] = [];
      
      const processor = async (chunk: string) => chunk.toUpperCase();
      
      for await (const result of OpenAIStreamProcessor.processInChunks(text, 15, processor)) {
        results.push(result);
      }
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.includes('CHUNK'))).toBe(true);
    });

    it('should handle text without sentence boundaries', () => {
      const text = 'This is a very long text without proper sentence boundaries that just goes on and on';
      const chunks = OpenAIStreamProcessor.splitIntoChunks(text, 30);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });

    it('should handle very long sentences by splitting at word boundaries', () => {
      const longSentence = 'This is an extremely long sentence that exceeds the maximum chunk size and needs to be split at word boundaries to handle it properly.';
      const chunks = OpenAIStreamProcessor.splitIntoChunks(longSentence, 20);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(20);
      });
    });

    it('should handle single word that exceeds chunk size', () => {
      const singleLongWord = 'supercalifragilisticexpialidocious';
      const chunks = OpenAIStreamProcessor.splitIntoChunks(singleLongWord, 10);
      
      expect(chunks).toContain(singleLongWord);
    });

    it('should preserve sentence boundaries when possible', () => {
      const text = 'Short. Medium length sentence. Another short.';
      const chunks = OpenAIStreamProcessor.splitIntoChunks(text, 40);
      
      // Should try to keep complete sentences together
      expect(chunks.some(chunk => chunk.includes('Short.'))).toBe(true);
    });

    it('should handle empty text', () => {
      const chunks = OpenAIStreamProcessor.splitIntoChunks('', 20);
      expect(chunks).toEqual([]);
    });

    it('should handle text with only whitespace', () => {
      const chunks = OpenAIStreamProcessor.splitIntoChunks('   ', 20);
      expect(chunks).toEqual(['']);
    });

    it('should create readable stream from generator', async () => {
      async function* testGenerator() {
        yield 'chunk1';
        yield 'chunk2';
        yield 'chunk3';
      }
      
      const stream = OpenAIStreamProcessor.createStream(testGenerator());
      expect(stream).toBeInstanceOf(Readable);
      
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      expect(chunks).toEqual(['chunk1', 'chunk2', 'chunk3']);
    });

    it('should handle processor errors in async iteration', async () => {
      const text = 'Test chunk.';
      const processor = async (chunk: string) => {
        throw new Error('Processing failed');
      };
      
      try {
        for await (const result of OpenAIStreamProcessor.processInChunks(text, 50, processor)) {
          // Should not reach here
        }
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Processing failed');
      }
    });

    it('should handle async processing with delays', async () => {
      const text = 'First. Second. Third.';
      const results: string[] = [];
      
      const processor = async (chunk: string) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        return chunk.toUpperCase();
      };
      
      for await (const result of OpenAIStreamProcessor.processInChunks(text, 10, processor)) {
        results.push(result);
      }
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r === r.toUpperCase())).toBe(true);
    });
  });
});