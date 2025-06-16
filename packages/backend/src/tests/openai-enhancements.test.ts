import { 
  TextOptimizer, 
  OpenAILogger, 
  CostTracker, 
  calculateTokenCost,
  OpenAIStreamProcessor 
} from '../services/openai-enhancements';

describe('OpenAI Enhancements', () => {
  describe('TextOptimizer', () => {
    it('should compress text by removing redundant whitespace', () => {
      const text = 'This    is   a    test\n\n\nwith   multiple    spaces';
      const compressed = TextOptimizer.compress(text);
      expect(compressed).toBe('This is a test\nwith multiple spaces');
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

    it('should estimate token count', () => {
      const text = 'Hello, world! This is a test.';
      const estimate = TextOptimizer.estimateTokens(text);
      expect(estimate).toBeGreaterThan(5);
      expect(estimate).toBeLessThan(15);
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
    });

    it('should track monthly costs', () => {
      tracker.track('gpt-4', { prompt_tokens: 2000, completion_tokens: 1000 });
      
      const monthly = tracker.getMonthlyCost();
      expect(monthly.total.tokens).toBe(3000);
      expect(monthly.byModel['gpt-4']).toBeDefined();
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
  });
});