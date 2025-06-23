import { EnvironmentConfig } from './index';

export const stagingConfig: EnvironmentConfig = {
  name: 'staging',
  
  defaults: {
    NODE_ENV: 'staging',
    PORT: 3000,
    LOG_LEVEL: 'info',
    LOG_TO_FILE: true,
    
    // Database
    DB_PATH: './data/staging.db',
    DUCKDB_PATH: './data/staging.duckdb',
    
    // Cache
    REDIS_ENABLED: true,
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_DB: 1,
    REDIS_KEY_PREFIX: 'dsw:staging:',
    
    // Security
    JWT_EXPIRATION: '12h',
    CORS_CREDENTIALS: true,
    
    // OpenAI
    OPENAI_MODEL: 'gpt-3.5-turbo',
    OPENAI_MAX_TOKENS: 150,
    OPENAI_TEMPERATURE: 0.1,
    OPENAI_TIMEOUT: 30000,
    
    // DataCloak
    DATACLOAK_ENABLED: true,
    
    // Performance
    ENABLE_CACHING: true,
    CACHE_TTL: 3600,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    
    // Monitoring
    ENABLE_METRICS: true,
    ENABLE_DETAILED_LOGGING: true,
    
    // Rate limiting
    RATE_LIMIT_ENABLED: true,
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100
  },
  
  required: [
    'PORT',
    'DB_PATH',
    'JWT_SECRET',
    'CONFIG_ENCRYPTION_KEY'
  ],
  
  forbidden: [
    'DEBUG_MODE'
  ],
  
  validators: [
    (config) => {
      if (config.REDIS_ENABLED && (!config.REDIS_HOST || !config.REDIS_PORT)) {
        return { valid: false, error: 'REDIS_HOST and REDIS_PORT required when REDIS_ENABLED is true' };
      }
      return { valid: true };
    }
  ]
};