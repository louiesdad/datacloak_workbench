/**
 * Shared Test Fixtures - API Responses
 * 
 * Mock API response data for testing HTTP endpoints across all packages
 */

import { 
  ApiResponse, 
  ErrorResponse, 
  HealthStatusResponse, 
  ReadinessResponse,
  UploadDataResponse,
  GetDatasetsResponse,
  SentimentAnalysisResponse,
  BatchSentimentResponse
} from '../contracts/api';
import { SAMPLE_SMALL_DATASET, SAMPLE_LARGE_DATASET } from './datasets';
import { POSITIVE_SENTIMENT_RESULT, SAMPLE_BATCH_RESULTS } from './sentiment';

// =============================================================================
// Success Response Fixtures
// =============================================================================

export const SUCCESS_API_RESPONSE: ApiResponse<string> = {
  success: true,
  data: 'Operation completed successfully',
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_HEALTH_RESPONSE: HealthStatusResponse = {
  success: true,
  data: {
    status: 'healthy',
    timestamp: '2024-01-14T10:00:00Z',
    services: {
      api: 'operational',
      database: {
        sqlite: 'connected',
        duckdb: 'connected'
      }
    }
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_READINESS_RESPONSE: ReadinessResponse = {
  success: true,
  data: {
    ready: true,
    timestamp: '2024-01-14T10:00:00Z'
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_UPLOAD_RESPONSE: UploadDataResponse = {
  success: true,
  data: SAMPLE_SMALL_DATASET,
  message: 'File uploaded and processed successfully',
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_DATASETS_RESPONSE: GetDatasetsResponse = {
  success: true,
  data: [SAMPLE_SMALL_DATASET, SAMPLE_LARGE_DATASET],
  pagination: {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 1
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_SENTIMENT_RESPONSE: SentimentAnalysisResponse = {
  success: true,
  data: POSITIVE_SENTIMENT_RESULT,
  timestamp: '2024-01-14T10:00:00Z'
};

export const SUCCESS_BATCH_SENTIMENT_RESPONSE: BatchSentimentResponse = {
  success: true,
  data: SAMPLE_BATCH_RESULTS,
  summary: {
    total: 5,
    processed: 5,
    failed: 0,
    averageScore: 0.35,
    distribution: {
      positive: 2,
      negative: 1,
      neutral: 2
    }
  },
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Error Response Fixtures
// =============================================================================

export const GENERIC_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Internal server error',
  message: 'An unexpected error occurred',
  timestamp: '2024-01-14T10:00:00Z'
};

export const VALIDATION_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Validation failed',
  details: {
    field: 'email',
    message: 'Invalid email format'
  },
  code: 'VALIDATION_ERROR',
  timestamp: '2024-01-14T10:00:00Z'
};

export const NOT_FOUND_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Resource not found',
  message: 'The requested dataset was not found',
  code: 'NOT_FOUND',
  timestamp: '2024-01-14T10:00:00Z'
};

export const UNAUTHORIZED_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Unauthorized access',
  message: 'Authentication required',
  code: 'UNAUTHORIZED',
  timestamp: '2024-01-14T10:00:00Z'
};

export const FORBIDDEN_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Forbidden',
  message: 'Insufficient permissions',
  code: 'FORBIDDEN',
  timestamp: '2024-01-14T10:00:00Z'
};

export const RATE_LIMIT_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Rate limit exceeded',
  message: 'Too many requests. Please try again later',
  code: 'RATE_LIMIT_EXCEEDED',
  details: {
    limit: 100,
    window: '1 hour',
    retryAfter: 3600
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const FILE_TOO_LARGE_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'File too large',
  message: 'File exceeds maximum size limit of 50GB',
  code: 'FILE_TOO_LARGE',
  details: {
    maxSize: 53687091200, // 50GB in bytes
    actualSize: 54760833024 // 51GB in bytes
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const UNSUPPORTED_FILE_TYPE_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Unsupported file type',
  message: 'Only CSV and Excel files are supported',
  code: 'UNSUPPORTED_FILE_TYPE',
  details: {
    supportedTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    actualType: 'application/pdf'
  },
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Degraded Service Response Fixtures
// =============================================================================

export const DEGRADED_HEALTH_RESPONSE: HealthStatusResponse = {
  success: true,
  data: {
    status: 'degraded',
    timestamp: '2024-01-14T10:00:00Z',
    services: {
      api: 'operational',
      database: {
        sqlite: 'connected',
        duckdb: 'disconnected'
      }
    }
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const NOT_READY_RESPONSE: ReadinessResponse = {
  success: false,
  data: {
    ready: false,
    timestamp: '2024-01-14T10:00:00Z'
  },
  error: 'Database connections not ready',
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Partial Success Response Fixtures
// =============================================================================

export const PARTIAL_BATCH_SENTIMENT_RESPONSE: BatchSentimentResponse = {
  success: true,
  data: SAMPLE_BATCH_RESULTS.slice(0, 3), // Only 3 out of 5 processed
  summary: {
    total: 5,
    processed: 3,
    failed: 2,
    averageScore: 0.28,
    distribution: {
      positive: 1,
      negative: 1,
      neutral: 1
    }
  },
  message: 'Batch processing completed with some failures',
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Timeout and Network Error Fixtures
// =============================================================================

export const TIMEOUT_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Request timeout',
  message: 'The request took too long to complete',
  code: 'TIMEOUT',
  details: {
    timeoutMs: 30000,
    actualMs: 30001
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const NETWORK_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Network error',
  message: 'Unable to connect to the server',
  code: 'NETWORK_ERROR',
  timestamp: '2024-01-14T10:00:00Z'
};

export const SERVICE_UNAVAILABLE_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Service unavailable',
  message: 'The service is temporarily unavailable',
  code: 'SERVICE_UNAVAILABLE',
  details: {
    retryAfter: 300 // 5 minutes
  },
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Database Error Fixtures
// =============================================================================

export const DATABASE_CONNECTION_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Database connection failed',
  message: 'Unable to connect to the database',
  code: 'DATABASE_ERROR',
  details: {
    database: 'sqlite',
    errorCode: 'ECONNREFUSED'
  },
  timestamp: '2024-01-14T10:00:00Z'
};

export const DATABASE_QUERY_ERROR_RESPONSE: ErrorResponse = {
  success: false,
  error: 'Database query failed',
  message: 'Error executing database query',
  code: 'QUERY_ERROR',
  details: {
    query: 'SELECT * FROM datasets WHERE id = ?',
    sqlError: 'Table \'datasets\' doesn\'t exist'
  },
  timestamp: '2024-01-14T10:00:00Z'
};

// =============================================================================
// Response Collections
// =============================================================================

export const SUCCESS_RESPONSES = {
  generic: SUCCESS_API_RESPONSE,
  health: SUCCESS_HEALTH_RESPONSE,
  readiness: SUCCESS_READINESS_RESPONSE,
  upload: SUCCESS_UPLOAD_RESPONSE,
  datasets: SUCCESS_DATASETS_RESPONSE,
  sentiment: SUCCESS_SENTIMENT_RESPONSE,
  batchSentiment: SUCCESS_BATCH_SENTIMENT_RESPONSE
};

export const ERROR_RESPONSES = {
  generic: GENERIC_ERROR_RESPONSE,
  validation: VALIDATION_ERROR_RESPONSE,
  notFound: NOT_FOUND_ERROR_RESPONSE,
  unauthorized: UNAUTHORIZED_ERROR_RESPONSE,
  forbidden: FORBIDDEN_ERROR_RESPONSE,
  rateLimit: RATE_LIMIT_ERROR_RESPONSE,
  fileTooLarge: FILE_TOO_LARGE_ERROR_RESPONSE,
  unsupportedFileType: UNSUPPORTED_FILE_TYPE_ERROR_RESPONSE,
  timeout: TIMEOUT_ERROR_RESPONSE,
  network: NETWORK_ERROR_RESPONSE,
  serviceUnavailable: SERVICE_UNAVAILABLE_ERROR_RESPONSE,
  databaseConnection: DATABASE_CONNECTION_ERROR_RESPONSE,
  databaseQuery: DATABASE_QUERY_ERROR_RESPONSE
};

export const DEGRADED_RESPONSES = {
  health: DEGRADED_HEALTH_RESPONSE,
  notReady: NOT_READY_RESPONSE,
  partialBatch: PARTIAL_BATCH_SENTIMENT_RESPONSE
};

// =============================================================================
// Response Status Code Mappings
// =============================================================================

export const HTTP_STATUS_FIXTURES = {
  200: SUCCESS_RESPONSES,
  400: {
    validation: VALIDATION_ERROR_RESPONSE,
    fileTooLarge: FILE_TOO_LARGE_ERROR_RESPONSE,
    unsupportedFileType: UNSUPPORTED_FILE_TYPE_ERROR_RESPONSE
  },
  401: {
    unauthorized: UNAUTHORIZED_ERROR_RESPONSE
  },
  403: {
    forbidden: FORBIDDEN_ERROR_RESPONSE
  },
  404: {
    notFound: NOT_FOUND_ERROR_RESPONSE
  },
  429: {
    rateLimit: RATE_LIMIT_ERROR_RESPONSE
  },
  500: {
    generic: GENERIC_ERROR_RESPONSE,
    database: DATABASE_CONNECTION_ERROR_RESPONSE
  },
  503: {
    serviceUnavailable: SERVICE_UNAVAILABLE_ERROR_RESPONSE
  },
  504: {
    timeout: TIMEOUT_ERROR_RESPONSE
  }
};

// =============================================================================
// Test Scenarios
// =============================================================================

export const API_TEST_SCENARIOS = {
  successFlow: {
    upload: SUCCESS_UPLOAD_RESPONSE,
    analyze: SUCCESS_SENTIMENT_RESPONSE,
    retrieve: SUCCESS_DATASETS_RESPONSE
  },
  errorFlow: {
    invalidFile: UNSUPPORTED_FILE_TYPE_ERROR_RESPONSE,
    unauthorized: UNAUTHORIZED_ERROR_RESPONSE,
    serverError: GENERIC_ERROR_RESPONSE
  },
  degradedFlow: {
    partialService: DEGRADED_HEALTH_RESPONSE,
    partialResults: PARTIAL_BATCH_SENTIMENT_RESPONSE
  }
};