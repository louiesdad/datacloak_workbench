import { mockBrowserAPIs } from './mock-helpers';

// Setup browser APIs
mockBrowserAPIs();

// Mock console methods to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = jest.fn((...args) => {
  // Filter out expected errors
  const message = args[0]?.toString() || '';
  if (
    message.includes('Warning: ReactDOM.render') ||
    message.includes('Warning: unmountComponentAtNode') ||
    message.includes('act()') ||
    message.includes('wrapped into act')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
});

console.warn = jest.fn((...args) => {
  // Filter out expected warnings
  const message = args[0]?.toString() || '';
  if (
    message.includes('componentWillReceiveProps') ||
    message.includes('componentWillMount')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
});

// Mock timers
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(30000);

// Mock modules that cause issues in tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
    json: jest.fn(),
    errors: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

jest.mock('ioredis', () => {
  const Redis = jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    flushdb: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn()
  }));
  return Redis;
});

// Mock database connections
jest.mock('../database', () => ({
  getDatabaseStatus: jest.fn().mockResolvedValue({
    sqlite: 'connected',
    duckdb: 'connected'
  }),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue({}),
  disconnect: jest.fn().mockResolvedValue({})
}));

// Mock file system operations for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn().mockResolvedValue('mock file content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    rmdir: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024
    })
  }
}));

// Mock crypto for consistent test results
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('mock-random-bytes')),
  randomUUID: jest.fn(() => 'mock-uuid-123')
}));

// Environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password';
process.env.PORT = '3000';
process.env.CORS_ORIGIN = '*';

// Clean up after all tests
afterAll(async () => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Clear all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Clear timers
  jest.clearAllTimers();
  jest.useRealTimers();
});