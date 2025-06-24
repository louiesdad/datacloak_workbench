import * as Joi from 'joi';

export const configSchema = Joi.object({
  // Server Configuration
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  
  // Database Configuration
  DB_PATH: Joi.string().default('./data/sqlite.db'),
  DUCKDB_PATH: Joi.string().default('./data/duckdb.db'),
  
  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: Joi.string()
    .pattern(/^sk-[a-zA-Z0-9\-_]{20,}$/)
    .optional()
    .description('OpenAI API key for sentiment analysis'),
  OPENAI_MODEL: Joi.string()
    .default('gpt-3.5-turbo')
    .description('OpenAI model to use'),
  OPENAI_MAX_TOKENS: Joi.number()
    .integer()
    .min(1)
    .max(4096)
    .default(150),
  OPENAI_TEMPERATURE: Joi.number()
    .min(0)
    .max(2)
    .default(0.1),
  OPENAI_TIMEOUT: Joi.number()
    .integer()
    .min(5000)
    .max(120000)
    .default(30000),
  
  // Security Configuration
  CONFIG_ENCRYPTION_KEY: Joi.string()
    .min(32)
    .optional()
    .description('Key for encrypting sensitive configuration'),
  JWT_SECRET: Joi.string()
    .min(32)
    .default('default-jwt-secret-change-in-production'),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable rate limiting'),
  RATE_LIMIT_WINDOW_MS: Joi.number()
    .integer()
    .default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: Joi.number()
    .integer()
    .default(100),
  
  // Admin Configuration
  ADMIN_USERNAME: Joi.string()
    .default('admin'),
  ADMIN_PASSWORD: Joi.string()
    .min(8)
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.string().default('test-admin-password-for-testing'),
      otherwise: Joi.required()
    })
    .description('Admin password for configuration management'),
  
  // Redis Configuration
  REDIS_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable Redis for job queue persistence'),
  REDIS_HOST: Joi.string()
    .default('localhost')
    .description('Redis server host'),
  REDIS_PORT: Joi.number()
    .integer()
    .default(6379)
    .description('Redis server port'),
  REDIS_PASSWORD: Joi.string()
    .allow('')
    .optional()
    .description('Redis server password'),
  REDIS_DB: Joi.number()
    .integer()
    .min(0)
    .max(15)
    .default(0)
    .description('Redis database number'),
  REDIS_KEY_PREFIX: Joi.string()
    .default('dsw:')
    .description('Prefix for all Redis keys'),
  
  // Job Queue Configuration
  JOB_QUEUE_MAX_CONCURRENT: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3)
    .description('Maximum concurrent jobs'),
  JOB_QUEUE_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(3)
    .description('Number of retry attempts for failed jobs'),
  JOB_QUEUE_RETRY_DELAY: Joi.number()
    .integer()
    .min(1000)
    .default(5000)
    .description('Base delay in ms for job retries'),
  JOB_QUEUE_ENABLE_DEAD_LETTER: Joi.boolean()
    .default(true)
    .description('Enable dead letter queue for permanently failed jobs'),
  
  // Cache Configuration
  CACHE_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable caching for API responses and computations'),
  CACHE_TYPE: Joi.string()
    .valid('memory', 'redis')
    .default('memory')
    .description('Type of cache to use'),
  CACHE_DEFAULT_TTL: Joi.number()
    .integer()
    .min(60)
    .default(3600)
    .description('Default cache TTL in seconds'),
  CACHE_MAX_MEMORY: Joi.number()
    .integer()
    .min(1024 * 1024)
    .default(100 * 1024 * 1024)
    .description('Maximum memory usage for in-memory cache in bytes'),
  CACHE_COMPRESSION_THRESHOLD: Joi.number()
    .integer()
    .min(100)
    .default(1024)
    .description('Size threshold in bytes to trigger compression'),
  
  // Feature Flags
  ENABLE_HOT_RELOAD: Joi.boolean()
    .default(true)
    .description('Enable configuration hot-reload'),
  ENABLE_CONFIG_API: Joi.boolean()
    .default(true)
    .description('Enable configuration management API'),
  
  // Secret Management
  SECRET_PROVIDER: Joi.string()
    .valid('env', 'aws', 'azure', 'vault')
    .default('env')
    .description('Secret management provider'),
  SECRET_CACHE_TTL: Joi.number()
    .min(0)
    .max(86400)
    .default(3600)
    .description('Secret cache TTL in seconds'),
  SECRET_ACCESS_LOG_SIZE: Joi.number()
    .min(100)
    .max(100000)
    .default(10000)
    .description('Maximum number of access log entries to keep'),
  SECRET_ROTATION_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable automatic secret rotation'),
  SECRET_ROTATION_NOTIFY_DAYS: Joi.number()
    .min(1)
    .max(30)
    .default(7)
    .description('Days before rotation to send notifications'),
  ENABLE_SECRET_MANAGEMENT_API: Joi.boolean()
    .default(false)
    .description('Enable secret management REST API'),
  
  // AWS Secrets Manager
  AWS_REGION: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'aws',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().default('us-east-1'),
        otherwise: Joi.required()
      })
    })
    .description('AWS region for Secrets Manager'),
  AWS_SECRET_PREFIX: Joi.string()
    .default('datacloak/')
    .description('Prefix for AWS secrets'),
  
  // Azure Key Vault
  AZURE_KEY_VAULT_URL: Joi.string()
    .uri()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().uri().default('https://test-vault.vault.azure.net/'),
        otherwise: Joi.required()
      })
    })
    .description('Azure Key Vault URL'),
  AZURE_TENANT_ID: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().default('test-tenant-id'),
        otherwise: Joi.required()
      })
    })
    .description('Azure tenant ID'),
  AZURE_CLIENT_ID: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().default('test-client-id'),
        otherwise: Joi.required()
      })
    })
    .description('Azure client ID'),
  
  // HashiCorp Vault
  VAULT_ADDR: Joi.string()
    .uri()
    .when('SECRET_PROVIDER', {
      is: 'vault',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().uri().default('http://localhost:8200'),
        otherwise: Joi.required()
      })
    })
    .description('HashiCorp Vault address'),
  VAULT_TOKEN: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'vault',
      then: Joi.when('NODE_ENV', {
        is: 'test',
        then: Joi.string().default('test-vault-token'),
        otherwise: Joi.required()
      })
    })
    .description('HashiCorp Vault token'),
  VAULT_PATH: Joi.string()
    .default('secret/datacloak')
    .description('HashiCorp Vault secret path'),
  
  // DataCloak Configuration
  DATACLOAK_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable DataCloak PII detection'),
  DATACLOAK_FFI_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable DataCloak FFI bindings'),
  DATACLOAK_BATCH_SIZE: Joi.number()
    .integer()
    .min(100)
    .max(10000)
    .default(1000)
    .description('DataCloak processing batch size'),
  
  // Performance Configuration
  ENABLE_CACHING: Joi.boolean()
    .default(true)
    .description('Enable general caching'),
  CACHE_TTL: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(3600)
    .description('Default cache TTL in seconds'),
  MAX_FILE_SIZE: Joi.number()
    .integer()
    .min(1024)
    .default(100 * 1024 * 1024)
    .description('Maximum file size in bytes'),
  ENABLE_METRICS: Joi.boolean()
    .default(true)
    .description('Enable metrics collection'),
  ENABLE_DETAILED_LOGGING: Joi.boolean()
    .default(false)
    .description('Enable detailed logging'),
}).unknown(true); // Allow additional environment variables

