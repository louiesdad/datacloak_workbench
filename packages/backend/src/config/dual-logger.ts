import winston from 'winston';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Dual-purpose logger configuration for technical and analysis audit logging
const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Decision Log Schema Interface
export interface DecisionLogEntry {
  traceId: string;
  timestamp: string;
  decisionType: 'sentiment_analysis' | 'field_detection' | 'pii_masking' | 'data_quality' | 'security_scan';
  stepName: string;
  reasoning: {
    algorithm: string;
    confidence: number;
    factors: Record<string, any>;
    alternatives?: Array<{
      option: string;
      score: number;
      reason: string;
    }>;
  };
  input: {
    datasetId?: string;
    fieldName?: string;
    sampleData?: any;
    parameters?: Record<string, any>;
  };
  output: {
    result: any;
    metadata?: Record<string, any>;
    performance?: {
      duration: number;
      memoryUsage?: number;
      cpuUsage?: number;
    };
  };
  context: {
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    environment: string;
    version: string;
  };
}

// Analysis Audit Report Interface
export interface AnalysisAuditReport {
  reportId: string;
  generatedAt: string;
  timeRange: {
    startTime: string;
    endTime: string;
  };
  summary: {
    totalDecisions: number;
    decisionsByType: Record<string, number>;
    averageConfidence: number;
    totalDatasets: number;
    totalFields: number;
    piiDetectionRate: number;
  };
  performance: {
    averageDecisionTime: number;
    slowestDecisions: Array<{
      traceId: string;
      stepName: string;
      duration: number;
    }>;
    memoryUsageTrends: Array<{
      timestamp: string;
      usage: number;
    }>;
  };
  qualityMetrics: {
    lowConfidenceDecisions: Array<{
      traceId: string;
      decisionType: string;
      confidence: number;
      reasoning: string;
    }>;
    inconsistentDecisions: Array<{
      pattern: string;
      occurrences: number;
      examples: string[];
    }>;
  };
  recommendations: string[];
}

// Custom formats for different log types
const technicalFormat = winston.format.printf(({ level, message, timestamp, stack, duration, component, correlationId, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]`;
  
  if (correlationId) {
    log += ` [${correlationId}]`;
  }
  
  if (component) {
    log += ` [${component}]`;
  }
  
  log += `: ${message}`;
  
  if (duration !== undefined) {
    log += ` (${duration}ms)`;
  }
  
  if (stack) {
    log += `\n${stack}`;
  }
  
  const metaKeys = Object.keys(meta).filter(key => 
    !['service', 'component', 'correlationId', 'timestamp', 'level', 'message', 'traceId'].includes(key)
  );
  
  if (metaKeys.length > 0) {
    const metaStr = metaKeys.map(key => `${key}=${JSON.stringify(meta[key])}`).join(' ');
    log += ` | ${metaStr}`;
  }
  
  return log;
});

const analysisAuditFormat = winston.format.printf(({ timestamp, traceId, decisionType, stepName, reasoning, input, output, context }) => {
  const auditEntry: DecisionLogEntry = {
    traceId,
    timestamp,
    decisionType,
    stepName,
    reasoning,
    input,
    output,
    context
  };
  
  return JSON.stringify(auditEntry, null, 0); // Compact JSON for file storage
});

// Create separate transport arrays for different purposes
const technicalTransports: winston.transport[] = [
  // Console for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ all: true }),
      technicalFormat
    )
  })
];

const analysisAuditTransports: winston.transport[] = [];

// Add file transports for production or when enabled
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Technical logs
  technicalTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'technical.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 5
    })
  );
  
  // Analysis audit logs - separate file for decision tracking
  analysisAuditTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'analysis-audit.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        analysisAuditFormat
      ),
      maxsize: 100 * 1024 * 1024, // 100MB for audit logs
      maxFiles: 10
    })
  );
}

// Admin dashboard stream transport (for real-time monitoring)
class DashboardStreamTransport extends winston.Transport {
  private dashboardClients: Set<any> = new Set();
  
  constructor(options?: winston.TransportStreamOptions) {
    super(options);
  }
  
  log(info: any, callback: () => void) {
    // Emit to connected dashboard clients
    this.dashboardClients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(info)}\n\n`);
      } catch (error) {
        // Remove disconnected clients
        this.dashboardClients.delete(client);
      }
    });
    
    callback();
  }
  
  addDashboardClient(client: any) {
    this.dashboardClients.add(client);
  }
  
  removeDashboardClient(client: any) {
    this.dashboardClients.delete(client);
  }
}

