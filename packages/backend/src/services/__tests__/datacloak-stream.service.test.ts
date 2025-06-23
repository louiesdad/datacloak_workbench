import { DataCloakStreamService } from '../datacloak-stream.service';
import { FileStreamService } from '../file-stream.service';
import { SecurityService } from '../security.service';
import { DataCloakIntegrationService } from '../datacloak-integration.service';
import { AppError } from '../../middleware/error.middleware';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../file-stream.service');
jest.mock('../security.service');
jest.mock('../datacloak-integration.service');
jest.mock('fs');

describe('DataCloakStreamService', () => {
  let service: DataCloakStreamService;
  let mockFileStreamService: jest.Mocked<FileStreamService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockDataCloakService: jest.Mocked<DataCloakIntegrationService>;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock FileStreamService
    mockFileStreamService = {
      streamProcessFile: jest.fn().mockResolvedValue({
        totalRows: 1000,
        totalBytes: 1024000,
        chunksProcessed: 10,
        processingTime: 5000
      })
    } as any;
    (FileStreamService as jest.Mock).mockImplementation(() => mockFileStreamService);

    // Mock SecurityService
    mockSecurityService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      detectPII: jest.fn().mockResolvedValue([]),
      maskText: jest.fn().mockResolvedValue({
        originalText: 'original',
        maskedText: '[MASKED]',
        piiItemsFound: 1
      })
    } as any;
    (SecurityService as jest.Mock).mockImplementation(() => mockSecurityService);

    // Mock DataCloakIntegrationService
    mockDataCloakService = {} as any;
    (DataCloakIntegrationService as jest.Mock).mockImplementation(() => mockDataCloakService);

    // Mock fs
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1024000 });

    // Mock process.memoryUsage
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,
      heapTotal: 80 * 1024 * 1024,
      heapUsed: 50 * 1024 * 1024,
      external: 10 * 1024 * 1024,
      arrayBuffers: 5 * 1024 * 1024
    });

    service = new DataCloakStreamService();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should initialize with required services', () => {
      expect(service).toBeDefined();
      expect(FileStreamService).toHaveBeenCalled();
      expect(SecurityService).toHaveBeenCalled();
      expect(DataCloakIntegrationService).toHaveBeenCalled();
    });
  });

  describe('streamProcessWithDataCloak', () => {
    it('should process file with PII detection', async () => {
      const filePath = '/path/to/test.csv';
      const options = {
        chunkSize: 256 * 1024,
        onProgress: jest.fn(),
        onChunk: jest.fn(),
        onPIIDetected: jest.fn()
      };

      const result = await service.streamProcessWithDataCloak(filePath, options);

      expect(result).toMatchObject({
        totalRows: 1000,
        totalBytes: 1024000,
        chunksProcessed: 10,
        processingTime: expect.any(Number),
        piiSummary: {
          totalPIIItems: 0,
          piiTypes: {},
          fieldsWithPII: []
        }
      });

      expect(mockSecurityService.initialize).toHaveBeenCalled();
      expect(mockFileStreamService.streamProcessFile).toHaveBeenCalledWith(
        filePath,
        expect.objectContaining({
          chunkSize: 256 * 1024,
          onProgress: expect.any(Function),
          onChunk: expect.any(Function)
        })
      );
    });

    it('should handle file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.streamProcessWithDataCloak('/nonexistent/file.csv'))
        .rejects.toThrow(new AppError('File not found', 404, 'FILE_NOT_FOUND'));
    });

    it('should process chunks with PII detection', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [
          { name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
          { name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678' }
        ],
        processedRows: 2,
        isLastChunk: false
      };

      mockSecurityService.detectPII
        .mockResolvedValueOnce([{ piiType: 'EMAIL', value: 'john@example.com', confidence: 0.95, position: { start: 0, end: 16 } }])
        .mockResolvedValueOnce([{ piiType: 'PHONE', value: '555-1234', confidence: 0.90, position: { start: 0, end: 8 } }])
        .mockResolvedValueOnce([{ piiType: 'EMAIL', value: 'jane@example.com', confidence: 0.95, position: { start: 0, end: 16 } }])
        .mockResolvedValueOnce([{ piiType: 'PHONE', value: '555-5678', confidence: 0.90, position: { start: 0, end: 8 } }])
        .mockResolvedValue([]);

      let capturedChunkHandler: any;
      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        capturedChunkHandler = options.onChunk;
        // Simulate chunk processing
        await options.onChunk(mockChunk);
        return {
          totalRows: 2,
          totalBytes: 1024,
          chunksProcessed: 1,
          processingTime: 100
        };
      });

      const onChunkSpy = jest.fn();
      const onPIIDetectedSpy = jest.fn();

      const result = await service.streamProcessWithDataCloak('/test.csv', {
        onChunk: onChunkSpy,
        onPIIDetected: onPIIDetectedSpy
      });

      expect(result.piiSummary).toMatchObject({
        totalPIIItems: 4,
        piiTypes: { EMAIL: 2, PHONE: 2 },
        fieldsWithPII: expect.arrayContaining(['email', 'phone'])
      });

      expect(onChunkSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          piiDetectionResults: expect.arrayContaining([
            expect.objectContaining({ fieldName: 'email', piiType: 'EMAIL' }),
            expect.objectContaining({ fieldName: 'phone', piiType: 'PHONE' })
          ]),
          securityMetrics: {
            piiItemsFound: 4,
            fieldsWithPII: expect.arrayContaining(['email', 'phone']),
            maskingApplied: false
          }
        })
      );

      expect(onPIIDetectedSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ fieldName: 'email', piiType: 'EMAIL' })
        ])
      );
    });

    it('should apply masking when preservePII is false', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [{ email: 'test@example.com' }],
        processedRows: 1,
        isLastChunk: false
      };

      mockSecurityService.detectPII.mockResolvedValue([
        { piiType: 'EMAIL', value: 'test@example.com', confidence: 0.95, position: { start: 0, end: 16 } }
      ]);

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        await options.onChunk(mockChunk);
        return {
          totalRows: 1,
          totalBytes: 100,
          chunksProcessed: 1,
          processingTime: 50
        };
      });

      const onChunkSpy = jest.fn();

      await service.streamProcessWithDataCloak('/test.csv', {
        preservePII: false,
        onChunk: onChunkSpy
      });

      expect(mockSecurityService.maskText).toHaveBeenCalledWith('test@example.com');
      expect(onChunkSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          maskedData: [{ email: '[MASKED]' }]
        })
      );
    });

    it('should respect masking options', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [{ email: 'test@example.com', phone: '555-1234' }],
        processedRows: 1,
        isLastChunk: false
      };

      mockSecurityService.detectPII
        .mockResolvedValueOnce([{ piiType: 'EMAIL', value: 'test@example.com', confidence: 0.95, position: { start: 0, end: 16 } }])
        .mockResolvedValueOnce([{ piiType: 'PHONE', value: '555-1234', confidence: 0.90, position: { start: 0, end: 8 } }]);

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        await options.onChunk(mockChunk);
        return {
          totalRows: 1,
          totalBytes: 100,
          chunksProcessed: 1,
          processingTime: 50
        };
      });

      await service.streamProcessWithDataCloak('/test.csv', {
        preservePII: false,
        maskingOptions: {
          email: true,
          phone: false // Don't mask phone numbers
        }
      });

      // Should mask email but not phone
      expect(mockSecurityService.maskText).toHaveBeenCalledWith('test@example.com');
      expect(mockSecurityService.maskText).toHaveBeenCalledTimes(1); // Only email
    });

    it('should track memory usage', async () => {
      let progressCount = 0;
      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        // Simulate multiple progress updates
        for (let i = 0; i < 15; i++) {
          options.onProgress({
            chunksProcessed: i + 1,
            bytesProcessed: (i + 1) * 100000,
            percentComplete: ((i + 1) / 15) * 100,
            currentChunkSize: 100000
          });
        }
        return {
          totalRows: 1500,
          totalBytes: 1500000,
          chunksProcessed: 15,
          processingTime: 1000
        };
      });

      await service.streamProcessWithDataCloak('/test.csv');

      // Should log memory usage at chunks 10
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory usage after 10 chunks:')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Peak memory usage during processing:')
      );
    });

    it('should warn about high memory usage', async () => {
      // Mock high memory usage
      let callCount = 0;
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        callCount++;
        const baseMemory = 50 * 1024 * 1024;
        const additionalMemory = callCount > 5 ? 600 * 1024 * 1024 : 0; // Exceed 500MB after 5 calls
        return {
          rss: 100 * 1024 * 1024,
          heapTotal: 80 * 1024 * 1024,
          heapUsed: baseMemory + additionalMemory,
          external: 10 * 1024 * 1024,
          arrayBuffers: 5 * 1024 * 1024
        };
      });

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        const mockChunk = {
          chunkIndex: 0,
          data: [{ text: 'sample data' }],
          processedRows: 1,
          isLastChunk: false
        };
        await options.onChunk(mockChunk);
        return {
          totalRows: 1,
          totalBytes: 100,
          chunksProcessed: 1,
          processingTime: 50
        };
      });

      await service.streamProcessWithDataCloak('/test.csv');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory usage exceeding limit:')
      );
    });

    it('should handle PII detection errors gracefully', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [{ email: 'test@example.com' }],
        processedRows: 1,
        isLastChunk: false
      };

      mockSecurityService.detectPII.mockRejectedValue(new Error('PII detection failed'));

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        await options.onChunk(mockChunk);
        return {
          totalRows: 1,
          totalBytes: 100,
          chunksProcessed: 1,
          processingTime: 50
        };
      });

      const result = await service.streamProcessWithDataCloak('/test.csv');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'PII detection failed for field email:',
        expect.any(Error)
      );
      expect(result.piiSummary.totalPIIItems).toBe(0);
    });

    it('should calculate estimated time remaining', async () => {
      const onProgressSpy = jest.fn();

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        options.onProgress({
          chunksProcessed: 5,
          bytesProcessed: 500000,
          percentComplete: 50,
          currentChunkSize: 100000
        });
        return {
          totalRows: 1000,
          totalBytes: 1000000,
          chunksProcessed: 10,
          processingTime: 1000
        };
      });

      await service.streamProcessWithDataCloak('/test.csv', {
        onProgress: onProgressSpy
      });

      expect(onProgressSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedTimeRemaining: expect.any(Number),
          averageRowsPerSecond: expect.any(Number)
        })
      );
    });

    it('should handle generic errors', async () => {
      mockFileStreamService.streamProcessFile.mockRejectedValue(new Error('Stream failed'));

      await expect(service.streamProcessWithDataCloak('/test.csv'))
        .rejects.toThrow(new AppError('DataCloak streaming failed', 500, 'DATACLOAK_STREAM_ERROR'));
    });

    it('should pass through AppErrors', async () => {
      const appError = new AppError('Specific error', 400, 'SPECIFIC_ERROR');
      mockFileStreamService.streamProcessFile.mockRejectedValue(appError);

      await expect(service.streamProcessWithDataCloak('/test.csv'))
        .rejects.toThrow(appError);
    });
  });

  describe('validateChunkSize', () => {
    it('should use default chunk size when not specified', () => {
      const size = service['validateChunkSize']();
      expect(size).toBe(256 * 1024); // 256KB default
    });

    it('should accept valid chunk sizes', () => {
      const size = service['validateChunkSize'](512 * 1024);
      expect(size).toBe(512 * 1024);
    });

    it('should enforce minimum chunk size', () => {
      const size = service['validateChunkSize'](4 * 1024); // 4KB, below minimum
      expect(size).toBe(8 * 1024); // 8KB minimum
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chunk size 4096 is below minimum')
      );
    });

    it('should enforce maximum chunk size', () => {
      const size = service['validateChunkSize'](8 * 1024 * 1024); // 8MB, above maximum
      expect(size).toBe(4 * 1024 * 1024); // 4MB maximum
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chunk size 8388608 exceeds maximum')
      );
    });
  });

  describe('calculateEstimatedTime', () => {
    it('should calculate estimated time based on progress', () => {
      const progress = {
        chunksProcessed: 5,
        bytesProcessed: 500000,
        percentComplete: 50,
        currentChunkSize: 100000
      };
      const tracker = {
        startTime: Date.now() - 5000 // 5 seconds elapsed
      };

      const estimated = service['calculateEstimatedTime'](progress, tracker);
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThanOrEqual(5000); // Should be around 5 seconds remaining
    });

    it('should return 0 for invalid progress', () => {
      const progress = {
        chunksProcessed: 0,
        bytesProcessed: 0,
        percentComplete: 0,
        currentChunkSize: 0
      };
      const tracker = { startTime: Date.now() };

      const estimated = service['calculateEstimatedTime'](progress, tracker);
      expect(estimated).toBe(0);
    });

    it('should return 0 for completed progress', () => {
      const progress = {
        chunksProcessed: 10,
        bytesProcessed: 1000000,
        percentComplete: 100,
        currentChunkSize: 100000
      };
      const tracker = { startTime: Date.now() - 10000 };

      const estimated = service['calculateEstimatedTime'](progress, tracker);
      expect(estimated).toBe(0);
    });
  });

  describe('shouldMaskPIIType', () => {
    it('should mask PII types by default', () => {
      const result = service['shouldMaskPIIType']('EMAIL', undefined);
      expect(result).toBe(true);
    });

    it('should respect masking options', () => {
      const options = {
        email: false,
        phone: true,
        ssn: true
      };

      expect(service['shouldMaskPIIType']('EMAIL', options)).toBe(false);
      expect(service['shouldMaskPIIType']('PHONE', options)).toBe(true);
      expect(service['shouldMaskPIIType']('SSN', options)).toBe(true);
    });

    it('should mask unknown PII types by default', () => {
      const options = { email: false };
      expect(service['shouldMaskPIIType']('CUSTOM_PII', options)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty chunks', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [],
        processedRows: 0,
        isLastChunk: true
      };

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        await options.onChunk(mockChunk);
        return {
          totalRows: 0,
          totalBytes: 0,
          chunksProcessed: 1,
          processingTime: 10
        };
      });

      const result = await service.streamProcessWithDataCloak('/empty.csv');

      expect(result.piiSummary.totalPIIItems).toBe(0);
      expect(mockSecurityService.detectPII).not.toHaveBeenCalled();
    });

    it('should handle non-string field values', async () => {
      const mockChunk = {
        chunkIndex: 0,
        data: [
          { id: 123, active: true, score: 45.67, data: null, info: undefined }
        ],
        processedRows: 1,
        isLastChunk: false
      };

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        await options.onChunk(mockChunk);
        return {
          totalRows: 1,
          totalBytes: 100,
          chunksProcessed: 1,
          processingTime: 10
        };
      });

      const result = await service.streamProcessWithDataCloak('/test.csv');

      expect(result.piiSummary.totalPIIItems).toBe(0);
      expect(mockSecurityService.detectPII).not.toHaveBeenCalled();
    });

    it('should handle concurrent chunk processing', async () => {
      const chunks = Array(3).fill(null).map((_, i) => ({
        chunkIndex: i,
        data: [{ email: `test${i}@example.com` }],
        processedRows: 1,
        isLastChunk: i === 2
      }));

      mockSecurityService.detectPII.mockResolvedValue([
        { piiType: 'EMAIL', value: 'test@example.com', confidence: 0.95, position: { start: 0, end: 16 } }
      ]);

      mockFileStreamService.streamProcessFile.mockImplementation(async (_, options) => {
        // Simulate concurrent chunk processing
        await Promise.all(chunks.map(chunk => options.onChunk(chunk)));
        return {
          totalRows: 3,
          totalBytes: 300,
          chunksProcessed: 3,
          processingTime: 100
        };
      });

      const result = await service.streamProcessWithDataCloak('/test.csv');

      expect(result.piiSummary.totalPIIItems).toBe(3);
      expect(result.piiSummary.piiTypes.EMAIL).toBe(3);
    });
  });
});