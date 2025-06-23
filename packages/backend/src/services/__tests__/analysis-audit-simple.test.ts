/**
 * Simple test to verify analysis audit service functionality
 */

// Mock sqlite connection
jest.mock('../../database/sqlite-refactored', () => ({
  getSQLiteConnection: jest.fn().mockResolvedValue({
    exec: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue({ changes: 1 }),
    all: jest.fn().mockResolvedValue([])
  })
}));

import { AnalysisAuditService, FieldDetectionDecision } from '../analysis-audit.service';

describe('Analysis Audit Service', () => {
  let auditService: AnalysisAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = new AnalysisAuditService();
  });

  describe('Field Detection Decision Logging', () => {
    it('should log field detection decisions with heuristic scores', async () => {
      const decision: FieldDetectionDecision = {
        fieldName: 'email_field',
        detectedType: 'email',
        heuristicScores: {
          pattern_match: 0.95,
          sample_analysis: 0.8,
          statistical_features: 0.7,
          gpt_enhancement: 0
        },
        gptEnhancement: {
          used: false,
          prompt: '',
          response: '',
          tokens_used: 0,
          reasoning: ''
        },
        sampleTokens: {
          analyzed_samples: ['test@example.com', 'user@domain.org'],
          safe_samples: ['[EMAIL]', '[EMAIL]'],
          pattern_matches: ['test@example.com']
        },
        finalConfidence: 0.95,
        decision_factors: ['Strong pattern match for email', 'High sample uniqueness']
      };

      const logId = await auditService.logFieldDetectionDecision(decision);
      expect(logId).toBeDefined();
      expect(typeof logId).toBe('string');
    });

    it('should capture GPT enhancement when used', async () => {
      const decisionWithGPT: FieldDetectionDecision = {
        fieldName: 'ambiguous_field',
        detectedType: 'string',
        heuristicScores: {
          pattern_match: 0.3,
          sample_analysis: 0.5,
          statistical_features: 0.4,
          gpt_enhancement: 0.85
        },
        gptEnhancement: {
          used: true,
          prompt: 'Analyze field type for: mixed data',
          response: 'Field appears to be text-based',
          tokens_used: 150,
          reasoning: 'Mixed content suggests string type'
        },
        sampleTokens: {
          analyzed_samples: ['mixed', 'data', 'here'],
          safe_samples: ['[REDACTED]', '[REDACTED]', '[REDACTED]'],
          pattern_matches: []
        },
        finalConfidence: 0.85,
        decision_factors: ['GPT enhancement provided additional confidence']
      };

      const logId = await auditService.logFieldDetectionDecision(decisionWithGPT);
      expect(logId).toBeDefined();
    });
  });

  describe('Text Anonymization', () => {
    it('should anonymize sensitive information', () => {
      const testCases = [
        { input: 'Contact john@example.com', expected: 'Contact [EMAIL]' },
        { input: 'SSN: 123-45-6789', expected: 'SSN: [SSN]' },
        { input: 'Call 555-123-4567', expected: 'Call [PHONE]' },
        { input: 'Card: 1234 5678 9012 3456', expected: 'Card: [CREDIT_CARD]' },
        { input: 'John Smith works here', expected: '[NAME] works here' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = auditService.anonymizeText(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Session Management', () => {
    it('should manage analysis sessions', () => {
      const initialSessionId = auditService.getCurrentSessionId();
      expect(initialSessionId).toBeDefined();

      const newSessionId = auditService.startNewSession();
      expect(newSessionId).toBeDefined();
      expect(newSessionId).not.toBe(initialSessionId);
      expect(auditService.getCurrentSessionId()).toBe(newSessionId);
    });
  });
});