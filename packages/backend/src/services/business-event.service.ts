import { DatabaseService } from '../database/sqlite';
import logger from '../config/logger';

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
  eventType: string;
  eventDate: string;
  description: string;
  affectedCustomers: string[] | 'all';
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

  async createEvent(eventData: CreateEventData): Promise<BusinessEvent> {
    try {
      // Validation
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

      // Return the created event
      return {
        id: result.lastInsertRowid as string,
        eventType: eventData.eventType,
        eventDate: eventData.eventDate,
        description: eventData.description,
        affectedCustomers: eventData.affectedCustomers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };
    } catch (error) {
      logger.error('Failed to create business event', {
        component: 'business-event-service',
        error: error instanceof Error ? error.message : error
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
    if (!eventData.eventType || eventData.eventType.trim() === '') {
      throw new Error('Validation failed: eventType is required');
    }

    if (!eventData.eventDate) {
      throw new Error('Validation failed: eventDate is required');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(eventData.eventDate)) {
      throw new Error('Validation failed: eventDate must be a valid date (YYYY-MM-DD)');
    }

    // Validate that it's a real date
    const date = new Date(eventData.eventDate + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
      throw new Error('Validation failed: eventDate must be a valid date (YYYY-MM-DD)');
    }

    if (!eventData.description || eventData.description.trim() === '') {
      throw new Error('Validation failed: description is required');
    }

    if (!eventData.affectedCustomers) {
      throw new Error('Validation failed: affectedCustomers is required');
    }
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