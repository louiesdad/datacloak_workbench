import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test environment configuration validator
 * Ensures all required environment variables are set for tests
 */

export interface TestEnvironmentConfig {
  required: string[];
  optional: string[];
  defaults: Record<string, string>;
}

const TEST_ENV_CONFIG: TestEnvironmentConfig = {
  required: [
    'NODE_ENV',
    'JWT_SECRET',
    'ADMIN_PASSWORD'
  ],
  optional: [
    'PORT',
    'SQLITE_DB_PATH',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'LOG_LEVEL'
  ],
  defaults: {
    NODE_ENV: 'test',
    PORT: '3001',
    SQLITE_DB_PATH: ':memory:',
    DATABASE_URL: 'sqlite::memory:',
    REDIS_ENABLED: 'false',
    CACHE_TYPE: 'memory',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'test-admin-password-for-testing',
    OPENAI_API_KEY: 'sk-test-api-key-1234567890abcdef',
    LOG_LEVEL: 'error',
    SKIP_DUCKDB: 'true',
    DISABLE_FILE_LOGGING: 'true',
    DATACLOAK_USE_MOCK: 'true'
  }
};

export function loadTestEnvironment(): void {
  // Load .env.test file if it exists
  const testEnvPath = path.join(__dirname, '../../.env.test');
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath });
  }

  // Apply defaults for missing values
  Object.entries(TEST_ENV_CONFIG.defaults).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });

  // Validate required variables
  const missing = TEST_ENV_CONFIG.required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required test environment variables: ${missing.join(', ')}`);
  }
}

export function validateTestEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required variables
  TEST_ENV_CONFIG.required.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required variable: ${key}`);
    }
  });

  // Check for production values in test environment
  if (process.env.NODE_ENV !== 'test') {
    errors.push('NODE_ENV must be "test" for test environment');
  }

  if (process.env.REDIS_ENABLED === 'true' && !process.env.REDIS_URL?.includes('localhost')) {
    errors.push('Redis should use localhost for tests');
  }

  if (process.env.OPENAI_API_KEY?.startsWith('sk-') && !process.env.OPENAI_API_KEY?.includes('test')) {
    errors.push('Using production OpenAI API key in tests');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getTestEnvironmentInfo(): Record<string, any> {
  return {
    nodeEnv: process.env.NODE_ENV,
    testDatabase: process.env.SQLITE_DB_PATH,
    redisEnabled: process.env.REDIS_ENABLED === 'true',
    cacheType: process.env.CACHE_TYPE,
    mockServices: {
      datacloak: process.env.DATACLOAK_USE_MOCK === 'true',
      openai: process.env.OPENAI_API_KEY?.includes('test') || false
    },
    features: {
      hotReload: process.env.ENABLE_HOT_RELOAD === 'true',
      configApi: process.env.ENABLE_CONFIG_API === 'true',
      websocket: process.env.ENABLE_WEBSOCKET !== 'false',
      sse: process.env.ENABLE_SSE !== 'false'
    }
  };
}

export function ensureTestDirectories(): void {
  const directories = [
    process.env.UPLOAD_DIR || '/tmp/test-uploads',
    process.env.LOG_DIR || '/tmp/test-logs'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}