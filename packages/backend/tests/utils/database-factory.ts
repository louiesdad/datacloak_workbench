import Database from 'better-sqlite3';
import { join } from 'path';
import { readFileSync } from 'fs';

export class TestDatabaseFactory {
  private static instances: Map<string, Database.Database> = new Map();

  static createInMemory(name: string = 'test'): Database.Database {
    if (this.instances.has(name)) {
      return this.instances.get(name)!;
    }

    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    
    this.initializeSchema(db);
    this.instances.set(name, db);
    
    return db;
  }

  static createFile(filename: string): Database.Database {
    const db = new Database(filename);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    
    this.initializeSchema(db);
    return db;
  }

  private static initializeSchema(db: Database.Database) {
    // Create base tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        size INTEGER NOT NULL,
        mimetype TEXT,
        user_id INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS analysis_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        sentiment_score REAL,
        sentiment_label TEXT,
        pii_detected BOOLEAN DEFAULT 0,
        pii_types TEXT,
        masked_content TEXT,
        processing_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        data TEXT,
        result TEXT,
        error TEXT,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        name TEXT,
        permissions TEXT,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
      CREATE INDEX IF NOT EXISTS idx_analysis_results_file_id ON analysis_results(file_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);
  }

  static cleanupAll() {
    for (const [name, db] of this.instances) {
      db.close();
    }
    this.instances.clear();
  }

  static cleanup(name: string) {
    const db = this.instances.get(name);
    if (db) {
      db.close();
      this.instances.delete(name);
    }
  }

  static reset(name: string) {
    const db = this.instances.get(name);
    if (db) {
      // Delete all data but keep schema
      db.exec(`
        DELETE FROM audit_logs;
        DELETE FROM api_keys;
        DELETE FROM jobs;
        DELETE FROM analysis_results;
        DELETE FROM files;
        DELETE FROM users;
      `);
    }
  }
}