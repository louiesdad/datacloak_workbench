import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Causal Analysis Migration', () => {
  let db: Database.Database;
  let migrationSQL: string;

  beforeAll(() => {
    // Read the migration file
    const migrationPath = join(__dirname, '../migrations/007_add_causal_analysis_tables.sql');
    migrationSQL = readFileSync(migrationPath, 'utf-8');
  });

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Extract UP migration
    const upMatch = migrationSQL.match(/-- UP([\s\S]*?)(?=-- DOWN|$)/);
    if (upMatch) {
      const upSQL = upMatch[1].trim();
      // Execute the entire UP migration as one block
      // This handles multi-line statements like CREATE TRIGGER properly
      db.exec(upSQL);
    }
  });

  afterEach(() => {
    db.close();
  });

  describe('business_events table', () => {
    test('should create business_events table with correct schema', () => {
      // Test table exists
      const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='business_events'
      `).all();
      
      expect(tableInfo).toHaveLength(1);
      const createStatement = tableInfo[0].sql;
      
      // Verify columns exist
      expect(createStatement).toContain('id');
      expect(createStatement).toContain('event_type');
      expect(createStatement).toContain('event_date');
      expect(createStatement).toContain('description');
      expect(createStatement).toContain('affected_customers');
      expect(createStatement).toContain('created_at');
      expect(createStatement).toContain('updated_at');
      expect(createStatement).toContain('deleted_at');
    });

    test('should insert and retrieve business events', () => {
      // Insert test event
      const insert = db.prepare(`
        INSERT INTO business_events (event_type, event_date, description, affected_customers)
        VALUES (?, ?, ?, ?)
      `);
      insert.run('outage', '2024-05-03', 'Test outage', JSON.stringify(['customer-1', 'customer-2']));

      // Retrieve event
      const result = db.prepare('SELECT * FROM business_events').all();
      
      expect(result).toHaveLength(1);
      expect(result[0].event_type).toBe('outage');
      expect(result[0].description).toBe('Test outage');
    });

    test('should handle soft deletes', () => {
      // Insert event
      const insert = db.prepare(`
        INSERT INTO business_events (event_type, event_date, description, affected_customers)
        VALUES (?, ?, ?, ?)
      `);
      insert.run('price_increase', '2024-06-01', 'Price change', JSON.stringify('all'));

      // Soft delete
      db.prepare(`
        UPDATE business_events SET deleted_at = CURRENT_TIMESTAMP WHERE event_type = ?
      `).run('price_increase');

      // Query without deleted
      const result = db.prepare(`
        SELECT * FROM business_events WHERE deleted_at IS NULL
      `).all();
      
      expect(result).toHaveLength(0);
    });
  });

  describe('event_impacts table', () => {
    test('should create event_impacts table with correct schema', () => {
      const tableInfo = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='event_impacts'
      `).all();
      
      expect(tableInfo).toHaveLength(1);
      const createStatement = tableInfo[0].sql;
      
      // Verify columns
      expect(createStatement).toContain('id');
      expect(createStatement).toContain('event_id');
      expect(createStatement).toContain('impact_percentage');
      expect(createStatement).toContain('customers_affected');
      expect(createStatement).toContain('sentiment_before');
      expect(createStatement).toContain('sentiment_after');
      expect(createStatement).toContain('is_significant');
      expect(createStatement).toContain('confidence');
      expect(createStatement).toContain('p_value');
      expect(createStatement).toContain('calculated_at');
    });

    test('should enforce foreign key constraint', () => {
      // Enable foreign keys (SQLite requires this)
      db.pragma('foreign_keys = ON');
      
      // First insert a business event
      const insertEvent = db.prepare(`
        INSERT INTO business_events (id, event_type, event_date, description, affected_customers)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertEvent.run('event-123', 'outage', '2024-05-03', 'Test', JSON.stringify('all'));

      // Insert impact analysis
      const insertImpact = db.prepare(`
        INSERT INTO event_impacts (
          event_id, impact_percentage, customers_affected, 
          sentiment_before, sentiment_after, is_significant, confidence, p_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertImpact.run('event-123', -15.5, 100, 75.0, 59.5, 1, 0.99, 0.001);

      const result = db.prepare('SELECT * FROM event_impacts').all();
      expect(result).toHaveLength(1);
      expect(result[0].impact_percentage).toBe(-15.5);
    });

    test('should reject impact for non-existent event', () => {
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      
      // Try to insert impact for non-existent event
      const insertImpact = db.prepare(`
        INSERT INTO event_impacts (
          event_id, impact_percentage, customers_affected,
          sentiment_before, sentiment_after, is_significant, confidence, p_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      expect(() => {
        insertImpact.run('non-existent', -10.0, 50, 70.0, 60.0, 1, 0.95, 0.05);
      }).toThrow();
    });
  });

  describe('indexes', () => {
    test('should create indexes for performance', () => {
      // Check indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all();

      const indexNames = indexes.map(row => row.name);
      
      expect(indexNames).toContain('idx_business_events_event_date');
      expect(indexNames).toContain('idx_business_events_event_type');
      expect(indexNames).toContain('idx_event_impacts_event_id');
      expect(indexNames).toContain('idx_event_impacts_calculated_at');
    });
  });

  describe('rollback', () => {
    test('should be able to rollback migration', () => {
      // Extract and run DOWN migration
      const downMatch = migrationSQL.match(/-- DOWN([\s\S]*?)$/);
      if (downMatch) {
        const downSQL = downMatch[1].trim();
        
        // Execute the entire DOWN migration as one block
        db.exec(downSQL);
        
        // Verify tables are dropped
        const tables = db.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' 
          AND name IN ('business_events', 'event_impacts')
        `).all();
        
        expect(tables).toHaveLength(0);
      }
    });
  });
});