import { ImpactCalculator } from '../impact-calculator.service';
import { DatabaseService } from '../enhanced-database.service';
import { BusinessEventRegistry } from '../business-event-registry.service';

describe('Impact Analysis', () => {
  let impactCalculator: ImpactCalculator;
  let mockDatabase: jest.Mocked<DatabaseService>;
  let mockEventRegistry: jest.Mocked<BusinessEventRegistry>;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as any;

    mockEventRegistry = {
      getEventsByDateRange: jest.fn(),
      getEventsByType: jest.fn(),
      getEventsForCustomer: jest.fn(),
    } as any;
    
    impactCalculator = new ImpactCalculator(mockDatabase, mockEventRegistry);
  });

  describe('Sentiment Change Calculation', () => {
    test('should calculate sentiment change before/after event', async () => {
      // Arrange
      const eventId = 'event-123';
      const eventDate = new Date('2024-05-03');
      const daysBefore = 30;
      const daysAfter = 30;

      // Mock event data
      mockEventRegistry.getEventsByDateRange = jest.fn().mockResolvedValueOnce([{
        id: eventId,
        eventType: 'outage',
        eventDate,
        description: 'Website outage',
        affectedCustomers: ['customer-1', 'customer-2'],
      }]);

      // Mock sentiment data before event
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 75.5,
          count: 50,
          stddev: 8.2
        }]
      });

      // Mock sentiment data after event
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 60.3,
          count: 48,
          stddev: 12.5
        }]
      });

      // Act
      const result = await impactCalculator.calculateEventImpact(eventId, { daysBefore, daysAfter });

      // Assert
      expect(result.eventId).toBe(eventId);
      expect(result.sentimentBefore).toBeCloseTo(75.5, 1);
      expect(result.sentimentAfter).toBeCloseTo(60.3, 1);
      expect(result.impact).toBeCloseTo(-15.2, 1);
      expect(result.percentageChange).toBeCloseTo(-20.13, 1);
    });

    test('should determine statistical significance', async () => {
      // Arrange
      const eventId = 'event-123';
      const eventDate = new Date('2024-05-03');

      mockEventRegistry.getEventsByDateRange = jest.fn().mockResolvedValueOnce([{
        id: eventId,
        eventType: 'price_increase',
        eventDate,
        description: 'Price increase',
        affectedCustomers: 'all',
      }]);

      // Mock data with high significance (large sample, clear difference)
      mockDatabase.query
        .mockResolvedValueOnce({
          rows: [{
            avg_sentiment: 80.0,
            count: 500,
            stddev: 5.0
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            avg_sentiment: 65.0,
            count: 480,
            stddev: 6.0
          }]
        });

      // Act
      const result = await impactCalculator.calculateEventImpact(eventId);

      // Assert
      expect(result.isSignificant).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.pValue).toBeLessThan(0.05);
    });

    test('should identify control group for comparison', async () => {
      // Arrange
      const eventId = 'event-456';
      const eventDate = new Date('2024-05-03');
      const affectedCustomers = ['customer-1', 'customer-2', 'customer-3'];

      mockEventRegistry.getEventsByDateRange = jest.fn().mockResolvedValueOnce([{
        id: eventId,
        eventType: 'regional_outage',
        eventDate,
        description: 'Regional outage',
        affectedCustomers,
      }]);

      // Mock control group identification
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          { customer_id: 'customer-4' },
          { customer_id: 'customer-5' },
          { customer_id: 'customer-6' },
        ]
      });

      // Mock sentiment for affected group (before)
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 75.0,
          count: 3,
          stddev: 5.0
        }]
      });

      // Mock sentiment for affected group (after)
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 55.0,
          count: 3,
          stddev: 8.0
        }]
      });

      // Mock sentiment for control group (before)
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 74.0,
          count: 3,
          stddev: 4.5
        }]
      });

      // Mock sentiment for control group (after)
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          avg_sentiment: 73.0,
          count: 3,
          stddev: 4.8
        }]
      });

      // Act
      const result = await impactCalculator.calculateEventImpactWithControl(eventId);

      // Assert
      expect(result.affectedGroupImpact).toBeCloseTo(-20.0, 1);
      expect(result.controlGroupImpact).toBeCloseTo(-1.0, 1);
      expect(result.netImpact).toBeCloseTo(-19.0, 1);
      expect(result.controlGroupSize).toBe(3);
    });
  });

  describe('Batch Impact Analysis', () => {
    test('should analyze multiple events in date range', async () => {
      // Arrange
      const startDate = new Date('2024-05-01');
      const endDate = new Date('2024-06-30');

      mockEventRegistry.getEventsByDateRange.mockResolvedValueOnce([
        {
          id: 'event-1',
          eventType: 'outage',
          eventDate: new Date('2024-05-03'),
          description: 'Outage',
          affectedCustomers: ['customer-1', 'customer-2'],
        },
        {
          id: 'event-2',
          eventType: 'price_increase',
          eventDate: new Date('2024-06-01'),
          description: 'Price increase',
          affectedCustomers: 'all',
        }
      ]);

      // Mock impact calculations for each event
      mockDatabase.query
        // Event 1 before
        .mockResolvedValueOnce({ rows: [{ avg_sentiment: 80, count: 50, stddev: 5 }] })
        // Event 1 after
        .mockResolvedValueOnce({ rows: [{ avg_sentiment: 65, count: 48, stddev: 8 }] })
        // Event 2 before
        .mockResolvedValueOnce({ rows: [{ avg_sentiment: 75, count: 200, stddev: 6 }] })
        // Event 2 after
        .mockResolvedValueOnce({ rows: [{ avg_sentiment: 68, count: 195, stddev: 7 }] });

      // Act
      const results = await impactCalculator.analyzeEventImpacts(startDate, endDate);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].eventType).toBe('outage');
      expect(results[0].impact).toBeCloseTo(-15, 0);
      expect(results[1].eventType).toBe('price_increase');
      expect(results[1].impact).toBeCloseTo(-7, 0);
    });

    test('should rank events by impact magnitude', async () => {
      // Arrange
      const impacts = [
        { eventId: 'event-1', impact: -5.0, eventType: 'minor_change' },
        { eventId: 'event-2', impact: -20.0, eventType: 'major_outage' },
        { eventId: 'event-3', impact: 8.0, eventType: 'positive_change' },
        { eventId: 'event-4', impact: -12.0, eventType: 'price_increase' },
      ];

      // Act
      const ranked = impactCalculator.rankEventsByImpact(impacts);

      // Assert
      expect(ranked[0].eventType).toBe('major_outage');
      expect(ranked[0].impact).toBe(-20.0);
      expect(ranked[1].eventType).toBe('price_increase');
      expect(ranked[2].eventType).toBe('positive_change');
      expect(ranked[3].eventType).toBe('minor_change');
    });
  });

  describe('Statistical Tests', () => {
    test('should perform t-test for significance', () => {
      // Arrange
      const beforeData = {
        mean: 75.0,
        stddev: 5.0,
        count: 100
      };
      const afterData = {
        mean: 70.0,
        stddev: 6.0,
        count: 95
      };

      // Act
      const result = impactCalculator.performTTest(beforeData, afterData);

      // Assert
      expect(result.tStatistic).toBeGreaterThan(2.0);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.isSignificant).toBe(true);
    });

    test('should handle small sample sizes appropriately', () => {
      // Arrange
      const beforeData = {
        mean: 75.0,
        stddev: 10.0,
        count: 5
      };
      const afterData = {
        mean: 70.0,
        stddev: 12.0,
        count: 4
      };

      // Act
      const result = impactCalculator.performTTest(beforeData, afterData);

      // Assert
      expect(result.warning).toContain('Small sample size');
      expect(result.confidence).toBeLessThan(0.95);
    });

    test('should calculate effect size (Cohen\'s d)', () => {
      // Arrange
      const beforeData = {
        mean: 80.0,
        stddev: 10.0,
        count: 100
      };
      const afterData = {
        mean: 65.0,
        stddev: 12.0,
        count: 100
      };

      // Act
      const effectSize = impactCalculator.calculateEffectSize(beforeData, afterData);

      // Assert
      expect(effectSize).toBeCloseTo(1.35, 1); // Large effect size
      expect(impactCalculator.interpretEffectSize(effectSize)).toBe('large');
    });
  });

  describe('Impact Persistence', () => {
    test('should save impact analysis results', async () => {
      // Arrange
      const analysis = {
        eventId: 'event-123',
        sentimentBefore: 75.0,
        sentimentAfter: 60.0,
        impact: -15.0,
        percentageChange: -20.0,
        isSignificant: true,
        confidence: 0.99,
        pValue: 0.001,
        customersAffected: 150,
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'impact-123', ...analysis }]
      });

      // Act
      const result = await impactCalculator.saveImpactAnalysis(analysis);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO event_impacts'),
        expect.arrayContaining([
          analysis.eventId,
          analysis.impact,
          analysis.customersAffected
        ])
      );
      expect(result.id).toBe('impact-123');
    });

    test('should retrieve cached impact analysis', async () => {
      // Arrange
      const eventId = 'event-123';
      
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: 'impact-123',
          event_id: eventId,
          impact_percentage: -15.0,
          customers_affected: 150,
          calculated_at: new Date('2024-06-15'),
          is_significant: true,
          confidence: 0.99,
          p_value: 0.001
        }]
      });

      // Act
      const result = await impactCalculator.getCachedImpact(eventId);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.impact).toBe(-15.0);
      expect(result!.isSignificant).toBe(true);
    });
  });
});