const dashboardStream = new DashboardStreamTransport();

// Create separate loggers
const technicalLogger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: { 
    service: 'datacloak-backend',
    logType: 'technical',
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown'
  },
  transports: [...technicalTransports, dashboardStream]
});

const analysisAuditLogger = winston.createLogger({
  level: 'info', // Always log analysis decisions
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { 
    service: 'datacloak-backend',
    logType: 'analysis-audit',
    nodeEnv: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown'
  },
  transports: analysisAuditTransports
});

// Enhanced DualLogger interface
export interface DualLogger {
  // Technical logging methods
  info: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  
  // Component-specific technical logging
  performance: (message: string, startTime: number, meta?: any) => void;
  database: (message: string, meta?: any) => void;
  redis: (message: string, meta?: any) => void;
  queue: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  api: (message: string, meta?: any) => void;
  
  // Analysis decision logging
  logAnalysisDecision: (decision: Omit<DecisionLogEntry, 'traceId' | 'timestamp' | 'context'>, traceId?: string) => string;
  
  // Trace ID management
  generateTraceId: () => string;
  withTraceId: (traceId: string) => DualLogger;
  
  // Dashboard streaming
  addDashboardClient: (client: any) => void;
  removeDashboardClient: (client: any) => void;
  
  // Timer utilities
  startTimer: (label: string) => () => void;
}

// Implementation of DualLogger
class DualLoggerImpl implements DualLogger {
  private currentTraceId?: string;
  private currentCorrelationId?: string;
  
  constructor(traceId?: string, correlationId?: string) {
    this.currentTraceId = traceId;
    this.currentCorrelationId = correlationId;
  }
  
  private getTechnicalMeta(meta: any = {}) {
    return {
      ...meta,
      traceId: this.currentTraceId,
      correlationId: this.currentCorrelationId
    };
  }
  
  info(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta(meta));
  }
  
  warn(message: string, meta: any = {}) {
    technicalLogger.warn(message, this.getTechnicalMeta(meta));
  }
  
  error(message: string, meta: any = {}) {
    technicalLogger.error(message, this.getTechnicalMeta(meta));
  }
  
  debug(message: string, meta: any = {}) {
    technicalLogger.debug(message, this.getTechnicalMeta(meta));
  }
  
  performance(message: string, startTime: number, meta: any = {}) {
    const duration = Date.now() - startTime;
    technicalLogger.info(message, this.getTechnicalMeta({
      component: 'performance',
      duration,
      ...meta
    }));
  }
  
  database(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta({ component: 'database', ...meta }));
  }
  
  redis(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta({ component: 'redis', ...meta }));
  }
  
  queue(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta({ component: 'queue', ...meta }));
  }
  
  security(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta({ component: 'security', ...meta }));
  }
  
  api(message: string, meta: any = {}) {
    technicalLogger.info(message, this.getTechnicalMeta({ component: 'api', ...meta }));
  }
  
  logAnalysisDecision(
    decision: Omit<DecisionLogEntry, 'traceId' | 'timestamp' | 'context'>, 
    traceId?: string
  ): string {
    const finalTraceId = traceId || this.currentTraceId || this.generateTraceId();
    
    const fullDecision: DecisionLogEntry = {
      ...decision,
      traceId: finalTraceId,
      timestamp: new Date().toISOString(),
      context: {
        userId: undefined, // Will be set by calling code if available
        sessionId: undefined, // Will be set by calling code if available
        correlationId: this.currentCorrelationId,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || 'unknown',
        ...decision.input?.parameters?.context
      }
    };
    
    // Log to analysis audit logger
    analysisAuditLogger.info('Analysis decision recorded', fullDecision);
    
    // Also log summary to technical logger for visibility
    technicalLogger.info(`Analysis decision: ${decision.decisionType}:${decision.stepName}`, {
      component: 'analysis',
      traceId: finalTraceId,
      confidence: decision.reasoning.confidence,
      algorithm: decision.reasoning.algorithm,
      duration: decision.output.performance?.duration
    });
    
    return finalTraceId;
  }
  
  generateTraceId(): string {
    return `trace-${Date.now()}-${uuidv4().substring(0, 8)}`;
  }
  
  withTraceId(traceId: string): DualLogger {
    return new DualLoggerImpl(traceId, this.currentCorrelationId);
  }
  
  addDashboardClient(client: any) {
    dashboardStream.addDashboardClient(client);
  }
  
  removeDashboardClient(client: any) {
    dashboardStream.removeDashboardClient(client);
  }
  
  startTimer(label: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.performance(`${label} completed`, startTime, { label, duration });
    };
  }
}

