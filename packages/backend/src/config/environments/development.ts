import { EnvironmentConfig } from './index';

export const developmentConfig: EnvironmentConfig = {
  name: 'development',
  
  defaults: {
    NODE_ENV: 'development',
    PORT: 3001,
    LOG_LEVEL: 'debug',
    LOG_TO_FILE: false,
    
    // Database - local paths
    DB_PATH: './data/dev-sqlite.db',
    DUCKDB_PATH: './data/dev-duckdb.db',
    
    // Security - relaxed for development
    JWT_SECRET: 'dev-jwt-secret-change-before-production',
    JWT_EXPIRATION: '7d',
    CORS_ORIGINS: '*',
    CORS_CREDENTIALS: true,
    
    // Rate limiting - relaxed
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 1000,
    
    // Admin - simple for development
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'admin123',
    
    // Redis - optional in development
    REDIS_ENABLED: false,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 1,
    REDIS_KEY_PREFIX: 'dsw:dev:',
    
    // Job Queue - lower concurrency
    JOB_QUEUE_MAX_CONCURRENT: 2,
    JOB_QUEUE_RETRY_ATTEMPTS: 2,
    JOB_QUEUE_RETRY_DELAY: 1000,
    
    // Cache - memory by default
    CACHE_ENABLED: true,
    CACHE_TYPE: 'memory',
    CACHE_DEFAULT_TTL: 300,
    CACHE_MAX_MEMORY: 50 * 1024 * 1024, // 50MB
    
    // Development features
    ENABLE_HOT_RELOAD: true,
    ENABLE_CONFIG_API: true,
    ENABLE_DEBUG_ENDPOINTS: true,
    
    // Performance monitoring - disabled
    ENABLE_METRICS: false,
    ENABLE_TRACING: false,
    
    // SSL - disabled for local development
    SSL_ENABLED: false,
    
    // Backup - disabled
    BACKUP_ENABLED: false,
    
    // Session
    SESSION_SECRET: 'dev-session-secret',
    SESSION_MAX_AGE: 86400000, // 24 hours
    SESSION_SECURE: false,
    
    // Error reporting - console only
    ERROR_REPORTING_ENABLED: false,
    
    // Compliance - minimal
    AUDIT_LOG_ENABLED: false,
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
    'TRACING_ENDPOINT'
  ],
  
  overrides: {
    // Force certain values in development
    NODE_ENV: 'development',
    SSL_ENABLED: false,
    SESSION_SECURE: false,
  },
  
  validators: [
    (config) => {
      // Warn about production-like settings in development
      if (config.JWT_SECRET && config.JWT_SECRET.length > 32) {
        console.warn('⚠️  Using production-strength JWT secret in development');
      }
      if (config.REDIS_ENABLED && config.REDIS_PASSWORD) {
        console.warn('⚠️  Redis password set in development - usually not needed locally');
      }
      if (config.RATE_LIMIT_MAX_REQUESTS < 100) {
        return { valid: false, error: 'Rate limit too low for development (min: 100)' };
      }
      return { valid: true };
    },
    
    (config) => {
      // Check for common development issues
      if (config.PORT === 80 || config.PORT === 443) {
        return { valid: false, error: 'Cannot use privileged ports in development' };
      }
      if (config.DB_PATH.startsWith('/')) {
        console.warn('⚠️  Using absolute path for database - consider relative path for portability');
      }
      return { valid: true };
    }
  ]
};

// Development-specific utilities
export function getDevelopmentDefaults(): any {
  return developmentConfig.defaults;
}

export function isDevelopmentConfigValid(config: any): boolean {
  for (const validator of developmentConfig.validators || []) {
    const result = validator(config);
    if (!result.valid) {
      return false;
    }
  }
  return true;
}