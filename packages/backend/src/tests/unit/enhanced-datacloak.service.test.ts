import { EnhancedDataCloakService } from '../../services/enhanced-datacloak.service';
import { ComplianceFramework, RiskAssessmentResult, PiiDetectionResult } from '../../types/compliance.types';
import { AppError } from '../../middleware/error.middleware';

// Mock the base DataCloak service
jest.mock('../../services/datacloak.service', () => ({
  DataCloakService: jest.fn().mockImplementation(() => ({
    detectPII: jest.fn(),
    maskPII: jest.fn(),
    performSentimentAnalysis: jest.fn(),
  })),
}));

describe('EnhancedDataCloakService', () => {
  let service: EnhancedDataCloakService;
  let mockDataCloakService: any;

  beforeEach(() => {
    service = new EnhancedDataCloakService();
    mockDataCloakService = (service as any).dataCloakService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Risk Assessment Engine', () => {
    describe('calculateRiskScore', () => {
      it('should calculate risk score correctly for high-risk data', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'ssn',
            value: '***-**-1234',
            position: { start: 0, end: 11 },
            confidence: 0.95,
            pattern: 'ssn',
            piiType: 'sensitive_id'
          },
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 20, end: 36 },
            confidence: 0.90,
            pattern: 'email',
            piiType: 'contact'
          }
        ];

        const riskScore = await service.calculateRiskScore(piiResults, ComplianceFramework.HIPAA);

        expect(riskScore).toBeGreaterThan(70); // High risk due to SSN
        expect(riskScore).toBeLessThanOrEqual(100);
      });

      it('should calculate lower risk score for low-sensitivity data', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.85,
            pattern: 'email',
            piiType: 'contact'
          }
        ];

        const riskScore = await service.calculateRiskScore(piiResults, ComplianceFramework.GDPR);

        expect(riskScore).toBeGreaterThan(0);
        expect(riskScore).toBeLessThan(50); // Lower risk for just email
      });

      it('should return zero risk score for no PII detected', async () => {
        const piiResults: PiiDetectionResult[] = [];

        const riskScore = await service.calculateRiskScore(piiResults, ComplianceFramework.GDPR);

        expect(riskScore).toBe(0);
      });

      it('should apply framework-specific risk multipliers', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'medical_record_number',
            value: 'MRN123456',
            position: { start: 0, end: 9 },
            confidence: 0.92,
            pattern: 'mrn',
            piiType: 'medical'
          }
        ];

        const hipaaRisk = await service.calculateRiskScore(piiResults, ComplianceFramework.HIPAA);
        const gdprRisk = await service.calculateRiskScore(piiResults, ComplianceFramework.GDPR);

        expect(hipaaRisk).toBeGreaterThan(gdprRisk); // HIPAA should weight medical data higher
      });
    });

    describe('assessComplianceStatus', () => {
      it('should detect GDPR violations for personal data without consent', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.90,
            pattern: 'email',
            piiType: 'contact'
          }
        ];

        const complianceStatus = await service.assessComplianceStatus(
          piiResults,
          ComplianceFramework.GDPR,
          { hasUserConsent: false, encryptionEnabled: true }
        );

        expect(complianceStatus.isCompliant).toBe(false);
        expect(complianceStatus.violations).toContainEqual(
          expect.objectContaining({
            rule: 'gdpr-lawful-basis',
            severity: 'critical'
          })
        );
      });

      it('should pass HIPAA compliance for encrypted medical data with safeguards', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'medical_record_number',
            value: 'MRN123456',
            position: { start: 0, end: 9 },
            confidence: 0.92,
            pattern: 'mrn',
            piiType: 'medical'
          }
        ];

        const complianceStatus = await service.assessComplianceStatus(
          piiResults,
          ComplianceFramework.HIPAA,
          {
            encryptionEnabled: true,
            accessControlsEnabled: true,
            auditLoggingEnabled: true,
            containsHealthData: true
          }
        );

        expect(complianceStatus.isCompliant).toBe(true);
        expect(complianceStatus.violations).toHaveLength(0);
      });

      it('should detect PCI-DSS violations for unencrypted financial data', async () => {
        const piiResults: PiiDetectionResult[] = [
          {
            type: 'credit_card',
            value: '****-****-****-1234',
            position: { start: 0, end: 19 },
            confidence: 0.98,
            pattern: 'credit_card',
            piiType: 'financial'
          }
        ];

        const complianceStatus = await service.assessComplianceStatus(
          piiResults,
          ComplianceFramework.PCI_DSS,
          { encryptionEnabled: false, containsFinancialData: true }
        );

        expect(complianceStatus.isCompliant).toBe(false);
        expect(complianceStatus.violations).toContainEqual(
          expect.objectContaining({
            rule: 'pci-encryption-required',
            severity: 'critical'
          })
        );
      });
    });
  });

  describe('Enhanced PII Detection', () => {
    describe('detectEnhancedPII', () => {
      beforeEach(() => {
        mockDataCloakService.detectPII.mockResolvedValue([
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.90,
            pattern: 'email',
            piiType: 'contact'
          }
        ]);
      });

      it('should enhance base PII detection with industry-specific patterns', async () => {
        const text = 'Patient MRN123456 with email user@company.com';
        
        const results = await service.detectEnhancedPII(
          text,
          ComplianceFramework.HIPAA,
          { industrySpecific: true }
        );

        expect(results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'email',
              confidence: 0.90
            }),
            expect.objectContaining({
              type: 'medical_record_number',
              value: 'MRN123456'
            })
          ])
        );
      });

      it('should apply confidence threshold filtering', async () => {
        mockDataCloakService.detectPII.mockResolvedValue([
          {
            type: 'email',
            value: 'user@company.com',
            position: { start: 0, end: 16 },
            confidence: 0.95,
            pattern: 'email',
            piiType: 'contact'
          },
          {
            type: 'phone',
            value: '123-456-7890',
            position: { start: 20, end: 32 },
            confidence: 0.65,
            pattern: 'phone',
            piiType: 'contact'
          }
        ]);

        const results = await service.detectEnhancedPII(
          'Contact: user@company.com 123-456-7890',
          ComplianceFramework.GDPR,
          { confidenceThreshold: 0.8 }
        );

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual(
          expect.objectContaining({
            type: 'email',
            confidence: 0.95
          })
        );
      });

      it('should detect driver license numbers for financial compliance', async () => {
        const text = 'Driver License: DL123456789';
        
        const results = await service.detectEnhancedPII(
          text,
          ComplianceFramework.GENERAL,
          { industrySpecific: true }
        );

        expect(results).toContainEqual(
          expect.objectContaining({
            type: 'driver_license',
            value: 'DL123456789'
          })
        );
      });

      it('should detect IBAN numbers for financial compliance', async () => {
        const text = 'Bank Account: DE89370400440532013000';
        
        const results = await service.detectEnhancedPII(
          text,
          ComplianceFramework.GENERAL,
          { industrySpecific: true }
        );

        expect(results).toContainEqual(
          expect.objectContaining({
            type: 'iban',
            value: 'DE89370400440532013000'
          })
        );
      });
    });

    describe('validateCustomPattern', () => {
      it('should validate correct regex patterns', () => {
        const validPattern = {
          name: 'Employee ID',
          regex: 'EMP[0-9]{6}',
          description: 'Employee identification number',
          sensitivity: 'medium' as const
        };

        const result = service.validateCustomPattern(validPattern);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid regex patterns', () => {
        const invalidPattern = {
          name: 'Invalid Pattern',
          regex: '[unclosed bracket',
          description: 'Invalid regex',
          sensitivity: 'medium' as const
        };

        const result = service.validateCustomPattern(invalidPattern);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid regular expression syntax');
      });

      it('should reject patterns with missing required fields', () => {
        const incompletePattern = {
          name: '',
          regex: 'valid[0-9]+',
          description: '',
          sensitivity: 'medium' as const
        };

        const result = service.validateCustomPattern(incompletePattern);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Pattern name is required');
        expect(result.errors).toContain('Pattern description is required');
      });
    });
  });

  describe('Geographic Risk Assessment', () => {
    describe('assessGeographicRisk', () => {
      it('should identify high risk for cross-border data transfers', async () => {
        const riskAssessment = await service.assessGeographicRisk(
          'US', // source country
          ['CN', 'RU'], // destination countries
          ComplianceFramework.GDPR
        );

        expect(riskAssessment.riskLevel).toBe('high');
        expect(riskAssessment.crossBorderTransfer).toBe(true);
        expect(riskAssessment.recommendations).toContain(
          'Implement appropriate safeguards for cross-border data transfer'
        );
      });

      it('should identify low risk for EU internal transfers under GDPR', async () => {
        const riskAssessment = await service.assessGeographicRisk(
          'DE', // Germany
          ['FR', 'IT'], // France, Italy
          ComplianceFramework.GDPR
        );

        expect(riskAssessment.riskLevel).toBe('low');
        expect(riskAssessment.crossBorderTransfer).toBe(false);
        expect(riskAssessment.adequacyDecision).toBe(true);
      });

      it('should handle unknown countries with caution', async () => {
        const riskAssessment = await service.assessGeographicRisk(
          'US',
          ['XX'], // Unknown country code
          ComplianceFramework.GDPR
        );

        expect(riskAssessment.riskLevel).toBe('high');
        expect(riskAssessment.unknownJurisdiction).toBe(true);
      });
    });
  });

  describe('Performance and Configuration', () => {
    describe('optimizePerformance', () => {
      it('should configure optimal batch sizes for large datasets', () => {
        const config = service.optimizePerformance({
          datasetSize: 1000000, // 1M records
          availableMemory: 8192, // 8GB
          targetLatency: 100 // 100ms per batch
        });

        expect(config.batchSize).toBeGreaterThan(100);
        expect(config.batchSize).toBeLessThan(10000);
        expect(config.concurrencyLimit).toBeGreaterThan(1);
      });

      it('should adjust configuration for memory constraints', () => {
        const config = service.optimizePerformance({
          datasetSize: 1000000,
          availableMemory: 512, // 512MB - limited memory
          targetLatency: 100
        });

        expect(config.batchSize).toBeLessThan(1000);
        expect(config.concurrencyLimit).toBe(1); // Single-threaded for low memory
      });
    });

    describe('configureCaching', () => {
      it('should enable caching for frequently accessed patterns', () => {
        const cacheConfig = service.configureCaching({
          enablePatternCache: true,
          enableResultCache: true,
          cacheTTL: 3600 // 1 hour
        });

        expect(cacheConfig.patternCacheEnabled).toBe(true);
        expect(cacheConfig.resultCacheEnabled).toBe(true);
        expect(cacheConfig.defaultTTL).toBe(3600);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle DataCloak service failures gracefully', async () => {
      mockDataCloakService.detectPII.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        service.detectEnhancedPII('test text', ComplianceFramework.GDPR)
      ).rejects.toThrow(AppError);
    });

    it('should validate compliance framework parameters', async () => {
      await expect(
        service.assessComplianceStatus([], 'INVALID_FRAMEWORK' as any, {})
      ).rejects.toThrow(AppError);
    });

    it('should handle malformed configuration objects', () => {
      expect(() => {
        service.optimizePerformance(null as any);
      }).toThrow(AppError);
    });
  });

  describe('Advanced Masking and Tokenization', () => {
    describe('formatPreservingEncryption', () => {
      it('should preserve format while encrypting PII', async () => {
        const originalSSN = '123-45-6789';
        
        const encrypted = await service.formatPreservingEncryption(
          originalSSN,
          'ssn',
          'test-key-123'
        );

        expect(encrypted).toMatch(/\d{3}-\d{2}-\d{4}/); // Format preserved
        expect(encrypted).not.toBe(originalSSN); // Content changed
      });

      it('should preserve email format while encrypting', async () => {
        const originalEmail = 'user@company.com';
        
        const encrypted = await service.formatPreservingEncryption(
          originalEmail,
          'email',
          'test-key-123'
        );

        expect(encrypted).toMatch(/^[^@]+@[^@]+\.[^@]+$/); // Email format preserved
        expect(encrypted).not.toBe(originalEmail); // Content changed
      });
    });

    describe('reversibleTokenization', () => {
      it('should tokenize and detokenize PII correctly', async () => {
        const originalValue = 'sensitive-data-123';
        const tokenKey = 'token-key-456';

        const token = await service.reversibleTokenization(originalValue, tokenKey, 'tokenize');
        expect(token).not.toBe(originalValue);
        expect(token).toMatch(/^TOK_[A-Z0-9]+$/); // Token format

        const detokenized = await service.reversibleTokenization(token, tokenKey, 'detokenize');
        expect(detokenized).toBe(originalValue);
      });

      it('should generate different tokens for different keys', async () => {
        const value = 'test-value';
        
        const token1 = await service.reversibleTokenization(value, 'key1', 'tokenize');
        const token2 = await service.reversibleTokenization(value, 'key2', 'tokenize');

        expect(token1).not.toBe(token2);
      });
    });
  });
});

// Type definitions for testing
enum ComplianceFramework {
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  CCPA = 'CCPA',
  PCI_DSS = 'PCI_DSS',
  GENERAL = 'GENERAL'
}

interface PiiDetectionResult {
  type: string;
  value: string;
  position: { start: number; end: number };
  confidence: number;
  pattern: string;
  piiType: string;
}

interface RiskAssessmentResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  factors: string[];
  recommendations: string[];
  crossBorderTransfer?: boolean;
  adequacyDecision?: boolean;
  unknownJurisdiction?: boolean;
}