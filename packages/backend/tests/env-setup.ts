/**
 * Test Environment Setup
 * 
 * This file loads and configures the test environment before any tests run.
 * It should be loaded first in Jest setupFilesAfterEnv.
 */

import { loadTestEnvironment } from '../src/config/test-env';

// Load test environment as early as possible
try {
  loadTestEnvironment();
  console.log('✓ Test environment loaded successfully');
} catch (error) {
  console.error('✗ Failed to load test environment:', error.message);
  process.exit(1);
}

// Export environment info for debugging
export const testEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  database: process.env.SQLITE_DB_PATH,
  cache: process.env.CACHE_TYPE,
  logging: process.env.LOG_LEVEL,
  features: {
    redis: process.env.REDIS_ENABLED === 'true',
    datacloak: process.env.DATACLOAK_USE_MOCK === 'true',
    openai: process.env.OPENAI_API_KEY?.includes('test') || false
  }
};