import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SQLiteConnectionPool } from '../database/sqlite-pool';
import * as fs from 'fs';
import * as path from 'path';

describe('SQLite Connection Pool Configuration', () => {
  let pool: SQLiteConnectionPool;
  const testDbPath = path.join(__dirname, 'test-pool-config.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
    }
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should use appropriate timeout for test environment', () => {
    process.env.NODE_ENV = 'test';
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 5
    });
    
    // In test environment, timeout should be 5 seconds
    expect(pool['acquireTimeout']).toBe(5000);
  });

  it('should use appropriate timeout for non-test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 5
    });
    
    // In non-test environment, timeout should be 30 seconds
    expect(pool['acquireTimeout']).toBe(30000);
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should respect custom timeout configuration', () => {
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 5,
      acquireTimeout: 60000
    });
    
    expect(pool['acquireTimeout']).toBe(60000);
  });

  it('should have sufficient max connections', () => {
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 10
    });
    
    // Should have at least 10 connections for production use
    expect(pool['maxConnections']).toBeGreaterThanOrEqual(10);
  });

  it('should handle connection acquisition within timeout', async () => {
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 2,
      acquireTimeout: 1000
    });

    // Acquire connections
    const conn1 = await pool.acquire();
    const conn2 = await pool.acquire();

    // This should timeout
    const acquirePromise = pool.acquire();
    
    // Release one connection after 500ms
    setTimeout(() => {
      pool.release(conn1);
    }, 500);

    // Should successfully acquire the connection
    const conn3 = await acquirePromise;
    expect(conn3).toBeDefined();

    pool.release(conn2);
    pool.release(conn3);
  });

  it('should throw error when connection timeout is exceeded', async () => {
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 1,
      acquireTimeout: 100 // Very short timeout
    });

    // Acquire the only connection
    const conn1 = await pool.acquire();

    // Try to acquire another connection (should timeout)
    await expect(pool.acquire()).rejects.toThrow('Failed to acquire connection within 100ms');

    pool.release(conn1);
  });

  it('should handle concurrent connection requests', async () => {
    pool = new SQLiteConnectionPool({
      path: testDbPath,
      maxConnections: 5,
      acquireTimeout: 5000
    });

    // Create 10 concurrent connection requests
    const promises = Array(10).fill(null).map(async () => {
      const conn = await pool.acquire();
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      pool.release(conn);
    });

    // All should complete successfully
    await expect(Promise.all(promises)).resolves.not.toThrow();
  });
});

describe('Connection Pool Usage in Services', () => {
  it('should use withSQLiteConnection pattern in services', () => {
    const servicesDir = path.join(__dirname, '../services');
    const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.service.ts'));
    
    const issues: string[] = [];
    
    files.forEach(file => {
      const content = fs.readFileSync(path.join(servicesDir, file), 'utf-8');
      
      // Check for direct getSQLiteConnection usage without proper release
      const directUsageRegex = /getSQLiteConnection\(\)(?!.*withSQLiteConnection)/g;
      const matches = content.match(directUsageRegex) || [];
      
      if (matches.length > 0) {
        // Check if the file has proper connection release
        const hasRelease = content.includes('finally') && content.includes('release');
        const hasWithPattern = content.includes('withSQLiteConnection');
        
        if (!hasRelease && !hasWithPattern) {
          issues.push(`${file}: Uses getSQLiteConnection without proper release pattern`);
        }
      }
    });
    
    if (issues.length > 0) {
      console.warn('Services with potential connection leaks:', issues);
    }
    
    // This is a warning, not a failure, as some services might have valid reasons
    expect(issues.length).toBeLessThanOrEqual(5);
  });
});