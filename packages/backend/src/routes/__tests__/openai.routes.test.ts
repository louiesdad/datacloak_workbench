import request from 'supertest';
import express from 'express';

// Mock dependencies
const mockOpenAIService = {
  getUsageStats: jest.fn(),
  getLogs: jest.fn(),
  clearStats: jest.fn(),
  testConnection: jest.fn(),
  analyzeSentimentBatch: jest.fn(),
  analyzeSentimentStream: jest.fn(),
};

const mockConfigService = {
  getInstance: jest.fn().mockReturnThis(),
  getOpenAIConfig: jest.fn(),
};

jest.mock('../../services/openai.service', () => ({
  OpenAIService: jest.fn().mockImplementation(() => mockOpenAIService)
}));

jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: () => mockConfigService
  }
}));

jest.mock('../../middleware/admin-auth.middleware', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
  }
}));

import openaiRoutes from '../openai.routes';

describe('OpenAI Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/openai', openaiRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /openai/stats', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/openai/stats')
        .expect(401);

      expect(response.body.error).toBe('Admin authentication required');
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .get('/openai/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should return usage statistics when service is configured', async () => {
      const mockStats = {
        totalRequests: 150,
        successfulRequests: 145,
        failedRequests: 5,
        totalTokensUsed: 50000,
        averageResponseTime: 1200
      };

      mockConfigService.getOpenAIConfig.mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000
      });
      mockOpenAIService.getUsageStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/openai/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats
      });
      expect(mockOpenAIService.getUsageStats).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.getUsageStats.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get('/openai/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Service error'
      });
    });
  });

  describe('GET /openai/logs', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/openai/logs')
        .expect(401);

      expect(response.body.error).toBe('Admin authentication required');
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .get('/openai/logs')
        .set('Authorization', 'Bearer admin-token')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should return logs with query parameters', async () => {
      const mockLogs = [
        { timestamp: '2024-01-01T00:00:00Z', type: 'request', model: 'gpt-3.5-turbo', message: 'API request' },
        { timestamp: '2024-01-01T00:01:00Z', type: 'response', model: 'gpt-3.5-turbo', message: 'API response' }
      ];

      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.getLogs.mockReturnValue(mockLogs);

      const response = await request(app)
        .get('/openai/logs?type=request&model=gpt-3.5-turbo&limit=10')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockLogs
      });
      expect(mockOpenAIService.getLogs).toHaveBeenCalledWith({
        type: 'request',
        model: 'gpt-3.5-turbo',
        limit: 10
      });
    });

    it('should handle invalid limit parameter', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.getLogs.mockReturnValue([]);

      const response = await request(app)
        .get('/openai/logs?limit=invalid')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockOpenAIService.getLogs).toHaveBeenCalledWith({
        type: undefined,
        model: undefined,
        limit: NaN
      });
    });
  });

  describe('POST /openai/stats/clear', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .post('/openai/stats/clear')
        .expect(401);

      expect(response.body.error).toBe('Admin authentication required');
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .post('/openai/stats/clear')
        .set('Authorization', 'Bearer admin-token')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should clear statistics successfully', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.clearStats.mockReturnValue(undefined);

      const response = await request(app)
        .post('/openai/stats/clear')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Statistics cleared successfully'
      });
      expect(mockOpenAIService.clearStats).toHaveBeenCalled();
    });
  });

  describe('GET /openai/test', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/openai/test')
        .expect(401);

      expect(response.body.error).toBe('Admin authentication required');
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .get('/openai/test')
        .set('Authorization', 'Bearer admin-token')
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should test connection successfully', async () => {
      const mockResult = { connected: true, latency: 250, model: 'gpt-3.5-turbo' };

      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.testConnection.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/openai/test')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult
      });
      expect(mockOpenAIService.testConnection).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.testConnection.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/openai/test')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Connection failed'
      });
    });
  });

  describe('POST /openai/sentiment/batch', () => {
    it('should require texts array', async () => {
      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Array of texts is required'
      });
    });

    it('should reject empty texts array', async () => {
      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({ texts: [] })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Array of texts is required'
      });
    });

    it('should reject non-array texts', async () => {
      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({ texts: 'not an array' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Array of texts is required'
      });
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({ texts: ['text1', 'text2'] })
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should analyze batch sentiment successfully', async () => {
      const mockResults = [
        { text: 'I love this!', sentiment: 'positive', confidence: 0.95 },
        { text: 'This is terrible', sentiment: 'negative', confidence: 0.89 }
      ];

      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.analyzeSentimentBatch.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({
          texts: ['I love this!', 'This is terrible'],
          model: 'gpt-4',
          batchSize: 10
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          results: mockResults,
          count: mockResults.length
        }
      });
      expect(mockOpenAIService.analyzeSentimentBatch).toHaveBeenCalledWith(
        ['I love this!', 'This is terrible'],
        {
          model: 'gpt-4',
          batchSize: 10,
          onProgress: expect.any(Function)
        }
      );
    });

    it('should handle batch analysis errors', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.analyzeSentimentBatch.mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/openai/sentiment/batch')
        .send({ texts: ['test text'] })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Analysis failed'
      });
    });
  });

  describe('POST /openai/sentiment/stream', () => {
    it('should require text parameter', async () => {
      const response = await request(app)
        .post('/openai/sentiment/stream')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Text is required'
      });
    });

    it('should reject non-string text', async () => {
      const response = await request(app)
        .post('/openai/sentiment/stream')
        .send({ text: 123 })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Text is required'
      });
    });

    it('should return 503 when OpenAI service is not configured', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });

      const response = await request(app)
        .post('/openai/sentiment/stream')
        .send({ text: 'test text' })
        .expect(503);

      expect(response.body).toEqual({
        success: false,
        error: 'OpenAI service not configured'
      });
    });

    it('should set up SSE headers and stream results', async () => {
      const mockStreamGenerator = async function* () {
        yield { chunk: 1, sentiment: 'positive', confidence: 0.8 };
        yield { chunk: 2, sentiment: 'neutral', confidence: 0.6 };
      };

      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.analyzeSentimentStream.mockReturnValue(mockStreamGenerator());

      const response = await request(app)
        .post('/openai/sentiment/stream')
        .send({
          text: 'This is a long text that needs to be analyzed in chunks',
          chunkSize: 100,
          model: 'gpt-4'
        });

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should handle streaming errors', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.analyzeSentimentStream.mockImplementation(() => {
        throw new Error('Streaming failed');
      });

      const response = await request(app)
        .post('/openai/sentiment/stream')
        .send({ text: 'test text' });

      // The error should be written as an SSE event
      expect(response.text).toContain('event: error');
      expect(response.text).toContain('Streaming failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', async () => {
      mockConfigService.getOpenAIConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      const response = await request(app)
        .get('/openai/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should provide default error messages', async () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: 'test-key' });
      mockOpenAIService.getUsageStats.mockImplementation(() => {
        const error = new Error();
        error.message = '';
        throw error;
      });

      const response = await request(app)
        .get('/openai/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get usage statistics'
      });
    });
  });
});