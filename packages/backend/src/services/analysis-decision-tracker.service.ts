import { dualLogger, DecisionLogEntry, DecisionBuilder, DualLogger } from '../config/dual-logger';
import { v4 as uuidv4 } from 'uuid';
import { withSQLiteConnection } from '../database/sqlite-refactored';

export interface TraceContext {
  traceId: string;
  userId?: string;
  sessionId?: string;
  datasetId?: string;
  parentTraceId?: string;
  correlationId?: string;
  startTime: number;
}

export interface DecisionTrackingOptions {
  enablePerformanceTracking?: boolean;
  enableMemoryTracking?: boolean;
  enableCpuTracking?: boolean;
  logLevel?: 'verbose' | 'normal' | 'minimal';
}

export class AnalysisDecisionTracker {
  private activeTraces: Map<string, TraceContext> = new Map();
  private logger: DualLogger;
  private options: DecisionTrackingOptions;

  constructor(options: DecisionTrackingOptions = {}) {
    this.logger = dualLogger;
    this.options = {
      enablePerformanceTracking: true,
      enableMemoryTracking: false,
      enableCpuTracking: false,
      logLevel: 'normal',
      ...options
    };
  }

  /**
   * Start a new analysis trace
   */
  startTrace(context: Partial<TraceContext> = {}): string {
    const traceId = context.traceId || this.generateTraceId();
    
    const traceContext: TraceContext = {
      traceId,
      userId: context.userId,
      sessionId: context.sessionId,
      datasetId: context.datasetId,
      parentTraceId: context.parentTraceId,
      correlationId: context.correlationId || this.generateCorrelationId(),
      startTime: Date.now()
    };

    this.activeTraces.set(traceId, traceContext);
    
    if (this.options.logLevel !== 'minimal') {
      this.logger.info(`Analysis trace started`, {
        component: 'analysis-tracker',
        traceId,
        userId: context.userId,
        datasetId: context.datasetId,
        parentTraceId: context.parentTraceId
      });
    }

    return traceId;
  }

  /**
   * End an analysis trace
   */
  endTrace(traceId: string): void {
    const context = this.activeTraces.get(traceId);
    if (!context) {
      this.logger.warn(`Attempted to end non-existent trace: ${traceId}`, {
        component: 'analysis-tracker'
      });
      return;
    }

    const duration = Date.now() - context.startTime;
    
    if (this.options.logLevel !== 'minimal') {
      this.logger.performance(`Analysis trace completed`, context.startTime, {
        component: 'analysis-tracker',
        traceId,
        totalDuration: duration
      });
    }

    this.activeTraces.delete(traceId);
  }

  /**
   * Log a sentiment analysis decision
   */
  logSentimentDecision(
    traceId: string,
    stepName: string,
    options: {
      text: string;
      result: {
        sentiment: 'positive' | 'negative' | 'neutral';
        confidence: number;
        scores?: Record<string, number>;
      };
      algorithm: string;
      factors?: Record<string, any>;
      alternatives?: Array<{ option: string; score: number; reason: string }>;
      performance?: { duration: number; memoryUsage?: number };
    }
  ): void {
    const context = this.getTraceContext(traceId);
    
    const decision = DecisionBuilder
      .create('sentiment_analysis')
      .step(stepName)
      .algorithm(options.algorithm)
      .confidence(options.result.confidence)
      .factors(options.factors || {
        textLength: options.text.length,
        hasEmojis: /[\u{1F600}-\u{1F64F}]/u.test(options.text),
        hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(options.text),
        wordCount: options.text.split(' ').length
      })
      .alternatives(options.alternatives || [])
      .input({
        datasetId: context?.datasetId,
        sampleData: this.truncateForLogging(options.text),
        parameters: {
          algorithm: options.algorithm,
          context: this.getContextForLogging(context)
        }
      })
      .output({
        result: options.result,
        metadata: {
          confidence: options.result.confidence,
          sentiment: options.result.sentiment,
          scores: options.result.scores
        },
        performance: options.performance
      })
      .build();

    this.logger.logAnalysisDecision(decision, traceId);
  }

