import { PredictionService } from '../../services/prediction.service';
import { TrendCalculator } from '../../services/trend-calculator.service';
import Database from 'better-sqlite3';
import path from 'path';

// Mock the sqlite connection to use our test database
jest.mock('../../database/sqlite-refactored', () => {
  let testDb: Database.Database;
  
  return {
    getSQLiteConnection: jest.fn(() => {
      return testDb;
    }),
    releaseSQLiteConnection: jest.fn(),
    withSQLiteConnection: jest.fn(async (fn) => {
      return fn(testDb);
    }),
    __setTestDb: (db: Database.Database) => {
      testDb = db;
    }
  };
});

describe('Prediction Integration Tests', () => {
  let predictionService: PredictionService;
  let trendCalculator: TrendCalculator;
  let db: Database.Database;

  beforeAll(async () => {
    // Create a test database in memory
    db = new Database(':memory:');
    
    // Set the test database for the mock
    const sqliteMock = require('../../database/sqlite-refactored');
    sqliteMock.__setTestDb(db);
    
    // Initialize services
    predictionService = new PredictionService();
    trendCalculator = new TrendCalculator();
    
    // Create test tables
    await setupTestTables();
  });

  afterAll(async () => {
    // Clean up test data and close database
    await cleanupTestData();
    if (db) {
      db.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await cleanupTestData();
  });

  const setupTestTables = async () => {
    // Create sentiment_analyses table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sentiment_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id TEXT NOT NULL,
        text TEXT NOT NULL,
        sentiment TEXT NOT NULL,
        score REAL NOT NULL,
        confidence REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create predictions table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sentiment_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prediction_id TEXT UNIQUE,
        customer_id TEXT NOT NULL,
        predicted_date TEXT NOT NULL,
        predicted_sentiment REAL,
        confidence_lower REAL,
        confidence_upper REAL,
        trajectory_classification TEXT,
        trajectory_severity TEXT,
        trend_slope REAL,
        trend_r_squared REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  };

  const cleanupTestData = async () => {
    if (db) {
      db.prepare('DELETE FROM sentiment_analyses WHERE customer_id LIKE ?').run('test_%');
      db.prepare('DELETE FROM sentiment_predictions WHERE customer_id LIKE ?').run('test_%');
    }
  };

  const insertTestSentimentData = (customerId: string, sentimentData: Array<{ date: string; score: number; confidence: number }>) => {
    const stmt = db.prepare(`
      INSERT INTO sentiment_analyses (customer_id, text, sentiment, score, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const data of sentimentData) {
      const sentiment = data.score > 0.6 ? 'positive' : data.score < 0.4 ? 'negative' : 'neutral';
      stmt.run(customerId, 'Test sentiment text', sentiment, data.score, data.confidence, data.date);
    }
  };

  describe('End-to-End Prediction Flow', () => {
    test('should generate predictions from real database data', async () => {
      // Arrange
      const customerId = 'test_customer_001';
      const sentimentHistory = [
        { date: '2024-01-01 10:00:00', score: 0.8, confidence: 0.9 },
        { date: '2024-01-08 10:00:00', score: 0.75, confidence: 0.85 },
        { date: '2024-01-15 10:00:00', score: 0.7, confidence: 0.88 },
        { date: '2024-01-22 10:00:00', score: 0.65, confidence: 0.87 },
        { date: '2024-01-29 10:00:00', score: 0.6, confidence: 0.89 },
      ];

      insertTestSentimentData(customerId, sentimentHistory);

      // Act
      const predictions = await predictionService.generatePredictions(customerId);

      // Assert
      expect(predictions).toBeDefined();
      expect(predictions.customerId).toBe(customerId);
      expect(predictions.predictions).toHaveLength(3); // 30, 60, 90 day predictions
      expect(predictions.trajectory).toBeDefined();
      expect(predictions.trajectory.classification).toBe('declining');
      expect(predictions.trend).toBeDefined();
      expect(predictions.trend.slope).toBeLessThan(0); // Declining trend
    });

    test('should save and retrieve predictions', async () => {
      // Arrange
      const customerId = 'test_customer_002';
      const sentimentHistory = [
        { date: '2024-01-01 10:00:00', score: 0.5, confidence: 0.8 },
        { date: '2024-01-08 10:00:00', score: 0.6, confidence: 0.82 },
        { date: '2024-01-15 10:00:00', score: 0.7, confidence: 0.85 },
        { date: '2024-01-22 10:00:00', score: 0.75, confidence: 0.87 },
      ];

      insertTestSentimentData(customerId, sentimentHistory);

      // Act
      const predictions = await predictionService.generatePredictions(customerId);
      await predictionService.savePrediction(predictions);
      const savedPredictions = await predictionService.getSavedPredictions(customerId);

      // Assert
      expect(savedPredictions).toHaveLength(predictions.predictions.length);
      expect(savedPredictions[0].customerId).toBe(customerId);
      expect(savedPredictions[0].predictedSentiment).toBeGreaterThan(0);
    });

    test('should identify high-risk customers from database', async () => {
      // Arrange - use recent dates
      const now = new Date();
      const recentDate1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
      const recentDate2 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ago
      const recentDate3 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(); // 21 days ago
      const recentDate4 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(); // 28 days ago
      
      const riskCustomers = [
        {
          id: 'test_customer_high_risk_001',
          data: [
            { date: recentDate4, score: 0.6, confidence: 0.9 },
            { date: recentDate3, score: 0.5, confidence: 0.85 },
            { date: recentDate2, score: 0.4, confidence: 0.88 },
            { date: recentDate1, score: 0.3, confidence: 0.87 },
          ]
        },
        {
          id: 'test_customer_stable_001',
          data: [
            { date: recentDate4, score: 0.8, confidence: 0.9 },
            { date: recentDate3, score: 0.82, confidence: 0.85 },
            { date: recentDate2, score: 0.79, confidence: 0.88 },
            { date: recentDate1, score: 0.81, confidence: 0.87 },
          ]
        }
      ];

      for (const customer of riskCustomers) {
        insertTestSentimentData(customer.id, customer.data);
      }

      // Act
      const riskAssessment = await predictionService.identifyHighRiskCustomers(40);

      // Assert
      expect(riskAssessment.totalAssessed).toBeGreaterThanOrEqual(2);
      expect(riskAssessment.highRiskCustomers.length).toBeGreaterThan(0);
      
      const highRiskCustomer = riskAssessment.highRiskCustomers.find(
        c => c.customerId === 'test_customer_high_risk_001'
      );
      expect(highRiskCustomer).toBeDefined();
      expect(highRiskCustomer.riskLevel).toBe('critical');
    });
  });

  describe('Trend Calculator Database Integration', () => {
    test('should calculate trends from database sentiment data', async () => {
      // Arrange
      const customerId = 'test_customer_trend_001';
      const sentimentHistory = [
        { date: '2024-01-01 10:00:00', score: 0.9, confidence: 0.95 },
        { date: '2024-01-08 10:00:00', score: 0.85, confidence: 0.92 },
        { date: '2024-01-15 10:00:00', score: 0.8, confidence: 0.91 },
        { date: '2024-01-22 10:00:00', score: 0.75, confidence: 0.89 },
        { date: '2024-01-29 10:00:00', score: 0.7, confidence: 0.88 },
      ];

      insertTestSentimentData(customerId, sentimentHistory);

      // Act
      const history = await predictionService.getCustomerSentimentHistory(customerId);
      const sentimentData = history.map(h => ({
        date: new Date(h.date),
        sentiment: h.sentiment * 100,
        customerId,
      }));

      const trend = trendCalculator.calculateLinearTrend(sentimentData);
      const trajectory = trendCalculator.classifyTrajectory(sentimentData);

      // Assert
      expect(trend).toBeDefined();
      expect(trend.slope).toBeLessThan(0); // Declining trend
      expect(trend.rSquared).toBeGreaterThan(0.9); // Strong correlation
      expect(trajectory.classification).toBe('declining');
      expect(trajectory.severity).toBe('medium');
    });

    test('should handle customers with insufficient data', async () => {
      // Arrange
      const customerId = 'test_customer_insufficient_001';
      const sentimentHistory = [
        { date: '2024-01-01 10:00:00', score: 0.8, confidence: 0.9 },
      ];

      insertTestSentimentData(customerId, sentimentHistory);

      // Act
      const predictions = await predictionService.generatePredictions(customerId);

      // Assert
      expect(predictions.error).toBe('Insufficient data for predictions');
      expect(predictions.predictions).toHaveLength(0);
    });

    test('should batch process multiple customers from database', async () => {
      // Arrange - use recent dates
      const now = new Date();
      const recentDate1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
      const recentDate2 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ago
      const recentDate3 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(); // 21 days ago
      const recentDate4 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(); // 28 days ago
      
      const customers = [
        'test_customer_batch_001',
        'test_customer_batch_002',
        'test_customer_batch_003',
      ];

      for (const customerId of customers) {
        const sentimentHistory = [
          { date: recentDate4, score: 0.7, confidence: 0.9 },
          { date: recentDate3, score: 0.65, confidence: 0.85 },
          { date: recentDate2, score: 0.6, confidence: 0.88 },
          { date: recentDate1, score: 0.55, confidence: 0.87 },
        ];
        insertTestSentimentData(customerId, sentimentHistory);
      }

      // Act
      const result = await predictionService.processBatchPredictions();

      // Assert
      expect(result.processed).toBeGreaterThanOrEqual(3);
      expect(result.successful).toBeGreaterThan(0);
      expect(result.failed).toBeDefined();
    });
  });

  describe('Database Persistence', () => {
    test('should persist prediction results correctly', async () => {
      // Arrange
      const customerId = 'test_customer_persist_001';
      const mockPrediction = {
        customerId,
        predictions: [
          {
            daysAhead: 30,
            predictedSentiment: 65,
            confidenceLower: 55,
            confidenceUpper: 75,
            predictedDate: '2024-02-15',
          },
          {
            daysAhead: 60,
            predictedSentiment: 60,
            confidenceLower: 45,
            confidenceUpper: 75,
            predictedDate: '2024-03-15',
          },
        ],
        trajectory: {
          classification: 'declining' as const,
          severity: 'high' as const,
        },
        trend: {
          slope: -5,
          intercept: 80,
          rSquared: 0.92,
        },
      };

      // Act
      await predictionService.savePrediction(mockPrediction);
      const saved = await predictionService.getSavedPredictions(customerId);

      // Assert
      expect(saved).toHaveLength(2);
      expect(saved[0].predictedSentiment).toBe(65);
      expect(saved[1].predictedSentiment).toBe(60);
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      const invalidCustomerId = null as any;

      // Act
      const result = await predictionService.generatePredictions(invalidCustomerId);

      // Assert - service returns error object instead of throwing
      expect(result.error).toBeDefined();
      expect(result.customerId).toBe(null);
      expect(result.predictions).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    test('should process large customer datasets efficiently', async () => {
      // Arrange - use recent dates
      const now = new Date();
      const recentDate1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
      const recentDate2 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ago
      const recentDate3 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(); // 21 days ago
      const recentDate4 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(); // 28 days ago
      
      const startTime = Date.now();
      const customerCount = 50;
      
      for (let i = 0; i < customerCount; i++) {
        const customerId = `test_customer_perf_${i.toString().padStart(3, '0')}`;
        const sentimentHistory = [
          { date: recentDate4, score: 0.8 - (i * 0.01), confidence: 0.9 },
          { date: recentDate3, score: 0.75 - (i * 0.01), confidence: 0.85 },
          { date: recentDate2, score: 0.7 - (i * 0.01), confidence: 0.88 },
          { date: recentDate1, score: 0.65 - (i * 0.01), confidence: 0.87 },
        ];
        insertTestSentimentData(customerId, sentimentHistory);
      }

      // Act
      const result = await predictionService.processBatchPredictions();
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(result.processed).toBeGreaterThanOrEqual(customerCount);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.successful).toBeGreaterThan(customerCount * 0.8); // At least 80% success rate
    });
  });
});