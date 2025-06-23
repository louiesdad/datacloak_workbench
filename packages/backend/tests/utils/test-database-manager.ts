import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { SQLiteConnectionPool } from '../../src/database/sqlite-pool';

export interface TestDatabaseConfig {
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
  cacheSize?: number;
  tempStore?: 'memory' | 'file';
}

export class TestDatabaseManager {
  private static instances = new Map<string, TestDatabaseManager>();
  private static globalCleanupRegistered = false;
  
  private database: Database.Database | null = null;
  private pool: SQLiteConnectionPool | null = null;
  private dbPath: string;
  private config: TestDatabaseConfig;
  private instanceId: string;

  private constructor(instanceId: string, config: TestDatabaseConfig = {}) {
    this.instanceId = instanceId;
    this.config = {
      enableWAL: false, // Disable WAL for tests to avoid file artifacts
      enableForeignKeys: true,
      cacheSize: 10000, // Smaller cache for tests
      tempStore: 'memory',
      ...config
    };
    
    // Use unique in-memory database names to avoid conflicts
    this.dbPath = `:memory:${instanceId}`;
    
    // Register global cleanup if not already done
    if (!TestDatabaseManager.globalCleanupRegistered) {
      TestDatabaseManager.registerGlobalCleanup();
    }
  }

  static getInstance(testName?: string, config?: TestDatabaseConfig): TestDatabaseManager {
    const instanceId = testName || `test_${randomBytes(8).toString('hex')}`;
    
    if (!TestDatabaseManager.instances.has(instanceId)) {
      TestDatabaseManager.instances.set(instanceId, new TestDatabaseManager(instanceId, config));
    }
    
    return TestDatabaseManager.instances.get(instanceId)!;
  }

  static getUniqueInstance(config?: TestDatabaseConfig): TestDatabaseManager {
    const instanceId = `unique_${randomBytes(8).toString('hex')}`;
    const instance = new TestDatabaseManager(instanceId, config);
    TestDatabaseManager.instances.set(instanceId, instance);
    return instance;
  }

  static createIsolatedInstance(config?: TestDatabaseConfig): TestDatabaseManager {
    const instanceId = `isolated_${randomBytes(8).toString('hex')}`;
    const instance = new TestDatabaseManager(instanceId, config);
    TestDatabaseManager.instances.set(instanceId, instance);
    return instance;
  }

  async getDatabase(): Promise<Database.Database> {
    if (!this.database) {
      this.database = this.createDatabase();
      await this.initializeSchema();
    }
    return this.database;
  }

  async getConnectionPool(): Promise<SQLiteConnectionPool> {
    if (!this.pool) {
      // Use a separate in-memory database for the pool to avoid locking conflicts
      const poolDbPath = `:memory:pool_${this.instanceId}`;
      const pragmas = this.buildPragmas();
      this.pool = new SQLiteConnectionPool({
        path: poolDbPath,
        maxConnections: 2, // Limit connections for tests
        idleTimeoutMs: 100, // Fast cleanup for tests
        acquireTimeoutMs: 1000, // Quick timeout for tests
        pragmas
      });
    }
    return this.pool;
  }

  private createDatabase(): Database.Database {
    const db = new Database(this.dbPath);
    
    // Apply pragmas for test optimization
    const pragmas = this.buildPragmas();
    for (const pragma of pragmas) {
      db.exec(pragma);
    }
    
    return db;
  }

  private buildPragmas(): string[] {
    const pragmas: string[] = [];
    
    // Use memory-optimized settings for tests
    if (this.config.enableWAL) {
      pragmas.push('PRAGMA journal_mode = WAL;');
    } else {
      pragmas.push('PRAGMA journal_mode = MEMORY;'); // Faster for tests
    }
    
    pragmas.push('PRAGMA synchronous = OFF;'); // Faster for tests, data integrity not critical
    pragmas.push(`PRAGMA cache_size = ${this.config.cacheSize};`);
    pragmas.push(`PRAGMA temp_store = ${this.config.tempStore?.toUpperCase()};`);
    
    if (this.config.enableForeignKeys) {
      pragmas.push('PRAGMA foreign_keys = ON;');
    }
    
    // Additional test optimizations
    pragmas.push('PRAGMA locking_mode = EXCLUSIVE;'); // Faster for single-threaded tests
    pragmas.push('PRAGMA count_changes = OFF;');
    pragmas.push('PRAGMA legacy_file_format = OFF;');
    pragmas.push('PRAGMA auto_vacuum = NONE;'); // Disable for tests
    
    return pragmas;
  }

