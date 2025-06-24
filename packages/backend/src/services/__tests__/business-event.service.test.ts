import { BusinessEventService } from '../business-event.service';
import { DatabaseService } from '../../database/sqlite';

// Mock dependencies
jest.mock('../../database/sqlite');

describe('BusinessEventService', () => {
  let businessEventService: BusinessEventService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService = {
      query: jest.fn(),
      run: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn()
    } as any;

    businessEventService = new BusinessEventService(mockDatabaseService);
  });

  describe('Event Creation (POST)', () => {
    test('should create a new business event with all required fields', async () => {
      // RED: This test should fail - BusinessEventService doesn't exist yet
      const eventData = {
        eventType: 'price_change',
        eventDate: '2024-06-23',
        description: 'Price increase of 10% across all products',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003']
      };

      // Mock successful database insertion
      mockDatabaseService.run.mockResolvedValueOnce({
        lastInsertRowid: 'evt-12345',
        changes: 1
      });

      const result = await businessEventService.createEvent(eventData);

      expect(result).toEqual({
        id: 'evt-12345',
        eventType: 'price_change',
        eventDate: '2024-06-23',
        description: 'Price increase of 10% across all products',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003'],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null
      });

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO business_events'),
        expect.arrayContaining([
          'price_change',
          '2024-06-23',
          'Price increase of 10% across all products',
          JSON.stringify(['CUST-001', 'CUST-002', 'CUST-003'])
        ])
      );
    });

    test('should create event with "all" customers affected', async () => {
      // RED: This test should fail - testing "all customers" scenario
      const eventData = {
        eventType: 'system_outage',
        eventDate: '2024-06-23',
        description: 'Complete system outage for 3 hours',
        affectedCustomers: 'all'
      };

      mockDatabaseService.run.mockResolvedValueOnce({
        lastInsertRowid: 'evt-67890',
        changes: 1
      });

      const result = await businessEventService.createEvent(eventData);

      expect(result.affectedCustomers).toBe('all');
      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO business_events'),
        expect.arrayContaining([
          'system_outage',
          '2024-06-23',
          'Complete system outage for 3 hours',
          JSON.stringify('all')
        ])
      );
    });

    test('should validate required fields before creation', async () => {
      // RED: This test should fail - validation not implemented
      const invalidEventData = {
        eventType: '', // Missing required field
        eventDate: '2024-06-23',
        description: 'Test event'
        // affectedCustomers missing
      };

      await expect(businessEventService.createEvent(invalidEventData as any))
        .rejects.toThrow('Validation failed: eventType is required');
    });

    test('should validate event date format', async () => {
      // RED: This test should fail - date validation not implemented
      const invalidEventData = {
        eventType: 'price_change',
        eventDate: 'invalid-date',
        description: 'Test event',
        affectedCustomers: ['CUST-001']
      };

      await expect(businessEventService.createEvent(invalidEventData))
        .rejects.toThrow('Validation failed: eventDate must be a valid date (YYYY-MM-DD)');
    });
  });

  describe('Event Retrieval (GET)', () => {
    test('should retrieve event by ID', async () => {
      // RED: This test should fail - getEventById not implemented
      const mockEvent = {
        id: 'evt-12345',
        event_type: 'price_change',
        event_date: '2024-06-23',
        description: 'Price increase of 10%',
        affected_customers: JSON.stringify(['CUST-001', 'CUST-002']),
        created_at: '2024-06-23T10:00:00Z',
        updated_at: '2024-06-23T10:00:00Z',
        deleted_at: null
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockEvent]);

      const result = await businessEventService.getEventById('evt-12345');

      expect(result).toEqual({
        id: 'evt-12345',
        eventType: 'price_change',
        eventDate: '2024-06-23',
        description: 'Price increase of 10%',
        affectedCustomers: ['CUST-001', 'CUST-002'],
        createdAt: '2024-06-23T10:00:00Z',
        updatedAt: '2024-06-23T10:00:00Z',
        deletedAt: null
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT.*FROM business_events.*WHERE.*id.*=.*\?.*AND.*deleted_at.*IS NULL/s),
        ['evt-12345']
      );
    });

    test('should return null for non-existent event', async () => {
      // RED: This test should fail - null handling not implemented
      mockDatabaseService.query.mockResolvedValueOnce([]);

      const result = await businessEventService.getEventById('non-existent');

      expect(result).toBeNull();
    });

    test('should retrieve events by date range', async () => {
      // RED: This test should fail - getEventsByDateRange not implemented
      const mockEvents = [
        {
          id: 'evt-1',
          event_type: 'price_change',
          event_date: '2024-06-20',
          description: 'Price change 1',
          affected_customers: JSON.stringify(['CUST-001']),
          created_at: '2024-06-20T10:00:00Z',
          updated_at: '2024-06-20T10:00:00Z',
          deleted_at: null
        },
        {
          id: 'evt-2',
          event_type: 'outage',
          event_date: '2024-06-22',
          description: 'System outage',
          affected_customers: JSON.stringify('all'),
          created_at: '2024-06-22T15:00:00Z',
          updated_at: '2024-06-22T15:00:00Z',
          deleted_at: null
        }
      ];

      mockDatabaseService.query.mockResolvedValueOnce(mockEvents);

      const result = await businessEventService.getEventsByDateRange('2024-06-20', '2024-06-25');

      expect(result).toHaveLength(2);
      expect(result[0].eventType).toBe('price_change');
      expect(result[1].eventType).toBe('outage');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_date BETWEEN ? AND ? AND deleted_at IS NULL'),
        ['2024-06-20', '2024-06-25']
      );
    });

    test('should retrieve events by type', async () => {
      // RED: This test should fail - getEventsByType not implemented
      const mockEvents = [
        {
          id: 'evt-1',
          event_type: 'price_change',
          event_date: '2024-06-20',
          description: 'Price change 1',
          affected_customers: JSON.stringify(['CUST-001']),
          created_at: '2024-06-20T10:00:00Z',
          updated_at: '2024-06-20T10:00:00Z',
          deleted_at: null
        }
      ];

      mockDatabaseService.query.mockResolvedValueOnce(mockEvents);

      const result = await businessEventService.getEventsByType('price_change');

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('price_change');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_type = ? AND deleted_at IS NULL'),
        ['price_change']
      );
    });
  });

  describe('Event Updates (PUT)', () => {
    test('should update existing event', async () => {
      // RED: This test should fail - updateEvent not implemented
      const updateData = {
        description: 'Updated description - Price increase of 15%',
        affectedCustomers: ['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004']
      };

      mockDatabaseService.run.mockResolvedValueOnce({
        changes: 1
      });

      const mockUpdatedEvent = {
        id: 'evt-12345',
        event_type: 'price_change',
        event_date: '2024-06-23',
        description: 'Updated description - Price increase of 15%',
        affected_customers: JSON.stringify(['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004']),
        created_at: '2024-06-23T10:00:00Z',
        updated_at: '2024-06-23T11:00:00Z',
        deleted_at: null
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUpdatedEvent]);

      const result = await businessEventService.updateEvent('evt-12345', updateData);

      expect(result.description).toBe('Updated description - Price increase of 15%');
      expect(result.affectedCustomers).toEqual(['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004']);

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE.*business_events.*SET.*description.*=.*\?.*affected_customers.*=.*\?/s),
        expect.arrayContaining([
          'Updated description - Price increase of 15%',
          JSON.stringify(['CUST-001', 'CUST-002', 'CUST-003', 'CUST-004']),
          'evt-12345'
        ])
      );
    });

    test('should throw error when updating non-existent event', async () => {
      // RED: This test should fail - error handling not implemented
      mockDatabaseService.run.mockResolvedValueOnce({
        changes: 0
      });

      const updateData = {
        description: 'Updated description'
      };

      await expect(businessEventService.updateEvent('non-existent', updateData))
        .rejects.toThrow('Event not found: non-existent');
    });

    test('should prevent updating immutable fields', async () => {
      // RED: This test should fail - immutable field protection not implemented
      const updateData = {
        id: 'different-id', // Should not be allowed
        createdAt: '2023-01-01T00:00:00Z', // Should not be allowed
        eventDate: '2024-01-01' // Should be allowed
      };

      mockDatabaseService.run.mockResolvedValueOnce({
        changes: 1
      });

      const mockUpdatedEvent = {
        id: 'evt-12345', // Original ID preserved
        event_type: 'price_change',
        event_date: '2024-01-01', // Updated date
        description: 'Original description',
        affected_customers: JSON.stringify(['CUST-001']),
        created_at: '2024-06-23T10:00:00Z', // Original timestamp preserved
        updated_at: '2024-06-23T11:00:00Z',
        deleted_at: null
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUpdatedEvent]);

      const result = await businessEventService.updateEvent('evt-12345', updateData as any);

      // Should preserve original ID and createdAt but allow eventDate update
      expect(result.id).toBe('evt-12345');
      expect(result.createdAt).toBe('2024-06-23T10:00:00Z');
      expect(result.eventDate).toBe('2024-01-01');
    });
  });

  describe('Event Deletion (DELETE)', () => {
    test('should perform soft delete on event', async () => {
      // GREEN: This test should now pass with soft delete implementation
      // Mock no existing impacts
      mockDatabaseService.query.mockResolvedValueOnce([{ count: 0 }]);
      
      mockDatabaseService.run.mockResolvedValueOnce({
        changes: 1
      });

      const result = await businessEventService.deleteEvent('evt-12345');

      expect(result).toBe(true);

      expect(mockDatabaseService.run).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE.*business_events.*SET.*deleted_at.*=.*CURRENT_TIMESTAMP/s),
        ['evt-12345']
      );
    });

    test('should return false when deleting non-existent event', async () => {
      // GREEN: This test should now pass with non-existent event handling
      // Mock no existing impacts
      mockDatabaseService.query.mockResolvedValueOnce([{ count: 0 }]);
      
      mockDatabaseService.run.mockResolvedValueOnce({
        changes: 0
      });

      const result = await businessEventService.deleteEvent('non-existent');

      expect(result).toBe(false);
    });

    test('should prevent deletion of events with existing impact analysis', async () => {
      // RED: This test should fail - referential integrity check not implemented
      // Mock that event has impact analysis records
      mockDatabaseService.query.mockResolvedValueOnce([{ count: 1 }]);

      await expect(businessEventService.deleteEvent('evt-with-impacts'))
        .rejects.toThrow('Cannot delete event with existing impact analysis. Delete impacts first.');

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as count FROM event_impacts WHERE event_id = ?'),
        ['evt-with-impacts']
      );
    });
  });

  describe('Event Listing and Pagination', () => {
    test('should list events with pagination', async () => {
      // RED: This test should fail - pagination not implemented
      const mockEvents = [
        {
          id: 'evt-1',
          event_type: 'price_change',
          event_date: '2024-06-20',
          description: 'Event 1',
          affected_customers: JSON.stringify(['CUST-001']),
          created_at: '2024-06-20T10:00:00Z',
          updated_at: '2024-06-20T10:00:00Z',
          deleted_at: null
        }
      ];

      // Mock count query
      mockDatabaseService.query.mockResolvedValueOnce([{ total: 25 }]);
      // Mock events query
      mockDatabaseService.query.mockResolvedValueOnce(mockEvents);

      const result = await businessEventService.listEvents({
        page: 2,
        limit: 10,
        sortBy: 'eventDate',
        sortOrder: 'desc'
      });

      expect(result).toEqual({
        events: expect.any(Array),
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNext: true,
          hasPrev: true
        }
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringMatching(/LIMIT 10 OFFSET 10/),
        expect.any(Array)
      );
    });

    test('should filter events by multiple criteria', async () => {
      // RED: This test should fail - filtering not implemented
      const filters = {
        eventType: 'price_change',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        affectedCustomer: 'CUST-001'
      };

      mockDatabaseService.query.mockResolvedValueOnce([{ total: 5 }]);
      mockDatabaseService.query.mockResolvedValueOnce([]);

      await businessEventService.listEvents({
        page: 1,
        limit: 10,
        filters
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringMatching(/WHERE.*event_type = \?.*AND.*event_date BETWEEN \? AND \?/),
        expect.arrayContaining(['price_change', '2024-06-01', '2024-06-30'])
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});