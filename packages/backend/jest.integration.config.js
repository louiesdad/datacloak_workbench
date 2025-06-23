const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'integration',
  testMatch: [
    '<rootDir>/src/**/integration/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/src/**/*.integration.test.ts'
  ],
  testTimeout: 30000,  // 30 seconds for integration tests
  maxWorkers: 1,  // Run integration tests sequentially
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/integration-setup.ts'
  ],
  // Integration tests often need real timers
  testEnvironmentOptions: {
    timers: 'real'
  },
  // Don't force exit for integration tests to detect hanging resources
  forceExit: false,
  detectOpenHandles: true,
  // Custom reporter for integration tests
  reporters: ['default']
};