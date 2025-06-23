module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).ts',
    '**/?(*.)+(spec|test).js'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/mocks/**',
    '!src/tests/**',
    '!src/server.ts',
    '!src/database/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Optimized test timeout - reduced from 30s to 10s
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Enable parallel test execution for faster runs
  maxWorkers: '50%',
  // Group tests by type for better parallelization
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
      testTimeout: 5000 // Unit tests should be fast
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/integration/**/*.test.ts'],
      testTimeout: 10000 // Integration tests need more time
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/tests/performance/**/*.test.ts'],
      testTimeout: 20000, // Performance tests may need more time
      maxWorkers: 1 // Run performance tests sequentially
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/tests/e2e/**/*.test.ts'],
      testTimeout: 15000 // E2E tests need moderate time
    }
  ],
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/src/services/__mocks__/ioredis.js'
  }
};