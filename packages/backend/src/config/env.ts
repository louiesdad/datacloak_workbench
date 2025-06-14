import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  database: {
    sqlite: {
      path: process.env.SQLITE_DB_PATH || './data/sqlite.db',
    },
    duckdb: {
      path: process.env.DUCKDB_PATH || './data/duckdb.db',
    },
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
} as const;