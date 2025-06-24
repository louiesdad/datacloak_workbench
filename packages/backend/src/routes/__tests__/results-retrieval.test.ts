import request from 'supertest';
import express from 'express';
import { resultsRetrievalRouter } from '../results-retrieval';
import { ImpactCalculatorService } from '../../services/impact-calculator.service';
import { BusinessEventService } from '../../services/business-event.service';
import { AnalyticsService } from '../../services/analytics.service';

// Mock the services
jest.mock('../../services/impact-calculator.service');
jest.mock('../../services/business-event.service');
jest.mock('../../services/analytics.service');

describe('Results Retrieval Endpoint', () => {
  let app: express.Application;
  let mockImpactCalculatorService: jest.Mocked<ImpactCalculatorService>;
  let mockBusinessEventService: jest.Mocked<BusinessEventService>;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockImpactCalculatorService = {
      calculateBeforeAfterImpact: jest.fn(),
      calculateMultiFieldImpact: jest.fn(),
      getAnalysisById: jest.fn(),
      getAnalysesByEventId: jest.fn(),
      generateImpactReport: jest.fn(),
      getAnalysisHistory: jest.fn(),
      getAggregatedResults: jest.fn(),
    } as any;

    mockBusinessEventService = {
      getEvent: jest.fn(),
      getAllEvents: jest.fn(),
      getEventsByTimeRange: jest.fn(),
    } as any;

    mockAnalyticsService = {
      getOverview: jest.fn(),
      generateCustomReport: jest.fn(),
      exportData: jest.fn(),
    } as any;

    // Create class mocks that return our mock instances
    (ImpactCalculatorService as any) = jest.fn(() => mockImpactCalculatorService);
    (BusinessEventService as any) = jest.fn(() => mockBusinessEventService);
    (AnalyticsService as any) = jest.fn(() => mockAnalyticsService);

    app = express();
    app.use(express.json());
    app.use('/api/results', resultsRetrievalRouter);
  });

  describe('GET /api/results/events/:eventId/summary', () => {
    test('should retrieve comprehensive event impact summary', async () => {
      // RED: This test should fail - resultsRetrievalRouter doesn't exist yet
      const eventId = 'EVENT-001';

      const mockEvent = {
        id: eventId,
        name: 'Product Launch Q1',
        type: 'product_launch',
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T18:00:00Z',
        severity: 'major',
        status: 'completed'
      };

      const mockAnalyses = [
        {
          analysisId: 'ANALYSIS-001',
          eventId,
          status: 'completed',
          analysisType: 'comprehensive',
          createdAt: '2024-01-15T19:00:00Z',
          overallImpact: {
            magnitude: -0.15,
            direction: 'negative',
            significance: 0.001
          }
        },
        {
          analysisId: 'ANALYSIS-002',
          eventId,
          status: 'completed',
          analysisType: 'quick',
          createdAt: '2024-01-15T20:00:00Z',
          overallImpact: {
            magnitude: -0.12,
            direction: 'negative',
            significance: 0.005
          }
        }
      ];

      const expectedSummary = {
        event: mockEvent,
        impactSummary: {
          totalAnalyses: 2,
          completedAnalyses: 2,
          pendingAnalyses: 0,
          averageImpactMagnitude: -0.135,
          consistentDirection: 'negative',
          significanceLevel: 'high',
          lastAnalysisDate: '2024-01-15T20:00:00Z'
        },
        latestAnalysis: mockAnalyses[1],
        trendAnalysis: {
          impactTrend: 'improving',
          changeFromFirst: 0.03,
          analysisFrequency: 'hourly'
        }
      };

      mockBusinessEventService.getEvent.mockResolvedValue(mockEvent);
      mockImpactCalculatorService.getAnalysesByEventId.mockResolvedValue(mockAnalyses);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/summary`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: expectedSummary
      });

      expect(mockBusinessEventService.getEvent).toHaveBeenCalledWith(eventId);
      expect(mockImpactCalculatorService.getAnalysesByEventId).toHaveBeenCalledWith(eventId);
    });

    test('should handle events with no analyses', async () => {
      // RED: This test should fail - empty analysis handling not implemented
      const eventId = 'EVENT-NO-ANALYSIS';

      const mockEvent = {
        id: eventId,
        name: 'Event with No Analysis',
        type: 'system_outage',
        startTime: '2024-01-16T09:00:00Z',
        severity: 'medium',
        status: 'registered'
      };

      mockBusinessEventService.getEvent.mockResolvedValue(mockEvent);
      mockImpactCalculatorService.getAnalysesByEventId.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/summary`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          event: mockEvent,
          impactSummary: {
            totalAnalyses: 0,
            completedAnalyses: 0,
            pendingAnalyses: 0,
            averageImpactMagnitude: null,
            consistentDirection: null,
            significanceLevel: null,
            lastAnalysisDate: null
          },
          latestAnalysis: null,
          trendAnalysis: null,
          message: 'No impact analyses found for this event'
        }
      });
    });

    test('should handle non-existent events', async () => {
      // RED: This test should fail - not found handling not implemented
      const eventId = 'EVENT-NONEXISTENT';

      mockBusinessEventService.getEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .get(`/api/results/events/${eventId}/summary`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            eventId
          }
        }
      });
    });
  });

  describe('GET /api/results/events/:eventId/detailed', () => {
    test('should retrieve detailed analysis results with full breakdown', async () => {
      // RED: This test should fail - detailed results endpoint not implemented
      const eventId = 'EVENT-001';

      const mockDetailedAnalysis = {
        analysisId: 'ANALYSIS-001',
        eventId,
        status: 'completed',
        analysisType: 'comprehensive',
        fieldImpacts: {
          sentiment_score: {
            beforeMean: 0.75,
            afterMean: 0.62,
            impact: -0.13,
            effectSize: 0.65,
            pValue: 0.001,
            confidenceInterval: {
              lowerBound: -0.18,
              upperBound: -0.08
            }
          },
          customer_satisfaction: {
            beforeMean: 0.82,
            afterMean: 0.78,
            impact: -0.04,
            effectSize: 0.25,
            pValue: 0.045,
            confidenceInterval: {
              lowerBound: -0.07,
              upperBound: -0.01
            }
          },
          churn_risk: {
            beforeMean: 0.15,
            afterMean: 0.23,
            impact: 0.08,
            effectSize: 0.45,
            pValue: 0.012,
            confidenceInterval: {
              lowerBound: 0.02,
              upperBound: 0.14
            }
          }
        },
        statisticalSummary: {
          overallSignificance: 0.001,
          bonferroniAdjustedAlpha: 0.0167,
          significantFields: ['sentiment_score', 'churn_risk'],
          effectSizeDistribution: {
            small: 1,
            medium: 2,
            large: 0
          }
        },
        temporalAnalysis: {
          recoveryMetrics: {
            sentiment_score: {
              recoveryTime: '48_hours',
              recoveryPercentage: 0.85,
              isFullyRecovered: false
            },
            customer_satisfaction: {
              recoveryTime: '24_hours',
              recoveryPercentage: 0.95,
              isFullyRecovered: true
            }
          },
          impactProgression: [
            { timePoint: '1_hour', aggregateImpact: -0.05 },
            { timePoint: '6_hours', aggregateImpact: -0.12 },
            { timePoint: '24_hours', aggregateImpact: -0.15 },
            { timePoint: '48_hours', aggregateImpact: -0.10 }
          ]
        }
      };

      mockImpactCalculatorService.getAnalysisById.mockResolvedValue(mockDetailedAnalysis);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/detailed`)
        .query({ analysisId: 'ANALYSIS-001' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          detailedResults: mockDetailedAnalysis,
          interpretation: {
            overallAssessment: 'significant_negative_impact',
            keyFindings: [
              'Sentiment score showed the strongest negative impact (-0.13)',
              'Customer satisfaction had a small but significant decline (-0.04)',
              'Churn risk increased significantly (+0.08)',
              'Recovery was partial, with customer satisfaction recovering faster than sentiment'
            ],
            recommendations: [
              'Monitor sentiment recovery closely over the next 48 hours',
              'Implement customer retention strategies to address increased churn risk',
              'Consider proactive communication to rebuild customer satisfaction'
            ]
          }
        }
      });

      expect(mockImpactCalculatorService.getAnalysisById).toHaveBeenCalledWith('ANALYSIS-001');
    });

    test('should use latest analysis when analysisId not specified', async () => {
      // RED: This test should fail - latest analysis fallback not implemented
      const eventId = 'EVENT-001';

      const mockAnalyses = [
        {
          analysisId: 'ANALYSIS-001',
          eventId,
          createdAt: '2024-01-15T19:00:00Z',
          status: 'completed'
        },
        {
          analysisId: 'ANALYSIS-002',
          eventId,
          createdAt: '2024-01-15T20:00:00Z',
          status: 'completed'
        }
      ];

      const mockLatestAnalysis = {
        analysisId: 'ANALYSIS-002',
        eventId,
        status: 'completed',
        fieldImpacts: {},
        statisticalSummary: {},
        temporalAnalysis: {}
      };

      mockImpactCalculatorService.getAnalysesByEventId.mockResolvedValue(mockAnalyses);
      mockImpactCalculatorService.getAnalysisById.mockResolvedValue(mockLatestAnalysis);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/detailed`)
        .expect(200);

      expect(response.body.data.detailedResults.analysisId).toBe('ANALYSIS-002');
      expect(mockImpactCalculatorService.getAnalysesByEventId).toHaveBeenCalledWith(eventId);
      expect(mockImpactCalculatorService.getAnalysisById).toHaveBeenCalledWith('ANALYSIS-002');
    });

    test('should handle events with no completed analyses', async () => {
      // RED: This test should fail - no analysis handling not implemented
      const eventId = 'EVENT-NO-COMPLETED';

      mockImpactCalculatorService.getAnalysesByEventId.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/detailed`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'No completed analyses found for this event',
          details: {
            eventId,
            availableAnalyses: 0
          }
        }
      });
    });
  });

  describe('GET /api/results/events/:eventId/export', () => {
    test('should export analysis results in CSV format', async () => {
      // RED: This test should fail - export functionality not implemented
      const eventId = 'EVENT-001';

      const mockExportData = {
        format: 'csv',
        filename: 'event_001_analysis_20240115.csv',
        data: 'field,before_mean,after_mean,impact,effect_size,p_value\nsentiment_score,0.75,0.62,-0.13,0.65,0.001\ncustomer_satisfaction,0.82,0.78,-0.04,0.25,0.045',
        metadata: {
          exportDate: '2024-01-15T21:00:00Z',
          eventId,
          analysisCount: 1,
          fieldsIncluded: ['sentiment_score', 'customer_satisfaction']
        }
      };

      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/export`)
        .query({ format: 'csv' })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="event_001_analysis_20240115.csv"/);
      expect(response.text).toBe(mockExportData.data);

      expect(mockAnalyticsService.exportData).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining({ format: 'csv' })
      );
    });

    test('should export analysis results in JSON format', async () => {
      // RED: This test should fail - JSON export not implemented
      const eventId = 'EVENT-001';

      const mockExportData = {
        format: 'json',
        filename: 'event_001_analysis_20240115.json',
        data: JSON.stringify({
          event: { id: eventId, name: 'Product Launch Q1' },
          analyses: [
            {
              analysisId: 'ANALYSIS-001',
              fieldImpacts: {
                sentiment_score: { impact: -0.13, effectSize: 0.65 }
              }
            }
          ]
        }),
        metadata: {
          exportDate: '2024-01-15T21:00:00Z',
          eventId,
          analysisCount: 1
        }
      };

      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/export`)
        .query({ format: 'json' })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="event_001_analysis_20240115.json"/);
      expect(response.body).toEqual(JSON.parse(mockExportData.data));
    });

    test('should export analysis results in PDF format', async () => {
      // RED: This test should fail - PDF export not implemented
      const eventId = 'EVENT-001';

      const mockPdfBuffer = Buffer.from('PDF content mock');

      const mockExportData = {
        format: 'pdf',
        filename: 'event_001_analysis_report_20240115.pdf',
        data: mockPdfBuffer,
        metadata: {
          exportDate: '2024-01-15T21:00:00Z',
          eventId,
          pageCount: 5,
          sections: ['summary', 'detailed_analysis', 'visualizations', 'recommendations']
        }
      };

      mockAnalyticsService.exportData.mockResolvedValue(mockExportData);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/export`)
        .query({ format: 'pdf', includeVisualizations: true })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="event_001_analysis_report_20240115.pdf"/);
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    test('should validate export format parameter', async () => {
      // RED: This test should fail - format validation not implemented
      const eventId = 'EVENT-001';

      const response = await request(app)
        .get(`/api/results/events/${eventId}/export`)
        .query({ format: 'invalid_format' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid export format',
          details: {
            providedFormat: 'invalid_format',
            supportedFormats: ['csv', 'json', 'pdf', 'excel']
          }
        }
      });

      expect(mockAnalyticsService.exportData).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/results/events/:eventId/history', () => {
    test('should retrieve analysis history with timeline', async () => {
      // RED: This test should fail - history endpoint not implemented
      const eventId = 'EVENT-001';

      const mockHistory = {
        eventId,
        timeline: [
          {
            timestamp: '2024-01-15T19:00:00Z',
            action: 'analysis_started',
            analysisId: 'ANALYSIS-001',
            analysisType: 'comprehensive',
            metadata: { triggeredBy: 'automatic', reason: 'event_completion' }
          },
          {
            timestamp: '2024-01-15T19:02:30Z',
            action: 'analysis_completed',
            analysisId: 'ANALYSIS-001',
            result: { overallImpact: -0.15, significance: 0.001 }
          },
          {
            timestamp: '2024-01-15T20:00:00Z',
            action: 'analysis_started',
            analysisId: 'ANALYSIS-002',
            analysisType: 'quick',
            metadata: { triggeredBy: 'manual', userId: 'user123' }
          },
          {
            timestamp: '2024-01-15T20:01:15Z',
            action: 'analysis_completed',
            analysisId: 'ANALYSIS-002',
            result: { overallImpact: -0.12, significance: 0.005 }
          }
        ],
        summary: {
          totalAnalyses: 2,
          completedAnalyses: 2,
          failedAnalyses: 0,
          averageDuration: '01:52',
          firstAnalysis: '2024-01-15T19:00:00Z',
          lastAnalysis: '2024-01-15T20:01:15Z',
          impactTrend: [
            { analysisId: 'ANALYSIS-001', impact: -0.15, timestamp: '2024-01-15T19:02:30Z' },
            { analysisId: 'ANALYSIS-002', impact: -0.12, timestamp: '2024-01-15T20:01:15Z' }
          ]
        }
      };

      mockImpactCalculatorService.getAnalysisHistory.mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/history`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          history: mockHistory,
          insights: {
            analysisFrequency: 'hourly',
            impactStability: 'improving',
            recommendedNextAnalysis: '2024-01-16T08:00:00Z',
            confidenceTrend: 'increasing'
          }
        }
      });

      expect(mockImpactCalculatorService.getAnalysisHistory).toHaveBeenCalledWith(eventId);
    });

    test('should filter history by date range', async () => {
      // RED: This test should fail - date filtering not implemented
      const eventId = 'EVENT-001';
      const startDate = '2024-01-15T19:00:00Z';
      const endDate = '2024-01-15T20:00:00Z';

      const mockFilteredHistory = {
        eventId,
        timeline: [
          {
            timestamp: '2024-01-15T19:00:00Z',
            action: 'analysis_started',
            analysisId: 'ANALYSIS-001'
          },
          {
            timestamp: '2024-01-15T19:02:30Z',
            action: 'analysis_completed',
            analysisId: 'ANALYSIS-001'
          }
        ],
        summary: {
          totalAnalyses: 1,
          completedAnalyses: 1,
          dateRange: { start: startDate, end: endDate }
        }
      };

      mockImpactCalculatorService.getAnalysisHistory.mockResolvedValue(mockFilteredHistory);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/history`)
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.data.history.summary.dateRange).toEqual({
        start: startDate,
        end: endDate
      });

      expect(mockImpactCalculatorService.getAnalysisHistory).toHaveBeenCalledWith(
        eventId,
        expect.objectContaining({ startDate, endDate })
      );
    });
  });

  describe('GET /api/results/events/:eventId/comparison', () => {
    test('should compare multiple analyses for an event', async () => {
      // RED: This test should fail - comparison endpoint not implemented
      const eventId = 'EVENT-001';
      const analysisIds = ['ANALYSIS-001', 'ANALYSIS-002'];

      const mockComparison = {
        eventId,
        analyses: [
          {
            analysisId: 'ANALYSIS-001',
            analysisType: 'comprehensive',
            overallImpact: -0.15,
            fieldImpacts: {
              sentiment_score: { impact: -0.13, effectSize: 0.65 },
              customer_satisfaction: { impact: -0.04, effectSize: 0.25 }
            },
            timestamp: '2024-01-15T19:02:30Z'
          },
          {
            analysisId: 'ANALYSIS-002',
            analysisType: 'quick',
            overallImpact: -0.12,
            fieldImpacts: {
              sentiment_score: { impact: -0.10, effectSize: 0.55 },
              customer_satisfaction: { impact: -0.03, effectSize: 0.20 }
            },
            timestamp: '2024-01-15T20:01:15Z'
          }
        ],
        comparison: {
          impactEvolution: {
            sentiment_score: {
              change: 0.03,
              trend: 'improving',
              consistency: 'high'
            },
            customer_satisfaction: {
              change: 0.01,
              trend: 'improving',
              consistency: 'moderate'
            }
          },
          overallTrend: 'improving',
          significanceStability: 'maintained',
          methodologyConsistency: 'mixed',
          recommendedAnalysis: 'ANALYSIS-001'
        }
      };

      mockImpactCalculatorService.compareAnalyses = jest.fn().mockResolvedValue(mockComparison);

      const response = await request(app)
        .get(`/api/results/events/${eventId}/comparison`)
        .query({ analysisIds: analysisIds.join(',') })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockComparison
      });

      expect(mockImpactCalculatorService.compareAnalyses).toHaveBeenCalledWith(analysisIds);
    });

    test('should require at least two analysis IDs for comparison', async () => {
      // RED: This test should fail - validation not implemented
      const eventId = 'EVENT-001';

      const response = await request(app)
        .get(`/api/results/events/${eventId}/comparison`)
        .query({ analysisIds: 'ANALYSIS-001' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'At least two analysis IDs are required for comparison',
          details: {
            provided: 1,
            minimum: 2
          }
        }
      });
    });
  });

  describe('GET /api/results/dashboard', () => {
    test('should retrieve dashboard data with aggregated results', async () => {
      // RED: This test should fail - dashboard endpoint not implemented
      const mockDashboardData = {
        overview: {
          totalEvents: 15,
          eventsWithAnalysis: 12,
          completedAnalyses: 28,
          pendingAnalyses: 3,
          averageImpactMagnitude: -0.08,
          lastUpdated: '2024-01-15T21:00:00Z'
        },
        recentEvents: [
          {
            eventId: 'EVENT-001',
            name: 'Product Launch Q1',
            type: 'product_launch',
            analysisCount: 2,
            latestImpact: -0.12,
            status: 'analyzed'
          },
          {
            eventId: 'EVENT-002',
            name: 'System Maintenance',
            type: 'maintenance_window',
            analysisCount: 1,
            latestImpact: -0.05,
            status: 'analyzed'
          }
        ],
        impactTrends: {
          daily: [
            { date: '2024-01-14', averageImpact: -0.10, eventCount: 3 },
            { date: '2024-01-15', averageImpact: -0.08, eventCount: 5 }
          ],
          byEventType: {
            product_launch: { averageImpact: -0.12, count: 8 },
            system_outage: { averageImpact: -0.15, count: 4 },
            maintenance_window: { averageImpact: -0.05, count: 3 }
          }
        },
        alerts: [
          {
            type: 'high_impact',
            message: 'EVENT-001 shows significant negative impact across multiple metrics',
            eventId: 'EVENT-001',
            severity: 'warning',
            timestamp: '2024-01-15T19:00:00Z'
          }
        ]
      };

      mockImpactCalculatorService.getAggregatedResults.mockResolvedValue(mockDashboardData);

      const response = await request(app)
        .get('/api/results/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDashboardData
      });

      expect(mockImpactCalculatorService.getAggregatedResults).toHaveBeenCalled();
    });

    test('should support date range filtering for dashboard data', async () => {
      // RED: This test should fail - dashboard filtering not implemented
      const startDate = '2024-01-01';
      const endDate = '2024-01-15';

      const mockFilteredData = {
        overview: {
          totalEvents: 8,
          eventsWithAnalysis: 6,
          dateRange: { start: startDate, end: endDate }
        },
        recentEvents: [],
        impactTrends: {},
        alerts: []
      };

      mockImpactCalculatorService.getAggregatedResults.mockResolvedValue(mockFilteredData);

      const response = await request(app)
        .get('/api/results/dashboard')
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.data.overview.dateRange).toEqual({
        start: startDate,
        end: endDate
      });

      expect(mockImpactCalculatorService.getAggregatedResults).toHaveBeenCalledWith(
        expect.objectContaining({ startDate, endDate })
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});