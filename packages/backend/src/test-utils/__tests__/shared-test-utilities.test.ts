/**
 * Test for Shared Test Utilities
 * 
 * Verifies that our shared test utilities work correctly and provide
 * consistent mock patterns across the test suite.
 */

import { jest } from '@jest/globals';
import sharedTestUtils, {
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockRequestWithFile,
  createMockDataService,
  createMockSentimentService,
  expectValidationError,
  expectSuccessResponse,
  expectErrorResponse,
  createTestFile,
  generateTestSentimentData,
  generateTestDatasets,
  TEST_CONSTANTS
} from '../shared-test-utilities';

describe('Shared Test Utilities', () => {
  describe('Mock Request/Response Creation', () => {
    it('should create a mock request with default values', () => {
      const mockReq = createMockRequest();
      
      expect(mockReq).toHaveProperty('body', {});
      expect(mockReq).toHaveProperty('params', {});
      expect(mockReq).toHaveProperty('query', {});
      expect(mockReq).toHaveProperty('headers', {});
      expect(mockReq).toHaveProperty('user', null);
    });

    it('should create a mock request with custom values', () => {
      const mockReq = createMockRequest({
        body: { name: 'test' },
        params: { id: '123' },
        query: { page: '1' },
        headers: { 'content-type': 'application/json' },
        user: { id: 'user123' }
      });
      
      expect(mockReq.body).toEqual({ name: 'test' });
      expect(mockReq.params).toEqual({ id: '123' });
      expect(mockReq.query).toEqual({ page: '1' });
      expect(mockReq.headers).toEqual({ 'content-type': 'application/json' });
      expect(mockReq.user).toEqual({ id: 'user123' });
    });

    it('should create a mock response with chainable methods', () => {
      const mockRes = createMockResponse();
      
      expect(mockRes.status).toBeDefined();
      expect(mockRes.json).toBeDefined();
      expect(mockRes.send).toBeDefined();
      expect(mockRes.set).toBeDefined();
      expect(mockRes.cookie).toBeDefined();
      expect(mockRes.redirect).toBeDefined();
      
      // Test chainable behavior
      const result = mockRes.status(200).json({ success: true });
      expect(result).toBe(mockRes);
    });

    it('should create a mock next function', () => {
      const mockNext = createMockNext();
      
      expect(typeof mockNext).toBe('function');
      expect(jest.isMockFunction(mockNext)).toBe(true);
    });
  });

  describe('File Upload Mocks', () => {
    it('should create a mock request with file upload', () => {
      const mockReq = createMockRequestWithFile({
        filename: 'test.csv',
        mimetype: 'text/csv',
        size: 1024
      });
      
      expect(mockReq.file).toBeDefined();
      expect(mockReq.file!.originalname).toBe('test.csv');
      expect(mockReq.file!.mimetype).toBe('text/csv');
      expect(mockReq.file!.size).toBe(1024);
      expect(mockReq.file!.buffer).toBeInstanceOf(Buffer);
    });

    it('should create a test file with custom content', () => {
      const testFile = createTestFile({
        content: 'name,value\ntest,123\n',
        filename: 'data.csv',
        mimetype: 'text/csv'
      });
      
      expect(testFile.originalname).toBe('data.csv');
      expect(testFile.mimetype).toBe('text/csv');
      expect(testFile.buffer.toString()).toBe('name,value\ntest,123\n');
    });
  });

  describe('Service Mocks', () => {
    it('should create a data service mock with all methods', () => {
      const mockDataService = createMockDataService();
      
      expect(mockDataService.uploadDataset).toBeDefined();
      expect(mockDataService.getDatasets).toBeDefined();
      expect(mockDataService.getDatasetById).toBeDefined();
      expect(mockDataService.deleteDataset).toBeDefined();
      expect(mockDataService.exportData).toBeDefined();
      
      expect(jest.isMockFunction(mockDataService.uploadDataset)).toBe(true);
    });

    it('should create a sentiment service mock with all methods', () => {
      const mockSentimentService = createMockSentimentService();
      
      expect(mockSentimentService.analyzeSentiment).toBeDefined();
      expect(mockSentimentService.batchAnalyzeSentiment).toBeDefined();
      expect(mockSentimentService.getSentimentHistory).toBeDefined();
      expect(mockSentimentService.getSentimentStatistics).toBeDefined();
      
      expect(jest.isMockFunction(mockSentimentService.analyzeSentiment)).toBe(true);
    });
  });

  describe('Response Validation Helpers', () => {
    it('should validate error responses correctly', () => {
      const mockRes = createMockResponse();
      mockRes.status(400);
      mockRes.json({ error: 'validation failed for field name' });
      
      expectValidationError(mockRes, 'name');
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('validation')
        })
      );
    });

    it('should validate success responses correctly', () => {
      const mockRes = createMockResponse();
      const testData = { id: '123', name: 'test' };
      mockRes.status(200);
      mockRes.json({ data: testData });
      
      expectSuccessResponse(mockRes, testData);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: testData
        })
      );
    });

    it('should validate error responses with specific status and message', () => {
      const mockRes = createMockResponse();
      mockRes.status(404);
      mockRes.json({ error: 'Resource not found' });
      
      expectErrorResponse(mockRes, 404, 'Resource not found');
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Resource not found'
        })
      );
    });
  });

  describe('Test Data Generators', () => {
    it('should generate test sentiment data', () => {
      const sentimentData = generateTestSentimentData(5);
      
      expect(sentimentData).toHaveLength(5);
      expect(sentimentData[0]).toHaveProperty('id');
      expect(sentimentData[0]).toHaveProperty('text');
      expect(sentimentData[0]).toHaveProperty('sentiment');
      expect(sentimentData[0]).toHaveProperty('confidence');
      expect(sentimentData[0]).toHaveProperty('model');
      expect(sentimentData[0]).toHaveProperty('timestamp');
      
      expect(['positive', 'negative', 'neutral']).toContain(sentimentData[0].sentiment);
      expect(sentimentData[0].confidence).toBeGreaterThanOrEqual(0.8);
      expect(sentimentData[0].confidence).toBeLessThanOrEqual(1.0);
    });

    it('should generate test datasets', () => {
      const datasets = generateTestDatasets(3);
      
      expect(datasets).toHaveLength(3);
      expect(datasets[0]).toHaveProperty('id');
      expect(datasets[0]).toHaveProperty('name');
      expect(datasets[0]).toHaveProperty('filename');
      expect(datasets[0]).toHaveProperty('size');
      expect(datasets[0]).toHaveProperty('recordCount');
      expect(datasets[0]).toHaveProperty('createdAt');
      expect(datasets[0]).toHaveProperty('updatedAt');
      
      expect(datasets[0].size).toBeGreaterThan(0);
      expect(datasets[0].recordCount).toBeGreaterThan(0);
    });
  });

  describe('Constants and Configuration', () => {
    it('should provide test constants', () => {
      expect(TEST_CONSTANTS.DEFAULT_TIMEOUT).toBe(5000);
      expect(TEST_CONSTANTS.LONG_TIMEOUT).toBe(30000);
      expect(TEST_CONSTANTS.DEFAULT_PAGE_SIZE).toBe(10);
      expect(TEST_CONSTANTS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      expect(Array.isArray(TEST_CONSTANTS.SUPPORTED_FILE_TYPES)).toBe(true);
      expect(TEST_CONSTANTS.SUPPORTED_FILE_TYPES).toContain('text/csv');
    });
  });

  describe('Default Export', () => {
    it('should export all utilities as default object', () => {
      expect(sharedTestUtils).toBeDefined();
      expect(sharedTestUtils.createMockRequest).toBe(createMockRequest);
      expect(sharedTestUtils.createMockResponse).toBe(createMockResponse);
      expect(sharedTestUtils.expectValidationError).toBe(expectValidationError);
      expect(sharedTestUtils.generateTestSentimentData).toBe(generateTestSentimentData);
      expect(sharedTestUtils.TEST_CONSTANTS).toBe(TEST_CONSTANTS);
    });
  });
});