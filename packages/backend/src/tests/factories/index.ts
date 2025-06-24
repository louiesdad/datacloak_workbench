/**
 * Test Data Factories
 * 
 * Centralized test data generation for consistent testing across all test suites.
 * Provides realistic, structured test data with proper relationships and constraints.
 */

// Core factories
export * from './base.factory';

// Domain-specific factories
export * from './user.factory';
export * from './dataset.factory';
export * from './sentiment.factory';
export * from './field.factory';
export * from './config.factory';
export * from './cache.factory';
export * from './job.factory';

// Relationship factory (should be imported last due to dependencies)
export * from './relationships.factory';

// Convenient exports for common patterns
export { FactoryRegistry, testRandom, TestDataUtils } from './base.factory';
export { userFactory } from './user.factory';
export { datasetFactory } from './dataset.factory';
export { sentimentFactory } from './sentiment.factory';
export { fieldDataFactory } from './field.factory';
export { configFactory } from './config.factory';
export { cacheFactory } from './cache.factory';
export { jobFactory } from './job.factory';
export { relationshipsFactory } from './relationships.factory';