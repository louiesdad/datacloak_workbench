// Centralized API type definitions for consistency across client and server

export interface ApiClientOptions {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  apiKey?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  expiresIn: number;
}

// Unified Dataset interface that works for both API client and data service
export interface Dataset {
  id: string;
  name: string; // Display name (can be derived from filename)
  filename?: string; // Original filename
  originalFilename?: string; // Backup of original filename
  size?: number; // File size in bytes
  rowCount?: number; // Number of records
  recordCount?: number; // Alias for rowCount for backward compatibility
  columns?: string[]; // Column names
  mimeType?: string; // File MIME type
  createdAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

// Internal database Dataset interface (for data service)
export interface DatabaseDataset {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  recordCount: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface UploadResult {
  id: string;
  name: string;
  rowCount: number;
  status: string;
  createdAt: string;
}

export interface ExportRequest {
  format: 'csv' | 'json' | 'xlsx';
  datasetId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  sentimentFilter?: 'positive' | 'negative' | 'neutral';
}

export interface ExportResult {
  exportId: string;
  downloadUrl: string;
  format: string;
  estimatedSize?: string;
}

export interface SentimentAnalysisRequest {
  text: string;
  model?: string;
  options?: {
    includeConfidence?: boolean;
    language?: string;
  };
}

export interface SentimentAnalysisResult {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  model: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalDatasets: number;
  totalAnalyses: number;
  averageSentiment: number;
  recentActivity: Array<{
    type: string;
    timestamp: string;
    description: string;
  }>;
}

export interface JobStatus {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    api: string;
    database: {
      sqlite: string;
      duckdb: string;
    };
  };
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

// Success response wrapper
export interface SuccessResponse<T> {
  data: T;
  message?: string;
}

// Error response wrapper
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

// Request/Response type helpers
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
export type PaginatedApiResponse<T> = SuccessResponse<PaginatedResponse<T>> | ErrorResponse;