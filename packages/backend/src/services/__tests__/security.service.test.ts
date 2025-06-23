// Mock dependencies BEFORE importing the service
jest.mock('../../database/sqlite-refactored', () => ({
  withSQLiteConnection: jest.fn(),
  getSQLiteConnection: jest.fn(),
  initializeSQLite: jest.fn(),
  closeSQLiteConnection: jest.fn()
}));
jest.mock('../datacloak-wrapper');
jest.mock('../cache.service');
jest.mock('../compliance.service');

import { SecurityService } from '../security.service';
import { AppError } from '../../middleware/error.middleware';
import { getDataCloakInstance } from '../datacloak-wrapper';
import { getCacheService } from '../cache.service';
import { ComplianceService } from '../compliance.service';
import * as crypto from 'crypto';
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

// Mock fs for file operations
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn()
  }
}));

describe('SecurityService', () => {
  let service: SecurityService;
  let mockDataCloak: any;
  let mockCacheService: any;
  let mockComplianceService: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock DataCloak instance
    mockDataCloak = {
      initialize: jest.fn().mockResolvedValue(undefined),
      detectPII: jest.fn().mockResolvedValue([]),
      maskText: jest.fn().mockResolvedValue({
        maskedText: 'masked text',
        piiItemsFound: 0
      }),
      auditSecurity: jest.fn().mockResolvedValue({
        complianceScore: 0.85,
        violations: [],
        recommendations: ['Enable encryption', 'Review access controls'],
        piiItemsDetected: 2,
        piiResults: [],
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      })
    };
    (getDataCloakInstance as jest.Mock).mockResolvedValue(mockDataCloak);

    // Mock cache service
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    };
    (getCacheService as jest.Mock).mockReturnValue(mockCacheService);

    // Mock compliance service
    mockComplianceService = {
      performComplianceAudit: jest.fn().mockReturnValue({
        overall: {
          score: 85,
          status: 'compliant' as const,
          frameworks: ['GDPR', 'CCPA', 'HIPAA']
        },
        gdpr: { score: 90, status: 'compliant' as const, violations: [], recommendations: [] },
        ccpa: { score: 85, status: 'compliant' as const, violations: [], recommendations: [] },
        hipaa: { score: 80, status: 'needs_review' as const, violations: [], recommendations: [] },
        summary: {
          violations: [],
          recommendations: ['Enable encryption', 'Review access controls']
        },
        auditId: 'audit-123',
        timestamp: new Date().toISOString()
      })
    };
    (ComplianceService as jest.Mock).mockImplementation(() => mockComplianceService);

    // Mock database
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn()
      })
    };
    (getSQLiteConnection as jest.Mock).mockReturnValue(mockDb);

    service = new SecurityService();
  });

  describe('initialization', () => {
    it('should initialize with DataCloak', async () => {
      expect(service).toBeDefined();
      expect(getDataCloakInstance).toHaveBeenCalled();
    });

    it('should initialize DataCloak on first operation', async () => {
      await service.initialize();

      expect(mockDataCloak.initialize).toHaveBeenCalledWith({});
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();

      expect(mockDataCloak.initialize).toHaveBeenCalledTimes(1);
    });

    it('should throw error if DataCloak initialization fails', async () => {
      mockDataCloak.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(service.initialize()).rejects.toThrow(
        new AppError('Failed to initialize security service', 500, 'SECURITY_INIT_ERROR')
      );
    });
  });

  describe('detectPII', () => {
    const mockPIIResults = [
      {
        piiType: 'EMAIL',
        sample: 'test@example.com',
        confidence: 0.95
      },
      {
        piiType: 'PHONE',
        sample: '555-1234',
        confidence: 0.90
      }
    ];

    beforeEach(() => {
      mockDataCloak.detectPII.mockResolvedValue(mockPIIResults);
    });

    it('should detect PII in text', async () => {
      const text = 'Contact me at test@example.com or 555-1234';
      const results = await service.detectPII(text);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        type: 'EMAIL',
        value: 'test@example.com',
        confidence: 0.95,
        piiType: 'EMAIL'
      });
      expect(results[1]).toMatchObject({
        type: 'PHONE',
        value: '555-1234',
        confidence: 0.90,
        piiType: 'PHONE'
      });

      expect(mockDataCloak.detectPII).toHaveBeenCalledWith(text);
    });

    it('should calculate text positions for detected PII', async () => {
      const text = 'Contact me at test@example.com or call 555-1234';
      const results = await service.detectPII(text);

      expect(results[0].position).toEqual({
        start: text.indexOf('test@example.com'),
        end: text.indexOf('test@example.com') + 'test@example.com'.length
      });
    });

    it('should handle empty text', async () => {
      await expect(service.detectPII('')).rejects.toThrow(
        new AppError('Text is required for PII detection', 400, 'INVALID_TEXT')
      );

      await expect(service.detectPII('   ')).rejects.toThrow(
        new AppError('Text is required for PII detection', 400, 'INVALID_TEXT')
      );
    });

    it('should cache PII detection results', async () => {
      const text = 'test@example.com';
      const hash = crypto.createHash('sha256')
        .update(text.trim().toLowerCase())
        .digest('hex');
      const cacheKey = `pii:detect:${hash}`;

      await service.detectPII(text);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Array),
        { ttl: 1800 }
      );
    });

    it('should return cached results if available', async () => {
      const cachedResults = [
        {
          type: 'EMAIL',
          value: 'cached@example.com',
          position: { start: 0, end: 17 },
          confidence: 0.99,
          piiType: 'EMAIL'
        }
      ];
      mockCacheService.get.mockResolvedValue(cachedResults);

      const results = await service.detectPII('cached@example.com');

      expect(results).toEqual(cachedResults);
      expect(mockDataCloak.detectPII).not.toHaveBeenCalled();
    });

    it('should log security event for PII detection', async () => {
      await service.detectPII('test@example.com');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_events')
      );
      
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'pii_detected',
        'medium',
        expect.stringContaining('"piiFound":2'),
        'api_request'
      );
    });

    it('should handle DataCloak errors', async () => {
      mockDataCloak.detectPII.mockRejectedValue(new Error('DataCloak error'));

      await expect(service.detectPII('test text')).rejects.toThrow(
        new AppError('PII detection failed', 500, 'PII_DETECTION_ERROR')
      );
    });

    it('should handle cache errors gracefully', async () => {
      mockCacheService.set.mockRejectedValue(new Error('Cache error'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const results = await service.detectPII('test@example.com');

      expect(results).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cache PII detection result:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('maskText', () => {
    const mockMaskedResult = {
      maskedText: 'Contact me at [EMAIL_MASKED] or [PHONE_MASKED]',
      piiItemsFound: 2
    };

    beforeEach(() => {
      mockDataCloak.maskText.mockResolvedValue(mockMaskedResult);
      mockDataCloak.detectPII.mockResolvedValue([
        { piiType: 'EMAIL', sample: 'test@example.com', confidence: 0.95 },
        { piiType: 'PHONE', sample: '555-1234', confidence: 0.90 }
      ]);
    });

    it('should mask text with detected PII', async () => {
      const text = 'Contact me at test@example.com or 555-1234';
      const result = await service.maskText(text);

      expect(result).toMatchObject({
        originalText: text,
        maskedText: expect.any(String),
        detectedPII: expect.any(Array),
        maskingAccuracy: 0.98,
        metadata: {
          processingTime: expect.any(Number),
          fieldsProcessed: 1,
          piiItemsFound: 2
        }
      });

      expect(mockDataCloak.maskText).toHaveBeenCalledWith(text);
    });

    it('should preserve format by default', async () => {
      const text = 'test@example.com';
      const result = await service.maskText(text);

      expect(result.maskedText).toBe(mockMaskedResult.maskedText);
    });

    it('should replace with type labels when preserveFormat is false', async () => {
      const text = 'Contact me at test@example.com or 555-1234';
      const result = await service.maskText(text, { preserveFormat: false });

      expect(result.maskedText).toContain('[EMAIL_MASKED]');
      expect(result.maskedText).toContain('[PHONE_MASKED]');
    });

    it('should handle empty text', async () => {
      await expect(service.maskText('')).rejects.toThrow(
        new AppError('Text is required for masking', 400, 'INVALID_TEXT')
      );
    });

    it('should cache masking results', async () => {
      const text = 'test@example.com';
      const hash = crypto.createHash('sha256')
        .update(text.trim().toLowerCase() + 'default')
        .digest('hex');
      const cacheKey = `pii:mask:${hash}`;

      await service.maskText(text);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        { ttl: 1800 }
      );
    });

    it('should return cached results if available', async () => {
      const cachedResult = {
        originalText: 'cached',
        maskedText: '[MASKED]',
        detectedPII: [],
        maskingAccuracy: 0.99,
        metadata: { processingTime: 10, fieldsProcessed: 1, piiItemsFound: 0 }
      };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.maskText('cached');

      expect(result).toEqual(cachedResult);
      expect(mockDataCloak.maskText).not.toHaveBeenCalled();
    });

    it('should log masking event', async () => {
      const text = 'test@example.com';
      await service.maskText(text);

      expect(mockDb.prepare).toHaveBeenCalled();
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'text_masked',
        'low',
        expect.stringContaining('"piiCount":2'),
        'api_request'
      );
    });

    it('should handle DataCloak errors', async () => {
      mockDataCloak.maskText.mockRejectedValue(new Error('Masking failed'));

      await expect(service.maskText('test')).rejects.toThrow(
        new AppError('Text masking failed', 500, 'MASKING_ERROR')
      );
    });
  });

  describe('auditSecurity', () => {
    it('should perform security audit without file', async () => {
      const result = await service.auditSecurity();

      expect(result).toMatchObject({
        score: 85,
        findings: expect.arrayContaining([
          { type: 'info', message: 'Compliance audit completed for GDPR, CCPA, HIPAA' },
          { type: 'info', message: 'GDPR Score: 90%' },
          { type: 'info', message: 'CCPA Score: 85%' },
          { type: 'info', message: 'HIPAA Score: 80%' }
        ]),
        piiItemsDetected: 0,
        complianceScore: 85,
        recommendations: expect.any(Array),
        violations: [],
        fileProcessed: false,
        maskingAccuracy: 0.98,
        encryptionStatus: 'disabled'
      });
    });

    it('should perform security audit with file', async () => {
      const fs = require('fs').promises;
      fs.stat.mockResolvedValue({ size: 1024 });

      mockDataCloak.auditSecurity.mockResolvedValue({
        piiResults: [
          { piiType: 'EMAIL', sample: 'test@example.com' },
          { piiType: 'SSN', sample: '***-**-1234' }
        ],
        complianceScore: 0.75,
        violations: ['Unencrypted PII detected'],
        recommendations: ['Enable encryption'],
        piiItemsDetected: 2,
        maskingAccuracy: 0.95,
        encryptionStatus: 'disabled'
      });

      const result = await service.auditSecurity('/path/to/file.csv');

      expect(result.fileProcessed).toBe(true);
      expect(result.piiItemsDetected).toBeGreaterThan(0);
      expect(mockDataCloak.auditSecurity).toHaveBeenCalledWith('/path/to/file.csv');
    });

    it('should handle compliance violations', async () => {
      mockComplianceService.performComplianceAudit.mockReturnValue({
        overall: { score: 45, status: 'non_compliant', frameworks: ['GDPR'] },
        gdpr: { score: 45, status: 'non_compliant', violations: [], recommendations: [] },
        ccpa: { score: 50, status: 'non_compliant', violations: [], recommendations: [] },
        hipaa: { score: 40, status: 'non_compliant', violations: [], recommendations: [] },
        summary: {
          violations: [
            {
              severity: 'critical',
              message: 'No user consent mechanism',
              description: 'GDPR violation',
              remediation: 'Implement consent management'
            }
          ],
          recommendations: ['Implement user consent']
        },
        auditId: 'audit-123',
        timestamp: new Date().toISOString()
      });

      const result = await service.auditSecurity();

      expect(result.score).toBe(45);
      expect(result.findings).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: 'No user consent mechanism'
        })
      );
      expect(result.violations).toHaveLength(1);
    });

    it('should detect health data', async () => {
      mockDataCloak.auditSecurity.mockResolvedValue({
        piiResults: [
          { piiType: 'MEDICAL_RECORD', sample: 'patient data' }
        ],
        complianceScore: 0.80,
        violations: [],
        recommendations: [],
        piiItemsDetected: 1,
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      });

      await service.auditSecurity('/medical/file.csv');

      expect(mockComplianceService.performComplianceAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          containsHealthData: true
        })
      );
    });

    it('should detect financial data', async () => {
      mockDataCloak.auditSecurity.mockResolvedValue({
        piiResults: [
          { piiType: 'CREDIT_CARD', sample: '****1234' },
          { piiType: 'SSN', sample: '***-**-5678' }
        ],
        complianceScore: 0.80,
        violations: [],
        recommendations: [],
        piiItemsDetected: 2,
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      });

      await service.auditSecurity('/financial/data.csv');

      expect(mockComplianceService.performComplianceAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          containsFinancialData: true
        })
      );
    });

    it('should log audit event', async () => {
      await service.auditSecurity();

      expect(mockDb.prepare).toHaveBeenCalled();
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'security_audit',
        'low',
        expect.stringContaining('"overallScore":85'),
        'api_request'
      );
    });

    it('should handle audit errors', async () => {
      mockComplianceService.performComplianceAudit.mockImplementation(() => {
        throw new Error('Audit failed');
      });

      await expect(service.auditSecurity()).rejects.toThrow(
        new AppError('Security audit failed', 500, 'AUDIT_ERROR')
      );
    });

    it('should handle DataCloak failures gracefully', async () => {
      mockDataCloak.auditSecurity.mockRejectedValue(new Error('DataCloak error'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.auditSecurity('/path/to/file');

      expect(result).toBeDefined();
      expect(result.piiItemsDetected).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'DataCloak audit failed, proceeding with basic audit:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('auditFile', () => {
    it('should audit a file for security issues', async () => {
      const result = await service.auditFile('/path/to/file.csv');

      expect(result).toMatchObject({
        score: 85,
        findings: expect.arrayContaining([
          { type: 'info', message: 'File analyzed: /path/to/file.csv' }
        ]),
        piiItemsDetected: 2,
        complianceScore: 85,
        recommendations: expect.any(Array),
        violations: [],
        fileProcessed: true,
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      });

      expect(mockDataCloak.auditSecurity).toHaveBeenCalledWith('/path/to/file.csv');
    });

    it('should handle invalid file path', async () => {
      await expect(service.auditFile('')).rejects.toThrow(
        new AppError('File path is required and must be a string', 400, 'INVALID_FILE_PATH')
      );

      await expect(service.auditFile(null as any)).rejects.toThrow(
        new AppError('File path is required and must be a string', 400, 'INVALID_FILE_PATH')
      );
    });

    it('should include violations in findings', async () => {
      mockDataCloak.auditSecurity.mockResolvedValue({
        complianceScore: 0.60,
        violations: ['No encryption', 'Missing access controls'],
        recommendations: ['Enable encryption', 'Implement RBAC'],
        piiItemsDetected: 5,
        maskingAccuracy: 0.90,
        encryptionStatus: 'disabled'
      });

      const result = await service.auditFile('/path/to/file.csv');

      expect(result.findings).toContainEqual(
        { type: 'warning', message: 'No encryption' }
      );
      expect(result.findings).toContainEqual(
        { type: 'warning', message: 'Missing access controls' }
      );
      expect(result.violations).toHaveLength(2);
    });

    it('should log file audit event', async () => {
      await service.auditFile('/path/to/file.csv');

      expect(mockDb.prepare).toHaveBeenCalled();
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'file_audit',
        'low',
        expect.stringContaining('"filePath":"/path/to/file.csv"'),
        'api_request'
      );
    });

    it('should handle file audit errors', async () => {
      mockDataCloak.auditSecurity.mockRejectedValue(new Error('Audit failed'));

      await expect(service.auditFile('/path/to/file.csv')).rejects.toThrow(
        new AppError('File audit failed', 500, 'FILE_AUDIT_ERROR')
      );
    });
  });

  describe('scanDataset', () => {
    it('should scan a dataset for security issues', async () => {
      const result = await service.scanDataset('dataset-123');

      expect(result).toMatchObject({
        score: expect.any(Number),
        findings: expect.arrayContaining([
          { type: 'info', message: 'Dataset scanned: dataset-123' }
        ]),
        piiItemsDetected: expect.any(Number),
        complianceScore: expect.any(Number),
        recommendations: expect.any(Array),
        violations: expect.any(Array),
        fileProcessed: true,
        maskingAccuracy: 0.89,
        encryptionStatus: 'disabled'
      });

      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should handle invalid dataset ID', async () => {
      await expect(service.scanDataset('')).rejects.toThrow(
        new AppError('Dataset ID is required and must be a string', 400, 'INVALID_DATASET_ID')
      );

      await expect(service.scanDataset(null as any)).rejects.toThrow(
        new AppError('Dataset ID is required and must be a string', 400, 'INVALID_DATASET_ID')
      );
    });

    it('should log dataset scan event', async () => {
      const result = await service.scanDataset('dataset-123');

      expect(mockDb.prepare).toHaveBeenCalled();
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        'mock-uuid-123',
        'dataset_scan',
        expect.stringMatching(/^(low|medium)$/),
        expect.stringContaining('"datasetId":"dataset-123"'),
        'api_request'
      );
    });

    it('should handle dataset scan errors', async () => {
      // Force an error by mocking Math.random to throw
      const originalRandom = Math.random;
      Math.random = jest.fn(() => { throw new Error('Random error'); });

      await expect(service.scanDataset('dataset-123')).rejects.toThrow(
        new AppError('Dataset scan failed', 500, 'DATASET_SCAN_ERROR')
      );

      Math.random = originalRandom;
    });
  });

  describe('getSecurityMetrics', () => {
    it('should return security metrics', async () => {
      const metrics = await service.getSecurityMetrics();

      expect(metrics).toEqual({
        totalScans: 156,
        piiDetected: 23,
        averageScore: 85,
        recentEvents: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/^(pii_detected|text_masked)$/),
            timestamp: expect.any(String),
            severity: expect.stringMatching(/^(low|medium)$/)
          })
        ])
      });
    });

    it('should handle missing database connection', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      const metrics = await service.getSecurityMetrics();

      expect(metrics).toEqual({
        totalScans: 0,
        piiDetected: 0,
        averageScore: 0,
        recentEvents: []
      });
    });

    it('should handle errors', async () => {
      (getSQLiteConnection as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.getSecurityMetrics()).rejects.toThrow(
        new AppError('Failed to get security metrics', 500, 'METRICS_ERROR')
      );
    });
  });

  describe('getAuditHistory', () => {
    it('should return audit history', async () => {
      const history = await service.getAuditHistory();

      expect(history).toHaveLength(20); // Default mock returns 20 items
      expect(history[0]).toMatchObject({
        id: expect.any(String),
        type: expect.stringMatching(/^(file_audit|dataset_scan|pii_detection)$/),
        timestamp: expect.any(String),
        score: expect.any(Number),
        piiItemsDetected: expect.any(Number),
        complianceScore: expect.any(Number),
        violations: expect.any(Number),
        status: 'completed'
      });
    });

    it('should respect limit parameter', async () => {
      const history = await service.getAuditHistory(5);

      expect(history).toHaveLength(5);
    });

    it('should handle missing database', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);

      const history = await service.getAuditHistory();

      expect(history).toEqual([]);
    });

    it('should handle errors', async () => {
      (getSQLiteConnection as jest.Mock).mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.getAuditHistory()).rejects.toThrow(
        new AppError('Failed to get audit history', 500, 'AUDIT_HISTORY_ERROR')
      );
    });
  });

  describe('logging security events', () => {
    it('should handle database connection errors gracefully', async () => {
      (getSQLiteConnection as jest.Mock).mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Should not throw
      await service.detectPII('test@example.com');

      expect(consoleSpy).not.toHaveBeenCalled(); // No warning because db is null

      consoleSpy.mockRestore();
    });

    it('should handle logging errors gracefully', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB prepare error');
      });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Should not throw
      await service.detectPII('test@example.com');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to log security event:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('helper methods', () => {
    it('should infer data types from DataCloak audit', async () => {
      mockDataCloak.auditSecurity.mockResolvedValue({
        piiResults: [
          { piiType: 'EMAIL' },
          { piiType: 'PHONE' },
          { piiType: 'EMAIL' } // Duplicate should be filtered
        ],
        complianceScore: 0.85,
        violations: [],
        recommendations: [],
        piiItemsDetected: 3,
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      });

      await service.auditSecurity('/path/to/file');

      expect(mockComplianceService.performComplianceAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          dataTypes: expect.arrayContaining(['text', 'EMAIL', 'PHONE'])
        })
      );
    });

    it('should handle file size errors gracefully', async () => {
      const fs = require('fs').promises;
      fs.stat.mockRejectedValue(new Error('File not found'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.auditSecurity('/nonexistent/file');

      expect(mockComplianceService.performComplianceAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          fileSize: 0
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get file size:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should detect biometric data', async () => {
      mockDataCloak.auditSecurity.mockResolvedValue({
        piiResults: [
          { piiType: 'FINGERPRINT', sample: 'biometric data' }
        ],
        complianceScore: 0.80,
        violations: [],
        recommendations: [],
        piiItemsDetected: 1,
        maskingAccuracy: 0.98,
        encryptionStatus: 'enabled'
      });

      await service.auditSecurity('/biometric/data.csv');

      expect(mockComplianceService.performComplianceAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          containsBiometricData: true
        })
      );
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for PII detection', () => {
      const text = 'Test Text';
      const hash = crypto.createHash('sha256')
        .update(text.trim().toLowerCase())
        .digest('hex');
      const expectedKey = `pii:detect:${hash}`;

      // Access private method through any cast
      const key = (service as any).generatePIICacheKey(text);

      expect(key).toBe(expectedKey);
    });

    it('should generate consistent cache keys for masking', () => {
      const text = 'Test Text';
      const hash = crypto.createHash('sha256')
        .update(text.trim().toLowerCase())
        .digest('hex');
      const expectedKey = `pii:mask:${hash}`;

      // Access private method through any cast
      const key = (service as any).generateMaskingCacheKey(text);

      expect(key).toBe(expectedKey);
    });

    it('should normalize text for cache key generation', () => {
      const text1 = '  Test Text  ';
      const text2 = 'test text';
      
      const key1 = (service as any).generatePIICacheKey(text1);
      const key2 = (service as any).generatePIICacheKey(text2);

      expect(key1).toBe(key2);
    });
  });

  describe('edge cases', () => {
    it('should handle PII detection with no position found', async () => {
      mockDataCloak.detectPII.mockResolvedValue([{
        piiType: 'CUSTOM',
        sample: 'not-in-text',
        confidence: 0.80
      }]);

      const results = await service.detectPII('Some other text');

      expect(results[0].position).toEqual({
        start: 0,
        end: 'not-in-text'.length
      });
    });

    it('should handle empty PII results', async () => {
      mockDataCloak.detectPII.mockResolvedValue([]);

      const results = await service.detectPII('No PII here');

      expect(results).toEqual([]);
      
      // Should log with low severity when no PII found
      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalledWith(
        expect.any(String),
        'pii_detected',
        'low',
        expect.any(String),
        'api_request'
      );
    });

    it('should handle special characters in masking', async () => {
      const text = 'Email: test+special@example.com';
      mockDataCloak.detectPII.mockResolvedValue([{
        piiType: 'EMAIL',
        sample: 'test+special@example.com',
        confidence: 0.95
      }]);

      const result = await service.maskText(text, { preserveFormat: false });

      expect(result.maskedText).toContain('[EMAIL_MASKED]');
      expect(result.maskedText).not.toContain('test+special@example.com');
    });
  });
});