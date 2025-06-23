import { DatabaseService } from './enhanced-database.service';

export interface BusinessEvent {
  id?: string;
  eventType: string;
  eventDate: Date;
  description: string;
  affectedCustomers: string[] | 'all';
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface EventUpdateData {
  eventType?: string;
  eventDate?: Date;
  description?: string;
  affectedCustomers?: string[] | 'all';
}

export class BusinessEventRegistry {
  constructor(private database: DatabaseService) {}

  async createEvent(event: Omit<BusinessEvent, 'id' | 'createdAt'>): Promise<BusinessEvent> {
    // Validate event date
    if (event.eventDate > new Date()) {
      throw new Error('Event date cannot be in the future');
    }

    const query = `
      INSERT INTO business_events (event_type, event_date, description, affected_customers, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, event_type, event_date, description, affected_customers, created_at
    `;

    const values = [
      event.eventType,
      event.eventDate,
      event.description,
      JSON.stringify(event.affectedCustomers)
    ];

    const result = await this.database.query(query, values);
    return this.mapRowToBusinessEvent(result.rows[0]);
  }

  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<BusinessEvent[]> {
    const query = `
      SELECT * FROM business_events 
      WHERE event_date BETWEEN $1 AND $2 
      AND deleted_at IS NULL
      ORDER BY event_date DESC
    `;

    const result = await this.database.query(query, [startDate, endDate]);
    return result.rows.map(row => this.mapRowToBusinessEvent(row));
  }

  async getEventsByType(eventType: string): Promise<BusinessEvent[]> {
    const query = `
      SELECT * FROM business_events 
      WHERE event_type = $1 
      AND deleted_at IS NULL
      ORDER BY event_date DESC
    `;

    const result = await this.database.query(query, [eventType]);
    return result.rows.map(row => this.mapRowToBusinessEvent(row));
  }

  async getEventsForCustomer(customerId: string): Promise<BusinessEvent[]> {
    const query = `
      SELECT * FROM business_events 
      WHERE (
        affected_customers::jsonb = '"all"' 
        OR affected_customers::jsonb @> $1::jsonb
      )
      AND deleted_at IS NULL
      ORDER BY event_date DESC
    `;

    const result = await this.database.query(query, [JSON.stringify(customerId)]);
    return result.rows.map(row => this.mapRowToBusinessEvent(row));
  }

  async updateEvent(eventId: string, updates: EventUpdateData): Promise<BusinessEvent> {
    // Validate event date if provided
    if (updates.eventDate && updates.eventDate > new Date()) {
      throw new Error('Event date cannot be in the future');
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramCount}`);
      values.push(updates.description);
      paramCount++;
    }

    if (updates.affectedCustomers !== undefined) {
      setClauses.push(`affected_customers = $${paramCount}`);
      values.push(JSON.stringify(updates.affectedCustomers));
      paramCount++;
    }

    if (updates.eventDate !== undefined) {
      setClauses.push(`event_date = $${paramCount}`);
      values.push(updates.eventDate);
      paramCount++;
    }

    if (updates.eventType !== undefined) {
      setClauses.push(`event_type = $${paramCount}`);
      values.push(updates.eventType);
      paramCount++;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(eventId);

    const query = `
      UPDATE business_events 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, event_type, event_date, description, affected_customers, created_at, updated_at
    `;

    const result = await this.database.query(query, values);
    return this.mapRowToBusinessEvent(result.rows[0]);
  }

  async deleteEvent(eventId: string): Promise<{ success: boolean }> {
    const query = `
      UPDATE business_events 
      SET deleted_at = NOW() 
      WHERE id = $1
      RETURNING id, deleted_at
    `;

    const result = await this.database.query(query, [eventId]);
    return { success: result.rows.length > 0 };
  }

  private mapRowToBusinessEvent(row: any): BusinessEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      eventDate: row.event_date,
      description: row.description,
      affectedCustomers: typeof row.affected_customers === 'string' 
        ? JSON.parse(row.affected_customers) 
        : row.affected_customers,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at
    };
  }
}