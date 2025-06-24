import { CausalAnalysisService } from '../causal-analysis.service';
import { BusinessEventService } from '../business-event.service';
import { CustomerImpactResolverService } from '../customer-impact-resolver.service';
import { DatabaseService } from '../../database/sqlite';

// Mock dependencies
jest.mock('../business-event.service');
jest.mock('../customer-impact-resolver.service');
jest.mock('../../database/sqlite');

describe('CausalAnalysisService', () => {
  let causalAnalysisService: CausalAnalysisService;
  let mockBusinessEventService: jest.Mocked<BusinessEventService>;
  let mockCustomerImpactResolver: jest.Mocked<CustomerImpactResolverService>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService = {
      query: jest.fn(),
      run: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn()
    } as any;

    mockBusinessEventService = new BusinessEventService({} as any) as jest.Mocked<BusinessEventService>;
    mockCustomerImpactResolver = new CustomerImpactResolverService({} as any, {} as any) as jest.Mocked<CustomerImpactResolverService>;
    
    causalAnalysisService = new CausalAnalysisService(
      mockDatabaseService,
      mockBusinessEventService,
      mockCustomerImpactResolver
    );
  });

  describe('Statistical Significance Testing', () => {
    test('should perform t-test for sentiment changes before/after event', async () => {
      // RED: This test should fail - CausalAnalysisService doesn't exist yet
      const eventId = 'evt-12345';
      const mockBeforeData = [4.2, 4.1, 4.3, 4.0, 4.5, 4.2, 4.1]; // Pre-event sentiment scores
      const mockAfterData = [3.8, 3.9, 3.7, 3.6, 4.0, 3.8, 3.9];  // Post-event sentiment scores

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'price_change',
        eventDate: '2024-06-23',
        description: 'Price increase',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock database queries for sentiment data
      mockDatabaseService.query
        .mockResolvedValueOnce(mockBeforeData.map((score, i) => ({ 
          sentiment_score: score, 
          customer_id: `CUST-${i+1}`,
          created_at: '2024-06-20T10:00:00Z' 
        })))
        .mockResolvedValueOnce(mockAfterData.map((score, i) => ({ 
          sentiment_score: score, 
          customer_id: `CUST-${i+1}`,
          created_at: '2024-06-24T10:00:00Z' 
        })));

      const result = await causalAnalysisService.performTTest(eventId, {
        beforePeriodDays: 7,
        afterPeriodDays: 7,
        textField: 'review_text'
      });

      expect(result).toEqual({
        testType: expect.stringMatching(/welch_t_test|student_t_test/),
        statistic: expect.any(Number),
        pValue: expect.any(Number),
        degreesOfFreedom: expect.any(Number),
        beforeStats: {
          mean: expect.any(Number),
          standardDeviation: expect.any(Number),
          sampleSize: 7
        },
        afterStats: {
          mean: expect.any(Number),
          standardDeviation: expect.any(Number),
          sampleSize: 7
        },
        effectSize: expect.any(Number),
        confidence: 0.95,
        isSignificant: expect.any(Boolean),
        interpretation: expect.any(String),
        varianceTest: expect.any(Object)
      });

      expect(result.pValue).toBeLessThan(0.05); // Should detect significant difference
      expect(result.beforeStats.mean).toBeGreaterThan(result.afterStats.mean); // Sentiment decreased
    });

    test('should perform Mann-Whitney U test for non-parametric analysis', async () => {
      // RED: This test should fail - Mann-Whitney U test not implemented
      const eventId = 'evt-67890';
      const mockBeforeData = [5, 4, 5, 3, 4, 5, 4, 3, 5, 4]; // Ordinal sentiment data
      const mockAfterData = [3, 2, 3, 2, 2, 3, 2, 3, 2, 3];

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'system_outage',
        eventDate: '2024-06-23',
        description: 'System outage',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      mockDatabaseService.query
        .mockResolvedValueOnce(mockBeforeData.map((score, i) => ({ 
          sentiment_score: score, 
          customer_id: `CUST-${i+1}`,
          text_field: 'review_text'
        })))
        .mockResolvedValueOnce(mockAfterData.map((score, i) => ({ 
          sentiment_score: score, 
          customer_id: `CUST-${i+1}`,
          text_field: 'review_text'
        })));

      const result = await causalAnalysisService.performMannWhitneyUTest(eventId, {
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textField: 'review_text'
      });

      expect(result).toEqual({
        testType: 'mann_whitney_u',
        uStatistic: expect.any(Number),
        pValue: expect.any(Number),
        beforeStats: {
          median: expect.any(Number),
          sampleSize: 10,
          ranks: expect.any(Array)
        },
        afterStats: {
          median: expect.any(Number),
          sampleSize: 10,
          ranks: expect.any(Array)
        },
        effectSize: expect.any(Number),
        isSignificant: expect.any(Boolean),
        interpretation: expect.any(String)
      });

      expect(result.pValue).toBeLessThan(0.01); // Should detect highly significant difference
    });

    test('should handle equal variance and unequal variance t-tests', async () => {
      // RED: This test should fail - variance testing not implemented
      const eventId = 'evt-variance';
      
      // Data with similar variances
      const equalVarianceData = {
        before: [4.1, 4.2, 4.0, 4.3, 4.1],
        after: [3.9, 4.0, 3.8, 4.1, 3.9]
      };

      // Data with different variances  
      const unequalVarianceData = {
        before: [4.0, 4.0, 4.0, 4.0, 4.0], // Low variance
        after: [1.0, 2.0, 5.0, 3.0, 4.0]   // High variance
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'variance_test',
        eventDate: '2024-06-23',
        description: 'Variance test event',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValue(mockEvent);

      mockDatabaseService.query
        .mockResolvedValueOnce(equalVarianceData.before.map(score => ({ sentiment_score: score })))
        .mockResolvedValueOnce(equalVarianceData.after.map(score => ({ sentiment_score: score })));

      const equalVarResult = await causalAnalysisService.performTTest(eventId, {
        beforePeriodDays: 7,
        afterPeriodDays: 7,
        assumeEqualVariance: true
      });

      expect(equalVarResult.testType).toBe('student_t_test');
      expect(equalVarResult.varianceTest).toEqual({
        fStatistic: expect.any(Number),
        pValue: expect.any(Number),
        equalVarianceAssumed: true
      });

      mockDatabaseService.query
        .mockResolvedValueOnce(unequalVarianceData.before.map(score => ({ sentiment_score: score })))
        .mockResolvedValueOnce(unequalVarianceData.after.map(score => ({ sentiment_score: score })));

      const unequalVarResult = await causalAnalysisService.performTTest(eventId, {
        beforePeriodDays: 7,
        afterPeriodDays: 7,
        assumeEqualVariance: false
      });

      expect(unequalVarResult.testType).toBe('welch_t_test');
      expect(unequalVarResult.varianceTest.equalVarianceAssumed).toBe(false);
    });

    test('should validate statistical assumptions and provide warnings', async () => {
      // RED: This test should fail - assumption validation not implemented
      const eventId = 'evt-assumptions';
      
      // Non-normal, skewed data
      const skewedData = {
        before: [1, 1, 1, 1, 2, 2, 5], // Right-skewed
        after: [1, 1, 2, 2, 2, 3, 3]
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'assumptions_test',
        eventDate: '2024-06-23',
        description: 'Assumptions test event',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      mockDatabaseService.query
        .mockResolvedValueOnce(skewedData.before.map(score => ({ sentiment_score: score })))
        .mockResolvedValueOnce(skewedData.after.map(score => ({ sentiment_score: score })));

      const result = await causalAnalysisService.performTTest(eventId, {
        beforePeriodDays: 7,
        afterPeriodDays: 7,
        validateAssumptions: true
      });

      expect(result.assumptionTests).toEqual({
        normalityTest: {
          beforePValue: expect.any(Number),
          afterPValue: expect.any(Number),
          isNormal: expect.any(Boolean)
        },
        equalVarianceTest: {
          fStatistic: expect.any(Number),
          pValue: expect.any(Number),
          hasEqualVariance: expect.any(Boolean)
        },
        recommendations: expect.arrayContaining([
          expect.stringMatching(/normality|non-parametric|mann-whitney/i)
        ])
      });

      expect(result.warnings).toContain('Data may not meet normality assumptions');
    });
  });

  describe('Effect Size Calculation', () => {
    test('should calculate Cohen\'s d for t-test results', async () => {
      // RED: This test should fail - Cohen's d calculation not implemented
      const beforeData = [4.5, 4.2, 4.6, 4.1, 4.3];
      const afterData = [3.8, 3.5, 3.9, 3.6, 3.7];

      const effectSize = await causalAnalysisService.calculateCohenD(beforeData, afterData);

      expect(effectSize).toEqual({
        cohensD: expect.any(Number),
        magnitude: expect.stringMatching(/small|medium|large/),
        interpretation: expect.any(String),
        confidenceInterval: {
          lower: expect.any(Number),
          upper: expect.any(Number),
          confidence: 0.95
        }
      });

      expect(Math.abs(effectSize.cohensD)).toBeGreaterThan(0.8); // Should be large effect
      expect(effectSize.magnitude).toBe('large');
    });

    test('should calculate effect size for Mann-Whitney U test', async () => {
      // RED: This test should fail - U test effect size not implemented
      const beforeData = [5, 4, 5, 3, 4];
      const afterData = [2, 3, 2, 1, 2];

      const effectSize = await causalAnalysisService.calculateMannWhitneyEffectSize(beforeData, afterData);

      expect(effectSize).toEqual({
        rRankBiserial: expect.any(Number),
        magnitude: expect.stringMatching(/small|medium|large/),
        interpretation: expect.any(String),
        probabilityOfSuperiority: expect.any(Number)
      });
    });

    test('should provide practical significance interpretation', async () => {
      // RED: This test should fail - practical significance not implemented
      const smallEffect = { cohensD: 0.2, sampleSize: 100 };
      const largeEffect = { cohensD: 1.2, sampleSize: 30 };

      const smallInterpretation = await causalAnalysisService.interpretPracticalSignificance(smallEffect);
      const largeInterpretation = await causalAnalysisService.interpretPracticalSignificance(largeEffect);

      expect(smallInterpretation).toEqual({
        isPracticallySignificant: false,
        reasoning: expect.stringContaining('small'),
        businessImpact: 'minimal',
        recommendation: expect.stringContaining('further investigation')
      });

      expect(largeInterpretation).toEqual({
        isPracticallySignificant: true,
        reasoning: expect.stringContaining('large'),
        businessImpact: 'substantial',
        recommendation: expect.stringContaining('Immediate')
      });
    });
  });

  describe('Multiple Comparison Correction', () => {
    test('should apply Bonferroni correction for multiple tests', async () => {
      // RED: This test should fail - Bonferroni correction not implemented
      const pValues = [0.01, 0.03, 0.02, 0.08, 0.001];
      const alpha = 0.05;

      const correctedResults = await causalAnalysisService.applyBonferroniCorrection(pValues, alpha);

      expect(correctedResults).toEqual({
        originalPValues: pValues,
        correctedAlpha: 0.01, // 0.05 / 5 tests
        adjustedPValues: expect.any(Array),
        significantTests: expect.any(Array),
        rejectedHypotheses: 1, // Only 0.001 should survive correction
        familywiseErrorRate: 0.05
      });

      expect(correctedResults.adjustedPValues[0]).toBe(0.05); // 0.01 * 5
      expect(correctedResults.significantTests).toEqual([4]); // Only last test (0.001)
    });

    test('should apply Benjamini-Hochberg FDR correction', async () => {
      // RED: This test should fail - FDR correction not implemented
      const pValues = [0.001, 0.01, 0.03, 0.08, 0.15];
      const fdr = 0.05;

      const correctedResults = await causalAnalysisService.applyFDRCorrection(pValues, fdr);

      expect(correctedResults).toEqual({
        originalPValues: pValues,
        targetFDR: fdr,
        adjustedPValues: expect.any(Array),
        significantTests: expect.any(Array),
        rejectedHypotheses: expect.any(Number),
        criticalValue: expect.any(Number)
      });

      expect(correctedResults.rejectedHypotheses).toBeGreaterThan(0);
      expect(correctedResults.adjustedPValues[0]).toBeLessThan(correctedResults.adjustedPValues[4]);
    });

    test('should provide family-wise error rate control', async () => {
      // RED: This test should fail - FWER control not implemented
      const analysisResults = [
        { testName: 'review_text', pValue: 0.01, effectSize: 0.8 },
        { testName: 'comment_text', pValue: 0.03, effectSize: 0.5 },
        { testName: 'feedback_text', pValue: 0.08, effectSize: 0.3 },
        { testName: 'survey_response', pValue: 0.001, effectSize: 1.2 }
      ];

      const fwerResults = await causalAnalysisService.controlFamilyWiseError(analysisResults, {
        method: 'bonferroni',
        alpha: 0.05
      });

      expect(fwerResults).toEqual({
        correctionMethod: 'bonferroni',
        originalAlpha: 0.05,
        correctedAlpha: 0.0125, // 0.05 / 4
        significantResults: expect.any(Array),
        summary: {
          totalTests: 4,
          significantTests: expect.any(Number),
          falseDiscoveryRate: expect.any(Number),
          power: expect.any(Number)
        }
      });
    });
  });

  describe('Comprehensive Causal Analysis', () => {
    test('should perform complete before/after analysis for business event', async () => {
      // RED: This test should fail - comprehensive analysis not implemented
      const eventId = 'evt-comprehensive';
      const mockEvent = {
        id: eventId,
        eventType: 'price_change',
        eventDate: '2024-06-23',
        description: 'Price increase of 15%',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValue(mockEvent);
      mockCustomerImpactResolver.resolveCustomerScope.mockResolvedValueOnce({
        eventId,
        scopeType: 'specific',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        totalAffectedCount: 3,
        isAllCustomers: false,
        percentageOfTotal: 30.0
      });

      // Mock sentiment data for multiple text fields
      const mockSentimentData = {
        reviews: {
          before: [4.2, 4.1, 4.3],
          after: [3.8, 3.6, 3.9]
        },
        comments: {
          before: [4.0, 4.2, 4.1],
          after: [3.5, 3.7, 3.6]
        }
      };

      // Mock database queries - the analyzeEventImpact calls performTTest and performMannWhitneyUTest
      // Need enough mock responses for all the calls
      mockDatabaseService.query
        .mockResolvedValue(mockSentimentData.reviews.before.map(score => ({ sentiment_score: score })))
        .mockResolvedValue(mockSentimentData.reviews.after.map(score => ({ sentiment_score: score })))
        .mockResolvedValue(mockSentimentData.comments.before.map(score => ({ sentiment_score: score })))
        .mockResolvedValue(mockSentimentData.comments.after.map(score => ({ sentiment_score: score })));

      const result = await causalAnalysisService.analyzeEventImpact(eventId, {
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textFields: ['review_text', 'comment_text'],
        statisticalTests: ['t_test', 'mann_whitney_u'],
        multipleComparisonCorrection: 'bonferroni',
        confidenceLevel: 0.95
      });

      expect(result).toEqual({
        eventId,
        eventDetails: mockEvent,
        customerImpact: expect.any(Object),
        analysisMetadata: {
          beforePeriod: expect.any(Object),
          afterPeriod: expect.any(Object),
          textFields: ['review_text', 'comment_text'],
          totalComparisons: 4 // 2 fields × 2 tests
        },
        statisticalResults: expect.arrayContaining([
          expect.objectContaining({
            textField: 'review_text',
            testType: expect.stringMatching(/t_test|student_t_test/),
            isSignificant: expect.any(Boolean)
          }),
          expect.objectContaining({
            textField: 'comment_text',
            testType: 'mann_whitney_u',
            isSignificant: expect.any(Boolean)
          })
        ]),
        multipleComparisonResults: expect.any(Object),
        overallConclusion: {
          hasSignificantImpact: expect.any(Boolean),
          affectedFields: expect.any(Array),
          averageEffectSize: expect.any(Number),
          businessRecommendation: expect.any(String)
        }
      });
    });

    test('should handle insufficient data gracefully', async () => {
      // RED: This test should fail - insufficient data handling not implemented
      const eventId = 'evt-insufficient';
      
      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'insufficient_test',
        eventDate: '2024-06-23',
        description: 'Insufficient data test',
        affectedCustomers: ['CUST-001'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);
      
      // Mock very small sample sizes
      mockDatabaseService.query
        .mockResolvedValueOnce([{ sentiment_score: 4.0 }]) // Only 1 data point before
        .mockResolvedValueOnce([{ sentiment_score: 3.0 }]); // Only 1 data point after

      const result = await causalAnalysisService.performTTest(eventId, {
        beforePeriodDays: 7,
        afterPeriodDays: 7
      });

      expect(result.warnings).toContain('Insufficient sample size for reliable statistical inference');
      expect(result.isSignificant).toBe(false);
      expect(result.recommendations).toContain('Collect more data before drawing conclusions');
    });

    test('should provide confidence intervals for all estimates', async () => {
      // RED: This test should fail - confidence intervals not implemented
      const beforeData = [4.1, 4.2, 4.0, 4.3, 4.1];
      const afterData = [3.8, 3.9, 3.7, 4.0, 3.8];

      // Mock business event
      const mockEvent = {
        id: 'evt-confidence',
        eventType: 'confidence_test',
        eventDate: '2024-06-23',
        description: 'Confidence intervals test',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock sentiment data
      mockDatabaseService.query
        .mockResolvedValueOnce(beforeData.map(score => ({ sentiment_score: score })))
        .mockResolvedValueOnce(afterData.map(score => ({ sentiment_score: score })));

      const result = await causalAnalysisService.performTTest('evt-confidence', {
        beforePeriodDays: 7,
        afterPeriodDays: 7,
        calculateConfidenceIntervals: true,
        confidenceLevel: 0.95
      });

      expect(result.confidenceIntervals).toEqual({
        beforeMean: {
          lower: expect.any(Number),
          upper: expect.any(Number),
          confidence: 0.95
        },
        afterMean: {
          lower: expect.any(Number),
          upper: expect.any(Number),
          confidence: 0.95
        },
        meanDifference: {
          lower: expect.any(Number),
          upper: expect.any(Number),
          confidence: 0.95
        }
      });
    });
  });

  describe('Statistical Significance Engine (Task 6.3)', () => {
    test('should calculate comprehensive effect sizes with interpretation', async () => {
      // RED: This test should fail - comprehensive effect sizes not implemented
      const beforeData = [4.5, 4.2, 4.6, 4.1, 4.3, 4.4, 4.0, 4.2];
      const afterData = [3.8, 3.5, 3.9, 3.6, 3.7, 3.4, 3.2, 3.6];

      const effectSizeResult = await causalAnalysisService.calculateComprehensiveEffectSizes(beforeData, afterData, {
        calculateAll: true,
        confidenceLevel: 0.95,
        interpretationContext: 'sentiment_analysis'
      });

      expect(effectSizeResult).toEqual({
        cohensD: {
          value: expect.any(Number),
          magnitude: expect.stringMatching(/negligible|small|medium|large|very_large/),
          interpretation: expect.any(String),
          confidenceInterval: {
            lower: expect.any(Number),
            upper: expect.any(Number),
            confidence: 0.95
          }
        },
        hedgesG: {
          value: expect.any(Number),
          magnitude: expect.stringMatching(/negligible|small|medium|large|very_large/),
          interpretation: expect.any(String),
          confidenceInterval: {
            lower: expect.any(Number),
            upper: expect.any(Number),
            confidence: 0.95
          }
        },
        glassDeltas: {
          delta1: expect.any(Number),
          delta2: expect.any(Number),
          interpretation: expect.any(String)
        },
        probabilityOfSuperiority: {
          value: expect.any(Number),
          interpretation: expect.any(String)
        },
        commonLanguageEffect: {
          value: expect.any(Number),
          interpretation: expect.any(String)
        },
        overallAssessment: {
          primaryMeasure: 'cohens_d',
          practicalSignificance: expect.any(Boolean),
          businessImpact: expect.stringMatching(/minimal|moderate|substantial|critical/),
          recommendation: expect.any(String)
        }
      });

      expect(Math.abs(effectSizeResult.cohensD.value)).toBeGreaterThan(0.8); // Should be large effect
      expect(effectSizeResult.cohensD.magnitude).toBe('large');
    });

    test('should perform comprehensive power analysis for study design', async () => {
      // RED: This test should fail - power analysis not implemented
      const powerAnalysisResult = await causalAnalysisService.performPowerAnalysis({
        effectSize: 0.5,
        alpha: 0.05,
        power: 0.8,
        testType: 'two_sample_t_test',
        direction: 'two_tailed',
        calculateFor: 'sample_size'
      });

      expect(powerAnalysisResult).toEqual({
        inputParameters: {
          effectSize: 0.5,
          alpha: 0.05,
          power: 0.8,
          testType: 'two_sample_t_test',
          direction: 'two_tailed'
        },
        calculatedValue: {
          sampleSize: expect.any(Number),
          sampleSizePerGroup: expect.any(Number)
        },
        powerCurve: expect.arrayContaining([
          expect.objectContaining({
            sampleSize: expect.any(Number),
            power: expect.any(Number)
          })
        ]),
        sensitivityAnalysis: {
          minimumDetectableEffect: expect.any(Number),
          maximumType2Error: expect.any(Number),
          recommendedSampleSize: expect.any(Number)
        },
        interpretation: {
          adequacy: expect.stringMatching(/underpowered|adequate|overpowered/),
          recommendation: expect.any(String),
          assumptions: expect.any(Array)
        }
      });

      expect(powerAnalysisResult.calculatedValue.sampleSizePerGroup).toBeGreaterThan(10);
      expect(powerAnalysisResult.calculatedValue.sampleSizePerGroup).toBeLessThan(100);
    });

    test('should calculate robust confidence intervals for all estimates', async () => {
      // RED: This test should fail - robust confidence intervals not implemented
      const beforeData = [4.1, 4.2, 4.0, 4.3, 4.1, 3.9, 4.4];
      const afterData = [3.8, 3.9, 3.7, 4.0, 3.8, 3.6, 3.9];

      const confidenceIntervals = await causalAnalysisService.calculateRobustConfidenceIntervals(beforeData, afterData, {
        confidenceLevel: 0.95,
        methods: ['parametric', 'bootstrap', 'bias_corrected_bootstrap'],
        bootstrapIterations: 1000,
        robustEstimators: true
      });

      expect(confidenceIntervals).toEqual({
        meanDifference: {
          parametric: {
            estimate: expect.any(Number),
            lower: expect.any(Number),
            upper: expect.any(Number),
            standardError: expect.any(Number)
          },
          bootstrap: {
            estimate: expect.any(Number),
            lower: expect.any(Number),
            upper: expect.any(Number),
            standardError: expect.any(Number),
            bias: expect.any(Number)
          },
          biasCorrectedBootstrap: {
            estimate: expect.any(Number),
            lower: expect.any(Number),
            upper: expect.any(Number),
            standardError: expect.any(Number),
            bias: expect.any(Number),
            acceleration: expect.any(Number)
          }
        },
        effectSize: {
          cohensD: {
            parametric: expect.objectContaining({
              estimate: expect.any(Number),
              lower: expect.any(Number),
              upper: expect.any(Number)
            }),
            bootstrap: expect.objectContaining({
              estimate: expect.any(Number),
              lower: expect.any(Number),
              upper: expect.any(Number)
            })
          }
        },
        robustEstimates: {
          trimmedMeanDifference: expect.objectContaining({
            estimate: expect.any(Number),
            lower: expect.any(Number),
            upper: expect.any(Number),
            trimPercent: 0.2
          }),
          medianDifference: expect.objectContaining({
            estimate: expect.any(Number),
            lower: expect.any(Number),
            upper: expect.any(Number)
          })
        },
        comparison: {
          mostReliableMethod: expect.stringMatching(/parametric|bootstrap|bias_corrected_bootstrap/),
          convergence: expect.any(Boolean),
          recommendations: expect.any(Array)
        }
      });
    });

    test('should provide comprehensive statistical interpretation with practical significance', async () => {
      // RED: This test should fail - comprehensive interpretation not implemented
      const statisticalResults = {
        tTest: {
          statistic: 3.45,
          pValue: 0.002,
          degreesOfFreedom: 14,
          effectSize: 1.2
        },
        mannWhitneyU: {
          uStatistic: 25,
          pValue: 0.003,
          effectSize: 0.8
        },
        beforeStats: { mean: 4.2, sd: 0.3, n: 8 },
        afterStats: { mean: 3.6, sd: 0.4, n: 8 }
      };

      const interpretation = await causalAnalysisService.interpretStatisticalSignificance(statisticalResults, {
        businessContext: {
          domain: 'customer_sentiment',
          impactThresholds: {
            minimal: 0.2,
            moderate: 0.5,
            substantial: 0.8,
            critical: 1.2
          },
          costOfChange: 'high',
          timeline: 'quarterly_review'
        },
        statisticalContext: {
          multipleComparisons: 3,
          priorHypotheses: true,
          dataQuality: 'high'
        }
      });

      expect(interpretation).toEqual({
        statisticalSignificance: {
          isSignificant: true,
          strength: expect.stringMatching(/weak|moderate|strong|very_strong/),
          consistency: expect.stringMatching(/inconsistent|moderately_consistent|highly_consistent/),
          robustness: expect.any(Number)
        },
        practicalSignificance: {
          isPracticallySignificant: true,
          magnitude: expect.stringMatching(/minimal|moderate|substantial|critical/),
          businessImpact: {
            category: expect.stringMatching(/minimal|moderate|substantial|critical/),
            description: expect.any(String),
            financialImplication: expect.any(String)
          },
          actionRequired: expect.any(Boolean)
        },
        evidenceQuality: {
          grade: expect.stringMatching(/A|B|C|D|F/),
          confidence: expect.any(Number),
          limitations: expect.any(Array),
          strengths: expect.any(Array)
        },
        recommendations: {
          immediate: expect.any(Array),
          shortTerm: expect.any(Array),
          longTerm: expect.any(Array),
          dataCollection: expect.any(Array)
        },
        riskAssessment: {
          type1ErrorRisk: expect.any(String),
          type2ErrorRisk: expect.any(String),
          decisionRisk: expect.stringMatching(/low|moderate|high|critical/),
          mitigationStrategies: expect.any(Array)
        }
      });

      expect(interpretation.statisticalSignificance.isSignificant).toBe(true);
      expect(interpretation.practicalSignificance.isPracticallySignificant).toBe(true);
      expect(interpretation.evidenceQuality.grade).toMatch(/A|B|C/);
    });

    test('should handle small sample size corrections and warnings', async () => {
      // RED: This test should fail - small sample corrections not implemented
      const smallBeforeData = [4.2, 4.1, 4.3]; // n=3
      const smallAfterData = [3.8, 3.6, 3.9];   // n=3

      const smallSampleAnalysis = await causalAnalysisService.performSmallSampleAnalysis(smallBeforeData, smallAfterData, {
        corrections: ['bias_correction', 'degrees_of_freedom_adjustment'],
        alternativeTests: ['permutation', 'exact'],
        confidenceLevel: 0.95
      });

      expect(smallSampleAnalysis).toEqual({
        sampleSizeAssessment: {
          beforeSampleSize: 3,
          afterSampleSize: 3,
          adequacy: expect.stringMatching(/inadequate|borderline|adequate/),
          minimumRecommended: expect.any(Number),
          powerEstimate: expect.any(Number)
        },
        correctedResults: {
          biasCorrection: {
            originalEffectSize: expect.any(Number),
            correctedEffectSize: expect.any(Number),
            biasEstimate: expect.any(Number)
          },
          degreesOfFreedomAdjustment: {
            originalDF: expect.any(Number),
            adjustedDF: expect.any(Number),
            adjustmentReason: expect.any(String)
          }
        },
        alternativeTests: {
          permutationTest: {
            testStatistic: expect.any(Number),
            pValue: expect.any(Number),
            permutations: expect.any(Number),
            exactP: expect.any(Boolean)
          },
          exactTest: {
            testStatistic: expect.any(Number),
            pValue: expect.any(Number),
            method: expect.any(String)
          }
        },
        warnings: expect.arrayContaining([
          expect.stringContaining('small sample')
        ]),
        recommendations: expect.arrayContaining([
          expect.stringContaining('collect more data')
        ])
      });

      expect(smallSampleAnalysis.sampleSizeAssessment.adequacy).toBe('inadequate');
      expect(smallSampleAnalysis.warnings.length).toBeGreaterThan(0);
    });

    test('should perform Bayesian statistical analysis with prior incorporation', async () => {
      // RED: This test should fail - Bayesian analysis not implemented
      const beforeData = [4.2, 4.1, 4.3, 4.0, 4.2];
      const afterData = [3.8, 3.7, 3.9, 3.6, 3.8];

      const bayesianAnalysis = await causalAnalysisService.performBayesianAnalysis(beforeData, afterData, {
        priors: {
          meanDifference: { distribution: 'normal', mean: 0, sd: 0.5 },
          effectSize: { distribution: 'normal', mean: 0, sd: 0.8 }
        },
        mcmcSettings: {
          iterations: 10000,
          burnIn: 2000,
          chains: 3,
          thinning: 2
        },
        credibilityLevel: 0.95
      });

      expect(bayesianAnalysis).toEqual({
        posteriorDistributions: {
          meanDifference: {
            mean: expect.any(Number),
            median: expect.any(Number),
            mode: expect.any(Number),
            sd: expect.any(Number),
            credibilityInterval: {
              lower: expect.any(Number),
              upper: expect.any(Number),
              level: 0.95
            }
          },
          effectSize: {
            mean: expect.any(Number),
            median: expect.any(Number),
            mode: expect.any(Number),
            sd: expect.any(Number),
            credibilityInterval: {
              lower: expect.any(Number),
              upper: expect.any(Number),
              level: 0.95
            }
          }
        },
        bayesFactors: {
          h1VsH0: expect.any(Number),
          interpretation: expect.stringMatching(/decisive|very_strong|strong|moderate|weak|negligible/),
          evidenceStrength: expect.any(String)
        },
        probabilityStatements: {
          probabilityOfEffect: expect.any(Number),
          probabilityOfPracticalSignificance: expect.any(Number),
          probabilityOfDirection: expect.any(Number)
        },
        modelDiagnostics: {
          rHat: expect.any(Number),
          effectiveSampleSize: expect.any(Number),
          convergence: expect.any(Boolean),
          warnings: expect.any(Array)
        },
        comparison: {
          frequentistP: expect.any(Number),
          bayesianP: expect.any(Number),
          agreement: expect.any(Boolean),
          recommendedApproach: expect.any(String)
        }
      });

      expect(bayesianAnalysis.posteriorDistributions.meanDifference.credibilityInterval.lower).toBeLessThan(
        bayesianAnalysis.posteriorDistributions.meanDifference.credibilityInterval.upper
      );
      expect(bayesianAnalysis.modelDiagnostics.convergence).toBe(true);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});