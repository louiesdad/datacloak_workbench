import { EnvironmentConfig } from './index';
import * as os from 'os';
import * as path from 'path';

export const testConfig: EnvironmentConfig = {
  name: 'test',
  
  defaults: {
    NODE_ENV: 'test',
    PORT: 3002,
    LOG_LEVEL: 'error', // Minimal logging in tests
    LOG_TO_FILE: false,
    
    // Database - temporary test paths
    DB_PATH: path.join(os.tmpdir(), 'test-sqlite.db'),
    DUCKDB_PATH: path.join(os.tmpdir(), 'test-duckdb.db'),
    
    // Security - test values
    CONFIG_ENCRYPTION_KEY: 'test-encryption-key-32-characters-long',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
    JWT_EXPIRATION: '1h',
    CORS_ORIGINS: 'http://localhost:3000',
    CORS_CREDENTIALS: true,
    
    // Rate limiting - disabled for tests
    RATE_LIMIT_WINDOW_MS: 1000,
    RATE_LIMIT_MAX_REQUESTS: 10000,
    
    // Admin - test credentials
    ADMIN_USERNAME: 'testadmin',
    ADMIN_PASSWORD: 'TestPassword123!',
    
    // Redis - disabled by default in tests
    REDIS_ENABLED: false,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 15, // Separate DB for tests
    REDIS_KEY_PREFIX: 'dsw:test:',
    
    // Job Queue - minimal for tests
    JOB_QUEUE_MAX_CONCURRENT: 1,
    JOB_QUEUE_RETRY_ATTEMPTS: 1,
    JOB_QUEUE_RETRY_DELAY: 100,
    JOB_QUEUE_ENABLE_DEAD_LETTER: false,
    
    // Cache - memory only for tests
    CACHE_ENABLED: true,
    CACHE_TYPE: 'memory',
    CACHE_DEFAULT_TTL: 60,
    CACHE_MAX_MEMORY: 10 * 1024 * 1024, // 10MB
    
    // Test features
    ENABLE_HOT_RELOAD: false,
    ENABLE_CONFIG_API: false,
    ENABLE_DEBUG_ENDPOINTS: true, // Enable for testing
    
    // Performance monitoring - disabled
    ENABLE_METRICS: false,
    ENABLE_TRACING: false,
    
    // SSL - disabled
    SSL_ENABLED: false,
    
    // Backup - disabled
    BACKUP_ENABLED: false,
    
    // Session
    SESSION_SECRET: 'test-session-secret',
    SESSION_MAX_AGE: 3600000, // 1 hour
    SESSION_SECURE: false,
    
    // External services - fast timeouts
    EXTERNAL_SERVICE_TIMEOUT: 5000,
    
    // Error reporting - disabled
    ERROR_REPORTING_ENABLED: false,
    
    // Compliance - minimal
    COMPLIANCE_MODE: 'GDPR',
    DATA_RETENTION_DAYS: 1,
    AUDIT_LOG_ENABLED: false,
    
    // Health checks - fast
    HEALTH_CHECK_INTERVAL: 5000,
    HEALTH_CHECK_TIMEOUT: 1000,
  },
  
  required: [
    'PORT',
    'NODE_ENV',
    'DB_PATH',
    'JWT_SECRET',
    'ADMIN_PASSWORD'
  ],
  
  forbidden: [
    'SSL_CERT_PATH',
    'SSL_KEY_PATH',
    'ERROR_REPORTING_DSN',
    'TRACING_ENDPOINT',
    'BACKUP_SCHEDULE',
    'REDIS_PASSWORD', // No Redis password in test
  ],
  
  overrides: {
    // Force test-specific values
    NODE_ENV: 'test',
    SSL_ENABLED: false,
    SESSION_SECURE: false,
    ENABLE_HOT_RELOAD: false,
    ERROR_REPORTING_ENABLED: false,
    BACKUP_ENABLED: false,
    AUDIT_LOG_ENABLED: false,
    ENABLE_METRICS: false,
    ENABLE_TRACING: false,
  },
  
  validators: [
    (config) => {
      // Ensure test isolation
      if (config.DB_PATH && !config.DB_PATH.includes('test')) {
        return { valid: false, error: 'Test database path must contain "test" to prevent accidents' };
      }
      
      if (config.REDIS_ENABLED && config.REDIS_DB < 10) {
        return { valid: false, error: 'Test Redis DB must be >= 10 to avoid conflicts' };
      }
      
      if (config.PORT === 3001) {
        return { valid: false, error: 'Test server must not use production port' };
      }
      
      return { valid: true };
    },
    
    (config) => {
      // Validate test timeouts
      if (config.EXTERNAL_SERVICE_TIMEOUT > 10000) {
        return { valid: false, error: 'External service timeout too high for tests (max: 10s)' };
      }
      
      if (config.HEALTH_CHECK_INTERVAL > 10000) {
        return { valid: false, error: 'Health check interval too high for tests (max: 10s)' };
      }
      
      return { valid: true };
    },
    
    (config) => {
      // Ensure no production features in test
      if (config.ENABLE_METRICS || config.ENABLE_TRACING) {
        console.warn('⚠️  Performance monitoring enabled in test environment');
      }
      
      if (config.CACHE_TYPE === 'redis') {
        console.warn('⚠️  Redis cache in test environment - consider using memory cache');
      }
      
      return { valid: true };
    }
  ]
};

// Test-specific utilities
export function getTestDefaults(): any {
  return testConfig.defaults;
}

export function isTestConfigValid(config: any): boolean {
  for (const validator of testConfig.validators || []) {
    const result = validator(config);
    if (!result.valid) {
      return false;
    }
  }
  return true;
}

// Clean up test database files
export async function cleanupTestDatabases(): Promise<void> {
  const fs = await import('fs/promises');
  const testDefaults = getTestDefaults();
  
  try {
    await fs.unlink(testDefaults.DB_PATH);
  } catch (error) {
    // Ignore if doesn't exist
  }
  
  try {
    await fs.unlink(testDefaults.DUCKDB_PATH);
  } catch (error) {
    // Ignore if doesn't exist
  }
}

// Create isolated test config
export function createTestConfig(overrides: any = {}): any {
  const baseConfig = { ...testConfig.defaults };
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  baseConfig.DB_PATH = path.join(os.tmpdir(), `test-sqlite-${timestamp}.db`);
  baseConfig.DUCKDB_PATH = path.join(os.tmpdir(), `test-duckdb-${timestamp}.db`);
  baseConfig.REDIS_KEY_PREFIX = `dsw:test:${timestamp}:`;
  
  return { ...baseConfig, ...overrides };
}