// Set test environment
process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.DUCKDB_PATH = ':memory:';

// Global test timeout
jest.setTimeout(10000);

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};