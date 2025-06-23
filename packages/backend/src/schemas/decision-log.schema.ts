import { z } from 'zod';

// Base schemas for decision logging
export const DecisionTypeSchema = z.enum([
  'sentiment_analysis',
  'field_detection', 
  'pii_masking',
  'data_quality',
  'security_scan'
]);

export const ReasoningAlternativeSchema = z.object({
  option: z.string().min(1, 'Option must not be empty'),
  score: z.number().min(0).max(1, 'Score must be between 0 and 1'),
  reason: z.string().min(1, 'Reason must not be empty')
});

export const ReasoningSchema = z.object({
  algorithm: z.string().min(1, 'Algorithm must be specified'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  factors: z.record(z.any()).refine(
    (factors) => Object.keys(factors).length > 0,
    'At least one factor must be provided'
  ),
  alternatives: z.array(ReasoningAlternativeSchema).optional()
});

export const PerformanceMetricsSchema = z.object({
  duration: z.number().min(0, 'Duration must be non-negative'),
  memoryUsage: z.number().min(0, 'Memory usage must be non-negative').optional(),
  cpuUsage: z.number().min(0).max(100, 'CPU usage must be between 0 and 100').optional()
});

export const InputSchema = z.object({
  datasetId: z.string().uuid().optional(),
  fieldName: z.string().optional(),
  sampleData: z.any().optional(),
  parameters: z.record(z.any()).optional()
});

export const OutputSchema = z.object({
  result: z.any().refine(
    (result) => result !== undefined,
    'Result must be defined'
  ),
  metadata: z.record(z.any()).optional(),
  performance: PerformanceMetricsSchema.optional()
});

export const ContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  correlationId: z.string().optional(),
  environment: z.string().min(1, 'Environment must be specified'),
  version: z.string().min(1, 'Version must be specified')
});

// Main decision log entry schema
export const DecisionLogEntrySchema = z.object({
  traceId: z.string().min(1, 'Trace ID must not be empty'),
  timestamp: z.string().datetime('Invalid timestamp format'),
  decisionType: DecisionTypeSchema,
  stepName: z.string().min(1, 'Step name must not be empty'),
  reasoning: ReasoningSchema,
  input: InputSchema,
  output: OutputSchema,
  context: ContextSchema
});

// Specialized schemas for different decision types
export const SentimentAnalysisDecisionSchema = DecisionLogEntrySchema.extend({
  decisionType: z.literal('sentiment_analysis'),
  input: InputSchema.extend({
    sampleData: z.string().min(1, 'Sample text must not be empty')
  }),
  output: OutputSchema.extend({
    result: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
      scores: z.record(z.number()).optional()
    })
  })
});

export const FieldDetectionDecisionSchema = DecisionLogEntrySchema.extend({
  decisionType: z.literal('field_detection'),
  input: InputSchema.extend({
    fieldName: z.string().min(1, 'Field name is required'),
    sampleData: z.array(z.any()).min(1, 'Sample data must not be empty')
  }),
  output: OutputSchema.extend({
    result: z.object({
      detectedType: z.string().min(1, 'Detected type must not be empty'),
      confidence: z.number().min(0).max(1)
    })
  })
});

export const PIIMaskingDecisionSchema = DecisionLogEntrySchema.extend({
  decisionType: z.literal('pii_masking'),
  input: InputSchema.extend({
    fieldName: z.string().min(1, 'Field name is required'),
    sampleData: z.string().min(1, 'Original value must not be empty'),
    parameters: z.object({
      piiType: z.string().min(1, 'PII type is required'),
      maskingStrategy: z.string().min(1, 'Masking strategy is required')
    }).passthrough()
  }),
  output: OutputSchema.extend({
    result: z.object({
      maskedValue: z.string(),
      piiType: z.string().min(1),
      confidence: z.number().min(0).max(1),
      maskingStrategy: z.string().min(1)
    })
  })
});

export const DataQualityDecisionSchema = DecisionLogEntrySchema.extend({
  decisionType: z.literal('data_quality'),
  input: InputSchema.extend({
    fieldName: z.string().min(1, 'Field name is required')
  }),
  output: OutputSchema.extend({
    result: z.object({
      qualityMetrics: z.object({
        completeness: z.number().min(0).max(100),
        uniqueness: z.number().min(0).max(100),
        validity: z.number().min(0).max(100),
        consistency: z.number().min(0).max(100)
      }),
      issues: z.array(z.string()),
      recommendations: z.array(z.string()),
      overallScore: z.number().min(0).max(100)
    })
  })
});

export const SecurityScanDecisionSchema = DecisionLogEntrySchema.extend({
  decisionType: z.literal('security_scan'),
  output: OutputSchema.extend({
    result: z.object({
      findings: z.array(z.object({
        type: z.string().min(1),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        description: z.string().min(1),
        location: z.string().optional()
      })),
      riskScore: z.number().min(0).max(1),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical'])
    })
  })
});

// Analysis audit report schemas
export const TimeRangeSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime()
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  'End time must be after start time'
);

export const ReportSummarySchema = z.object({
  totalDecisions: z.number().min(0),
  decisionsByType: z.record(z.number().min(0)),
  averageConfidence: z.number().min(0).max(1),
  totalDatasets: z.number().min(0),
  totalFields: z.number().min(0),
  piiDetectionRate: z.number().min(0).max(1)
});

