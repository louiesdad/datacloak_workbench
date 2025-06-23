import { SentimentService } from '../sentiment.service';
import { getSQLiteConnection } from '../../database/sqlite-refactored';
import { runDuckDB } from '../../database/duckdb-pool';
import { SecurityService } from '../security.service';
import { OpenAIService } from '../openai.service';
import { DataCloakIntegrationService } from '../datacloak-integration.service';
import { ConfigService } from '../config.service';
import { eventEmitter, EventTypes } from '../event.service';
import { getCacheService } from '../cache.service';
import { AppError } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('../../database/sqlite-refactored');
jest.mock('../../database/duckdb-pool');
jest.mock('../security.service');
jest.mock('../openai.service');
jest.mock('../datacloak-integration.service');
jest.mock('../config.service');
jest.mock('../cache.service');
jest.mock('../event.service');

const mockSQLiteConnection = {
  prepare: jest.fn(),
  close: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
};

describe('SentimentService', () => {
  let service: SentimentService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockOpenAIService: jest.Mocked<OpenAIService>;
  let mockDataCloakService: jest.Mocked<DataCloakIntegrationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ConfigService
    mockConfigService = {
      get: jest.fn(),
      isOpenAIConfigured: jest.fn().mockReturnValue(true),
      getOpenAIConfig: jest.fn().mockReturnValue({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000
      }),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      updateMultiple: jest.fn()
    } as any;

    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);

    // Mock cache service
    (getCacheService as jest.Mock).mockReturnValue(mockCacheService);

    // Mock SQLite connection
    (getSQLiteConnection as jest.Mock).mockReturnValue(mockSQLiteConnection);

    // Mock DuckDB
    (runDuckDB as jest.Mock).mockResolvedValue({});

    // Mock SecurityService
    mockSecurityService = new SecurityService() as jest.Mocked<SecurityService>;
    mockSecurityService.initialize = jest.fn().mockResolvedValue(undefined);
    mockSecurityService.maskText = jest.fn().mockResolvedValue({
      maskedText: 'masked text',
      detectedPII: [],
      metadata: {}
    });

    // Mock OpenAIService
    mockOpenAIService = new OpenAIService({} as any) as jest.Mocked<OpenAIService>;
    mockOpenAIService.testConnection = jest.fn().mockResolvedValue({
      connected: true,
      model: 'gpt-3.5-turbo'
    });
    mockOpenAIService.getConfig = jest.fn().mockReturnValue({
      model: 'gpt-3.5-turbo',
      maxTokens: 150
    });
    mockOpenAIService.getAPIStatus = jest.fn().mockResolvedValue({
      status: 'operational'
    });

    // Mock DataCloakIntegrationService
    mockDataCloakService = new DataCloakIntegrationService(mockOpenAIService) as jest.Mocked<DataCloakIntegrationService>;
    mockDataCloakService.isConfigured = jest.fn().mockReturnValue(true);
    mockDataCloakService.setOpenAIService = jest.fn();
    mockDataCloakService.analyzeSentiment = jest.fn().mockResolvedValue({
      originalText: 'test text',
      obfuscatedText: 'obfuscated test text',
      deobfuscatedText: 'test text',
      sentiment: 'positive',
      score: 0.85,
      confidence: 0.92,
      piiDetected: false,
      piiItemsFound: 0,
      tokensUsed: 50,
      processingTimeMs: 150,
      model: 'gpt-3.5-turbo'
    });
    mockDataCloakService.batchAnalyzeSentiment = jest.fn();
    mockDataCloakService.testDataCloakFlow = jest.fn();
    mockDataCloakService.getProcessingStats = jest.fn();

    // Mock constructor implementations
    (SecurityService as jest.Mock).mockImplementation(() => mockSecurityService);
    (OpenAIService as jest.Mock).mockImplementation(() => mockOpenAIService);
    (DataCloakIntegrationService as jest.Mock).mockImplementation(() => mockDataCloakService);

    service = new SentimentService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('initialization', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
      expect(ConfigService.getInstance).toHaveBeenCalled();
      expect(getCacheService).toHaveBeenCalled();
    });

    it('should set up configuration change listener', () => {
      expect(mockConfigService.on).toHaveBeenCalledWith('config.updated', expect.any(Function));
    });

    it('should handle OpenAI configuration not available', () => {
      mockConfigService.isOpenAIConfigured.mockReturnValue(false);
      
      const newService = new SentimentService();
      expect(newService).toBeDefined();
      newService.destroy();
    });

    it('should handle OpenAI initialization errors', () => {
      mockConfigService.getOpenAIConfig.mockReturnValue({ apiKey: null });
      
      const newService = new SentimentService();
      expect(newService).toBeDefined();
      newService.destroy();
    });
  });

  describe('analyzeSentiment', () => {
    beforeEach(() => {
      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 }),
        get: jest.fn(),
        all: jest.fn()
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);
      mockCacheService.get.mockResolvedValue(null);
    });

    it('should analyze sentiment with basic model', async () => {
      const result = await service.analyzeSentiment('This is excellent!', false, 'basic');

      expect(result).toMatchObject({
        text: 'This is excellent!',
        sentiment: 'positive',
        score: expect.any(Number),
        confidence: expect.any(Number),
        piiDetected: false,
        piiItemsFound: 0,
        model: 'basic'
      });
      expect(result.score).toBeGreaterThan(0);
    });

    it('should analyze negative sentiment', async () => {
      const result = await service.analyzeSentiment('This is terrible and awful', false, 'basic');

      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should analyze neutral sentiment', async () => {
      const result = await service.analyzeSentiment('This is okay', false, 'basic');

      expect(result.sentiment).toBe('neutral');
      expect(Math.abs(result.score)).toBeLessThan(0.2);
    });

    it('should handle empty text', async () => {
      await expect(service.analyzeSentiment('', false, 'basic'))
        .rejects.toThrow(new AppError('Text is required for sentiment analysis', 400, 'INVALID_TEXT'));
    });

    it('should use cached results when available', async () => {
      const cachedResult = {
        text: 'test',
        sentiment: 'positive' as const,
        score: 0.8,
        confidence: 0.9
      };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.analyzeSentiment('test', false, 'basic');

      expect(result).toMatchObject(cachedResult);
      expect(mockDataCloakService.analyzeSentiment).not.toHaveBeenCalled();
    });

    it('should use DataCloak flow for OpenAI models', async () => {
      const result = await service.analyzeSentiment('test text', true, 'gpt-3.5-turbo');

      expect(mockDataCloakService.analyzeSentiment).toHaveBeenCalledWith({
        text: 'test text',
        model: 'gpt-3.5-turbo',
        includeConfidence: true,
        preserveOriginal: true
      });
      expect(result.sentiment).toBe('positive');
      expect(result.model).toBe('gpt-3.5-turbo');
    });

    it('should fallback to basic analysis on DataCloak errors', async () => {
      mockDataCloakService.analyzeSentiment.mockRejectedValue(
        new AppError('DataCloak error', 500, 'DATACLOAK_ERROR')
      );

      const result = await service.analyzeSentiment('This is great!', true, 'gpt-3.5-turbo');

      expect(result.sentiment).toBe('positive');
      expect(result.model).toBe('basic');
    });

    it('should not fallback on authentication errors', async () => {
      mockDataCloakService.analyzeSentiment.mockRejectedValue(
        new AppError('OpenAI not configured', 500, 'OPENAI_NOT_CONFIGURED')
      );

      await expect(service.analyzeSentiment('test', true, 'gpt-3.5-turbo'))
        .rejects.toThrow('OpenAI not configured');
    });

    it('should handle PII masking with legacy flow', async () => {
      mockDataCloakService.isConfigured.mockReturnValue(false);
      mockSecurityService.maskText.mockResolvedValue({
        maskedText: 'Hello [MASKED]',
        detectedPII: [{ type: 'name', value: 'John' }],
        metadata: {}
      });

      const result = await service.analyzeSentiment('Hello John', true, 'gpt-3.5-turbo');

      expect(mockSecurityService.maskText).toHaveBeenCalledWith('Hello John');
      expect(result.piiDetected).toBe(true);
      expect(result.piiItemsFound).toBe(1);
    });

    it('should store results in database', async () => {
      await service.analyzeSentiment('test', false, 'basic');

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sentiment_analyses')
      );
    });

    it('should emit sentiment analyzed event', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await service.analyzeSentiment('test', false, 'basic');

      expect(emitSpy).toHaveBeenCalledWith('sentiment:analyzed', expect.any(Object));
    });

    it('should cache analysis results', async () => {
      await service.analyzeSentiment('test', false, 'basic');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('sentiment:'),
        expect.any(Object),
        { ttl: 3600 }
      );
    });

    it('should handle database errors gracefully', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(service.analyzeSentiment('test', false, 'basic'))
        .rejects.toThrow(new AppError('Database connection not available', 500, 'DB_ERROR'));
    });
  });

  describe('batchAnalyzeSentiment', () => {
    beforeEach(() => {
      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1, changes: 1 })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);
      mockSQLiteConnection.transaction = jest.fn((fn) => fn);
    });

    it('should analyze batch of texts', async () => {
      const texts = ['Good product', 'Bad service', 'Okay experience'];
      const results = await service.batchAnalyzeSentiment(texts, 'basic');

      expect(results).toHaveLength(3);
      expect(results[0].sentiment).toBe('positive');
      expect(results[1].sentiment).toBe('negative');
      expect(results[2].sentiment).toBe('neutral');
      expect(results[0].batchId).toBe(results[1].batchId);
    });

    it('should handle empty batch', async () => {
      await expect(service.batchAnalyzeSentiment([], 'basic'))
        .rejects.toThrow(new AppError('Texts array is required for batch analysis', 400, 'INVALID_TEXTS'));
    });

    it('should reject batch exceeding limit', async () => {
      const largeBatch = new Array(1001).fill('test');

      await expect(service.batchAnalyzeSentiment(largeBatch, 'basic'))
        .rejects.toThrow(new AppError('Batch size cannot exceed 1000 texts', 400, 'BATCH_TOO_LARGE'));
    });

    it('should use DataCloak batch processing', async () => {
      mockDataCloakService.batchAnalyzeSentiment.mockResolvedValue([
        {
          originalText: 'test1',
          obfuscatedText: 'obf1',
          deobfuscatedText: 'test1',
          sentiment: 'positive' as const,
          score: 0.8,
          confidence: 0.9,
          piiDetected: false,
          piiItemsFound: 0,
          tokensUsed: 10,
          processingTimeMs: 50,
          model: 'gpt-3.5-turbo'
        }
      ]);

      const results = await service.batchAnalyzeSentiment(['test1'], 'gpt-3.5-turbo');

      expect(mockDataCloakService.batchAnalyzeSentiment).toHaveBeenCalled();
      expect(results[0].sentiment).toBe('positive');
    });

    it('should enforce DataCloak batch limit', async () => {
      const texts = new Array(101).fill('test');

      await expect(service.batchAnalyzeSentiment(texts, 'gpt-3.5-turbo'))
        .rejects.toThrow(new AppError('DataCloak batch processing limited to 100 texts', 400, 'DATACLOAK_BATCH_LIMIT'));
    });

    it('should fallback to basic batch on DataCloak errors', async () => {
      mockDataCloakService.batchAnalyzeSentiment.mockRejectedValue(new Error('DataCloak error'));

      const results = await service.batchAnalyzeSentiment(['test'], 'gpt-3.5-turbo');

      expect(results[0].model).toBe('gpt-3.5-turbo');
      expect(results[0].sentiment).toBeDefined();
    });

    it('should filter empty texts in batch', async () => {
      const texts = ['valid', '', '  ', 'another valid'];
      const results = await service.batchAnalyzeSentiment(texts, 'basic');

      expect(results).toHaveLength(2);
    });

    it('should emit batch complete event', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');
      mockDataCloakService.batchAnalyzeSentiment.mockResolvedValue([]);

      await service.batchAnalyzeSentiment(['test'], 'gpt-3.5-turbo');

      expect(emitSpy).toHaveBeenCalledWith('sentiment:batch_complete', expect.any(Array));
    });
  });

  describe('getAnalysisHistory', () => {
    beforeEach(() => {
      const mockStmt = {
        get: jest.fn().mockReturnValue({ total: 100 }),
        all: jest.fn().mockReturnValue([
          { id: 1, text: 'test1', sentiment: 'positive', score: 0.8, confidence: 0.9, createdAt: '2024-01-01' },
          { id: 2, text: 'test2', sentiment: 'negative', score: -0.6, confidence: 0.85, createdAt: '2024-01-02' }
        ])
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);
    });

    it('should return paginated history', async () => {
      const result = await service.getAnalysisHistory(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 10,
        total: 100,
        totalPages: 10
      });
    });

    it('should apply sentiment filter', async () => {
      const result = await service.getAnalysisHistory(1, 10, { sentiment: 'positive' });

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE sentiment = ?')
      );
      expect(result.filter).toEqual({ sentiment: 'positive' });
    });

    it('should apply date range filter', async () => {
      const filter = { dateFrom: '2024-01-01', dateTo: '2024-01-31' };
      await service.getAnalysisHistory(1, 10, filter);

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= ?')
      );
      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('created_at <= ?')
      );
    });

    it('should apply confidence filter', async () => {
      const filter = { minConfidence: 0.8, maxConfidence: 0.95 };
      await service.getAnalysisHistory(1, 10, filter);

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('confidence >= ?')
      );
      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('confidence <= ?')
      );
    });

    it('should apply score filter', async () => {
      const filter = { minScore: -0.5, maxScore: 0.5 };
      await service.getAnalysisHistory(1, 10, filter);

      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('score >= ?')
      );
      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('score <= ?')
      );
    });

    it('should handle database errors', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      await expect(service.getAnalysisHistory())
        .rejects.toThrow(new AppError('Database connection not available', 500, 'DB_ERROR'));
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      const mockStmts = {
        total: { get: jest.fn().mockReturnValue({ total: 1000 }) },
        distribution: { 
          all: jest.fn().mockReturnValue([
            { sentiment: 'positive', count: 400 },
            { sentiment: 'negative', count: 200 },
            { sentiment: 'neutral', count: 400 }
          ])
        },
        averages: {
          get: jest.fn().mockReturnValue({ avgConfidence: 0.85, avgScore: 0.25 })
        },
        trends: {
          all: jest.fn().mockReturnValue([
            { date: '2024-01-01', count: 50, avgScore: 0.3 },
            { date: '2024-01-02', count: 60, avgScore: 0.2 }
          ])
        }
      };

      mockSQLiteConnection.prepare.mockImplementation((sql) => {
        if (sql.includes('COUNT(*)')) return mockStmts.total;
        if (sql.includes('GROUP BY sentiment')) return mockStmts.distribution;
        if (sql.includes('AVG(')) return mockStmts.averages;
        if (sql.includes('DATE(created_at)')) return mockStmts.trends;
        return { get: jest.fn(), all: jest.fn() };
      });
    });

    it('should return sentiment statistics', async () => {
      const stats = await service.getStatistics();

      expect(stats).toEqual({
        totalAnalyses: 1000,
        sentimentDistribution: {
          positive: 400,
          negative: 200,
          neutral: 400
        },
        averageConfidence: 0.85,
        averageScore: 0.25,
        piiDetectionRate: 0.15
      });
    });

    it('should include daily trends when requested', async () => {
      const stats = await service.getStatistics(true);

      expect(stats.dailyTrends).toBeDefined();
      expect(stats.dailyTrends).toHaveLength(2);
      expect(stats.dailyTrends?.[0]).toEqual({
        date: '2024-01-01',
        count: 50,
        avgScore: 0.3
      });
    });

    it('should handle empty database', async () => {
      mockSQLiteConnection.prepare.mockReturnValue({
        get: jest.fn().mockReturnValue({ total: 0, avgConfidence: null, avgScore: null }),
        all: jest.fn().mockReturnValue([])
      });

      const stats = await service.getStatistics();

      expect(stats.totalAnalyses).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('getAnalysisById', () => {
    it('should return analysis by ID', async () => {
      const mockResult = {
        id: 1,
        text: 'test',
        sentiment: 'positive',
        score: 0.8,
        confidence: 0.9,
        createdAt: '2024-01-01'
      };

      const mockStmt = {
        get: jest.fn().mockReturnValue(mockResult)
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getAnalysisById(1);

      expect(result).toEqual(mockResult);
    });

    it('should return null for non-existent ID', async () => {
      const mockStmt = {
        get: jest.fn().mockReturnValue(undefined)
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.getAnalysisById(999);

      expect(result).toBeNull();
    });
  });

  describe('deleteAnalysisResults', () => {
    it('should delete multiple results', async () => {
      const mockStmt = {
        run: jest.fn().mockReturnValue({ changes: 3 })
      };
      mockSQLiteConnection.prepare.mockReturnValue(mockStmt);

      const result = await service.deleteAnalysisResults([1, 2, 3]);

      expect(result).toEqual({ deleted: 3 });
      expect(mockSQLiteConnection.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sentiment_analyses WHERE id IN (?,?,?)')
      );
    });

    it('should handle empty IDs array', async () => {
      await expect(service.deleteAnalysisResults([]))
        .rejects.toThrow(new AppError('IDs array is required', 400, 'INVALID_IDS'));
    });
  });

  describe('exportAnalysisResults', () => {
    beforeEach(() => {
      const mockData: SentimentAnalysisResult[] = [
        { id: 1, text: 'test1', sentiment: 'positive' as const, score: 0.8, confidence: 0.9, createdAt: '2024-01-01' },
        { id: 2, text: 'test2', sentiment: 'negative' as const, score: -0.6, confidence: 0.85, createdAt: '2024-01-02' }
      ];

      jest.spyOn(service, 'getAnalysisHistory').mockResolvedValue({
        data: mockData,
        pagination: { page: 1, pageSize: 10000, total: 2, totalPages: 1 }
      });
    });

    it('should export results as JSON', async () => {
      const result = await service.exportAnalysisResults('json');

      expect(result.format).toBe('json');
      expect(result.recordCount).toBe(2);
      expect(result.data.results).toHaveLength(2);
      expect(result.data.metadata).toBeDefined();
    });

    it('should export results as CSV', async () => {
      const result = await service.exportAnalysisResults('csv');

      expect(result.format).toBe('csv');
      expect(result.recordCount).toBe(2);
      expect(result.data).toContain('id,text,sentiment,score,confidence,createdAt');
      expect(result.data).toContain('test1');
      expect(result.data).toContain('test2');
    });

    it('should handle CSV special characters', async () => {
      jest.spyOn(service, 'getAnalysisHistory').mockResolvedValue({
        data: [{ 
          id: 1, 
          text: 'text with, comma and "quotes"', 
          sentiment: 'positive' as const, 
          score: 0.8, 
          confidence: 0.9, 
          createdAt: '2024-01-01' 
        }],
        pagination: { page: 1, pageSize: 10000, total: 1, totalPages: 1 }
      });

      const result = await service.exportAnalysisResults('csv');

      expect(result.data).toContain('"text with, comma and ""quotes"""');
    });

    it('should apply filters to export', async () => {
      const filter = { sentiment: 'positive' as const };
      await service.exportAnalysisResults('json', filter);

      expect(service.getAnalysisHistory).toHaveBeenCalledWith(1, 10000, filter);
    });
  });

  describe('getAnalysisInsights', () => {
    beforeEach(() => {
      const mockStmts = {
        hourly: {
          all: jest.fn().mockReturnValue([
            { hour: '09', count: 50, avgScore: 0.3 },
            { hour: '10', count: 60, avgScore: 0.2 }
          ])
        },
        confidence: {
          all: jest.fn().mockReturnValue([
            { range: 'High (0.6-0.8)', count: 400 },
            { range: 'Very High (0.8-1.0)', count: 300 }
          ])
        },
        texts: {
          all: jest.fn().mockReturnValue([
            { text: 'excellent product', sentiment: 'positive' },
            { text: 'terrible service', sentiment: 'negative' }
          ])
        }
      };

      mockSQLiteConnection.prepare.mockImplementation((sql) => {
        if (sql.includes('strftime')) return mockStmts.hourly;
        if (sql.includes('CASE')) return mockStmts.confidence;
        if (sql.includes('SELECT text, sentiment')) return mockStmts.texts;
        return { all: jest.fn().mockReturnValue([]) };
      });
    });

    it('should return analysis insights', async () => {
      const insights = await service.getAnalysisInsights();

      expect(insights).toHaveProperty('topPositiveWords');
      expect(insights).toHaveProperty('topNegativeWords');
      expect(insights).toHaveProperty('hourlyDistribution');
      expect(insights).toHaveProperty('confidenceDistribution');
    });

    it('should return hourly distribution', async () => {
      const insights = await service.getAnalysisInsights();

      expect(insights.hourlyDistribution).toHaveLength(2);
      expect(insights.hourlyDistribution[0]).toEqual({
        hour: 9,
        count: 50,
        avgScore: 0.3
      });
    });

    it('should return confidence distribution', async () => {
      const insights = await service.getAnalysisInsights();

      expect(insights.confidenceDistribution).toHaveLength(2);
      expect(insights.confidenceDistribution[0]).toEqual({
        range: 'High (0.6-0.8)',
        count: 400
      });
    });
  });

  describe('OpenAI integration', () => {
    it('should test OpenAI connection', async () => {
      const result = await service.testOpenAIConnection();

      expect(result).toEqual({
        available: true,
        connected: true,
        model: 'gpt-3.5-turbo'
      });
    });

    it('should handle OpenAI not configured', async () => {
      // Create a new service instance with OpenAI not configured
      mockConfigService.isOpenAIConfigured.mockReturnValue(false);
      const newService = new SentimentService();

      const result = await newService.testOpenAIConnection();

      expect(result).toEqual({
        available: false,
        error: 'OpenAI service not configured (missing API key)'
      });

      newService.destroy();
    });

    it('should get OpenAI status', async () => {
      const result = await service.getOpenAIStatus();

      expect(result).toEqual({
        available: true,
        config: {
          model: 'gpt-3.5-turbo',
          maxTokens: 150
        },
        status: {
          status: 'operational'
        }
      });
    });

    it('should update OpenAI configuration', async () => {
      const result = await service.updateOpenAIConfig({
        model: 'gpt-4',
        maxTokens: 200,
        temperature: 0.2
      });

      expect(result).toEqual({ success: true });
      expect(mockConfigService.updateMultiple).toHaveBeenCalledWith({
        OPENAI_MODEL: 'gpt-4',
        OPENAI_MAX_TOKENS: 200,
        OPENAI_TEMPERATURE: 0.2
      });
    });

    it('should handle configuration update errors', async () => {
      mockConfigService.updateMultiple.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateOpenAIConfig({ model: 'gpt-4' });

      expect(result).toEqual({
        success: false,
        error: 'Update failed'
      });
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models', () => {
      const models = service.getAvailableModels();

      expect(models.basic).toBeDefined();
      expect(models.basic.name).toBe('Basic Sentiment Analysis');
      expect(models.openai).toBeDefined();
      expect(models.openai).toHaveLength(3);
      expect(models.openai[0].name).toBe('gpt-3.5-turbo');
    });
  });

  describe('DataCloak integration', () => {
    it('should test DataCloak flow', async () => {
      mockDataCloakService.testDataCloakFlow.mockResolvedValue({ success: true });

      const result = await service.testDataCloakFlow();

      expect(result).toEqual({ success: true });
    });

    it('should get DataCloak statistics', async () => {
      mockDataCloakService.getProcessingStats.mockResolvedValue({
        totalProcessed: 100,
        piiDetected: 15
      });

      const stats = await service.getDataCloakStats();

      expect(stats).toEqual({
        totalProcessed: 100,
        piiDetected: 15
      });
    });
  });

  describe('configuration updates', () => {
    it('should reinitialize OpenAI service on config change', async () => {
      const configListener = mockConfigService.on.mock.calls[0][1];

      await configListener({ key: 'OPENAI_API_KEY', value: 'new-key' });

      expect(mockDataCloakService.setOpenAIService).toHaveBeenCalled();
    });

    it('should invalidate caches on OpenAI config change', async () => {
      mockCacheService.keys.mockResolvedValue(['sentiment:abc', 'sentiment:def']);
      const configListener = mockConfigService.on.mock.calls[0][1];

      await configListener({ key: 'OPENAI_MODEL', value: 'gpt-4' });

      expect(mockCacheService.keys).toHaveBeenCalledWith('sentiment:*');
      expect(mockCacheService.del).toHaveBeenCalledTimes(2);
    });

    it('should ignore non-OpenAI config changes', async () => {
      const configListener = mockConfigService.on.mock.calls[0][1];

      await configListener({ key: 'OTHER_CONFIG', value: 'value' });

      expect(mockDataCloakService.setOpenAIService).not.toHaveBeenCalled();
    });
  });

  describe('sentiment analysis algorithms', () => {
    it('should detect intensifiers', async () => {
      const result = await service.analyzeSentiment('This is very good!', false, 'basic');

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should handle negations', async () => {
      const result = await service.analyzeSentiment('This is not good', false, 'basic');

      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should handle multiple sentences', async () => {
      const text = 'The product is excellent. However, the service was terrible.';
      const result = await service.analyzeSentiment(text, false, 'basic');

      // Should be somewhat neutral due to mixed sentiments
      expect(Math.abs(result.score)).toBeLessThan(0.5);
    });

    it('should adjust for punctuation', async () => {
      const result1 = await service.analyzeSentiment('This is good', false, 'basic');
      const result2 = await service.analyzeSentiment('This is good!!!', false, 'basic');

      expect(result2.score).toBeGreaterThan(result1.score);
    });

    it('should handle repeated characters', async () => {
      const result = await service.analyzeSentiment('This is sooooo good', false, 'basic');

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should calculate confidence based on text length', async () => {
      const shortResult = await service.analyzeSentiment('Good', false, 'basic');
      const longResult = await service.analyzeSentiment(
        'This product is absolutely excellent and I would highly recommend it to everyone',
        false,
        'basic'
      );

      expect(longResult.confidence).toBeGreaterThan(shortResult.confidence);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on destroy', () => {
      service.destroy();

      expect(mockConfigService.removeAllListeners).toHaveBeenCalledWith('config.updated');
    });
  });
});