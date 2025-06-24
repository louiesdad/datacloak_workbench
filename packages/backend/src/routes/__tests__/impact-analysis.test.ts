import request from 'supertest';
import express from 'express';
import { impactAnalysisRouter } from '../impact-analysis';
import { ImpactCalculatorService } from '../../services/impact-calculator.service';
import { CausalAnalysisService } from '../../services/causal-analysis.service';
import { PowerAnalysisService } from '../../services/power-analysis.service';
import { ConfidenceIntervalService } from '../../services/confidence-interval.service';

// Mock the services
jest.mock('../../services/impact-calculator.service');
jest.mock('../../services/causal-analysis.service');
jest.mock('../../services/power-analysis.service');
jest.mock('../../services/confidence-interval.service');

describe('Impact Analysis Endpoint', () => {
  let app: express.Application;
  let mockImpactCalculationService: jest.Mocked<ImpactCalculatorService>;
  let mockCausalAnalysisService: jest.Mocked<CausalAnalysisService>;
  let mockPowerAnalysisService: jest.Mocked<PowerAnalysisService>;
  let mockConfidenceIntervalService: jest.Mocked<ConfidenceIntervalService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockImpactCalculationService = {
      calculateBeforeAfterImpact: jest.fn(),
      calculateMultiFieldImpact: jest.fn(),
      analyzeImpactPatterns: jest.fn(),
      calculateAggregateImpact: jest.fn(),
      generateImpactReport: jest.fn(),
      getAnalysisById: jest.fn(),
      getAnalysesByEventId: jest.fn(),
      deleteAnalysis: jest.fn(),
    } as any;

    mockCausalAnalysisService = {
      performTTest: jest.fn(),
      calculateEffectSize: jest.fn(),
      interpretEffectSize: jest.fn(),
      compareEffectSizes: jest.fn(),
    } as any;

    mockPowerAnalysisService = {
      calculateStatisticalPower: jest.fn(),
      calculateRequiredSampleSize: jest.fn(),
      analyzeEventImpactPower: jest.fn(),
    } as any;

    mockConfidenceIntervalService = {
      calculateEventImpactConfidenceInterval: jest.fn(),
      calculateMeanConfidenceInterval: jest.fn(),
    } as any;

    // Create class mocks that return our mock instances
    (ImpactCalculatorService as any) = jest.fn(() => mockImpactCalculationService);
    (CausalAnalysisService as any) = jest.fn(() => mockCausalAnalysisService);
    (PowerAnalysisService as any) = jest.fn(() => mockPowerAnalysisService);
    (ConfidenceIntervalService as any) = jest.fn(() => mockConfidenceIntervalService);

    app = express();
    app.use(express.json());
    app.use('/api/analysis', impactAnalysisRouter);
  });

  describe('POST /api/analysis/events/:eventId/impact', () => {
    test('should trigger impact analysis for an event successfully', async () => {
      // RED: This test should fail - impactAnalysisRouter doesn't exist yet
      const eventId = 'EVENT-001';
      const analysisRequest = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        preEventWindow: '7_days',
        postEventWindow: '7_days',
        includeSegmentation: true,
        analysisType: 'comprehensive'
      };

      const mockImpactResult = {
        eventId,
        analysisId: 'ANALYSIS-001',
        overallImpact: {
          magnitude: -0.15,
          direction: 'negative',
          significance: 0.032,
          confidence: 0.95
        },
        fieldImpacts: {
          sentiment_score: {
            beforeMean: 0.75,
            afterMean: 0.62,
            impact: -0.13,
            effectSize: 0.65,
            pValue: 0.001,
            confidence: 0.95
          },
          customer_satisfaction: {
            beforeMean: 0.82,
            afterMean: 0.78,
            impact: -0.04,
            effectSize: 0.25,
            pValue: 0.045,
            confidence: 0.95
          }
        },
        metadata: {
          analysisDate: '2024-01-01T10:00:00Z',
          sampleSize: 1500,
          duration: '2.3s'
        }
      };

      mockImpactCalculationService.calculateMultiFieldImpact.mockResolvedValue(mockImpactResult);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/impact`)
        .send(analysisRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          analysis: mockImpactResult,
          analysisId: 'ANALYSIS-001'
        },
        message: 'Impact analysis completed successfully'
      });

      expect(mockImpactCalculationService.calculateMultiFieldImpact).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining(analysisRequest)
      );
    });

    test('should validate analysis request parameters', async () => {
      // RED: This test should fail - validation not implemented
      const eventId = 'EVENT-001';
      const invalidRequest = {
        fields: [], // Empty fields array
        preEventWindow: 'invalid_window',
        postEventWindow: '7_days'
      };

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/impact`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid analysis parameters',
          details: {
            errors: [
              'At least one field must be specified for analysis',
              'Invalid pre-event window format'
            ]
          }
        }
      });

      expect(mockImpactCalculationService.calculateMultiFieldImpact).not.toHaveBeenCalled();
    });

    test('should handle analysis failures gracefully', async () => {
      // RED: This test should fail - error handling not implemented
      const eventId = 'EVENT-001';
      const analysisRequest = {
        fields: ['sentiment_score'],
        preEventWindow: '7_days',
        postEventWindow: '7_days'
      };

      mockImpactCalculationService.calculateMultiFieldImpact.mockRejectedValue(
        new Error('Insufficient data for analysis')
      );

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/impact`)
        .send(analysisRequest)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'analysis_error',
          message: 'Failed to perform impact analysis',
          details: {
            error: 'Insufficient data for analysis',
            eventId
          }
        }
      });
    });

    test('should support different analysis types', async () => {
      // RED: This test should fail - analysis type handling not implemented
      const eventId = 'EVENT-001';
      const quickAnalysisRequest = {
        fields: ['sentiment_score'],
        preEventWindow: '3_days',
        postEventWindow: '3_days',
        analysisType: 'quick'
      };

      const mockQuickResult = {
        eventId,
        analysisId: 'ANALYSIS-002',
        analysisType: 'quick',
        overallImpact: {
          magnitude: -0.12,
          direction: 'negative',
          significance: 0.025
        },
        metadata: {
          analysisDate: '2024-01-01T10:00:00Z',
          duration: '0.8s'
        }
      };

      mockImpactCalculationService.calculateBeforeAfterImpact.mockResolvedValue(mockQuickResult);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/impact`)
        .send(quickAnalysisRequest)
        .expect(200);

      expect(response.body.data.analysis.analysisType).toBe('quick');
      expect(mockImpactCalculationService.calculateBeforeAfterImpact).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining(quickAnalysisRequest)
      );
    });
  });

  describe('GET /api/analysis/events/:eventId/impact/:analysisId', () => {
    test('should retrieve existing impact analysis by ID', async () => {
      // RED: This test should fail - get analysis endpoint not implemented
      const eventId = 'EVENT-001';
      const analysisId = 'ANALYSIS-001';

      const mockStoredAnalysis = {
        eventId,
        analysisId,
        status: 'completed',
        overallImpact: {
          magnitude: -0.15,
          direction: 'negative',
          significance: 0.032,
          confidence: 0.95
        },
        fieldImpacts: {
          sentiment_score: {
            beforeMean: 0.75,
            afterMean: 0.62,
            impact: -0.13,
            effectSize: 0.65
          }
        },
        createdAt: '2024-01-01T10:00:00Z',
        completedAt: '2024-01-01T10:02:30Z'
      };

      mockImpactCalculationService.getAnalysisById = jest.fn().mockResolvedValue(mockStoredAnalysis);

      const response = await request(app)
        .get(`/api/analysis/events/${eventId}/impact/${analysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          analysis: mockStoredAnalysis
        }
      });

      expect(mockImpactCalculationService.getAnalysisById).toHaveBeenCalledWith(analysisId);
    });

    test('should handle non-existent analysis retrieval', async () => {
      // RED: This test should fail - not found handling not implemented
      const eventId = 'EVENT-001';
      const analysisId = 'ANALYSIS-NONEXISTENT';

      mockImpactCalculationService.getAnalysisById = jest.fn().mockRejectedValue(
        new Error('Analysis not found')
      );

      const response = await request(app)
        .get(`/api/analysis/events/${eventId}/impact/${analysisId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Impact analysis not found',
          details: {
            analysisId,
            eventId
          }
        }
      });
    });
  });

  describe('GET /api/analysis/events/:eventId/impact', () => {
    test('should list all impact analyses for an event', async () => {
      // RED: This test should fail - list analyses endpoint not implemented
      const eventId = 'EVENT-001';

      const mockAnalysesList = [
        {
          analysisId: 'ANALYSIS-001',
          eventId,
          status: 'completed',
          analysisType: 'comprehensive',
          createdAt: '2024-01-01T10:00:00Z',
          overallImpact: { magnitude: -0.15, direction: 'negative' }
        },
        {
          analysisId: 'ANALYSIS-002',
          eventId,
          status: 'completed',
          analysisType: 'quick',
          createdAt: '2024-01-01T11:00:00Z',
          overallImpact: { magnitude: -0.12, direction: 'negative' }
        }
      ];

      mockImpactCalculationService.getAnalysesByEventId = jest.fn().mockResolvedValue(mockAnalysesList);

      const response = await request(app)
        .get(`/api/analysis/events/${eventId}/impact`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          analyses: mockAnalysesList,
          count: 2,
          eventId
        }
      });

      expect(mockImpactCalculationService.getAnalysesByEventId).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining({
          status: undefined,
          analysisType: undefined,
          sortBy: undefined,
          sortOrder: undefined
        })
      );
    });

    test('should handle filtering and sorting of analyses list', async () => {
      // RED: This test should fail - filtering/sorting not implemented
      const eventId = 'EVENT-001';

      const mockFilteredAnalyses = [
        {
          analysisId: 'ANALYSIS-001',
          eventId,
          status: 'completed',
          analysisType: 'comprehensive',
          createdAt: '2024-01-01T10:00:00Z'
        }
      ];

      mockImpactCalculationService.getAnalysesByEventId.mockResolvedValue(mockFilteredAnalyses);

      const response = await request(app)
        .get(`/api/analysis/events/${eventId}/impact`)
        .query({
          status: 'completed',
          analysisType: 'comprehensive',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
        .expect(200);

      expect(mockImpactCalculationService.getAnalysesByEventId).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining({
          status: 'completed',
          analysisType: 'comprehensive',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
      );
    });
  });

  describe('POST /api/analysis/events/:eventId/effect-size', () => {
    test('should calculate effect size for event impact', async () => {
      // RED: This test should fail - effect size endpoint not implemented
      const eventId = 'EVENT-001';
      const effectSizeRequest = {
        field: 'sentiment_score',
        effectSizeType: 'cohens_d',
        confidenceLevel: 0.95
      };

      const mockEffectSizeResult = {
        effectSize: 0.65,
        effectSizeType: 'cohens_d',
        interpretation: 'medium_effect',
        confidenceInterval: {
          lowerBound: 0.42,
          upperBound: 0.88
        },
        statisticalSignificance: {
          pValue: 0.001,
          isSignificant: true
        },
        practicalSignificance: true
      };

      mockCausalAnalysisService.calculateEffectSize.mockResolvedValue(mockEffectSizeResult);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/effect-size`)
        .send(effectSizeRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          effectSizeAnalysis: mockEffectSizeResult
        }
      });

      expect(mockCausalAnalysisService.calculateEffectSize).toHaveBeenCalledWith(
        eventId,
        effectSizeRequest
      );
    });
  });

  describe('POST /api/analysis/events/:eventId/power-analysis', () => {
    test('should perform power analysis for event detection', async () => {
      // RED: This test should fail - power analysis endpoint not implemented
      const eventId = 'EVENT-001';
      const powerAnalysisRequest = {
        minimumDetectableEffect: 0.1,
        alpha: 0.05,
        desiredPower: 0.8,
        metric: 'sentiment_score'
      };

      const mockPowerResult = {
        observedPower: 0.85,
        detectedEffectSize: 0.13,
        isDetectable: true,
        requiredSampleSizeForDetection: 1200,
        actualSampleSize: 1500,
        timeWindowOptimization: {
          recommendedPreWindow: '10_days',
          recommendedPostWindow: '10_days'
        }
      };

      mockPowerAnalysisService.analyzeEventImpactPower.mockResolvedValue(mockPowerResult);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/power-analysis`)
        .send(powerAnalysisRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          powerAnalysis: mockPowerResult
        }
      });

      expect(mockPowerAnalysisService.analyzeEventImpactPower).toHaveBeenCalledWith(
        eventId,
        powerAnalysisRequest
      );
    });
  });

  describe('POST /api/analysis/events/:eventId/confidence-intervals', () => {
    test('should calculate confidence intervals for event impact', async () => {
      // RED: This test should fail - confidence intervals endpoint not implemented
      const eventId = 'EVENT-001';
      const confidenceRequest = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        confidenceLevel: 0.95,
        adjustForMultipleComparisons: true
      };

      const mockConfidenceResult = {
        eventId,
        confidenceLevel: 0.95,
        adjustedConfidenceLevel: 0.975, // Bonferroni adjusted
        fieldIntervals: {
          sentiment_score: {
            meanImpact: -0.13,
            lowerBound: -0.18,
            upperBound: -0.08,
            marginOfError: 0.05
          },
          customer_satisfaction: {
            meanImpact: -0.04,
            lowerBound: -0.07,
            upperBound: -0.01,
            marginOfError: 0.03
          }
        },
        overallInterval: {
          meanImpact: -0.085,
          lowerBound: -0.125,
          upperBound: -0.045,
          includesZero: false
        }
      };

      mockConfidenceIntervalService.calculateEventImpactConfidenceInterval.mockResolvedValue(mockConfidenceResult);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/confidence-intervals`)
        .send(confidenceRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          confidenceIntervals: mockConfidenceResult
        }
      });

      expect(mockConfidenceIntervalService.calculateEventImpactConfidenceInterval).toHaveBeenCalledWith(
        eventId,
        confidenceRequest
      );
    });
  });

  describe('POST /api/analysis/events/:eventId/comprehensive', () => {
    test('should perform comprehensive impact analysis combining all methods', async () => {
      // RED: This test should fail - comprehensive analysis endpoint not implemented
      const eventId = 'EVENT-001';
      const comprehensiveRequest = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        preEventWindow: '14_days',
        postEventWindow: '14_days',
        includeEffectSize: true,
        includePowerAnalysis: true,
        includeConfidenceIntervals: true,
        segmentAnalysis: true
      };

      const mockComprehensiveResult = {
        eventId,
        analysisId: 'COMPREHENSIVE-001',
        overview: {
          overallImpactMagnitude: -0.15,
          overallDirection: 'negative',
          statisticalSignificance: 0.001,
          practicalSignificance: true
        },
        impactAnalysis: {
          fieldImpacts: {
            sentiment_score: { impact: -0.13, significance: 0.001 },
            customer_satisfaction: { impact: -0.04, significance: 0.045 },
            churn_risk: { impact: 0.08, significance: 0.012 }
          }
        },
        effectSizeAnalysis: {
          sentiment_score: { effectSize: 0.65, interpretation: 'medium_effect' },
          customer_satisfaction: { effectSize: 0.25, interpretation: 'small_effect' }
        },
        powerAnalysis: {
          observedPower: 0.92,
          detectedEffectSize: 0.15,
          isAdequatelyPowered: true
        },
        confidenceIntervals: {
          overallInterval: {
            lowerBound: -0.195,
            upperBound: -0.105,
            includesZero: false
          }
        },
        segmentAnalysis: {
          premium_customers: { impact: -0.18, significance: 0.002 },
          basic_customers: { impact: -0.12, significance: 0.015 }
        },
        recommendations: [
          'Significant negative impact detected across all metrics',
          'Effect size indicates practically meaningful impact',
          'Consider implementing mitigation strategies for future similar events'
        ]
      };

      // Mock all service calls
      mockImpactCalculationService.calculateMultiFieldImpact.mockResolvedValue(mockComprehensiveResult.impactAnalysis);
      mockCausalAnalysisService.calculateEffectSize.mockResolvedValue(mockComprehensiveResult.effectSizeAnalysis);
      mockPowerAnalysisService.analyzeEventImpactPower.mockResolvedValue(mockComprehensiveResult.powerAnalysis);
      mockConfidenceIntervalService.calculateEventImpactConfidenceInterval.mockResolvedValue(mockComprehensiveResult.confidenceIntervals);

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/comprehensive`)
        .send(comprehensiveRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Comprehensive impact analysis completed successfully');
      expect(response.body.data.comprehensiveAnalysis).toEqual(
        expect.objectContaining({
          eventId,
          analysisId: expect.stringMatching(/^COMPREHENSIVE-\d+$/),
          impactAnalysis: mockComprehensiveResult.impactAnalysis,
          effectSizeAnalysis: mockComprehensiveResult.effectSizeAnalysis,
          powerAnalysis: mockComprehensiveResult.powerAnalysis,
          confidenceIntervals: mockComprehensiveResult.confidenceIntervals,
          overview: expect.any(Object)
        })
      );

      // Verify all services were called
      expect(mockImpactCalculationService.calculateMultiFieldImpact).toHaveBeenCalled();
      expect(mockCausalAnalysisService.calculateEffectSize).toHaveBeenCalled();
      expect(mockPowerAnalysisService.analyzeEventImpactPower).toHaveBeenCalled();
      expect(mockConfidenceIntervalService.calculateEventImpactConfidenceInterval).toHaveBeenCalled();
    });

    test('should handle partial analysis when some components fail', async () => {
      // RED: This test should fail - partial failure handling not implemented
      const eventId = 'EVENT-001';
      const comprehensiveRequest = {
        fields: ['sentiment_score'],
        preEventWindow: '7_days',
        postEventWindow: '7_days',
        includeEffectSize: true,
        includePowerAnalysis: true
      };

      // Mock successful impact analysis but failed power analysis
      mockImpactCalculationService.calculateMultiFieldImpact.mockResolvedValue({
        fieldImpacts: { sentiment_score: { impact: -0.13 } }
      });
      mockCausalAnalysisService.calculateEffectSize.mockResolvedValue({
        effectSize: 0.65, interpretation: 'medium_effect'
      });
      mockPowerAnalysisService.analyzeEventImpactPower.mockRejectedValue(
        new Error('Insufficient data for power analysis')
      );

      const response = await request(app)
        .post(`/api/analysis/events/${eventId}/comprehensive`)
        .send(comprehensiveRequest)
        .expect(206); // Partial Content

      expect(response.body.success).toBe(true);
      expect(response.body.data.comprehensiveAnalysis.impactAnalysis).toBeDefined();
      expect(response.body.data.comprehensiveAnalysis.effectSizeAnalysis).toBeDefined();
      expect(response.body.data.comprehensiveAnalysis.powerAnalysis).toBeUndefined();
      expect(response.body.warnings).toContain('Power analysis failed: Insufficient data for power analysis');
    });
  });

  describe('DELETE /api/analysis/events/:eventId/impact/:analysisId', () => {
    test('should delete an impact analysis', async () => {
      // RED: This test should fail - delete analysis endpoint not implemented
      const eventId = 'EVENT-001';
      const analysisId = 'ANALYSIS-001';

      mockImpactCalculationService.deleteAnalysis = jest.fn().mockResolvedValue({ deleted: true });

      const response = await request(app)
        .delete(`/api/analysis/events/${eventId}/impact/${analysisId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          deleted: true,
          analysisId,
          eventId
        },
        message: 'Impact analysis deleted successfully'
      });

      expect(mockImpactCalculationService.deleteAnalysis).toHaveBeenCalledWith(analysisId);
    });

    test('should handle deletion of non-existent analysis', async () => {
      // RED: This test should fail - delete not found handling not implemented
      const eventId = 'EVENT-001';
      const analysisId = 'ANALYSIS-NONEXISTENT';

      mockImpactCalculationService.deleteAnalysis = jest.fn().mockRejectedValue(
        new Error('Analysis not found')
      );

      const response = await request(app)
        .delete(`/api/analysis/events/${eventId}/impact/${analysisId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Impact analysis not found',
          details: {
            analysisId,
            eventId
          }
        }
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});