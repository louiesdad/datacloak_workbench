import { EnvironmentConfig } from './index';
import * as path from 'path';

export const productionConfig: EnvironmentConfig = {
  name: 'production',
  
  defaults: {
    NODE_ENV: 'production',
    PORT: 3001,
    LOG_LEVEL: 'info',
    LOG_TO_FILE: true,
    LOG_DIR: '/var/log/datacloak',
    
    // Database - production paths
    DB_PATH: '/data/datacloak/sqlite.db',
    DUCKDB_PATH: '/data/datacloak/duckdb.db',
    
    // Security - strict requirements enforced
    JWT_EXPIRATION: '24h',
    CORS_CREDENTIALS: true,
    
    // Rate limiting - production limits
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 60,
    
    // Redis - required in production
    REDIS_ENABLED: true,
    REDIS_DB: 0,
    REDIS_KEY_PREFIX: 'dsw:prod:',
    REDIS_TLS_ENABLED: true,
    
    // Job Queue - production tuned
    JOB_QUEUE_MAX_CONCURRENT: 5,
    JOB_QUEUE_RETRY_ATTEMPTS: 3,
    JOB_QUEUE_RETRY_DELAY: 10000,
    JOB_QUEUE_ENABLE_DEAD_LETTER: true,
    
    // Cache - Redis required
    CACHE_ENABLED: true,
    CACHE_TYPE: 'redis',
    CACHE_DEFAULT_TTL: 3600,
    CACHE_MAX_MEMORY: 500 * 1024 * 1024, // 500MB
    CACHE_COMPRESSION_THRESHOLD: 1024,
    
    // Production features
    ENABLE_HOT_RELOAD: false,
    ENABLE_CONFIG_API: false,
    ENABLE_DEBUG_ENDPOINTS: false,
    
    // Performance monitoring - enabled
    ENABLE_METRICS: true,
    METRICS_PORT: 9090,
    ENABLE_TRACING: true,
    
    // Health checks
    HEALTH_CHECK_INTERVAL: 30000,
    HEALTH_CHECK_TIMEOUT: 5000,
    
    // SSL - required
    SSL_ENABLED: true,
    
    // Backup - enabled
    BACKUP_ENABLED: true,
    BACKUP_SCHEDULE: '0 2 * * *', // 2 AM daily
    BACKUP_RETENTION_DAYS: 30,
    
    // Session
    SESSION_MAX_AGE: 86400000, // 24 hours
    SESSION_SECURE: true,
    
    // External services
    EXTERNAL_SERVICE_TIMEOUT: 15000,
    
    // Error reporting - enabled
    ERROR_REPORTING_ENABLED: true,
    
    // Compliance
    COMPLIANCE_MODE: 'GDPR',
    DATA_RETENTION_DAYS: 365,
    AUDIT_LOG_ENABLED: true,
  },
  
  required: [
    // Server
    'PORT',
    'NODE_ENV',
    
    // Database
    'DB_PATH',
    'DUCKDB_PATH',
    
    // Security
    'CONFIG_ENCRYPTION_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
    'ADMIN_USERNAME',
    'ADMIN_PASSWORD',
    
    // CORS
    'CORS_ORIGINS',
    
    // Redis
    'REDIS_HOST',
    'REDIS_PASSWORD',
    
    // SSL
    'SSL_CERT_PATH',
    'SSL_KEY_PATH',
    
    // Error reporting
    'ERROR_REPORTING_DSN',
    
    // Tracing
    'TRACING_ENDPOINT'
  ],
  
  forbidden: [
    'ENABLE_DEBUG_ENDPOINTS',
    'ENABLE_HOT_RELOAD',
    'ENABLE_CONFIG_API'
  ],
  
  overrides: {
    // Force critical production values
    NODE_ENV: 'production',
    REDIS_ENABLED: true,
    CACHE_TYPE: 'redis',
    SSL_ENABLED: true,
    SESSION_SECURE: true,
    ENABLE_HOT_RELOAD: false,
    ENABLE_CONFIG_API: false,
    ENABLE_DEBUG_ENDPOINTS: false,
    JOB_QUEUE_ENABLE_DEAD_LETTER: true,
    AUDIT_LOG_ENABLED: true,
  },
  
  validators: [
    (config) => {
      // Validate security settings
      if (config.JWT_SECRET === 'default-jwt-secret-change-in-production') {
        return { valid: false, error: 'Default JWT secret not allowed in production' };
      }
      
      if (config.JWT_SECRET.length < 64) {
        return { valid: false, error: 'JWT secret must be at least 64 characters in production' };
      }
      
      if (config.SESSION_SECRET.length < 64) {
        return { valid: false, error: 'Session secret must be at least 64 characters in production' };
      }
      
      if (config.CONFIG_ENCRYPTION_KEY.length < 32) {
        return { valid: false, error: 'Encryption key must be at least 32 characters' };
      }
      
      return { valid: true };
    },
    
    (config) => {
      // Validate CORS settings
      const origins = config.CORS_ORIGINS.split(',').map((o: string) => o.trim());
      
      for (const origin of origins) {
        if (origin === '*') {
          return { valid: false, error: 'Wildcard CORS origin not allowed in production' };
        }
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return { valid: false, error: 'Localhost CORS origins not allowed in production' };
        }
        if (!origin.startsWith('https://')) {
          return { valid: false, error: 'All CORS origins must use HTTPS in production' };
        }
      }
      
      return { valid: true };
    },
    
    (config) => {
      // Validate paths
      if (!path.isAbsolute(config.DB_PATH)) {
        return { valid: false, error: 'Database path must be absolute in production' };
      }
      
      if (!path.isAbsolute(config.LOG_DIR)) {
        return { valid: false, error: 'Log directory must be absolute in production' };
      }
      
      if (!path.isAbsolute(config.SSL_CERT_PATH)) {
        return { valid: false, error: 'SSL certificate path must be absolute in production' };
      }
      
      return { valid: true };
    },
    
    (config) => {
      // Validate admin credentials
      const adminPassword = config.ADMIN_PASSWORD;
      
      if (adminPassword.length < 16) {
        return { valid: false, error: 'Admin password must be at least 16 characters in production' };
      }
      
      // Check password complexity
      const hasUpper = /[A-Z]/.test(adminPassword);
      const hasLower = /[a-z]/.test(adminPassword);
      const hasNumber = /\d/.test(adminPassword);
      const hasSpecial = /[@$!%*?&]/.test(adminPassword);
      
      if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return { 
          valid: false, 
          error: 'Admin password must contain uppercase, lowercase, number, and special character' 
        };
      }
      
      return { valid: true };
    }
  ]
};

// Production-specific utilities
export function getProductionDefaults(): any {
  return productionConfig.defaults;
}

export function isProductionConfigValid(config: any): boolean {
  for (const validator of productionConfig.validators || []) {
    const result = validator(config);
    if (!result.valid) {
      console.error(`Production config validation failed: ${result.error}`);
      return false;
    }
  }
  return true;
}

export function getProductionRequirements(): string[] {
  return productionConfig.required;
}