// Create the main dual logger instance
export const dualLogger: DualLogger = new DualLoggerImpl();

// Utility functions for correlation and trace tracking
export const withCorrelationId = (correlationId: string): DualLogger => {
  return new DualLoggerImpl(undefined, correlationId);
};

export const withTraceId = (traceId: string): DualLogger => {
  return new DualLoggerImpl(traceId);
};

export const withBothIds = (traceId: string, correlationId: string): DualLogger => {
  return new DualLoggerImpl(traceId, correlationId);
};

export const generateCorrelationId = (): string => {
  return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Export decision builder utilities
export class DecisionBuilder {
  private decision: Partial<DecisionLogEntry> = {};
  
  static create(decisionType: DecisionLogEntry['decisionType']): DecisionBuilder {
    const builder = new DecisionBuilder();
    builder.decision.decisionType = decisionType;
    return builder;
  }
  
  step(stepName: string): DecisionBuilder {
    this.decision.stepName = stepName;
    return this;
  }
  
  algorithm(algorithm: string): DecisionBuilder {
    if (!this.decision.reasoning) this.decision.reasoning = {} as any;
    this.decision.reasoning.algorithm = algorithm;
    return this;
  }
  
  confidence(confidence: number): DecisionBuilder {
    if (!this.decision.reasoning) this.decision.reasoning = {} as any;
    this.decision.reasoning.confidence = confidence;
    return this;
  }
  
  factors(factors: Record<string, any>): DecisionBuilder {
    if (!this.decision.reasoning) this.decision.reasoning = {} as any;
    this.decision.reasoning.factors = factors;
    return this;
  }
  
  alternatives(alternatives: Array<{ option: string; score: number; reason: string }>): DecisionBuilder {
    if (!this.decision.reasoning) this.decision.reasoning = {} as any;
    this.decision.reasoning.alternatives = alternatives;
    return this;
  }
  
  input(input: DecisionLogEntry['input']): DecisionBuilder {
    this.decision.input = input;
    return this;
  }
  
  output(output: DecisionLogEntry['output']): DecisionBuilder {
    this.decision.output = output;
    return this;
  }
  
  performance(duration: number, memoryUsage?: number, cpuUsage?: number): DecisionBuilder {
    if (!this.decision.output) this.decision.output = { result: null };
    this.decision.output.performance = { duration, memoryUsage, cpuUsage };
    return this;
  }
  
  build(): Omit<DecisionLogEntry, 'traceId' | 'timestamp' | 'context'> {
    if (!this.decision.decisionType || !this.decision.stepName || !this.decision.reasoning || !this.decision.input || !this.decision.output) {
      throw new Error('DecisionBuilder: Missing required fields (decisionType, stepName, reasoning, input, output)');
    }
    
    return this.decision as Omit<DecisionLogEntry, 'traceId' | 'timestamp' | 'context'>;
  }
}

// Export default for backwards compatibility
export default dualLogger;