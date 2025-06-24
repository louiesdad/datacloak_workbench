import { CrossFieldImpactService } from '../cross-field-impact.service';
import { DatabaseService } from '../../database/sqlite';

// Mock the database service
jest.mock('../../database/sqlite');

describe('CrossFieldImpactService', () => {
  let service: CrossFieldImpactService;
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
    
    service = new CrossFieldImpactService();
  });

  describe('detectCrossFieldCorrelations', () => {
    test('should detect strong positive correlations between fields', async () => {
      // RED: This test should fail - CrossFieldImpactService doesn't exist yet
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        correlationThreshold: 0.7,
        preEventDays: 7,
        postEventDays: 7
      };

      const mockQueryResults = [
        // Pre-event data showing normal correlations
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-08T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2
        },
        {
          customer_id: 'CUST-002', 
          timestamp: '2024-01-08T11:00:00Z',
          sentiment_score: 0.7,
          customer_satisfaction: 0.75,
          churn_risk: 0.3
        },
        // Post-event data showing changed correlations
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.5,
          customer_satisfaction: 0.4,
          churn_risk: 0.8
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z', 
          sentiment_score: 0.6,
          customer_satisfaction: 0.5,
          churn_risk: 0.7
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
          return Promise.resolve(mockQueryResults);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectCrossFieldCorrelations(eventId, options);

      expect(result).toEqual({
        eventId,
        correlationMatrix: {
          preEvent: {
            'sentiment_score:customer_satisfaction': {
              correlation: expect.closeTo(0.95, 1),
              strength: 'strong_positive',
              significance: expect.any(Number),
              sampleSize: 2
            },
            'sentiment_score:churn_risk': {
              correlation: expect.closeTo(-0.95, 1),
              strength: 'strong_negative', 
              significance: expect.any(Number),
              sampleSize: 2
            },
            'customer_satisfaction:churn_risk': {
              correlation: expect.closeTo(-0.95, 1),
              strength: 'strong_negative',
              significance: expect.any(Number),
              sampleSize: 2
            }
          },
          postEvent: {
            'sentiment_score:customer_satisfaction': {
              correlation: expect.closeTo(0.95, 1),
              strength: 'strong_positive',
              significance: expect.any(Number),
              sampleSize: 2
            },
            'sentiment_score:churn_risk': {
              correlation: expect.closeTo(-0.95, 1),
              strength: 'strong_negative',
              significance: expect.any(Number), 
              sampleSize: 2
            },
            'customer_satisfaction:churn_risk': {
              correlation: expect.closeTo(-0.95, 1),
              strength: 'strong_negative',
              significance: expect.any(Number),
              sampleSize: 2
            }
          }
        },
        correlationChanges: {
          'sentiment_score:customer_satisfaction': {
            beforeCorrelation: expect.any(Number),
            afterCorrelation: expect.any(Number),
            changeInCorrelation: expect.any(Number),
            changeSignificance: expect.any(Number),
            changeInterpretation: expect.any(String)
          },
          'sentiment_score:churn_risk': {
            beforeCorrelation: expect.any(Number),
            afterCorrelation: expect.any(Number),
            changeInCorrelation: expect.any(Number),
            changeSignificance: expect.any(Number),
            changeInterpretation: expect.any(String)
          },
          'customer_satisfaction:churn_risk': {
            beforeCorrelation: expect.any(Number),
            afterCorrelation: expect.any(Number),
            changeInCorrelation: expect.any(Number),
            changeSignificance: expect.any(Number),
            changeInterpretation: expect.any(String)
          }
        },
        strongCorrelations: expect.arrayContaining([
          expect.objectContaining({
            fieldPair: expect.any(String),
            correlationStrength: expect.any(String),
            impactOnRelationship: expect.any(String)
          })
        ]),
        metadata: {
          analysisDate: expect.any(String),
          correlationThreshold: 0.7,
          fieldsAnalyzed: 3,
          fieldPairsAnalyzed: 3,
          dataPointsPreEvent: 2,
          dataPointsPostEvent: 2
        }
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([eventId])
      );
    });

    test('should handle insufficient data gracefully', async () => {
      // RED: This test should fail - error handling not implemented
      const eventId = 'EVENT-NO-DATA';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        correlationThreshold: 0.5,
        preEventDays: 7,
        postEventDays: 7
      };

      // Mock that event is not found
      mockDatabase.query.mockImplementation((query: string, params: any[]) => {
        if (query.includes('SELECT start_time, end_time')) {
          return Promise.resolve([]); // No event found
        }
        return Promise.resolve([]);
      });

      await expect(service.detectCrossFieldCorrelations(eventId, options))
        .rejects.toThrow('Event EVENT-NO-DATA not found');
    });

    test('should validate input parameters', async () => {
      // RED: This test should fail - validation not implemented
      const eventId = 'EVENT-001';

      // Test empty fields array
      await expect(service.detectCrossFieldCorrelations(eventId, {
        fields: [],
        correlationThreshold: 0.5,
        preEventDays: 7,
        postEventDays: 7
      })).rejects.toThrow('At least two fields are required for cross-field analysis');

      // Test single field
      await expect(service.detectCrossFieldCorrelations(eventId, {
        fields: ['sentiment_score'],
        correlationThreshold: 0.5,
        preEventDays: 7,
        postEventDays: 7
      })).rejects.toThrow('At least two fields are required for cross-field analysis');

      // Test invalid correlation threshold
      await expect(service.detectCrossFieldCorrelations(eventId, {
        fields: ['sentiment_score', 'customer_satisfaction'],
        correlationThreshold: 1.5,
        preEventDays: 7,
        postEventDays: 7
      })).rejects.toThrow('Correlation threshold must be between 0 and 1');
    });

    test('should filter weak correlations based on threshold', async () => {
      // RED: This test should fail - threshold filtering not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        correlationThreshold: 0.8, // High threshold
        preEventDays: 7,
        postEventDays: 7
      };

      const mockQueryResults = [
        // Pre-event data with moderate correlations (should be filtered out)
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-08T10:00:00Z',
          sentiment_score: 0.8,
          customer_satisfaction: 0.7, // Moderate correlation
          churn_risk: 0.5
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-08T11:00:00Z',
          sentiment_score: 0.6,
          customer_satisfaction: 0.6,
          churn_risk: 0.4
        },
        // Post-event data 
        {
          customer_id: 'CUST-001',
          timestamp: '2024-01-16T10:00:00Z',
          sentiment_score: 0.7,
          customer_satisfaction: 0.65,
          churn_risk: 0.45
        },
        {
          customer_id: 'CUST-002',
          timestamp: '2024-01-16T11:00:00Z',
          sentiment_score: 0.5,
          customer_satisfaction: 0.55,
          churn_risk: 0.35
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
          return Promise.resolve(mockQueryResults);
        }
        return Promise.resolve([]);
      });

      const result = await service.detectCrossFieldCorrelations(eventId, options);

      // Should only include strong correlations above 0.8 threshold
      expect(result.strongCorrelations).toHaveLength(0);
      expect(result.metadata.correlationThreshold).toBe(0.8);
    });
  });

  describe('calculateFieldInteractionEffects', () => {
    test('should calculate interaction effects between multiple fields', async () => {
      // RED: This test should fail - interaction effects calculation not implemented
      const eventId = 'EVENT-001';
      const options = {
        primaryField: 'sentiment_score',
        interactionFields: ['customer_satisfaction', 'churn_risk', 'product_usage'],
        modelType: 'linear_regression',
        includeQuadraticTerms: true
      };

      const mockQueryResults = [
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9,
          period: 'pre_event'
        },
        {
          customer_id: 'CUST-001',
          sentiment_score: 0.5,
          customer_satisfaction: 0.4,
          churn_risk: 0.8,
          product_usage: 0.3,
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
          return Promise.resolve(mockQueryResults);
        }
        return Promise.resolve([]);
      });

      const result = await service.calculateFieldInteractionEffects(eventId, options);

      expect(result).toEqual({
        eventId,
        primaryField: 'sentiment_score',
        interactionAnalysis: {
          mainEffects: {
            customer_satisfaction: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              effectSize: expect.any(Number)
            },
            churn_risk: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              effectSize: expect.any(Number)
            },
            product_usage: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              effectSize: expect.any(Number)
            }
          },
          interactionEffects: {
            'customer_satisfaction:churn_risk': {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              interactionStrength: expect.any(String)
            },
            'customer_satisfaction:product_usage': {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              interactionStrength: expect.any(String)
            },
            'churn_risk:product_usage': {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String),
              interactionStrength: expect.any(String)
            }
          },
          quadraticEffects: {
            customer_satisfaction_squared: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String)
            },
            churn_risk_squared: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String)
            },
            product_usage_squared: {
              coefficient: expect.any(Number),
              pValue: expect.any(Number),
              significance: expect.any(String)
            }
          }
        },
        modelPerformance: {
          rSquared: expect.any(Number),
          adjustedRSquared: expect.any(Number),
          fStatistic: expect.any(Number),
          fPValue: expect.any(Number),
          residualStandardError: expect.any(Number),
          degreesOfFreedom: expect.any(Number)
        },
        eventImpactOnInteractions: {
          significantInteractionChanges: expect.arrayContaining([
            expect.objectContaining({
              interactionPair: expect.any(String),
              preEventStrength: expect.any(Number),
              postEventStrength: expect.any(Number),
              changeInInteraction: expect.any(Number),
              changeSignificance: expect.any(Number)
            })
          ]),
          overallInteractionPattern: expect.any(String),
          dominantInteractions: expect.arrayContaining([
            expect.any(String)
          ])
        },
        insights: {
          strongestInteraction: expect.any(String),
          mostImpactedByEvent: expect.any(String),
          recommendedMonitoring: expect.arrayContaining([
            expect.any(String)
          ])
        }
      });
    });

    test('should support different regression models', async () => {
      // RED: This test should fail - multiple model types not implemented
      const eventId = 'EVENT-001';
      
      const logisticOptions = {
        primaryField: 'churn_risk',
        interactionFields: ['sentiment_score', 'customer_satisfaction'],
        modelType: 'logistic_regression',
        includeQuadraticTerms: false
      };

      const mockBinaryData = [
        {
          customer_id: 'CUST-001',
          churn_risk: 1,
          sentiment_score: 0.3,
          customer_satisfaction: 0.2,
          period: 'post_event'
        }
      ];

      mockDatabase.query.mockResolvedValue(mockBinaryData);

      const result = await service.calculateFieldInteractionEffects(eventId, logisticOptions);

      expect(result.interactionAnalysis).toHaveProperty('mainEffects');
      expect(result.interactionAnalysis).toHaveProperty('interactionEffects');
      expect(result.modelPerformance).toHaveProperty('logLikelihood');
      expect(result.modelPerformance).toHaveProperty('aicScore');
    });
  });

  describe('identifyFieldDependencies', () => {
    test('should identify causal relationships and dependencies between fields', async () => {
      // RED: This test should fail - dependency identification not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk', 'product_usage'],
        dependencyMethod: 'granger_causality',
        lagPeriods: [1, 2, 3],
        significanceLevel: 0.05
      };

      const mockTimeSeriesData = [
        // Time series data with clear dependencies
        {
          timestamp: '2024-01-08T10:00:00Z',
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9
        },
        {
          timestamp: '2024-01-08T11:00:00Z',
          customer_id: 'CUST-001',
          sentiment_score: 0.7,
          customer_satisfaction: 0.75,
          churn_risk: 0.3,
          product_usage: 0.8
        }
      ];

      mockDatabase.query.mockResolvedValue(mockTimeSeriesData);

      const result = await service.identifyFieldDependencies(eventId, options);

      expect(result).toEqual({
        eventId,
        dependencyNetwork: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              field: expect.any(String),
              influence: expect.any(Number),
              influenced: expect.any(Number),
              centrality: expect.any(Number)
            })
          ]),
          edges: expect.any(Array)
        }),
        grangerCausalityResults: expect.objectContaining({
          'sentiment_score→customer_satisfaction': expect.objectContaining({
            fStatistic: expect.any(Number),
            pValue: expect.any(Number),
            isCausal: expect.any(Boolean),
            optimalLag: expect.any(Number),
            causalStrength: expect.any(String)
          }),
          'customer_satisfaction→churn_risk': expect.objectContaining({
            fStatistic: expect.any(Number),
            pValue: expect.any(Number),
            isCausal: expect.any(Boolean),
            optimalLag: expect.any(Number),
            causalStrength: expect.any(String)
          })
        }),
        eventImpactOnDependencies: expect.objectContaining({
          newDependencies: expect.any(Array),
          brokenDependencies: expect.any(Array),
          strengthenedDependencies: expect.any(Array)
        }),
        criticalPaths: expect.arrayContaining([
          expect.objectContaining({
            path: expect.arrayContaining([expect.any(String)]),
            pathStrength: expect.any(Number),
            vulnerability: expect.any(String),
            eventSensitivity: expect.any(Number)
          })
        ]),
        recommendations: expect.objectContaining({
          primaryInfluencers: expect.arrayContaining([expect.any(String)]),
          monitoringPriority: expect.arrayContaining([expect.any(String)]),
          interventionPoints: expect.arrayContaining([expect.any(String)])
        })
      });
    });

    test('should detect circular dependencies', async () => {
      // RED: This test should fail - circular dependency detection not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk'],
        dependencyMethod: 'mutual_information',
        detectCircularDependencies: true
      };

      const mockCircularData = [
        // Data that creates circular dependencies
        {
          timestamp: '2024-01-08T10:00:00Z',
          customer_id: 'CUST-001',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2
        }
      ];

      mockDatabase.query.mockResolvedValue(mockCircularData);

      const result = await service.identifyFieldDependencies(eventId, options);

      expect(result).toHaveProperty('circularDependencies');
      expect(result.circularDependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cycle: expect.arrayContaining([expect.any(String)]),
            cycleStrength: expect.any(Number),
            stabilityRisk: expect.any(String)
          })
        ])
      );
    });
  });

  describe('generateCrossFieldImpactMatrix', () => {
    test('should generate comprehensive impact matrix across all field combinations', async () => {
      // RED: This test should fail - impact matrix generation not implemented
      const eventId = 'EVENT-001';
      const options = {
        fields: ['sentiment_score', 'customer_satisfaction', 'churn_risk', 'product_usage'],
        matrixType: 'comprehensive',
        includeDirectEffects: true,
        includeIndirectEffects: true,
        includeFeedbackLoops: true
      };

      const mockComprehensiveData = [
        {
          customer_id: 'CUST-001',
          period: 'pre_event',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85,
          churn_risk: 0.2,
          product_usage: 0.9
        },
        {
          customer_id: 'CUST-001',
          period: 'post_event',
          sentiment_score: 0.5,
          customer_satisfaction: 0.4,
          churn_risk: 0.8,
          product_usage: 0.3
        }
      ];

      mockDatabase.query.mockResolvedValue(mockComprehensiveData);

      const result = await service.generateCrossFieldImpactMatrix(eventId, options);

      expect(result).toEqual({
        eventId,
        impactMatrix: {
          directEffects: expect.objectContaining({
            'sentiment_score→customer_satisfaction': expect.objectContaining({
              preEventImpact: expect.any(Number),
              postEventImpact: expect.any(Number),
              impactChange: expect.any(Number),
              changeSignificance: expect.any(Number),
              effectStrength: expect.any(String)
            }),
            'customer_satisfaction→churn_risk': expect.objectContaining({
              preEventImpact: expect.any(Number),
              postEventImpact: expect.any(Number),
              impactChange: expect.any(Number),
              changeSignificance: expect.any(Number),
              effectStrength: expect.any(String)
            })
          }),
          indirectEffects: expect.objectContaining({
            'sentiment_score→churn_risk (via customer_satisfaction)': expect.objectContaining({
              mediationStrength: expect.any(Number),
              indirectImpact: expect.any(Number),
              mediationSignificance: expect.any(Number),
              percentageMediated: expect.any(Number)
            })
          }),
          feedbackLoops: expect.objectContaining({
            'sentiment_score↔customer_satisfaction': expect.objectContaining({
              loopStrength: expect.any(Number),
              stability: expect.any(String),
              oscillationRisk: expect.any(Number),
              dampingFactor: expect.any(Number)
            })
          })
        },
        networkMetrics: expect.objectContaining({
          density: expect.any(Number),
          centralityScores: expect.objectContaining({
            betweenness: expect.any(Object),
            closeness: expect.any(Object),
            eigenvector: expect.any(Object)
          }),
          clusteringCoefficient: expect.any(Number),
          smallWorldIndex: expect.any(Number)
        }),
        eventImpactSummary: expect.objectContaining({
          mostImpactedRelationships: expect.arrayContaining([
            expect.objectContaining({
              relationship: expect.any(String),
              impactMagnitude: expect.any(Number),
              impactType: expect.any(String)
            })
          ]),
          emergentConnections: expect.any(Array),
          severedConnections: expect.any(Array),
          overallNetworkStability: expect.any(String)
        }),
        insights: expect.objectContaining({
          keyInsights: expect.arrayContaining([expect.any(String)]),
          riskAssessment: expect.objectContaining({
            systemicRisk: expect.any(String),
            cascadeRisk: expect.any(String),
            recoveryComplexity: expect.any(String)
          }),
          recommendedInterventions: expect.arrayContaining([
            expect.objectContaining({
              intervention: expect.any(String),
              priority: expect.any(String),
              expectedImpact: expect.any(String)
            })
          ])
        })
      });
    });

    test('should handle different matrix types', async () => {
      // RED: This test should fail - matrix type handling not implemented
      const eventId = 'EVENT-001';
      
      // Test simplified matrix
      const simplifiedOptions = {
        fields: ['sentiment_score', 'customer_satisfaction'],
        matrixType: 'simplified',
        includeDirectEffects: true,
        includeIndirectEffects: false,
        includeFeedbackLoops: false
      };

      const mockSimpleData = [
        {
          customer_id: 'CUST-001',
          period: 'pre_event',
          sentiment_score: 0.8,
          customer_satisfaction: 0.85
        }
      ];

      mockDatabase.query.mockResolvedValue(mockSimpleData);

      const result = await service.generateCrossFieldImpactMatrix(eventId, simplifiedOptions);

      expect(result.impactMatrix).toHaveProperty('directEffects');
      expect(result.impactMatrix).not.toHaveProperty('indirectEffects');
      expect(result.impactMatrix).not.toHaveProperty('feedbackLoops');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});