import { PowerAnalysisService } from '../power-analysis.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('PowerAnalysisService', () => {
  let powerAnalysis: PowerAnalysisService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    } as any;
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    powerAnalysis = new PowerAnalysisService();
  });

  describe('Statistical Power Calculation', () => {
    test('should calculate statistical power for given effect size and sample size', async () => {
      // RED: This test should fail - PowerAnalysisService doesn't exist yet
      const powerResult = await powerAnalysis.calculateStatisticalPower({
        effectSize: 0.5, // Medium effect
        sampleSize: 100,
        alpha: 0.05,
        testType: 't_test_two_sample'
      });

      expect(powerResult.power).toBeGreaterThan(0.8); // Adequate power
      expect(powerResult.alpha).toBe(0.05);
      expect(powerResult.beta).toBe(1 - powerResult.power);
      expect(powerResult.effectSize).toBe(0.5);
      expect(powerResult.sampleSize).toBe(100);
      expect(powerResult.testType).toBe('t_test_two_sample');
      expect(powerResult.powerCategory).toBe('adequate'); // > 0.8
    });

    test('should calculate power for different test types', async () => {
      // RED: This test should fail - different test types not implemented
      const testTypes = ['t_test_one_sample', 't_test_two_sample', 'chi_square', 'anova', 'correlation'];
      
      for (const testType of testTypes) {
        const powerResult = await powerAnalysis.calculateStatisticalPower({
          effectSize: 0.3,
          sampleSize: 200,
          alpha: 0.05,
          testType
        });

        expect(powerResult.testType).toBe(testType);
        expect(powerResult.power).toBeGreaterThan(0);
        expect(powerResult.power).toBeLessThanOrEqual(1);
        expect(powerResult.powerCurve).toBeDefined();
        expect(powerResult.criticalValue).toBeDefined();
      }
    });

    test('should calculate power for different alpha levels', async () => {
      // RED: This test should fail - alpha level handling not implemented
      const alphaLevels = [0.01, 0.05, 0.10];
      const powers: number[] = [];
      
      for (const alpha of alphaLevels) {
        const powerResult = await powerAnalysis.calculateStatisticalPower({
          effectSize: 0.4,
          sampleSize: 80,
          alpha,
          testType: 't_test_two_sample'
        });

        powers.push(powerResult.power);
        expect(powerResult.alpha).toBe(alpha);
        expect(powerResult.typeIErrorRate).toBe(alpha);
      }

      // Power should increase as alpha increases (less stringent)
      expect(powers[0]).toBeLessThan(powers[1]); // 0.01 < 0.05
      expect(powers[1]).toBeLessThan(powers[2]); // 0.05 < 0.10
    });

    test('should handle different effect size magnitudes', async () => {
      // RED: This test should fail - effect size categorization not implemented
      const effectSizes = [
        { size: 0.1, category: 'small' },
        { size: 0.3, category: 'small' },
        { size: 0.5, category: 'medium' },
        { size: 0.8, category: 'large' },
        { size: 1.2, category: 'very_large' }
      ];

      for (const { size, category } of effectSizes) {
        const powerResult = await powerAnalysis.calculateStatisticalPower({
          effectSize: size,
          sampleSize: 100,
          alpha: 0.05,
          testType: 't_test_two_sample'
        });

        expect(powerResult.effectSizeCategory).toBe(category);
        expect(powerResult.effectSize).toBe(size);
      }
    });
  });

  describe('Sample Size Determination', () => {
    test('should calculate required sample size for desired power', async () => {
      // RED: This test should fail - sample size calculation not implemented
      const sampleSizeResult = await powerAnalysis.calculateRequiredSampleSize({
        effectSize: 0.5,
        desiredPower: 0.8,
        alpha: 0.05,
        testType: 't_test_two_sample'
      });

      expect(sampleSizeResult.requiredSampleSize).toBeGreaterThan(0);
      expect(sampleSizeResult.actualPower).toBeGreaterThanOrEqual(0.8);
      expect(sampleSizeResult.effectSize).toBe(0.5);
      expect(sampleSizeResult.alpha).toBe(0.05);
      expect(sampleSizeResult.costAnalysis).toBeDefined();
      expect(sampleSizeResult.feasibilityAssessment).toBeDefined();
    });

    test('should calculate sample size for different power requirements', async () => {
      // RED: This test should fail - power level handling not implemented
      const powerLevels = [0.7, 0.8, 0.9, 0.95];
      const sampleSizes: number[] = [];

      for (const power of powerLevels) {
        const result = await powerAnalysis.calculateRequiredSampleSize({
          effectSize: 0.4,
          desiredPower: power,
          alpha: 0.05,
          testType: 't_test_two_sample'
        });

        sampleSizes.push(result.requiredSampleSize);
        expect(result.actualPower).toBeGreaterThanOrEqual(power);
        expect(result.powerCategory).toBeDefined();
      }

      // Sample size should increase with higher power requirements
      for (let i = 1; i < sampleSizes.length; i++) {
        expect(sampleSizes[i]).toBeGreaterThan(sampleSizes[i - 1]);
      }
    });

    test('should provide cost-benefit analysis for sample sizes', async () => {
      // RED: This test should fail - cost analysis not implemented
      const result = await powerAnalysis.calculateRequiredSampleSize({
        effectSize: 0.3,
        desiredPower: 0.8,
        alpha: 0.05,
        testType: 't_test_two_sample',
        costPerSample: 10.50,
        maxBudget: 5000
      });

      expect(result.costAnalysis.totalCost).toBeDefined();
      expect(result.costAnalysis.costPerSample).toBe(10.50);
      expect(result.costAnalysis.isWithinBudget).toBeDefined();
      expect(result.costAnalysis.budgetUtilization).toBeDefined();
      expect(result.costAnalysis.costEfficiencyRatio).toBeDefined();
    });

    test('should assess feasibility of required sample size', async () => {
      // RED: This test should fail - feasibility assessment not implemented
      const result = await powerAnalysis.calculateRequiredSampleSize({
        effectSize: 0.2, // Small effect requires large sample
        desiredPower: 0.9,
        alpha: 0.01,
        testType: 't_test_two_sample',
        availablePopulation: 1000,
        recruitmentRate: 50 // per week
      });

      expect(result.feasibilityAssessment.isRecruitmentFeasible).toBeDefined();
      expect(result.feasibilityAssessment.estimatedRecruitmentTime).toBeDefined();
      expect(result.feasibilityAssessment.populationCoverage).toBeDefined();
      expect(result.feasibilityAssessment.recruitmentChallenges).toBeDefined();
      expect(result.feasibilityAssessment.recommendedApproach).toBeDefined();
    });
  });

  describe('Power Curve Analysis', () => {
    test('should generate power curves for effect size variation', async () => {
      // RED: This test should fail - power curve generation not implemented
      const powerCurve = await powerAnalysis.generatePowerCurve({
        variable: 'effect_size',
        range: { min: 0.1, max: 1.0, step: 0.1 },
        fixedParameters: {
          sampleSize: 100,
          alpha: 0.05,
          testType: 't_test_two_sample'
        }
      });

      expect(powerCurve.variable).toBe('effect_size');
      expect(powerCurve.dataPoints).toHaveLength(10); // (1.0 - 0.1) / 0.1 + 1
      expect(powerCurve.dataPoints[0].x).toBe(0.1);
      expect(powerCurve.dataPoints[9].x).toBe(1.0);
      
      // Power should increase with effect size
      for (let i = 1; i < powerCurve.dataPoints.length; i++) {
        expect(powerCurve.dataPoints[i].power).toBeGreaterThanOrEqual(powerCurve.dataPoints[i - 1].power);
      }

      expect(powerCurve.recommendations).toBeDefined();
      expect(powerCurve.optimalPoint).toBeDefined();
    });

    test('should generate power curves for sample size variation', async () => {
      // RED: This test should fail - sample size power curves not implemented
      const powerCurve = await powerAnalysis.generatePowerCurve({
        variable: 'sample_size',
        range: { min: 20, max: 200, step: 20 },
        fixedParameters: {
          effectSize: 0.5,
          alpha: 0.05,
          testType: 't_test_two_sample'
        }
      });

      expect(powerCurve.variable).toBe('sample_size');
      expect(powerCurve.dataPoints).toHaveLength(10);
      
      // Power should increase with sample size
      for (let i = 1; i < powerCurve.dataPoints.length; i++) {
        expect(powerCurve.dataPoints[i].power).toBeGreaterThanOrEqual(powerCurve.dataPoints[i - 1].power);
      }

      expect(powerCurve.asymptoteAnalysis).toBeDefined();
      expect(powerCurve.diminishingReturnsPoint).toBeDefined();
    });

    test('should perform sensitivity analysis', async () => {
      // RED: This test should fail - sensitivity analysis not implemented
      const sensitivity = await powerAnalysis.performSensitivityAnalysis({
        baseParameters: {
          effectSize: 0.5,
          sampleSize: 100,
          alpha: 0.05,
          testType: 't_test_two_sample'
        },
        variationPercentage: 10 // ±10% variation
      });

      expect(sensitivity.baselinePower).toBeDefined();
      expect(sensitivity.parameterSensitivities).toHaveProperty('effectSize');
      expect(sensitivity.parameterSensitivities).toHaveProperty('sampleSize');
      expect(sensitivity.parameterSensitivities).toHaveProperty('alpha');
      
      expect(sensitivity.mostSensitiveParameter).toBeDefined();
      expect(sensitivity.leastSensitiveParameter).toBeDefined();
      expect(sensitivity.robustnessScore).toBeGreaterThan(0);
      expect(sensitivity.robustnessScore).toBeLessThanOrEqual(1);
    });
  });

  describe('A/B Testing Power Analysis', () => {
    test('should analyze power for A/B testing scenarios', async () => {
      // RED: This test should fail - A/B testing analysis not implemented
      const mockTestData = [
        { group: 'control', conversion_rate: 0.10, sample_size: 1000 },
        { group: 'treatment', conversion_rate: 0.12, sample_size: 1000 }
      ];

      mockDb.all.mockResolvedValue(mockTestData);

      const abTestPower = await powerAnalysis.analyzeABTestPower('TEST-001', {
        metric: 'conversion_rate',
        baselineValue: 0.10,
        minimumDetectableEffect: 0.02, // 2 percentage points
        alpha: 0.05,
        testDuration: '2_weeks'
      });

      expect(abTestPower.currentPower).toBeDefined();
      expect(abTestPower.detectedEffect).toBeCloseTo(0.02, 2);
      expect(abTestPower.isSignificant).toBeDefined();
      expect(abTestPower.recommendedSampleSize).toBeDefined();
      expect(abTestPower.timeToSignificance).toBeDefined();
      expect(abTestPower.earlyStoppingAnalysis).toBeDefined();
    });

    test('should calculate sequential testing power', async () => {
      // RED: This test should fail - sequential testing not implemented
      const sequentialPower = await powerAnalysis.calculateSequentialTestingPower({
        effectSize: 0.3,
        alpha: 0.05,
        beta: 0.2,
        maxSampleSize: 1000,
        lookFrequency: 'weekly',
        boundaryType: 'obrien_fleming'
      });

      expect(sequentialPower.overallPower).toBeDefined();
      expect(sequentialPower.expectedSampleSize).toBeLessThanOrEqual(1000);
      expect(sequentialPower.stoppingBoundaries).toBeDefined();
      expect(sequentialPower.alphaSpending).toBeDefined();
      expect(sequentialPower.futilityBoundaries).toBeDefined();
      expect(sequentialPower.expectedDuration).toBeDefined();
    });

    test('should optimize A/B test parameters', async () => {
      // RED: This test should fail - parameter optimization not implemented
      const optimization = await powerAnalysis.optimizeABTestParameters({
        constraints: {
          maxSampleSize: 5000,
          maxDuration: '4_weeks',
          maxCostPerUser: 2.50,
          minPower: 0.8
        },
        objectives: {
          primary: 'minimize_cost',
          secondary: 'minimize_duration'
        },
        effectSizeRange: { min: 0.01, max: 0.05 }
      });

      expect(optimization.optimalParameters).toBeDefined();
      expect(optimization.optimalParameters.sampleSize).toBeLessThanOrEqual(5000);
      expect(optimization.optimalParameters.power).toBeGreaterThanOrEqual(0.8);
      expect(optimization.tradeoffAnalysis).toBeDefined();
      expect(optimization.sensitivityToConstraints).toBeDefined();
      expect(optimization.recommendedApproach).toBeDefined();
    });
  });

  describe('Event Impact Power Analysis', () => {
    test('should analyze power for detecting event impacts', async () => {
      // RED: This test should fail - event impact power analysis not implemented
      const mockEventData = [
        { customer_id: 'CUST-001', pre_event_score: 0.8, post_event_score: 0.6, time_window: 'week_1' },
        { customer_id: 'CUST-002', pre_event_score: 0.7, post_event_score: 0.5, time_window: 'week_1' },
        { customer_id: 'CUST-003', pre_event_score: 0.9, post_event_score: 0.7, time_window: 'week_1' },
      ];

      mockDb.all.mockResolvedValue(mockEventData);

      const eventPower = await powerAnalysis.analyzeEventImpactPower('EVENT-001', {
        preEventWindow: '2_weeks',
        postEventWindow: '2_weeks',
        minimumDetectableChange: 0.1,
        alpha: 0.05,
        metric: 'sentiment_score'
      });

      expect(eventPower.observedPower).toBeDefined();
      expect(eventPower.detectedEffectSize).toBeDefined();
      expect(eventPower.isDetectable).toBeDefined();
      expect(eventPower.requiredSampleSizeForDetection).toBeDefined();
      expect(eventPower.timeWindowOptimization).toBeDefined();
      expect(eventPower.powerByTimeWindow).toBeDefined();
    });

    test('should perform retrospective power analysis', async () => {
      // RED: This test should fail - retrospective analysis not implemented
      const mockRetrospectiveData = [
        { analysis_id: 'ANALYSIS-001', effect_size: 0.45, sample_size: 150, p_value: 0.03, significant: true },
        { analysis_id: 'ANALYSIS-002', effect_size: 0.25, sample_size: 80, p_value: 0.12, significant: false },
        { analysis_id: 'ANALYSIS-003', effect_size: 0.65, sample_size: 200, p_value: 0.001, significant: true },
      ];

      mockDb.all.mockResolvedValue(mockRetrospectiveData);

      const retrospective = await powerAnalysis.performRetrospectivePowerAnalysis('EVENT-001', {
        includeNonSignificantResults: true,
        adjustForMultipleComparisons: true,
        correctionMethod: 'bonferroni'
      });

      expect(retrospective.analyses).toHaveLength(3);
      expect(retrospective.averagePower).toBeDefined();
      expect(retrospective.powerDistribution).toBeDefined();
      expect(retrospective.falseNegativeRate).toBeDefined();
      expect(retrospective.recommendedImprovements).toBeDefined();
      expect(retrospective.multipleComparisonAdjustment).toBeDefined();
    });
  });

  describe('Power Analysis Reporting', () => {
    test('should generate comprehensive power analysis report', async () => {
      // RED: This test should fail - reporting not implemented
      const report = await powerAnalysis.generatePowerAnalysisReport('EVENT-001', {
        includeVisualizations: true,
        reportFormat: 'detailed',
        comparisonBenchmarks: ['industry_standard', 'regulatory_requirement']
      });

      expect(report.summary).toBeDefined();
      expect(report.summary.overallPowerAssessment).toBeDefined();
      expect(report.summary.keyFindings).toBeDefined();
      expect(report.summary.recommendations).toBeDefined();

      expect(report.sections).toHaveProperty('statistical_power');
      expect(report.sections).toHaveProperty('sample_size_analysis');
      expect(report.sections).toHaveProperty('power_curves');
      expect(report.sections).toHaveProperty('sensitivity_analysis');

      expect(report.visualizations).toBeDefined();
      expect(report.benchmarkComparisons).toBeDefined();
      expect(report.methodologyNotes).toBeDefined();
    });

    test('should export power analysis results to different formats', async () => {
      // RED: This test should fail - export functionality not implemented
      const exportFormats = ['json', 'csv', 'pdf_summary'];

      for (const format of exportFormats) {
        const exportResult = await powerAnalysis.exportPowerAnalysis('EVENT-001', {
          format,
          includeRawData: true,
          includeVisualizations: format === 'pdf_summary'
        });

        expect(exportResult.format).toBe(format);
        expect(exportResult.data).toBeDefined();
        expect(exportResult.metadata).toBeDefined();
        expect(exportResult.exportTimestamp).toBeDefined();
        
        if (format === 'csv') {
          expect(exportResult.data).toContain('effect_size,sample_size,power');
        }
      }
    });
  });

  describe('Integration with Event System', () => {
    test('should integrate with business event classification', async () => {
      // RED: This test should fail - event integration not implemented
      const mockEvent = {
        id: 'EVENT-001',
        type: 'product_launch',
        classification: 'major_impact',
        affected_customers: 500,
        historical_similar_events: ['EVENT-045', 'EVENT-067']
      };

      mockDb.get.mockResolvedValue(mockEvent);

      const integration = await powerAnalysis.integratePowerAnalysisWithEvent('EVENT-001', {
        useHistoricalEffectSizes: true,
        adaptSampleSizeToEventType: true,
        considerCustomerSegmentation: true
      });

      expect(integration.eventContext).toBeDefined();
      expect(integration.historicalEffectSizeEstimate).toBeDefined();
      expect(integration.adjustedPowerParameters).toBeDefined();
      expect(integration.segmentedAnalysis).toBeDefined();
      expect(integration.eventTypeSpecificRecommendations).toBeDefined();
    });

    test('should provide real-time power monitoring', async () => {
      // RED: This test should fail - real-time monitoring not implemented
      const mockRealTimeData = [
        { timestamp: '2024-01-01T10:00:00Z', cumulative_effect: 0.15, sample_size: 50 },
        { timestamp: '2024-01-01T11:00:00Z', cumulative_effect: 0.22, sample_size: 75 },
        { timestamp: '2024-01-01T12:00:00Z', cumulative_effect: 0.28, sample_size: 100 },
      ];

      mockDb.all.mockResolvedValue(mockRealTimeData);

      const monitoring = await powerAnalysis.monitorRealTimePower('EVENT-001', {
        updateFrequency: 'hourly',
        alertThresholds: {
          lowPower: 0.6,
          adequatePower: 0.8,
          overpowered: 0.95
        }
      });

      expect(monitoring.currentPower).toBeDefined();
      expect(monitoring.powerTrend).toBeDefined();
      expect(monitoring.alerts).toBeDefined();
      expect(monitoring.projectedFinalPower).toBeDefined();
      expect(monitoring.recommendedActions).toBeDefined();
      expect(monitoring.stopRecommendation).toBeDefined();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});