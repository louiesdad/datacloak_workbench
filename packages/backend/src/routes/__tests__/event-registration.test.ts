import request from 'supertest';
import express from 'express';
import { eventRegistrationRouter } from '../event-registration';
import { BusinessEventService } from '../../services/business-event.service';

// Mock the business event service
jest.mock('../../services/business-event.service');

describe('Event Registration Endpoint', () => {
  let app: express.Application;
  let mockBusinessEventService: jest.Mocked<BusinessEventService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock instance
    mockBusinessEventService = {
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      deleteEvent: jest.fn(),
      getEvent: jest.fn(),
      getAllEvents: jest.fn(),
      getEventsByType: jest.fn(),
      getEventsByTimeRange: jest.fn(),
    } as any;

    // Mock the service constructor to return our mock
    (BusinessEventService as jest.MockedClass<typeof BusinessEventService>).mockImplementation(() => mockBusinessEventService);

    app = express();
    app.use(express.json());
    app.use('/api/events', eventRegistrationRouter);
  });

  describe('POST /api/events/register', () => {
    test('should register a new business event successfully', async () => {
      // RED: This test should fail - eventRegistrationRouter doesn't exist yet
      const eventData = {
        name: 'Product Launch Q1',
        type: 'product_launch',
        description: 'Launch of new premium product line',
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T18:00:00Z',
        severity: 'major',
        expectedImpact: 'high',
        affectedCustomerSegments: ['premium', 'enterprise'],
        metadata: {
          product_id: 'PROD-001',
          launch_region: 'APAC',
          marketing_campaign: 'CAMPAIGN-2024-Q1'
        }
      };

      const mockCreatedEvent = {
        id: 'EVENT-001',
        ...eventData,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        status: 'registered'
      };

      mockBusinessEventService.createEvent.mockResolvedValue(mockCreatedEvent);

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          event: mockCreatedEvent,
          eventId: 'EVENT-001'
        },
        message: 'Event registered successfully'
      });

      expect(mockBusinessEventService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...eventData,
          id: expect.stringMatching(/^EVENT-\d{8}-\d{6}-\d{3}$/)
        })
      );
    });

    test('should validate required fields for event registration', async () => {
      // RED: This test should fail - validation not implemented
      const incompleteEventData = {
        name: 'Incomplete Event',
        // Missing type, startTime, severity
      };

      const response = await request(app)
        .post('/api/events/register')
        .send(incompleteEventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required fields',
          details: {
            missing_fields: ['type', 'startTime', 'severity'],
            provided_fields: ['name']
          }
        }
      });

      expect(mockBusinessEventService.createEvent).not.toHaveBeenCalled();
    });

    test('should validate event type against allowed types', async () => {
      // RED: This test should fail - type validation not implemented
      const eventData = {
        name: 'Invalid Event',
        type: 'invalid_type',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'major'
      };

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid event type',
          details: {
            provided_type: 'invalid_type',
            allowed_types: [
              'product_launch', 'system_outage', 'marketing_campaign',
              'policy_change', 'feature_rollout', 'data_migration',
              'security_incident', 'maintenance_window', 'external_event'
            ]
          }
        }
      });

      expect(mockBusinessEventService.createEvent).not.toHaveBeenCalled();
    });

    test('should validate severity levels', async () => {
      // RED: This test should fail - severity validation not implemented
      const eventData = {
        name: 'Invalid Severity Event',
        type: 'system_outage',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'catastrophic' // Invalid severity
      };

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid severity level',
          details: {
            provided_severity: 'catastrophic',
            allowed_severities: ['low', 'medium', 'high', 'critical', 'major']
          }
        }
      });

      expect(mockBusinessEventService.createEvent).not.toHaveBeenCalled();
    });

    test('should validate date formats and chronology', async () => {
      // RED: This test should fail - date validation not implemented
      const eventData = {
        name: 'Invalid Date Event',
        type: 'product_launch',
        startTime: '2024-01-15T18:00:00Z',
        endTime: '2024-01-15T09:00:00Z', // End before start
        severity: 'major'
      };

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid date range',
          details: {
            issue: 'End time must be after start time',
            start_time: '2024-01-15T18:00:00Z',
            end_time: '2024-01-15T09:00:00Z'
          }
        }
      });

      expect(mockBusinessEventService.createEvent).not.toHaveBeenCalled();
    });

    test('should handle business event service failures gracefully', async () => {
      // RED: This test should fail - error handling not implemented
      const eventData = {
        name: 'Service Failure Event',
        type: 'product_launch',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'major'
      };

      mockBusinessEventService.createEvent.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to register event',
          details: {
            error: 'Database connection failed'
          }
        }
      });

      expect(mockBusinessEventService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...eventData,
          id: expect.stringMatching(/^EVENT-\d{8}-\d{6}-\d{3}$/)
        })
      );
    });

    test('should sanitize and normalize input data', async () => {
      // RED: This test should fail - data sanitization not implemented
      const eventData = {
        name: '  Product Launch Q1  ', // Extra whitespace
        type: 'PRODUCT_LAUNCH', // Uppercase
        description: '<script>alert("xss")</script>Legitimate description',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'MAJOR', // Uppercase
        affectedCustomerSegments: ['  premium  ', 'ENTERPRISE', ''],
        metadata: {
          special_chars: '!@#$%^&*()',
          empty_value: '',
          null_value: null
        }
      };

      const expectedSanitizedData = {
        name: 'Product Launch Q1',
        type: 'product_launch',
        description: 'Legitimate description',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'major',
        affectedCustomerSegments: ['premium', 'enterprise'],
        metadata: {
          special_chars: '!@#$%^&*()',
          // empty and null values should be removed
        }
      };

      const mockCreatedEvent = {
        id: 'EVENT-001',
        ...expectedSanitizedData,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        status: 'registered'
      };

      mockBusinessEventService.createEvent.mockResolvedValue(mockCreatedEvent);

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(201);

      expect(mockBusinessEventService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...expectedSanitizedData,
          id: expect.stringMatching(/^EVENT-\d{8}-\d{6}-\d{3}$/)
        })
      );
      expect(response.body.data.event).toEqual(mockCreatedEvent);
    });

    test('should generate unique event ID if not provided', async () => {
      // RED: This test should fail - ID generation not implemented
      const eventData = {
        name: 'Auto ID Event',
        type: 'product_launch',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'major'
      };

      const mockCreatedEvent = {
        id: 'EVENT-20240101-100000-001',
        ...eventData,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        status: 'registered'
      };

      mockBusinessEventService.createEvent.mockResolvedValue(mockCreatedEvent);

      const response = await request(app)
        .post('/api/events/register')
        .send(eventData)
        .expect(201);

      expect(response.body.data.eventId).toMatch(/^EVENT-\d{8}-\d{6}-\d{3}$/);
      expect(mockBusinessEventService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...eventData,
          id: expect.stringMatching(/^EVENT-\d{8}-\d{6}-\d{3}$/)
        })
      );
    });
  });

  describe('PUT /api/events/:eventId/update', () => {
    test('should update an existing event successfully', async () => {
      // RED: This test should fail - update endpoint not implemented
      const eventId = 'EVENT-001';
      const updateData = {
        name: 'Updated Product Launch Q1',
        description: 'Updated description with more details',
        severity: 'high',
        metadata: {
          updated_field: 'new_value'
        }
      };

      const mockUpdatedEvent = {
        id: eventId,
        name: 'Updated Product Launch Q1',
        type: 'product_launch',
        description: 'Updated description with more details',
        startTime: '2024-01-15T09:00:00Z',
        severity: 'high',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:05:00Z',
        status: 'registered',
        metadata: {
          updated_field: 'new_value'
        }
      };

      mockBusinessEventService.updateEvent.mockResolvedValue(mockUpdatedEvent);

      const response = await request(app)
        .put(`/api/events/${eventId}/update`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          event: mockUpdatedEvent
        },
        message: 'Event updated successfully'
      });

      expect(mockBusinessEventService.updateEvent).toHaveBeenCalledWith(eventId, updateData);
    });

    test('should handle non-existent event updates', async () => {
      // RED: This test should fail - not found handling not implemented
      const eventId = 'EVENT-NONEXISTENT';
      const updateData = {
        name: 'Updated Event'
      };

      mockBusinessEventService.updateEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .put(`/api/events/${eventId}/update`)
        .send(updateData)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: eventId
          }
        }
      });
    });

    test('should validate update data before processing', async () => {
      // RED: This test should fail - update validation not implemented
      const eventId = 'EVENT-001';
      const invalidUpdateData = {
        type: 'invalid_type',
        severity: 'invalid_severity',
        startTime: 'invalid-date'
      };

      const response = await request(app)
        .put(`/api/events/${eventId}/update`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('validation_error');
      expect(mockBusinessEventService.updateEvent).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/events/:eventId', () => {
    test('should delete an event successfully', async () => {
      // RED: This test should fail - delete endpoint not implemented
      const eventId = 'EVENT-001';

      mockBusinessEventService.deleteEvent.mockResolvedValue({ deleted: true });

      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          deleted: true,
          eventId
        },
        message: 'Event deleted successfully'
      });

      expect(mockBusinessEventService.deleteEvent).toHaveBeenCalledWith(eventId);
    });

    test('should handle deletion of non-existent event', async () => {
      // RED: This test should fail - delete not found handling not implemented
      const eventId = 'EVENT-NONEXISTENT';

      mockBusinessEventService.deleteEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: eventId
          }
        }
      });
    });
  });

  describe('GET /api/events/:eventId', () => {
    test('should retrieve an event by ID successfully', async () => {
      // RED: This test should fail - get endpoint not implemented
      const eventId = 'EVENT-001';
      const mockEvent = {
        id: eventId,
        name: 'Product Launch Q1',
        type: 'product_launch',
        description: 'Launch of new premium product line',
        startTime: '2024-01-15T09:00:00Z',
        endTime: '2024-01-15T18:00:00Z',
        severity: 'major',
        status: 'registered',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z'
      };

      mockBusinessEventService.getEvent.mockResolvedValue(mockEvent);

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          event: mockEvent
        }
      });

      expect(mockBusinessEventService.getEvent).toHaveBeenCalledWith(eventId);
    });

    test('should handle retrieval of non-existent event', async () => {
      // RED: This test should fail - get not found handling not implemented
      const eventId = 'EVENT-NONEXISTENT';

      mockBusinessEventService.getEvent.mockRejectedValue(new Error('Event not found'));

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: eventId
          }
        }
      });
    });
  });

  describe('GET /api/events', () => {
    test('should retrieve all events with optional filtering', async () => {
      // RED: This test should fail - list endpoint not implemented
      const mockEvents = [
        {
          id: 'EVENT-001',
          name: 'Product Launch Q1',
          type: 'product_launch',
          severity: 'major',
          status: 'registered',
          startTime: '2024-01-15T09:00:00Z'
        },
        {
          id: 'EVENT-002',
          name: 'System Maintenance',
          type: 'maintenance_window',
          severity: 'medium',
          status: 'active',
          startTime: '2024-01-16T02:00:00Z'
        }
      ];

      mockBusinessEventService.getAllEvents.mockResolvedValue(mockEvents);

      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          events: mockEvents,
          count: 2,
          pagination: {
            page: 1,
            limit: 50,
            total: 2,
            hasNext: false,
            hasPrev: false
          }
        }
      });

      expect(mockBusinessEventService.getAllEvents).toHaveBeenCalled();
    });

    test('should filter events by type when provided', async () => {
      // RED: This test should fail - filtering not implemented
      const eventType = 'product_launch';
      const mockFilteredEvents = [
        {
          id: 'EVENT-001',
          name: 'Product Launch Q1',
          type: 'product_launch',
          severity: 'major',
          status: 'registered'
        }
      ];

      mockBusinessEventService.getEventsByType.mockResolvedValue(mockFilteredEvents);

      const response = await request(app)
        .get('/api/events')
        .query({ type: eventType })
        .expect(200);

      expect(response.body.data.events).toEqual(mockFilteredEvents);
      expect(mockBusinessEventService.getEventsByType).toHaveBeenCalledWith(eventType);
    });

    test('should filter events by date range when provided', async () => {
      // RED: This test should fail - date filtering not implemented
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockDateFilteredEvents = [
        {
          id: 'EVENT-001',
          name: 'January Event',
          type: 'product_launch',
          startTime: '2024-01-15T09:00:00Z'
        }
      ];

      mockBusinessEventService.getEventsByTimeRange.mockResolvedValue(mockDateFilteredEvents);

      const response = await request(app)
        .get('/api/events')
        .query({ startDate, endDate })
        .expect(200);

      expect(response.body.data.events).toEqual(mockDateFilteredEvents);
      expect(mockBusinessEventService.getEventsByTimeRange).toHaveBeenCalledWith(
        new Date(startDate),
        new Date(endDate)
      );
    });

    test('should handle pagination parameters', async () => {
      // RED: This test should fail - pagination not implemented
      const page = 2;
      const limit = 10;
      const mockPaginatedEvents = Array.from({ length: 10 }, (_, i) => ({
        id: `EVENT-${String(i + 11).padStart(3, '0')}`,
        name: `Event ${i + 11}`,
        type: 'product_launch',
        status: 'registered'
      }));

      mockBusinessEventService.getAllEvents.mockResolvedValue(mockPaginatedEvents);

      const response = await request(app)
        .get('/api/events')
        .query({ page, limit })
        .expect(200);

      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 10,
        hasNext: false,
        hasPrev: true
      });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});