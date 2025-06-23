import { DataCloakService, dataCloak } from '../datacloak.service';
import { dataCloakManager } from '../datacloak/manager';
import { AppError } from '../../middleware/error.middleware';
import {
  DataCloakConfig,
  PIIDetectionResult,
  MaskingResult,
  SecurityAuditResult,
  ServiceOperationResult,
  DataCloakErrorCodes
} from '../datacloak/types';

// Mock the manager
jest.mock('../datacloak/manager', () => ({
  dataCloakManager: {
    initialize: jest.fn(),
    updateConfig: jest.fn(),
    detectPII: jest.fn(),
    maskText: jest.fn(),
    batchProcessPII: jest.fn(),
    auditSecurity: jest.fn(),
    getHealthStatus: jest.fn(),
    getState: jest.fn(),
    getSafeConfig: jest.fn(),
    getCircuitBreakerMetrics: jest.fn(),
    reset: jest.fn()
  }
}));

describe('DataCloakService', () => {
  let service: DataCloakService;
  let mockManager: jest.Mocked<typeof dataCloakManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockManager = dataCloakManager as jest.Mocked<typeof dataCloakManager>;
    service = new DataCloakService();
  });

  describe('initialization', () => {
    it('should initialize with optional config', async () => {
      const config: Partial<DataCloakConfig> = {
        timeout: 5000,
        retryAttempts: 2
      };

      await service.initialize(config);

      expect(mockManager.initialize).toHaveBeenCalledWith(config);
    });

    it('should update manager config during construction', () => {
      const config: Partial<DataCloakConfig> = {
        endpoint: 'https://custom.endpoint.com'
      };

      new DataCloakService(config);

      expect(mockManager.updateConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('detectPII', () => {
    it('should detect PII successfully', async () => {
      const mockPIIResults: PIIDetectionResult[] = [
        {
          fieldName: 'text',
          piiType: 'EMAIL',
          confidence: 0.95,
          sample: 'john@example.com',
          masked: '****@*******.***',
          position: { start: 0, end: 16 }
        }
      ];

      const mockResponse: ServiceOperationResult<PIIDetectionResult[]> = {
        success: true,
        data: mockPIIResults,
        metadata: {
          executionTime: 150,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.detectPII.mockResolvedValue(mockResponse);

      const result = await service.detectPII('My email is john@example.com');

      expect(result).toEqual(mockPIIResults);
      expect(mockManager.detectPII).toHaveBeenCalledWith('My email is john@example.com');
    });

    it('should throw AppError when detection fails', async () => {
      const mockResponse: ServiceOperationResult<PIIDetectionResult[]> = {
        success: false,
        error: {
          code: DataCloakErrorCodes.PII_DETECTION_FAILED,
          message: 'PII detection service unavailable',
          type: 'external',
          retryable: true
        },
        metadata: {
          executionTime: 5000,
          retryCount: 3,
          fallbackUsed: false,
          circuitBreakerState: 'OPEN' as any
        }
      };

      mockManager.detectPII.mockResolvedValue(mockResponse);

      await expect(service.detectPII('test text')).rejects.toThrow(
        new AppError('PII detection service unavailable', 500, DataCloakErrorCodes.PII_DETECTION_FAILED)
      );
    });

    it('should use default error when no error details provided', async () => {
      const mockResponse: ServiceOperationResult<PIIDetectionResult[]> = {
        success: false,
        metadata: {
          executionTime: 100,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.detectPII.mockResolvedValue(mockResponse);

      await expect(service.detectPII('test')).rejects.toThrow(
        new AppError('PII detection failed', 500, DataCloakErrorCodes.PII_DETECTION_FAILED)
      );
    });
  });

  describe('maskText', () => {
    it('should mask text successfully', async () => {
      const mockMaskingResult: MaskingResult = {
        originalText: 'My email is john@example.com',
        maskedText: 'My email is ****@*******.***',
        detectedPII: [
          {
            fieldName: 'text',
            piiType: 'EMAIL',
            confidence: 0.95,
            sample: 'john@example.com',
            masked: '****@*******.***',
            position: { start: 12, end: 28 }
          }
        ],
        metadata: {
          processingTime: 100,
          fieldsProcessed: 1,
          piiItemsFound: 1,
          fallbackUsed: false,
          processingMode: 'standard',
          version: '1.2.0'
        }
      };

      const mockResponse: ServiceOperationResult<MaskingResult> = {
        success: true,
        data: mockMaskingResult,
        metadata: {
          executionTime: 100,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.maskText.mockResolvedValue(mockResponse);

      const result = await service.maskText('My email is john@example.com');

      expect(result).toEqual({
        originalText: 'My email is john@example.com',
        maskedText: 'My email is ****@*******.***',
        piiItemsFound: 1
      });
      expect(mockManager.maskText).toHaveBeenCalledWith('My email is john@example.com');
    });

    it('should throw AppError when masking fails', async () => {
      const mockResponse: ServiceOperationResult<MaskingResult> = {
        success: false,
        error: {
          code: DataCloakErrorCodes.TEXT_MASKING_FAILED,
          message: 'Text masking service error',
          type: 'processing',
          retryable: false
        },
        metadata: {
          executionTime: 200,
          retryCount: 0,
          fallbackUsed: true,
          circuitBreakerState: 'HALF_OPEN' as any
        }
      };

      mockManager.maskText.mockResolvedValue(mockResponse);

      await expect(service.maskText('test text')).rejects.toThrow(
        new AppError('Text masking service error', 500, DataCloakErrorCodes.TEXT_MASKING_FAILED)
      );
    });
  });

  describe('detectPIIBatch', () => {
    it('should process batch of texts', async () => {
      const texts = ['Email: john@example.com', 'Phone: 555-123-4567'];
      const mockBatchResult = {
        totalItems: 2,
        processedItems: 2,
        failedItems: 0,
        results: [
          [
            {
              fieldName: 'text',
              piiType: 'EMAIL',
              confidence: 0.95,
              sample: 'john@example.com',
              masked: '****@*******.***',
              position: { start: 7, end: 23 }
            }
          ],
          [
            {
              fieldName: 'text',
              piiType: 'PHONE',
              confidence: 0.90,
              sample: '555-123-4567',
              masked: '***-***-****',
              position: { start: 7, end: 19 }
            }
          ]
        ],
        errors: [],
        executionTime: 250
      };

      const mockResponse: ServiceOperationResult<typeof mockBatchResult> = {
        success: true,
        data: mockBatchResult,
        metadata: {
          executionTime: 250,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.batchProcessPII.mockResolvedValue(mockResponse);

      const result = await service.detectPIIBatch(texts);

      expect(result).toEqual(mockBatchResult.results);
      expect(mockManager.batchProcessPII).toHaveBeenCalledWith(texts);
    });

    it('should handle batch processing errors', async () => {
      const texts = ['test1', 'test2'];
      
      const mockResponse: ServiceOperationResult<any> = {
        success: false,
        error: {
          code: DataCloakErrorCodes.BATCH_PROCESSING_FAILED,
          message: 'Batch processing failed',
          type: 'processing',
          retryable: true
        },
        metadata: {
          executionTime: 100,
          retryCount: 1,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.batchProcessPII.mockResolvedValue(mockResponse);

      await expect(service.detectPIIBatch(texts)).rejects.toThrow(
        new AppError('Batch processing failed', 500, DataCloakErrorCodes.BATCH_PROCESSING_FAILED)
      );
    });

    it('should handle empty batch', async () => {
      const mockBatchResult = {
        totalItems: 0,
        processedItems: 0,
        failedItems: 0,
        results: [],
        errors: [],
        executionTime: 5
      };

      const mockResponse: ServiceOperationResult<typeof mockBatchResult> = {
        success: true,
        data: mockBatchResult,
        metadata: {
          executionTime: 5,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.batchProcessPII.mockResolvedValue(mockResponse);

      const result = await service.detectPIIBatch([]);

      expect(result).toEqual([]);
      expect(mockManager.batchProcessPII).toHaveBeenCalledWith([]);
    });
  });

  describe('maskTextBatch', () => {
    it('should process batch of texts for masking', async () => {
      const texts = ['Email: john@example.com', 'Phone: 555-123-4567'];
      
      // Mock individual maskText calls
      const maskResults = [
        {
          originalText: 'Email: john@example.com',
          maskedText: 'Email: ****@*******.***',
          piiItemsFound: 1
        },
        {
          originalText: 'Phone: 555-123-4567',
          maskedText: 'Phone: ***-***-****',
          piiItemsFound: 1
        }
      ];

      // Mock each individual call
      mockManager.maskText
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'Email: john@example.com',
            maskedText: 'Email: ****@*******.***',
            detectedPII: [],
            metadata: { piiItemsFound: 1 }
          } as MaskingResult,
          metadata: {} as any
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'Phone: 555-123-4567',
            maskedText: 'Phone: ***-***-****',
            detectedPII: [],
            metadata: { piiItemsFound: 1 }
          } as MaskingResult,
          metadata: {} as any
        });

      const result = await service.maskTextBatch(texts);

      expect(result).toEqual(maskResults);
      expect(mockManager.maskText).toHaveBeenCalledTimes(2);
    });

    it('should process large batches in chunks', async () => {
      const texts = new Array(250).fill('test text'); // More than default batch size of 100
      
      // Mock all calls to return success
      mockManager.maskText.mockResolvedValue({
        success: true,
        data: {
          originalText: 'test text',
          maskedText: 'test text',
          detectedPII: [],
          metadata: { piiItemsFound: 0 }
        } as MaskingResult,
        metadata: {} as any
      });

      const result = await service.maskTextBatch(texts);

      expect(result).toHaveLength(250);
      expect(mockManager.maskText).toHaveBeenCalledTimes(250);
    });

    it('should handle empty batch', async () => {
      const result = await service.maskTextBatch([]);

      expect(result).toEqual([]);
      expect(mockManager.maskText).not.toHaveBeenCalled();
    });
  });

  describe('auditSecurity', () => {
    it('should perform security audit', async () => {
      const mockAuditResult: SecurityAuditResult = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        fileProcessed: '/path/to/test-file.txt',
        piiItemsDetected: 5,
        maskingAccuracy: 0.92,
        encryptionStatus: 'enabled',
        complianceScore: 0.85,
        violations: ['Unmasked email addresses found'],
        recommendations: ['Apply email masking', 'Implement field-level encryption'],
        riskAssessment: {
          overallRisk: 'medium',
          factors: ['PII exposure', 'Compliance gap'],
          score: 65,
          mitigationSuggestions: ['Enable automatic masking', 'Review data handling policies']
        }
      };

      const mockResponse: ServiceOperationResult<SecurityAuditResult> = {
        success: true,
        data: mockAuditResult,
        metadata: {
          executionTime: 500,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.auditSecurity.mockResolvedValue(mockResponse);

      const result = await service.auditSecurity('/path/to/test-file.txt');

      expect(result).toEqual(mockAuditResult);
      expect(mockManager.auditSecurity).toHaveBeenCalledWith('/path/to/test-file.txt');
    });

    it('should throw AppError when audit fails', async () => {
      const mockResponse: ServiceOperationResult<SecurityAuditResult> = {
        success: false,
        error: {
          code: DataCloakErrorCodes.SYSTEM_ERROR,
          message: 'File not found',
          type: 'validation',
          retryable: false
        },
        metadata: {
          executionTime: 50,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'CLOSED' as any
        }
      };

      mockManager.auditSecurity.mockResolvedValue(mockResponse);

      await expect(service.auditSecurity('/invalid/path')).rejects.toThrow(
        new AppError('File not found', 500, DataCloakErrorCodes.SYSTEM_ERROR)
      );
    });
  });

  describe('utility methods', () => {
    it('should get health status', async () => {
      const mockHealthStatus = {
        status: 'healthy' as const,
        version: '1.2.0',
        uptime: 3600,
        lastCheck: new Date(),
        services: {
          ffi: true,
          binary: false,
          mock: false
        },
        performance: {
          averageResponseTime: 150,
          requestsPerSecond: 10,
          errorRate: 0.02
        }
      };

      mockManager.getHealthStatus.mockResolvedValue(mockHealthStatus);

      const result = await service.getHealthStatus();

      expect(result).toEqual(mockHealthStatus);
      expect(mockManager.getHealthStatus).toHaveBeenCalled();
    });

    it('should check if service is available', () => {
      mockManager.getState.mockReturnValue({
        initialized: true,
        healthy: true,
        stats: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 150
        }
      });

      const result = service.isAvailable();

      expect(result).toBe(true);
      expect(mockManager.getState).toHaveBeenCalled();
    });

    it('should return false when service is unhealthy', () => {
      mockManager.getState.mockReturnValue({
        initialized: true,
        healthy: false,
        stats: {
          totalRequests: 10,
          successfulRequests: 5,
          failedRequests: 5,
          averageResponseTime: 2000
        }
      });

      const result = service.isAvailable();

      expect(result).toBe(false);
    });

    it('should get configuration without sensitive data', () => {
      const mockConfig = {
        endpoint: 'https://api.datacloak.com',
        timeout: 30000,
        retryAttempts: 3,
        fallbackToMock: true,
        batchSize: 100
      };

      mockManager.getSafeConfig.mockReturnValue(mockConfig);

      const result = service.getConfig();

      expect(result).toEqual(mockConfig);
      expect(mockManager.getSafeConfig).toHaveBeenCalled();
    });

    it('should get version', async () => {
      const mockHealthStatus = {
        status: 'healthy' as const,
        version: '1.2.0',
        uptime: 3600,
        lastCheck: new Date(),
        services: { ffi: true, binary: false, mock: false },
        performance: { averageResponseTime: 150, requestsPerSecond: 10, errorRate: 0.02 }
      };

      mockManager.getHealthStatus.mockResolvedValue(mockHealthStatus);

      const result = await service.getVersion();

      expect(result).toBe('1.2.0');
      expect(mockManager.getHealthStatus).toHaveBeenCalled();
    });

    it('should update configuration', async () => {
      const newConfig = { timeout: 5000, retryAttempts: 5 };

      await service.updateConfig(newConfig);

      expect(mockManager.updateConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should get circuit breaker status', () => {
      const mockMetrics = {
        state: 'CLOSED' as const,
        failures: 0,
        successes: 10,
        totalRequests: 10,
        errorPercentage: 0
      };

      mockManager.getCircuitBreakerMetrics.mockReturnValue(mockMetrics);

      const result = service.getCircuitBreakerStatus();

      expect(result).toEqual(mockMetrics);
      expect(mockManager.getCircuitBreakerMetrics).toHaveBeenCalled();
    });

    it('should get service state', () => {
      const mockState = {
        initialized: true,
        healthy: true,
        stats: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 150
        }
      };

      mockManager.getState.mockReturnValue(mockState);

      const result = service.getServiceState();

      expect(result).toEqual(mockState);
      expect(mockManager.getState).toHaveBeenCalled();
    });
  });

  describe('singleton instance', () => {
    it('should provide a singleton instance', () => {
      expect(dataCloak).toBeInstanceOf(DataCloakService);
    });

    it('should return the same instance on multiple accesses', () => {
      const instance1 = dataCloak;
      const instance2 = dataCloak;
      
      expect(instance1).toBe(instance2);
    });
  });
});