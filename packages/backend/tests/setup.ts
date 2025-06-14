// Import jest types
import { jest, beforeEach, afterAll } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
// Use file-based in-memory database for better test isolation
process.env.SQLITE_DB_PATH = 'file::memory:?cache=shared';
// Skip DuckDB in tests for now to avoid native module issues
process.env.SKIP_DUCKDB = 'true';

// Global test timeout
jest.setTimeout(30000); // Increased timeout for database operations

// Mock console methods for cleaner test output
const originalConsole = { ...console };

global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Restore console for actual error messages
const originalError = console.error;
console.error = (...args) => {
  originalError(...args);
  originalConsole.error(...args);
};

// Add a small delay between tests to avoid database locks
beforeEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Restore console after tests
afterAll(() => {
  global.console = originalConsole;
});