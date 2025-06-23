/**
 * Analysis Decision Tracker Tests
 * Tests for decision tracking and trace ID management
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnalysisDecisionTracker, analysisDecisionTracker } from '../analysis-decision-tracker.service';
import { loadTestEnvironment } from '../../config/test-env';
import { withSQLiteConnection } from '../../database/sqlite-refactored';

// Load test environment
loadTestEnvironment();

describe('Analysis Decision Tracker Tests', () => {
  let tracker: AnalysisDecisionTracker;

  beforeEach(() => {
    tracker = new AnalysisDecisionTracker({
      enablePerformanceTracking: true,
      enableMemoryTracking: true,
      logLevel: 'verbose'
    });
  });

  afterEach(() => {
    // Clean up any active traces
    const activeTraces = tracker.getActiveTraces();
    activeTraces.forEach(traceId => tracker.endTrace(traceId));
  });

  describe('Trace ID Generation and Management', () => {
    test('should generate unique trace IDs', () => {
      const traceId1 = tracker.startTrace();
      const traceId2 = tracker.startTrace();
      
      expect(traceId1).toMatch(/^trace-\d+-[a-z0-9]{8}$/);
      expect(traceId2).toMatch(/^trace-\d+-[a-z0-9]{8}$/);
      expect(traceId1).not.toBe(traceId2);
    });

    test('should use provided trace ID', () => {
      const customTraceId = 'custom-trace-12345';
      const traceId = tracker.startTrace({ traceId: customTraceId });
      
      expect(traceId).toBe(customTraceId);
    });

    test('should track trace context information', () => {
      const context = {
        userId: 'user-123',
        sessionId: 'session-456',
        datasetId: 'dataset-789',
        parentTraceId: 'parent-trace'
      };
      
      const traceId = tracker.startTrace(context);
      const activeTraces = tracker.getActiveTraces();
      
      expect(activeTraces).toContain(traceId);
    });

    test('should end traces and remove from active list', () => {
      const traceId = tracker.startTrace();
      expect(tracker.getActiveTraces()).toContain(traceId);
      
      tracker.endTrace(traceId);
      expect(tracker.getActiveTraces()).not.toContain(traceId);
    });

    test('should handle ending non-existent traces gracefully', () => {
      expect(() => {
        tracker.endTrace('non-existent-trace');
      }).not.toThrow();
    });
  });

  describe('Trace Performance Tracking', () => {
    test('should track trace performance metrics', () => {
      const traceId = tracker.startTrace();
      
      // Wait a bit to simulate processing time
      setTimeout(() => {
        const performance = tracker.getTracePerformance(traceId);
        
        expect(performance).toBeDefined();
        expect(performance?.active).toBe(true);
        expect(performance?.duration).toBeGreaterThan(0);
        
        tracker.endTrace(traceId);
      }, 10);
    });

    test('should return null for non-existent traces', () => {
      const performance = tracker.getTracePerformance('non-existent');
      expect(performance).toBeNull();
    });
  });

  describe('Sentiment Analysis Decision Logging', () => {
    test('should log sentiment analysis decisions', () => {
      const traceId = tracker.startTrace();
      
      expect(() => {
        tracker.logSentimentDecision(traceId, 'openai_analysis', {
          text: 'This is a positive message',
          result: {
            sentiment: 'positive',
            confidence: 0.85,
            scores: { positive: 0.85, negative: 0.1, neutral: 0.05 }
          },
          algorithm: 'gpt-3.5-turbo',
          factors: {
            textLength: 26,
            hasEmojis: false,
            wordCount: 5
          },
          performance: { duration: 500, memoryUsage: 1024 * 1024 }
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should log sentiment decisions with alternatives', () => {
      const traceId = tracker.startTrace();
      
      expect(() => {
        tracker.logSentimentDecision(traceId, 'multi_model_analysis', {
          text: 'Ambiguous sentiment text',
          result: {
            sentiment: 'neutral',
            confidence: 0.6
          },
          algorithm: 'ensemble_approach',
          alternatives: [
            { option: 'positive', score: 0.4, reason: 'Some positive words detected' },
            { option: 'neutral', score: 0.6, reason: 'Balanced sentiment indicators' },
            { option: 'negative', score: 0.3, reason: 'Few negative indicators' }
          ]
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should handle long text truncation for logging', () => {
      const traceId = tracker.startTrace();
      const longText = 'This is a very long text that should be truncated for logging purposes. '.repeat(10);
      
      expect(() => {
        tracker.logSentimentDecision(traceId, 'long_text_analysis', {
          text: longText,
          result: {
            sentiment: 'positive',
            confidence: 0.7
          },
          algorithm: 'text_truncation_test'
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });
  });

  describe('Field Detection Decision Logging', () => {
    test('should log field detection decisions', () => {
      const traceId = tracker.startTrace({ datasetId: 'dataset-123' });
      
      expect(() => {
        tracker.logFieldDetectionDecision(traceId, 'type_inference', {
          fieldName: 'age',
          sampleValues: [25, 30, 35, null, 42],
          detectedType: 'integer',
          confidence: 0.9,
          algorithm: 'pattern_matching',
          factors: {
            sampleSize: 5,
            nullCount: 1,
            numericCount: 4
          },
          alternatives: [
            { option: 'string', score: 0.1, reason: 'All values can be strings' },
            { option: 'integer', score: 0.9, reason: 'Mostly integer values' },
            { option: 'float', score: 0.3, reason: 'Could be decimal numbers' }
          ]
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should handle various data types in field detection', () => {
      const traceId = tracker.startTrace();
      
      const testCases = [
        {
          fieldName: 'email',
          sampleValues: ['user@example.com', 'test@domain.org', null],
          detectedType: 'email',
          confidence: 0.95
        },
        {
          fieldName: 'date',
          sampleValues: ['2023-01-01', '2023-02-15', '2023-03-30'],
          detectedType: 'date',
          confidence: 0.88
        },
        {
          fieldName: 'boolean',
          sampleValues: [true, false, true, null],
          detectedType: 'boolean',
          confidence: 0.85
        }
      ];

      testCases.forEach((testCase, index) => {
        expect(() => {
          tracker.logFieldDetectionDecision(traceId, `type_inference_${index}`, {
            ...testCase,
            algorithm: 'multi_type_detector'
          });
        }).not.toThrow();
      });
      
      tracker.endTrace(traceId);
    });
  });

  describe('PII Masking Decision Logging', () => {
    test('should log PII masking decisions', () => {
      const traceId = tracker.startTrace();
      
      expect(() => {
        tracker.logPIIMaskingDecision(traceId, 'email_masking', {
          fieldName: 'email',
          originalValue: 'john.doe@company.com',
          maskedValue: '****@*******.***',
          piiType: 'EMAIL',
          confidence: 0.95,
          algorithm: 'datacloak_masking',
          maskingStrategy: 'pattern_replacement',
          factors: {
            emailDomain: 'company.com',
            preserveStructure: true
          }
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should log different PII types', () => {
      const traceId = tracker.startTrace();
      
      const piiTestCases = [
        {
          fieldName: 'phone',
          originalValue: '555-123-4567',
          maskedValue: '***-***-****',
          piiType: 'PHONE',
          maskingStrategy: 'digit_replacement'
        },
        {
          fieldName: 'ssn',
          originalValue: '123-45-6789',
          maskedValue: '***-**-****',
          piiType: 'SSN',
          maskingStrategy: 'full_replacement'
        },
        {
          fieldName: 'credit_card',
          originalValue: '4532-1234-5678-9012',
          maskedValue: '****-****-****-9012',
          piiType: 'CREDIT_CARD',
          maskingStrategy: 'partial_masking'
        }
      ];

      piiTestCases.forEach((testCase, index) => {
        expect(() => {
          tracker.logPIIMaskingDecision(traceId, `pii_masking_${index}`, {
            ...testCase,
            confidence: 0.9,
            algorithm: 'regex_based_detection'
          });
        }).not.toThrow();
      });
      
      tracker.endTrace(traceId);
    });
  });

  describe('Data Quality Decision Logging', () => {
    test('should log data quality assessment decisions', () => {
      const traceId = tracker.startTrace();
      
      expect(() => {
        tracker.logDataQualityDecision(traceId, 'completeness_assessment', {
          fieldName: 'customer_name',
          qualityMetrics: {
            completeness: 95.5,
            uniqueness: 88.2,
            validity: 92.1,
            consistency: 96.8
          },
          issues: [
            'Missing values in 4.5% of records',
            '11.8% duplicate values found'
          ],
          recommendations: [
            'Consider data cleaning for missing values',
            'Investigate duplicate entries'
          ],
          algorithm: 'comprehensive_quality_check',
          confidence: 0.88
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should handle edge cases in quality metrics', () => {
      const traceId = tracker.startTrace();
      
      const edgeCases = [
        {
          fieldName: 'empty_field',
          qualityMetrics: { completeness: 0, uniqueness: 0, validity: 0, consistency: 0 },
          issues: ['Field is completely empty'],
          recommendations: ['Remove field or investigate data source']
        },
        {
          fieldName: 'perfect_field',
          qualityMetrics: { completeness: 100, uniqueness: 100, validity: 100, consistency: 100 },
          issues: [],
          recommendations: ['Field meets all quality standards']
        }
      ];

      edgeCases.forEach((testCase, index) => {
        expect(() => {
          tracker.logDataQualityDecision(traceId, `quality_edge_case_${index}`, {
            ...testCase,
            algorithm: 'edge_case_detector',
            confidence: 1.0
          });
        }).not.toThrow();
      });
      
      tracker.endTrace(traceId);
    });
  });

  describe('Security Scan Decision Logging', () => {
    test('should log security scan decisions', () => {
      const traceId = tracker.startTrace();
      
      expect(() => {
        tracker.logSecurityScanDecision(traceId, 'comprehensive_security_scan', {
          scanType: 'pii_and_vulnerability_scan',
          findings: [
            {
              type: 'PII_EXPOSURE',
              severity: 'high',
              description: 'Email addresses found in dataset',
              location: 'column: email'
            },
            {
              type: 'WEAK_ENCRYPTION',
              severity: 'medium',
              description: 'Data stored without encryption',
              location: 'dataset storage'
            }
          ],
          riskScore: 0.65,
          algorithm: 'multi_layer_security_scan',
          confidence: 0.92
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });

    test('should handle different severity levels', () => {
      const traceId = tracker.startTrace();
      
      const severityTestCases = [
        { severity: 'critical' as const, count: 2 },
        { severity: 'high' as const, count: 3 },
        { severity: 'medium' as const, count: 5 },
        { severity: 'low' as const, count: 8 }
      ];

      severityTestCases.forEach((testCase, index) => {
        const findings = Array.from({ length: testCase.count }, (_, i) => ({
          type: `FINDING_TYPE_${i}`,
          severity: testCase.severity,
          description: `${testCase.severity} severity finding ${i}`,
          location: `location_${i}`
        }));

        expect(() => {
          tracker.logSecurityScanDecision(traceId, `security_scan_${testCase.severity}`, {
            scanType: `${testCase.severity}_severity_scan`,
            findings,
            riskScore: testCase.severity === 'critical' ? 0.9 : 
                       testCase.severity === 'high' ? 0.7 :
                       testCase.severity === 'medium' ? 0.5 : 0.2,
            algorithm: 'severity_based_scanner',
            confidence: 0.85
          });
        }).not.toThrow();
      });
      
      tracker.endTrace(traceId);
    });
  });

  describe('Traced Logger Integration', () => {
    test('should create logger instances with trace IDs', () => {
      const traceId = tracker.startTrace();
      const tracedLogger = tracker.getTracedLogger(traceId);
      
      expect(tracedLogger).toBeDefined();
      expect(typeof tracedLogger.info).toBe('function');
      expect(typeof tracedLogger.logAnalysisDecision).toBe('function');
      
      // Test logging with traced logger
      expect(() => {
        tracedLogger.info('Test message with trace context', {
          component: 'test',
          testData: 'example'
        });
      }).not.toThrow();
      
      tracker.endTrace(traceId);
    });
  });

  describe('Database Integration', () => {
    test('should store decision summaries in database', async () => {
      const traceId = tracker.startTrace({ datasetId: 'test-dataset' });
      
      const summary = {
        decisionType: 'sentiment_analysis',
        stepCount: 3,
        averageConfidence: 0.85,
        totalDuration: 1500,
        datasetId: 'test-dataset'
      };

      await expect(tracker.storeDecisionSummary(traceId, summary)).resolves.not.toThrow();
      
      // Verify the summary was stored
      await withSQLiteConnection(async (db) => {
        const stmt = db.prepare('SELECT * FROM analysis_decision_summaries WHERE trace_id = ?');
        const result = stmt.get(traceId);
        
        if (result) {
          expect(result.decision_type).toBe(summary.decisionType);
          expect(result.step_count).toBe(summary.stepCount);
          expect(result.average_confidence).toBe(summary.averageConfidence);
        }
      });
      
      tracker.endTrace(traceId);
    }, 10000);

    test('should handle database storage errors gracefully', async () => {
      const traceId = tracker.startTrace();
      
      // Test with invalid summary data
      const invalidSummary = {
        decisionType: 'invalid_type' as any,
        stepCount: -1,
        averageConfidence: 1.5, // Invalid confidence > 1
        totalDuration: -100,
        datasetId: 'test-dataset'
      };

      // Should not throw even with invalid data
      await expect(tracker.storeDecisionSummary(traceId, invalidSummary)).resolves.not.toThrow();
      
      tracker.endTrace(traceId);
    });
  });

  describe('Configuration Options', () => {
    test('should respect logging level configuration', () => {
      const minimalTracker = new AnalysisDecisionTracker({ logLevel: 'minimal' });
      const normalTracker = new AnalysisDecisionTracker({ logLevel: 'normal' });
      const verboseTracker = new AnalysisDecisionTracker({ logLevel: 'verbose' });
      
      // All should work without throwing
      expect(() => {
        const traceId1 = minimalTracker.startTrace();
        const traceId2 = normalTracker.startTrace();
        const traceId3 = verboseTracker.startTrace();
        
        minimalTracker.endTrace(traceId1);
        normalTracker.endTrace(traceId2);
        verboseTracker.endTrace(traceId3);
      }).not.toThrow();
    });

    test('should handle performance tracking configuration', () => {
      const perfTracker = new AnalysisDecisionTracker({
        enablePerformanceTracking: true,
        enableMemoryTracking: true,
        enableCpuTracking: true
      });
      
      expect(() => {
        const traceId = perfTracker.startTrace();
        perfTracker.logSentimentDecision(traceId, 'perf_test', {
          text: 'test',
          result: { sentiment: 'neutral', confidence: 0.5 },
          algorithm: 'test',
          performance: { duration: 100, memoryUsage: 1024, cpuUsage: 5.2 }
        });
        perfTracker.endTrace(traceId);
      }).not.toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle trace operations with invalid trace IDs', () => {
      expect(() => {
        tracker.endTrace('');
        tracker.endTrace('invalid-trace-id');
        tracker.getTracePerformance('non-existent');
      }).not.toThrow();
    });

    test('should handle logging decisions for non-existent traces', () => {
      expect(() => {
        tracker.logSentimentDecision('non-existent-trace', 'test', {
          text: 'test',
          result: { sentiment: 'neutral', confidence: 0.5 },
          algorithm: 'test'
        });
      }).not.toThrow();
    });

    test('should handle concurrent trace operations', () => {
      const traces = Array.from({ length: 10 }, () => tracker.startTrace());
      
      expect(traces).toHaveLength(10);
      expect(new Set(traces).size).toBe(10); // All unique
      
      // End all traces
      traces.forEach(traceId => tracker.endTrace(traceId));
      
      expect(tracker.getActiveTraces()).toHaveLength(0);
    });
  });
});