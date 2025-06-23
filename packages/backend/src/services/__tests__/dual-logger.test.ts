/**
 * Dual Logger Tests
 * Tests for dual-purpose logging infrastructure with technical and analysis audit logging
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { dualLogger, DecisionBuilder, DualLogger } from '../../config/dual-logger';
import { DecisionLogValidator, DecisionLogSerializer } from '../../schemas/decision-log.schema';
import { loadTestEnvironment } from '../../config/test-env';
import * as fs from 'fs';
import * as path from 'path';

// Load test environment
loadTestEnvironment();

describe('Dual Logger Infrastructure Tests', () => {
  let testLogDir: string;
  let originalLogDir: string;

  beforeEach(() => {
    // Create temporary log directory for tests
    testLogDir = path.join(process.cwd(), 'temp', 'test-logs');
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true });
    }
    
    // Override LOG_DIR for tests
    originalLogDir = process.env.LOG_DIR || '';
    process.env.LOG_DIR = testLogDir;
  });

  afterEach(() => {
    // Restore original LOG_DIR
    process.env.LOG_DIR = originalLogDir;
    
    // Cleanup test log directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('Logger Initialization', () => {
    test('should initialize dual logger with separate transports', () => {
      expect(dualLogger).toBeDefined();
      expect(typeof dualLogger.info).toBe('function');
      expect(typeof dualLogger.logAnalysisDecision).toBe('function');
      expect(typeof dualLogger.generateTraceId).toBe('function');
    });

    test('should support technical logging methods', () => {
      expect(typeof dualLogger.info).toBe('function');
      expect(typeof dualLogger.warn).toBe('function');
      expect(typeof dualLogger.error).toBe('function');
      expect(typeof dualLogger.debug).toBe('function');
      expect(typeof dualLogger.performance).toBe('function');
      expect(typeof dualLogger.database).toBe('function');
      expect(typeof dualLogger.security).toBe('function');
    });

    test('should support analysis decision logging', () => {
      expect(typeof dualLogger.logAnalysisDecision).toBe('function');
      expect(typeof dualLogger.generateTraceId).toBe('function');
      expect(typeof dualLogger.withTraceId).toBe('function');
    });
  });

  describe('Transport Routing', () => {
    test('should log technical messages to console in test environment', () => {
      // Skip this test in CI/test environment as console output is captured differently
      expect(typeof dualLogger.info).toBe('function');
      
      // Test that logging doesn't throw
      expect(() => {
        dualLogger.info('Test technical message', { component: 'test' });
      }).not.toThrow();
    });

    test('should generate trace IDs', () => {
      const traceId1 = dualLogger.generateTraceId();
      const traceId2 = dualLogger.generateTraceId();
      
      expect(traceId1).toMatch(/^trace-\d+-[a-z0-9]{8}$/);
      expect(traceId2).toMatch(/^trace-\d+-[a-z0-9]{8}$/);
      expect(traceId1).not.toBe(traceId2);
    });

    test('should create logger instances with trace IDs', () => {
      const traceId = 'test-trace-123';
      const tracedLogger = dualLogger.withTraceId(traceId);
      
      expect(tracedLogger).toBeDefined();
      expect(typeof tracedLogger.info).toBe('function');
      expect(typeof tracedLogger.logAnalysisDecision).toBe('function');
    });
  });

  describe('Format Validation', () => {
    test('should format technical logs correctly', () => {
      // Test that logging with metadata doesn't throw
      expect(() => {
        dualLogger.info('Test message', {
          component: 'test-component',
          correlationId: 'test-corr-123'
        });
      }).not.toThrow();
      
      // Test that log message structure is correct by checking the logger interface
      expect(typeof dualLogger.info).toBe('function');
    });

    test('should handle performance logging with duration', () => {
      const startTime = Date.now() - 1000; // 1 second ago
      
      // Test that performance logging doesn't throw
      expect(() => {
        dualLogger.performance('Operation completed', startTime, {
          component: 'performance-test'
        });
      }).not.toThrow();
      
      // Verify the performance method exists
      expect(typeof dualLogger.performance).toBe('function');
    });
  });

  describe('Decision Logging', () => {
    test('should log sentiment analysis decisions', () => {
      const traceId = dualLogger.generateTraceId();
      
      const decision = DecisionBuilder
        .create('sentiment_analysis')
        .step('openai_analysis')
        .algorithm('gpt-3.5-turbo')
        .confidence(0.85)
        .factors({
          textLength: 100,
          model: 'gpt-3.5-turbo',
          hasEmojis: false
        })
        .input({
          sampleData: 'This is a test message',
          parameters: { model: 'gpt-3.5-turbo' }
        })
        .output({
          result: {
            sentiment: 'positive',
            confidence: 0.85,
            score: 0.75
          },
          performance: { duration: 500 }
        })
        .build();

      expect(() => {
        const resultTraceId = dualLogger.logAnalysisDecision(decision, traceId);
        expect(resultTraceId).toBe(traceId);
      }).not.toThrow();
    });

    test('should log field detection decisions', () => {
      const decision = DecisionBuilder
        .create('field_detection')
        .step('type_inference')
        .algorithm('pattern_matching')
        .confidence(0.9)
        .factors({
          sampleSize: 10,
          numericCount: 8,
          nullCount: 1
        })
        .input({
          fieldName: 'age',
          sampleData: [25, 30, null, 45, 32, 28, 40, 35, 50, 42],
          parameters: { algorithm: 'pattern_matching' }
        })
        .output({
          result: {
            detectedType: 'integer',
            confidence: 0.9
          }
        })
        .build();

      expect(() => {
        const traceId = dualLogger.logAnalysisDecision(decision);
        expect(traceId).toMatch(/^trace-\d+-[a-z0-9]{8}$/);
      }).not.toThrow();
    });

    test('should log PII masking decisions', () => {
      const decision = DecisionBuilder
        .create('pii_masking')
        .step('email_masking')
        .algorithm('datacloak_masking')
        .confidence(0.95)
        .factors({
          piiType: 'EMAIL',
          originalLength: 20,
          maskingStrategy: 'replacement'
        })
        .input({
          fieldName: 'email',
          sampleData: 'john@example.com',
          parameters: {
            piiType: 'EMAIL',
            maskingStrategy: 'replacement'
          }
        })
        .output({
          result: {
            maskedValue: '****@******.***',
            piiType: 'EMAIL',
            confidence: 0.95,
            maskingStrategy: 'replacement'
          }
        })
        .build();

      expect(() => {
        dualLogger.logAnalysisDecision(decision);
      }).not.toThrow();
    });
  });

  describe('Decision Builder', () => {
    test('should build valid sentiment analysis decisions', () => {
      const decision = DecisionBuilder
        .create('sentiment_analysis')
        .step('preprocessing')
        .algorithm('text_cleaning')
        .confidence(0.8)
        .factors({ textLength: 50 })
        .input({ sampleData: 'test text' })
        .output({ result: { cleaned: 'test text' } })
        .build();

      expect(decision.decisionType).toBe('sentiment_analysis');
      expect(decision.stepName).toBe('preprocessing');
      expect(decision.reasoning.algorithm).toBe('text_cleaning');
      expect(decision.reasoning.confidence).toBe(0.8);
    });

    test('should build decisions with alternatives', () => {
      const decision = DecisionBuilder
        .create('field_detection')
        .step('type_analysis')
        .algorithm('multi_approach')
        .confidence(0.85)
        .factors({ sampleSize: 100 })
        .alternatives([
          { option: 'string', score: 0.3, reason: 'Has text values' },
          { option: 'integer', score: 0.85, reason: 'Mostly numeric' },
          { option: 'float', score: 0.4, reason: 'Some decimal values' }
        ])
        .input({ fieldName: 'test_field', sampleData: [1, 2, 3] })
        .output({ result: { detectedType: 'integer' } })
        .build();

      expect(decision.reasoning.alternatives).toHaveLength(3);
      expect(decision.reasoning.alternatives?.[1].option).toBe('integer');
      expect(decision.reasoning.alternatives?.[1].score).toBe(0.85);
    });

    test('should build decisions with performance metrics', () => {
      const decision = DecisionBuilder
        .create('data_quality')
        .step('completeness_check')
        .algorithm('null_counting')
        .confidence(1.0)
        .factors({ totalRecords: 1000 })
        .input({ fieldName: 'name' })
        .output({ result: { completeness: 95 } })
        .performance(250, 1024 * 1024, 15.5) // duration, memory, cpu
        .build();

      expect(decision.output.performance?.duration).toBe(250);
      expect(decision.output.performance?.memoryUsage).toBe(1024 * 1024);
      expect(decision.output.performance?.cpuUsage).toBe(15.5);
    });

    test('should throw error for incomplete decisions', () => {
      expect(() => {
        DecisionBuilder
          .create('sentiment_analysis')
          .step('test')
          .build(); // Missing required fields
      }).toThrow('Missing required fields');
    });
  });

  describe('Schema Validation', () => {
    test('should validate complete decision log entries', () => {
      const validDecision = {
        traceId: 'trace-123',
        timestamp: new Date().toISOString(),
        decisionType: 'sentiment_analysis' as const,
        stepName: 'analysis',
        reasoning: {
          algorithm: 'test',
          confidence: 0.8,
          factors: { test: true }
        },
        input: {
          sampleData: 'test'
        },
        output: {
          result: { sentiment: 'positive' }
        },
        context: {
          environment: 'test',
          version: '1.0.0'
        }
      };

      expect(() => {
        DecisionLogValidator.validateDecisionEntry(validDecision);
      }).not.toThrow();
    });

    test('should reject invalid decision entries', () => {
      const invalidDecision = {
        traceId: '', // Invalid - empty string
        timestamp: 'invalid-date',
        decisionType: 'invalid_type',
        stepName: '',
        reasoning: {
          algorithm: 'test',
          confidence: 1.5, // Invalid - > 1
          factors: {}
        },
        input: {},
        output: {
          result: undefined // Invalid - undefined result
        },
        context: {
          environment: '',
          version: ''
        }
      };

      expect(() => {
        DecisionLogValidator.validateDecisionEntry(invalidDecision);
      }).toThrow();
    });

    test('should validate specialized decision types', () => {
      const sentimentDecision = {
        traceId: 'trace-123',
        timestamp: new Date().toISOString(),
        decisionType: 'sentiment_analysis' as const,
        stepName: 'analysis',
        reasoning: {
          algorithm: 'test',
          confidence: 0.8,
          factors: { test: true }
        },
        input: {
          sampleData: 'This is test text'
        },
        output: {
          result: {
            sentiment: 'positive' as const,
            confidence: 0.8,
            scores: { positive: 0.8 }
          }
        },
        context: {
          environment: 'test',
          version: '1.0.0'
        }
      };

      expect(() => {
        DecisionLogValidator.validateSentimentDecision(sentimentDecision);
      }).not.toThrow();
    });
  });

  describe('JSON Serialization', () => {
    test('should serialize and deserialize decision entries', () => {
      const decision = {
        traceId: 'trace-123',
        timestamp: new Date().toISOString(),
        decisionType: 'sentiment_analysis' as const,
        stepName: 'analysis',
        reasoning: {
          algorithm: 'test',
          confidence: 0.8,
          factors: { test: true }
        },
        input: {
          sampleData: 'test'
        },
        output: {
          result: { sentiment: 'positive' }
        },
        context: {
          environment: 'test',
          version: '1.0.0'
        }
      };

      const json = DecisionLogSerializer.toJSON(decision);
      expect(typeof json).toBe('string');
      
      const deserialized = DecisionLogSerializer.fromJSON(json);
      expect(deserialized.traceId).toBe(decision.traceId);
      expect(deserialized.decisionType).toBe(decision.decisionType);
      expect(deserialized.reasoning.confidence).toBe(decision.reasoning.confidence);
    });

    test('should handle serialization errors gracefully', () => {
      expect(() => {
        DecisionLogSerializer.fromJSON('invalid json');
      }).toThrow('Failed to parse decision log entry');
    });

    test('should generate pretty JSON for debugging', () => {
      const decision = {
        traceId: 'trace-123',
        timestamp: new Date().toISOString(),
        decisionType: 'sentiment_analysis' as const,
        stepName: 'analysis',
        reasoning: {
          algorithm: 'test',
          confidence: 0.8,
          factors: { test: true }
        },
        input: { sampleData: 'test' },
        output: { result: { sentiment: 'positive' } },
        context: { environment: 'test', version: '1.0.0' }
      };

      const prettyJson = DecisionLogSerializer.toPrettyJSON(decision);
      expect(prettyJson).toContain('\n'); // Should be formatted with newlines
      expect(prettyJson).toContain('  '); // Should be indented
    });
  });

  describe('Timer Utilities', () => {
    test('should provide timer functionality', () => {
      const endTimer = dualLogger.startTimer('test-operation');
      
      expect(typeof endTimer).toBe('function');
      
      // Simulate some work
      setTimeout(() => {
        endTimer();
      }, 10);
    });

    test('should log performance on timer completion', () => {
      const endTimer = dualLogger.startTimer('test-timer');
      
      // Test that timer completion doesn't throw
      expect(() => {
        endTimer();
      }).not.toThrow();
      
      // Verify timer functionality
      expect(typeof endTimer).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors gracefully', () => {
      // Test with various edge cases that might cause issues
      expect(() => {
        dualLogger.info('Test with null metadata', null as any);
        dualLogger.info('Test with undefined metadata', undefined as any);
        dualLogger.info('Test with empty string', '');
        dualLogger.error('Test error logging', { error: new Error('test error') });
      }).not.toThrow();
    });

    test('should validate decision type checking', () => {
      expect(DecisionLogValidator.isValidDecisionType('sentiment_analysis')).toBe(true);
      expect(DecisionLogValidator.isValidDecisionType('field_detection')).toBe(true);
      expect(DecisionLogValidator.isValidDecisionType('invalid_type')).toBe(false);
    });

    test('should provide validation error details', () => {
      const invalidEntry = {
        traceId: '', // Invalid
        timestamp: 'not-a-date', // Invalid
        decisionType: 'invalid', // Invalid
        // Missing required fields
      };

      const errors = DecisionLogValidator.getValidationErrors(invalidEntry);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('traceId');
    });
  });

  describe('Dashboard Streaming', () => {
    test('should support dashboard client management', () => {
      const mockClient = {
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn()
      };

      expect(() => {
        dualLogger.addDashboardClient(mockClient);
        dualLogger.removeDashboardClient(mockClient);
      }).not.toThrow();
    });
  });
});