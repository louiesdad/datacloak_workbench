import { CreateAnalysisSessionsMigration } from '../../database/migrations/create-analysis-sessions.migration';
import { TestDatabaseFactory } from '../utils/test-database-factory';

describe('Analysis Sessions Migration - TDD', () => {
  let db: any;
  let migration: CreateAnalysisSessionsMigration;

  beforeEach(async () => {
    db = await TestDatabaseFactory.createTestDatabase();
    migration = new CreateAnalysisSessionsMigration(db);
  });

  afterEach(async () => {
    await TestDatabaseFactory.cleanup(db);
  });

  describe('RED Phase - Schema Migration Tests', () => {
    it('should create analysis_sessions table with required columns', async () => {
      // RED: This test should FAIL initially
      await migration.up();
      
      const tableExists = await db.schema.hasTable('analysis_sessions');
      expect(tableExists).toBe(true);
      
      const columns = await db.schema.getColumns('analysis_sessions');
      expect(columns).toContain('session_id');
      expect(columns).toContain('name');
      expect(columns).toContain('description');
      expect(columns).toContain('status');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
      expect(columns).toContain('user_id');
    });

    it('should create file_registry table for staged files', async () => {
      await migration.up();
      
      const tableExists = await db.schema.hasTable('file_registry');
      expect(tableExists).toBe(true);
      
      const columns = await db.schema.getColumns('file_registry');
      expect(columns).toContain('file_id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('filename');
      expect(columns).toContain('file_path');
      expect(columns).toContain('row_count');
      expect(columns).toContain('column_metadata');
      expect(columns).toContain('potential_keys');
      expect(columns).toContain('staged_at');
    });

    it('should create file_relationships table for discovered connections', async () => {
      await migration.up();
      
      const tableExists = await db.schema.hasTable('file_relationships');
      expect(tableExists).toBe(true);
      
      const columns = await db.schema.getColumns('file_relationships');
      expect(columns).toContain('relationship_id');
      expect(columns).toContain('session_id');
      expect(columns).toContain('source_file_id');
      expect(columns).toContain('target_file_id');
      expect(columns).toContain('source_column');
      expect(columns).toContain('target_column');
      expect(columns).toContain('relationship_type');
      expect(columns).toContain('confidence_score');
      expect(columns).toContain('discovered_at');
    });

    it('should create proper primary keys and constraints', async () => {
      await migration.up();
      
      // Test primary key constraints
      const sessionsPK = await db.schema.getPrimaryKey('analysis_sessions');
      expect(sessionsPK).toContain('session_id');
      
      const filesPK = await db.schema.getPrimaryKey('file_registry');
      expect(filesPK).toContain('file_id');
      
      const relationshipsPK = await db.schema.getPrimaryKey('file_relationships');
      expect(relationshipsPK).toContain('relationship_id');
    });

    it('should create foreign key relationships', async () => {
      await migration.up();
      
      // Test foreign key constraints
      const fileFKs = await db.schema.getForeignKeys('file_registry');
      expect(fileFKs).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'session_id',
          targetTable: 'analysis_sessions',
          targetColumn: 'session_id'
        })
      );
      
      const relationshipFKs = await db.schema.getForeignKeys('file_relationships');
      expect(relationshipFKs).toContainEqual(
        expect.objectContaining({
          sourceColumn: 'source_file_id',
          targetTable: 'file_registry',
          targetColumn: 'file_id'
        })
      );
    });

    it('should create performance indexes', async () => {
      await migration.up();
      
      const sessionIndexes = await db.schema.getIndexes('analysis_sessions');
      expect(sessionIndexes).toContainEqual(
        expect.objectContaining({
          name: 'idx_sessions_user_id',
          columns: ['user_id']
        })
      );
      
      const fileIndexes = await db.schema.getIndexes('file_registry');
      expect(fileIndexes).toContainEqual(
        expect.objectContaining({
          name: 'idx_files_session_id',
          columns: ['session_id']
        })
      );
      
      const relationshipIndexes = await db.schema.getIndexes('file_relationships');
      expect(relationshipIndexes).toContainEqual(
        expect.objectContaining({
          name: 'idx_relationships_session',
          columns: ['session_id']
        })
      );
    });

    it('should support rollback migration', async () => {
      // Test forward migration
      await migration.up();
      expect(await db.schema.hasTable('analysis_sessions')).toBe(true);
      
      // Test rollback migration
      await migration.down();
      expect(await db.schema.hasTable('analysis_sessions')).toBe(false);
      expect(await db.schema.hasTable('file_registry')).toBe(false);
      expect(await db.schema.hasTable('file_relationships')).toBe(false);
    });

    it('should handle migration idempotency', async () => {
      // Run migration twice - should not error
      await migration.up();
      await migration.up(); // Second run should be safe
      
      expect(await db.schema.hasTable('analysis_sessions')).toBe(true);
    });
  });

  describe('Schema Validation Tests', () => {
    it('should enforce data types and constraints', async () => {
      await migration.up();
      
      // Test session status enum constraint - should fail with invalid status
      expect(() => {
        db.prepare(`
          INSERT INTO analysis_sessions (session_id, name, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run('test-session-1', 'Test Session', 'invalid_status', new Date().toISOString(), new Date().toISOString());
      }).toThrow();
      
      // Test valid status values - should succeed
      db.prepare(`
        INSERT INTO analysis_sessions (session_id, name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('test-session-1', 'Test Session', 'active', new Date().toISOString(), new Date().toISOString());
      
      const inserted = db.prepare('SELECT * FROM analysis_sessions WHERE session_id = ?').get('test-session-1');
      expect(inserted.status).toBe('active');
    });

    it('should enforce required fields', async () => {
      await migration.up();
      
      // Test missing required fields - should fail without name
      expect(() => {
        db.prepare(`
          INSERT INTO analysis_sessions (session_id)
          VALUES (?)
        `).run('test-session-2');
      }).toThrow();
    });
  });
});