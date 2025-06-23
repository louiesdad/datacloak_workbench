import { initializeSQLite, getSQLitePoolStats, closeSQLiteConnection } from './sqlite-refactored';
import { initializeDuckDB, getDuckDBConnection, closeDuckDBConnection } from './duckdb-pool';
import { duckDBPool } from './duckdb-pool';

export const initializeDatabases = async (): Promise<void> => {
  try {
    console.log('Initializing databases...');
    
    // Always initialize SQLite (refactored version with pooling)
    await initializeSQLite();
    console.log('SQLite initialized successfully');
    
    // Skip DuckDB if it fails to initialize
    try {
      await initializeDuckDB();
      console.log('DuckDB initialized successfully');
    } catch (duckDbError) {
      console.warn('Warning: Could not initialize DuckDB, continuing without it:', duckDbError);
    }
    
    console.log('All databases initialized successfully');
  } catch (error) {
    console.error('Failed to initialize databases:', error);
    throw error;
  }
};

export const getDatabaseStatus = async (): Promise<{
  sqlite: string;
  duckdb: string;
  sqlitePool?: any;
  duckdbPool?: any;
}> => {
  try {
    const sqlitePoolStats = getSQLitePoolStats();
    const poolStats = await duckDBPool.getPoolStats();
    
    return {
      sqlite: sqlitePoolStats ? 'connected' : 'disconnected',
      duckdb: poolStats.poolHealth === 'healthy' ? 'connected' : poolStats.poolHealth,
      sqlitePool: sqlitePoolStats,
      duckdbPool: poolStats
    };
  } catch (error) {
    return {
      sqlite: 'error',
      duckdb: 'error',
    };
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    console.log('Closing database connections...');
    
    // Close SQLite connections
    await closeSQLiteConnection();
    console.log('SQLite connections closed');
    
    // Close DuckDB connections
    try {
      closeDuckDBConnection();
      console.log('DuckDB connections closed');
    } catch (error) {
      console.warn('Warning: Error closing DuckDB connections:', error);
    }
    
    console.log('All database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
};

export * from './sqlite-refactored';
export * from './duckdb-pool';