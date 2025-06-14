import { initializeSQLite } from '../../src/database/sqlite';

export const setupTestDatabase = async () => {
  try {
    // Only initialize SQLite for integration tests to avoid DuckDB issues
    await initializeSQLite();
    console.log('Test database (SQLite) initialized successfully');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
};

export const teardownTestDatabase = async () => {
  // In a real setup, you might want to clean up database connections
  // For now, since we're using in-memory databases for tests, this is a no-op
};