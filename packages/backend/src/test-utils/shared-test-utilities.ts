/**
 * Shared Test Utilities
 * 
 * Common patterns, mocks, and utilities used across the test suite.
 * This helps reduce code duplication and ensures consistent testing patterns.
 */

import { jest } from '@jest/globals';

// Common mock request patterns
export const createMockRequest = (options: {
  body?: any;
  params?: any;
  query?: any;
  headers?: any;
  user?: any;
} = {}) => ({
  body: options.body || {},
  params: options.params || {},
  query: options.query || {},
  headers: options.headers || {},
  user: options.user || null,
  ...options
});

// Common mock response patterns
export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.locals = {};
  return res;
};

// Common mock next function
export const createMockNext = () => jest.fn();

// Mock Express Request with File Upload
export const createMockRequestWithFile = (fileOptions: {
  filename?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
} = {}) => ({
  ...createMockRequest(),
  file: {
    fieldname: 'file',
    originalname: fileOptions.filename || 'test.csv',
    encoding: '7bit',
    mimetype: fileOptions.mimetype || 'text/csv',
    size: fileOptions.size || 1024,
    buffer: fileOptions.buffer || Buffer.from('test,data\n1,2\n'),
    destination: '/tmp',
    filename: fileOptions.filename || 'test.csv',
    path: `/tmp/${fileOptions.filename || 'test.csv'}`,
    stream: null as any,
  }
});

// Common database mock responses
export const mockDatabaseResponse = {
  dataset: {
    id: 'test-dataset-id',
    name: 'test-dataset',
    filename: 'test.csv',
    originalFilename: 'test.csv',
    size: 1024,
    recordCount: 2,
    mimeType: 'text/csv',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  sentimentAnalysis: {
    id: 'test-sentiment-id',
    text: 'This is a test',
    sentiment: 'positive' as const,
    confidence: 0.95,
    model: 'openai-gpt-3.5',
    timestamp: '2024-01-01T00:00:00Z'
  },
  jobStatus: {
    id: 'test-job-id',
    type: 'sentiment_analysis',
    status: 'completed' as const,
    progress: 100,
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:01:00Z'
  }
};

// Common service mock factories
export const createMockDataService = (): any => ({
  uploadDataset: jest.fn().mockResolvedValue(mockDatabaseResponse.dataset),
  getDatasets: jest.fn().mockResolvedValue({
    data: [mockDatabaseResponse.dataset],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    }
  }),
  getDatasetById: jest.fn().mockResolvedValue(mockDatabaseResponse.dataset),
  deleteDataset: jest.fn().mockResolvedValue(undefined),
  exportData: jest.fn().mockResolvedValue({
    exportId: 'test-export-id',
    downloadUrl: '/api/exports/test-export-id',
    format: 'csv',
    estimatedSize: '1.2MB'
  })
});

export const createMockSentimentService = (): any => ({
  analyzeSentiment: jest.fn().mockResolvedValue(mockDatabaseResponse.sentimentAnalysis),
  batchAnalyzeSentiment: jest.fn().mockResolvedValue([mockDatabaseResponse.sentimentAnalysis]),
  getSentimentHistory: jest.fn().mockResolvedValue({
    data: [mockDatabaseResponse.sentimentAnalysis],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1
    }
  }),
  getSentimentStatistics: jest.fn().mockResolvedValue({
    total: 100,
    positive: 60,
    negative: 20,
    neutral: 20,
    averageConfidence: 0.85
  })
});

export const createMockCacheService = (): any => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  flush: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    hits: 100,
    misses: 20,
    hitRate: 0.83,
    size: 50
  })
});

export const createMockJobQueueService = (): any => ({
  addJob: jest.fn().mockResolvedValue('test-job-id'),
  getJob: jest.fn().mockResolvedValue(mockDatabaseResponse.jobStatus),
  getJobs: jest.fn().mockResolvedValue([mockDatabaseResponse.jobStatus]),
  cancelJob: jest.fn().mockResolvedValue(true),
  retryJob: jest.fn().mockResolvedValue('test-retry-job-id'),
  getStats: jest.fn().mockResolvedValue({
    waiting: 5,
    active: 2,
    completed: 100,
    failed: 3
  })
});

