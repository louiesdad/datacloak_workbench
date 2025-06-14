import * as duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';

let db: duckdb.Database | null = null;

export const initializeDuckDB = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Ensure data directory exists
      const dbPath = path.resolve(config.database.duckdb.path);
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection
      db = new duckdb.Database(dbPath, (err) => {
        if (err) {
          console.error('Failed to create DuckDB connection:', err);
          reject(err);
          return;
        }

        // Create tables
        createDuckDBTables()
          .then(() => resolve())
          .catch(reject);
      });

    } catch (error) {
      console.error('Failed to initialize DuckDB:', error);
      reject(error);
    }
  });
};

const createDuckDBTables = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.run(`
      CREATE TABLE IF NOT EXISTS text_analytics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        text VARCHAR NOT NULL,
        sentiment VARCHAR CHECK (sentiment IN ('positive', 'negative', 'neutral')),
        score DOUBLE CHECK (score >= -1 AND score <= 1),
        confidence DOUBLE CHECK (confidence >= 0 AND confidence <= 1),
        keywords TEXT[],
        entities STRUCT(
          person VARCHAR[],
          organization VARCHAR[],
          location VARCHAR[]
        ),
        language VARCHAR,
        word_count INTEGER,
        char_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dataset_id VARCHAR,
        batch_id VARCHAR
      );
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create aggregation table for analytics
      db?.run(`
        CREATE TABLE IF NOT EXISTS sentiment_statistics (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          date_bucket DATE,
          sentiment VARCHAR,
          count BIGINT,
          avg_score DOUBLE,
          avg_confidence DOUBLE,
          dataset_id VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create indexes
        db?.run(`
          CREATE INDEX IF NOT EXISTS idx_text_analytics_created_at ON text_analytics(created_at);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_sentiment ON text_analytics(sentiment);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_dataset_id ON text_analytics(dataset_id);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_batch_id ON text_analytics(batch_id);
          CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_date_bucket ON sentiment_statistics(date_bucket);
          CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_sentiment ON sentiment_statistics(sentiment);
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  });
};

export const getDuckDBConnection = (): duckdb.Database | null => {
  return db;
};

export const queryDuckDB = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

export const runDuckDB = (sql: string, params: any[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const closeDuckDBConnection = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};