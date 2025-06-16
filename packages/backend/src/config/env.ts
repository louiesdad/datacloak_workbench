import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env files
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Legacy config export for backward compatibility
// New code should use ConfigService instead
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  database: {
    sqlite: {
      path: process.env.DB_PATH || process.env.SQLITE_DB_PATH || './data/sqlite.db',
    },
    duckdb: {
      path: process.env.NODE_ENV === 'test' 
        ? ':memory:' 
        : (process.env.DUCKDB_PATH || './data/duckdb.db'),
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '150', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
  },
  // Admin configuration
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'changeme',
  },
  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    configEncryptionKey: process.env.CONFIG_ENCRYPTION_KEY,
  },
  // Feature flags
  features: {
    enableHotReload: process.env.ENABLE_HOT_RELOAD !== 'false',
    enableConfigApi: process.env.ENABLE_CONFIG_API !== 'false',
  },
  // DataCloak configuration
  datacloak: {
    apiKey: process.env.DATACLOAK_API_KEY,
    apiEndpoint: process.env.DATACLOAK_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
    timeout: parseInt(process.env.DATACLOAK_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.DATACLOAK_RETRY_ATTEMPTS || '3', 10),
    useMock: process.env.DATACLOAK_USE_MOCK === 'true',
  },
} as const;