export const createMockSecurityService = (): any => ({
  scanForPII: jest.fn().mockResolvedValue({
    hasPII: false,
    detected: []
  }),
  maskSensitiveData: jest.fn().mockResolvedValue({
    maskedText: '*** REDACTED ***',
    detectedTypes: ['email']
  }),
  auditSecurity: jest.fn().mockResolvedValue({
    securityScore: 85,
    vulnerabilities: [],
    recommendations: []
  }),
  detectPII: jest.fn().mockResolvedValue([])
});

// Common validation helpers
export const expectValidationError = (response: any, fieldName?: string) => {
  expect(response.status).toHaveBeenCalledWith(400);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: expect.stringContaining('validation'),
    })
  );
  if (fieldName) {
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining(fieldName),
      })
    );
  }
};

export const expectSuccessResponse = (response: any, data?: any) => {
  expect(response.status).toHaveBeenCalledWith(expect.any(Number));
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      data: data || expect.any(Object),
    })
  );
};

export const expectErrorResponse = (response: any, statusCode: number, errorMessage?: string) => {
  expect(response.status).toHaveBeenCalledWith(statusCode);
  expect(response.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: errorMessage || expect.any(String),
    })
  );
};

// Database test utilities
export const createTestDatabase = async () => {
  // Mock database connection for tests
  return {
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn().mockReturnValue([]),
    }),
    close: jest.fn(),
  };
};

// File upload test utilities
export const createTestFile = (options: {
  content?: string;
  filename?: string;
  mimetype?: string;
} = {}) => {
  const content = options.content || 'test,data\n1,2\n3,4\n';
  const filename = options.filename || 'test.csv';
  const mimetype = options.mimetype || 'text/csv';
  
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
    destination: '/tmp',
    filename,
    path: `/tmp/${filename}`,
    stream: null as any,
  };
};

// Common error patterns for testing
export const testErrorScenarios = {
  networkError: new Error('Network Error'),
  timeoutError: new Error('Request timeout'),
  authError: new Error('Unauthorized'),
  validationError: new Error('Validation failed'),
  databaseError: new Error('Database connection failed'),
  serviceUnavailableError: new Error('Service temporarily unavailable')
};

// WebSocket mock utilities
export const createMockWebSocket = () => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// SSE mock utilities
export const createMockEventSource = () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
});

// Async test utilities
export const waitForAsync = (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAsyncGenerator = async function* (items: any[]) {
  for (const item of items) {
    yield item;
  }
};

// Test data generators
export const generateTestSentimentData = (count: number = 10) => {
  const sentiments = ['positive', 'negative', 'neutral'] as const;
  return Array.from({ length: count }, (_, i) => ({
    id: `test-sentiment-${i}`,
    text: `Test text ${i}`,
    sentiment: sentiments[i % 3],
    confidence: 0.8 + Math.random() * 0.2,
    model: 'openai-gpt-3.5',
    timestamp: new Date(Date.now() - i * 1000 * 60 * 60).toISOString()
  }));
};

export const generateTestDatasets = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-dataset-${i}`,
    name: `Test Dataset ${i}`,
    filename: `test-${i}.csv`,
    originalFilename: `test-${i}.csv`,
    size: 1024 * (i + 1),
    recordCount: 100 * (i + 1),
    mimeType: 'text/csv',
    createdAt: new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - i * 1000 * 60 * 60 * 12).toISOString()
  }));
};

// Common test constants
export const TEST_CONSTANTS = {
  DEFAULT_TIMEOUT: 5000,
  LONG_TIMEOUT: 30000,
  DEFAULT_PAGE_SIZE: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FILE_TYPES: ['text/csv', 'application/json', 'text/plain'],
  TEST_USER_ID: 'test-user-123',
  TEST_API_KEY: 'test-api-key-123',
} as const;

// Export all utilities as a default object for easier importing
export default {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockRequestWithFile,
  mockDatabaseResponse,
  createMockDataService,
  createMockSentimentService,
  createMockCacheService,
  createMockJobQueueService,
  createMockSecurityService,
  expectValidationError,
  expectSuccessResponse,
  expectErrorResponse,
  createTestDatabase,
  createTestFile,
  testErrorScenarios,
  createMockWebSocket,
  createMockEventSource,
  waitForAsync,
  mockAsyncGenerator,
  generateTestSentimentData,
  generateTestDatasets,
  TEST_CONSTANTS
};