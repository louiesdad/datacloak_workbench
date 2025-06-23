import Database from 'better-sqlite3';
import path from 'path';
import { config } from '../config/env';
import { SQLiteConnectionPool } from './sqlite-pool';
import { MigrationSystem } from './migration-system';

let pool: SQLiteConnectionPool | null = null;
let migrationSystem: MigrationSystem | null = null;

export const initializeSQLite = async (): Promise<void> => {
  try {
    const poolConfig = {
      path: path.resolve(config.database.sqlite.path),
      maxConnections: 20,  // Increased from 5 to handle concurrent batch processing
      idleTimeoutMs: 60000,  // Increased from 30s to 60s
      acquireTimeoutMs: 30000  // Increased from 5s to 30s for batch operations
    };

    pool = new SQLiteConnectionPool(poolConfig);
    
    await pool.withConnection(async (db) => {
      const migrationsPath = path.join(__dirname, 'migrations');
      migrationSystem = new MigrationSystem(db, migrationsPath);
      
      console.log('Running database migrations...');
      await migrationSystem.migrate();
      await migrationSystem.status();
    });
    
    try {
      const { enhancedSQLiteManager } = await import('./enhanced-sqlite');
      await enhancedSQLiteManager.initializeComplete();
      console.log('Enhanced SQLite schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize enhanced schema:', error);
    }
    
    console.log('SQLite initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SQLite:', error);
    throw error;
  }
};

export const getSQLiteConnection = async (): Promise<Database.Database> => {
  if (!pool) {
    throw new Error('SQLite pool not initialized');
  }
  return pool.acquire();
};

export const releaseSQLiteConnection = (db: Database.Database): void => {
  if (!pool) {
    throw new Error('SQLite pool not initialized');
  }
  pool.release(db);
};

export const withSQLiteConnection = async <T>(
  fn: (db: Database.Database) => T | Promise<T>
): Promise<T> => {
  if (!pool) {
    throw new Error('SQLite pool not initialized');
  }
  return pool.withConnection(fn);
};

export const closeSQLiteConnection = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null;
    migrationSystem = null;
  }
};

export const getSQLitePoolStats = () => {
  if (!pool) {
    return null;
  }
  return pool.getPoolStats();
};

export const runMigration = async (targetVersion?: number): Promise<void> => {
  if (!pool || !migrationSystem) {
    throw new Error('SQLite not initialized');
  }
  
  await pool.withConnection(async () => {
    await migrationSystem!.migrate(targetVersion);
  });
};

export const rollbackMigration = async (targetVersion?: number): Promise<void> => {
  if (!pool || !migrationSystem) {
    throw new Error('SQLite not initialized');
  }
  
  await pool.withConnection(async () => {
    await migrationSystem!.rollback(targetVersion);
  });
};

export const getMigrationStatus = async (): Promise<void> => {
  if (!pool || !migrationSystem) {
    throw new Error('SQLite not initialized');
  }
  
  await pool.withConnection(async () => {
    await migrationSystem!.status();
  });
};