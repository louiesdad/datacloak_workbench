import { SentimentService } from '../../src/services/sentiment.service';
import { initializeDatabases } from '../../src/database';

describe('SentimentService', () => {
  let sentimentService: SentimentService;

  beforeAll(async () => {
    await initializeDatabases();
    sentimentService = new SentimentService();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment', async () => {
      const result = await sentimentService.analyzeSentiment('This is amazing and wonderful!');
      
      expect(result).toMatchObject({
        text: 'This is amazing and wonderful!',
        sentiment: 'positive',
        score: expect.any(Number),
        confidence: expect.any(Number),
        id: expect.any(Number),
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should analyze negative sentiment', async () => {
      const result = await sentimentService.analyzeSentiment('This is terrible and awful!');
      
      expect(result).toMatchObject({
        text: 'This is terrible and awful!',
        sentiment: 'negative',
        score: expect.any(Number),
        confidence: expect.any(Number),
        id: expect.any(Number),
      });
      
      expect(result.score).toBeLessThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should analyze neutral sentiment', async () => {
      const result = await sentimentService.analyzeSentiment('The weather is cloudy today.');
      
      expect(result).toMatchObject({
        text: 'The weather is cloudy today.',
        sentiment: 'neutral',
        score: expect.any(Number),
        confidence: expect.any(Number),
        id: expect.any(Number),
      });
      
      expect(Math.abs(result.score)).toBeLessThan(0.5);
    });

    it('should throw error for empty text', async () => {
      await expect(sentimentService.analyzeSentiment('')).rejects.toThrow('Text is required for sentiment analysis');
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(sentimentService.analyzeSentiment('   ')).rejects.toThrow('Text is required for sentiment analysis');
    });
  });

  describe('batchAnalyzeSentiment', () => {
    it('should analyze multiple texts', async () => {
      const texts = ['Great service!', 'Terrible experience!', 'Average product.'];
      const results = await sentimentService.batchAnalyzeSentiment(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0].sentiment).toBe('positive');
      expect(results[1].sentiment).toBe('negative');
      expect(results[2].sentiment).toBe('neutral');
    });

    it('should throw error for empty array', async () => {
      await expect(sentimentService.batchAnalyzeSentiment([])).rejects.toThrow('Texts array is required for batch analysis');
    });

    it('should throw error for too many texts', async () => {
      const texts = new Array(1001).fill('test');
      await expect(sentimentService.batchAnalyzeSentiment(texts)).rejects.toThrow('Batch size cannot exceed 1000 texts');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics after analyses', async () => {
      // First analyze some texts
      await sentimentService.analyzeSentiment('Great!');
      await sentimentService.analyzeSentiment('Terrible!');
      
      const stats = await sentimentService.getStatistics();
      
      expect(stats).toMatchObject({
        totalAnalyses: expect.any(Number),
        sentimentDistribution: {
          positive: expect.any(Number),
          neutral: expect.any(Number),
          negative: expect.any(Number),
        },
        averageConfidence: expect.any(Number),
      });
      
      expect(stats.totalAnalyses).toBeGreaterThan(0);
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return paginated history', async () => {
      const result = await sentimentService.getAnalysisHistory(1, 5);
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.pagination).toMatchObject({
        page: 1,
        pageSize: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
      
      // Verify data structure if there are results
      if (result.data.length > 0) {
        expect(result.data[0]).toMatchObject({
          id: expect.any(Number),
          text: expect.any(String),
          sentiment: expect.stringMatching(/^(positive|negative|neutral)$/),
          score: expect.any(Number),
          confidence: expect.any(Number),
          createdAt: expect.any(String),
        });
      }
    });
  });
});