import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { getDatabaseConnection } from '../../src/database/sqlite';
import { getDuckDBConnection } from '../../src/database/duckdb';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: Database Resilience', () => {
  let app: Express;
  let sqliteDb: Database.Database;
  let duckDb: any;
  const testDbPath = path.join(__dirname, '../../../data/test-resilience.db');

  beforeAll(async () => {
    app = await createTestApp();
    sqliteDb = getDatabaseConnection();
    duckDb = await getDuckDBConnection();
  });

  afterAll(async () => {
    // Cleanup test databases
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Connection Pool Management', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      const concurrentRequests = 50;
      const requests = [];

      // Create many concurrent requests to exhaust pool
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app)
            .post('/api/v1/sentiment/analyze')
            .send({ text: `Concurrent request ${i}`, model: 'basic' })
        );
      }

      const responses = await Promise.all(requests);
      
      // All requests should eventually succeed
      const successfulRequests = responses.filter(r => r.status === 200);
      expect(successfulRequests.length).toBe(concurrentRequests);
    });

    it('should recover from connection timeouts', async () => {
      // Simulate slow query
      const slowQuery = async () => {
        return new Promise((resolve) => {
          sqliteDb.prepare(`
            WITH RECURSIVE slow(x) AS (
              SELECT 1
              UNION ALL
              SELECT x+1 FROM slow WHERE x < 1000000
            )
            SELECT COUNT(*) FROM slow
          `).get();
          resolve(true);
        });
      };

      // Start slow query
      const slowPromise = slowQuery();

      // Meanwhile, other requests should still work
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      
      await slowPromise;
    });

    it('should handle database locks appropriately', async () => {
      // Start a transaction
      const tx = sqliteDb.transaction(() => {
        sqliteDb.prepare('INSERT INTO sentiment_analyses (text, sentiment, score) VALUES (?, ?, ?)').run(
          'Lock test', 'positive', 0.8
        );
        // Simulate long transaction
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      // Concurrent write should wait or fail gracefully
      const concurrentWrite = request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Concurrent write test', model: 'basic' });

      const [txResult, writeResult] = await Promise.all([tx(), concurrentWrite]);

      expect(writeResult.status).toBe(200);
    });
  });

  describe('Transaction Management', () => {
    it('should rollback on transaction failure', async () => {
      // Get initial count
      const initialCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM sentiment_analyses').get().count;

      // Try to create batch with one invalid entry
      const response = await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts: [
            'Valid text 1',
            null, // This should cause transaction to fail
            'Valid text 2'
          ],
          model: 'basic',
          transactional: true
        })
        .expect(400);

      // Count should remain unchanged (transaction rolled back)
      const finalCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM sentiment_analyses').get().count;
      expect(finalCount).toBe(initialCount);
    });

    it('should handle deadlock detection', async () => {
      // Simulate potential deadlock scenario
      const results = await Promise.all([
        request(app)
          .post('/api/v1/data/process')
          .send({ 
            datasetId: 'test-1',
            operation: 'update_then_read'
          }),
        request(app)
          .post('/api/v1/data/process')
          .send({ 
            datasetId: 'test-1',
            operation: 'read_then_update'
          })
      ]);

      // At least one should succeed
      const successful = results.filter(r => r.status === 200);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('Database Migration Safety', () => {
    it('should handle migration failures gracefully', async () => {
      // Check migration status
      const response = await request(app)
        .get('/api/v1/admin/database/migrations')
        .expect(200);

      expect(response.body).toMatchObject({
        current_version: expect.any(Number),
        pending_migrations: expect.any(Array),
        migration_history: expect.any(Array)
      });
    });

    it('should support migration rollback', async () => {
      // Get current version
      const statusBefore = await request(app)
        .get('/api/v1/admin/database/migrations')
        .expect(200);

      const currentVersion = statusBefore.body.current_version;

      // Attempt rollback
      const rollbackResponse = await request(app)
        .post('/api/v1/admin/database/migrations/rollback')
        .send({ target_version: currentVersion - 1 })
        .expect(200);

      expect(rollbackResponse.body.success).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      // Create dataset
      const datasetResponse = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.from('text\nTest data'), 'test.csv')
        .expect(200);

      const datasetId = datasetResponse.body.data.id;

      // Create analyses linked to dataset
      await request(app)
        .post('/api/v1/sentiment/batch')
        .send({
          texts: ['Test 1', 'Test 2'],
          datasetId,
          model: 'basic'
        })
        .expect(200);

      // Try to delete dataset with dependent data
      const deleteResponse = await request(app)
        .delete(`/api/v1/data/datasets/${datasetId}`)
        .expect(400);

      expect(deleteResponse.body.error).toContain('dependent analyses');
    });

    it('should handle concurrent updates correctly', async () => {
      // Create a record
      const createResponse = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Concurrent update test', model: 'basic' })
        .expect(200);

      const recordId = createResponse.body.data.id;

      // Concurrent updates
      const updates = await Promise.all([
        request(app).patch(`/api/v1/sentiment/${recordId}`).send({ confidence: 0.9 }),
        request(app).patch(`/api/v1/sentiment/${recordId}`).send({ confidence: 0.8 }),
        request(app).patch(`/api/v1/sentiment/${recordId}`).send({ confidence: 0.7 })
      ]);

      // All should succeed or fail gracefully
      const successful = updates.filter(u => u.status === 200);
      expect(successful.length).toBeGreaterThan(0);

      // Final state should be consistent
      const finalResponse = await request(app)
        .get(`/api/v1/sentiment/${recordId}`)
        .expect(200);

      expect(finalResponse.body.data.confidence).toBeOneOf([0.9, 0.8, 0.7]);
    });
  });

  describe('Database Recovery', () => {
    it('should recover from corrupted database', async () => {
      // Simulate corruption by writing garbage to a test db file
      fs.writeFileSync(testDbPath, 'corrupted data');

      // System should detect and handle corruption
      const response = await request(app)
        .get('/api/v1/health/database')
        .expect(200);

      expect(response.body).toMatchObject({
        sqlite: expect.objectContaining({
          healthy: expect.any(Boolean),
          integrity_check: expect.any(String)
        }),
        duckdb: expect.objectContaining({
          healthy: expect.any(Boolean)
        })
      });
    });

    it('should handle out of disk space', async () => {
      // This is hard to simulate directly, so we mock the behavior
      process.env.SIMULATE_DISK_FULL = 'true';

      const response = await request(app)
        .post('/api/v1/data/upload')
        .attach('file', Buffer.alloc(1024 * 1024), 'large.csv')
        .expect(507); // Insufficient Storage

      expect(response.body.error).toContain('Insufficient storage');
      
      delete process.env.SIMULATE_DISK_FULL;
    });
  });

  describe('Query Performance', () => {
    it('should timeout long-running queries', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/custom-query')
        .send({
          query: `
            WITH RECURSIVE long_query(x) AS (
              SELECT 1
              UNION ALL
              SELECT x+1 FROM long_query WHERE x < 10000000
            )
            SELECT COUNT(*) FROM long_query
          `,
          timeout: 1000 // 1 second timeout
        })
        .expect(408); // Request Timeout

      expect(response.body.error).toContain('Query timeout');
    });

    it('should use indexes efficiently', async () => {
      // Seed data
      const texts = Array.from({ length: 1000 }, (_, i) => `Test text ${i}`);
      await request(app)
        .post('/api/v1/sentiment/batch')
        .send({ texts, model: 'basic' })
        .expect(200);

      // Query with index
      const start = Date.now();
      await request(app)
        .get('/api/v1/sentiment/history')
        .query({ 
          startDate: new Date(Date.now() - 86400000).toISOString(),
          limit: 100 
        })
        .expect(200);
      const queryTime = Date.now() - start;

      // Should be fast with index
      expect(queryTime).toBeLessThan(100);
    });
  });

  describe('Multi-Database Consistency', () => {
    it('should maintain consistency between SQLite and DuckDB', async () => {
      // Create data in both databases
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ 
          text: 'Consistency test',
          model: 'basic',
          syncToDuckDB: true 
        })
        .expect(200);

      const id = response.body.data.id;

      // Check data exists in both databases
      const sqliteData = sqliteDb.prepare('SELECT * FROM sentiment_analyses WHERE id = ?').get(id);
      
      const duckDbData = await new Promise((resolve) => {
        duckDb.all(`SELECT * FROM text_analytics WHERE id = '${id}'`, (err: any, result: any) => {
          resolve(result[0]);
        });
      });

      expect(sqliteData).toBeDefined();
      expect(duckDbData).toBeDefined();
      expect(sqliteData.sentiment).toBe(duckDbData.sentiment);
    });

    it('should handle partial sync failures', async () => {
      // Simulate DuckDB failure
      process.env.SIMULATE_DUCKDB_ERROR = 'true';

      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ 
          text: 'Partial sync test',
          model: 'basic',
          syncToDuckDB: true 
        })
        .expect(200);

      // Should succeed despite DuckDB error
      expect(response.body.data).toBeDefined();
      expect(response.body.warnings).toContain('DuckDB sync failed');

      delete process.env.SIMULATE_DUCKDB_ERROR;
    });
  });

  describe('Backup and Restore', () => {
    it('should create database backups', async () => {
      const response = await request(app)
        .post('/api/v1/admin/database/backup')
        .expect(200);

      expect(response.body).toMatchObject({
        backup_id: expect.any(String),
        size: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should restore from backup', async () => {
      // Create backup
      const backupResponse = await request(app)
        .post('/api/v1/admin/database/backup')
        .expect(200);

      const backupId = backupResponse.body.backup_id;

      // Add some data
      await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'After backup', model: 'basic' })
        .expect(200);

      // Restore
      const restoreResponse = await request(app)
        .post('/api/v1/admin/database/restore')
        .send({ backup_id: backupId })
        .expect(200);

      expect(restoreResponse.body.success).toBe(true);
    });
  });
});