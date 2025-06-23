import { TestDatabaseManager } from './utils/test-database-manager';
import { setupTestServiceContainer, cleanupTestServiceContainer } from './utils/service-integration-setup';
import { loadTestEnvironment, validateTestEnvironment, ensureTestDirectories } from '../src/config/test-env';

// Load and validate test environment
loadTestEnvironment();
const validation = validateTestEnvironment();
if (!validation.valid) {
  console.error('Test environment validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  process.exit(1);
}

// Ensure test directories exist
ensureTestDirectories();

// Global test timeout is configured in jest.config.js

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

// Setup service container for all tests
beforeAll(() => {
  setupTestServiceContainer();
});

// Clear any module cache between tests (less aggressive approach)
beforeEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  // Only reset specific modules that are causing test interference
  // jest.resetModules(); // Too aggressive - breaks database initialization
  // Re-setup service container to ensure clean state (but don't reset everything)
  try {
    setupTestServiceContainer();
  } catch (error) {
    // Ignore container setup errors in isolated tests
  }
});

// Clean up after each test to prevent memory leaks
afterEach(() => {
  // Clear all timers to prevent hanging tests
  jest.clearAllTimers();
  
  // Force garbage collection if available (V8)
  if (global.gc) {
    global.gc();
  }
});

// Restore console after tests
afterAll(async () => {
  global.console = originalConsole;
  // Cleanup service container
  cleanupTestServiceContainer();
  // Cleanup any test databases
  await TestDatabaseManager.cleanupAll();
  
  // Final cleanup of any remaining timers
  jest.clearAllTimers();
  jest.useRealTimers();
});