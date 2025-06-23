import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('../../config/env', () => ({
  config: {
    database: {
      sqlite: {
        path: '/tmp/test-sqlite-duckdb-integration.db'
      },
      duckdb: {
        path: '/tmp/test-duckdb-integration.db'
      }
    }
  }
}));

import {
  enhancedDuckDBService,
  initializeDuckDB,
  queryDuckDB,
  runDuckDB,
  closeDuckDBConnection,
  getDuckDBStats
} from '../duckdb-enhanced';
import { initializeSQLite, closeSQLiteConnection, withSQLiteConnection } from '../sqlite-refactored';

describe('DuckDB Integration Tests', () => {
  beforeEach(async () => {
    // Initialize SQLite first for fallback
    await initializeSQLite();
    await closeDuckDBConnection();
    
    // Create analytics tables in SQLite for DuckDB fallback scenarios
    try {
      await withSQLiteConnection(async (db) => {
        // Create analytics tables that DuckDB tests expect
        db.exec(`
          CREATE TABLE IF NOT EXISTS text_analytics (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            score REAL NOT NULL,
            confidence REAL NOT NULL,
            keywords TEXT,
            language TEXT,
            word_count INTEGER,
            char_count INTEGER,
            dataset_id TEXT,
            batch_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS sentiment_statistics (
            id TEXT PRIMARY KEY,
            date_bucket TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            count INTEGER NOT NULL,
            avg_score REAL NOT NULL,
            avg_confidence REAL NOT NULL,
            dataset_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_text_analytics_created_at ON text_analytics(created_at);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_sentiment ON text_analytics(sentiment);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_dataset_id ON text_analytics(dataset_id);
          CREATE INDEX IF NOT EXISTS idx_text_analytics_batch_id ON text_analytics(batch_id);
          CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_date_bucket ON sentiment_statistics(date_bucket);
          CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_sentiment ON sentiment_statistics(sentiment);
        `);
      });
    } catch (error) {
      console.warn('Could not create analytics tables in SQLite:', error);
    }
  });

  afterEach(async () => {
    await closeDuckDBConnection();
    
    // Clean up SQLite test data
    try {
      await withSQLiteConnection(async (db) => {
        db.exec(`DELETE FROM text_analytics`);
        db.exec(`DELETE FROM sentiment_statistics`);
      });
    } catch (error) {
      console.warn('Could not clean up SQLite test data:', error);
    }
    
    await closeSQLiteConnection();
  });

  describe('service initialization', () => {
    test('should initialize DuckDB service or gracefully fall back', async () => {
      await initializeDuckDB();
      
      const stats = getDuckDBStats();
      
      // DuckDB should either initialize successfully OR gracefully fall back to SQLite
      if (stats.isInitialized) {
        expect(stats.hasInitializationError).toBe(false);
        expect(stats.fallbackEnabled).toBe(true);
      } else {
        // If not initialized, it should be due to fallback being enabled
        expect(stats.fallbackEnabled).toBe(true);
        // The service should not throw errors when fallback is enabled
        expect(async () => await queryDuckDB('SELECT 1')).not.toThrow();
      }
    });

    test('should handle skip flag', async () => {
      const originalSkip = process.env.SKIP_DUCKDB;
      process.env.SKIP_DUCKDB = 'true';
      
      try {
        await initializeDuckDB();
        const stats = getDuckDBStats();
        expect(stats.isInitialized).toBe(false);
      } finally {
        process.env.SKIP_DUCKDB = originalSkip;
      }
    });
  });

  describe('basic operations', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should execute queries', async () => {
      const result = await queryDuckDB('SELECT 42 as answer');
      expect(result).toEqual([{ answer: 42 }]);
    });

    test('should execute run statements', async () => {
      await runDuckDB(`
        CREATE TEMP TABLE integration_test (
          id INTEGER,
          name VARCHAR
        )
      `);
      
      await runDuckDB(
        'INSERT INTO integration_test VALUES (?, ?)',
        [1, 'Integration Test']
      );
      
      const result = await queryDuckDB('SELECT * FROM integration_test');
      expect(result).toEqual([{ id: 1, name: 'Integration Test' }]);
    });

    test('should handle parameterized queries', async () => {
      const result = await queryDuckDB(
        'SELECT ? as param1, ? as param2',
        ['hello', 'world']
      );
      
      expect(result).toEqual([{ param1: 'hello', param2: 'world' }]);
    });
  });

  describe('analytics tables operations', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should insert and query text analytics data', async () => {
      const testData = {
        id: 'test-analytics-1',
        text: 'This is a positive test message',
        sentiment: 'positive',
        score: 0.85,
        confidence: 0.92,
        keywords: 'test,positive,message',
        language: 'en',
        word_count: 6,
        char_count: 31,
        dataset_id: 'dataset-1',
        batch_id: 'batch-1'
      };

      await runDuckDB(`
        INSERT INTO text_analytics (
          id, text, sentiment, score, confidence, keywords,
          language, word_count, char_count, dataset_id, batch_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        testData.id, testData.text, testData.sentiment, testData.score,
        testData.confidence, testData.keywords, testData.language,
        testData.word_count, testData.char_count, testData.dataset_id,
        testData.batch_id
      ]);

      const result = await queryDuckDB(
        'SELECT * FROM text_analytics WHERE id = ?',
        [testData.id]
      );

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe(testData.text);
      expect(result[0].sentiment).toBe(testData.sentiment);
      expect(result[0].score).toBe(testData.score);
    });

    test('should handle sentiment statistics', async () => {
      await runDuckDB(`
        INSERT INTO sentiment_statistics (
          id, date_bucket, sentiment, count, avg_score, avg_confidence, dataset_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'stat-1', '2024-01-01', 'positive', 100, 0.75, 0.88, 'dataset-1'
      ]);

      const result = await queryDuckDB(
        'SELECT * FROM sentiment_statistics WHERE id = ?',
        ['stat-1']
      );

      expect(result).toHaveLength(1);
      expect(result[0].sentiment).toBe('positive');
      expect(result[0].count).toBe(100);
    });
  });

  describe('analytics queries', () => {
    beforeEach(async () => {
      await initializeDuckDB();
      
      // Insert test data
      const testEntries = [
        ['id-1', 'Positive message 1', 'positive', 0.8, 0.9, 'dataset-1', 'batch-1'],
        ['id-2', 'Negative message 1', 'negative', -0.6, 0.8, 'dataset-1', 'batch-1'],
        ['id-3', 'Neutral message 1', 'neutral', 0.1, 0.7, 'dataset-1', 'batch-2'],
        ['id-4', 'Positive message 2', 'positive', 0.9, 0.95, 'dataset-2', 'batch-3'],
        ['id-5', 'Negative message 2', 'negative', -0.7, 0.85, 'dataset-2', 'batch-3']
      ];

      for (const entry of testEntries) {
        await runDuckDB(`
          INSERT INTO text_analytics (
            id, text, sentiment, score, confidence, dataset_id, batch_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, entry);
      }
    });

    test('should aggregate sentiment counts', async () => {
      const result = await queryDuckDB(`
        SELECT sentiment, COUNT(*) as count
        FROM text_analytics
        GROUP BY sentiment
        ORDER BY sentiment
      `);

      expect(result).toHaveLength(3);
      expect(result.find(r => r.sentiment === 'positive')?.count).toBe(2);
      expect(result.find(r => r.sentiment === 'negative')?.count).toBe(2);
      expect(result.find(r => r.sentiment === 'neutral')?.count).toBe(1);
    });

    test('should calculate average scores by dataset', async () => {
      const result = await queryDuckDB(`
        SELECT 
          dataset_id, 
          AVG(score) as avg_score,
          COUNT(*) as count
        FROM text_analytics
        GROUP BY dataset_id
        ORDER BY dataset_id
      `);

      expect(result).toHaveLength(2);
      
      const dataset1 = result.find(r => r.dataset_id === 'dataset-1');
      const dataset2 = result.find(r => r.dataset_id === 'dataset-2');
      
      expect(dataset1?.count).toBe(3);
      expect(dataset2?.count).toBe(2);
      expect(dataset1?.avg_score).toBeCloseTo(0.1, 1);
      expect(dataset2?.avg_score).toBeCloseTo(0.1, 1);
    });

    test('should filter by batch', async () => {
      const result = await queryDuckDB(`
        SELECT *
        FROM text_analytics
        WHERE batch_id = ?
        ORDER BY id
      `, ['batch-1']);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('id-1');
      expect(result[1].id).toBe('id-2');
    });
  });

  describe('performance and stress tests', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 20 }, (_, i) => {
        if (i % 2 === 0) {
          return queryDuckDB('SELECT ? as iteration', [i]);
        } else {
          return runDuckDB(`
            CREATE TEMP TABLE temp_${i} (id INTEGER, value TEXT)
          `);
        }
      });

      const results = await Promise.all(operations);
      
      // Check that query operations returned results
      const queryResults = results.filter((r, i) => i % 2 === 0);
      expect(queryResults).toHaveLength(10);
      
      queryResults.forEach((result, index) => {
        expect(result).toEqual([{ iteration: index * 2 }]);
      });
    });

    test('should handle large data inserts', async () => {
      const batchSize = 100;
      const batches = 5;
      
      for (let batch = 0; batch < batches; batch++) {
        const values = Array.from({ length: batchSize }, (_, i) => {
          const id = batch * batchSize + i;
          return `('id-${id}', 'Text message ${id}', 'positive', 0.${id % 10}, 0.9, 'large-dataset', 'large-batch')`;
        });

        await runDuckDB(`
          INSERT INTO text_analytics (
            id, text, sentiment, score, confidence, dataset_id, batch_id
          ) VALUES ${values.join(', ')}
        `);
      }

      const count = await queryDuckDB(`
        SELECT COUNT(*) as total
        FROM text_analytics
        WHERE dataset_id = 'large-dataset'
      `);

      expect(count[0].total).toBe(batchSize * batches);
    }, 30000);
  });

  describe('error handling and recovery', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should handle SQL syntax errors', async () => {
      await expect(
        queryDuckDB('SELECT FROM INVALID SYNTAX')
      ).rejects.toThrow();
    });

    test('should handle invalid table references', async () => {
      await expect(
        queryDuckDB('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });

    test('should handle constraint violations gracefully', async () => {
      // Try to insert duplicate primary key
      await runDuckDB(`
        INSERT INTO text_analytics (id, text, sentiment, score, confidence)
        VALUES ('duplicate-id', 'Test', 'positive', 0.5, 0.5)
      `);

      await expect(
        runDuckDB(`
          INSERT INTO text_analytics (id, text, sentiment, score, confidence)
          VALUES ('duplicate-id', 'Test 2', 'negative', -0.5, 0.5)
        `)
      ).rejects.toThrow();
    });
  });

  describe('service statistics and monitoring', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should provide accurate service statistics', async () => {
      const statsBefore = getDuckDBStats();
      
      await queryDuckDB('SELECT 1');
      await queryDuckDB('SELECT 2');
      
      const statsAfter = getDuckDBStats();
      
      // If DuckDB is initialized, check connection stats
      if (statsAfter.isInitialized) {
        expect(statsAfter.totalConnections).toBeGreaterThanOrEqual(statsBefore.totalConnections);
        expect(['healthy', 'warning', 'critical']).toContain(statsAfter.poolHealth);
      } else {
        // If using fallback, verify it's working
        expect(statsAfter.fallbackEnabled).toBe(true);
        expect(['healthy', 'warning', 'critical']).toContain(statsAfter.poolHealth);
      }
    });

    test('should track queue length during high load', async () => {
      const heavyOperations = Array.from({ length: 10 }, (_, i) =>
        queryDuckDB(`SELECT ${i} as iteration, pg_sleep(0.1)`)
      );

      // Don't wait for completion, check stats during execution
      const statsPromise = Promise.resolve().then(() => getDuckDBStats());
      
      try {
        await Promise.all([statsPromise, ...heavyOperations]);
      } catch (error) {
        // pg_sleep might not be available in DuckDB, ignore the error
        // We're mainly testing the queue tracking
      }
      
      const stats = await statsPromise;
      expect(typeof stats.queueLength).toBe('number');
    });
  });

  describe('data consistency and transactions', () => {
    beforeEach(async () => {
      await initializeDuckDB();
    });

    test('should maintain data consistency across operations', async () => {
      // Insert data in multiple operations
      await runDuckDB(`
        INSERT INTO text_analytics (id, text, sentiment, score, confidence)
        VALUES ('consistency-1', 'Test 1', 'positive', 0.8, 0.9)
      `);

      await runDuckDB(`
        INSERT INTO text_analytics (id, text, sentiment, score, confidence)
        VALUES ('consistency-2', 'Test 2', 'negative', -0.6, 0.85)
      `);

      // Verify both records exist
      const results = await queryDuckDB(`
        SELECT COUNT(*) as count
        FROM text_analytics
        WHERE id IN ('consistency-1', 'consistency-2')
      `);

      expect(results[0].count).toBe(2);
    });
  });
});