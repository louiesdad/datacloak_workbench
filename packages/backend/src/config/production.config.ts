import * as Joi from 'joi';
import { IConfig } from './config.schema';

// Production-specific configuration schema with stricter validations
export const productionConfigSchema = Joi.object({
  // Server Configuration - Required in production
  PORT: Joi.number().required(),
  NODE_ENV: Joi.string().valid('production').required(),
  
  // Database Configuration - Stricter paths
  DB_PATH: Joi.string().required().regex(/^\/[\w\-\/]+$/),
  DUCKDB_PATH: Joi.string().required().regex(/^\/[\w\-\/]+$/),
  
  // Logging - More restrictive in production
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info')
    .default('info'),
  LOG_DIR: Joi.string().required(),
  LOG_TO_FILE: Joi.boolean().default(true),
  
  // OpenAI Configuration - Optional but validated if present
  OPENAI_API_KEY: Joi.string()
    .pattern(/^sk-[a-zA-Z0-9\-_]{20,}$/)
    .optional()
    .description('OpenAI API key for sentiment analysis'),
  OPENAI_MODEL: Joi.string()
    .valid('gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview')
    .default('gpt-3.5-turbo'),
  OPENAI_MAX_TOKENS: Joi.number()
    .integer()
    .min(1)
    .max(4096)
    .default(150),
  OPENAI_TEMPERATURE: Joi.number()
    .min(0)
    .max(1) // More restrictive in production
    .default(0.1),
  OPENAI_TIMEOUT: Joi.number()
    .integer()
    .min(10000)
    .max(60000) // Shorter timeout in production
    .default(30000),
  
  // Security Configuration - All required in production
  CONFIG_ENCRYPTION_KEY: Joi.string()
    .min(32)
    .required()
    .description('Required for encrypting sensitive configuration'),
  JWT_SECRET: Joi.string()
    .min(64) // Longer in production
    .required(),
  JWT_EXPIRATION: Joi.string()
    .pattern(/^\d+[hmd]$/)
    .default('24h'),
  
  // CORS Configuration
  CORS_ORIGINS: Joi.string()
    .required()
    .description('Comma-separated list of allowed origins'),
  CORS_CREDENTIALS: Joi.boolean()
    .default(true),
  
  // Rate Limiting - Stricter in production
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .default(60), // Lower in production
  
  // Admin Configuration - Strong requirements
  ADMIN_USERNAME: Joi.string()
    .min(8)
    .required(),
  ADMIN_PASSWORD: Joi.string()
    .min(16) // Stronger in production
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .description('Must contain uppercase, lowercase, number, and special character'),
  
  // Redis Configuration - Required in production
  REDIS_ENABLED: Joi.boolean()
    .valid(true)
    .required()
    .description('Redis required in production'),
  REDIS_HOST: Joi.string()
    .required(),
  REDIS_PORT: Joi.number()
    .integer()
    .default(6379),
  REDIS_PASSWORD: Joi.string()
    .required()
    .description('Redis password required in production'),
  REDIS_DB: Joi.number()
    .integer()
    .min(0)
    .max(15)
    .default(0),
  REDIS_KEY_PREFIX: Joi.string()
    .default('dsw:prod:'),
  REDIS_TLS_ENABLED: Joi.boolean()
    .default(true),
  
  // Job Queue Configuration - Production tuned
  JOB_QUEUE_MAX_CONCURRENT: Joi.number()
    .integer()
    .min(1)
    .max(10) // Limited in production
    .default(5),
  JOB_QUEUE_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .default(3),
  JOB_QUEUE_RETRY_DELAY: Joi.number()
    .integer()
    .min(5000)
    .default(10000), // Longer in production
  JOB_QUEUE_ENABLE_DEAD_LETTER: Joi.boolean()
    .valid(true) // Always enabled in production
    .default(true),
  
  // Cache Configuration - Production optimized
  CACHE_ENABLED: Joi.boolean()
    .valid(true)
    .default(true),
  CACHE_TYPE: Joi.string()
    .valid('redis') // Only Redis in production
    .default('redis'),
  CACHE_DEFAULT_TTL: Joi.number()
    .integer()
    .min(300) // Minimum 5 minutes
    .default(3600),
  CACHE_MAX_MEMORY: Joi.number()
    .integer()
    .min(100 * 1024 * 1024) // 100MB minimum
    .default(500 * 1024 * 1024), // 500MB
  
  // Performance & Monitoring
  ENABLE_METRICS: Joi.boolean()
    .valid(true)
    .default(true),
  METRICS_PORT: Joi.number()
    .integer()
    .default(9090),
  ENABLE_TRACING: Joi.boolean()
    .default(true),
  TRACING_ENDPOINT: Joi.string()
    .uri()
    .when('ENABLE_TRACING', { is: true, then: Joi.required() }),
  
  // Feature Flags
  ENABLE_HOT_RELOAD: Joi.boolean()
    .valid(false) // Disabled in production
    .default(false),
  ENABLE_CONFIG_API: Joi.boolean()
    .default(false), // Disabled by default in production
  ENABLE_DEBUG_ENDPOINTS: Joi.boolean()
    .valid(false)
    .default(false),
  
  // Health Check Configuration
  HEALTH_CHECK_INTERVAL: Joi.number()
    .integer()
    .min(5000)
    .default(30000),
  HEALTH_CHECK_TIMEOUT: Joi.number()
    .integer()
    .min(1000)
    .default(5000),
  
  // SSL/TLS Configuration
  SSL_ENABLED: Joi.boolean()
    .default(true),
  SSL_CERT_PATH: Joi.string()
    .when('SSL_ENABLED', { is: true, then: Joi.required() }),
  SSL_KEY_PATH: Joi.string()
    .when('SSL_ENABLED', { is: true, then: Joi.required() }),
  
  // Backup Configuration
  BACKUP_ENABLED: Joi.boolean()
    .default(true),
  BACKUP_SCHEDULE: Joi.string()
    .pattern(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/)
    .default('0 2 * * *'), // 2 AM daily
  BACKUP_RETENTION_DAYS: Joi.number()
    .integer()
    .min(7)
    .default(30),
  
  // Session Configuration
  SESSION_SECRET: Joi.string()
    .min(64)
    .required(),
  SESSION_MAX_AGE: Joi.number()
    .integer()
    .default(86400000), // 24 hours
  SESSION_SECURE: Joi.boolean()
    .valid(true)
    .default(true),
  
  // External Service Timeouts
  EXTERNAL_SERVICE_TIMEOUT: Joi.number()
    .integer()
    .min(5000)
    .max(30000)
    .default(15000),
  
  // Error Reporting
  ERROR_REPORTING_ENABLED: Joi.boolean()
    .default(true),
  ERROR_REPORTING_DSN: Joi.string()
    .uri()
    .when('ERROR_REPORTING_ENABLED', { is: true, then: Joi.required() }),
  
  // Compliance Settings
  COMPLIANCE_MODE: Joi.string()
    .valid('HIPAA', 'GDPR', 'PCI', 'SOC2')
    .default('GDPR'),
  DATA_RETENTION_DAYS: Joi.number()
    .integer()
    .min(30)
    .default(365),
  AUDIT_LOG_ENABLED: Joi.boolean()
    .valid(true)
    .default(true),
}).unknown(false); // No unknown keys in production