  /**
   * Log a field detection decision
   */
  logFieldDetectionDecision(
    traceId: string,
    stepName: string,
    options: {
      fieldName: string;
      sampleValues: any[];
      detectedType: string;
      confidence: number;
      algorithm: string;
      factors?: Record<string, any>;
      alternatives?: Array<{ option: string; score: number; reason: string }>;
      performance?: { duration: number; memoryUsage?: number };
    }
  ): void {
    const context = this.getTraceContext(traceId);
    
    const decision = DecisionBuilder
      .create('field_detection')
      .step(stepName)
      .algorithm(options.algorithm)
      .confidence(options.confidence)
      .factors(options.factors || {
        sampleSize: options.sampleValues.length,
        uniqueValues: new Set(options.sampleValues).size,
        nullCount: options.sampleValues.filter(v => v == null).length,
        avgLength: options.sampleValues.filter(v => v != null).reduce((acc, v) => acc + String(v).length, 0) / options.sampleValues.length
      })
      .alternatives(options.alternatives || [])
      .input({
        datasetId: context?.datasetId,
        fieldName: options.fieldName,
        sampleData: this.truncateArrayForLogging(options.sampleValues),
        parameters: {
          algorithm: options.algorithm,
          context: this.getContextForLogging(context)
        }
      })
      .output({
        result: {
          detectedType: options.detectedType,
          confidence: options.confidence
        },
        metadata: {
          fieldName: options.fieldName,
          detectedType: options.detectedType
        },
        performance: options.performance
      })
      .build();

    this.logger.logAnalysisDecision(decision, traceId);
  }

  /**
   * Log a PII masking decision
   */
  logPIIMaskingDecision(
    traceId: string,
    stepName: string,
    options: {
      fieldName: string;
      originalValue: string;
      maskedValue: string;
      piiType: string;
      confidence: number;
      algorithm: string;
      maskingStrategy: string;
      factors?: Record<string, any>;
      performance?: { duration: number; memoryUsage?: number };
    }
  ): void {
    const context = this.getTraceContext(traceId);
    
    const decision = DecisionBuilder
      .create('pii_masking')
      .step(stepName)
      .algorithm(options.algorithm)
      .confidence(options.confidence)
      .factors(options.factors || {
        piiType: options.piiType,
        originalLength: options.originalValue.length,
        maskedLength: options.maskedValue.length,
        maskingStrategy: options.maskingStrategy,
        preserveFormat: options.originalValue.length === options.maskedValue.length
      })
      .input({
        datasetId: context?.datasetId,
        fieldName: options.fieldName,
        sampleData: this.truncateForLogging(options.originalValue),
        parameters: {
          algorithm: options.algorithm,
          piiType: options.piiType,
          maskingStrategy: options.maskingStrategy,
          context: this.getContextForLogging(context)
        }
      })
      .output({
        result: {
          maskedValue: this.truncateForLogging(options.maskedValue),
          piiType: options.piiType,
          confidence: options.confidence,
          maskingStrategy: options.maskingStrategy
        },
        metadata: {
          fieldName: options.fieldName,
          piiType: options.piiType,
          preservedFormat: options.originalValue.length === options.maskedValue.length
        },
        performance: options.performance
      })
      .build();

    this.logger.logAnalysisDecision(decision, traceId);
  }

  /**
   * Log a data quality decision
   */
  logDataQualityDecision(
    traceId: string,
    stepName: string,
    options: {
      fieldName: string;
      qualityMetrics: {
        completeness: number;
        uniqueness: number;
        validity: number;
        consistency: number;
      };
      issues: string[];
      recommendations: string[];
      algorithm: string;
      confidence: number;
      performance?: { duration: number; memoryUsage?: number };
    }
  ): void {
    const context = this.getTraceContext(traceId);
    
    const decision = DecisionBuilder
      .create('data_quality')
      .step(stepName)
      .algorithm(options.algorithm)
      .confidence(options.confidence)
      .factors({
        completeness: options.qualityMetrics.completeness,
        uniqueness: options.qualityMetrics.uniqueness,
        validity: options.qualityMetrics.validity,
        consistency: options.qualityMetrics.consistency,
        issueCount: options.issues.length,
        overallScore: (options.qualityMetrics.completeness + options.qualityMetrics.uniqueness + 
                      options.qualityMetrics.validity + options.qualityMetrics.consistency) / 4
      })
      .input({
        datasetId: context?.datasetId,
        fieldName: options.fieldName,
        parameters: {
          algorithm: options.algorithm,
          context: this.getContextForLogging(context)
        }
      })
      .output({
        result: {
          qualityMetrics: options.qualityMetrics,
          issues: options.issues,
          recommendations: options.recommendations,
          overallScore: (options.qualityMetrics.completeness + options.qualityMetrics.uniqueness + 
                        options.qualityMetrics.validity + options.qualityMetrics.consistency) / 4
        },
        metadata: {
          fieldName: options.fieldName,
          issueCount: options.issues.length,
          recommendationCount: options.recommendations.length
        },
        performance: options.performance
      })
      .build();

    this.logger.logAnalysisDecision(decision, traceId);
  }

