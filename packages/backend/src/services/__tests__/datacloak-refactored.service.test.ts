import { DataCloakService } from '../datacloak.service';
import { dataCloakManager } from '../datacloak/manager';
import { DataCloakErrorCodes } from '../datacloak/types';
import { AppError } from '../../middleware/error.middleware';

// Mock the logger
jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock the manager
jest.mock('../datacloak/manager', () => ({
  dataCloakManager: {
    initialize: jest.fn(),
    detectPII: jest.fn(),
    maskText: jest.fn(),
    batchProcessPII: jest.fn(),
    auditSecurity: jest.fn(),
    getHealthStatus: jest.fn(),
    getState: jest.fn(),
    getSafeConfig: jest.fn(),
    updateConfig: jest.fn(),
    getCircuitBreakerMetrics: jest.fn()
  }
}));

describe('DataCloakService (Refactored)', () => {
  let service: DataCloakService;
  let mockManager: jest.Mocked<typeof dataCloakManager>;

  beforeEach(() => {
    service = new DataCloakService();
    mockManager = dataCloakManager as jest.Mocked<typeof dataCloakManager>;
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize the service', async () => {
      mockManager.initialize.mockResolvedValue();

      await service.initialize();

      expect(mockManager.initialize).toHaveBeenCalledWith(undefined);
    });

    it('should initialize with custom config', async () => {
      const config = { timeout: 5000, enableMonitoring: true };
      mockManager.initialize.mockResolvedValue();

      await service.initialize(config);

      expect(mockManager.initialize).toHaveBeenCalledWith(config);
    });

    it('should handle initialization errors', async () => {
      mockManager.initialize.mockRejectedValue(new Error('Initialization failed'));

      await expect(service.initialize()).rejects.toThrow('Initialization failed');
    });
  });

  describe('detectPII', () => {
    it('should detect PII successfully', async () => {
      const mockResult = {
        success: true,
        data: [
          {
            fieldName: 'text',
            piiType: 'EMAIL',
            confidence: 0.95,
            sample: 'test@example.com',
            masked: '****@*******.***'
          }
        ]
      };
      mockManager.detectPII.mockResolvedValue(mockResult);

      const result = await service.detectPII('Contact me at test@example.com');

      expect(result).toEqual(mockResult.data);
      expect(mockManager.detectPII).toHaveBeenCalledWith('Contact me at test@example.com');
    });

    it('should throw error when PII detection fails', async () => {
      const mockResult = {
        success: false,
        error: {
          code: DataCloakErrorCodes.PII_DETECTION_FAILED,
          message: 'PII detection failed',
          type: 'processing' as const,
          retryable: true
        }
      };
      mockManager.detectPII.mockResolvedValue(mockResult);

      await expect(service.detectPII('test text')).rejects.toThrow(AppError);
      await expect(service.detectPII('test text')).rejects.toThrow('PII detection failed');
    });

    it('should handle unexpected errors', async () => {
      mockManager.detectPII.mockRejectedValue(new Error('Unexpected error'));

      await expect(service.detectPII('test text')).rejects.toThrow('Unexpected error');
    });
  });

  describe('maskText', () => {
    it('should mask text successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          originalText: 'Contact me at test@example.com',
          maskedText: 'Contact me at ****@*******.***',
          detectedPII: [],
          metadata: {
            processingTime: 50,
            fieldsProcessed: 1,
            piiItemsFound: 1
          }
        }
      };
      mockManager.maskText.mockResolvedValue(mockResult);

      const result = await service.maskText('Contact me at test@example.com');

      expect(result).toEqual({
        originalText: 'Contact me at test@example.com',
        maskedText: 'Contact me at ****@*******.***',
        piiItemsFound: 1
      });
    });

    it('should throw error when masking fails', async () => {
      const mockResult = {
        success: false,
        error: {
          code: DataCloakErrorCodes.TEXT_MASKING_FAILED,
          message: 'Text masking failed',
          type: 'processing' as const,
          retryable: true
        }
      };
      mockManager.maskText.mockResolvedValue(mockResult);

      await expect(service.maskText('test text')).rejects.toThrow(AppError);
      await expect(service.maskText('test text')).rejects.toThrow('Text masking failed');
    });
  });

  describe('detectPIIBatch', () => {
    it('should process batch PII detection successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          results: [
            [{ fieldName: 'text', piiType: 'EMAIL', confidence: 0.95, sample: 'test1@example.com', masked: '****@*******.***' }],
            [{ fieldName: 'text', piiType: 'PHONE', confidence: 0.90, sample: '123-456-7890', masked: '***-***-****' }]
          ]
        }
      };
      mockManager.batchProcessPII.mockResolvedValue(mockResult);

      const result = await service.detectPIIBatch(['text1', 'text2']);

      expect(result).toEqual(mockResult.data.results);
      expect(mockManager.batchProcessPII).toHaveBeenCalledWith(['text1', 'text2']);
    });

    it('should throw error when batch processing fails', async () => {
      const mockResult = {
        success: false,
        error: {
          code: DataCloakErrorCodes.BATCH_PROCESSING_FAILED,
          message: 'Batch processing failed',
          type: 'processing' as const,
          retryable: true
        }
      };
      mockManager.batchProcessPII.mockResolvedValue(mockResult);

      await expect(service.detectPIIBatch(['text1', 'text2'])).rejects.toThrow(AppError);
    });
  });

  describe('maskTextBatch', () => {
    it('should process batch text masking successfully', async () => {
      // Mock multiple maskText calls
      const mockResults = [
        { originalText: 'text1', maskedText: 'masked1', piiItemsFound: 1 },
        { originalText: 'text2', maskedText: 'masked2', piiItemsFound: 0 }
      ];

      service.maskText = jest.fn()
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      const result = await service.maskTextBatch(['text1', 'text2']);

      expect(result).toEqual(mockResults);
      expect(service.maskText).toHaveBeenCalledTimes(2);
    });

    it('should handle large batches', async () => {
      const texts = new Array(250).fill('test text');
      
      service.maskText = jest.fn().mockResolvedValue({
        originalText: 'test text',
        maskedText: 'test text',
        piiItemsFound: 0
      });

      const result = await service.maskTextBatch(texts);

      expect(result).toHaveLength(250);
      expect(service.maskText).toHaveBeenCalledTimes(250);
    });
  });

  describe('auditSecurity', () => {
    it('should audit security successfully', async () => {
      const mockResult = {
        success: true,
        data: {
          timestamp: new Date(),
          fileProcessed: 'test.txt',
          piiItemsDetected: 5,
          maskingAccuracy: 0.95,
          encryptionStatus: 'enabled' as const,
          complianceScore: 0.88,
          violations: [],
          recommendations: ['Enable logging'],
          riskAssessment: {
            overallRisk: 'low' as const,
            factors: [],
            score: 25,
            mitigationSuggestions: []
          }
        }
      };
      mockManager.auditSecurity.mockResolvedValue(mockResult);

      const result = await service.auditSecurity('test.txt');

      expect(result).toEqual(mockResult.data);
      expect(mockManager.auditSecurity).toHaveBeenCalledWith('test.txt');
    });

    it('should throw error when audit fails', async () => {
      const mockResult = {
        success: false,
        error: {
          code: DataCloakErrorCodes.SYSTEM_ERROR,
          message: 'Security audit failed',
          type: 'system' as const,
          retryable: false
        }
      };
      mockManager.auditSecurity.mockResolvedValue(mockResult);

      await expect(service.auditSecurity('test.txt')).rejects.toThrow(AppError);
    });
  });

  describe('health and status', () => {
    it('should get health status', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        version: '1.0.0',
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
          errorRate: 0.01
        }
      };
      mockManager.getHealthStatus.mockResolvedValue(mockHealth);

      const result = await service.getHealthStatus();

      expect(result).toEqual(mockHealth);
    });

    it('should check availability', () => {
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
    });

    it('should get safe config', () => {
      const mockConfig = {
        timeout: 30000,
        retryAttempts: 3,
        enableMonitoring: true
      };
      mockManager.getSafeConfig.mockReturnValue(mockConfig);

      const result = service.getConfig();

      expect(result).toEqual(mockConfig);
    });

    it('should get version', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        version: '1.2.3',
        uptime: 3600,
        lastCheck: new Date(),
        services: { ffi: true, binary: false, mock: false },
        performance: { averageResponseTime: 150, requestsPerSecond: 10, errorRate: 0.01 }
      };
      mockManager.getHealthStatus.mockResolvedValue(mockHealth);

      const result = await service.getVersion();

      expect(result).toBe('1.2.3');
    });
  });

  describe('configuration', () => {
    it('should update configuration', async () => {
      const config = { timeout: 5000, enableMonitoring: true };
      mockManager.updateConfig.mockResolvedValue();

      await service.updateConfig(config);

      expect(mockManager.updateConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('circuit breaker', () => {
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
    });
  });

  describe('service state', () => {
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
    });
  });
});