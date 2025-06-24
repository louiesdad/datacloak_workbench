import { CompositeImpactScoringService } from '../composite-impact-scoring.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('CompositeImpactScoringService', () => {
  let service: CompositeImpactScoringService;
  let mockDatabase: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDatabase = {
      query: jest.fn(),
      run: jest.fn(),
      close: jest.fn(),
    } as any;

    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabase);
    
    // Set up default mock for event query
    mockDatabase.query.mockImplementation((query: string, params: any[]) => {
      if (query.includes('SELECT start_time, end_time')) {
        return Promise.resolve([{
          start_time: '2024-01-15T12:00:00Z',
          end_time: '2024-01-15T13:00:00Z'
        }]);
      }
      return Promise.resolve([]);
    });
    
    service = new CompositeImpactScoringService();
  });

  describe('calculateCompositeScore', () => {
    test('should calculate weighted composite score from multiple field impacts', async () => {
      // RED: This test should fail - CompositeImpactScoringService doesn't exist yet
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk', 'product_usage'],
        weightingStrategy: 'user_defined',
        fieldWeights: {
          sentiment_score: 0.3,
          customer_satisfaction: 0.25,
          churn_risk: 0.25,
          product_usage: 0.2
        },
        includeConfidenceInterval: true,
        confidenceLevel: 0.95
      };

      const mockFieldImpacts = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-08T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-08T11:00:00Z',
          sentiment_score: 0.75,
          customer_satisfaction: 0.82,
          churn_risk: 0.25,
          product_usage: 0.88,
          period: 'pre_event'
        },
        // Post-event data showing composite impact
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.5, // -0.3 impact
          customer_satisfaction: 0.7, // -0.15 impact
          churn_risk: 0.6, // +0.4 impact (negative direction)
          product_usage: 0.8, // -0.1 impact
          period: 'post_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z',
          sentiment_score: 0.45, // -0.3 impact
          customer_satisfaction: 0.67, // -0.15 impact
          churn_risk: 0.65, // +0.4 impact (negative direction)
          product_usage: 0.78, // -0.1 impact
          period: 'post_event'
        }
      ];

      // Set up specific mock for this test
      mockDatabase.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('SELECT start_time, end_time')) {
          return Promise.resolve([{
            start_time: '2024-01-15T12:00:00Z',
            end_time: '2024-01-15T13:00:00Z'
          }]);
        }
        if (query.includes('customer_data')) {
          return Promise.resolve(mockFieldImpacts);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateCompositeScore(eventId, options);

      expect(result).toEqual({
        eventId,
        compositeScore: {
          overallScore: expect.any(Number),
          direction: 'negative',
          magnitude: expect.any(Number),
          significance: expect.any(Number),
          confidenceInterval: {
            lowerBound: expect.any(Number),
            upperBound: expect.any(Number),
            confidenceLevel: 0.95
          }
        },
        fieldContributions: {
          sentiment_score: {
            weight: 0.3,
            impact: expect.any(Number),
            weightedContribution: expect.any(Number),
            significanceToOverall: expect.any(Number)
          },
          customer_satisfaction: {
            weight: 0.25,
            impact: expect.any(Number),
            weightedContribution: expect.any(Number),
            significanceToOverall: expect.any(Number)
          },
          churn_risk: {
            weight: 0.25,
            impact: expect.any(Number),
            weightedContribution: expect.any(Number),
            significanceToOverall: expect.any(Number)
          },
          product_usage: {
            weight: 0.2,
            impact: expect.any(Number),
            weightedContribution: expect.any(Number),
            significanceToOverall: expect.any(Number)
          }
        },
        scoreMetadata: {
          weightingStrategy: 'user_defined',
          fieldsAnalyzed: 4,
          totalWeight: 1.0,
          calculationDate: expect.any(String),
          dataPoints: expect.any(Number)
        }
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('customer_data'),
        expect.arrayContaining(['2024-01-15T12:00:00Z'])
      );
    });

    test('should support different weighting strategies', async () => {
      // RED: This test should fail - multiple weighting strategies not implemented
      const eventId = 'EVENT-001';
      const equalWeightOptions = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        weightingStrategy: 'equal_weight',
        includeConfidenceInterval: false
      };

      const mockEqualWeightData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-08T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.5,
          customer_satisfaction: 0.7,
          churn_risk: 0.6,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('SELECT start_time, end_time')) {
          return Promise.resolve([{
            start_time: '2024-01-15T12:00:00Z',
            end_time: '2024-01-15T13:00:00Z'
          }]);
        }
        if (query.includes('customer_data')) {
          return Promise.resolve(mockEqualWeightData);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateCompositeScore(eventId, equalWeightOptions);

      expect(result.scoreMetadata.weightingStrategy).toBe('equal_weight');
      expect(result.fieldContributions.sentiment_score.weight).toBeCloseTo(0.333, 2);
      expect(result.fieldContributions.customer_satisfaction.weight).toBeCloseTo(0.333, 2);
      expect(result.fieldContributions.churn_risk.weight).toBeCloseTo(0.333, 2);
    });

    test('should handle variance-based weighting strategy', async () => {
      // RED: This test should fail - variance weighting not implemented
      const eventId = 'EVENT-001';
      const varianceWeightOptions = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        weightingStrategy: 'variance_based',
        includeConfidenceInterval: true,
        confidenceLevel: 0.99
      };

      const mockVarianceData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-08T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-08T11:00:00Z',
          sentiment_score: 0.9, // Higher variance
          customer_satisfaction: 0.86, // Lower variance
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.4, // High impact
          customer_satisfaction: 0.8, // Low impact
          period: 'post_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z',
          sentiment_score: 0.3, // High impact
          customer_satisfaction: 0.81, // Low impact
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('SELECT start_time, end_time')) {
          return Promise.resolve([{
            start_time: '2024-01-15T12:00:00Z',
            end_time: '2024-01-15T13:00:00Z'
          }]);
        }
        if (query.includes('customer_data')) {
          return Promise.resolve(mockVarianceData);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateCompositeScore(eventId, varianceWeightOptions);

      expect(result.scoreMetadata.weightingStrategy).toBe('variance_based');
      expect(result.compositeScore.confidenceInterval.confidenceLevel).toBe(0.99);
      // sentiment_score should have higher weight due to higher variance
      expect(result.fieldContributions.sentiment_score.weight).toBeGreaterThan(
        result.fieldContributions.customer_satisfaction.weight
      );
    });

    test('should validate input parameters', async () => {
      // RED: This test should fail - validation not implemented
      const eventId = 'EVENT-001';

      // Test empty fields array
      await expect(service.calculateCompositeScore(eventId, {
        fields: [],
        weightingStrategy: 'equal_weight'
      })).rejects.toThrow('At least one field is required for composite scoring');

      // Test invalid weighting strategy
      await expect(service.calculateCompositeScore(eventId, {
        fields: ['sentiment_score'],
        weightingStrategy: 'invalid_strategy'
      })).rejects.toThrow('Invalid weighting strategy');

      // Test invalid confidence level
      await expect(service.calculateCompositeScore(eventId, {
        fields: ['sentiment_score'],
        weightingStrategy: 'equal_weight',
        includeConfidenceInterval: true,
        confidenceLevel: 1.5
      })).rejects.toThrow('Confidence level must be between 0 and 1');

      // Test user_defined strategy without weights
      await expect(service.calculateCompositeScore(eventId, {
        fields: ['sentiment_score', 'customer_satisfaction'],
        weightingStrategy: 'user_defined'
      })).rejects.toThrow('Field weights are required for user_defined strategy');

      // Test weights that don't sum to 1
      await expect(service.calculateCompositeScore(eventId, {
        fields: ['sentiment_score', 'customer_satisfaction'],
        weightingStrategy: 'user_defined',
        fieldWeights: {
          sentiment_score: 0.6,
          customer_satisfaction: 0.6
        }
      })).rejects.toThrow('Field weights must sum to 1.0');
    });
  });

  describe('generateRiskAssessment', () => {
    test('should generate comprehensive risk assessment from composite scores', async () => {
      // RED: This test should fail - risk assessment not implemented
      const eventId = 'EVENT-001';
      const options = {
        riskFactors: ['impact_magnitude', 'volatility', 'recovery_time', 'customer_exposure'],
        riskThresholds: {
          low: 0.1,
          medium: 0.3,
          high: 0.7
        },
        includeActionableInsights: true,
        includeTemporalAnalysis: true
      };

      const mockRiskData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          period: 'baseline'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T13:00:00Z',
          sentiment_score: 0.4,
          customer_satisfaction: 0.6,
          churn_risk: 0.8,
          period: 'post_event'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T13:00:00Z',
          sentiment_score: 0.6,
          customer_satisfaction: 0.75,
          churn_risk: 0.5,
          period: 'recovery'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockRiskData);

      const result = await service.generateRiskAssessment(eventId, options);

      expect(result).toEqual({
        eventId,
        riskAssessment: {
          overallRiskLevel: expect.any(String),
          riskScore: expect.any(Number),
          riskFactorAnalysis: {
            impact_magnitude: {
              score: expect.any(Number),
              level: expect.any(String),
              contribution: expect.any(Number),
              description: expect.any(String)
            },
            volatility: {
              score: expect.any(Number),
              level: expect.any(String),
              contribution: expect.any(Number),
              description: expect.any(String)
            },
            recovery_time: {
              score: expect.any(Number),
              level: expect.any(String),
              contribution: expect.any(Number),
              description: expect.any(String)
            },
            customer_exposure: {
              score: expect.any(Number),
              level: expect.any(String),
              contribution: expect.any(Number),
              description: expect.any(String)
            }
          },
          riskDrivers: expect.arrayContaining([
            expect.objectContaining({
              factor: expect.any(String),
              impact: expect.any(String),
              priority: expect.any(String)
            })
          ])
        },
        temporalRiskProfile: {
          riskEvolution: expect.arrayContaining([
            expect.objectContaining({
              timePoint: expect.any(String),
              riskLevel: expect.any(String),
              riskScore: expect.any(Number)
            })
          ]),
          peakRiskTime: expect.any(String),
          riskDecayRate: expect.any(Number),
          projectedStabilization: expect.any(String)
        },
        actionableInsights: {
          immediateActions: expect.arrayContaining([expect.any(String)]),
          mitigationStrategies: expect.arrayContaining([
            expect.objectContaining({
              strategy: expect.any(String),
              priority: expect.any(String),
              estimatedEffectiveness: expect.any(Number),
              timeToImplement: expect.any(String)
            })
          ]),
          monitoringRecommendations: expect.arrayContaining([
            expect.objectContaining({
              metric: expect.any(String),
              frequency: expect.any(String),
              threshold: expect.any(Number),
              escalationCriteria: expect.any(String)
            })
          ]),
          preventiveActions: expect.arrayContaining([expect.any(String)])
        },
        confidenceMetrics: {
          assessmentConfidence: expect.any(Number),
          dataQuality: expect.any(String),
          uncertaintyFactors: expect.arrayContaining([expect.any(String)]),
          recommendedFollowUp: expect.any(String)
        }
      });
    });

    test('should handle different risk threshold configurations', async () => {
      // RED: This test should fail - custom thresholds not implemented
      const eventId = 'EVENT-001';
      const customThresholdOptions = {
        riskFactors: ['impact_magnitude', 'volatility'],
        riskThresholds: {
          low: 0.05,
          medium: 0.2,
          high: 0.5,
          critical: 0.8
        },
        includeActionableInsights: false,
        includeTemporalAnalysis: false
      };

      const mockCustomData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          period: 'baseline'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T13:00:00Z',
          sentiment_score: 0.2, // High impact
          customer_satisfaction: 0.3, // High impact
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockCustomData);

      const result = await service.generateRiskAssessment(eventId, customThresholdOptions);

      expect(result.riskAssessment.overallRiskLevel).toBe('critical');
      expect(result.temporalRiskProfile).toBeUndefined();
      expect(result.actionableInsights).toBeUndefined();
    });
  });

  describe('performSensitivityAnalysis', () => {
    test('should analyze how weight changes affect composite scores', async () => {
      // RED: This test should fail - sensitivity analysis not implemented
      const eventId = 'EVENT-001';
      const options = {
        baselineWeights: {
          sentiment_score: 0.4,
          customer_satisfaction: 0.3,
          churn_risk: 0.3
        },
        sensitivityRange: 0.2, // +/- 20% variation
        sensitivitySteps: 5,
        includeScenarioAnalysis: true,
        includeOptimalWeighting: true
      };

      const mockSensitivityData = [
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.5,
          customer_satisfaction: 0.6,
          churn_risk: 0.7,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockSensitivityData);

      const result = await service.performSensitivityAnalysis(eventId, options);

      expect(result).toEqual({
        eventId,
        baselineScore: {
          compositeScore: expect.any(Number),
          weights: options.baselineWeights
        },
        sensitivityResults: {
          sentiment_score: expect.arrayContaining([
            expect.objectContaining({
              weightVariation: expect.any(Number),
              newCompositeScore: expect.any(Number),
              scoreChange: expect.any(Number),
              sensitivity: expect.any(Number)
            })
          ]),
          customer_satisfaction: expect.arrayContaining([
            expect.objectContaining({
              weightVariation: expect.any(Number),
              newCompositeScore: expect.any(Number),
              scoreChange: expect.any(Number),
              sensitivity: expect.any(Number)
            })
          ]),
          churn_risk: expect.arrayContaining([
            expect.objectContaining({
              weightVariation: expect.any(Number),
              newCompositeScore: expect.any(Number),
              scoreChange: expect.any(Number),
              sensitivity: expect.any(Number)
            })
          ])
        },
        scenarioAnalysis: {
          bestCase: {
            weights: expect.any(Object),
            compositeScore: expect.any(Number),
            improvement: expect.any(Number)
          },
          worstCase: {
            weights: expect.any(Object),
            compositeScore: expect.any(Number),
            deterioration: expect.any(Number)
          },
          mostLikelyCase: {
            weights: expect.any(Object),
            compositeScore: expect.any(Number),
            expectedVariance: expect.any(Number)
          }
        },
        optimalWeighting: {
          recommendedWeights: expect.any(Object),
          expectedImprovement: expect.any(Number),
          optimizationCriteria: expect.any(String),
          confidenceInRecommendation: expect.any(Number)
        },
        insights: {
          mostSensitiveField: expect.any(String),
          leastSensitiveField: expect.any(String),
          stabilityAssessment: expect.any(String),
          recommendations: expect.arrayContaining([expect.any(String)])
        }
      });
    });

    test('should handle edge cases in sensitivity analysis', async () => {
      // RED: This test should fail - edge case handling not implemented
      const eventId = 'EVENT-001';
      const extremeOptions = {
        baselineWeights: {
          sentiment_score: 1.0 // Single field
        },
        sensitivityRange: 0.1,
        sensitivitySteps: 3,
        includeScenarioAnalysis: false,
        includeOptimalWeighting: false
      };

      const mockSingleFieldData = [
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.3,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockSingleFieldData);

      const result = await service.performSensitivityAnalysis(eventId, extremeOptions);

      expect(result.baselineScore.weights.sentiment_score).toBe(1.0);
      expect(result.sensitivityResults.sentiment_score).toHaveLength(3);
      expect(result.scenarioAnalysis).toBeUndefined();
      expect(result.optimalWeighting).toBeUndefined();
    });
  });

  describe('generateCompositeReport', () => {
    test('should generate comprehensive report combining all composite scoring analyses', async () => {
      // RED: This test should fail - report generation not implemented
      const eventId = 'EVENT-001';
      const options = {
        reportSections: ['composite_score', 'risk_assessment', 'sensitivity_analysis', 'recommendations'],
        includeVisualizations: true,
        includeStatisticalDetails: true,
        reportFormat: 'comprehensive'
      };

      const mockReportData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T13:00:00Z',
          sentiment_score: 0.4,
          customer_satisfaction: 0.6,
          churn_risk: 0.8,
          product_usage: 0.3,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockReportData);

      const result = await service.generateCompositeReport(eventId, options);

      expect(result).toEqual({
        eventId,
        reportMetadata: {
          generatedAt: expect.any(String),
          reportFormat: 'comprehensive',
          sectionsIncluded: ['composite_score', 'risk_assessment', 'sensitivity_analysis', 'recommendations'],
          dataPointsAnalyzed: expect.any(Number),
          analysisConfidence: expect.any(Number)
        },
        executiveSummary: {
          overallImpactAssessment: expect.any(String),
          keyFindings: expect.arrayContaining([expect.any(String)]),
          riskLevel: expect.any(String),
          recommendedActions: expect.arrayContaining([expect.any(String)]),
          timeToRecovery: expect.any(String),
          businessImpact: expect.any(String)
        },
        compositeScoreAnalysis: {
          finalCompositeScore: expect.any(Number),
          scoreInterpretation: expect.any(String),
          confidenceInterval: expect.any(Object),
          fieldContributions: expect.any(Object),
          temporalEvolution: expect.arrayContaining([
            expect.objectContaining({
              timePoint: expect.any(String),
              score: expect.any(Number)
            })
          ])
        },
        riskAssessmentSummary: {
          overallRiskLevel: expect.any(String),
          primaryRiskFactors: expect.arrayContaining([expect.any(String)]),
          mitigationPriorities: expect.arrayContaining([expect.any(String)]),
          monitoringRequirements: expect.arrayContaining([expect.any(String)])
        },
        sensitivityInsights: {
          weightingSensitivity: expect.any(String),
          optimalWeightingRecommendation: expect.any(Object),
          robustnessAssessment: expect.any(String),
          uncertaintyFactors: expect.arrayContaining([expect.any(String)])
        },
        actionableRecommendations: {
          immediateActions: expect.arrayContaining([
            expect.objectContaining({
              action: expect.any(String),
              priority: expect.any(String),
              expectedImpact: expect.any(String),
              timeline: expect.any(String)
            })
          ]),
          strategicRecommendations: expect.arrayContaining([
            expect.objectContaining({
              recommendation: expect.any(String),
              rationale: expect.any(String),
              implementation: expect.any(String),
              successMetrics: expect.arrayContaining([expect.any(String)])
            })
          ]),
          monitoringPlan: {
            keyMetrics: expect.arrayContaining([expect.any(String)]),
            monitoringFrequency: expect.any(String),
            alertThresholds: expect.any(Object),
            escalationProcedures: expect.arrayContaining([expect.any(String)])
          }
        },
        appendices: {
          technicalDetails: expect.any(Object),
          dataQualityAssessment: expect.any(Object),
          methodologyNotes: expect.arrayContaining([expect.any(String)]),
          limitations: expect.arrayContaining([expect.any(String)])
        }
      });
    });

    test('should support different report formats', async () => {
      // RED: This test should fail - multiple report formats not implemented
      const eventId = 'EVENT-001';
      const summaryOptions = {
        reportSections: ['composite_score', 'recommendations'],
        includeVisualizations: false,
        includeStatisticalDetails: false,
        reportFormat: 'summary'
      };

      const mockSummaryData = [
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.5,
          customer_satisfaction: 0.7,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockSummaryData);

      const result = await service.generateCompositeReport(eventId, summaryOptions);

      expect(result.reportMetadata.reportFormat).toBe('summary');
      expect(result.reportMetadata.sectionsIncluded).toHaveLength(2);
      expect(result).toHaveProperty('executiveSummary');
      expect(result).toHaveProperty('compositeScoreAnalysis');
      expect(result).toHaveProperty('actionableRecommendations');
      expect(result.riskAssessmentSummary).toBeUndefined();
      expect(result.sensitivityInsights).toBeUndefined();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});