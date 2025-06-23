/**
 * Test Data Factories
 * Centralized factory functions for creating test data
 */

export * from './dataset.factory';
export * from './user.factory';
export * from './security.factory';
export * from './sentiment.factory';
export * from './types';

// Re-export factory instances for convenience
import { datasetFactory, analysisBatchFactory } from './dataset.factory';
import { userFactory, authTokenFactory } from './user.factory';
import { sentimentAnalysisFactory, sentimentStatisticsFactory } from './sentiment.factory';
import { securityAuditFactory, securityEventFactory, complianceAuditFactory } from './security.factory';

export const factories = {
  dataset: datasetFactory,
  analysisBatch: analysisBatchFactory,
  user: userFactory,
  authToken: authTokenFactory,
  sentimentAnalysis: sentimentAnalysisFactory,
  sentimentStatistics: sentimentStatisticsFactory,
  securityAudit: securityAuditFactory,
  securityEvent: securityEventFactory,
  complianceAudit: complianceAuditFactory
};