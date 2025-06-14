import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';

let db: Database.Database | null = null;

export const initializeSQLite = async (): Promise<void> => {
  try {
    // Ensure data directory exists
    const dbPath = path.resolve(config.database.sqlite.path);
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database connection
    db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = 1000000;');
    db.exec('PRAGMA foreign_keys = ON;');
    
    // Create tables
    await createTables();
    
  } catch (error) {
    console.error('Failed to initialize SQLite:', error);
    throw error;
  }
};

export const createTables = async (): Promise<void> => {
  if (!db) throw new Error('Database not initialized');

  // Sentiment analysis results table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sentiment_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
      score REAL NOT NULL CHECK (score >= -1 AND score <= 1),
      confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Datasets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      record_count INTEGER NOT NULL,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Analysis batches table
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_batches (
      id TEXT PRIMARY KEY,
      dataset_id TEXT REFERENCES datasets(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      progress INTEGER DEFAULT 0,
      total_records INTEGER NOT NULL,
      completed_records INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_created_at ON sentiment_analyses(created_at);
    CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_sentiment ON sentiment_analyses(sentiment);
    CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);
    CREATE INDEX IF NOT EXISTS idx_analysis_batches_status ON analysis_batches(status);
    CREATE INDEX IF NOT EXISTS idx_analysis_batches_dataset_id ON analysis_batches(dataset_id);
  `);

  // Create triggers for updated_at
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_sentiment_analyses_updated_at 
    AFTER UPDATE ON sentiment_analyses
    BEGIN
      UPDATE sentiment_analyses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_datasets_updated_at 
    AFTER UPDATE ON datasets
    BEGIN
      UPDATE datasets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_analysis_batches_updated_at 
    AFTER UPDATE ON analysis_batches
    BEGIN
      UPDATE analysis_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
};

export const getSQLiteConnection = (): Database.Database | null => {
  return db;
};

export const closeSQLiteConnection = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};