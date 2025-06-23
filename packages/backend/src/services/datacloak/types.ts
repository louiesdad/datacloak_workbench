/**
 * Unified DataCloak Types and Interfaces
 * 
 * This file consolidates all DataCloak-related type definitions to eliminate
 * duplication and interface inconsistencies across services.
 */

// Core configuration interface
export interface DataCloakConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  // Production features
  redosProtection?: boolean;
  emailValidation?: 'regex' | 'validator' | 'hybrid';
  creditCardValidation?: 'basic' | 'luhn' | 'full';
  enableMonitoring?: boolean;
  performanceMode?: 'fast' | 'accurate' | 'balanced';
  maxTextLength?: number;
  regexTimeout?: number;
  // Additional configuration options
  enableCircuitBreaker?: boolean;
  fallbackToMock?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  batchSize?: number;
  maxConcurrentRequests?: number;
}

// Unified PII Detection Result interface
export interface PIIDetectionResult {
  fieldName: string;
  piiType: string;
  confidence: number;
  sample: string;
  masked: string;
  // Position information (optional)
  position?: {
    start: number;
    end: number;
  };
  // Pattern information (optional)
  pattern?: string;
  // Risk level
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

// Masking result interface
export interface MaskingResult {
  originalText: string;
  maskedText: string;
  detectedPII: PIIDetectionResult[];
  metadata: MaskingMetadata;
}

// Masking metadata
export interface MaskingMetadata {
  processingTime: number;
  fieldsProcessed: number;
  piiItemsFound: number;
  circuitBreakerOpen?: boolean;
  fallbackUsed?: boolean;
  riskScore?: number;
  processingMode?: 'fast' | 'accurate' | 'balanced';
  version?: string;
}

// Stream processing options
export interface StreamProcessingOptions {
  chunkSize?: number;
  delimiter?: string;
  preserveLineBreaks?: boolean;
  skipEmptyLines?: boolean;
  progressCallback?: (processed: number, total: number) => void;
  errorCallback?: (error: Error, chunk?: string) => void;
}

// Audit result interface
export interface SecurityAuditResult {
  timestamp: Date;
  fileProcessed: string;
  piiItemsDetected: number;
  maskingAccuracy: number;
  encryptionStatus: 'enabled' | 'disabled' | 'partial';
  complianceScore: number;
  violations: SecurityViolation[];
  recommendations: string[];
  riskAssessment: RiskAssessment;
}

// Security violation interface
export interface SecurityViolation {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  field?: string;
  suggestion: string;
}

// Risk assessment interface
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  score: number; // 0-100
  mitigationSuggestions: string[];
}

// Risk factor interface
export interface RiskFactor {
  type: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  weight: number; // 0-1
}

// DataCloak Bridge Interface (standardized)
export interface DataCloakBridge {
  initialize(config: DataCloakConfig): Promise<void>;
  detectPII(text: string): Promise<PIIDetectionResult[]>;
  maskText(text: string): Promise<MaskingResult>;
  auditSecurity(filePath: string): Promise<SecurityAuditResult>;
  isAvailable(): boolean;
  getVersion(): string;
  // Additional methods for enhanced functionality
  batchProcessPII?(texts: string[]): Promise<PIIDetectionResult[][]>;
  streamProcessPII?(stream: NodeJS.ReadableStream, options?: StreamProcessingOptions): Promise<AsyncIterableIterator<PIIDetectionResult[]>>;
  validateConfiguration?(): Promise<boolean>;
  getHealthStatus?(): Promise<HealthStatus>;
}

// Health status interface
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  lastCheck: Date;
  services: {
    ffi: boolean;
    binary: boolean;
    mock: boolean;
  };
  performance: {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
}

// Service operation result
export interface ServiceOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: {
    executionTime: number;
    retryCount: number;
    fallbackUsed: boolean;
    circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  };
}

// Standardized service error
export interface ServiceError {
  code: string;
  message: string;
  type: 'configuration' | 'network' | 'processing' | 'validation' | 'system';
  retryable: boolean;
  details?: Record<string, any>;
}

// Batch processing result
export interface BatchProcessingResult {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  results: PIIDetectionResult[][];
  errors: Array<{
    index: number;
    error: ServiceError;
  }>;
  executionTime: number;
}

// File processing result
export interface FileProcessingResult {
  fileName: string;
  totalLines: number;
  processedLines: number;
  skippedLines: number;
  detectedPII: PIIDetectionResult[];
  processingTime: number;
  errors: Array<{
    line: number;
    error: string;
  }>;
}

// Service state interface
export interface ServiceState {
  initialized: boolean;
  healthy: boolean;
  lastError?: ServiceError;
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
}

