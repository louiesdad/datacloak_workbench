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
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 6000, // Further optimized from 8s to 6s for faster execution
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Worker configuration for stability
  maxWorkers: process.env.CI ? 2 : '50%',  // Use 50% of CPUs locally, 2 in CI
  workerIdleMemoryLimit: '512MB',  // Kill idle workers using >512MB
  
  // Memory management
  globals: {},
  
  // Additional performance optimizations
  detectOpenHandles: false, // Disable for faster cleanup
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
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};