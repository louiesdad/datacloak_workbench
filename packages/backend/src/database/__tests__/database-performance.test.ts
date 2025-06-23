import Database from 'better-sqlite3';
import { SQLiteConnectionPool } from '../sqlite-pool';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EnhancedDuckDBService } from '../duckdb-enhanced';

// Performance benchmarking utilities
class PerformanceTimer {
  private startTime: number;
  
  constructor() {
    this.startTime = process.hrtime.bigint();
  }
  
  elapsed(): number {
    const endTime = process.hrtime.bigint();
    return Number(endTime - this.startTime) / 1e6; // Convert to milliseconds
  }
}

describe('Database Performance Tests', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-perf-test-'));
    dbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('SQLite Connection Pool Performance', () => {
    test('should handle concurrent reads efficiently', async () => {
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 10,
        idleTimeoutMs: 1000
      });

      // Initialize database with test data
      const initDb = await pool.acquire();
      initDb.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_users_email ON users(email);
      `);
      
      // Insert test data
      const insertStmt = initDb.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
      const insertMany = initDb.transaction((users) => {
        for (const user of users) {
          insertStmt.run(user.name, user.email);
        }
      });
      
      const testUsers = Array.from({ length: 10000 }, (_, i) => ({
        name: `User ${i}`,
        email: `user${i}@example.com`
      }));
      
      insertMany(testUsers);
      pool.release(initDb);

      // Benchmark concurrent reads
      const concurrentReads = 100;
      const timer = new PerformanceTimer();
      
      const readPromises = Array.from({ length: concurrentReads }, async (_, i) => {
        const db = await pool.acquire();
        try {
          const result = db.prepare('SELECT * FROM users WHERE email = ?').get(`user${i}@example.com`);
          return result;
        } finally {
          pool.release(db);
        }
      });

      const results = await Promise.all(readPromises);
      const elapsed = timer.elapsed();

      expect(results).toHaveLength(concurrentReads);
      expect(elapsed).toBeLessThan(1000); // Should complete within 1 second
      console.log(`Concurrent reads completed in ${elapsed.toFixed(2)}ms`);

      pool.close();
    });

    test('should handle write transactions efficiently', async () => {
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 5
      });

      const db = await pool.acquire();
      db.exec(`
        CREATE TABLE transactions (
          id INTEGER PRIMARY KEY,
          amount DECIMAL(10,2),
          status TEXT
        )
      `);
      pool.release(db);

      // Benchmark batch inserts
      const batchSize = 1000;
      const timer = new PerformanceTimer();
      
      const writeDb = await pool.acquire();
      const stmt = writeDb.prepare('INSERT INTO transactions (amount, status) VALUES (?, ?)');
      const insertBatch = writeDb.transaction((transactions) => {
        for (const tx of transactions) {
          stmt.run(tx.amount, tx.status);
        }
      });

      const testTransactions = Array.from({ length: batchSize }, (_, i) => ({
        amount: Math.random() * 1000,
        status: i % 2 === 0 ? 'completed' : 'pending'
      }));

      insertBatch(testTransactions);
      const elapsed = timer.elapsed();
      pool.release(writeDb);

      expect(elapsed).toBeLessThan(100); // Batch insert should be very fast
      console.log(`Batch insert of ${batchSize} records completed in ${elapsed.toFixed(2)}ms`);

      // Verify data
      const verifyDb = await pool.acquire();
      const count = verifyDb.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
      expect(count.count).toBe(batchSize);
      pool.release(verifyDb);

      pool.close();
    });

    test('should optimize prepared statement caching', async () => {
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 3
      });

      const db = await pool.acquire();
      db.exec(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT,
          price DECIMAL(10,2),
          category TEXT
        );
        
        CREATE INDEX idx_products_category ON products(category);
      `);

      // Insert test data
      const categories = ['electronics', 'books', 'clothing', 'food', 'toys'];
      const insertStmt = db.prepare('INSERT INTO products (name, price, category) VALUES (?, ?, ?)');
      
      for (let i = 0; i < 5000; i++) {
        insertStmt.run(
          `Product ${i}`,
          Math.random() * 100,
          categories[i % categories.length]
        );
      }
      pool.release(db);

      // Test prepared statement performance
      const queryDb = await pool.acquire();
      const timer = new PerformanceTimer();
      
      // Create prepared statements
      const stmtByCategory = queryDb.prepare('SELECT * FROM products WHERE category = ?');
      const stmtByPrice = queryDb.prepare('SELECT * FROM products WHERE price < ?');
      const stmtCount = queryDb.prepare('SELECT COUNT(*) as count FROM products WHERE category = ?');

      // Run multiple queries
      const queries = 1000;
      for (let i = 0; i < queries; i++) {
        const category = categories[i % categories.length];
        stmtByCategory.all(category);
        stmtByPrice.all(50);
        stmtCount.get(category);
      }

      const elapsed = timer.elapsed();
      pool.release(queryDb);

      expect(elapsed).toBeLessThan(5000); // Should complete reasonably fast with prepared statements
      console.log(`${queries * 3} prepared statement executions completed in ${elapsed.toFixed(2)}ms`);

      pool.close();
    });
  });

  describe('DuckDB Analytics Performance', () => {
    test.skip('should handle large analytical queries efficiently', async () => {
      const duckdb = new EnhancedDuckDBService({
        path: path.join(tempDir, 'duckdb')
      });
      await duckdb.initialize();

      // Create and populate test table
      await duckdb.executeRun(`
        CREATE TABLE sales (
          id INTEGER,
          date DATE,
          product_id INTEGER,
          quantity INTEGER,
          price DECIMAL(10,2),
          region TEXT
        )
      `);

      // Generate test data
      const timer = new PerformanceTimer();
      const regions = ['North', 'South', 'East', 'West'];
      const startDate = new Date('2023-01-01');
      
      const values: any[] = [];
      for (let i = 0; i < 100000; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + (i % 365));
        
        values.push([
          i,
          date.toISOString().split('T')[0],
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 100) + 1,
          Math.random() * 500,
          regions[i % regions.length]
        ]);
      }

      // Batch insert
      const batchSize = 1000;
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = batch.flat();
        
        await duckdb.executeRun(
          `INSERT INTO sales (id, date, product_id, quantity, price, region) VALUES ${placeholders}`,
          ...flatValues
        );
      }

      const insertElapsed = timer.elapsed();
      console.log(`Inserted 100k records in ${insertElapsed.toFixed(2)}ms`);

      // Test analytical queries
      const analyticsTimer = new PerformanceTimer();

      // Query 1: Aggregation by region
      const regionSales = await duckdb.executeQuery(`
        SELECT 
          region,
          COUNT(*) as order_count,
          SUM(quantity * price) as total_revenue,
          AVG(quantity * price) as avg_order_value
        FROM sales
        GROUP BY region
        ORDER BY total_revenue DESC
      `);

      expect(regionSales).toHaveLength(4);

      // Query 2: Time series analysis
      const monthlySales = await duckdb.executeQuery(`
        SELECT 
          DATE_TRUNC('month', date) as month,
          COUNT(*) as orders,
          SUM(quantity * price) as revenue
        FROM sales
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month
      `);

      expect(monthlySales.length).toBeGreaterThan(0);

      // Query 3: Window functions
      const rankedProducts = await duckdb.executeQuery(`
        SELECT * FROM (
          SELECT 
            product_id,
            SUM(quantity) as total_quantity,
            RANK() OVER (ORDER BY SUM(quantity) DESC) as rank
          FROM sales
          GROUP BY product_id
        ) t
        WHERE rank <= 10
      `);

      expect(rankedProducts).toHaveLength(10);

      const analyticsElapsed = analyticsTimer.elapsed();
      expect(analyticsElapsed).toBeLessThan(1000); // Analytics should complete within 1 second
      console.log(`Analytics queries completed in ${analyticsElapsed.toFixed(2)}ms`);

      await duckdb.close();
    });

    test.skip('should optimize JOIN operations', async () => {
      const duckdb = new EnhancedDuckDBService({
        path: path.join(tempDir, 'duckdb')
      });
      await duckdb.initialize();

      // Create dimension tables
      await duckdb.executeRun(`
        CREATE TABLE customers (
          id INTEGER PRIMARY KEY,
          name TEXT,
          segment TEXT
        );
        
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT,
          category TEXT,
          unit_price DECIMAL(10,2)
        );
        
        CREATE TABLE orders (
          id INTEGER PRIMARY KEY,
          customer_id INTEGER,
          product_id INTEGER,
          quantity INTEGER,
          order_date DATE
        );
      `);

      // Populate dimension tables
      const customerSegments = ['Premium', 'Standard', 'Basic'];
      const productCategories = ['Electronics', 'Clothing', 'Food', 'Books'];
      
      // Insert customers
      for (let i = 0; i < 1000; i++) {
        await duckdb.executeRun(
          'INSERT INTO customers VALUES (?, ?, ?)',
          i,
          `Customer ${i}`,
          customerSegments[i % customerSegments.length]
        );
      }

      // Insert products
      for (let i = 0; i < 500; i++) {
        await duckdb.executeRun(
          'INSERT INTO products VALUES (?, ?, ?, ?)',
          i,
          `Product ${i}`,
          productCategories[i % productCategories.length],
          Math.random() * 100 + 10
        );
      }

      // Insert orders
      const orderValues: any[] = [];
      for (let i = 0; i < 50000; i++) {
        orderValues.push([
          i,
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 500),
          Math.floor(Math.random() * 10) + 1,
          new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0]
        ]);
      }

      // Batch insert orders
      const batchSize = 1000;
      for (let i = 0; i < orderValues.length; i += batchSize) {
        const batch = orderValues.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const flatValues = batch.flat();
        
        await duckdb.executeRun(
          `INSERT INTO orders VALUES ${placeholders}`,
          ...flatValues
        );
      }

      // Test JOIN performance
      const timer = new PerformanceTimer();

      // Complex JOIN query
      const results = await duckdb.executeQuery(`
        SELECT 
          c.segment,
          p.category,
          COUNT(*) as order_count,
          SUM(o.quantity * p.unit_price) as revenue
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN products p ON o.product_id = p.id
        GROUP BY c.segment, p.category
        ORDER BY revenue DESC
      `);

      const elapsed = timer.elapsed();
      
      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500); // JOIN should be optimized
      console.log(`Complex JOIN query completed in ${elapsed.toFixed(2)}ms`);

      await duckdb.close();
    });
  });

  describe('Database Connection Pool Benchmarks', () => {
    test('should measure connection acquisition latency', async () => {
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 10
      });

      // Warm up the pool
      const warmupConnections = await Promise.all(
        Array.from({ length: 10 }, () => pool.acquire())
      );
      warmupConnections.forEach(db => pool.release(db));

      // Measure acquisition times
      const acquisitionTimes: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const startTime = process.hrtime.bigint();
        const db = await pool.acquire();
        const endTime = process.hrtime.bigint();
        
        acquisitionTimes.push(Number(endTime - startTime) / 1e6); // Convert to ms
        pool.release(db);
      }

      const avgAcquisitionTime = acquisitionTimes.reduce((a, b) => a + b, 0) / acquisitionTimes.length;
      const maxAcquisitionTime = Math.max(...acquisitionTimes);
      
      expect(avgAcquisitionTime).toBeLessThan(1); // Should be sub-millisecond
      expect(maxAcquisitionTime).toBeLessThan(10); // Even worst case should be fast
      
      console.log(`Connection acquisition - Avg: ${avgAcquisitionTime.toFixed(3)}ms, Max: ${maxAcquisitionTime.toFixed(3)}ms`);
      
      pool.close();
    });

    test('should handle connection pool exhaustion gracefully', async () => {
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 3,
        acquireTimeoutMs: 100
      });

      // Acquire all connections
      const connections = await Promise.all([
        pool.acquire(),
        pool.acquire(),
        pool.acquire()
      ]);

      // Try to acquire one more (should timeout)
      const timer = new PerformanceTimer();
      let timedOut = false;
      
      try {
        await pool.acquire();
      } catch (error) {
        timedOut = true;
        expect(error.message).toContain('Failed to acquire connection');
      }
      
      const elapsed = timer.elapsed();
      
      expect(timedOut).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200); // Should timeout promptly
      
      // Release connections
      connections.forEach(db => pool.release(db));
      
      pool.close();
    });
  });

  describe('Database Optimization Strategies', () => {
    test('should demonstrate index effectiveness', async () => {
      const db = new Database(dbPath);

      // Create table without index
      db.exec(`
        CREATE TABLE test_data (
          id INTEGER PRIMARY KEY,
          value1 TEXT,
          value2 INTEGER,
          value3 REAL
        )
      `);

      // Insert test data
      const stmt = db.prepare('INSERT INTO test_data (value1, value2, value3) VALUES (?, ?, ?)');
      for (let i = 0; i < 10000; i++) {
        stmt.run(`value_${i}`, i, Math.random() * 1000);
      }

      // Benchmark without index
      const timerNoIndex = new PerformanceTimer();
      for (let i = 0; i < 100; i++) {
        db.prepare('SELECT * FROM test_data WHERE value2 = ?').get(Math.floor(Math.random() * 10000));
      }
      const elapsedNoIndex = timerNoIndex.elapsed();

      // Create index
      db.exec('CREATE INDEX idx_test_data_value2 ON test_data(value2)');

      // Benchmark with index
      const timerWithIndex = new PerformanceTimer();
      for (let i = 0; i < 100; i++) {
        db.prepare('SELECT * FROM test_data WHERE value2 = ?').get(Math.floor(Math.random() * 10000));
      }
      const elapsedWithIndex = timerWithIndex.elapsed();

      // Index should provide significant speedup
      expect(elapsedWithIndex).toBeLessThan(elapsedNoIndex / 2);
      console.log(`Query performance - No index: ${elapsedNoIndex.toFixed(2)}ms, With index: ${elapsedWithIndex.toFixed(2)}ms`);
      console.log(`Performance improvement: ${((elapsedNoIndex - elapsedWithIndex) / elapsedNoIndex * 100).toFixed(1)}%`);

      db.close();
    });

    test('should optimize WAL mode performance', async () => {
      const dbWAL = new Database(path.join(tempDir, 'wal-test.db'));
      const dbNormal = new Database(path.join(tempDir, 'normal-test.db'));

      // Enable WAL mode
      dbWAL.pragma('journal_mode = WAL');
      dbWAL.pragma('synchronous = NORMAL');
      
      // Normal mode
      dbNormal.pragma('journal_mode = DELETE');
      dbNormal.pragma('synchronous = FULL');

      // Create tables
      const createTable = `
        CREATE TABLE benchmark (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `;
      
      dbWAL.exec(createTable);
      dbNormal.exec(createTable);

      // Benchmark concurrent writes in WAL mode
      const concurrentWrites = 10;
      const recordsPerWrite = 100;
      
      const timerWAL = new PerformanceTimer();
      const walPromises = Array.from({ length: concurrentWrites }, async (_, i) => {
        const stmt = dbWAL.prepare('INSERT INTO benchmark (data) VALUES (?)');
        for (let j = 0; j < recordsPerWrite; j++) {
          stmt.run(`WAL data ${i}-${j}`);
        }
      });
      
      await Promise.all(walPromises);
      const elapsedWAL = timerWAL.elapsed();

      // Benchmark sequential writes in normal mode
      const timerNormal = new PerformanceTimer();
      for (let i = 0; i < concurrentWrites; i++) {
        const stmt = dbNormal.prepare('INSERT INTO benchmark (data) VALUES (?)');
        for (let j = 0; j < recordsPerWrite; j++) {
          stmt.run(`Normal data ${i}-${j}`);
        }
      }
      const elapsedNormal = timerNormal.elapsed();

      // WAL mode should be faster for concurrent writes
      console.log(`Write performance - WAL: ${elapsedWAL.toFixed(2)}ms, Normal: ${elapsedNormal.toFixed(2)}ms`);
      expect(elapsedWAL).toBeLessThan(elapsedNormal);

      dbWAL.close();
      dbNormal.close();
    });

    test('should optimize memory usage with proper cache settings', async () => {
      const db = new Database(dbPath);

      // Set cache size to 10MB
      db.pragma('cache_size = -10000'); // Negative value = KB
      db.pragma('temp_store = MEMORY');

      // Create a large table
      db.exec(`
        CREATE TABLE large_table (
          id INTEGER PRIMARY KEY,
          data1 TEXT,
          data2 TEXT,
          data3 TEXT,
          data4 TEXT,
          data5 TEXT
        )
      `);

      // Insert large dataset
      const stmt = db.prepare('INSERT INTO large_table VALUES (?, ?, ?, ?, ?, ?)');
      const largeText = 'x'.repeat(100);
      
      const insertTimer = new PerformanceTimer();
      for (let i = 0; i < 5000; i++) {
        stmt.run(i, largeText, largeText, largeText, largeText, largeText);
      }
      const insertElapsed = insertTimer.elapsed();

      // Test query performance with cache
      const queryTimer = new PerformanceTimer();
      const queries = 100;
      
      for (let i = 0; i < queries; i++) {
        db.prepare('SELECT * FROM large_table WHERE id = ?').get(Math.floor(Math.random() * 5000));
      }
      
      const queryElapsed = queryTimer.elapsed();
      const avgQueryTime = queryElapsed / queries;

      expect(avgQueryTime).toBeLessThan(1); // Each query should be sub-millisecond with cache
      console.log(`Insert time: ${insertElapsed.toFixed(2)}ms, Avg query time: ${avgQueryTime.toFixed(3)}ms`);

      db.close();
    });

    test('should optimize VACUUM and ANALYZE operations', async () => {
      const db = new Database(dbPath);

      // Create and populate table
      db.exec(`
        CREATE TABLE optimization_test (
          id INTEGER PRIMARY KEY,
          status TEXT,
          created_at DATETIME
        )
      `);

      // Insert and delete many records to create fragmentation
      const insertStmt = db.prepare('INSERT INTO optimization_test (status, created_at) VALUES (?, ?)');
      for (let i = 0; i < 10000; i++) {
        insertStmt.run('active', new Date().toISOString());
      }

      // Delete half the records
      db.exec('DELETE FROM optimization_test WHERE id % 2 = 0');

      // Get size before VACUUM
      const sizeBeforeVacuum = db.pragma('page_count')[0].page_count * db.pragma('page_size')[0].page_size;

      // Run VACUUM
      const vacuumTimer = new PerformanceTimer();
      db.exec('VACUUM');
      const vacuumElapsed = vacuumTimer.elapsed();

      // Get size after VACUUM
      const sizeAfterVacuum = db.pragma('page_count')[0].page_count * db.pragma('page_size')[0].page_size;

      // Run ANALYZE
      const analyzeTimer = new PerformanceTimer();
      db.exec('ANALYZE');
      const analyzeElapsed = analyzeTimer.elapsed();

      // Test query performance after optimization
      const queryTimer = new PerformanceTimer();
      const result = db.prepare('SELECT COUNT(*) as count FROM optimization_test WHERE status = ?').get('active');
      const queryElapsed = queryTimer.elapsed();

      expect(sizeAfterVacuum).toBeLessThan(sizeBeforeVacuum);
      console.log(`VACUUM: ${vacuumElapsed.toFixed(2)}ms, Size reduction: ${((sizeBeforeVacuum - sizeAfterVacuum) / 1024).toFixed(2)}KB`);
      console.log(`ANALYZE: ${analyzeElapsed.toFixed(2)}ms, Query after optimization: ${queryElapsed.toFixed(2)}ms`);

      db.close();
    });

    test('should demonstrate connection pooling benefits', async () => {
      // Test without pooling (create new connection each time)
      const withoutPoolTimer = new PerformanceTimer();
      const operationsWithoutPool = 50;
      
      for (let i = 0; i < operationsWithoutPool; i++) {
        const db = new Database(dbPath);
        db.exec('CREATE TABLE IF NOT EXISTS pool_test (id INTEGER PRIMARY KEY, value TEXT)');
        const stmt = db.prepare('INSERT INTO pool_test (value) VALUES (?)');
        stmt.run(`value_${i}`);
        db.close();
      }
      
      const withoutPoolElapsed = withoutPoolTimer.elapsed();
      
      // Test with pooling
      const pool = new SQLiteConnectionPool({
        path: dbPath,
        maxConnections: 5
      });
      
      const withPoolTimer = new PerformanceTimer();
      
      const poolOperations = Array.from({ length: operationsWithoutPool }, async (_, i) => {
        const db = await pool.acquire();
        try {
          const stmt = db.prepare('INSERT INTO pool_test (value) VALUES (?)');
          stmt.run(`pooled_value_${i}`);
        } finally {
          pool.release(db);
        }
      });
      
      await Promise.all(poolOperations);
      const withPoolElapsed = withPoolTimer.elapsed();
      
      // Pooling should be significantly faster
      expect(withPoolElapsed).toBeLessThan(withoutPoolElapsed);
      const improvement = ((withoutPoolElapsed - withPoolElapsed) / withoutPoolElapsed) * 100;
      
      console.log(`Connection pooling performance improvement: ${improvement.toFixed(1)}%`);
      console.log(`Without pool: ${withoutPoolElapsed.toFixed(2)}ms, With pool: ${withPoolElapsed.toFixed(2)}ms`);
      
      pool.close();
    });

    test('should benchmark database backup operations', async () => {
      const sourceDb = new Database(dbPath);
      
      // Create and populate test data
      sourceDb.exec(`
        CREATE TABLE backup_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          timestamp INTEGER
        )
      `);
      
      const stmt = sourceDb.prepare('INSERT INTO backup_test (data, timestamp) VALUES (?, ?)');
      const insertMany = sourceDb.transaction(() => {
        for (let i = 0; i < 10000; i++) {
          stmt.run(`data_${i}`, Date.now());
        }
      });
      insertMany();
      
      // Ensure data is written to disk
      sourceDb.pragma('wal_checkpoint(TRUNCATE)');
      
      // Benchmark backup operation using file copy (simpler approach)
      const backupPath = path.join(tempDir, 'backup.db');
      const backupTimer = new PerformanceTimer();
      
      // Close source DB to ensure data is flushed
      sourceDb.close();
      
      // Copy the database file (simulating backup)
      fs.copyFileSync(dbPath, backupPath);
      
      const backupElapsed = backupTimer.elapsed();
      
      // Verify backup
      const backupDb = new Database(backupPath);
      const count = backupDb.prepare('SELECT COUNT(*) as count FROM backup_test').get() as { count: number };
      expect(count.count).toBe(10000);
      
      console.log(`Database backup of 10k records completed in ${backupElapsed.toFixed(2)}ms`);
      
      backupDb.close();
    });
  });
});