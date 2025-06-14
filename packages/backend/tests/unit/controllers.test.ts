import { Request, Response } from 'express';
import { SentimentController } from '../../src/controllers/sentiment.controller';
import { DataController } from '../../src/controllers/data.controller';
import { SentimentService } from '../../src/services/sentiment.service';
import { DataService } from '../../src/services/data.service';

// Mock the services
jest.mock('../../src/services/sentiment.service');
jest.mock('../../src/services/data.service');

describe('SentimentController', () => {
  let sentimentController: SentimentController;
  let mockSentimentService: jest.Mocked<SentimentService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockSentimentService = new SentimentService() as jest.Mocked<SentimentService>;
    sentimentController = new SentimentController();
    (sentimentController as any).sentimentService = mockSentimentService;

    mockRequest = {
      body: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment successfully', async () => {
      const mockResult = {
        id: 1,
        text: 'Great service!',
        sentiment: 'positive' as const,
        score: 0.8,
        confidence: 0.9,
        createdAt: '2023-12-25T10:00:00Z'
      };

      mockSentimentService.analyzeSentiment.mockResolvedValue(mockResult);
      mockRequest.body = { text: 'Great service!' };

      await sentimentController.analyzeSentiment(mockRequest as Request, mockResponse as Response);

      expect(mockSentimentService.analyzeSentiment).toHaveBeenCalledWith('Great service!');
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockResult,
        message: 'Sentiment analysis completed'
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockSentimentService.analyzeSentiment.mockRejectedValue(error);
      mockRequest.body = { text: 'Test text' };

      await expect(
        sentimentController.analyzeSentiment(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Service error');

      expect(mockSentimentService.analyzeSentiment).toHaveBeenCalledWith('Test text');
    });
  });

  describe('batchAnalyzeSentiment', () => {
    it('should handle batch analysis successfully', async () => {
      const mockResults = [
        { id: 1, text: 'Good', sentiment: 'positive' as const, score: 0.7, confidence: 0.8 },
        { id: 2, text: 'Bad', sentiment: 'negative' as const, score: -0.7, confidence: 0.8 }
      ];

      mockSentimentService.batchAnalyzeSentiment.mockResolvedValue(mockResults);
      mockRequest.body = { texts: ['Good', 'Bad'] };

      await sentimentController.batchAnalyzeSentiment(mockRequest as Request, mockResponse as Response);

      expect(mockSentimentService.batchAnalyzeSentiment).toHaveBeenCalledWith(['Good', 'Bad']);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockResults,
        message: 'Batch sentiment analysis completed'
      });
    });
  });

  describe('getAnalysisHistory', () => {
    it('should get analysis history with default pagination', async () => {
      const mockHistory = {
        data: [{ id: 1, text: 'Test', sentiment: 'neutral' as const, score: 0, confidence: 0.5 }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      };

      mockSentimentService.getAnalysisHistory.mockResolvedValue(mockHistory);
      mockRequest.query = {};

      await sentimentController.getAnalysisHistory(mockRequest as Request, mockResponse as Response);

      expect(mockSentimentService.getAnalysisHistory).toHaveBeenCalledWith(1, 10);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should get analysis history with custom pagination', async () => {
      const mockHistory = {
        data: [],
        pagination: { page: 2, pageSize: 5, total: 0, totalPages: 0 }
      };

      mockSentimentService.getAnalysisHistory.mockResolvedValue(mockHistory);
      mockRequest.query = { page: '2', pageSize: '5' };

      await sentimentController.getAnalysisHistory(mockRequest as Request, mockResponse as Response);

      expect(mockSentimentService.getAnalysisHistory).toHaveBeenCalledWith(2, 5);
    });
  });

  describe('getStatistics', () => {
    it('should get sentiment statistics', async () => {
      const mockStats = {
        totalAnalyses: 100,
        sentimentDistribution: {
          positive: 60,
          neutral: 30,
          negative: 10
        },
        averageConfidence: 0.85
      };

      mockSentimentService.getStatistics.mockResolvedValue(mockStats);

      await sentimentController.getStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockSentimentService.getStatistics).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockStats
      });
    });
  });
});

