/**
 * DataCloak Sentiment Workbench - API Contracts
 * 
 * Shared TypeScript interfaces and types for all API endpoints
 * Used across frontend, backend, and testing packages
 */

// =============================================================================
// Base Types
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: string;
  details?: Record<string, any>;
  code?: string;
}

// =============================================================================
// Health & Status Contracts
// =============================================================================

export interface HealthStatusResponse extends ApiResponse {
  data: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    services: {
      api: 'operational' | 'degraded' | 'down';
      database: DatabaseStatus;
    };
  };
}

export interface ReadinessResponse extends ApiResponse {
  data: {
    ready: boolean;
    timestamp: string;
  };
}

export interface DatabaseStatus {
  sqlite: 'connected' | 'disconnected' | 'error';
  duckdb: 'connected' | 'disconnected' | 'error';
}

// =============================================================================
// Data Management Contracts
// =============================================================================

export interface Dataset {
  id: string;
  name: string;
  filename: string;
  size: number;
  rowCount: number;
  columnCount: number;
  uploadedAt: string;
  lastModified: string;
  fileType: 'csv' | 'excel' | 'xlsx' | 'txt';
  status: 'processing' | 'ready' | 'error';
  metadata?: DatasetMetadata;
}

export interface DatasetMetadata {
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
  columns: ColumnInfo[];
  preview: Record<string, any>[];
  statistics?: DatasetStatistics;
}

export interface ColumnInfo {
  name: string;
  type: FieldType;
  confidence: number;
  nullable: boolean;
  unique: boolean;
  hasPII: boolean;
  piiTypes: PIIType[];
  statistics?: ColumnStatistics;
}

export interface ColumnStatistics {
  count: number;
  nullCount: number;
  uniqueCount: number;
  min?: string | number;
  max?: string | number;
  avg?: number;
  median?: number;
  mode?: string | number;
  standardDeviation?: number;
}

export interface DatasetStatistics {
  totalRows: number;
  totalColumns: number;
  memoryUsage: number;
  processingTime: number;
  piiFieldsCount: number;
  dataQualityScore: number;
}

export type FieldType = 
  | 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'time'
  | 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'url' | 'uuid'
  | 'postal_code' | 'currency' | 'percentage' | 'json' | 'unknown';

export type PIIType = 
  | 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address' 
  | 'date_of_birth' | 'passport' | 'driver_license' | 'bank_account'
  | 'ip_address' | 'mac_address' | 'custom';

// Upload endpoints
export interface UploadDataRequest {
  file: File; // FormData file
}

export interface UploadDataResponse extends ApiResponse<Dataset> {}

export interface GetDatasetsResponse extends PaginatedResponse<Dataset> {}

export interface GetDatasetByIdResponse extends ApiResponse<Dataset> {}

export interface DeleteDatasetResponse extends ApiResponse {
  data: { id: string; deleted: boolean };
}

export interface ExportDataRequest {
  datasetId: string;
  format: 'csv' | 'excel' | 'json';
  includeHeaders?: boolean;
  columns?: string[];
  filters?: DataFilter[];
  transforms?: DataTransform[];
}

export interface ExportDataResponse extends ApiResponse {
  data: {
    downloadUrl: string;
    filename: string;
    size: number;
    expiresAt: string;
  };
}

export interface DataFilter {
  column: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn';
  value: any;
}

export interface DataTransform {
  type: 'mask' | 'encrypt' | 'hash' | 'remove' | 'replace' | 'format';
  column: string;
  parameters?: Record<string, any>;
}

// =============================================================================
// Sentiment Analysis Contracts
// =============================================================================

export interface SentimentAnalysisRequest {
  text: string;
  options?: SentimentOptions;
}

export interface SentimentOptions {
  includeKeywords?: boolean;
  includeEmotions?: boolean;
  language?: string;
  model?: 'basic' | 'advanced' | 'openai';
}

export interface SentimentResult {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  score: number; // -1 to 1 scale
  keywords?: string[];
  emotions?: EmotionScores;
  processingTime: number;
  createdAt: string;
}

export interface EmotionScores {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
}

export interface SentimentAnalysisResponse extends ApiResponse<SentimentResult> {}

export interface BatchSentimentRequest {
  texts: string[];
  options?: SentimentOptions;
}