export const PerformanceReportSchema = z.object({
  averageDecisionTime: z.number().min(0),
  slowestDecisions: z.array(z.object({
    traceId: z.string(),
    stepName: z.string(),
    duration: z.number().min(0)
  })).max(10, 'Maximum 10 slowest decisions'),
  memoryUsageTrends: z.array(z.object({
    timestamp: z.string().datetime(),
    usage: z.number().min(0)
  }))
});

export const QualityMetricsReportSchema = z.object({
  lowConfidenceDecisions: z.array(z.object({
    traceId: z.string(),
    decisionType: DecisionTypeSchema,
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
  })),
  inconsistentDecisions: z.array(z.object({
    pattern: z.string().min(1),
    occurrences: z.number().min(1),
    examples: z.array(z.string()).max(5, 'Maximum 5 examples')
  }))
});

export const AnalysisAuditReportSchema = z.object({
  reportId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  timeRange: TimeRangeSchema,
  summary: ReportSummarySchema,
  performance: PerformanceReportSchema,
  qualityMetrics: QualityMetricsReportSchema,
  recommendations: z.array(z.string().min(1)).max(20, 'Maximum 20 recommendations')
});

// Type exports (inferred from schemas)
export type DecisionType = z.infer<typeof DecisionTypeSchema>;
export type ReasoningAlternative = z.infer<typeof ReasoningAlternativeSchema>;
export type Reasoning = z.infer<typeof ReasoningSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type DecisionInput = z.infer<typeof InputSchema>;
export type DecisionOutput = z.infer<typeof OutputSchema>;
export type DecisionContext = z.infer<typeof ContextSchema>;
export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;
export type SentimentAnalysisDecision = z.infer<typeof SentimentAnalysisDecisionSchema>;
export type FieldDetectionDecision = z.infer<typeof FieldDetectionDecisionSchema>;
export type PIIMaskingDecision = z.infer<typeof PIIMaskingDecisionSchema>;
export type DataQualityDecision = z.infer<typeof DataQualityDecisionSchema>;
export type SecurityScanDecision = z.infer<typeof SecurityScanDecisionSchema>;
export type TimeRange = z.infer<typeof TimeRangeSchema>;
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type PerformanceReport = z.infer<typeof PerformanceReportSchema>;
export type QualityMetricsReport = z.infer<typeof QualityMetricsReportSchema>;
export type AnalysisAuditReport = z.infer<typeof AnalysisAuditReportSchema>;

// Validation utilities
export class DecisionLogValidator {
  static validateDecisionEntry(entry: unknown): DecisionLogEntry {
    return DecisionLogEntrySchema.parse(entry);
  }

  static validateSentimentDecision(entry: unknown): SentimentAnalysisDecision {
    return SentimentAnalysisDecisionSchema.parse(entry);
  }

  static validateFieldDetectionDecision(entry: unknown): FieldDetectionDecision {
    return FieldDetectionDecisionSchema.parse(entry);
  }

  static validatePIIMaskingDecision(entry: unknown): PIIMaskingDecision {
    return PIIMaskingDecisionSchema.parse(entry);
  }

  static validateDataQualityDecision(entry: unknown): DataQualityDecision {
    return DataQualityDecisionSchema.parse(entry);
  }

  static validateSecurityScanDecision(entry: unknown): SecurityScanDecision {
    return SecurityScanDecisionSchema.parse(entry);
  }

  static validateAuditReport(report: unknown): AnalysisAuditReport {
    return AnalysisAuditReportSchema.parse(report);
  }

  static isValidDecisionType(type: string): type is DecisionType {
    return DecisionTypeSchema.safeParse(type).success;
  }

  static getValidationErrors(entry: unknown): string[] {
    const result = DecisionLogEntrySchema.safeParse(entry);
    if (result.success) return [];
    
    return result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
  }
}

// JSON serialization utilities
export class DecisionLogSerializer {
  static toJSON(entry: DecisionLogEntry): string {
    return JSON.stringify(entry, null, 0); // Compact format for storage
  }

  static fromJSON(json: string): DecisionLogEntry {
    try {
      const parsed = JSON.parse(json);
      return DecisionLogValidator.validateDecisionEntry(parsed);
    } catch (error) {
      throw new Error(`Failed to parse decision log entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static toPrettyJSON(entry: DecisionLogEntry): string {
    return JSON.stringify(entry, null, 2); // Pretty format for debugging
  }

  static reportToJSON(report: AnalysisAuditReport): string {
    return JSON.stringify(report, null, 2);
  }

  static reportFromJSON(json: string): AnalysisAuditReport {
    try {
      const parsed = JSON.parse(json);
      return DecisionLogValidator.validateAuditReport(parsed);
    } catch (error) {
      throw new Error(`Failed to parse audit report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Default export for convenience
export default {
  schemas: {
    DecisionLogEntrySchema,
    SentimentAnalysisDecisionSchema,
    FieldDetectionDecisionSchema,
    PIIMaskingDecisionSchema,
    DataQualityDecisionSchema,
    SecurityScanDecisionSchema,
    AnalysisAuditReportSchema
  },
  validator: DecisionLogValidator,
  serializer: DecisionLogSerializer
};