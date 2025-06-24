import Database from 'better-sqlite3';

export interface MigrationInterface {
  up(): Promise<void>;
  down(): Promise<void>;
}

export class CreateAnalysisSessionsMigration implements MigrationInterface {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async up(): Promise<void> {
    // Check if tables already exist (for idempotency)
    const existingTables = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('analysis_sessions', 'file_registry', 'file_relationships')
    `).all();

    if (existingTables.length > 0) {
      // Tables already exist - migration is idempotent
      return;
    }

    // Create analysis_sessions table
    this.db.exec(`
      CREATE TABLE analysis_sessions (
        session_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed', 'cancelled')) DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT
      );
    `);

    // Create file_registry table
    this.db.exec(`
      CREATE TABLE file_registry (
        file_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        column_metadata TEXT, -- JSON column metadata
        potential_keys TEXT,   -- JSON array of potential key columns
        staged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES analysis_sessions(session_id) ON DELETE CASCADE
      );
    `);

    // Create file_relationships table
    this.db.exec(`
      CREATE TABLE file_relationships (
        relationship_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        source_file_id TEXT NOT NULL,
        target_file_id TEXT NOT NULL,
        source_column TEXT NOT NULL,
        target_column TEXT NOT NULL,
        relationship_type TEXT NOT NULL CHECK (relationship_type IN ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY')),
        confidence_score REAL NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
        discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES analysis_sessions(session_id) ON DELETE CASCADE,
        FOREIGN KEY (source_file_id) REFERENCES file_registry(file_id) ON DELETE CASCADE,
        FOREIGN KEY (target_file_id) REFERENCES file_registry(file_id) ON DELETE CASCADE
      );
    `);

    // Create performance indexes
    this.db.exec(`
      CREATE INDEX idx_sessions_user_id ON analysis_sessions(user_id);
      CREATE INDEX idx_files_session_id ON file_registry(session_id);
      CREATE INDEX idx_relationships_session ON file_relationships(session_id);
      CREATE INDEX idx_relationships_source_file ON file_relationships(source_file_id);
      CREATE INDEX idx_relationships_target_file ON file_relationships(target_file_id);
    `);
  }

  async down(): Promise<void> {
    // Drop tables in reverse order to handle foreign key constraints
    this.db.exec(`
      DROP INDEX IF EXISTS idx_relationships_target_file;
      DROP INDEX IF EXISTS idx_relationships_source_file;
      DROP INDEX IF EXISTS idx_relationships_session;
      DROP INDEX IF EXISTS idx_files_session_id;
      DROP INDEX IF EXISTS idx_sessions_user_id;
      
      DROP TABLE IF EXISTS file_relationships;
      DROP TABLE IF EXISTS file_registry;
      DROP TABLE IF EXISTS analysis_sessions;
    `);
  }
}