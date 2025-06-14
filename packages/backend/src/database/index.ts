import { initializeSQLite, getSQLiteConnection } from './sqlite';
import { initializeDuckDB, getDuckDBConnection } from './duckdb';

export const initializeDatabases = async (): Promise<void> => {
  try {
    console.log('Initializing databases...');
    
    await initializeSQLite();
    console.log('SQLite initialized successfully');
    
    await initializeDuckDB();
    console.log('DuckDB initialized successfully');
    
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