import { SQLiteConnectionPool } from '../sqlite-pool';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('SQLiteConnectionPool', () => {
  let tempDir: string;
  let dbPath: string;
  let pool: SQLiteConnectionPool;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-pool-test-'));
    dbPath = path.join(tempDir, 'test.db');
    
    pool = new SQLiteConnectionPool({
      path: dbPath,
      maxConnections: 2
      // Timeouts will be automatically optimized for test environment
    });
  });

  afterEach(async () => {
    await pool.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('connection management', () => {
    test('should create database file and directory', async () => {
      const db = await pool.acquire();
      expect(fs.existsSync(dbPath)).toBe(true);
      pool.release(db);
    });

    test('should acquire and release connections', async () => {
      const db1 = await pool.acquire();
      const db2 = await pool.acquire();
      
      const stats = pool.getPoolStats();
      expect(stats.total).toBe(2);
      expect(stats.inUse).toBe(2);
      expect(stats.idle).toBe(0);
      
      pool.release(db1);
      pool.release(db2);
      
      const statsAfter = pool.getPoolStats();
      expect(statsAfter.inUse).toBe(0);
      expect(statsAfter.idle).toBe(2);
    });

    test('should reuse idle connections', async () => {
      const db1 = await pool.acquire();
      pool.release(db1);
      
      const db2 = await pool.acquire();
      expect(db1).toBe(db2);
      pool.release(db2);
    });

    test('should respect max connections limit', async () => {
      const db1 = await pool.acquire();
      const db2 = await pool.acquire();
      
      const acquirePromise = pool.acquire();
      
      setTimeout(() => pool.release(db1), 100);
      
      const db3 = await acquirePromise;
      expect(db3).toBe(db1);
      
      pool.release(db2);
      pool.release(db3);
    });

    test('should timeout when no connections available', async () => {
      const db1 = await pool.acquire();
      const db2 = await pool.acquire();
      
      await expect(pool.acquire()).rejects.toThrow('Failed to acquire connection within 500ms');
      
      pool.release(db1);
      pool.release(db2);
    });
  });

  describe('withConnection helper', () => {
    test('should automatically manage connection lifecycle', async () => {
      const result = await pool.withConnection(async (db) => {
        db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
        const stmt = db.prepare('INSERT INTO test DEFAULT VALUES');
        stmt.run();
        
        const count = db.prepare('SELECT COUNT(*) as count FROM test').get() as { count: number };
        return count.count;
      });
      
      expect(result).toBe(1);
      
      const stats = pool.getPoolStats();
      expect(stats.inUse).toBe(0);
    });

    test('should release connection even if callback throws', async () => {
      await expect(
        pool.withConnection(async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
      
      const stats = pool.getPoolStats();
      expect(stats.inUse).toBe(0);
    });
  });

  describe('connection cleanup', () => {
    test('should clean up idle connections after timeout', async () => {
      const db1 = await pool.acquire();
      const db2 = await pool.acquire();
      
      pool.release(db1);
      pool.release(db2);
      
      expect(pool.getPoolStats().idle).toBe(2);
      
      await new Promise(resolve => setTimeout(resolve, 400)); // Wait for idle timeout (200ms) + cleanup interval (100ms) + buffer
      
      const stats = pool.getPoolStats();
      expect(stats.idle).toBeLessThan(2);
    });
  });

  describe('pool closure', () => {
    test('should close all connections', async () => {
      const db1 = await pool.acquire();
      const db2 = await pool.acquire();
      
      pool.release(db1);
      
      await pool.close();
      
      await expect(pool.acquire()).rejects.toThrow('Connection pool is closed');
    });
  });

  describe('pragmas configuration', () => {
    test('should apply custom pragmas', async () => {
      const customPool = new SQLiteConnectionPool({
        path: path.join(tempDir, 'custom.db'),
        pragmas: ['PRAGMA journal_mode = DELETE;']
      });
      
      const db = await customPool.acquire();
      const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      expect(result.journal_mode).toBe('delete');
      
      customPool.release(db);
      await customPool.close();
    });
  });
});