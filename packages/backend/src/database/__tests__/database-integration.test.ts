import { TestDatabaseManager } from '../../../tests/utils/test-database-manager';
import { SQLiteConnectionPool } from '../sqlite-pool';

describe('Database Integration Tests', () => {
  let dbManager: TestDatabaseManager;

  beforeEach(async () => {
    dbManager = TestDatabaseManager.getUniqueInstance();
    await dbManager.getDatabase(); // Initialize
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('Database Creation and Schema', () => {
    it('should create database with proper schema', async () => {
      const db = await dbManager.getDatabase();
      
      expect(db).toBeDefined();
      expect(await dbManager.tableExists('datasets')).toBe(true);
      expect(await dbManager.tableExists('jobs')).toBe(true);
      expect(await dbManager.tableExists('cache_entries')).toBe(true);
    });

    it('should enforce foreign key constraints', async () => {
      const db = await dbManager.getDatabase();
      
      // Try to insert data_row without corresponding dataset
      const insertRow = db.prepare(`
        INSERT INTO data_rows (dataset_id, row_index, data, created_at)
        VALUES (?, ?, ?, ?)
      `);
      
      expect(() => {
        insertRow.run('non-existent-dataset', 1, '{"test": "data"}', Date.now());
      }).toThrow();
    });

    it('should create indexes for performance', async () => {
      const db = await dbManager.getDatabase();
      
      // Check if indexes exist
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'
      `).all();
      
      expect(indexes.length).toBeGreaterThan(0);
      
      const indexNames = indexes.map((idx: any) => idx.name);
      expect(indexNames).toContain('idx_datasets_status');
      expect(indexNames).toContain('idx_jobs_status');
    });
  });

  describe('Data Operations', () => {
    it('should insert and retrieve datasets', async () => {
      const db = await dbManager.getDatabase();
      
      const insert = db.prepare(`
        INSERT INTO datasets (id, filename, upload_date, status, row_count)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const now = Date.now();
      insert.run('test-dataset', 'test.csv', now, 'uploaded', 100);
      
      const select = db.prepare('SELECT * FROM datasets WHERE id = ?');
      const result = select.get('test-dataset') as any;
      
      expect(result).toMatchObject({
        id: 'test-dataset',
        filename: 'test.csv',
        status: 'uploaded',
        row_count: 100
      });
    });

    it('should handle transactions properly', async () => {
      const db = await dbManager.getDatabase();
      
      const insert = db.prepare(`
        INSERT INTO datasets (id, filename, upload_date, status)
        VALUES (?, ?, ?, ?)
      `);
      
      const transaction = db.transaction((datasets: any[]) => {
        for (const dataset of datasets) {
          insert.run(dataset.id, dataset.filename, dataset.upload_date, dataset.status);
        }
      });
      
      const testData = [
        { id: 'ds1', filename: 'file1.csv', upload_date: Date.now(), status: 'uploaded' },
        { id: 'ds2', filename: 'file2.csv', upload_date: Date.now(), status: 'processing' }
      ];
      
      transaction(testData);
      
      const count = await dbManager.getRowCount('datasets');
      expect(count).toBe(2);
    });

    it('should handle concurrent operations', async () => {
      const db = await dbManager.getDatabase();
      
      const insert = db.prepare(`
        INSERT INTO jobs (id, type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const promises = Array(10).fill(null).map((_, i) => {
        return Promise.resolve().then(() => {
          const now = Date.now();
          insert.run(`job-${i}`, 'test_job', 'pending', now, now);
        });
      });
      
      await Promise.all(promises);
      
      const count = await dbManager.getRowCount('jobs');
      expect(count).toBe(10);
    });
  });

  describe('Connection Pool Integration', () => {
    it('should create and manage connection pool', async () => {
      const pool = await dbManager.getConnectionPool();
      
      expect(pool).toBeInstanceOf(SQLiteConnectionPool);
      
      const stats = pool.getPoolStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.waiting).toBe(0);
    });

    it('should acquire and release connections', async () => {
      const pool = await dbManager.getConnectionPool();
      
      const connection = await pool.acquire();
      expect(connection).toBeDefined();
      
      const stats1 = pool.getPoolStats();
      expect(stats1.inUse).toBe(1);
      
      pool.release(connection);
      
      const stats2 = pool.getPoolStats();
      expect(stats2.inUse).toBe(0);
    });

    it('should handle withConnection pattern', async () => {
      const pool = await dbManager.getConnectionPool();
      
      const result = await pool.withConnection(async (db) => {
        const stmt = db.prepare('SELECT 1 as test');
        return stmt.get();
      });
      
      expect(result).toEqual({ test: 1 });
      
      // Connection should be released automatically
      const stats = pool.getPoolStats();
      expect(stats.inUse).toBe(0);
    });

    it('should handle connection pool errors', async () => {
      const pool = await dbManager.getConnectionPool();
      
      // Test error handling
      await expect(pool.withConnection(async () => {
        throw new Error('Test error');
      })).rejects.toThrow('Test error');
      
      // Pool should still be functional
      const stats = pool.getPoolStats();
      expect(stats.inUse).toBe(0);
    });
  });

  describe('Test Data Management', () => {
    it('should populate test data correctly', async () => {
      await dbManager.populateTestData();
      
      const datasetCount = await dbManager.getRowCount('datasets');
      const jobCount = await dbManager.getRowCount('jobs');
      
      expect(datasetCount).toBeGreaterThan(0);
      expect(jobCount).toBeGreaterThan(0);
    });

    it('should clear data without affecting schema', async () => {
      await dbManager.populateTestData();
      
      const initialCount = await dbManager.getRowCount('datasets');
      expect(initialCount).toBeGreaterThan(0);
      
      await dbManager.clearData();
      
      const finalCount = await dbManager.getRowCount('datasets');
      expect(finalCount).toBe(0);
      
      // Schema should still exist
      expect(await dbManager.tableExists('datasets')).toBe(true);
    });

    it('should execute custom SQL queries', async () => {
      const results = await dbManager.executeSQL(`
        INSERT INTO datasets (id, filename, upload_date, status)
        VALUES ('custom-test', 'custom.csv', ?, 'uploaded')
      `, [Date.now()]);
      
      const dataset = await dbManager.executeSQL(
        'SELECT * FROM datasets WHERE id = ?',
        ['custom-test']
      );
      
      expect(dataset).toHaveLength(1);
      expect(dataset[0].filename).toBe('custom.csv');
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large data insertions efficiently', async () => {
      const db = await dbManager.getDatabase();
      
      const insert = db.prepare(`
        INSERT INTO data_rows (dataset_id, row_index, data, created_at)
        VALUES (?, ?, ?, ?)
      `);
      
      // First create a dataset
      const datasetInsert = db.prepare(`
        INSERT INTO datasets (id, filename, upload_date, status)
        VALUES (?, ?, ?, ?)
      `);
      datasetInsert.run('large-dataset', 'large.csv', Date.now(), 'uploaded');
      
      const transaction = db.transaction(() => {
        for (let i = 0; i < 1000; i++) {
          insert.run('large-dataset', i, `{"row": ${i}}`, Date.now());
        }
      });
      
      const start = Date.now();
      transaction();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      const count = await dbManager.getRowCount('data_rows');
      expect(count).toBe(1000);
    });

    it('should not create file system artifacts', () => {
      const dbPath = dbManager.getDatabasePath();
      expect(dbPath).toMatch(/:memory:/);
      
      // No WAL or SHM files should be created
      expect(dbPath).not.toMatch(/\.wal$/);
      expect(dbPath).not.toMatch(/\.shm$/);
    });

    it('should cleanup resources properly', async () => {
      const instanceId = dbManager.getInstanceId();
      
      await dbManager.close();
      
      // Instance should be removed from registry
      const newManager = TestDatabaseManager.getUniqueInstance();
      expect(newManager.getInstanceId()).not.toBe(instanceId);
      await newManager.close(); // Clean up the new instance
    });
  });

  describe('Error Handling', () => {
    it('should handle database constraint violations', async () => {
      const db = await dbManager.getDatabase();
      
      const insert = db.prepare(`
        INSERT INTO datasets (id, filename, upload_date, status)
        VALUES (?, ?, ?, ?)
      `);
      
      // Insert first record
      insert.run('duplicate-id', 'test.csv', Date.now(), 'uploaded');
      
      // Try to insert duplicate ID
      expect(() => {
        insert.run('duplicate-id', 'test2.csv', Date.now(), 'uploaded');
      }).toThrow();
    });

    it('should handle invalid SQL gracefully', async () => {
      await expect(dbManager.executeSQL('INVALID SQL STATEMENT')).rejects.toThrow();
    });

    it('should handle connection pool exhaustion', async () => {
      const pool = await dbManager.getConnectionPool();
      
      // Acquire all available connections (max 2 for tests)
      const conn1 = await pool.acquire();
      const conn2 = await pool.acquire();
      
      // Next acquisition should timeout quickly in test environment
      await expect(pool.acquire()).rejects.toThrow(/Failed to acquire connection/);
      
      // Release connections
      pool.release(conn1);
      pool.release(conn2);
    });
  });
});