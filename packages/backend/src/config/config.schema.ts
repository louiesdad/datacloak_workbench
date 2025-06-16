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
    .required()
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
}