// Production configuration interface
export interface IProductionConfig extends IConfig {
  LOG_DIR: string;
  LOG_TO_FILE: boolean;
  JWT_EXPIRATION: string;
  CORS_ORIGINS: string;
  CORS_CREDENTIALS: boolean;
  REDIS_TLS_ENABLED: boolean;
  ENABLE_METRICS: boolean;
  METRICS_PORT: number;
  ENABLE_TRACING: boolean;
  TRACING_ENDPOINT?: string;
  ENABLE_DEBUG_ENDPOINTS: boolean;
  HEALTH_CHECK_INTERVAL: number;
  HEALTH_CHECK_TIMEOUT: number;
  SSL_ENABLED: boolean;
  SSL_CERT_PATH?: string;
  SSL_KEY_PATH?: string;
  BACKUP_ENABLED: boolean;
  BACKUP_SCHEDULE: string;
  BACKUP_RETENTION_DAYS: number;
  SESSION_SECRET: string;
  SESSION_MAX_AGE: number;
  SESSION_SECURE: boolean;
  EXTERNAL_SERVICE_TIMEOUT: number;
  ERROR_REPORTING_ENABLED: boolean;
  ERROR_REPORTING_DSN?: string;
  COMPLIANCE_MODE: string;
  DATA_RETENTION_DAYS: number;
  AUDIT_LOG_ENABLED: boolean;
}

// Production configuration defaults
export const productionDefaults: Partial<IProductionConfig> = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  LOG_TO_FILE: true,
  CORS_CREDENTIALS: true,
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 60,
  REDIS_ENABLED: true,
  REDIS_TLS_ENABLED: true,
  REDIS_KEY_PREFIX: 'dsw:prod:',
  JOB_QUEUE_MAX_CONCURRENT: 5,
  JOB_QUEUE_RETRY_DELAY: 10000,
  JOB_QUEUE_ENABLE_DEAD_LETTER: true,
  CACHE_ENABLED: true,
  CACHE_TYPE: 'redis',
  CACHE_DEFAULT_TTL: 3600,
  ENABLE_METRICS: true,
  ENABLE_HOT_RELOAD: false,
  ENABLE_CONFIG_API: false,
  ENABLE_DEBUG_ENDPOINTS: false,
  SSL_ENABLED: true,
  SESSION_SECURE: true,
  AUDIT_LOG_ENABLED: true,
};

// Production environment validator
export function validateProductionConfig(config: any): { error?: Error; value?: IProductionConfig } {
  const result = productionConfigSchema.validate(config, { 
    abortEarly: false,
    convert: true 
  });
  
  if (result.error) {
    return { error: result.error };
  }
  
  // Additional production-specific validations
  const validatedConfig = result.value as IProductionConfig;
  
  // Ensure no development values in production
  if (validatedConfig.JWT_SECRET === 'default-jwt-secret-change-in-production') {
    return { error: new Error('Default JWT secret not allowed in production') };
  }
  
  if (validatedConfig.CONFIG_ENCRYPTION_KEY?.includes('test') || 
      validatedConfig.CONFIG_ENCRYPTION_KEY?.includes('demo')) {
    return { error: new Error('Test/demo encryption keys not allowed in production') };
  }
  
  // Validate CORS origins
  const corsOrigins = validatedConfig.CORS_ORIGINS.split(',').map(o => o.trim());
  for (const origin of corsOrigins) {
    if (origin === '*' || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return { error: new Error('Wildcard or localhost CORS origins not allowed in production') };
    }
  }
  
  return { value: validatedConfig };
}