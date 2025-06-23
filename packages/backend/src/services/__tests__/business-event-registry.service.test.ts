import { BusinessEventRegistry } from '../business-event-registry.service';
import { DatabaseService } from '../enhanced-database.service';

describe('Business Event Registry', () => {
  let eventRegistry: BusinessEventRegistry;
  let mockDatabase: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as any;
    
    eventRegistry = new BusinessEventRegistry(mockDatabase);
  });

  describe('Event Storage', () => {
    test('should store business events with metadata', async () => {
      // Arrange
      const businessEvent = {
        eventType: 'price_increase',
        eventDate: new Date('2024-06-01'),
        description: 'Price increase - 10% across all products',
        affectedCustomers: 'all',
      };

      mockDatabase.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'event-123',
          event_type: businessEvent.eventType,
          event_date: businessEvent.eventDate,
          description: businessEvent.description,
          affected_customers: JSON.stringify(businessEvent.affectedCustomers),
          created_at: new Date()
        }] 
      });

      // Act
      const result = await eventRegistry.createEvent(businessEvent);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO business_events'),
        expect.arrayContaining([
          businessEvent.eventType,
          businessEvent.eventDate,
          businessEvent.description,
          JSON.stringify(businessEvent.affectedCustomers)
        ])
      );
      expect(result).toHaveProperty('id');
      expect(result.eventType).toBe(businessEvent.eventType);
    });

    test('should track affected customers', async () => {
      // Arrange
      const businessEvent = {
        eventType: 'outage',
        eventDate: new Date('2024-05-03'),
        description: 'Website outage - 4 hours',
        affectedCustomers: ['customer-1', 'customer-2', 'customer-3'],
      };

      mockDatabase.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'event-456',
          event_type: businessEvent.eventType,
          event_date: businessEvent.eventDate,
          description: businessEvent.description,
          affected_customers: JSON.stringify(businessEvent.affectedCustomers),
          created_at: new Date()
        }] 
      });

      // Act
      const result = await eventRegistry.createEvent(businessEvent);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO business_events'),
        expect.arrayContaining([
          businessEvent.eventType,
          businessEvent.eventDate,
          businessEvent.description,
          JSON.stringify(businessEvent.affectedCustomers)
        ])
      );
      expect(result.affectedCustomers).toEqual(businessEvent.affectedCustomers);
    });

    test('should validate event dates', async () => {
      // Arrange
      const invalidEvent = {
        eventType: 'price_increase',
        eventDate: new Date('2025-12-01'), // Future date
        description: 'Future price increase',
        affectedCustomers: 'all',
      };

      // Act & Assert
      await expect(eventRegistry.createEvent(invalidEvent))
        .rejects.toThrow('Event date cannot be in the future');
    });
  });

  describe('Event Retrieval', () => {
    test('should retrieve events within date range', async () => {
      // Arrange
      const startDate = new Date('2024-05-01');
      const endDate = new Date('2024-06-30');
      
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            event_type: 'outage',
            event_date: new Date('2024-05-03'),
            description: 'Website outage',
            affected_customers: JSON.stringify(['customer-1', 'customer-2']),
            created_at: new Date()
          },
          {
            id: 'event-2',
            event_type: 'price_increase',
            event_date: new Date('2024-06-01'),
            description: 'Price increase',
            affected_customers: JSON.stringify('all'),
            created_at: new Date()
          }
        ]
      });

      // Act
      const events = await eventRegistry.getEventsByDateRange(startDate, endDate);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalled();
      const [query, params] = mockDatabase.query.mock.calls[0];
      expect(query).toContain('SELECT * FROM business_events');
      expect(query).toContain('event_date BETWEEN');
      expect(params).toEqual([startDate, endDate]);
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('outage');
      expect(events[1].eventType).toBe('price_increase');
    });

    test('should retrieve events by type', async () => {
      // Arrange
      const eventType = 'outage';
      
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            event_type: 'outage',
            event_date: new Date('2024-05-03'),
            description: 'Website outage',
            affected_customers: JSON.stringify(['customer-1', 'customer-2']),
            created_at: new Date()
          }
        ]
      });

      // Act
      const events = await eventRegistry.getEventsByType(eventType);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalled();
      const [query, params] = mockDatabase.query.mock.calls[0];
      expect(query).toContain('SELECT * FROM business_events');
      expect(query).toContain('event_type =');
      expect(params).toEqual([eventType]);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe(eventType);
    });

    test('should get events affecting specific customer', async () => {
      // Arrange
      const customerId = 'customer-123';
      
      mockDatabase.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'event-1',
            event_type: 'outage',
            event_date: new Date('2024-05-03'),
            description: 'Regional outage',
            affected_customers: JSON.stringify(['customer-123', 'customer-456']),
            created_at: new Date()
          },
          {
            id: 'event-2',
            event_type: 'price_increase',
            event_date: new Date('2024-06-01'),
            description: 'Price increase',
            affected_customers: JSON.stringify('all'),
            created_at: new Date()
          }
        ]
      });

      // Act
      const events = await eventRegistry.getEventsForCustomer(customerId);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalled();
      const [query, params] = mockDatabase.query.mock.calls[0];
      expect(query).toContain('SELECT * FROM business_events');
      expect(query).toContain('WHERE');
      expect(events).toHaveLength(2);
    });
  });

  describe('Event Updates', () => {
    test('should update event metadata', async () => {
      // Arrange
      const eventId = 'event-123';
      const updates = {
        description: 'Updated description - Website outage lasted 6 hours',
        affectedCustomers: ['customer-1', 'customer-2', 'customer-3', 'customer-4']
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: eventId,
          event_type: 'outage',
          event_date: new Date('2024-05-03'),
          description: updates.description,
          affected_customers: JSON.stringify(updates.affectedCustomers),
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      // Act
      const result = await eventRegistry.updateEvent(eventId, updates);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalled();
      const [query, params] = mockDatabase.query.mock.calls[0];
      expect(query).toContain('UPDATE business_events');
      expect(query).toContain('SET');
      expect(params).toContain(updates.description);
      expect(params).toContain(JSON.stringify(updates.affectedCustomers));
      expect(params).toContain(eventId);
      expect(result.description).toBe(updates.description);
      expect(result.affectedCustomers).toEqual(updates.affectedCustomers);
    });

    test('should not allow updating event date to future', async () => {
      // Arrange
      const eventId = 'event-123';
      const updates = {
        eventDate: new Date('2025-12-01')
      };

      // Act & Assert
      await expect(eventRegistry.updateEvent(eventId, updates))
        .rejects.toThrow('Event date cannot be in the future');
    });
  });

  describe('Event Deletion', () => {
    test('should soft delete events', async () => {
      // Arrange
      const eventId = 'event-123';

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: eventId,
          deleted_at: new Date()
        }]
      });

      // Act
      const result = await eventRegistry.deleteEvent(eventId);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalled();
      const [query, params] = mockDatabase.query.mock.calls[0];
      expect(query).toContain('UPDATE business_events');
      expect(query).toContain('deleted_at = NOW()');
      expect(params).toEqual([eventId]);
      expect(result.success).toBe(true);
    });
  });
});