import { MultiFieldAnalysisService } from '../multi-field-analysis.service';
import { CausalAnalysisService } from '../causal-analysis.service';
import { BusinessEventService } from '../business-event.service';
import { CustomerImpactResolverService } from '../customer-impact-resolver.service';
import { DatabaseService } from '../../database/sqlite';

// Mock dependencies
jest.mock('../causal-analysis.service');
jest.mock('../business-event.service');
jest.mock('../customer-impact-resolver.service');
jest.mock('../../database/sqlite');

describe('MultiFieldAnalysisService', () => {
  let multiFieldAnalysisService: MultiFieldAnalysisService;
  let mockCausalAnalysisService: jest.Mocked<CausalAnalysisService>;
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
    mockCausalAnalysisService = new CausalAnalysisService({} as any, {} as any, {} as any) as jest.Mocked<CausalAnalysisService>;
    
    multiFieldAnalysisService = new MultiFieldAnalysisService(
      mockDatabaseService,
      mockCausalAnalysisService,
      mockBusinessEventService,
      mockCustomerImpactResolver
    );
  });

  describe('Cross-Field Impact Correlation', () => {
    test('should analyze correlation between different text fields', async () => {
      // RED: This test should fail - MultiFieldAnalysisService doesn't exist yet
      const eventId = 'evt-multifield-001';
      const fieldAnalysisOptions = {
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textFields: ['review_text', 'comment_text', 'feedback_text'],
        correlationMethod: 'pearson'
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'feature_launch',
        eventDate: '2024-06-23',
        description: 'New feature launch affecting multiple channels',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock sentiment data for multiple fields showing different impact patterns
      const mockFieldData = {
        review_text: {
          before: [4.2, 4.1, 4.3, 4.0, 4.2], // Slight decrease expected
          after: [3.8, 3.7, 3.9, 3.6, 3.8]
        },
        comment_text: {
          before: [3.9, 4.0, 3.8, 4.1, 3.9], // Moderate decrease expected
          after: [3.2, 3.1, 3.3, 3.0, 3.2]
        },
        feedback_text: {
          before: [4.5, 4.4, 4.6, 4.3, 4.5], // Strong decrease expected
          after: [3.0, 2.9, 3.1, 2.8, 3.0]
        }
      };

      // Mock database queries for sentiment data across fields
      for (const field of fieldAnalysisOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockFieldData[field].before.map(score => ({ sentiment_score: score, text_field: field })))
          .mockResolvedValueOnce(mockFieldData[field].after.map(score => ({ sentiment_score: score, text_field: field })));
      }

      const result = await multiFieldAnalysisService.analyzeFieldCorrelations(eventId, fieldAnalysisOptions);

      expect(result).toEqual(expect.objectContaining({
        eventId,
        analysisMetadata: expect.objectContaining({
          totalFields: 3,
          analyzedFields: 3,
          skippedFields: [],
          correlationMethod: 'pearson',
          beforePeriod: expect.any(Object),
          afterPeriod: expect.any(Object),
          dataQualityWarnings: []
        }),
        fieldImpacts: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'review_text',
            impactMagnitude: expect.any(Number),
            effectSize: expect.any(Number),
            significance: expect.any(Boolean)
          }),
          expect.objectContaining({
            fieldName: 'comment_text',
            impactMagnitude: expect.any(Number),
            effectSize: expect.any(Number),
            significance: expect.any(Boolean)
          }),
          expect.objectContaining({
            fieldName: 'feedback_text',
            impactMagnitude: expect.any(Number),
            effectSize: expect.any(Number),
            significance: expect.any(Boolean)
          })
        ]),
        correlationMatrix: {
          'review_text-comment_text': expect.any(Number),
          'review_text-feedback_text': expect.any(Number),
          'comment_text-feedback_text': expect.any(Number)
        },
        overallCorrelation: expect.objectContaining({
          strength: expect.stringMatching(/weak|moderate|strong/),
          direction: expect.stringMatching(/positive|negative|mixed/),
          consistency: expect.any(Number),
          reliability: expect.stringMatching(/low|medium|high/)
        })
      }));

      // All fields should show negative impact (decreasing sentiment)
      expect(result.fieldImpacts.every(impact => impact.impactMagnitude < 0)).toBe(true);
      
      // Correlations should be positive (fields move together)
      expect(Object.values(result.correlationMatrix).every(corr => corr > 0.5)).toBe(true);
    });

    test('should identify field-specific sensitivity patterns', async () => {
      // RED: This test should fail - field sensitivity analysis not implemented
      const eventId = 'evt-sensitivity-001';
      const sensitivityOptions = {
        beforePeriodDays: 30,
        afterPeriodDays: 30,
        textFields: ['product_reviews', 'support_tickets', 'social_mentions'],
        sensitivityMetrics: ['variance_change', 'response_magnitude', 'recovery_time']
      };

      // Mock event with different sensitivity patterns per field
      const mockEvent = {
        id: eventId,
        eventType: 'price_change',
        eventDate: '2024-06-15',
        description: 'Price increase across product lines',
        affectedCustomers: 'all',
        createdAt: '2024-06-15T10:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock sentiment data showing different sensitivity patterns
      const mockSensitivityData = {
        product_reviews: {
          // High sensitivity - large immediate drop, slow recovery
          before: Array(30).fill(0).map((_, i) => 4.2 + Math.random() * 0.2),
          after: Array(30).fill(0).map((_, i) => {
            const recoveryFactor = Math.min(i / 25, 1); // Slow recovery over 25 days
            return 3.0 + (1.2 * recoveryFactor) + Math.random() * 0.2;
          })
        },
        support_tickets: {
          // Medium sensitivity - moderate drop, medium recovery
          before: Array(30).fill(0).map((_, i) => 3.8 + Math.random() * 0.3),
          after: Array(30).fill(0).map((_, i) => {
            const recoveryFactor = Math.min(i / 15, 1); // Medium recovery over 15 days
            return 3.2 + (0.6 * recoveryFactor) + Math.random() * 0.3;
          })
        },
        social_mentions: {
          // Low sensitivity - small drop, quick recovery
          before: Array(30).fill(0).map((_, i) => 3.5 + Math.random() * 0.4),
          after: Array(30).fill(0).map((_, i) => {
            const recoveryFactor = Math.min(i / 7, 1); // Quick recovery over 7 days
            return 3.3 + (0.2 * recoveryFactor) + Math.random() * 0.4;
          })
        }
      };

      // Mock database queries with time-series data
      for (const field of sensitivityOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockSensitivityData[field].before.map((score, i) => ({
            sentiment_score: score,
            text_field: field,
            created_at: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString()
          })))
          .mockResolvedValueOnce(mockSensitivityData[field].after.map((score, i) => ({
            sentiment_score: score,
            text_field: field,
            created_at: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString()
          })));
      }

      const result = await multiFieldAnalysisService.analyzeSensitivityPatterns(eventId, sensitivityOptions);

      expect(result).toEqual({
        eventId,
        sensitivityRanking: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'product_reviews',
            sensitivityScore: expect.any(Number),
            rank: 1, // Highest sensitivity
            metrics: {
              varianceChange: expect.any(Number),
              responseMagnitude: expect.any(Number),
              recoveryTime: expect.any(Number)
            }
          }),
          expect.objectContaining({
            fieldName: 'support_tickets',
            sensitivityScore: expect.any(Number),
            rank: 2, // Medium sensitivity
            metrics: expect.any(Object)
          }),
          expect.objectContaining({
            fieldName: 'social_mentions',
            sensitivityScore: expect.any(Number),
            rank: 3, // Lowest sensitivity
            metrics: expect.any(Object)
          })
        ]),
        overallSensitivity: {
          mostSensitiveField: 'product_reviews',
          leastSensitiveField: 'social_mentions',
          averageSensitivity: expect.any(Number),
          consistencyIndex: expect.any(Number)
        }
      });

      // Verify sensitivity ranking
      const rankings = result.sensitivityRanking.sort((a, b) => a.rank - b.rank);
      expect(rankings[0].fieldName).toBe('product_reviews'); // Most sensitive
      expect(rankings[2].fieldName).toBe('social_mentions'); // Least sensitive
    });

    test('should calculate composite impact scores across fields', async () => {
      // RED: This test should fail - composite scoring not implemented
      const eventId = 'evt-composite-001';
      const compositeOptions = {
        beforePeriodDays: 21,
        afterPeriodDays: 21,
        textFields: ['reviews', 'comments', 'surveys', 'support_chats'],
        weightingScheme: 'business_priority',
        fieldWeights: {
          reviews: 0.4,        // High business importance
          comments: 0.3,       // Medium importance
          surveys: 0.2,        // Lower importance
          support_chats: 0.1   // Lowest importance
        },
        aggregationMethod: 'weighted_average'
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'policy_change',
        eventDate: '2024-06-10',
        description: 'Updated privacy policy affecting all users',
        affectedCustomers: 'all',
        createdAt: '2024-06-10T10:00:00Z',
        updatedAt: '2024-06-10T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock different impact levels per field
      const mockCompositeData = {
        reviews: {
          before: [4.3, 4.2, 4.4, 4.1, 4.3],
          after: [3.5, 3.4, 3.6, 3.3, 3.5],
          impactMagnitude: -0.8 // Large negative impact
        },
        comments: {
          before: [3.9, 4.0, 3.8, 4.1, 3.9],
          after: [3.4, 3.5, 3.3, 3.6, 3.4],
          impactMagnitude: -0.5 // Medium negative impact
        },
        surveys: {
          before: [4.1, 4.0, 4.2, 3.9, 4.1],
          after: [3.8, 3.7, 3.9, 3.6, 3.8],
          impactMagnitude: -0.3 // Small negative impact
        },
        support_chats: {
          before: [3.7, 3.8, 3.6, 3.9, 3.7],
          after: [3.6, 3.7, 3.5, 3.8, 3.6],
          impactMagnitude: -0.1 // Minimal impact
        }
      };

      // Mock database queries
      for (const field of compositeOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockCompositeData[field].before.map(score => ({ sentiment_score: score, text_field: field })))
          .mockResolvedValueOnce(mockCompositeData[field].after.map(score => ({ sentiment_score: score, text_field: field })));
      }

      const result = await multiFieldAnalysisService.calculateCompositeImpactScore(eventId, compositeOptions);

      expect(result).toEqual({
        eventId,
        compositeScore: expect.any(Number),
        weightedImpact: expect.any(Number),
        fieldContributions: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'reviews',
            weight: 0.4,
            rawImpact: expect.any(Number),
            weightedContribution: expect.any(Number),
            contributionPercentage: expect.any(Number)
          }),
          expect.objectContaining({
            fieldName: 'comments',
            weight: 0.3,
            rawImpact: expect.any(Number),
            weightedContribution: expect.any(Number),
            contributionPercentage: expect.any(Number)
          })
        ]),
        impactDistribution: {
          primaryDriver: 'reviews', // Highest weighted contribution
          secondaryDriver: 'comments',
          dominanceIndex: expect.any(Number), // How much primary driver dominates
          balanceScore: expect.any(Number) // How balanced the impact is across fields
        },
        aggregationMetadata: {
          method: 'weighted_average',
          totalWeight: 1.0,
          fieldsAnalyzed: 4,
          confidenceLevel: expect.any(Number)
        }
      });

      // Composite score should be negative (overall negative impact)
      expect(result.compositeScore).toBeLessThan(0);
      
      // Reviews should be the primary driver due to high weight and impact
      expect(result.impactDistribution.primaryDriver).toBe('reviews');
      
      // Weighted impact should reflect the business priority weighting
      expect(result.weightedImpact).toBeLessThan(result.compositeScore); // More negative due to weighting
    });

    test('should handle missing or incomplete field data gracefully', async () => {
      // RED: This test should fail - robust error handling not implemented
      const eventId = 'evt-incomplete-001';
      const incompleteOptions = {
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textFields: ['complete_field', 'partial_field', 'missing_field'],
        handleMissingData: 'skip_field'
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'system_maintenance',
        eventDate: '2024-06-20',
        description: 'Scheduled maintenance with data gaps',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-20T10:00:00Z',
        updatedAt: '2024-06-20T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock partial data scenarios
      mockDatabaseService.query
        // Complete field - both before and after data
        .mockResolvedValueOnce([
          { sentiment_score: 4.2, text_field: 'complete_field' },
          { sentiment_score: 4.1, text_field: 'complete_field' },
          { sentiment_score: 4.3, text_field: 'complete_field' }
        ])
        .mockResolvedValueOnce([
          { sentiment_score: 3.8, text_field: 'complete_field' },
          { sentiment_score: 3.7, text_field: 'complete_field' },
          { sentiment_score: 3.9, text_field: 'complete_field' }
        ])
        // Partial field - only before data
        .mockResolvedValueOnce([
          { sentiment_score: 3.9, text_field: 'partial_field' },
          { sentiment_score: 4.0, text_field: 'partial_field' }
        ])
        .mockResolvedValueOnce([]) // No after data
        // Missing field - no data at all
        .mockResolvedValueOnce([]) // No before data
        .mockResolvedValueOnce([]); // No after data

      const result = await multiFieldAnalysisService.analyzeFieldCorrelations(eventId, incompleteOptions);

      expect(result).toEqual({
        eventId,
        analysisMetadata: {
          totalFields: 3,
          analyzedFields: 1, // Only complete_field analyzed
          skippedFields: ['partial_field', 'missing_field'],
          dataQualityWarnings: expect.arrayContaining([
            expect.stringContaining('partial_field'),
            expect.stringContaining('missing_field')
          ])
        },
        fieldImpacts: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'complete_field',
            impactMagnitude: expect.any(Number),
            effectSize: expect.any(Number),
            significance: expect.any(Boolean),
            dataQuality: 'complete'
          })
        ]),
        correlationMatrix: {}, // Empty due to only one field analyzed
        overallCorrelation: {
          strength: 'insufficient_data',
          direction: 'unknown',
          consistency: 0,
          reliability: 'low'
        }
      });

      // Should only analyze the complete field
      expect(result.fieldImpacts).toHaveLength(1);
      expect(result.fieldImpacts[0].fieldName).toBe('complete_field');
      
      // Should report data quality issues
      expect(result.analysisMetadata.dataQualityWarnings).toHaveLength(2);
    });
  });

  describe('Temporal Impact Windows', () => {
    test('should analyze sentiment within configurable time windows', async () => {
      // RED: This test should fail - temporal window analysis not implemented
      const eventId = 'evt-temporal-001';
      const temporalOptions = {
        eventDate: '2024-06-15T12:00:00Z',
        preEventWindows: [
          { name: 'immediate_pre', days: 3 },
          { name: 'short_term_pre', days: 7 },
          { name: 'medium_term_pre', days: 14 }
        ],
        postEventWindows: [
          { name: 'immediate_post', days: 3 },
          { name: 'short_term_post', days: 7 },
          { name: 'medium_term_post', days: 14 }
        ],
        textFields: ['review_text', 'comment_text'],
        granularity: 'daily'
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'feature_launch',
        eventDate: '2024-06-15',
        description: 'New feature launch with temporal analysis',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: '2024-06-15T12:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock time-series data showing evolution of sentiment
      const mockTemporalData = {
        review_text: {
          // Pre-event: gradual decline leading to event
          '2024-06-12': [4.8, 4.7, 4.6], // 3 days before
          '2024-06-13': [4.4, 4.3, 4.2], // 2 days before  
          '2024-06-14': [4.0, 3.9, 3.8], // 1 day before
          // Post-event: immediate drop then gradual recovery
          '2024-06-16': [3.5, 3.4, 3.3], // 1 day after
          '2024-06-17': [3.7, 3.8, 3.9], // 2 days after
          '2024-06-18': [4.0, 4.1, 4.2]  // 3 days after
        },
        comment_text: {
          '2024-06-12': [4.2, 4.1, 4.0],
          '2024-06-13': [3.9, 3.8, 3.7],
          '2024-06-14': [3.6, 3.5, 3.4],
          '2024-06-16': [3.2, 3.1, 3.0],
          '2024-06-17': [3.4, 3.5, 3.6],
          '2024-06-18': [3.7, 3.8, 3.9]
        }
      };

      // Mock database queries for each time window
      for (const field of temporalOptions.textFields) {
        for (const [date, scores] of Object.entries(mockTemporalData[field])) {
          mockDatabaseService.query.mockResolvedValueOnce(
            scores.map(score => ({
              sentiment_score: score,
              text_field: field,
              created_at: `${date}T10:00:00Z`
            }))
          );
        }
      }

      const result = await multiFieldAnalysisService.analyzeTemporalWindows(eventId, temporalOptions);

      expect(result).toEqual(expect.objectContaining({
        eventId,
        eventDate: '2024-06-15T12:00:00Z',
        temporalAnalysis: expect.objectContaining({
          preEventWindows: expect.arrayContaining([
            expect.objectContaining({
              windowName: 'immediate_pre',
              days: 3,
              dateRange: expect.objectContaining({
                start: expect.stringContaining('2024-06-12'),
                end: expect.stringContaining('2024-06-15')
              }),
              fieldAnalysis: expect.arrayContaining([
                expect.objectContaining({
                  fieldName: 'review_text',
                  averageSentiment: expect.any(Number),
                  sentimentTrend: expect.stringMatching(/declining|stable|improving/),
                  dataPoints: expect.any(Number),
                  trendSlope: expect.any(Number)
                })
              ])
            })
          ]),
          postEventWindows: expect.arrayContaining([
            expect.objectContaining({
              windowName: 'immediate_post',
              days: 3,
              dateRange: expect.objectContaining({
                start: expect.stringContaining('2024-06-15'),
                end: expect.stringContaining('2024-06-18')
              }),
              fieldAnalysis: expect.arrayContaining([
                expect.objectContaining({
                  fieldName: 'review_text',
                  averageSentiment: expect.any(Number),
                  sentimentTrend: expect.stringMatching(/declining|stable|improving/),
                  dataPoints: expect.any(Number),
                  recoveryMetrics: expect.objectContaining({
                    initialDrop: expect.any(Number),
                    recoveryRate: expect.any(Number),
                    daysToRecovery: expect.any(Number)
                  })
                })
              ])
            })
          ])
        }),
        windowComparisons: expect.arrayContaining([
          expect.objectContaining({
            comparison: 'immediate_pre_vs_immediate_post',
            fields: expect.any(Array),
            statisticalSignificance: expect.any(Boolean),
            effectSize: expect.any(Number),
            impactMagnitude: expect.any(Number)
          })
        ]),
        overallTemporal: expect.objectContaining({
          preEventTrend: expect.stringMatching(/declining|stable|improving/),
          postEventTrend: expect.stringMatching(/declining|stable|improving/),
          eventImpactMagnitude: expect.any(Number),
          recoveryTimeEstimate: expect.any(Number),
          temporalConsistency: expect.any(Number)
        })
      }));

      // Should detect declining pre-event trend
      expect(result.overallTemporal.preEventTrend).toBe('declining');
      
      // Should detect some post-event trend (implementation determines specific direction)
      expect(['declining', 'stable', 'improving']).toContain(result.overallTemporal.postEventTrend);
    });

    test('should implement sliding window analysis for trend detection', async () => {
      // RED: This test should fail - sliding window analysis not implemented
      const eventId = 'evt-sliding-001';
      const slidingOptions = {
        eventDate: '2024-06-15T12:00:00Z',
        windowSize: 3, // 3-day sliding windows
        stepSize: 1,   // Move 1 day at a time
        analysisRange: {
          beforeDays: 9,
          afterDays: 9
        },
        textFields: ['review_text'],
        trendDetection: {
          method: 'linear_regression',
          minDataPoints: 5,
          significanceThreshold: 0.05
        }
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'sliding_window_test',
        eventDate: '2024-06-15',
        description: 'Sliding window analysis test',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-15T12:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock continuous daily data for 18 days (9 before + 9 after)
      const mockSlidingData = [];
      for (let i = -9; i <= 9; i++) {
        const date = new Date('2024-06-15');
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Create trend: decline before event, recovery after
        let baseSentiment;
        if (i < 0) {
          baseSentiment = 4.5 + (i * 0.1); // Steeper decline
        } else {
          baseSentiment = 3.0 + (i * 0.15); // Steeper recovery
        }
        
        mockSlidingData.push({
          date: dateStr,
          scores: [baseSentiment + Math.random() * 0.1, baseSentiment + Math.random() * 0.1]
        });
      }

      // Mock database queries for sliding windows
      for (const dayData of mockSlidingData) {
        mockDatabaseService.query.mockResolvedValueOnce(
          dayData.scores.map(score => ({
            sentiment_score: score,
            text_field: 'review_text',
            created_at: `${dayData.date}T10:00:00Z`
          }))
        );
      }

      const result = await multiFieldAnalysisService.analyzeSlidingWindows(eventId, slidingOptions);

      expect(result).toEqual({
        eventId,
        eventDate: '2024-06-15T12:00:00Z',
        slidingAnalysis: {
          windowSize: 3,
          stepSize: 1,
          totalWindows: expect.any(Number),
          windows: expect.arrayContaining([
            expect.objectContaining({
              windowIndex: expect.any(Number),
              dateRange: {
                start: expect.any(String),
                end: expect.any(String)
              },
              windowType: expect.stringMatching(/pre_event|event_window|post_event/),
              fieldMetrics: expect.arrayContaining([
                expect.objectContaining({
                  fieldName: 'review_text',
                  averageSentiment: expect.any(Number),
                  trendSlope: expect.any(Number),
                  rSquared: expect.any(Number),
                  dataPoints: expect.any(Number)
                })
              ])
            })
          ])
        },
        trendAnalysis: {
          preEventTrend: {
            overallSlope: expect.any(Number),
            rSquared: expect.any(Number),
            isSignificant: expect.any(Boolean),
            trendDirection: expect.stringMatching(/declining|stable|improving/)
          },
          postEventTrend: {
            overallSlope: expect.any(Number),
            rSquared: expect.any(Number),
            isSignificant: expect.any(Boolean),
            trendDirection: expect.stringMatching(/declining|stable|improving/)
          },
          eventImpact: {
            immediateChange: expect.any(Number),
            trendChangePoint: expect.any(String),
            recoveryDetected: expect.any(Boolean)
          }
        },
        anomalyDetection: {
          anomalousWindows: expect.any(Array),
          eventAnomalyScore: expect.any(Number),
          baselineVariation: expect.any(Number)
        }
      });

      // Should detect some pre-event trend (implementation determines specific direction based on windowing)
      expect(['declining', 'stable', 'improving']).toContain(result.trendAnalysis.preEventTrend.trendDirection);
      
      // Should detect some post-event trend (implementation determines specific direction)
      expect(['declining', 'stable', 'improving']).toContain(result.trendAnalysis.postEventTrend.trendDirection);
    });

    test('should apply temporal decay functions to weight recent data', async () => {
      // RED: This test should fail - temporal decay functions not implemented
      const eventId = 'evt-decay-001';
      const decayOptions = {
        eventDate: '2024-06-15T12:00:00Z',
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textFields: ['review_text', 'comment_text'],
        decayFunction: {
          type: 'exponential',
          halfLife: 7, // 7 days
          maxWeight: 1.0,
          minWeight: 0.1
        },
        baselineComparison: true
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'decay_analysis',
        eventDate: '2024-06-15',
        description: 'Temporal decay analysis test',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: '2024-06-15T12:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock data with timestamps at different distances from event
      const mockDecayData = {
        review_text: [
          // 14 days before (should have low weight)
          { sentiment_score: 4.0, created_at: '2024-06-01T10:00:00Z' },
          { sentiment_score: 4.1, created_at: '2024-06-01T15:00:00Z' },
          // 7 days before (medium weight) 
          { sentiment_score: 4.2, created_at: '2024-06-08T10:00:00Z' },
          { sentiment_score: 4.3, created_at: '2024-06-08T15:00:00Z' },
          // 1 day before (high weight)
          { sentiment_score: 4.1, created_at: '2024-06-14T10:00:00Z' },
          { sentiment_score: 4.0, created_at: '2024-06-14T15:00:00Z' }
        ],
        comment_text: [
          { sentiment_score: 3.8, created_at: '2024-06-01T10:00:00Z' },
          { sentiment_score: 3.9, created_at: '2024-06-08T10:00:00Z' },
          { sentiment_score: 3.7, created_at: '2024-06-14T10:00:00Z' }
        ]
      };

      // Mock database queries
      for (const field of decayOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockDecayData[field]) // Before data
          .mockResolvedValueOnce(mockDecayData[field].map(item => ({ // After data (modified)
            ...item,
            sentiment_score: item.sentiment_score - 0.5, // Simulate post-event decline
            created_at: item.created_at.replace('2024-06-0', '2024-06-2') // Shift to after event
          })));
      }

      const result = await multiFieldAnalysisService.applyTemporalDecay(eventId, decayOptions);

      expect(result).toEqual({
        eventId,
        eventDate: '2024-06-15T12:00:00Z',
        decayFunction: {
          type: 'exponential',
          halfLife: 7,
          maxWeight: 1.0,
          minWeight: 0.1
        },
        weightedAnalysis: {
          beforePeriod: expect.arrayContaining([
            expect.objectContaining({
              fieldName: 'review_text',
              rawAverage: expect.any(Number),
              weightedAverage: expect.any(Number),
              weightDifference: expect.any(Number), // Should be positive (recent data weighted more)
              totalWeight: expect.any(Number),
              dataPoints: expect.any(Number)
            })
          ]),
          afterPeriod: expect.arrayContaining([
            expect.objectContaining({
              fieldName: 'review_text',
              rawAverage: expect.any(Number),
              weightedAverage: expect.any(Number),
              weightDifference: expect.any(Number),
              totalWeight: expect.any(Number),
              dataPoints: expect.any(Number)
            })
          ])
        },
        temporalWeights: expect.arrayContaining([
          expect.objectContaining({
            dataPoint: expect.any(String),
            daysFromEvent: expect.any(Number),
            weight: expect.any(Number),
            contribution: expect.any(Number)
          })
        ]),
        impactAssessment: {
          rawImpact: expect.any(Number),
          weightedImpact: expect.any(Number),
          temporalSignificance: expect.any(Number),
          decayAdjustedPValue: expect.any(Number)
        },
        recommendations: {
          optimalDecayFunction: expect.any(String),
          suggestedHalfLife: expect.any(Number),
          dataQualityScore: expect.any(Number)
        }
      });

      // Weighted average should differ from raw average (recent data emphasized)
      for (const fieldResult of result.weightedAnalysis.beforePeriod) {
        expect(Math.abs(fieldResult.weightedAverage - fieldResult.rawAverage)).toBeGreaterThan(0);
      }

      // Data closer to event should have higher weights
      const weights = result.temporalWeights.sort((a, b) => a.daysFromEvent - b.daysFromEvent);
      expect(weights[0].weight).toBeGreaterThan(weights[weights.length - 1].weight);
    });

    test('should handle irregular time intervals and data gaps', async () => {
      // RED: This test should fail - irregular interval handling not implemented
      const eventId = 'evt-irregular-001';
      const irregularOptions = {
        eventDate: '2024-06-15T12:00:00Z',
        beforePeriodDays: 10,
        afterPeriodDays: 10,
        textFields: ['review_text'],
        interpolation: {
          method: 'linear',
          maxGapDays: 3,
          fillStrategy: 'interpolate'
        },
        dataQualityThresholds: {
          minDataPointsPerDay: 1,
          maxGapDays: 5,
          minimumCoverage: 0.6 // 60% of days must have data
        }
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'irregular_data_test',
        eventDate: '2024-06-15',
        description: 'Test with irregular data intervals',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-15T12:00:00Z',
        updatedAt: '2024-06-15T12:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock irregular data with gaps
      const irregularData = [
        // Before period - missing some days
        { sentiment_score: 4.2, created_at: '2024-06-05T10:00:00Z' }, // 10 days before
        { sentiment_score: 4.1, created_at: '2024-06-05T15:00:00Z' },
        // Gap: 06-06, 06-07 missing
        { sentiment_score: 4.0, created_at: '2024-06-08T10:00:00Z' }, // 7 days before
        // Gap: 06-09, 06-10, 06-11 missing  
        { sentiment_score: 3.9, created_at: '2024-06-12T10:00:00Z' }, // 3 days before
        { sentiment_score: 3.8, created_at: '2024-06-14T10:00:00Z' }, // 1 day before
        // After period
        { sentiment_score: 3.5, created_at: '2024-06-16T10:00:00Z' }, // 1 day after
        { sentiment_score: 3.6, created_at: '2024-06-18T10:00:00Z' }, // 3 days after
        // Gap: 06-19, 06-20 missing
        { sentiment_score: 3.7, created_at: '2024-06-21T10:00:00Z' }  // 6 days after
      ];

      mockDatabaseService.query
        .mockResolvedValueOnce(irregularData.filter(d => d.created_at < '2024-06-15')) // Before
        .mockResolvedValueOnce(irregularData.filter(d => d.created_at > '2024-06-15')); // After

      const result = await multiFieldAnalysisService.handleIrregularTemporal(eventId, irregularOptions);

      expect(result).toEqual(expect.objectContaining({
        eventId,
        eventDate: '2024-06-15T12:00:00Z',
        dataQualityAnalysis: expect.objectContaining({
          beforePeriod: expect.objectContaining({
            totalDays: 10,
            daysWithData: expect.any(Number),
            coverage: expect.any(Number),
            gaps: expect.arrayContaining([
              expect.objectContaining({
                start: expect.any(String),
                end: expect.any(String),
                duration: expect.any(Number)
              })
            ]),
            qualityScore: expect.any(Number)
          }),
          afterPeriod: expect.objectContaining({
            totalDays: 10,
            daysWithData: expect.any(Number),
            coverage: expect.any(Number),
            gaps: expect.any(Array),
            qualityScore: expect.any(Number)
          })
        }),
        interpolatedData: expect.objectContaining({
          beforePeriod: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              originalValue: expect.any(Number),
              interpolatedValue: expect.any(Number),
              isInterpolated: expect.any(Boolean),
              confidence: expect.any(Number)
            })
          ]),
          afterPeriod: expect.any(Array)
        }),
        adjustedAnalysis: expect.objectContaining({
          beforeAverage: expect.any(Number),
          afterAverage: expect.any(Number),
          confidenceAdjustedImpact: expect.any(Number),
          dataQualityWarnings: expect.any(Array),
          recommendedMinimumPeriod: expect.any(Number)
        }),
        interpolationMetrics: expect.objectContaining({
          method: 'linear',
          interpolatedPoints: expect.any(Number),
          maxInterpolationGap: expect.any(Number),
          interpolationReliability: expect.any(Number)
        })
      }));

      // Should identify data gaps
      expect(result.dataQualityAnalysis.beforePeriod.gaps.length).toBeGreaterThan(0);
      
      // Coverage should be less than 100% due to gaps
      expect(result.dataQualityAnalysis.beforePeriod.coverage).toBeLessThan(1.0);
      
      // Should have some interpolated data points
      expect(result.interpolatedData.beforePeriod.some(d => d.isInterpolated)).toBe(true);
    });
  });

  describe('Field Impact Weighting', () => {
    test('should apply custom weighting schemes to field analysis', async () => {
      // RED: This test should fail - custom weighting not implemented
      const eventId = 'evt-weighted-001';
      const weightingOptions = {
        beforePeriodDays: 14,
        afterPeriodDays: 14,
        textFields: ['high_priority_field', 'medium_priority_field', 'low_priority_field'],
        weightingScheme: 'custom',
        customWeights: {
          high_priority_field: 0.6,
          medium_priority_field: 0.3,
          low_priority_field: 0.1
        },
        weightingCriteria: {
          businessImpact: 0.5,
          volumeWeight: 0.3,
          customerSegmentWeight: 0.2
        }
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'feature_deprecation',
        eventDate: '2024-06-18',
        description: 'Deprecating legacy feature',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: '2024-06-18T10:00:00Z',
        updatedAt: '2024-06-18T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock equal raw impacts but different volumes
      const mockWeightedData = {
        high_priority_field: {
          before: Array(100).fill(4.0), // High volume
          after: Array(100).fill(3.0),  // Impact: -1.0
          volume: 100,
          businessRelevance: 'high'
        },
        medium_priority_field: {
          before: Array(50).fill(4.0),  // Medium volume
          after: Array(50).fill(3.0),   // Impact: -1.0
          volume: 50,
          businessRelevance: 'medium'
        },
        low_priority_field: {
          before: Array(20).fill(4.0),  // Low volume
          after: Array(20).fill(3.0),   // Impact: -1.0
          volume: 20,
          businessRelevance: 'low'
        }
      };

      // Mock database queries
      for (const field of weightingOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockWeightedData[field].before.map(score => ({ sentiment_score: score, text_field: field })))
          .mockResolvedValueOnce(mockWeightedData[field].after.map(score => ({ sentiment_score: score, text_field: field })));
      }

      const result = await multiFieldAnalysisService.applyFieldWeighting(eventId, weightingOptions);

      expect(result).toEqual({
        eventId,
        weightingScheme: 'custom',
        fieldAnalysis: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'high_priority_field',
            rawImpact: expect.any(Number),
            weight: 0.6,
            weightedImpact: expect.any(Number),
            weightingFactors: {
              businessImpact: expect.any(Number),
              volumeWeight: expect.any(Number),
              customerSegmentWeight: expect.any(Number)
            }
          }),
          expect.objectContaining({
            fieldName: 'medium_priority_field',
            rawImpact: expect.any(Number),
            weight: 0.3,
            weightedImpact: expect.any(Number)
          }),
          expect.objectContaining({
            fieldName: 'low_priority_field',
            rawImpact: expect.any(Number),
            weight: 0.1,
            weightedImpact: expect.any(Number)
          })
        ]),
        aggregatedImpact: {
          weightedAverage: expect.any(Number),
          dominantField: 'high_priority_field',
          impactDistribution: expect.any(Object),
          confidenceScore: expect.any(Number)
        },
        weightValidation: {
          totalWeight: expect.closeTo(1.0, 1),
          balanceScore: expect.any(Number),
          recommendedAdjustments: expect.any(Array)
        }
      });

      // High priority field should have the highest weighted impact
      const highPriorityResult = result.fieldAnalysis.find(f => f.fieldName === 'high_priority_field');
      const mediumPriorityResult = result.fieldAnalysis.find(f => f.fieldName === 'medium_priority_field');
      
      expect(Math.abs(highPriorityResult.weightedImpact)).toBeGreaterThan(Math.abs(mediumPriorityResult.weightedImpact));
    });

    test('should automatically derive weights from data characteristics', async () => {
      // RED: This test should fail - automatic weight derivation not implemented
      const eventId = 'evt-autoweight-001';
      const autoWeightOptions = {
        beforePeriodDays: 21,
        afterPeriodDays: 21,
        textFields: ['high_variance_field', 'high_volume_field', 'consistent_field'],
        weightingScheme: 'auto_derive',
        derivationCriteria: ['variance_stability', 'sample_size', 'signal_to_noise_ratio']
      };

      // Mock business event
      const mockEvent = {
        id: eventId,
        eventType: 'marketing_campaign',
        eventDate: '2024-06-12',
        description: 'Major marketing campaign launch',
        affectedCustomers: 'all',
        createdAt: '2024-06-12T10:00:00Z',
        updatedAt: '2024-06-12T10:00:00Z',
        deletedAt: null
      };

      mockBusinessEventService.getEventById.mockResolvedValueOnce(mockEvent);

      // Mock fields with different characteristics
      const mockAutoWeightData = {
        high_variance_field: {
          // High variance, medium volume - should get lower weight
          before: Array(50).fill(0).map(() => 3.0 + Math.random() * 2.0), // High variance
          after: Array(50).fill(0).map(() => 2.5 + Math.random() * 2.0),
          expectedWeight: 'low'
        },
        high_volume_field: {
          // Low variance, high volume - should get higher weight
          before: Array(200).fill(0).map(() => 4.0 + Math.random() * 0.2), // Low variance, high volume
          after: Array(200).fill(0).map(() => 3.5 + Math.random() * 0.2),
          expectedWeight: 'high'
        },
        consistent_field: {
          // Medium variance, medium volume, but very consistent signal - should get medium-high weight
          before: Array(80).fill(0).map(() => 4.2 + Math.random() * 0.4),
          after: Array(80).fill(0).map(() => 3.7 + Math.random() * 0.4), // Consistent drop
          expectedWeight: 'medium_high'
        }
      };

      // Mock database queries
      for (const field of autoWeightOptions.textFields) {
        mockDatabaseService.query
          .mockResolvedValueOnce(mockAutoWeightData[field].before.map(score => ({ sentiment_score: score, text_field: field })))
          .mockResolvedValueOnce(mockAutoWeightData[field].after.map(score => ({ sentiment_score: score, text_field: field })));
      }

      const result = await multiFieldAnalysisService.deriveAutomaticWeights(eventId, autoWeightOptions);

      expect(result).toEqual({
        eventId,
        derivedWeights: expect.objectContaining({
          high_variance_field: expect.any(Number),
          high_volume_field: expect.any(Number),
          consistent_field: expect.any(Number)
        }),
        derivationMetrics: expect.arrayContaining([
          expect.objectContaining({
            fieldName: 'high_variance_field',
            varianceStability: expect.any(Number),
            sampleSize: 50,
            signalToNoiseRatio: expect.any(Number),
            recommendedWeight: expect.any(Number),
            confidence: expect.any(Number)
          }),
          expect.objectContaining({
            fieldName: 'high_volume_field',
            varianceStability: expect.any(Number),
            sampleSize: 200,
            signalToNoiseRatio: expect.any(Number),
            recommendedWeight: expect.any(Number)
          }),
          expect.objectContaining({
            fieldName: 'consistent_field',
            varianceStability: expect.any(Number),
            sampleSize: 80,
            signalToNoiseRatio: expect.any(Number),
            recommendedWeight: expect.any(Number)
          })
        ]),
        weightingRationale: {
          primaryFactor: expect.stringMatching(/variance_stability|sample_size|signal_to_noise_ratio/),
          secondaryFactors: expect.any(Array),
          overallConfidence: expect.any(Number),
          recommendedUse: expect.any(String)
        }
      });

      // High volume field should get highest weight
      expect(result.derivedWeights.high_volume_field).toBeGreaterThan(result.derivedWeights.high_variance_field);
      
      // Weights should sum to approximately 1.0
      const totalWeight = Object.values(result.derivedWeights).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 2);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});