  private async initializeSchema(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    // Create test tables
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        upload_date INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'uploaded',
        row_count INTEGER DEFAULT 0,
        column_count INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS data_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        data TEXT,
        result TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS config_entries (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted BOOLEAN DEFAULT FALSE,
        updated_at INTEGER NOT NULL
      );

      -- Create indexes for better test performance
      CREATE INDEX IF NOT EXISTS idx_datasets_status ON datasets(status);
      CREATE INDEX IF NOT EXISTS idx_data_rows_dataset ON data_rows(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at);
    `);
  }

  async populateTestData(): Promise<void> {
    const db = await this.getDatabase();
    
    // Insert sample datasets
    const insertDataset = db.prepare(`
      INSERT INTO datasets (id, filename, upload_date, status, row_count, column_count, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertDataset.run('dataset-123', 'test.csv', Date.now(), 'uploaded', 100, 5, 1024);
    insertDataset.run('dataset-456', 'sample.csv', Date.now(), 'processed', 50, 3, 512);
    
    // Insert sample jobs
    const insertJob = db.prepare(`
      INSERT INTO jobs (id, type, status, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const now = Date.now();
    insertJob.run('job-123', 'sentiment_analysis', 'pending', '{"text": "test"}', now, now);
    insertJob.run('job-456', 'data_export', 'completed', '{"format": "csv"}', now, now);
  }

  async clearData(): Promise<void> {
    const db = await this.getDatabase();
    
    // Clear all tables
    const tables = ['data_rows', 'datasets', 'jobs', 'cache_entries', 'config_entries'];
    for (const table of tables) {
      db.exec(`DELETE FROM ${table}`);
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    
    if (this.database) {
      this.database.close();
      this.database = null;
    }
    
    // Remove from instances map
    TestDatabaseManager.instances.delete(this.instanceId);
  }

  // Utility methods for testing
  async executeSQL(sql: string, params?: any[]): Promise<any> {
    const db = await this.getDatabase();
    
    // Determine if it's a SELECT query or modification query
    const trimmedSQL = sql.trim().toUpperCase();
    const isSelect = trimmedSQL.startsWith('SELECT');
    
    if (params) {
      const stmt = db.prepare(sql);
      if (isSelect) {
        return stmt.all(params);
      } else {
        return stmt.run(params);
      }
    }
    
    if (isSelect) {
      return db.prepare(sql).all();
    } else {
      return db.exec(sql);
    }
  }

  async getRowCount(table: string): Promise<number> {
    const db = await this.getDatabase();
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
    return result.count;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const db = await this.getDatabase();
    const result = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(tableName);
    return !!result;
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  // Static cleanup methods
  static async cleanupInstance(instanceId: string): Promise<void> {
    const instance = TestDatabaseManager.instances.get(instanceId);
    if (instance) {
      await instance.close();
    }
  }

  static async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(TestDatabaseManager.instances.values()).map(
      instance => instance.close()
    );
    
    await Promise.all(cleanupPromises);
    TestDatabaseManager.instances.clear();
  }

  private static registerGlobalCleanup(): void {
    if (TestDatabaseManager.globalCleanupRegistered) return;
    
    // Register cleanup for various exit scenarios
    const cleanup = () => {
      TestDatabaseManager.cleanupAll().catch(console.error);
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
    process.on('unhandledRejection', cleanup);

    // Jest-specific cleanup (only register if not in a test context)
    if (typeof afterAll !== 'undefined' && !process.env.JEST_WORKER_ID) {
      afterAll(async () => {
        await TestDatabaseManager.cleanupAll();
      });
    }

    TestDatabaseManager.globalCleanupRegistered = true;
  }

  // Factory methods for common test scenarios
  static async createForUnitTest(testName: string): Promise<TestDatabaseManager> {
    const manager = TestDatabaseManager.getInstance(testName, {
      enableWAL: false,
      tempStore: 'memory',
      cacheSize: 1000
    });
    
    await manager.getDatabase(); // Initialize
    return manager;
  }

  static async createForIntegrationTest(testName: string): Promise<TestDatabaseManager> {
    const manager = TestDatabaseManager.getInstance(testName, {
      enableWAL: false, // Still no WAL for tests
      enableForeignKeys: true,
      tempStore: 'memory',
      cacheSize: 5000
    });
    
    await manager.getDatabase(); // Initialize
    await manager.populateTestData(); // Add sample data
    return manager;
  }
}