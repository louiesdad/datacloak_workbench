import { TrendCalculator } from '../trend-calculator.service';

describe('Trend Calculator', () => {
  let trendCalculator: TrendCalculator;

  beforeEach(() => {
    trendCalculator = new TrendCalculator();
  });

  describe('Linear Regression', () => {
    test('should calculate linear regression on sentiment data', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 75, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 70, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 65, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 60, customerId: 'cust-1' }
      ];

      // Act
      const result = trendCalculator.calculateLinearTrend(sentimentHistory);

      // Assert
      expect(result).toBeDefined();
      expect(result.slope).toBeCloseTo(-5, 1); // Declining 5% per week
      expect(result.intercept).toBeDefined();
      expect(result.rSquared).toBeGreaterThan(0.9); // Strong correlation
    });

    test('should handle insufficient data gracefully', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' }
      ];

      // Act
      const result = trendCalculator.calculateLinearTrend(sentimentHistory);

      // Assert
      expect(result).toBeNull();
    });

    test('should handle non-linear data with lower R-squared', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 60, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 85, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 55, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 75, customerId: 'cust-1' }
      ];

      // Act
      const result = trendCalculator.calculateLinearTrend(sentimentHistory);

      // Assert
      expect(result).toBeDefined();
      expect(result.rSquared).toBeLessThan(0.5); // Weak correlation
    });
  });

  describe('Confidence Intervals', () => {
    test('should provide confidence intervals', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 76, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 72, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 68, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 64, customerId: 'cust-1' },
        { date: new Date('2024-02-05'), sentiment: 60, customerId: 'cust-1' }
      ];

      // Act
      const prediction = trendCalculator.predictWithConfidence(
        sentimentHistory,
        new Date('2024-03-01')
      );

      // Assert
      expect(prediction).toBeDefined();
      expect(prediction.predicted).toBeDefined();
      expect(prediction.confidence).toBeDefined();
      expect(prediction.confidence.lower).toBeLessThan(prediction.predicted);
      expect(prediction.confidence.upper).toBeGreaterThan(prediction.predicted);
      expect(prediction.confidence.level).toBe(0.95); // 95% confidence
    });

    test('should have wider intervals for predictions further in future', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 75, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 70, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 65, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 60, customerId: 'cust-1' }
      ];

      // Act
      const nearPrediction = trendCalculator.predictWithConfidence(
        sentimentHistory,
        new Date('2024-02-05') // 1 week out
      );
      const farPrediction = trendCalculator.predictWithConfidence(
        sentimentHistory,
        new Date('2024-03-01') // 1 month out
      );

      // Assert
      const nearInterval = nearPrediction.confidence.upper - nearPrediction.confidence.lower;
      const farInterval = farPrediction.confidence.upper - farPrediction.confidence.lower;
      expect(farInterval).toBeGreaterThan(nearInterval);
    });

    test('should return null confidence for insufficient data', () => {
      // Arrange
      const sentimentHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 75, customerId: 'cust-1' }
      ];

      // Act
      const prediction = trendCalculator.predictWithConfidence(
        sentimentHistory,
        new Date('2024-02-01')
      );

      // Assert
      expect(prediction).toBeNull();
    });
  });

  describe('Trajectory Classification', () => {
    test('should classify trajectories correctly', () => {
      // Test declining trajectory
      const decliningHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 70, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 60, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 50, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 40, customerId: 'cust-1' }
      ];

      const decliningResult = trendCalculator.classifyTrajectory(decliningHistory);
      expect(decliningResult.classification).toBe('declining');
      expect(decliningResult.severity).toBe('high');

      // Test stable trajectory
      const stableHistory = [
        { date: new Date('2024-01-01'), sentiment: 70, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 72, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 69, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 71, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 70, customerId: 'cust-1' }
      ];

      const stableResult = trendCalculator.classifyTrajectory(stableHistory);
      expect(stableResult.classification).toBe('stable');
      expect(stableResult.severity).toBe('low');

      // Test improving trajectory
      const improvingHistory = [
        { date: new Date('2024-01-01'), sentiment: 40, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 50, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 60, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 70, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 80, customerId: 'cust-1' }
      ];

      const improvingResult = trendCalculator.classifyTrajectory(improvingHistory);
      expect(improvingResult.classification).toBe('improving');
      expect(improvingResult.severity).toBe('positive');
    });

    test('should detect volatile patterns', () => {
      // Arrange
      const volatileHistory = [
        { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 30, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 85, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 25, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 90, customerId: 'cust-1' }
      ];

      // Act
      const result = trendCalculator.classifyTrajectory(volatileHistory);

      // Assert
      expect(result.classification).toBe('volatile');
      expect(result.severity).toBe('medium');
      expect(result.volatility).toBeGreaterThan(0.4);
    });

    test('should identify high-risk customers', () => {
      // Arrange
      const riskHistory = [
        { date: new Date('2024-01-01'), sentiment: 65, customerId: 'cust-1' },
        { date: new Date('2024-01-08'), sentiment: 58, customerId: 'cust-1' },
        { date: new Date('2024-01-15'), sentiment: 51, customerId: 'cust-1' },
        { date: new Date('2024-01-22'), sentiment: 44, customerId: 'cust-1' },
        { date: new Date('2024-01-29'), sentiment: 37, customerId: 'cust-1' }
      ];

      // Act
      const riskAssessment = trendCalculator.assessRisk(riskHistory, 30);

      // Assert
      expect(riskAssessment.isHighRisk).toBe(true);
      expect(riskAssessment.predictedDropBelowThreshold).toBe(true);
      expect(riskAssessment.daysUntilThreshold).toBeLessThan(30);
      expect(riskAssessment.currentSentiment).toBe(37);
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple customers in batch', async () => {
      // Arrange
      const batchData = [
        {
          customerId: 'cust-1',
          history: [
            { date: new Date('2024-01-01'), sentiment: 80, customerId: 'cust-1' },
            { date: new Date('2024-01-08'), sentiment: 75, customerId: 'cust-1' },
            { date: new Date('2024-01-15'), sentiment: 70, customerId: 'cust-1' }
          ]
        },
        {
          customerId: 'cust-2',
          history: [
            { date: new Date('2024-01-01'), sentiment: 60, customerId: 'cust-2' },
            { date: new Date('2024-01-08'), sentiment: 65, customerId: 'cust-2' },
            { date: new Date('2024-01-15'), sentiment: 70, customerId: 'cust-2' }
          ]
        }
      ];

      // Act
      const results = await trendCalculator.processBatch(batchData);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].customerId).toBe('cust-1');
      expect(results[0].trajectory.classification).toBe('declining');
      expect(results[1].customerId).toBe('cust-2');
      expect(results[1].trajectory.classification).toBe('improving');
    });
  });
});