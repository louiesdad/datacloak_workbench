import { FieldSensitivityService } from '../field-sensitivity.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('FieldSensitivityService', () => {
  let service: FieldSensitivityService;
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
    
    service = new FieldSensitivityService();
  });

  describe('calculateFieldSensitivity', () => {
    test('should calculate sensitivity scores for all fields', async () => {
      // RED: This test should fail - FieldSensitivityService doesn't exist yet
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk', 'product_usage'],
        sensitivityMethod: 'variance_ratio',
        preEventDays: 7,
        postEventDays: 7,
        significanceThreshold: 0.05
      };

      const mockSensitivityData = [
        // Pre-event data
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
        // Post-event data showing different sensitivity levels
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.4, // High sensitivity
          customer_satisfaction: 0.75, // Moderate sensitivity
          churn_risk: 0.6, // High sensitivity
          product_usage: 0.85, // Low sensitivity
          period: 'post_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z',
          sentiment_score: 0.35, // High sensitivity
          customer_satisfaction: 0.72, // Moderate sensitivity
          churn_risk: 0.65, // High sensitivity
          product_usage: 0.82, // Low sensitivity
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
          return Promise.resolve(mockSensitivityData);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateFieldSensitivity(eventId, options);

      expect(result).toEqual({
        eventId,
        sensitivityScores: {
          sentiment_score: {
            sensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String),
            preEventVariance: expect.any(Number),
            postEventVariance: expect.any(Number),
            varianceRatio: expect.any(Number),
            meanChange: expect.any(Number),
            percentChange: expect.any(Number),
            significance: expect.any(Number),
            isSignificant: expect.any(Boolean),
            recoveryTime: expect.any(String),
            stabilityIndex: expect.any(Number)
          },
          customer_satisfaction: {
            sensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String),
            preEventVariance: expect.any(Number),
            postEventVariance: expect.any(Number),
            varianceRatio: expect.any(Number),
            meanChange: expect.any(Number),
            percentChange: expect.any(Number),
            significance: expect.any(Number),
            isSignificant: expect.any(Boolean),
            recoveryTime: expect.any(String),
            stabilityIndex: expect.any(Number)
          },
          churn_risk: {
            sensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String),
            preEventVariance: expect.any(Number),
            postEventVariance: expect.any(Number),
            varianceRatio: expect.any(Number),
            meanChange: expect.any(Number),
            percentChange: expect.any(Number),
            significance: expect.any(Number),
            isSignificant: expect.any(Boolean),
            recoveryTime: expect.any(String),
            stabilityIndex: expect.any(Number)
          },
          product_usage: {
            sensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String),
            preEventVariance: expect.any(Number),
            postEventVariance: expect.any(Number),
            varianceRatio: expect.any(Number),
            meanChange: expect.any(Number),
            percentChange: expect.any(Number),
            significance: expect.any(Number),
            isSignificant: expect.any(Boolean),
            recoveryTime: expect.any(String),
            stabilityIndex: expect.any(Number)
          }
        },
        ranking: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            rank: expect.any(Number),
            sensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String)
          })
        ]),
        metadata: {
          analysisDate: expect.any(String),
          sensitivityMethod: 'variance_ratio',
          fieldsAnalyzed: 4,
          significanceThreshold: 0.05,
          highSensitivityFields: expect.any(Number),
          moderateSensitivityFields: expect.any(Number),
          lowSensitivityFields: expect.any(Number)
        }
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('customer_data'),
        expect.arrayContaining(['2024-01-15T12:00:00Z'])
      );
    });

    test('should support different sensitivity calculation methods', async () => {
      // RED: This test should fail - multiple methods not implemented
      const eventId = 'EVENT-001';
      const cohensOptions = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        sensitivityMethod: 'cohens_d',
        preEventDays: 7,
        postEventDays: 7
      };

      const mockData = [
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
          sentiment_score: 0.75,
          customer_satisfaction: 0.82,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.4,
          customer_satisfaction: 0.75,
          period: 'post_event'
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z',
          sentiment_score: 0.35,
          customer_satisfaction: 0.72,
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
          return Promise.resolve(mockData);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateFieldSensitivity(eventId, cohensOptions);

      expect(result.sensitivityScores.sentiment_score).toHaveProperty('effectSize');
      expect(result.metadata.sensitivityMethod).toBe('cohens_d');
    });

    test('should handle insufficient data gracefully', async () => {
      // RED: This test should fail - error handling not implemented
      const eventId = 'EVENT-NO-DATA';
      const options = {
        fields: ['sentiment_score'],
        sensitivityMethod: 'variance_ratio',
        preEventDays: 7,
        postEventDays: 7
      };

      mockDatabase.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('SELECT start_time, end_time')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await expect(service.calculateFieldSensitivity(eventId, options))
        .rejects.toThrow('Event EVENT-NO-DATA not found');
    });

    test('should validate input parameters', async () => {
      // RED: This test should fail - validation not implemented
      const eventId = 'EVENT-001';

      // Test empty fields array
      await expect(service.calculateFieldSensitivity(eventId, {
        fields: [],
        sensitivityMethod: 'variance_ratio',
        preEventDays: 7,
        postEventDays: 7
      })).rejects.toThrow('At least one field is required for sensitivity analysis');

      // Test invalid method
      await expect(service.calculateFieldSensitivity(eventId, {
        fields: ['sentiment_score'],
        sensitivityMethod: 'invalid_method',
        preEventDays: 7,
        postEventDays: 7
      })).rejects.toThrow('Invalid sensitivity method');
    });
  });

  describe('rankFieldsByResponse', () => {
    test('should rank fields by their response magnitude to events', async () => {
      // RED: This test should fail - ranking method not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        rankingCriteria: 'response_magnitude',
        includeRecoveryMetrics: true,
        timeWindowHours: [1, 6, 24, 48]
      };

      const mockResponseData = [
        // Baseline data
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          time_window: 'baseline'
        },
        // 1 hour post-event
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T13:00:00Z',
          sentiment_score: 0.7, // -0.1 change
          customer_satisfaction: 0.83, // -0.02 change
          churn_risk: 0.3, // +0.1 change
          time_window: '1_hour'
        },
        // 24 hours post-event
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T12:00:00Z',
          sentiment_score: 0.5, // -0.3 total change
          customer_satisfaction: 0.78, // -0.07 total change
          churn_risk: 0.5, // +0.3 total change
          time_window: '24_hours'
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
          return Promise.resolve(mockResponseData);
        }
        return Promise.resolve([]);
      });

      const result = await service.rankFieldsByResponse(eventId, options);

      expect(result).toEqual({
        eventId,
        fieldRankings: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            rank: expect.any(Number),
            responseMagnitude: expect.any(Number),
            responseSpeed: expect.any(String),
            recoveryPattern: expect.any(String),
            timeToMaxImpact: expect.any(String),
            maxImpactMagnitude: expect.any(Number),
            stabilizationTime: expect.any(String),
            volatilityIndex: expect.any(Number)
          })
        ]),
        responseTimeline: {
          '1_hour': expect.objectContaining({
            sentiment_score: expect.any(Number),
            customer_satisfaction: expect.any(Number),
            churn_risk: expect.any(Number)
          }),
          '6_hours': expect.objectContaining({
            sentiment_score: expect.any(Number),
            customer_satisfaction: expect.any(Number),
            churn_risk: expect.any(Number)
          }),
          '24_hours': expect.objectContaining({
            sentiment_score: expect.any(Number),
            customer_satisfaction: expect.any(Number),
            churn_risk: expect.any(Number)
          }),
          '48_hours': expect.objectContaining({
            sentiment_score: expect.any(Number),
            customer_satisfaction: expect.any(Number),
            churn_risk: expect.any(Number)
          })
        },
        recoveryMetrics: {
          fastestRecovering: expect.any(String),
          slowestRecovering: expect.any(String),
          averageRecoveryTime: expect.any(String),
          fieldsFullyRecovered: expect.arrayContaining([expect.any(String)]),
          fieldsPartiallyRecovered: expect.any(Array),
          fieldsNotRecovered: expect.any(Array)
        },
        insights: {
          mostResponsiveField: expect.any(String),
          leastResponsiveField: expect.any(String),
          mostVolatileField: expect.any(String),
          mostStableField: expect.any(String),
          averageResponseTime: expect.any(String),
          systemStabilityScore: expect.any(Number)
        }
      });
    });

    test('should support different ranking criteria', async () => {
      // RED: This test should fail - multiple criteria not implemented
      const eventId = 'EVENT-001';
      const recoveryOptions = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        rankingCriteria: 'recovery_speed',
        timeWindowHours: [1, 6, 24]
      };

      const mockRecoveryData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          time_window: 'baseline'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T12:00:00Z',
          sentiment_score: 0.75, // Quick recovery
          customer_satisfaction: 0.7, // Slower recovery
          time_window: '24_hours'
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
          return Promise.resolve(mockRecoveryData);
        }
        return Promise.resolve([]);
      });

      const result = await service.rankFieldsByResponse(eventId, recoveryOptions);

      expect(result.fieldRankings[0]).toHaveProperty('recoverySpeed');
      expect(result.insights).toHaveProperty('fastestRecoveringField');
    });
  });

  describe('identifyVolatileFields', () => {
    test('should identify fields with high volatility patterns', async () => {
      // RED: This test should fail - volatility detection not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        volatilityMethod: 'coefficient_of_variation',
        lookbackDays: 30,
        volatilityThreshold: 0.2
      };

      const mockVolatilityData = [
        // High volatility field data
        {
          customer_id: 'CUST-001',
          date: '2024-01-01',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2
        },
        {
          customer_id: 'CUST-001',
          date: '2024-01-02',
          sentiment_score: 0.3, // High volatility
          customer_satisfaction: 0.82, // Low volatility
          churn_risk: 0.7 // High volatility
        },
        {
          customer_id: 'CUST-001',
          date: '2024-01-03',
          sentiment_score: 0.9, // High volatility
          customer_satisfaction: 0.83, // Low volatility
          churn_risk: 0.1 // High volatility
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
          return Promise.resolve(mockVolatilityData);
        }
        return Promise.resolve([]);
      });

      const result = await service.identifyVolatileFields(eventId, options);

      expect(result).toEqual({
        eventId,
        volatilityAnalysis: {
          sentiment_score: {
            volatilityScore: expect.any(Number),
            volatilityLevel: expect.any(String),
            coefficientOfVariation: expect.any(Number),
            standardDeviation: expect.any(Number),
            mean: expect.any(Number),
            volatilityRank: expect.any(Number),
            volatilityPattern: expect.any(String),
            eventSensitivity: expect.any(Number)
          },
          customer_satisfaction: {
            volatilityScore: expect.any(Number),
            volatilityLevel: expect.any(String),
            coefficientOfVariation: expect.any(Number),
            standardDeviation: expect.any(Number),
            mean: expect.any(Number),
            volatilityRank: expect.any(Number),
            volatilityPattern: expect.any(String),
            eventSensitivity: expect.any(Number)
          },
          churn_risk: {
            volatilityScore: expect.any(Number),
            volatilityLevel: expect.any(String),
            coefficientOfVariation: expect.any(Number),
            standardDeviation: expect.any(Number),
            mean: expect.any(Number),
            volatilityRank: expect.any(Number),
            volatilityPattern: expect.any(String),
            eventSensitivity: expect.any(Number)
          }
        },
        volatilityRanking: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            rank: expect.any(Number),
            volatilityScore: expect.any(Number),
            volatilityLevel: expect.any(String)
          })
        ]),
        volatilityInsights: {
          mostVolatileField: expect.any(String),
          leastVolatileField: expect.any(String),
          highVolatilityFields: expect.arrayContaining([expect.any(String)]),
          stableFields: expect.arrayContaining([expect.any(String)]),
          volatilityTrend: expect.any(String),
          systemVolatilityScore: expect.any(Number),
          riskAssessment: {
            overallRisk: expect.any(String),
            volatilityRisk: expect.any(String),
            stabilityScore: expect.any(Number)
          }
        },
        recommendations: {
          monitoringPriority: expect.arrayContaining([expect.any(String)]),
          stabilizationStrategies: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              strategy: expect.any(String),
              priority: expect.any(String)
            })
          ]),
          alertThresholds: expect.objectContaining({
            sentiment_score: expect.any(Number),
            customer_satisfaction: expect.any(Number),
            churn_risk: expect.any(Number)
          })
        }
      });
    });

    test('should filter fields by volatility threshold', async () => {
      // RED: This test should fail - threshold filtering not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        volatilityMethod: 'standard_deviation',
        lookbackDays: 30,
        volatilityThreshold: 0.5 // High threshold
      };

      const mockLowVolatilityData = [
        {
          customer_id: 'CUST-001',
          date: '2024-01-01',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85
        },
        {
          customer_id: 'CUST-001',
          date: '2024-01-02',
          sentiment_score: 0.82, // Low volatility
          customer_satisfaction: 0.83 // Low volatility
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
          return Promise.resolve(mockLowVolatilityData);
        }
        return Promise.resolve([]);
      });

      const result = await service.identifyVolatileFields(eventId, options);

      // All fields should be below threshold
      expect(result.volatilityInsights.highVolatilityFields).toHaveLength(0);
      expect(result.volatilityInsights.stableFields.length).toBeGreaterThan(0);
    });
  });

  describe('generateSensitivityProfile', () => {
    test('should generate comprehensive sensitivity profile for event', async () => {
      // RED: This test should fail - profile generation not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk', 'product_usage'],
        includeVolatilityAnalysis: true,
        includeResponseAnalysis: true,
        includePredictiveMetrics: true,
        profileDepth: 'comprehensive'
      };

      const mockProfileData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9,
          period: 'baseline'
        },
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.4,
          customer_satisfaction: 0.75,
          churn_risk: 0.6,
          product_usage: 0.85,
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
          return Promise.resolve(mockProfileData);
        }
        return Promise.resolve([]);
      });

      const result = await service.generateSensitivityProfile(eventId, options);

      expect(result).toEqual({
        eventId,
        sensitivityProfile: {
          overallSensitivity: {
            systemSensitivityScore: expect.any(Number),
            sensitivityLevel: expect.any(String),
            dominantSensitivityPattern: expect.any(String),
            stabilityRating: expect.any(String)
          },
          fieldProfiles: {
            sentiment_score: {
              sensitivityClass: expect.any(String),
              responsiveness: expect.any(String),
              volatility: expect.any(String),
              recovery: expect.any(String),
              predictability: expect.any(String),
              riskLevel: expect.any(String)
            },
            customer_satisfaction: {
              sensitivityClass: expect.any(String),
              responsiveness: expect.any(String),
              volatility: expect.any(String),
              recovery: expect.any(String),
              predictability: expect.any(String),
              riskLevel: expect.any(String)
            },
            churn_risk: {
              sensitivityClass: expect.any(String),
              responsiveness: expect.any(String),
              volatility: expect.any(String),
              recovery: expect.any(String),
              predictability: expect.any(String),
              riskLevel: expect.any(String)
            },
            product_usage: {
              sensitivityClass: expect.any(String),
              responsiveness: expect.any(String),
              volatility: expect.any(String),
              recovery: expect.any(String),
              predictability: expect.any(String),
              riskLevel: expect.any(String)
            }
          },
          sensitivityMatrix: {
            highSensitivity: expect.arrayContaining([expect.any(String)]),
            moderateSensitivity: expect.arrayContaining([expect.any(String)]),
            lowSensitivity: expect.any(Array),
            resilientFields: expect.any(Array)
          },
          predictiveInsights: {
            futureEventImpactPrediction: expect.objectContaining({
              sentiment_score: expect.any(Number),
              customer_satisfaction: expect.any(Number),
              churn_risk: expect.any(Number),
              product_usage: expect.any(Number)
            }),
            recommendedMonitoringFrequency: expect.objectContaining({
              sentiment_score: expect.any(String),
              customer_satisfaction: expect.any(String),
              churn_risk: expect.any(String),
              product_usage: expect.any(String)
            }),
            earlyWarningIndicators: expect.arrayContaining([
              expect.objectContaining({
                field: expect.any(String),
                threshold: expect.any(Number),
                leadTime: expect.any(String)
              })
            ])
          }
        },
        recommendations: {
          immediateActions: expect.arrayContaining([expect.any(String)]),
          strategicRecommendations: expect.arrayContaining([expect.any(String)]),
          monitoringStrategy: {
            criticalFields: expect.arrayContaining([expect.any(String)]),
            monitoringIntervals: expect.any(Object),
            alertThresholds: expect.any(Object),
            escalationRules: expect.arrayContaining([expect.any(String)])
          },
          mitigationStrategies: expect.arrayContaining([
            expect.objectContaining({
              strategy: expect.any(String),
              targetFields: expect.arrayContaining([expect.any(String)]),
              priority: expect.any(String),
              estimatedEffectiveness: expect.any(Number)
            })
          ])
        }
      });
    });

    test('should handle different profile depths', async () => {
      // RED: This test should fail - profile depth handling not implemented
      const eventId = 'EVENT-001';
      const basicOptions = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        profileDepth: 'basic',
        includeVolatilityAnalysis: false,
        includeResponseAnalysis: false,
        includePredictiveMetrics: false
      };

      const mockBasicData = [
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-15T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          period: 'baseline'
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
          return Promise.resolve(mockBasicData);
        }
        return Promise.resolve([]);
      });

      const result = await service.generateSensitivityProfile(eventId, basicOptions);

      expect(result.sensitivityProfile).not.toHaveProperty('predictiveInsights');
      expect(result.sensitivityProfile.fieldProfiles.sentiment_score.sensitivityClass).toBeDefined();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});