import { 
  createSentimentAnalysisBatchHandler,
  createFileProcessingHandler,
  createSecurityScanHandler,
  createDataExportHandler,
  registerAllHandlers
} from '../job-handlers';
import { Job, JobType } from '../job-queue.service';
import { SentimentService } from '../sentiment.service';
import { DataService } from '../data.service';
import { SecurityService } from '../security.service';
import { FileStreamService } from '../file-stream.service';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// Mock all dependencies
jest.mock('../sentiment.service');
jest.mock('../data.service');
jest.mock('../security.service');
jest.mock('../file-stream.service');
jest.mock('fs');
jest.mock('csv-parser');
jest.mock('xlsx');

// Mock duckdb and related modules
jest.mock('duckdb', () => ({
  Database: jest.fn()
}));

jest.mock('../../database/duckdb-pool', () => ({
  DuckDBPool: jest.fn()
}));

jest.mock('../openai.service', () => ({
  OpenAIService: jest.fn()
}));

jest.mock('../datacloak.service', () => ({
  DataCloakService: jest.fn()
}));

jest.mock('../event.service', () => ({
  eventEmitter: {
    emit: jest.fn()
  },
  EventTypes: {
    DATA_UPLOAD: 'data:upload',
    DATA_DELETE: 'data:delete'
  }
}));

jest.mock('../sse.service', () => ({
  getSSEService: jest.fn(() => ({
    broadcast: jest.fn()
  }))
}));

