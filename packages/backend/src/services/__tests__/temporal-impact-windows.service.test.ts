import { TemporalImpactWindowsService } from '../temporal-impact-windows.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('TemporalImpactWindowsService', () => {
  let temporalAnalysis: TemporalImpactWindowsService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    } as any;
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    temporalAnalysis = new TemporalImpactWindowsService();
  });

  describe('Sliding Window Analysis', () => {
    test('should create sliding windows for impact analysis', async () => {
      // RED: This test should fail - TemporalImpactWindowsService doesn't exist yet
      const mockTimeSeriesData = [
        { timestamp: '2024-01-01T00:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.8 },
        { timestamp: '2024-01-01T01:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.7 },
        { timestamp: '2024-01-01T02:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.6 },
        { timestamp: '2024-01-01T03:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.5 },
        { timestamp: '2024-01-01T04:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.4 },
        { timestamp: '2024-01-01T05:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.6 },
        { timestamp: '2024-01-01T06:00:00Z', customer_id: 'CUST-001', sentiment_score: 0.7 },
      ];

      mockDb.all.mockResolvedValue(mockTimeSeriesData);

      const eventId = 'EVENT-001';
      const eventTime = new Date('2024-01-01T03:00:00Z');
      
      const windows = await temporalAnalysis.createSlidingWindows(eventId, {
        eventTimestamp: eventTime,
        windowSizes: ['1h', '2h', '3h'],
        overlapRatio: 0.5,
        fields: ['sentiment_score']
      });

      expect(windows).toHaveProperty('preEventWindows');
      expect(windows).toHaveProperty('postEventWindows');
      expect(windows.preEventWindows['1h']).toBeDefined();
      expect(windows.preEventWindows['2h']).toBeDefined();
      expect(windows.preEventWindows['3h']).toBeDefined();
      expect(windows.postEventWindows['1h']).toBeDefined();
      expect(windows.postEventWindows['2h']).toBeDefined();
      expect(windows.postEventWindows['3h']).toBeDefined();
    });

    test('should calculate window statistics for each time period', async () => {
      // RED: This test should fail - window statistics not implemented
      const mockWindowData = [
        { timestamp: '2024-01-01T00:00:00Z', sentiment_score: 0.8, engagement_score: 0.9 },
        { timestamp: '2024-01-01T01:00:00Z', sentiment_score: 0.7, engagement_score: 0.8 },
        { timestamp: '2024-01-01T02:00:00Z', sentiment_score: 0.6, engagement_score: 0.7 },
        { timestamp: '2024-01-01T03:00:00Z', sentiment_score: 0.5, engagement_score: 0.6 },
      ];

      mockDb.all.mockResolvedValue(mockWindowData);

      const windowStats = await temporalAnalysis.calculateWindowStatistics(mockWindowData, {
        fields: ['sentiment_score', 'engagement_score'],
        aggregations: ['mean', 'std', 'min', 'max', 'trend']
      });

      expect(windowStats.sentiment_score).toHaveProperty('mean');
      expect(windowStats.sentiment_score).toHaveProperty('std');
      expect(windowStats.sentiment_score).toHaveProperty('min');
      expect(windowStats.sentiment_score).toHaveProperty('max');
      expect(windowStats.sentiment_score).toHaveProperty('trend');
      expect(windowStats.sentiment_score.mean).toBeCloseTo(0.65, 2);
      expect(windowStats.sentiment_score.trend).toBe('decreasing');
    });

    test('should detect optimal window sizes based on data patterns', async () => {
      // RED: This test should fail - optimal window detection not implemented
      const mockPatternData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(), // 1 minute intervals
        sentiment_score: 0.5 + 0.3 * Math.sin(i * 0.1) + 0.1 * Math.random(), // Periodic pattern
        customer_id: `CUST-${Math.floor(i / 10) + 1}`
      }));

      mockDb.all.mockResolvedValue(mockPatternData);

      const optimalWindows = await temporalAnalysis.detectOptimalWindowSizes('EVENT-001', {
        field: 'sentiment_score',
        candidateWindows: ['5m', '15m', '30m', '1h', '2h'],
        optimizationCriteria: 'signal_to_noise_ratio'
      });

      expect(optimalWindows.recommendedWindow).toBeDefined();
      expect(optimalWindows.windowScores).toBeDefined();
      expect(optimalWindows.windowScores['5m']).toBeDefined();
      expect(optimalWindows.windowScores['15m']).toBeDefined();
      expect(optimalWindows.optimizationMetric).toBe('signal_to_noise_ratio');
      expect(optimalWindows.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Temporal Pattern Detection', () => {
    test('should identify periodic patterns in time series data', async () => {
      // RED: This test should fail - pattern detection not implemented
      const mockPeriodicData = Array.from({ length: 48 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 3600000).toISOString(), // Hourly data
        sentiment_score: 0.5 + 0.3 * Math.sin(2 * Math.PI * i / 24), // Daily cycle
        customer_id: 'CUST-001'
      }));

      mockDb.all.mockResolvedValue(mockPeriodicData);

      const patterns = await temporalAnalysis.detectPeriodicPatterns('EVENT-001', {
        field: 'sentiment_score',
        analysisWindow: '48h',
        candidatePeriods: ['1h', '6h', '12h', '24h'],
        significanceThreshold: 0.05
      });

      expect(patterns.detectedPeriods).toContain('24h');
      expect(patterns.periodicityStrength['24h']).toBeGreaterThan(0.7);
      expect(patterns.dominantFrequency).toBe('24h');
      expect(patterns.spectralDensity).toBeDefined();
      expect(patterns.autocorrelationFunction).toBeDefined();
    });

    test('should detect seasonal trends and cycles', async () => {
      // RED: This test should fail - seasonal detection not implemented
      const mockSeasonalData = Array.from({ length: 168 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 3600000).toISOString(), // Weekly data
        sentiment_score: 0.5 + 0.2 * Math.sin(2 * Math.PI * i / 168) + 0.1 * Math.sin(2 * Math.PI * i / 24),
        day_of_week: Math.floor(i / 24) % 7,
        hour_of_day: i % 24
      }));

      mockDb.all.mockResolvedValue(mockSeasonalData);

      const seasonality = await temporalAnalysis.detectSeasonalTrends('EVENT-001', {
        field: 'sentiment_score',
        seasonalComponents: ['hourly', 'daily', 'weekly'],
        decompositionMethod: 'additive'
      });

      expect(seasonality.components.trend).toBeDefined();
      expect(seasonality.components.seasonal).toBeDefined();
      expect(seasonality.components.residual).toBeDefined();
      expect(seasonality.seasonalStrengths.daily).toBeGreaterThan(0);
      expect(seasonality.seasonalStrengths.weekly).toBeGreaterThan(0);
      expect(['daily', 'weekly', 'hourly']).toContain(seasonality.dominantSeasonality);
    });

    test('should identify trend changes and breakpoints', async () => {
      // RED: This test should fail - breakpoint detection not implemented
      const mockTrendData = [
        ...Array.from({ length: 20 }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 3600000).toISOString(),
          sentiment_score: 0.8 - i * 0.01, // Declining trend
        })),
        ...Array.from({ length: 20 }, (_, i) => ({
          timestamp: new Date(Date.now() + (i + 20) * 3600000).toISOString(),
          sentiment_score: 0.6 + i * 0.015, // Rising trend
        }))
      ];

      mockDb.all.mockResolvedValue(mockTrendData);

      const breakpoints = await temporalAnalysis.detectTrendBreakpoints('EVENT-001', {
        field: 'sentiment_score',
        breakpointMethods: ['cusum', 'structural_change', 'pelt'],
        minSegmentLength: 5,
        penaltyValue: 'auto'
      });

      expect(breakpoints.changePoints).toHaveLength(1);
      expect(breakpoints.changePoints[0].location).toBeCloseTo(20, 2);
      expect(breakpoints.changePoints[0].confidence).toBeGreaterThan(0.8);
      expect(breakpoints.segments).toHaveLength(2);
      expect(breakpoints.segments[0].trend).toBe('decreasing');
      expect(breakpoints.segments[1].trend).toBe('increasing');
    });
  });

  describe('Window Comparison Analysis', () => {
    test('should compare metrics across different time windows', async () => {
      // RED: This test should fail - window comparison not implemented
      const mockBeforeData = [
        { timestamp: '2024-01-01T10:00:00Z', sentiment_score: 0.8, engagement: 0.9 },
        { timestamp: '2024-01-01T10:30:00Z', sentiment_score: 0.7, engagement: 0.8 },
        { timestamp: '2024-01-01T11:00:00Z', sentiment_score: 0.9, engagement: 0.85 },
      ];
      
      const mockAfterData = [
        { timestamp: '2024-01-01T13:00:00Z', sentiment_score: 0.3, engagement: 0.4 },
        { timestamp: '2024-01-01T13:30:00Z', sentiment_score: 0.4, engagement: 0.5 },
        { timestamp: '2024-01-01T14:00:00Z', sentiment_score: 0.2, engagement: 0.3 },
      ];

      mockDb.all
        .mockResolvedValueOnce(mockBeforeData)
        .mockResolvedValueOnce(mockAfterData);

      const comparison = await temporalAnalysis.compareTimeWindows('EVENT-001', {
        beforeWindow: {
          start: new Date('2024-01-01T10:00:00Z'),
          end: new Date('2024-01-01T12:00:00Z')
        },
        afterWindow: {
          start: new Date('2024-01-01T13:00:00Z'),
          end: new Date('2024-01-01T15:00:00Z')
        },
        fields: ['sentiment_score', 'engagement'],
        comparisonTests: ['t_test', 'mann_whitney', 'effect_size']
      });

      expect(comparison.fieldComparisons.sentiment_score).toBeDefined();
      expect(comparison.fieldComparisons.sentiment_score.meanDifference).toBeLessThan(0);
      expect(comparison.fieldComparisons.sentiment_score.pValue).toBeLessThan(0.05);
      expect(comparison.fieldComparisons.sentiment_score.effectSize).toBeGreaterThan(1.0); // Large effect
      expect(comparison.overallSignificance).toBe(true);
      expect(comparison.impactMagnitude).toBe('strong');
    });

    test('should calculate rolling window correlations', async () => {
      // RED: This test should fail - rolling correlations not implemented
      const mockRollingData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        field_a: Math.sin(i * 0.1) + 0.1 * Math.random(),
        field_b: Math.sin(i * 0.1 + Math.PI/4) + 0.1 * Math.random(), // Phase shifted
      }));

      mockDb.all.mockResolvedValue(mockRollingData);

      const rollingCorr = await temporalAnalysis.calculateRollingCorrelations('EVENT-001', {
        fieldA: 'field_a',
        fieldB: 'field_b',
        windowSize: 20,
        stepSize: 5,
        correlationMethod: 'pearson'
      });

      expect(rollingCorr.correlations).toHaveLength(17); // (100-20)/5 + 1
      expect(rollingCorr.timestamps).toHaveLength(17);
      expect(rollingCorr.correlations[0]).toBeGreaterThan(0.5); // Should be correlated
      expect(rollingCorr.meanCorrelation).toBeGreaterThan(0.5);
      expect(rollingCorr.correlationStability).toBeDefined();
    });

    test('should detect change point significance across windows', async () => {
      // RED: This test should fail - change point significance not implemented
      const mockChangeData = [
        ...Array.from({ length: 30 }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 3600000).toISOString(),
          sentiment_score: 0.8 + 0.05 * Math.random() // Stable high
        })),
        ...Array.from({ length: 30 }, (_, i) => ({
          timestamp: new Date(Date.now() + (i + 30) * 3600000).toISOString(),
          sentiment_score: 0.3 + 0.05 * Math.random() // Stable low
        }))
      ];

      mockDb.all.mockResolvedValue(mockChangeData);

      const changeSignificance = await temporalAnalysis.analyzeChangePointSignificance('EVENT-001', {
        field: 'sentiment_score',
        changePointTimestamp: new Date(Date.now() + 30 * 3600000),
        preChangeWindow: '30h',
        postChangeWindow: '30h',
        significanceTests: ['permutation', 'bootstrap', 'likelihood_ratio']
      });

      expect(changeSignificance.isSignificant).toBe(true);
      expect(changeSignificance.pValue).toBeLessThan(0.001);
      expect(changeSignificance.effectSize).toBeGreaterThan(2.0);
      expect(changeSignificance.confidenceLevel).toBeGreaterThan(0.99);
      expect(changeSignificance.testResults.permutation.pValue).toBeLessThan(0.05);
      expect(changeSignificance.testResults.bootstrap.pValue).toBeLessThan(0.05);
    });
  });

  describe('Temporal Aggregation', () => {
    test('should aggregate data across multiple temporal resolutions', async () => {
      // RED: This test should fail - temporal aggregation not implemented
      const mockHighResData = Array.from({ length: 1440 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(), // Minute-level data
        sentiment_score: 0.5 + 0.3 * Math.sin(i * 0.01) + 0.1 * Math.random(),
        volume: Math.floor(10 + 5 * Math.random())
      }));

      mockDb.all.mockResolvedValue(mockHighResData);

      const aggregations = await temporalAnalysis.aggregateTemporalData('EVENT-001', {
        field: 'sentiment_score',
        resolutions: ['5m', '15m', '1h', '4h'],
        aggregationMethods: ['mean', 'weighted_mean', 'median', 'percentile_95'],
        weightField: 'volume'
      });

      expect(aggregations['5m']).toBeDefined();
      expect(aggregations['15m']).toBeDefined();
      expect(aggregations['1h']).toBeDefined();
      expect(aggregations['4h']).toBeDefined();
      
      expect(aggregations['5m'].length).toBe(288); // 1440/5
      expect(aggregations['15m'].length).toBe(96); // 1440/15
      expect(aggregations['1h'].length).toBe(24); // 1440/60
      expect(aggregations['4h'].length).toBe(6); // 1440/240
      
      expect(aggregations['5m'][0]).toHaveProperty('mean');
      expect(aggregations['5m'][0]).toHaveProperty('weighted_mean');
      expect(aggregations['5m'][0]).toHaveProperty('median');
      expect(aggregations['5m'][0]).toHaveProperty('percentile_95');
    });

    test('should handle temporal data gaps and interpolation', async () => {
      // RED: This test should fail - gap handling not implemented
      const mockGappyData = [
        { timestamp: '2024-01-01T00:00:00Z', sentiment_score: 0.8 },
        { timestamp: '2024-01-01T01:00:00Z', sentiment_score: 0.7 },
        // 2-hour gap
        { timestamp: '2024-01-01T03:00:00Z', sentiment_score: 0.5 },
        { timestamp: '2024-01-01T04:00:00Z', sentiment_score: 0.6 },
        // 3-hour gap  
        { timestamp: '2024-01-01T07:00:00Z', sentiment_score: 0.4 },
      ];

      mockDb.all.mockResolvedValue(mockGappyData);

      const gapAnalysis = await temporalAnalysis.handleTemporalGaps('EVENT-001', {
        field: 'sentiment_score',
        expectedInterval: '1h',
        interpolationMethod: 'linear',
        maxGapSize: '4h',
        qualityMetrics: true
      });

      expect(gapAnalysis.detectedGaps).toHaveLength(2);
      expect(gapAnalysis.detectedGaps[0].duration).toBe('2h');
      expect(gapAnalysis.detectedGaps[1].duration).toBe('3h');
      expect(gapAnalysis.interpolatedValues).toBeDefined();
      expect(gapAnalysis.dataCompleteness).toBeLessThan(1.0);
      expect(gapAnalysis.interpolationQuality.meanSquaredError).toBeDefined();
    });

    test('should create temporal feature engineering', async () => {
      // RED: This test should fail - feature engineering not implemented
      const mockFeatureData = Array.from({ length: 168 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 3600000).toISOString(),
        sentiment_score: 0.5 + 0.3 * Math.sin(i * 0.1) + 0.1 * Math.random(),
        hour: i % 24,
        day_of_week: Math.floor(i / 24) % 7
      }));

      mockDb.all.mockResolvedValue(mockFeatureData);

      const features = await temporalAnalysis.generateTemporalFeatures('EVENT-001', {
        field: 'sentiment_score',
        featureTypes: ['lag', 'rolling_stats', 'seasonal', 'trend'],
        lagPeriods: [1, 2, 6, 24],
        rollingWindows: [3, 6, 12, 24],
        seasonalPeriods: [24, 168] // Daily and weekly
      });

      expect(features.lagFeatures).toHaveProperty('lag_1');
      expect(features.lagFeatures).toHaveProperty('lag_24');
      expect(features.rollingFeatures).toHaveProperty('rolling_mean_3');
      expect(features.rollingFeatures).toHaveProperty('rolling_std_24');
      expect(features.seasonalFeatures).toHaveProperty('hour_sin');
      expect(features.seasonalFeatures).toHaveProperty('hour_cos');
      expect(features.seasonalFeatures).toHaveProperty('day_of_week_sin');
      expect(features.trendFeatures).toHaveProperty('linear_trend');
      expect(features.trendFeatures).toHaveProperty('momentum');
    });
  });

  describe('Event Impact Timing', () => {
    test('should determine optimal pre and post-event window sizes', async () => {
      // RED: This test should fail - optimal timing not implemented
      const mockTimingData = [
        ...Array.from({ length: 72 }, (_, i) => ({
          timestamp: new Date(Date.now() - (72 - i) * 3600000).toISOString(), // 72h before
          sentiment_score: 0.8 - i * 0.001 // Slow decline
        })),
        ...Array.from({ length: 48 }, (_, i) => ({
          timestamp: new Date(Date.now() + i * 3600000).toISOString(), // 48h after
          sentiment_score: 0.2 + i * 0.01 // Recovery
        }))
      ];

      mockDb.all.mockResolvedValue(mockTimingData);

      const optimalTiming = await temporalAnalysis.determineOptimalEventWindows('EVENT-001', {
        eventTimestamp: new Date(),
        field: 'sentiment_score',
        maxPreEventWindow: '72h',
        maxPostEventWindow: '48h',
        optimizationCriteria: 'statistical_power',
        stationarityTests: true
      });

      expect(optimalTiming.preEventWindow).toBeDefined();
      expect(optimalTiming.postEventWindow).toBeDefined();
      expect(optimalTiming.preEventWindow.duration).toMatch(/\d+h/);
      expect(optimalTiming.postEventWindow.duration).toMatch(/\d+h/);
      expect(optimalTiming.statisticalPower).toBeGreaterThan(0.8);
      expect(optimalTiming.effectDetectability).toBeGreaterThan(0.7);
      expect(optimalTiming.stationarityResults).toBeDefined();
    });

    test('should calculate impact onset and recovery timing', async () => {
      // RED: This test should fail - onset/recovery timing not implemented
      const eventTime = new Date('2024-01-01T12:00:00Z');
      const mockRecoveryData = [
        ...Array.from({ length: 12 }, (_, i) => ({
          timestamp: new Date(eventTime.getTime() - (12 - i) * 3600000).toISOString(),
          sentiment_score: 0.8 // Baseline
        })),
        { timestamp: eventTime.toISOString(), sentiment_score: 0.3 }, // Immediate impact
        { timestamp: new Date(eventTime.getTime() + 1 * 3600000).toISOString(), sentiment_score: 0.35 },
        { timestamp: new Date(eventTime.getTime() + 2 * 3600000).toISOString(), sentiment_score: 0.4 },
        { timestamp: new Date(eventTime.getTime() + 6 * 3600000).toISOString(), sentiment_score: 0.6 },
        { timestamp: new Date(eventTime.getTime() + 12 * 3600000).toISOString(), sentiment_score: 0.75 },
        { timestamp: new Date(eventTime.getTime() + 24 * 3600000).toISOString(), sentiment_score: 0.8 }, // Recovery
      ];

      mockDb.all.mockResolvedValue(mockRecoveryData);

      const timing = await temporalAnalysis.calculateImpactTiming('EVENT-001', {
        eventTimestamp: eventTime,
        field: 'sentiment_score',
        baselineThreshold: 0.05, // 5% from baseline
        recoveryThreshold: 0.9, // 90% recovery
        smoothingWindow: 1
      });

      expect(timing.impactOnset).toBeDefined();
      expect(timing.impactOnset.delay).toBe('0h'); // Immediate
      expect(timing.recoveryTiming).toBeDefined();
      expect(timing.recoveryTiming.fullRecoveryTime).toBe('24h');
      expect(timing.impactDuration).toBe('24h');
      expect(timing.recoveryRate).toBeGreaterThan(0);
      expect(timing.impactSeverity).toBeGreaterThan(0.5);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});