import { PredictionService } from '../prediction.service';
import { TrendCalculator } from '../trend-calculator.service';
import { getSQLiteConnection } from '../../database/sqlite-refactored';
import Database from 'better-sqlite3';

// Mock dependencies
jest.mock('../../database/sqlite-refactored');
jest.mock('../trend-calculator.service');

describe('Prediction Service', () => {
  let predictionService: PredictionService;
  let mockDb: jest.Mocked<Database.Database>;
  let mockTrendCalculator: jest.Mocked<TrendCalculator>;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      prepare: jest.fn(),
      transaction: jest.fn((fn) => fn),
    } as any;
    (getSQLiteConnection as jest.Mock).mockResolvedValue(mockDb);

    // Setup mock trend calculator
    mockTrendCalculator = {
      calculateLinearTrend: jest.fn(),
      predictWithConfidence: jest.fn(),
      classifyTrajectory: jest.fn(),
      assessRisk: jest.fn(),
      processBatch: jest.fn(),
    } as any;
    (TrendCalculator as jest.Mock).mockImplementation(() => mockTrendCalculator);

    predictionService = new PredictionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Customer Sentiment History', () => {
    test('should retrieve sentiment history for a customer', async () => {
      // Arrange
      const customerId = 'cust-123';
      const mockHistory = [
        { date: '2024-01-01', sentiment: 80, confidence: 0.9 },
        { date: '2024-01-08', sentiment: 75, confidence: 0.85 },
        { date: '2024-01-15', sentiment: 70, confidence: 0.88 },
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockHistory),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      // Act
      const history = await predictionService.getCustomerSentimentHistory(customerId);

      // Assert
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('customer_id'));
      expect(mockStmt.all).toHaveBeenCalledWith(customerId);
      expect(history).toHaveLength(3);
      expect(history[0]).toHaveProperty('date');
      expect(history[0]).toHaveProperty('sentiment');
    });

    test('should handle missing customer data gracefully', async () => {
      // Arrange
      const customerId = 'cust-nonexistent';
      const mockStmt = {
        all: jest.fn().mockReturnValue([]),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      // Act
      const history = await predictionService.getCustomerSentimentHistory(customerId);

      // Assert
      expect(history).toEqual([]);
    });
  });

  describe('Prediction Generation', () => {
    test('should generate predictions for a customer', async () => {
      // Arrange
      const customerId = 'cust-123';
      const mockHistory = [
        { date: '2024-01-01', sentiment: 80, confidence: 0.9 },
        { date: '2024-01-08', sentiment: 75, confidence: 0.85 },
        { date: '2024-01-15', sentiment: 70, confidence: 0.88 },
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockHistory),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      mockTrendCalculator.calculateLinearTrend.mockReturnValue({
        slope: -5,
        intercept: 85,
        rSquared: 0.95,
      });

      mockTrendCalculator.predictWithConfidence.mockReturnValue({
        predicted: 50,
        confidence: {
          lower: 40,
          upper: 60,
          level: 0.95,
        },
      });

      mockTrendCalculator.classifyTrajectory.mockReturnValue({
        classification: 'declining',
        severity: 'high',
        volatility: 0.1,
      });

      // Act
      const predictions = await predictionService.generatePredictions(customerId);

      // Assert
      expect(predictions).toBeDefined();
      expect(predictions.customerId).toBe(customerId);
      expect(predictions.predictions).toHaveLength(3); // 30, 60, 90 days
      expect(predictions.trajectory).toBeDefined();
      expect(predictions.trend).toBeDefined();
    });

    test('should not generate predictions with insufficient data', async () => {
      // Arrange
      const customerId = 'cust-123';
      const mockHistory = [
        { date: '2024-01-01', sentiment: 80, confidence: 0.9 },
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockHistory),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      // Act
      const predictions = await predictionService.generatePredictions(customerId);

      // Assert
      expect(predictions.predictions).toHaveLength(0);
      expect(predictions.error).toBe('Insufficient data for predictions');
    });
  });

  describe('Risk Assessment', () => {
    test('should identify high-risk customers', async () => {
      // Arrange
      const mockCustomers = [
        { customer_id: 'cust-1' },
        { customer_id: 'cust-2' },
        { customer_id: 'cust-3' },
      ];

      const mockCustomerStmt = {
        all: jest.fn().mockReturnValue(mockCustomers),
      };

      const mockHistoryStmt = {
        all: jest.fn()
          .mockReturnValueOnce([
            { date: '2024-01-01', sentiment: 65, confidence: 0.9 },
            { date: '2024-01-08', sentiment: 50, confidence: 0.85 },
            { date: '2024-01-15', sentiment: 35, confidence: 0.88 },
          ])
          .mockReturnValueOnce([
            { date: '2024-01-01', sentiment: 90, confidence: 0.9 },
            { date: '2024-01-08', sentiment: 85, confidence: 0.85 },
            { date: '2024-01-15', sentiment: 80, confidence: 0.88 },
          ])
          .mockReturnValueOnce([
            { date: '2024-01-01', sentiment: 40, confidence: 0.9 },
            { date: '2024-01-08', sentiment: 30, confidence: 0.85 },
            { date: '2024-01-15', sentiment: 20, confidence: 0.88 },
          ]),
      };

      mockDb.prepare
        .mockReturnValueOnce(mockCustomerStmt as any)
        .mockReturnValue(mockHistoryStmt as any);

      mockTrendCalculator.assessRisk
        .mockReturnValueOnce({
          isHighRisk: true,
          predictedDropBelowThreshold: true,
          daysUntilThreshold: 15,
          currentSentiment: 35,
        })
        .mockReturnValueOnce({
          isHighRisk: false,
          predictedDropBelowThreshold: false,
          daysUntilThreshold: Infinity,
          currentSentiment: 80,
        })
        .mockReturnValueOnce({
          isHighRisk: true,
          predictedDropBelowThreshold: true,
          daysUntilThreshold: 7,
          currentSentiment: 20,
        });

      // Act
      const riskAssessment = await predictionService.identifyHighRiskCustomers(40);

      // Assert
      expect(riskAssessment.highRiskCustomers).toHaveLength(2);
      expect(riskAssessment.highRiskCustomers[0].customerId).toBe('cust-3'); // cust-3 has lower sentiment (20) and only 7 days until threshold
      expect(riskAssessment.highRiskCustomers[1].customerId).toBe('cust-1'); // cust-1 has higher sentiment (35) and 15 days until threshold
      expect(riskAssessment.totalAssessed).toBe(3);
    });
  });

  describe('Batch Prediction Processing', () => {
    test('should process predictions for all customers in batch', async () => {
      // Arrange
      const mockCustomerStmt = {
        all: jest.fn().mockReturnValue([
          { customer_id: 'cust-1', data_points: 10 },
          { customer_id: 'cust-2', data_points: 15 },
        ]),
      };
      
      const mockHistoryStmt = {
        all: jest.fn()
          .mockReturnValueOnce([
            { date: '2024-01-01', sentiment: 0.8, confidence: 0.9 },
            { date: '2024-01-08', sentiment: 0.75, confidence: 0.85 },
            { date: '2024-01-15', sentiment: 0.7, confidence: 0.88 },
          ])
          .mockReturnValueOnce([
            { date: '2024-01-01', sentiment: 0.6, confidence: 0.9 },
            { date: '2024-01-08', sentiment: 0.65, confidence: 0.85 },
            { date: '2024-01-15', sentiment: 0.7, confidence: 0.88 },
          ]),
      };
      
      const mockCreateTableStmt = {
        run: jest.fn(),
      };
      
      const mockInsertStmt = {
        run: jest.fn(),
      };
      
      mockDb.prepare
        .mockReturnValueOnce(mockCustomerStmt as any)
        .mockReturnValueOnce(mockHistoryStmt as any)
        .mockReturnValueOnce(mockHistoryStmt as any)
        .mockReturnValueOnce(mockCreateTableStmt as any)
        .mockReturnValue(mockInsertStmt as any);

      const mockBatchResult = [
        {
          customerId: 'cust-1',
          trajectory: { classification: 'declining', severity: 'high' },
          trend: { slope: -5, intercept: 80, rSquared: 0.9 },
        },
        {
          customerId: 'cust-2',
          trajectory: { classification: 'stable', severity: 'low' },
          trend: { slope: 0.5, intercept: 70, rSquared: 0.3 },
        },
      ];

      mockTrendCalculator.processBatch.mockResolvedValue(mockBatchResult);

      // Act
      const result = await predictionService.processBatchPredictions();

      // Assert
      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('Database Storage', () => {
    test('should save predictions to database', async () => {
      // Arrange
      const prediction = {
        customerId: 'cust-123',
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 50,
            confidenceLower: 40,
            confidenceUpper: 60,
          },
        ],
        trajectory: { classification: 'declining', severity: 'high' },
        trend: { slope: -5, intercept: 80, rSquared: 0.9 },
      };

      const mockStmt = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      // Act
      await predictionService.savePrediction(prediction);

      // Assert
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sentiment_predictions')
      );
      expect(mockStmt.run).toHaveBeenCalled();
    });

    test('should retrieve saved predictions', async () => {
      // Arrange
      const customerId = 'cust-123';
      const mockPredictions = [
        {
          id: 1,
          customer_id: 'cust-123',
          predicted_date: '2024-02-01',
          predicted_sentiment: 50,
          confidence_lower: 40,
          confidence_upper: 60,
          trajectory_classification: 'declining',
          created_at: '2024-01-15',
        },
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockPredictions),
      };
      mockDb.prepare.mockReturnValue(mockStmt as any);

      // Act
      const predictions = await predictionService.getSavedPredictions(customerId);

      // Assert
      expect(predictions).toHaveLength(1);
      expect(predictions[0].customerId).toBe(customerId);
      expect(predictions[0].predictedSentiment).toBe(50);
    });
  });
});