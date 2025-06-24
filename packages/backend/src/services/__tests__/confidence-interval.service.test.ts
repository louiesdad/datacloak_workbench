import { ConfidenceIntervalService } from '../confidence-interval.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('ConfidenceIntervalService', () => {
  let confidenceInterval: ConfidenceIntervalService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    } as any;
    
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);
    confidenceInterval = new ConfidenceIntervalService();
  });

  describe('Basic Confidence Interval Calculation', () => {
    test('should calculate confidence interval for sample mean', async () => {
      // RED: This test should fail - ConfidenceIntervalService doesn't exist yet
      const mockData = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.6 }, { value: 0.75 },
        { value: 0.85 }, { value: 0.65 }, { value: 0.9 }, { value: 0.8 }, { value: 0.7 }
      ];

      const result = await confidenceInterval.calculateMeanConfidenceInterval(mockData, {
        confidenceLevel: 0.95,
        field: 'value'
      });

      expect(result.mean).toBeCloseTo(0.765, 2);
      expect(result.confidenceLevel).toBe(0.95);
      expect(result.lowerBound).toBeLessThan(result.mean);
      expect(result.upperBound).toBeGreaterThan(result.mean);
      expect(result.marginOfError).toBeGreaterThan(0);
      expect(result.standardError).toBeGreaterThan(0);
      expect(result.sampleSize).toBe(10);
      expect(result.interpretation).toBeDefined();
    });

    test('should calculate confidence intervals for different confidence levels', async () => {
      // RED: This test should fail - multiple confidence levels not implemented
      const mockData = Array.from({ length: 50 }, (_, i) => ({
        value: 0.5 + 0.3 * Math.sin(i * 0.1) + 0.1 * Math.random()
      }));

      const confidenceLevels = [0.90, 0.95, 0.99];
      const results = [];

      for (const level of confidenceLevels) {
        const result = await confidenceInterval.calculateMeanConfidenceInterval(mockData, {
          confidenceLevel: level,
          field: 'value'
        });
        results.push(result);
      }

      // Higher confidence levels should have wider intervals
      expect(results[0].marginOfError).toBeLessThan(results[1].marginOfError); // 90% < 95%
      expect(results[1].marginOfError).toBeLessThan(results[2].marginOfError); // 95% < 99%
      
      // All should have the same mean
      results.forEach(result => {
        expect(result.mean).toBeCloseTo(results[0].mean, 3);
      });
    });

    test('should handle small sample sizes with t-distribution', async () => {
      // RED: This test should fail - t-distribution handling not implemented
      const smallSample = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.6 }, { value: 0.75 }
      ];

      const result = await confidenceInterval.calculateMeanConfidenceInterval(smallSample, {
        confidenceLevel: 0.95,
        field: 'value',
        distributionType: 't_distribution'
      });

      expect(result.distributionUsed).toBe('t_distribution');
      expect(result.degreesOfFreedom).toBe(4);
      expect(result.criticalValue).toBeGreaterThan(1.96); // t-value should be larger than z-value
      expect(result.assumptions).toContain('Normal distribution');
      expect(result.assumptions).toContain('Independent observations');
    });

    test('should calculate confidence interval for proportions', async () => {
      // RED: This test should fail - proportion confidence intervals not implemented
      const mockProportionData = [
        { success: 1 }, { success: 0 }, { success: 1 }, { success: 1 }, { success: 0 },
        { success: 1 }, { success: 1 }, { success: 0 }, { success: 1 }, { success: 1 }
      ];

      const result = await confidenceInterval.calculateProportionConfidenceInterval(mockProportionData, {
        confidenceLevel: 0.95,
        successField: 'success',
        method: 'wilson'
      });

      expect(result.proportion).toBe(0.7); // 7 successes out of 10
      expect(result.lowerBound).toBeGreaterThan(0);
      expect(result.lowerBound).toBeLessThan(result.proportion);
      expect(result.upperBound).toBeLessThan(1);
      expect(result.upperBound).toBeGreaterThan(result.proportion);
      expect(result.method).toBe('wilson');
      expect(result.continuityCorrection).toBeDefined();
    });
  });

  describe('Difference Confidence Intervals', () => {
    test('should calculate confidence interval for difference in means', async () => {
      // RED: This test should fail - difference analysis not implemented
      const group1Data = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.75 }, { value: 0.85 }
      ];
      const group2Data = [
        { value: 0.6 }, { value: 0.5 }, { value: 0.7 }, { value: 0.55 }, { value: 0.65 }
      ];

      const result = await confidenceInterval.calculateDifferenceConfidenceInterval(
        group1Data, 
        group2Data, 
        {
          confidenceLevel: 0.95,
          field: 'value',
          testType: 'two_sample_t',
          assumeEqualVariances: false
        }
      );

      expect(result.difference).toBeGreaterThan(0); // Group 1 should have higher mean
      expect(result.group1Mean).toBeGreaterThan(result.group2Mean);
      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();
      expect(result.includesZero).toBe(false); // Significant difference
      expect(result.pooledVariance).toBeDefined();
      expect(result.separateVariances).toBe(true);
    });

    test('should calculate confidence interval for paired differences', async () => {
      // RED: This test should fail - paired analysis not implemented
      const pairedData = [
        { before: 0.6, after: 0.8, subject_id: 'S1' },
        { before: 0.5, after: 0.7, subject_id: 'S2' },
        { before: 0.7, after: 0.9, subject_id: 'S3' },
        { before: 0.8, after: 0.85, subject_id: 'S4' },
        { before: 0.4, after: 0.6, subject_id: 'S5' }
      ];

      const result = await confidenceInterval.calculatePairedDifferenceConfidenceInterval(pairedData, {
        confidenceLevel: 0.95,
        beforeField: 'before',
        afterField: 'after',
        subjectField: 'subject_id'
      });

      expect(result.meanDifference).toBeGreaterThan(0); // After should be higher
      expect(result.lowerBound).toBeGreaterThan(0); // Significant improvement
      expect(result.pairedTStatistic).toBeDefined();
      expect(result.crossoverEffect).toBeDefined();
      expect(result.effectDirection).toBe('positive');
    });

    test('should calculate confidence interval for ratio of means', async () => {
      // RED: This test should fail - ratio analysis not implemented
      const numeratorData = [
        { value: 0.8 }, { value: 0.9 }, { value: 0.85 }, { value: 0.95 }, { value: 0.75 }
      ];
      const denominatorData = [
        { value: 0.4 }, { value: 0.5 }, { value: 0.45 }, { value: 0.55 }, { value: 0.35 }
      ];

      const result = await confidenceInterval.calculateRatioConfidenceInterval(
        numeratorData,
        denominatorData,
        {
          confidenceLevel: 0.95,
          field: 'value',
          method: 'log_transformation'
        }
      );

      expect(result.ratio).toBeGreaterThan(1); // Numerator should be larger
      expect(result.lowerBound).toBeGreaterThan(0);
      expect(result.upperBound).toBeGreaterThan(result.ratio);
      expect(result.logTransformed).toBe(true);
      expect(result.geometricMean).toBeDefined();
      expect(result.deltaMethod).toBeDefined();
    });
  });

  describe('Event Impact Confidence Intervals', () => {
    test('should calculate confidence intervals for event impact magnitude', async () => {
      // RED: This test should fail - event impact analysis not implemented
      const mockEventData = [
        { customer_id: 'C1', pre_value: 0.8, post_value: 0.6, impact: -0.2 },
        { customer_id: 'C2', pre_value: 0.7, post_value: 0.5, impact: -0.2 },
        { customer_id: 'C3', pre_value: 0.9, post_value: 0.7, impact: -0.2 },
        { customer_id: 'C4', pre_value: 0.6, post_value: 0.4, impact: -0.2 },
        { customer_id: 'C5', pre_value: 0.75, post_value: 0.55, impact: -0.2 }
      ];

      mockDb.all.mockResolvedValue(mockEventData);

      const result = await confidenceInterval.calculateEventImpactConfidenceInterval('EVENT-001', {
        confidenceLevel: 0.95,
        impactField: 'impact',
        adjustForMultipleComparisons: true,
        correctionMethod: 'bonferroni'
      });

      expect(result.meanImpact).toBeCloseTo(-0.2, 2);
      expect(result.lowerBound).toBeLessThan(0); // Negative impact
      expect(result.upperBound).toBeLessThan(0); // Consistently negative
      expect(result.adjustedConfidenceLevel).toBeGreaterThan(0.95); // Bonferroni adjustment increases confidence level
      expect(result.effectSize).toBeDefined();
      expect(result.practicalSignificance).toBeDefined();
    });

    test('should calculate confidence intervals for recovery time estimation', async () => {
      // RED: This test should fail - recovery time analysis not implemented
      const mockRecoveryData = [
        { customer_id: 'C1', recovery_time_hours: 24 },
        { customer_id: 'C2', recovery_time_hours: 36 },
        { customer_id: 'C3', recovery_time_hours: 18 },
        { customer_id: 'C4', recovery_time_hours: 30 },
        { customer_id: 'C5', recovery_time_hours: 48 }
      ];

      mockDb.all.mockResolvedValue(mockRecoveryData);

      const result = await confidenceInterval.calculateRecoveryTimeConfidenceInterval('EVENT-001', {
        confidenceLevel: 0.90,
        timeField: 'recovery_time_hours',
        distributionType: 'exponential',
        includeNonRecovered: false
      });

      expect(result.meanRecoveryTime).toBeCloseTo(31.2, 1);
      expect(result.medianRecoveryTime).toBeDefined();
      expect(result.lowerBound).toBeGreaterThan(0);
      expect(result.upperBound).toBeGreaterThan(result.meanRecoveryTime);
      expect(result.distributionFit).toBe('exponential');
      expect(result.survivalAnalysis).toBeDefined();
    });

    test('should provide confidence intervals for customer segment impacts', async () => {
      // RED: This test should fail - segment analysis not implemented
      const mockSegmentData = [
        { customer_id: 'C1', segment: 'premium', impact: -0.1 },
        { customer_id: 'C2', segment: 'premium', impact: -0.15 },
        { customer_id: 'C3', segment: 'basic', impact: -0.3 },
        { customer_id: 'C4', segment: 'basic', impact: -0.25 },
        { customer_id: 'C5', segment: 'premium', impact: -0.05 }
      ];

      mockDb.all.mockResolvedValue(mockSegmentData);

      const result = await confidenceInterval.calculateSegmentImpactConfidenceIntervals('EVENT-001', {
        confidenceLevel: 0.95,
        segmentField: 'segment',
        impactField: 'impact',
        compareSegments: true
      });

      expect(result.segments).toHaveProperty('premium');
      expect(result.segments).toHaveProperty('basic');
      expect(result.segments.premium.meanImpact).toBeGreaterThan(result.segments.basic.meanImpact);
      expect(result.segmentComparison).toBeDefined();
      expect(result.segmentComparison.difference).toBeDefined();
      expect(result.segmentComparison.confidenceInterval).toBeDefined();
      expect(result.homogeneityTest).toBeDefined();
    });
  });

  describe('Bootstrap Confidence Intervals', () => {
    test('should calculate bootstrap confidence intervals for complex statistics', async () => {
      // RED: This test should fail - bootstrap methods not implemented
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        value: 0.5 + 0.3 * Math.sin(i * 0.1) + 0.1 * Math.random()
      }));

      const result = await confidenceInterval.calculateBootstrapConfidenceInterval(mockData, {
        statistic: 'median',
        confidenceLevel: 0.95,
        field: 'value',
        bootstrapSamples: 1000,
        method: 'percentile'
      });

      expect(result.statistic).toBe('median');
      expect(result.estimatedValue).toBeDefined();
      expect(result.lowerBound).toBeLessThan(result.estimatedValue);
      expect(result.upperBound).toBeGreaterThan(result.estimatedValue);
      expect(result.bootstrapSamples).toBe(1000);
      expect(result.method).toBe('percentile');
      expect(result.bias).toBeDefined();
      expect(result.standardError).toBeDefined();
    });

    test('should calculate bias-corrected and accelerated (BCa) bootstrap intervals', async () => {
      // RED: This test should fail - BCa bootstrap not implemented
      const mockData = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.6 }, { value: 0.75 },
        { value: 0.85 }, { value: 0.65 }, { value: 0.9 }, { value: 0.8 }, { value: 0.7 }
      ];

      const result = await confidenceInterval.calculateBCaBootstrapConfidenceInterval(mockData, {
        statistic: 'variance',
        confidenceLevel: 0.95,
        field: 'value',
        bootstrapSamples: 2000
      });

      expect(result.method).toBe('BCa');
      expect(result.biasCorrection).toBeDefined();
      expect(result.acceleration).toBeDefined();
      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.lowerBound).toBeGreaterThan(0);
      expect(result.upperBound).toBeGreaterThan(result.estimatedValue);
      expect(result.coverage).toBeDefined();
    });

    test('should handle bootstrap for correlation coefficients', async () => {
      // RED: This test should fail - correlation bootstrap not implemented
      const mockCorrelationData = Array.from({ length: 50 }, (_, i) => ({
        x: i * 0.1 + Math.random() * 0.1,
        y: i * 0.08 + Math.random() * 0.15
      }));

      const result = await confidenceInterval.calculateCorrelationBootstrapConfidenceInterval(mockCorrelationData, {
        xField: 'x',
        yField: 'y',
        correlationType: 'pearson',
        confidenceLevel: 0.95,
        bootstrapSamples: 1000
      });

      expect(result.correlation).toBeGreaterThan(0.5); // Should be positive correlation
      expect(result.lowerBound).toBeGreaterThan(0);
      expect(result.upperBound).toBeLessThan(1);
      expect(result.fisherTransformed).toBeDefined();
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significanceTest).toBeDefined();
    });
  });

  describe('Non-parametric Confidence Intervals', () => {
    test('should calculate confidence intervals for median using order statistics', async () => {
      // RED: This test should fail - non-parametric methods not implemented
      const mockData = [
        { value: 0.1 }, { value: 0.3 }, { value: 0.5 }, { value: 0.7 }, { value: 0.9 },
        { value: 0.2 }, { value: 0.4 }, { value: 0.6 }, { value: 0.8 }, { value: 0.95 }
      ];

      const result = await confidenceInterval.calculateOrderStatisticConfidenceInterval(mockData, {
        statistic: 'median',
        confidenceLevel: 0.95,
        field: 'value'
      });

      expect(result.statistic).toBe('median');
      expect(result.estimatedValue).toBeCloseTo(0.55, 2); // Median of [0.1,0.2,...,0.95]
      expect(result.lowerOrderStatistic).toBeDefined();
      expect(result.upperOrderStatistic).toBeDefined();
      expect(result.exactCoverage).toBeGreaterThan(0.90);
      expect(result.method).toBe('order_statistics');
    });

    test('should calculate confidence intervals for quantiles', async () => {
      // RED: This test should fail - quantile intervals not implemented
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        value: Math.random()
      }));

      const quantiles = [0.25, 0.5, 0.75, 0.9];
      
      for (const q of quantiles) {
        const result = await confidenceInterval.calculateQuantileConfidenceInterval(mockData, {
          quantile: q,
          confidenceLevel: 0.95,
          field: 'value',
          method: 'order_statistics'
        });

        expect(result.quantile).toBe(q);
        expect(result.estimatedValue).toBeGreaterThan(0);
        expect(result.estimatedValue).toBeLessThan(1);
        expect(result.lowerBound).toBeLessThan(result.estimatedValue);
        expect(result.upperBound).toBeGreaterThan(result.estimatedValue);
      }
    });

    test('should calculate robust confidence intervals using Winsorized means', async () => {
      // RED: This test should fail - robust methods not implemented
      const mockDataWithOutliers = [
        { value: 0.7 }, { value: 0.8 }, { value: 0.75 }, { value: 0.9 }, { value: 0.85 },
        { value: 0.72 }, { value: 0.88 }, { value: 2.5 }, // Outlier
        { value: 0.76 }, { value: 0.82 }
      ];

      const result = await confidenceInterval.calculateRobustConfidenceInterval(mockDataWithOutliers, {
        confidenceLevel: 0.95,
        field: 'value',
        method: 'winsorized_mean',
        winsorizePercent: 0.1 // Winsorize 10% from each tail
      });

      expect(result.robustMean).toBeLessThan(1.0); // Should be robust to outlier
      expect(result.regularMean).toBeGreaterThan(result.robustMean); // Regular mean affected by outlier
      expect(result.winsorizedValues).toBeDefined();
      expect(result.outlierCount).toBe(1);
      expect(result.trimmedData).toBeDefined();
    });
  });

  describe('Bayesian Confidence Intervals', () => {
    test('should calculate Bayesian credible intervals for means', async () => {
      // RED: This test should fail - Bayesian methods not implemented
      const mockData = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.75 }, { value: 0.85 }
      ];

      const result = await confidenceInterval.calculateBayesianCredibleInterval(mockData, {
        confidenceLevel: 0.95,
        field: 'value',
        prior: {
          type: 'normal',
          mean: 0.75,
          variance: 0.01
        },
        posteriorSamples: 10000
      });

      expect(result.posteriorMean).toBeDefined();
      expect(result.lowerBound).toBeLessThan(result.posteriorMean);
      expect(result.upperBound).toBeGreaterThan(result.posteriorMean);
      expect(result.interpretation).toBe('credible_interval');
      expect(result.priorInfluence).toBeDefined();
      expect(result.posteriorSamples).toBe(10000);
      expect(result.mcmcDiagnostics).toBeDefined();
    });

    test('should calculate Bayesian intervals with different priors', async () => {
      // RED: This test should fail - multiple prior types not implemented
      const mockData = [
        { success: 7, total: 10 } // Binomial data
      ];

      const priors = [
        { type: 'uniform', a: 0, b: 1 },
        { type: 'beta', alpha: 2, beta: 2 },
        { type: 'jeffreys', parameters: {} }
      ];

      const results = [];
      
      for (const prior of priors) {
        const result = await confidenceInterval.calculateBayesianCredibleInterval(mockData, {
          confidenceLevel: 0.95,
          field: 'success',
          totalField: 'total',
          prior,
          distribution: 'binomial'
        });
        
        results.push(result);
      }

      // Different priors should give different results
      expect(results[0].posteriorMean).not.toEqual(results[1].posteriorMean);
      expect(results[1].posteriorMean).not.toEqual(results[2].posteriorMean);
      
      results.forEach(result => {
        expect(result.lowerBound).toBeGreaterThan(0);
        expect(result.upperBound).toBeLessThan(1);
      });
    });
  });

  describe('Confidence Interval Reporting and Visualization', () => {
    test('should generate comprehensive confidence interval report', async () => {
      // RED: This test should fail - reporting not implemented
      const report = await confidenceInterval.generateConfidenceIntervalReport('EVENT-001', {
        includeBootstrap: true,
        includeBayesian: true,
        includeRobust: true,
        confidenceLevels: [0.90, 0.95, 0.99],
        visualizations: true
      });

      expect(report.summary).toBeDefined();
      expect(report.summary.primaryEstimate).toBeDefined();
      expect(report.summary.recommendedInterval).toBeDefined();
      expect(report.summary.interpretation).toBeDefined();

      expect(report.methods).toHaveProperty('parametric');
      expect(report.methods).toHaveProperty('bootstrap');
      expect(report.methods).toHaveProperty('bayesian');
      expect(report.methods).toHaveProperty('robust');

      expect(report.assumptions).toBeDefined();
      expect(report.limitations).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    test('should compare different confidence interval methods', async () => {
      // RED: This test should fail - method comparison not implemented
      const mockData = Array.from({ length: 30 }, (_, i) => ({
        value: 0.5 + 0.3 * Math.random()
      }));

      const comparison = await confidenceInterval.compareConfidenceIntervalMethods(mockData, {
        field: 'value',
        confidenceLevel: 0.95,
        methods: ['parametric', 'bootstrap', 'robust', 'bayesian']
      });

      expect(comparison.estimates).toHaveProperty('parametric');
      expect(comparison.estimates).toHaveProperty('bootstrap');
      expect(comparison.estimates).toHaveProperty('robust');
      expect(comparison.estimates).toHaveProperty('bayesian');

      expect(comparison.widthComparison).toBeDefined();
      expect(comparison.centerComparison).toBeDefined();
      expect(comparison.recommendedMethod).toBeDefined();
      expect(comparison.methodRationale).toBeDefined();
    });

    test('should provide interactive confidence interval visualization data', async () => {
      // RED: This test should fail - visualization not implemented
      const mockData = [
        { value: 0.8 }, { value: 0.7 }, { value: 0.9 }, { value: 0.75 }, { value: 0.85 }
      ];

      const vizData = await confidenceInterval.generateVisualizationData(mockData, {
        field: 'value',
        confidenceLevel: 0.95,
        includeDistribution: true,
        includeBootstrapDistribution: true
      });

      expect(vizData.intervalPlot).toBeDefined();
      expect(vizData.distributionPlot).toBeDefined();
      expect(vizData.bootstrapDistribution).toBeDefined();
      expect(vizData.confidenceBands).toBeDefined();
      expect(vizData.annotations).toBeDefined();
      expect(vizData.interactiveElements).toBeDefined();
    });
  });

  describe('Integration with Statistical Framework', () => {
    test('should integrate with power analysis for sample size planning', async () => {
      // RED: This test should fail - integration not implemented
      const integration = await confidenceInterval.integrateWithPowerAnalysis({
        desiredMarginOfError: 0.05,
        confidenceLevel: 0.95,
        expectedStandardDeviation: 0.15,
        powerRequirement: 0.8
      });

      expect(integration.requiredSampleSize).toBeGreaterThan(0);
      expect(integration.achievableMarginOfError).toBeLessThanOrEqual(0.05);
      expect(integration.powerAnalysis).toBeDefined();
      expect(integration.tradeoffAnalysis).toBeDefined();
      expect(integration.costBenefitAnalysis).toBeDefined();
    });

    test('should provide confidence intervals for effect size estimates', async () => {
      // RED: This test should fail - effect size integration not implemented
      const mockTreatmentData = [
        { value: 0.8 }, { value: 0.85 }, { value: 0.9 }, { value: 0.75 }, { value: 0.82 }
      ];
      const mockControlData = [
        { value: 0.6 }, { value: 0.65 }, { value: 0.7 }, { value: 0.55 }, { value: 0.62 }
      ];

      const result = await confidenceInterval.calculateEffectSizeConfidenceInterval(
        mockTreatmentData,
        mockControlData,
        {
          field: 'value',
          effectSizeType: 'cohens_d',
          confidenceLevel: 0.95,
          method: 'bootstrap'
        }
      );

      expect(result.effectSize).toBeGreaterThan(0);
      expect(result.effectSizeType).toBe('cohens_d');
      expect(result.lowerBound).toBeDefined();
      expect(result.upperBound).toBeDefined();
      expect(result.interpretation).toBeDefined();
      expect(result.practicalSignificance).toBeDefined();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});