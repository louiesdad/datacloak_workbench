import { getSQLiteConnection, closeSQLiteConnection } from '../../src/database/sqlite';
import { initializeDatabases } from '../../src/database';
import { createTables as createSQLiteTables } from '../../src/database/sqlite';

export let testDb: any = null;

export const setupTestDatabase = async (): Promise<void> => {
  try {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SQLITE_DB_PATH = ':memory:'; // Use in-memory database for tests
    
    // Initialize the database with test configuration
    await initializeDatabases();
    
    // Get the database connection
    testDb = getSQLiteConnection();
    
    if (!testDb) {
      throw new Error('Failed to get SQLite connection');
    }
    
    // Enable foreign key constraints
    testDb.pragma('foreign_keys = ON');
    
    // Create test tables
    await createSQLiteTables();
    
    console.log('Test database (SQLite) initialized successfully');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
};

export const teardownTestDatabase = async (): Promise<void> => {
  try {
    // Close the database connection
    closeSQLiteConnection();
    
    // Clear the test database reference
    testDb = null;
  } catch (error) {
    console.error('Error during test database teardown:', error);
    throw error;
  }
};

export const clearDatabase = async (): Promise<void> => {
  if (!testDb) return;
  
  try {
    // Get all tables
    const tables = testDb.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    
    // Disable foreign key checks temporarily
    testDb.pragma('foreign_keys = OFF');
    
    // Delete all data from tables
    for (const { name } of tables) {
      if (name) {
        testDb.prepare(`DELETE FROM ${name}`).run();
      }
    }
    
    // Reset sequences for auto-incrementing IDs
    testDb.prepare("DELETE FROM sqlite_sequence").run();
    
    // Re-enable foreign key checks
    testDb.pragma('foreign_keys = ON');
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
};