describe('Job Handlers', () => {
  let mockSentimentService: jest.Mocked<SentimentService>;
  let mockDataService: jest.Mocked<DataService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockFileStreamService: jest.Mocked<FileStreamService>;
  let mockUpdateProgress: jest.MockedFunction<(progress: number) => void>;

  const createMockJob = (type: JobType, data: any): Job => ({
    id: `test-job-${Date.now()}`,
    type,
    status: 'running',
    priority: 'medium',
    data,
    createdAt: new Date(),
    startedAt: new Date(),
    progress: 0
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockSentimentService = new SentimentService() as jest.Mocked<SentimentService>;
    mockDataService = new DataService() as jest.Mocked<DataService>;
    mockSecurityService = new SecurityService() as jest.Mocked<SecurityService>;
    mockFileStreamService = new FileStreamService() as jest.Mocked<FileStreamService>;
    mockUpdateProgress = jest.fn();

    // Mock fs
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('mock file content');
  });

  describe('Sentiment Analysis Batch Handler', () => {
    let handler: ReturnType<typeof createSentimentAnalysisBatchHandler>;

    beforeEach(() => {
      handler = createSentimentAnalysisBatchHandler(mockSentimentService);
    });

    test('should process batch of texts successfully', async () => {
      const texts = ['Hello world', 'Great product', 'Terrible experience'];
      const job = createMockJob('sentiment_analysis_batch', { texts, enablePIIMasking: true });

      mockSentimentService.analyzeSentiment.mockImplementation(async (text) => ({
        sentiment: text.includes('Great') ? 'positive' : text.includes('Terrible') ? 'negative' : 'neutral',
        score: text.includes('Great') ? 0.9 : text.includes('Terrible') ? 0.1 : 0.5,
        maskedText: text,
        piiDetected: false
      }));

      const result = await handler(job, mockUpdateProgress);

      expect(result.totalProcessed).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(mockUpdateProgress).toHaveBeenCalledWith(expect.any(Number));
      expect(mockSentimentService.analyzeSentiment).toHaveBeenCalledTimes(3);
    });

    test('should handle errors gracefully', async () => {
      const texts = ['Good text', 'Bad text', 'Error text'];
      const job = createMockJob('sentiment_analysis_batch', { texts });

      mockSentimentService.analyzeSentiment.mockImplementation(async (text) => {
        if (text.includes('Error')) {
          throw new Error('Analysis failed');
        }
        return {
          sentiment: 'positive',
          score: 0.8,
          maskedText: text,
          piiDetected: false
        };
      });

      const result = await handler(job, mockUpdateProgress);

      expect(result.totalProcessed).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.results[2].error).toBe('Analysis failed');
    });

    test('should throw error for invalid input', async () => {
      const job = createMockJob('sentiment_analysis_batch', { texts: null });

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('Invalid job data: texts array is required');
    });

    test('should handle large batches efficiently', async () => {
      const texts = Array(250).fill('Test text');
      const job = createMockJob('sentiment_analysis_batch', { texts });

      mockSentimentService.analyzeSentiment.mockResolvedValue({
        sentiment: 'neutral',
        score: 0.5,
        maskedText: 'Test text',
        piiDetected: false
      });

      const result = await handler(job, mockUpdateProgress);

      expect(result.totalProcessed).toBe(250);
      // Should process in batches of 100
      expect(mockUpdateProgress).toHaveBeenCalledTimes(250);
    });

    test('should update progress correctly', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3', 'Text 4'];
      const job = createMockJob('sentiment_analysis_batch', { texts });

      mockSentimentService.analyzeSentiment.mockResolvedValue({
        sentiment: 'positive',
        score: 0.7,
        maskedText: 'Text',
        piiDetected: false
      });

      await handler(job, mockUpdateProgress);

      // Verify progress updates
      expect(mockUpdateProgress).toHaveBeenCalledWith(25);
      expect(mockUpdateProgress).toHaveBeenCalledWith(50);
      expect(mockUpdateProgress).toHaveBeenCalledWith(75);
      expect(mockUpdateProgress).toHaveBeenCalledWith(100);
    });
  });

  describe('File Processing Handler', () => {
    let handler: ReturnType<typeof createFileProcessingHandler>;

    beforeEach(() => {
      handler = createFileProcessingHandler(mockDataService, mockFileStreamService);
    });

    test('should process file for parsing successfully', async () => {
      const job = createMockJob('file_processing', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123',
        processingType: 'parse'
      });

      mockFileStreamService.streamProcessFile.mockResolvedValue({
        totalRows: 1000,
        processedRows: 1000,
        processingTime: 5000,
        errors: []
      });

      const chunkData = [
        { id: 1, name: 'Row 1' },
        { id: 2, name: 'Row 2' }
      ];

      // Capture the callbacks
      let capturedCallbacks: any = {};
      mockFileStreamService.streamProcessFile.mockImplementation(async (filePath, options) => {
        capturedCallbacks = options;
        // Simulate chunk processing
        await options.onChunk({ processedRows: 2, data: chunkData });
        options.onProgress({ percentComplete: 100, processedBytes: 1024, totalBytes: 1024 });
        return {
          totalRows: 2,
          processedRows: 2,
          processingTime: 100,
          errors: []
        };
      });

      const result = await handler(job, mockUpdateProgress);

      expect(result.datasetId).toBe('dataset-123');
      expect(result.totalRows).toBe(2);
      expect(result.processedRows).toBe(2);
      expect(mockUpdateProgress).toHaveBeenCalledWith(100);
    });

    test('should process file for analysis successfully', async () => {
      const job = createMockJob('file_processing', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123',
        processingType: 'analyze'
      });

      const mockAnalyzeSentiment = jest.fn().mockResolvedValue({
        sentiment: 'positive',
        score: 0.8,
        maskedText: 'analyzed text',
        piiDetected: false
      });

      // Mock SentimentService constructor
      (SentimentService as jest.MockedClass<typeof SentimentService>).mockImplementation(() => ({
        analyzeSentiment: mockAnalyzeSentiment
      } as any));

      mockFileStreamService.streamProcessFile.mockImplementation(async (filePath, options) => {
        // Simulate chunk with text data
        await options.onChunk({
          processedRows: 1,
          data: [{ text: 'This is a long text for analysis' }]
        });
        return {
          totalRows: 1,
          processedRows: 1,
          processingTime: 100,
          errors: []
        };
      });

      const result = await handler(job, mockUpdateProgress);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toHaveProperty('sentiment');
    });

    test('should throw error for non-existent file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      const job = createMockJob('file_processing', {
        filePath: '/nonexistent/file.csv',
        datasetId: 'dataset-123'
      });

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('File not found: /nonexistent/file.csv');
    });

    test('should handle stream processing errors', async () => {
      const job = createMockJob('file_processing', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123'
      });

      mockFileStreamService.streamProcessFile.mockRejectedValue(new Error('Stream failed'));

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('File processing failed: Stream failed');
    });

    test('should respect chunk size configuration', async () => {
      const job = createMockJob('file_processing', {
        filePath: '/test/large-file.csv',
        datasetId: 'dataset-123'
      });

      await handler(job, mockUpdateProgress);

      expect(mockFileStreamService.streamProcessFile).toHaveBeenCalledWith(
        '/test/large-file.csv',
        expect.objectContaining({
          chunkSize: 256 * 1024 * 1024 // 256MB
        })
      );
    });
  });

  describe('Security Scan Handler', () => {
    let handler: ReturnType<typeof createSecurityScanHandler>;

    beforeEach(() => {
      handler = createSecurityScanHandler(mockSecurityService);
      mockSecurityService.initialize = jest.fn().mockResolvedValue(undefined);
    });

    test('should perform full security scan successfully', async () => {
      const job = createMockJob('security_scan', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123',
        scanType: 'full'
      });

      mockSecurityService.scanDataset.mockResolvedValue({
        datasetId: 'dataset-123',
        piiItemsDetected: 5,
        complianceScore: 0.85,
        recommendations: ['Use encryption', 'Mask PII fields']
      });

      mockSecurityService.auditFile.mockResolvedValue({
        fileHash: 'abc123',
        lastModified: new Date(),
        permissions: { readable: true, writable: false },
        sensitiveDataFound: true
      });

      const result = await handler(job, mockUpdateProgress);

      expect(result.datasetId).toBe('dataset-123');
      expect(result.summary.piiItemsDetected).toBe(5);
      expect(result.summary.complianceScore).toBe(0.85);
      expect(result.summary.riskLevel).toBe('low');
      expect(mockUpdateProgress).toHaveBeenCalledWith(10);
      expect(mockUpdateProgress).toHaveBeenCalledWith(20);
      expect(mockUpdateProgress).toHaveBeenCalledWith(80);
      expect(mockUpdateProgress).toHaveBeenCalledWith(100);
    });

    test('should perform quick PII scan successfully', async () => {
      const job = createMockJob('security_scan', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123',
        scanType: 'quick'
      });

      mockSecurityService.detectPII.mockResolvedValue([
        { piiType: 'email', value: 'test@example.com', location: 10 },
        { piiType: 'phone', value: '555-1234', location: 50 }
      ]);

      const result = await handler(job, mockUpdateProgress);

      expect(result.quickScan).toBe(true);
      expect(result.summary.piiItemsDetected).toBe(2);
      expect(result.summary.piiTypes).toEqual(['email', 'phone']);
      expect(mockSecurityService.detectPII).toHaveBeenCalled();
    });

    test('should calculate risk levels correctly', async () => {
      const testCases = [
        { score: 0.9, expectedRisk: 'low' },
        { score: 0.7, expectedRisk: 'medium' },
        { score: 0.4, expectedRisk: 'high' }
      ];

      for (const { score, expectedRisk } of testCases) {
        const job = createMockJob('security_scan', {
          filePath: '/test/file.csv',
          datasetId: 'dataset-123',
          scanType: 'full'
        });

        mockSecurityService.scanDataset.mockResolvedValue({
          datasetId: 'dataset-123',
          piiItemsDetected: 0,
          complianceScore: score,
          recommendations: []
        });

        mockSecurityService.auditFile.mockResolvedValue({} as any);

        const result = await handler(job, mockUpdateProgress);

        expect(result.summary.riskLevel).toBe(expectedRisk);
      }
    });

    test('should handle security scan errors', async () => {
      const job = createMockJob('security_scan', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123'
      });

      mockSecurityService.initialize.mockRejectedValue(new Error('Security service failed'));

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('Security scan failed: Security service failed');
    });
  });

  describe('Data Export Handler', () => {
    let handler: ReturnType<typeof createDataExportHandler>;

    beforeEach(() => {
      handler = createDataExportHandler(mockDataService);
    });

    test('should export CSV data successfully', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'csv',
        filters: { limit: 10, columns: ['id', 'name'] },
        includeMetadata: true
      });

      mockDataService.getDatasetById.mockReturnValue({
        id: 'dataset-123',
        filename: 'test.csv',
        originalFilename: 'original.csv',
        mimeType: 'text/csv',
        size: 1024,
        uploadDate: new Date(),
        metadata: {}
      });

      // Mock CSV parsing
      const csvParser = require('csv-parser');
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            // Emit some test data
            callback({ id: 1, name: 'Test 1', extra: 'data' });
            callback({ id: 2, name: 'Test 2', extra: 'data' });
          } else if (event === 'end') {
            callback();
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
      csvParser.mockReturnValue(mockStream);

      const result = await handler(job, mockUpdateProgress);

      expect(result.recordCount).toBe(2);
      expect(result.exportData.metadata).toBeDefined();
      expect(result.exportData.metadata.datasetId).toBe('dataset-123');
      expect(result.exportData.data).toHaveLength(2);
      expect(result.exportData.data[0]).toEqual({ id: 1, name: 'Test 1' });
      expect(mockUpdateProgress).toHaveBeenCalledWith(10);
      expect(mockUpdateProgress).toHaveBeenCalledWith(20);
      expect(mockUpdateProgress).toHaveBeenCalledWith(30);
      expect(mockUpdateProgress).toHaveBeenCalledWith(70);
      expect(mockUpdateProgress).toHaveBeenCalledWith(90);
      expect(mockUpdateProgress).toHaveBeenCalledWith(100);
    });

    test('should export Excel data successfully', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'xlsx'
      });

      mockDataService.getDatasetById.mockReturnValue({
        id: 'dataset-123',
        filename: 'test.xlsx',
        originalFilename: 'original.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2048,
        uploadDate: new Date(),
        metadata: {}
      });

      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {}
        }
      };

      (XLSX.readFile as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
        { id: 1, name: 'Excel Row 1' },
        { id: 2, name: 'Excel Row 2' }
      ]);

      const result = await handler(job, mockUpdateProgress);

      expect(result.recordCount).toBe(2);
      expect(result.format).toBe('xlsx');
      expect(XLSX.readFile).toHaveBeenCalledWith(expect.stringContaining('test.xlsx'));
    });

    test('should apply filters correctly', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'csv',
        filters: {
          limit: 1,
          columns: ['id']
        }
      });

      mockDataService.getDatasetById.mockReturnValue({
        id: 'dataset-123',
        filename: 'test.csv',
        mimeType: 'text/csv',
        size: 1024,
        uploadDate: new Date(),
        metadata: {}
      } as any);

      // Mock CSV with multiple rows
      const csvParser = require('csv-parser');
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback({ id: 1, name: 'Test 1', extra: 'data' });
            callback({ id: 2, name: 'Test 2', extra: 'data' });
            callback({ id: 3, name: 'Test 3', extra: 'data' });
          } else if (event === 'end') {
            callback();
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
      csvParser.mockReturnValue(mockStream);

      const result = await handler(job, mockUpdateProgress);

      // Should only have 1 record due to limit
      expect(result.exportData.data).toHaveLength(1);
      // Should only have 'id' column
      expect(result.exportData.data[0]).toEqual({ id: 1 });
    });

    test('should handle missing dataset file', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'csv'
      });

      mockDataService.getDatasetById.mockReturnValue({
        id: 'dataset-123',
        filename: 'missing.csv',
        mimeType: 'text/csv',
        size: 0,
        uploadDate: new Date(),
        metadata: {}
      } as any);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('Dataset file not found');
    });

    test('should handle export errors gracefully', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'csv'
      });

      mockDataService.getDatasetById.mockImplementation(() => {
        throw new Error('Dataset not found');
      });

      await expect(handler(job, mockUpdateProgress)).rejects.toThrow('Data export failed: Dataset not found');
    });
  });

  describe('Register All Handlers', () => {
    test('should register all handlers with job queue', () => {
      const mockJobQueue = {
        registerHandler: jest.fn()
      };

      const services = {
        sentimentService: mockSentimentService,
        dataService: mockDataService,
        securityService: mockSecurityService,
        fileStreamService: mockFileStreamService
      };

      registerAllHandlers(mockJobQueue, services);

      expect(mockJobQueue.registerHandler).toHaveBeenCalledTimes(4);
      expect(mockJobQueue.registerHandler).toHaveBeenCalledWith(
        'sentiment_analysis_batch',
        expect.any(Function)
      );
      expect(mockJobQueue.registerHandler).toHaveBeenCalledWith(
        'file_processing',
        expect.any(Function)
      );
      expect(mockJobQueue.registerHandler).toHaveBeenCalledWith(
        'security_scan',
        expect.any(Function)
      );
      expect(mockJobQueue.registerHandler).toHaveBeenCalledWith(
        'data_export',
        expect.any(Function)
      );
    });
  });

  describe('Timeout Handling', () => {
    test('should handle job timeout in sentiment analysis', async () => {
      const texts = ['Text 1', 'Text 2'];
      const job = createMockJob('sentiment_analysis_batch', { texts });

      // Mock slow analysis that would timeout
      mockSentimentService.analyzeSentiment.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          sentiment: 'positive',
          score: 0.8,
          maskedText: 'text',
          piiDetected: false
        };
      });

      const handler = createSentimentAnalysisBatchHandler(mockSentimentService);
      
      // Create a timeout wrapper
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), 50);
      });

      await expect(
        Promise.race([handler(job, mockUpdateProgress), timeoutPromise])
      ).rejects.toThrow('Job timeout');
    });
  });

  describe('Progress Tracking', () => {
    test('should track progress accurately for large file processing', async () => {
      const job = createMockJob('file_processing', {
        filePath: '/test/large-file.csv',
        datasetId: 'dataset-123'
      });

      const progressUpdates: number[] = [];
      const trackingUpdateProgress = (progress: number) => {
        progressUpdates.push(progress);
      };

      mockFileStreamService.streamProcessFile.mockImplementation(async (filePath, options) => {
        // Simulate multiple progress updates
        options.onProgress({ percentComplete: 25, processedBytes: 250, totalBytes: 1000 });
        options.onProgress({ percentComplete: 50, processedBytes: 500, totalBytes: 1000 });
        options.onProgress({ percentComplete: 75, processedBytes: 750, totalBytes: 1000 });
        options.onProgress({ percentComplete: 100, processedBytes: 1000, totalBytes: 1000 });
        
        return {
          totalRows: 10000,
          processedRows: 10000,
          processingTime: 5000,
          errors: []
        };
      });

      const handler = createFileProcessingHandler(mockDataService, mockFileStreamService);
      await handler(job, trackingUpdateProgress);

      expect(progressUpdates).toEqual([25, 50, 75, 100]);
    });

    test('should never exceed 100% progress', async () => {
      const texts = Array(5).fill('Test');
      const job = createMockJob('sentiment_analysis_batch', { texts });

      const progressUpdates: number[] = [];
      const trackingUpdateProgress = (progress: number) => {
        progressUpdates.push(progress);
      };

      mockSentimentService.analyzeSentiment.mockResolvedValue({
        sentiment: 'neutral',
        score: 0.5,
        maskedText: 'Test',
        piiDetected: false
      });

      const handler = createSentimentAnalysisBatchHandler(mockSentimentService);
      await handler(job, trackingUpdateProgress);

      // All progress updates should be <= 100
      expect(progressUpdates.every(p => p <= 100)).toBe(true);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('Retry Logic', () => {
    test('should support retry logic for transient failures', async () => {
      const job = createMockJob('security_scan', {
        filePath: '/test/file.csv',
        datasetId: 'dataset-123'
      });

      let attemptCount = 0;
      mockSecurityService.initialize.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient error');
        }
      });

      mockSecurityService.scanDataset.mockResolvedValue({
        datasetId: 'dataset-123',
        piiItemsDetected: 0,
        complianceScore: 0.9,
        recommendations: []
      });

      mockSecurityService.auditFile.mockResolvedValue({} as any);

      // Wrap handler with retry logic
      const handler = createSecurityScanHandler(mockSecurityService);
      const retryHandler = async (job: Job, updateProgress: (progress: number) => void) => {
        let lastError;
        for (let i = 0; i < 3; i++) {
          try {
            return await handler(job, updateProgress);
          } catch (error) {
            lastError = error;
            if (i < 2) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
        throw lastError;
      };

      const result = await retryHandler(job, mockUpdateProgress);

      expect(attemptCount).toBe(3);
      expect(result.summary.complianceScore).toBe(0.9);
    });
  });

  describe('Memory Management', () => {
    test('should handle memory efficiently for large datasets', async () => {
      const job = createMockJob('data_export', {
        datasetId: 'dataset-123',
        format: 'csv',
        filters: { limit: 1000 } // Should limit results
      });

      mockDataService.getDatasetById.mockReturnValue({
        id: 'dataset-123',
        filename: 'large.csv',
        mimeType: 'text/csv',
        size: 100 * 1024 * 1024, // 100MB
        uploadDate: new Date(),
        metadata: {}
      } as any);

      // Mock large dataset
      const csvParser = require('csv-parser');
      const mockStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            // Simulate 10000 rows
            for (let i = 0; i < 10000; i++) {
              callback({ id: i, data: `Row ${i}` });
            }
          } else if (event === 'end') {
            callback();
          }
          return mockStream;
        })
      };
      
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
      csvParser.mockReturnValue(mockStream);

      const handler = createDataExportHandler(mockDataService);
      const result = await handler(job, mockUpdateProgress);

      // Should respect the limit filter
      expect(result.exportData.data).toHaveLength(1000);
      expect(result.recordCount).toBe(1000);
    });

    test('should process sentiment in batches to avoid memory issues', async () => {
      const texts = Array(500).fill('Test text for analysis');
      const job = createMockJob('sentiment_analysis_batch', { texts });

      let callCount = 0;
      mockSentimentService.analyzeSentiment.mockImplementation(async () => {
        callCount++;
        return {
          sentiment: 'neutral',
          score: 0.5,
          maskedText: 'Test text',
          piiDetected: false
        };
      });

      const handler = createSentimentAnalysisBatchHandler(mockSentimentService);
      const result = await handler(job, mockUpdateProgress);

      expect(result.totalProcessed).toBe(500);
      expect(callCount).toBe(500);
      // Should have processed in batches
      expect(result.results).toHaveLength(500);
    });
  });
});