  /**
   * Log a security scan decision
   */
  logSecurityScanDecision(
    traceId: string,
    stepName: string,
    options: {
      scanType: string;
      findings: Array<{
        type: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        location?: string;
      }>;
      riskScore: number;
      algorithm: string;
      confidence: number;
      performance?: { duration: number; memoryUsage?: number };
    }
  ): void {
    const context = this.getTraceContext(traceId);
    
    const decision = DecisionBuilder
      .create('security_scan')
      .step(stepName)
      .algorithm(options.algorithm)
      .confidence(options.confidence)
      .factors({
        scanType: options.scanType,
        findingCount: options.findings.length,
        criticalFindings: options.findings.filter(f => f.severity === 'critical').length,
        highFindings: options.findings.filter(f => f.severity === 'high').length,
        mediumFindings: options.findings.filter(f => f.severity === 'medium').length,
        lowFindings: options.findings.filter(f => f.severity === 'low').length,
        riskScore: options.riskScore
      })
      .input({
        datasetId: context?.datasetId,
        parameters: {
          algorithm: options.algorithm,
          scanType: options.scanType,
          context: this.getContextForLogging(context)
        }
      })
      .output({
        result: {
          findings: options.findings,
          riskScore: options.riskScore,
          riskLevel: this.getRiskLevel(options.riskScore)
        },
        metadata: {
          scanType: options.scanType,
          findingCount: options.findings.length,
          riskLevel: this.getRiskLevel(options.riskScore)
        },
        performance: options.performance
      })
      .build();

    this.logger.logAnalysisDecision(decision, traceId);
  }

  /**
   * Create a logger instance bound to a specific trace
   */
  getTracedLogger(traceId: string): DualLogger {
    return this.logger.withTraceId(traceId);
  }

  /**
   * Get performance metrics for a trace
   */
  getTracePerformance(traceId: string): { duration: number; active: boolean } | null {
    const context = this.activeTraces.get(traceId);
    if (!context) return null;
    
    return {
      duration: Date.now() - context.startTime,
      active: true
    };
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): string[] {
    return Array.from(this.activeTraces.keys());
  }

  /**
   * Store decision summary in database for reporting
   */
  async storeDecisionSummary(traceId: string, summary: {
    decisionType: string;
    stepCount: number;
    averageConfidence: number;
    totalDuration: number;
    datasetId?: string;
  }): Promise<void> {
    try {
      await withSQLiteConnection(async (db) => {
        const stmt = db.prepare(`
          INSERT INTO analysis_decision_summaries 
          (trace_id, decision_type, step_count, average_confidence, total_duration, dataset_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(
          traceId,
          summary.decisionType,
          summary.stepCount,
          summary.averageConfidence,
          summary.totalDuration,
          summary.datasetId || null
        );
      });
    } catch (error) {
      this.logger.error('Failed to store decision summary', {
        component: 'analysis-tracker',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Private helper methods
  private generateTraceId(): string {
    return `trace-${Date.now()}-${uuidv4().substring(0, 8)}`;
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTraceContext(traceId: string): TraceContext | undefined {
    return this.activeTraces.get(traceId);
  }

  private getContextForLogging(context?: TraceContext) {
    if (!context) return {};
    
    return {
      userId: context.userId,
      sessionId: context.sessionId,
      datasetId: context.datasetId,
      parentTraceId: context.parentTraceId,
      correlationId: context.correlationId
    };
  }

  private truncateForLogging(text: string, maxLength: number = 200): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private truncateArrayForLogging(arr: any[], maxItems: number = 5): any[] {
    if (arr.length <= maxItems) return arr;
    return arr.slice(0, maxItems);
  }

  private getRiskLevel(score: number): string {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
}

// Create singleton instance
export const analysisDecisionTracker = new AnalysisDecisionTracker();

// Export for testing and custom instances
export default AnalysisDecisionTracker;