export interface BatchSentimentResponse extends ApiResponse<SentimentResult[]> {
  data: SentimentResult[];
  summary: {
    total: number;
    processed: number;
    failed: number;
    averageScore: number;
    distribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
}

export interface SentimentHistoryResponse extends PaginatedResponse<SentimentResult> {}

export interface SentimentStatistics {
  totalAnalyses: number;
  todayAnalyses: number;
  averageScore: number;
  distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  trendsLast7Days: Array<{
    date: string;
    count: number;
    averageScore: number;
  }>;
  topKeywords: Array<{
    keyword: string;
    frequency: number;
    averageScore: number;
  }>;
}

export interface SentimentStatisticsResponse extends ApiResponse<SentimentStatistics> {}

// =============================================================================
// Field Inference Contracts (Data Science Integration)
// =============================================================================

export interface FieldInferenceRequest {
  datasetId: string;
  sampleSize?: number;
  useGPTAssist?: boolean;
  confidenceThreshold?: number;
}

export interface FieldInferenceResult {
  datasetId: string;
  fields: InferredField[];
  statistics: InferenceStatistics;
  recommendations: InferenceRecommendation[];
}

export interface InferredField {
  name: string;
  type: FieldType;
  confidence: number;
  piiDetected: boolean;
  piiTypes: PIIType[];
  patterns: string[];
  sampleValues: any[];
  statistics: FieldStatistics;
}

export interface FieldStatistics {
  count: number;
  nullCount: number;
  uniqueCount: number;
  nullRate: number;
  uniqueRate: number;
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  commonPatterns: Array<{
    pattern: string;
    frequency: number;
  }>;
}

export interface InferenceStatistics {
  totalFields: number;
  highConfidenceFields: number;
  lowConfidenceFields: number;
  piiFieldsDetected: number;
  processingTime: number;
  accuracyScore: number;
}

export interface InferenceRecommendation {
  type: 'type_change' | 'pii_masking' | 'data_quality' | 'performance';
  field?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  action?: string;
}

export interface FieldInferenceResponse extends ApiResponse<FieldInferenceResult> {}

// =============================================================================
// Cost Estimation Contracts
// =============================================================================

export interface CostEstimationRequest {
  operation: 'sentiment_analysis' | 'field_inference' | 'data_masking';
  parameters: {
    textCount?: number;
    avgTextLength?: number;
    datasetSize?: number;
    rowCount?: number;
    columnCount?: number;
    model?: string;
    provider?: 'openai' | 'anthropic';
  };
}

export interface CostEstimation {
  operation: string;
  estimatedCost: number;
  currency: string;
  breakdown: {
    tokens: number;
    requests: number;
    processingTime: number;
    unitCost: number;
  };
  alternatives?: Array<{
    provider: string;
    model: string;
    cost: number;
    features: string[];
  }>;
}

export interface CostEstimationResponse extends ApiResponse<CostEstimation> {}

// =============================================================================
// Security & Privacy Contracts
// =============================================================================

export interface SecurityAuditRequest {
  datasetId: string;
  auditLevel: 'basic' | 'thorough' | 'comprehensive';
  includeRecommendations?: boolean;
}

export interface SecurityAuditResult {
  datasetId: string;
  auditLevel: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: SecurityFinding[];
  recommendations: SecurityRecommendation[];
  compliance: ComplianceStatus;
  summary: AuditSummary;
}

export interface SecurityFinding {
  id: string;
  type: 'pii_exposure' | 'data_quality' | 'access_control' | 'encryption' | 'retention';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field?: string;
  description: string;
  riskScore: number;
  affectedRows?: number;
}

export interface SecurityRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'masking' | 'encryption' | 'access' | 'retention' | 'monitoring';
  action: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  compliance?: string[];
}

export interface ComplianceStatus {
  gdpr: 'compliant' | 'partial' | 'non_compliant';
  ccpa: 'compliant' | 'partial' | 'non_compliant';
  hipaa: 'compliant' | 'partial' | 'non_compliant';
  pci: 'compliant' | 'partial' | 'non_compliant';
  sox: 'compliant' | 'partial' | 'non_compliant';
}

export interface AuditSummary {
  totalFindings: number;
  criticalFindings: number;
  piiFieldsFound: number;
  dataQualityIssues: number;
  recommendedActions: number;
  estimatedRemediationTime: number;
}

export interface SecurityAuditResponse extends ApiResponse<SecurityAuditResult> {}

// =============================================================================
// Real-time & Streaming Contracts
// =============================================================================

export interface StreamingResponse {
  type: 'progress' | 'data' | 'error' | 'complete';
  timestamp: string;
  data?: any;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    eta?: number;
  };
  error?: string;
}

export interface JobStatus {
  id: string;
  type: 'upload' | 'analysis' | 'export' | 'inference' | 'audit';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: string;
  completedAt?: string;
  result?: any;
  error?: string;
}

export interface JobStatusResponse extends ApiResponse<JobStatus> {}

// =============================================================================
// Utility Types
// =============================================================================

export type ApiEndpoint = 
  | '/api/v1/health/status'
  | '/api/v1/health/ready'
  | '/api/v1/data/upload'
  | '/api/v1/data/datasets'
  | '/api/v1/data/datasets/:id'
  | '/api/v1/data/export'
  | '/api/v1/sentiment/analyze'
  | '/api/v1/sentiment/batch'
  | '/api/v1/sentiment/history'
  | '/api/v1/sentiment/statistics';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiRequestConfig {
  method: HttpMethod;
  endpoint: ApiEndpoint;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}

// =============================================================================
// Frontend-Specific Types
// =============================================================================

export interface UIState {
  loading: boolean;
  error?: string;
  data?: any;
}

export interface TableColumn {
  key: string;
  title: string;
  type: FieldType;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
}

export interface TableData {
  columns: TableColumn[];
  rows: Record<string, any>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// =============================================================================
// Validation Schemas (for shared validation logic)
// =============================================================================

export interface ValidationRule {
  field: string;
  type: 'required' | 'string' | 'number' | 'email' | 'url' | 'date' | 'custom';
  message?: string;
  min?: number;
  max?: number;
  pattern?: string;
  custom?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}