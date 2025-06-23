// Fast test configuration for development
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  // Aggressive optimizations for development
  testTimeout: 3000, // Very fast timeout for development
  maxWorkers: '50%', // Use half of available cores
  verbose: false, // Reduce output for faster execution
  detectOpenHandles: false,
  forceExit: true,
  
  // Only run unit tests in fast mode
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Exclude slow tests
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns || [],
    '/tests/e2e/',
    '/tests/performance/',
    '/tests/integration/'
  ],
  
  // Minimal coverage for speed
  collectCoverage: false,
  
  // Cache aggressively
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
};