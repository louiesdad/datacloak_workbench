import { initializeDatabases } from '../../src/database';

export const setupTestDatabase = async () => {
  try {
    await initializeDatabases();
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
};

export const teardownTestDatabase = async () => {
  // In a real setup, you might want to clean up database connections
  // For now, since we're using in-memory databases for tests, this is a no-op
};