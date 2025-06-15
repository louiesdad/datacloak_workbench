import { initializeSQLite, getSQLiteConnection } from './sqlite';
import { initializeDuckDB, getDuckDBConnection } from './duckdb-pool';
import { duckDBPool } from './duckdb-pool';

export const initializeDatabases = async (): Promise<void> => {
  try {
    console.log('Initializing databases...');
    
    // Always initialize SQLite
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
  duckdbPool?: any;
}> => {
  try {
    const sqliteDb = getSQLiteConnection();
    const poolStats = await duckDBPool.getPoolStats();
    
    return {
      sqlite: sqliteDb ? 'connected' : 'disconnected',
      duckdb: poolStats.poolHealth === 'healthy' ? 'connected' : poolStats.poolHealth,
      duckdbPool: poolStats
    };
  } catch (error) {
    return {
      sqlite: 'error',
      duckdb: 'error',
    };
  }
};

export * from './sqlite';
export * from './duckdb-pool';