import { initializeSQLite, getSQLiteConnection } from './sqlite';
import { initializeDuckDB, getDuckDBConnection } from './duckdb';

export const initializeDatabases = async (): Promise<void> => {
  try {
    console.log('Initializing databases...');
    
    // Always initialize SQLite
    await initializeSQLite();
    console.log('SQLite initialized successfully');
    
    // Skip DuckDB in test environment if SKIP_DUCKDB is set
    if (process.env.SKIP_DUCKDB !== 'true') {
      await initializeDuckDB();
      console.log('DuckDB initialized successfully');
    } else {
      console.log('Skipping DuckDB initialization in test environment');
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
}> => {
  try {
    const sqliteDb = getSQLiteConnection();
    const duckdbDb = getDuckDBConnection();
    
    return {
      sqlite: sqliteDb ? 'connected' : 'disconnected',
      duckdb: duckdbDb ? 'connected' : 'disconnected',
    };
  } catch (error) {
    return {
      sqlite: 'error',
      duckdb: 'error',
    };
  }
};

export * from './sqlite';
export * from './duckdb';