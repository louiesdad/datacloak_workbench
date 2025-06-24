import { DatabaseService } from '../database/sqlite';
import logger from '../config/logger';

// Enhanced validation and audit logging for business events
const VALID_EVENT_TYPES = [
  'price_change',
  'system_outage', 
  'feature_launch',
  'policy_change',
  'marketing_campaign',
  'service_disruption',
  'product_discontinuation',
  'competitor_action',
  'seasonal_event',
  'regulatory_change'
] as const;

type ValidEventType = typeof VALID_EVENT_TYPES[number];

export interface BusinessEvent {
  id: string;
  eventType: string;
  eventDate: string;
  description: string;
  affectedCustomers: string[] | 'all';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateEventData {
  eventType: ValidEventType | string;
  eventDate: string;
  description: string;
  affectedCustomers: string[] | 'all';
  metadata?: Record<string, any>; // Additional event metadata
}

export interface UpdateEventData {
  eventType?: string;
  eventDate?: string;
  description?: string;
  affectedCustomers?: string[] | 'all';
}

export interface ListEventsOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: {
    eventType?: string;
    startDate?: string;
    endDate?: string;
    affectedCustomer?: string;
  };
}

export interface PaginatedEventsResult {
  events: BusinessEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class BusinessEventService {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  // Enhanced utility methods
  getValidEventTypes(): readonly string[] {
    return VALID_EVENT_TYPES;
  }

  isValidEventType(eventType: string): boolean {
    return VALID_EVENT_TYPES.includes(eventType as ValidEventType);
  }

  async createEvent(eventData: CreateEventData): Promise<BusinessEvent> {
    const startTime = Date.now();
    
    try {
      // Enhanced validation with audit logging
      this.validateEventData(eventData);

      const sql = `
        INSERT INTO business_events (
          event_type, event_date, description, affected_customers
        ) VALUES (?, ?, ?, ?)
      `;

      const result = await this.databaseService.run(sql, [
        eventData.eventType,
        eventData.eventDate,
        eventData.description,
        JSON.stringify(eventData.affectedCustomers)
      ]);

      const createdEvent = {
        id: result.lastInsertRowid as string,
        eventType: eventData.eventType,
        eventDate: eventData.eventDate,
        description: eventData.description,
        affectedCustomers: eventData.affectedCustomers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };

      // Enhanced audit logging for successful creation
      const duration = Date.now() - startTime;
      logger.info('Business event created successfully', {
        component: 'business-event-service',
        operation: 'create',
        eventId: createdEvent.id,
        eventType: eventData.eventType,
        eventDate: eventData.eventDate,
        affectedCustomersCount: Array.isArray(eventData.affectedCustomers) ? eventData.affectedCustomers.length : 'all',
        descriptionLength: eventData.description.length,
        duration,
        metadata: eventData.metadata ? 'present' : 'none'
      });

      return createdEvent;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Enhanced error logging with context
      logger.error('Failed to create business event', {
        component: 'business-event-service',
        operation: 'create',
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        duration,
        eventData: {
          eventType: eventData.eventType,
          eventDate: eventData.eventDate,
          descriptionLength: eventData.description?.length || 0,
          affectedCustomersType: Array.isArray(eventData.affectedCustomers) ? 'array' : typeof eventData.affectedCustomers
        }
      });
      
      throw error;
    }
  }

  async getEventById(id: string): Promise<BusinessEvent | null> {
    try {
      const sql = `
        SELECT * FROM business_events 
        WHERE id = ? AND deleted_at IS NULL
      `;

      const results = await this.databaseService.query(sql, [id]);
      
      if (results.length === 0) {
        return null;
      }

      return this.mapDbRowToEvent(results[0]);
    } catch (error) {
      logger.error('Failed to get business event by ID', {
        component: 'business-event-service',
        eventId: id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<BusinessEvent[]> {
    try {
      const sql = `
        SELECT * FROM business_events 
        WHERE event_date BETWEEN ? AND ? AND deleted_at IS NULL
        ORDER BY event_date ASC
      `;

      const results = await this.databaseService.query(sql, [startDate, endDate]);
      
      return results.map(row => this.mapDbRowToEvent(row));
    } catch (error) {
      logger.error('Failed to get events by date range', {
        component: 'business-event-service',
        startDate,
        endDate,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async getEventsByType(eventType: string): Promise<BusinessEvent[]> {
    try {
      const sql = `
        SELECT * FROM business_events 
        WHERE event_type = ? AND deleted_at IS NULL
        ORDER BY event_date DESC
      `;

      const results = await this.databaseService.query(sql, [eventType]);
      
      return results.map(row => this.mapDbRowToEvent(row));
    } catch (error) {
      logger.error('Failed to get events by type', {
        component: 'business-event-service',
        eventType,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async updateEvent(id: string, updateData: UpdateEventData): Promise<BusinessEvent> {
    try {
      // Filter out immutable fields
      const allowedFields = ['description', 'affectedCustomers', 'eventDate', 'eventType'];
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(updateData).forEach(([key, value]) => {
        if (allowedFields.includes(key) && value !== undefined) {
          if (key === 'affectedCustomers') {
            updateFields.push('affected_customers = ?');
            updateValues.push(JSON.stringify(value));
          } else if (key === 'eventType') {
            updateFields.push('event_type = ?');
            updateValues.push(value);
          } else if (key === 'eventDate') {
            updateFields.push('event_date = ?');
            updateValues.push(value);
          } else {
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
          }
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(id);

      const sql = `
        UPDATE business_events 
        SET ${updateFields.join(', ')}
        WHERE id = ? AND deleted_at IS NULL
      `;

      const result = await this.databaseService.run(sql, updateValues);

      if (result.changes === 0) {
        throw new Error(`Event not found: ${id}`);
      }

      // Return the updated event
      const updatedEvent = await this.getEventById(id);
      if (!updatedEvent) {
        throw new Error(`Failed to retrieve updated event: ${id}`);
      }

      return updatedEvent;
    } catch (error) {
      logger.error('Failed to update business event', {
        component: 'business-event-service',
        eventId: id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async deleteEvent(id: string): Promise<boolean> {
    try {
      // Check for existing impact analysis
      const impactCheckSql = `
        SELECT COUNT(*) as count FROM event_impacts WHERE event_id = ?
      `;
      const impactResults = await this.databaseService.query(impactCheckSql, [id]);
      
      if (impactResults && impactResults.length > 0 && impactResults[0]?.count > 0) {
        throw new Error('Cannot delete event with existing impact analysis. Delete impacts first.');
      }

      // Perform soft delete
      const sql = `
        UPDATE business_events 
        SET deleted_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND deleted_at IS NULL
      `;

      const result = await this.databaseService.run(sql, [id]);
      
      return result.changes > 0;
    } catch (error) {
      logger.error('Failed to delete business event', {
        component: 'business-event-service',
        eventId: id,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async listEvents(options: ListEventsOptions = {}): Promise<PaginatedEventsResult> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc',
        filters = {}
      } = options;

      const offset = (page - 1) * limit;

      // Build WHERE clause
      const whereConditions = ['deleted_at IS NULL'];
      const queryParams: any[] = [];

      if (filters.eventType) {
        whereConditions.push('event_type = ?');
        queryParams.push(filters.eventType);
      }

      if (filters.startDate && filters.endDate) {
        whereConditions.push('event_date BETWEEN ? AND ?');
        queryParams.push(filters.startDate, filters.endDate);
      }

      if (filters.affectedCustomer) {
        whereConditions.push('JSON_EXTRACT(affected_customers, "$") LIKE ?');
        queryParams.push(`%${filters.affectedCustomer}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Count total records
      const countSql = `
        SELECT COUNT(*) as total FROM business_events 
        WHERE ${whereClause}
      `;
      const countResult = await this.databaseService.query(countSql, queryParams);
      const total = countResult[0]?.total || 0;

      // Get events with pagination
      const dataSql = `
        SELECT * FROM business_events 
        WHERE ${whereClause}
        ORDER BY ${this.mapSortField(sortBy)} ${sortOrder.toUpperCase()}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const events = await this.databaseService.query(dataSql, queryParams);

      const totalPages = Math.ceil(total / limit);

      return {
        events: events.map(row => this.mapDbRowToEvent(row)),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('Failed to list business events', {
        component: 'business-event-service',
        options,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private validateEventData(eventData: CreateEventData): void {
    const validationErrors: string[] = [];

    // Enhanced event type validation
    if (!eventData.eventType || eventData.eventType.trim() === '') {
      validationErrors.push('eventType is required');
    } else if (!VALID_EVENT_TYPES.includes(eventData.eventType as ValidEventType)) {
      logger.warn('Non-standard event type used', {
        component: 'business-event-service',
        eventType: eventData.eventType,
        validTypes: VALID_EVENT_TYPES
      });
      // Don't fail validation, just log warning for custom types
    }

    // Enhanced date validation
    if (!eventData.eventDate) {
      validationErrors.push('eventDate is required');
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(eventData.eventDate)) {
        validationErrors.push('eventDate must be a valid date (YYYY-MM-DD)');
      } else {
        const date = new Date(eventData.eventDate + 'T00:00:00.000Z');
        if (isNaN(date.getTime())) {
          validationErrors.push('eventDate must be a valid date (YYYY-MM-DD)');
        } else {
          // Check if date is not too far in the future (max 1 year)
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
          if (date > oneYearFromNow) {
            validationErrors.push('eventDate cannot be more than 1 year in the future');
          }
          // Check if date is not too far in the past (max 10 years)
          const tenYearsAgo = new Date();
          tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
          if (date < tenYearsAgo) {
            validationErrors.push('eventDate cannot be more than 10 years in the past');
          }
        }
      }
    }

    // Enhanced description validation
    if (!eventData.description || eventData.description.trim() === '') {
      validationErrors.push('description is required');
    } else if (eventData.description.length > 1000) {
      validationErrors.push('description cannot exceed 1000 characters');
    } else if (eventData.description.length < 10) {
      validationErrors.push('description must be at least 10 characters long');
    }

    // Enhanced affected customers validation
    if (!eventData.affectedCustomers) {
      validationErrors.push('affectedCustomers is required');
    } else if (Array.isArray(eventData.affectedCustomers)) {
      if (eventData.affectedCustomers.length === 0) {
        validationErrors.push('affectedCustomers array cannot be empty');
      } else if (eventData.affectedCustomers.length > 10000) {
        validationErrors.push('affectedCustomers array cannot exceed 10,000 entries');
      } else {
        // Validate customer ID format
        const invalidCustomers = eventData.affectedCustomers.filter(
          customer => !customer || typeof customer !== 'string' || customer.trim() === ''
        );
        if (invalidCustomers.length > 0) {
          validationErrors.push('all customer IDs must be non-empty strings');
        }
      }
    } else if (eventData.affectedCustomers !== 'all') {
      validationErrors.push('affectedCustomers must be an array of customer IDs or "all"');
    }

    // Metadata validation
    if (eventData.metadata) {
      if (typeof eventData.metadata !== 'object' || Array.isArray(eventData.metadata)) {
        validationErrors.push('metadata must be an object');
      } else {
        const metadataStr = JSON.stringify(eventData.metadata);
        if (metadataStr.length > 5000) {
          validationErrors.push('metadata cannot exceed 5000 characters when serialized');
        }
      }
    }

    if (validationErrors.length > 0) {
      const errorMessage = `Validation failed: ${validationErrors.join(', ')}`;
      
      // Enhanced audit logging for validation failures
      logger.warn('Business event validation failed', {
        component: 'business-event-service',
        operation: 'create',
        validationErrors,
        eventData: {
          eventType: eventData.eventType,
          eventDate: eventData.eventDate,
          descriptionLength: eventData.description?.length || 0,
          affectedCustomersType: Array.isArray(eventData.affectedCustomers) ? 'array' : typeof eventData.affectedCustomers,
          affectedCustomersCount: Array.isArray(eventData.affectedCustomers) ? eventData.affectedCustomers.length : 'N/A'
        }
      });
      
      throw new Error(errorMessage);
    }

    // Audit log successful validation
    logger.debug('Business event validation passed', {
      component: 'business-event-service',
      operation: 'create',
      eventType: eventData.eventType,
      eventDate: eventData.eventDate,
      affectedCustomersCount: Array.isArray(eventData.affectedCustomers) ? eventData.affectedCustomers.length : 'all'
    });
  }

  private mapDbRowToEvent(row: any): BusinessEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      eventDate: row.event_date,
      description: row.description,
      affectedCustomers: JSON.parse(row.affected_customers),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      'eventType': 'event_type',
      'eventDate': 'event_date',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at'
    };

    return fieldMap[sortBy] || 'created_at';
  }
}

export default BusinessEventService;