export interface IConfig {
  PORT: number;
  NODE_ENV: string;
  DB_PATH: string;
  DUCKDB_PATH: string;
  LOG_LEVEL: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_MAX_TOKENS: number;
  OPENAI_TEMPERATURE: number;
  OPENAI_TIMEOUT: number;
  CONFIG_ENCRYPTION_KEY?: string;
  JWT_SECRET: string;
  RATE_LIMIT_ENABLED: boolean;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  REDIS_ENABLED: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_KEY_PREFIX: string;
  JOB_QUEUE_MAX_CONCURRENT: number;
  JOB_QUEUE_RETRY_ATTEMPTS: number;
  JOB_QUEUE_RETRY_DELAY: number;
  JOB_QUEUE_ENABLE_DEAD_LETTER: boolean;
  CACHE_ENABLED: boolean;
  CACHE_TYPE: string;
  CACHE_DEFAULT_TTL: number;
  CACHE_MAX_MEMORY: number;
  CACHE_COMPRESSION_THRESHOLD: number;
  ENABLE_HOT_RELOAD: boolean;
  ENABLE_CONFIG_API: boolean;
  
  // Secret Management
  SECRET_PROVIDER?: string;
  SECRET_CACHE_TTL?: number;
  SECRET_ACCESS_LOG_SIZE?: number;
  SECRET_ROTATION_ENABLED?: boolean;
  SECRET_ROTATION_NOTIFY_DAYS?: number;
  ENABLE_SECRET_MANAGEMENT_API?: boolean;
  
  // AWS Secrets Manager
  AWS_REGION?: string;
  AWS_SECRET_PREFIX?: string;
  
  // Azure Key Vault
  AZURE_KEY_VAULT_URL?: string;
  AZURE_TENANT_ID?: string;
  AZURE_CLIENT_ID?: string;
  
  // HashiCorp Vault
  VAULT_ADDR?: string;
  VAULT_TOKEN?: string;
  VAULT_PATH?: string;
  
  // DataCloak Configuration
  DATACLOAK_ENABLED?: boolean;
  DATACLOAK_FFI_ENABLED?: boolean;
  DATACLOAK_BATCH_SIZE?: number;
  
  // Performance Configuration
  ENABLE_CACHING?: boolean;
  CACHE_TTL?: number;
  MAX_FILE_SIZE?: number;
  ENABLE_METRICS?: boolean;
  ENABLE_DETAILED_LOGGING?: boolean;
}