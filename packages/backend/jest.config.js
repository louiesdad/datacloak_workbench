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
  transformIgnorePatterns: [
    'node_modules/(?!(@babel/runtime)/)'
  ],
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
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical services
    'src/services/cache.service.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/services/config.service.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/services/security.service.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/env-setup.ts', '<rootDir>/tests/setup.ts'],
  testTimeout: 10000, // Increased to prevent premature timeouts
  verbose: false, // Reduced verbosity to improve performance
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Improved cleanup and error handling
  errorOnDeprecated: true,
  bail: false, // Continue running tests even if some fail
  
  // Optimized worker configuration for stability
  maxWorkers: process.env.CI ? 1 : 
              process.env.NODE_ENV === 'test' ? 2 : 
              Math.min(require('os').cpus().length, 4),  // Cap at 4 workers max
  workerIdleMemoryLimit: '256MB',  // Reduced memory limit for faster cleanup
  
  // Memory management
  globals: {},
  
  // Additional performance optimizations
  detectOpenHandles: process.env.NODE_ENV === 'development', // Enable only in dev for debugging
  testSequencer: '<rootDir>/tests/test-sequencer.js', // Custom test sequencer for optimal order
  
  // Prevent memory leaks in tests
  testEnvironmentOptions: {
    // Clear timers and intervals after each test
    timers: 'modern'
  },
  
  // Run tests in band for problematic test suites
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.ts', '<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: ['/integration/', '/e2e/'],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/integration/**/*.test.ts', '<rootDir>/tests/integration/**/*.test.ts'],
      maxWorkers: 1,  // Run integration tests sequentially
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/**/e2e/**/*.test.ts', '<rootDir>/tests/e2e/**/*.test.ts'],
      maxWorkers: 1,  // Run e2e tests sequentially
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'tsconfig.test.json'
        }]
      }
    }
  ],
  moduleNameMapper: {
    '^ioredis$': '<rootDir>/src/services/__mocks__/ioredis.ts',
    '^../database/sqlite-refactored$': '<rootDir>/src/database/__mocks__/sqlite-refactored.ts',
    '^p-limit$': '<rootDir>/src/services/__mocks__/p-limit.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};