// Error codes enum
export enum DataCloakErrorCodes {
  // Configuration errors
  CONFIG_INVALID = 'DATACLOAK_CONFIG_INVALID',
  CONFIG_MISSING = 'DATACLOAK_CONFIG_MISSING',
  
  // Initialization errors
  INIT_FAILED = 'DATACLOAK_INIT_FAILED',
  BRIDGE_NOT_AVAILABLE = 'DATACLOAK_BRIDGE_NOT_AVAILABLE',
  
  // Processing errors
  PII_DETECTION_FAILED = 'DATACLOAK_PII_DETECTION_FAILED',
  TEXT_MASKING_FAILED = 'DATACLOAK_TEXT_MASKING_FAILED',
  BATCH_PROCESSING_FAILED = 'DATACLOAK_BATCH_PROCESSING_FAILED',
  STREAM_PROCESSING_FAILED = 'DATACLOAK_STREAM_PROCESSING_FAILED',
  
  // File errors
  FILE_NOT_FOUND = 'DATACLOAK_FILE_NOT_FOUND',
  FILE_READ_ERROR = 'DATACLOAK_FILE_READ_ERROR',
  FILE_PROCESSING_ERROR = 'DATACLOAK_FILE_PROCESSING_ERROR',
  
  // Network/API errors
  NETWORK_ERROR = 'DATACLOAK_NETWORK_ERROR',
  TIMEOUT_ERROR = 'DATACLOAK_TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'DATACLOAK_RATE_LIMIT_ERROR',
  
  // System errors
  OUT_OF_MEMORY = 'DATACLOAK_OUT_OF_MEMORY',
  SYSTEM_ERROR = 'DATACLOAK_SYSTEM_ERROR',
  CIRCUIT_BREAKER_OPEN = 'DATACLOAK_CIRCUIT_BREAKER_OPEN'
}

// Default configuration
export const DEFAULT_DATACLOAK_CONFIG: DataCloakConfig = {
  timeout: 30000,
  retryAttempts: 3,
  redosProtection: true,
  emailValidation: 'validator',
  creditCardValidation: 'luhn',
  enableMonitoring: false,
  performanceMode: 'balanced',
  maxTextLength: 100000,
  regexTimeout: 1000,
  enableCircuitBreaker: true,
  fallbackToMock: true,
  logLevel: 'info',
  batchSize: 100,
  maxConcurrentRequests: 10
};

// Type guards
export function isPIIDetectionResult(obj: any): obj is PIIDetectionResult {
  return obj && 
    typeof obj.fieldName === 'string' &&
    typeof obj.piiType === 'string' &&
    typeof obj.confidence === 'number' &&
    typeof obj.sample === 'string' &&
    typeof obj.masked === 'string';
}

export function isMaskingResult(obj: any): obj is MaskingResult {
  return obj &&
    typeof obj.originalText === 'string' &&
    typeof obj.maskedText === 'string' &&
    Array.isArray(obj.detectedPII) &&
    obj.metadata &&
    typeof obj.metadata.processingTime === 'number';
}

export function isServiceError(obj: any): obj is ServiceError {
  return obj &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.retryable === 'boolean';
}

// Multi-field interfaces for extended functionality
export interface FieldInput {
  fieldName: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface FieldMaskingResult {
  fieldName: string;
  originalText: string;
  maskedText: string;
  piiItemsFound: number;
  metadata?: Record<string, any>;
  success?: boolean;
  error?: ServiceError;
}

export interface FieldMaskingOptions {
  batchSize?: number;
  parallel?: boolean;
  continueOnError?: boolean;
}

// Progressive Processing interfaces
export interface ProgressiveProcessingResult {
  rowsProcessed: number;
  totalRows: number;
  isComplete: boolean;
  results: FieldMaskingResult[];
  previewType?: 'quick' | 'statistical' | 'full';
  processingTime?: number;
  errors?: Array<{ index: number; fieldName: string; error: any }>;
  totalProcessed?: number;
  successfulRows?: number;
  status?: 'processing' | 'completed' | 'cancelled';
}

export interface StatisticalSampleResult extends ProgressiveProcessingResult {
  sampleSize: number;
  confidenceLevel: number;
  marginOfError: number;
  isStatisticallyValid: boolean;
}

export interface ProcessingOptions {
  mode?: 'quick' | 'balanced' | 'thorough';
  continueOnError?: boolean;
  stratifyBy?: string;
}

export interface ProgressUpdate {
  processedRows: number;
  totalRows: number;
  percentage: number;
  currentBatch?: number;
  estimatedTimeRemaining?: number;
}

export interface PartialResults {
  results: FieldMaskingResult[];
  status: 'processing' | 'completed' | 'cancelled';
  processedCount: number;
}