describe('DataController', () => {
  let dataController: DataController;
  let mockDataService: jest.Mocked<DataService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockDataService = new DataService() as jest.Mocked<DataService>;
    dataController = new DataController();
    (dataController as any).dataService = mockDataService;

    mockRequest = {
      body: {},
      query: {},
      params: {},
      file: undefined
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('uploadDataset', () => {
    it('should upload dataset successfully', async () => {
      const mockFile = {
        originalname: 'test.csv',
        mimetype: 'text/csv',
        size: 1000,
        buffer: Buffer.from('test,data\n1,2')
      } as Express.Multer.File;

      const mockResult = {
        dataset: {
          id: 'test-id',
          filename: 'test-id.csv',
          originalFilename: 'test.csv',
          size: 1000,
          recordCount: 1,
          createdAt: '2023-12-25T10:00:00Z',
          updatedAt: '2023-12-25T10:00:00Z'
        },
        previewData: [{ test: '1', data: '2' }],
        fieldInfo: [
          { name: 'test', type: 'integer', sampleValues: ['1'], nullCount: 0 },
          { name: 'data', type: 'integer', sampleValues: ['2'], nullCount: 0 }
        ]
      };

      mockDataService.uploadDataset.mockResolvedValue(mockResult);
      mockRequest.file = mockFile;

      await dataController.uploadData(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.uploadDataset).toHaveBeenCalledWith(mockFile);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockResult,
        message: 'Data uploaded successfully'
      });
    });

    it('should handle missing file', async () => {
      mockRequest.file = undefined;

      await expect(
        dataController.uploadData(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('No file provided');
    });
  });

  describe('getDatasets', () => {
    it('should get datasets with default pagination', async () => {
      const mockResult = {
        data: [{
          id: 'test-id',
          filename: 'test-id.csv',
          originalFilename: 'test.csv',
          size: 1000,
          recordCount: 1,
          createdAt: '2023-12-25T10:00:00Z',
          updatedAt: '2023-12-25T10:00:00Z'
        }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      };

      mockDataService.getDatasets.mockResolvedValue(mockResult);
      mockRequest.query = {};

      await dataController.getDatasets(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.getDatasets).toHaveBeenCalledWith(1, 10);
      expect(mockResponse.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getDatasetById', () => {
    it('should get dataset by ID', async () => {
      const mockDataset = {
        id: 'test-id',
        filename: 'test-id.csv',
        originalFilename: 'test.csv',
        size: 1000,
        recordCount: 100,
        createdAt: '2023-12-25T10:00:00Z',
        updatedAt: '2023-12-25T10:00:00Z'
      };

      mockDataService.getDatasetById.mockReturnValue(mockDataset);
      mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      await dataController.getDatasetById(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.getDatasetById).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockDataset
      });
    });
  });

  describe('deleteDataset', () => {
    it('should delete dataset successfully', async () => {
      mockDataService.deleteDataset.mockResolvedValue(undefined);
      mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      await dataController.deleteDataset(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.deleteDataset).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: { id: '123e4567-e89b-12d3-a456-426614174000' },
        message: 'Dataset deleted successfully'
      });
    });
  });

  describe('exportData', () => {
    it('should export data successfully', async () => {
      const mockResult = {
        downloadUrl: '/exports/test.csv',
        expiresAt: '2023-12-26T10:00:00Z'
      };

      mockDataService.exportData.mockResolvedValue(mockResult);
      mockRequest.body = { format: 'csv' };

      await dataController.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.exportData).toHaveBeenCalledWith('csv', {
        datasetId: undefined,
        dateRange: undefined,
        sentimentFilter: undefined
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockResult,
        message: 'Export initiated successfully'
      });
    });

    it('should export data with all parameters', async () => {
      const mockResult = {
        downloadUrl: '/exports/filtered.json',
        expiresAt: '2023-12-26T10:00:00Z'
      };

      mockDataService.exportData.mockResolvedValue(mockResult);
      mockRequest.body = {
        format: 'json',
        datasetId: '123e4567-e89b-12d3-a456-426614174000',
        dateRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-12-31T23:59:59Z'
        },
        sentimentFilter: 'positive'
      };

      await dataController.exportData(mockRequest as Request, mockResponse as Response);

      expect(mockDataService.exportData).toHaveBeenCalledWith('json', {
        datasetId: '123e4567-e89b-12d3-a456-426614174000',
        dateRange: {
          start: new Date('2023-01-01T00:00:00Z'),
          end: new Date('2023-12-31T23:59:59Z')
        },
        sentimentFilter: 'positive'
      });
    });
  });

});