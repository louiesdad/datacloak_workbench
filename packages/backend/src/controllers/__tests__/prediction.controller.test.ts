import request from 'supertest';
import express from 'express';
import { PredictionController } from '../prediction.controller';
import { PredictionService } from '../../services/prediction.service';
import { errorHandler } from '../../middleware/error.middleware';

// Mock the PredictionService
jest.mock('../../services/prediction.service');

describe('PredictionController', () => {
  let app: express.Application;
  let predictionController: PredictionController;
  let mockPredictionService: jest.Mocked<PredictionService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Create mock service
    mockPredictionService = {
      generatePredictions: jest.fn(),
      getSavedPredictions: jest.fn(),
      identifyHighRiskCustomers: jest.fn(),
      processBatchPredictions: jest.fn(),
    } as any;

    // Mock the service constructor
    (PredictionService as jest.Mock).mockImplementation(() => mockPredictionService);

    // Create controller and setup routes
    predictionController = new PredictionController();
    app.use('/api/predictions', predictionController.router);
    app.use(errorHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/predictions/customer/:customerId', () => {
    test('should return customer predictions', async () => {
      const mockPredictions = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
        ],
        trajectory: {
          classification: 'declining',
          severity: 'high',
        },
      };

      mockPredictionService.getSavedPredictions.mockResolvedValue([]);
      mockPredictionService.generatePredictions.mockResolvedValue(mockPredictions);

      const response = await request(app)
        .get('/api/predictions/customer/cust-123')
        .expect(200);

      expect(response.body).toEqual(mockPredictions);
      expect(mockPredictionService.generatePredictions).toHaveBeenCalledWith('cust-123');
    });

    test('should return saved predictions if available', async () => {
      const savedPredictions = [{
        customerId: 'cust-123',
        predictedDate: '2024-02-15',
        predictedSentiment: 65,
        confidenceLower: 55,
        confidenceUpper: 75,
      }];

      mockPredictionService.getSavedPredictions.mockResolvedValue(savedPredictions);

      const response = await request(app)
        .get('/api/predictions/customer/cust-123')
        .expect(200);

      expect(response.body.customerId).toBe('cust-123');
      expect(response.body.predictions).toBeDefined();
      expect(mockPredictionService.getSavedPredictions).toHaveBeenCalledWith('cust-123');
    });

    test('should handle missing customerId', async () => {
      const response = await request(app)
        .get('/api/predictions/customer/')
        .expect(404);
    });

    test('should handle service errors', async () => {
      mockPredictionService.getSavedPredictions.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/predictions/customer/cust-123')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/predictions/generate/:customerId', () => {
    test('should generate new predictions', async () => {
      const mockPredictions = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
        ],
      };

      mockPredictionService.generatePredictions.mockResolvedValue(mockPredictions);

      const response = await request(app)
        .post('/api/predictions/generate/cust-123')
        .expect(201);

      expect(response.body).toEqual(mockPredictions);
      expect(mockPredictionService.generatePredictions).toHaveBeenCalledWith('cust-123');
    });

    test('should handle generation errors', async () => {
      mockPredictionService.generatePredictions.mockRejectedValue(
        new Error('Insufficient data')
      );

      const response = await request(app)
        .post('/api/predictions/generate/cust-123')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/predictions/high-risk', () => {
    test('should return high-risk customers', async () => {
      const mockRiskAssessment = {
        highRiskCustomers: [
          {
            customerId: 'cust-123',
            currentSentiment: 35,
            daysUntilThreshold: 7,
            riskLevel: 'critical',
            lastAnalysisDate: '2024-01-15',
          },
        ],
        totalAssessed: 10,
        assessedAt: '2024-01-15T10:00:00Z',
      };

      mockPredictionService.identifyHighRiskCustomers.mockResolvedValue(mockRiskAssessment);

      const response = await request(app)
        .get('/api/predictions/high-risk')
        .expect(200);

      expect(response.body).toEqual(mockRiskAssessment);
      expect(mockPredictionService.identifyHighRiskCustomers).toHaveBeenCalledWith(40);
    });

    test('should accept custom threshold', async () => {
      const mockRiskAssessment = {
        highRiskCustomers: [],
        totalAssessed: 10,
        assessedAt: '2024-01-15T10:00:00Z',
      };

      mockPredictionService.identifyHighRiskCustomers.mockResolvedValue(mockRiskAssessment);

      const response = await request(app)
        .get('/api/predictions/high-risk?threshold=50')
        .expect(200);

      expect(mockPredictionService.identifyHighRiskCustomers).toHaveBeenCalledWith(50);
    });

    test('should validate threshold parameter', async () => {
      const response = await request(app)
        .get('/api/predictions/high-risk?threshold=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('Invalid threshold');
    });
  });

  describe('POST /api/predictions/batch-process', () => {
    test('should process batch predictions', async () => {
      const mockResult = {
        processed: 100,
        successful: 98,
        failed: 2,
      };

      mockPredictionService.processBatchPredictions.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/predictions/batch-process')
        .expect(202);

      expect(response.body).toEqual({
        message: 'Batch processing started',
        result: mockResult,
      });
    });

    test('should handle batch processing errors', async () => {
      mockPredictionService.processBatchPredictions.mockRejectedValue(
        new Error('Processing failed')
      );

      const response = await request(app)
        .post('/api/predictions/batch-process')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/predictions/export/:customerId', () => {
    test('should export predictions as CSV', async () => {
      const mockPredictions = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
        ],
      };

      mockPredictionService.generatePredictions.mockResolvedValue(mockPredictions);

      const response = await request(app)
        .get('/api/predictions/export/cust-123?format=csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('predictions-cust-123.csv');
    });

    test('should export predictions as JSON', async () => {
      const mockPredictions = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
        ],
      };

      mockPredictionService.generatePredictions.mockResolvedValue(mockPredictions);

      const response = await request(app)
        .get('/api/predictions/export/cust-123?format=json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toEqual(mockPredictions);
    });

    test('should default to CSV format', async () => {
      const mockPredictions = {
        customerId: 'cust-123',
        predictions: [],
      };

      mockPredictionService.generatePredictions.mockResolvedValue(mockPredictions);

      const response = await request(app)
        .get('/api/predictions/export/cust-123')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});