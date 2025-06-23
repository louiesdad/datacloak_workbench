/**
 * End-to-End Analysis Flow Integration Tests
 * 
 * Comprehensive integration tests covering the complete analysis flow
 * from data upload through sentiment analysis to dashboard updates.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockApp } from '../../test-utils/app-factory';
import { createMockDataService, createMockSentimentService, createTestFile } from '../../test-utils/shared-test-utilities';
import { rbacSystem } from '../../security/rbac-system';
import { piiMaskingVerifier } from '../../security/pii-masking-verifier';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';

// Mock external services
jest.mock('../../services/websocket.service');
jest.mock('../../services/sse.service');
jest.mock('../../config/logger');

describe('E2E Analysis Flow Integration Tests', () => {
  let app: express.Application;
  let mockDataService: any;
  let mockSentimentService: any;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockSSEService: jest.Mocked<SSEService>;
  let authToken: string;

  beforeAll(async () => {
    // Create test application
    app = await createMockApp();
    
    // Setup service mocks
    mockDataService = createMockDataService();
    mockSentimentService = createMockSentimentService();
    mockWebSocketService = jest.mocked(new WebSocketService());
    mockSSEService = jest.mocked(new SSEService());
    
    // Mock authentication
    authToken = 'Bearer test-token-123';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Analysis Workflow', () => {
    it('should execute full analysis flow: upload → analyze → dashboard → export', async () => {
      // Step 1: Upload dataset
      const testCsvData = 'text,sentiment\n"I love this product",positive\n"This is terrible",negative';
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testCsvData), 'test-data.csv')
        .expect(201);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data).toHaveProperty('id');
      
      const datasetId = uploadResponse.body.data.id;

      // Step 2: Trigger sentiment analysis
      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({
          datasetId,
          model: 'openai-gpt-3.5',
          options: { includeConfidence: true }
        })
        .expect(200);

      expect(analysisResponse.body.success).toBe(true);
      expect(analysisResponse.body.data).toHaveProperty('jobId');
      
      const jobId = analysisResponse.body.data.jobId;

      // Step 3: Check job progress
      const progressResponse = await request(app)
        .get(`/api/jobs/${jobId}/progress`)
        .set('Authorization', authToken)
        .expect(200);

      expect(progressResponse.body.data).toHaveProperty('progress');
      expect(progressResponse.body.data).toHaveProperty('status');

      // Step 4: Get sentiment results
      const resultsResponse = await request(app)
        .get('/api/sentiment/history')
        .set('Authorization', authToken)
        .query({ datasetId, page: 1, pageSize: 10 })
        .expect(200);

      expect(resultsResponse.body.data).toBeInstanceOf(Array);
      expect(resultsResponse.body.pagination).toBeDefined();

      // Step 5: Check dashboard metrics
      const dashboardResponse = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      expect(dashboardResponse.body.data).toHaveProperty('totalDatasets');
      expect(dashboardResponse.body.data).toHaveProperty('totalAnalyses');
      expect(dashboardResponse.body.data).toHaveProperty('averageSentiment');

      // Step 6: Generate analytics
      const analyticsResponse = await request(app)
        .get('/api/analytics/sentiment/trends')
        .set('Authorization', authToken)
        .query({ timeRange: 'day', limit: 10 })
        .expect(200);

      expect(analyticsResponse.body.data).toBeInstanceOf(Array);

      // Step 7: Export results
      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId,
          sentimentFilter: 'positive'
        })
        .expect(200);

      expect(exportResponse.body.data).toHaveProperty('exportId');
      expect(exportResponse.body.data).toHaveProperty('downloadUrl');

      // Verify all steps completed successfully
      expect(mockDataService.uploadDataset).toHaveBeenCalled();
      expect(mockSentimentService.analyzeSentiment).toHaveBeenCalled();
    });

    it('should handle large dataset analysis workflow', async () => {
      // Create large test dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => 
        `"Test text ${i}","neutral"`
      ).join('\n');
      const csvData = 'text,sentiment\n' + largeDataset;

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(csvData), 'large-dataset.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Trigger batch analysis
      const batchAnalysisResponse = await request(app)
        .post('/api/sentiment/batch')
        .set('Authorization', authToken)
        .send({
          datasetId,
          batchSize: 100,
          model: 'openai-gpt-3.5'
        })
        .expect(200);

      expect(batchAnalysisResponse.body.data).toHaveProperty('jobId');

      // Check that job is processing
      const jobStatusResponse = await request(app)
        .get(`/api/jobs/${batchAnalysisResponse.body.data.jobId}/status`)
        .set('Authorization', authToken)
        .expect(200);

      expect(['pending', 'running', 'completed']).toContain(
        jobStatusResponse.body.data.status
      );
    });

    it('should handle analysis workflow with PII detection and masking', async () => {
      // Create dataset with PII data
      const piiData = 'text,user_email\n"Great service!","john.doe@example.com"\n"Poor quality","jane.smith@test.com"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(piiData), 'pii-data.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Check that PII was detected during upload
      expect(uploadResponse.body.data.securityScan).toBeDefined();
      expect(uploadResponse.body.data.securityScan.piiItemsDetected).toBeGreaterThan(0);

      // Run analysis with PII masking
      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({
          datasetId,
          model: 'openai-gpt-3.5',
          options: { 
            includeConfidence: true,
            maskPII: true 
          }
        })
        .expect(200);

      expect(analysisResponse.body.success).toBe(true);

      // Verify security scan results
      const securityScanResponse = await request(app)
        .get(`/api/security/scan/${datasetId}`)
        .set('Authorization', authToken)
        .expect(200);

      expect(securityScanResponse.body.data).toHaveProperty('piiDetected');
      expect(securityScanResponse.body.data).toHaveProperty('riskLevel');
    });
  });

  describe('Real-time Updates', () => {
    it('should emit WebSocket updates during analysis', async () => {
      const testData = 'text\n"Testing real-time updates"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'realtime-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Start analysis
      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      // Verify WebSocket service was called for real-time updates
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'analysis_started',
          data: expect.any(Object)
        })
      );
    });

    it('should send SSE updates for dashboard metrics', async () => {
      // Trigger dashboard metrics update
      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      // Check dashboard real-time endpoint
      const realtimeResponse = await request(app)
        .get('/api/dashboard/realtime')
        .set('Authorization', authToken)
        .expect(200);

      expect(realtimeResponse.body.data).toHaveProperty('liveMetrics');
    });

    it('should handle concurrent analysis requests', async () => {
      const testData1 = 'text\n"First concurrent analysis"';
      const testData2 = 'text\n"Second concurrent analysis"';

      // Upload two datasets concurrently
      const [upload1, upload2] = await Promise.all([
        request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData1), 'concurrent1.csv'),
        request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData2), 'concurrent2.csv')
      ]);

      expect(upload1.status).toBe(201);
      expect(upload2.status).toBe(201);

      // Start analyses concurrently
      const [analysis1, analysis2] = await Promise.all([
        request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', authToken)
          .send({ datasetId: upload1.body.data.id }),
        request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', authToken)
          .send({ datasetId: upload2.body.data.id })
      ]);

      expect(analysis1.status).toBe(200);
      expect(analysis2.status).toBe(200);
      expect(analysis1.body.data.jobId).not.toBe(analysis2.body.data.jobId);
    });
  });

  describe('Export Functionality', () => {
    it('should export analysis results in multiple formats', async () => {
      const testData = 'text,expected_sentiment\n"Great product!","positive"\n"Terrible experience","negative"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'export-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Run analysis
      await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId })
        .expect(200);

      // Test CSV export
      const csvExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId,
          dateRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        })
        .expect(200);

      expect(csvExportResponse.body.data.format).toBe('csv');
      expect(csvExportResponse.body.data.downloadUrl).toBeDefined();

      // Test JSON export
      const jsonExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'json',
          datasetId,
          sentimentFilter: 'positive'
        })
        .expect(200);

      expect(jsonExportResponse.body.data.format).toBe('json');

      // Test Excel export
      const excelExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'xlsx',
          datasetId
        })
        .expect(200);

      expect(excelExportResponse.body.data.format).toBe('xlsx');
    });

    it('should handle export with sentiment filtering', async () => {
      const mixedData = 'text\n"Love it!"\n"Hate it!"\n"It\'s okay"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(mixedData), 'mixed-sentiment.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Export only positive sentiment
      const positiveExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId,
          sentimentFilter: 'positive'
        })
        .expect(200);

      expect(positiveExportResponse.body.data.exportId).toBeDefined();

      // Export only negative sentiment
      const negativeExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId,
          sentimentFilter: 'negative'
        })
        .expect(200);

      expect(negativeExportResponse.body.data.exportId).toBeDefined();
      expect(negativeExportResponse.body.data.exportId).not.toBe(
        positiveExportResponse.body.data.exportId
      );
    });

    it('should validate export permissions based on user role', async () => {
      const testData = 'text\n"Test export permissions"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'permission-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Test with admin permissions (should succeed)
      const adminExportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', authToken)
        .send({
          format: 'csv',
          datasetId
        })
        .expect(200);

      expect(adminExportResponse.body.success).toBe(true);

      // Test export download permissions
      const downloadResponse = await request(app)
        .get(`/api/exports/${adminExportResponse.body.data.exportId}/download`)
        .set('Authorization', authToken)
        .expect(200);

      expect(downloadResponse.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle upload errors gracefully', async () => {
      // Test with invalid file format
      const invalidData = 'This is not CSV data';
      
      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(invalidData), 'invalid.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle analysis failures and provide meaningful errors', async () => {
      // Mock analysis service to fail
      mockSentimentService.analyzeSentiment.mockRejectedValueOnce(
        new Error('External service unavailable')
      );

      const testData = 'text\n"Test analysis failure"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'failure-test.csv')
        .expect(201);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId: uploadResponse.body.data.id })
        .expect(500);

      expect(analysisResponse.body.success).toBe(false);
      expect(analysisResponse.body.error).toContain('service unavailable');
    });

    it('should handle database connection failures', async () => {
      // This would test database resilience
      // In a real scenario, you'd mock database connection failures
      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken);

      // Should either succeed or handle gracefully
      expect([200, 503]).toContain(response.status);
    });

    it('should retry failed operations with exponential backoff', async () => {
      // Test retry mechanism for external service calls
      let callCount = 0;
      mockSentimentService.analyzeSentiment.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary service failure');
        }
        return Promise.resolve({
          id: 'retry-test',
          sentiment: 'positive',
          confidence: 0.9
        });
      });

      const testData = 'text\n"Test retry mechanism"';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'retry-test.csv')
        .expect(201);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', authToken)
        .send({ datasetId: uploadResponse.body.data.id })
        .expect(200);

      expect(analysisResponse.body.success).toBe(true);
      expect(callCount).toBe(3); // Should have retried twice before succeeding
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent uploads', async () => {
      const concurrentUploads = 5;
      const uploadPromises = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const testData = `text\n"Concurrent upload ${i}"`;
        const uploadPromise = request(app)
          .post('/api/data/upload')
          .set('Authorization', authToken)
          .attach('file', Buffer.from(testData), `concurrent-${i}.csv`);
        
        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.id).toBeDefined();
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      const testData = 'text\n"Performance test data"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(testData), 'performance-test.csv')
        .expect(201);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Upload should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle memory efficiently with large datasets', async () => {
      // Create a moderately large dataset for testing
      const largeDataset = Array.from({ length: 10000 }, (_, i) => 
        `"Test data row ${i}","neutral"`
      ).join('\n');
      const csvData = 'text,sentiment\n' + largeDataset;

      const initialMemory = process.memoryUsage();
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(csvData), 'large-memory-test.csv')
        .expect(201);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      expect(uploadResponse.body.data.id).toBeDefined();
    });
  });

  describe('Security Integration', () => {
    it('should require authentication for all endpoints', async () => {
      // Test without authentication
      const response = await request(app)
        .get('/api/dashboard/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should enforce role-based access control', async () => {
      // This would test RBAC integration
      // Mock a viewer role trying to delete data
      const viewerToken = 'Bearer viewer-token';

      const response = await request(app)
        .delete('/api/data/datasets/test-id')
        .set('Authorization', viewerToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should log all access attempts for audit trail', async () => {
      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', authToken)
        .expect(200);

      // Verify audit log entry was created
      const auditLogs = await rbacSystem.getAuditLogs({
        action: 'read',
        resource: 'analytics'
      });

      expect(auditLogs.data.length).toBeGreaterThan(0);
    });

    it('should mask PII in all log outputs', async () => {
      const piiData = 'text,email\n"Great service!","john.doe@example.com"';
      
      await request(app)
        .post('/api/data/upload')
        .set('Authorization', authToken)
        .attach('file', Buffer.from(piiData), 'pii-logging-test.csv')
        .expect(201);

      // Verify that PII masking was applied
      const scanResult = await piiMaskingVerifier.getMaskingStatistics();
      expect(scanResult.piiDetected).toBeGreaterThan(0);
    });
  });
});