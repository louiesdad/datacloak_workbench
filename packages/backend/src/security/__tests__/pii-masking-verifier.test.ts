/**
 * PII Masking Verifier Tests
 * 
 * Comprehensive tests for PII detection, masking verification,
 * and leak prevention functionality.
 */

import { jest } from '@jest/globals';
import { PIIMaskingVerifier, PIIDetectionResult, MaskingRule, PIILeakAlert } from '../pii-masking-verifier';
import { SecurityService } from '../../services/security.service';

// Mock SecurityService
jest.mock('../../services/security.service');
jest.mock('../../config/logger');

describe('PIIMaskingVerifier', () => {
  let verifier: PIIMaskingVerifier;
  let mockSecurityService: jest.Mocked<SecurityService>;

  beforeEach(() => {
    jest.clearAllMocks();
    verifier = new PIIMaskingVerifier();
    mockSecurityService = jest.mocked(new SecurityService());
    
    // Mock security service responses
    mockSecurityService.detectPII.mockResolvedValue([
      {
        piiType: 'EMAIL',
        value: 'john.doe@example.com',
        confidence: 0.95,
        position: { start: 0, end: 19 }
      },
      {
        piiType: 'SSN',
        value: '123-45-6789',
        confidence: 0.98,
        position: { start: 25, end: 36 }
      }
    ]);
    
    // Replace the internal security service with our mock
    (verifier as any).securityService = mockSecurityService;
  });

  describe('PII Detection', () => {
    it('should detect email addresses in content', async () => {
      const content = 'Contact john.doe@example.com for details';
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes).toHaveLength(1);
      expect(result.detectedTypes[0].type).toBe('EMAIL');
      expect(result.detectedTypes[0].value).toBe('john.doe@example.com');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect SSN patterns', async () => {
      const content = 'SSN: 123-45-6789';
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes.some(t => t.type === 'SSN')).toBe(true);
      expect(result.riskLevel).toBe('critical');
    });

    it('should detect credit card numbers', async () => {
      const content = 'Card: 4532-1234-5678-9012';
      
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes.some(t => t.type === 'CREDIT_CARD')).toBe(true);
      expect(result.riskLevel).toBe('critical');
    });

    it('should detect phone numbers', async () => {
      const content = 'Call me at (555) 123-4567';
      
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes.some(t => t.type === 'PHONE')).toBe(true);
    });

    it('should detect multiple PII types in single content', async () => {
      const content = 'John Doe, email: john.doe@example.com, SSN: 123-45-6789, Phone: (555) 123-4567';
      
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(true);
      expect(result.detectedTypes.length).toBeGreaterThan(1);
      expect(result.riskLevel).toBe('critical');
    });

    it('should handle content with no PII', async () => {
      mockSecurityService.detectPII.mockResolvedValue([]);
      const content = 'This is just regular text with no sensitive information';
      
      const result = await verifier.detectPII(content, 'test-context');
      
      expect(result.hasPII).toBe(false);
      expect(result.detectedTypes).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.riskLevel).toBe('low');
    });

    it('should cache recent scan results', async () => {
      const content = 'john.doe@example.com';
      
      // First scan
      await verifier.detectPII(content, 'test-context');
      
      // Second scan should use cache
      await verifier.detectPII(content, 'test-context');
      
      // Security service should only be called once
      expect(mockSecurityService.detectPII).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pre-logging Scanner', () => {
    it('should mask PII before logging', async () => {
      const content = 'User email: john.doe@example.com';
      
      const maskedContent = await verifier.scanBeforeLogging(content, 'logging-context');
      
      expect(maskedContent).not.toContain('john.doe@example.com');
      expect(maskedContent).toContain('***');
    });

    it('should return original content if no PII detected', async () => {
      mockSecurityService.detectPII.mockResolvedValue([]);
      const content = 'Regular log message';
      
      const maskedContent = await verifier.scanBeforeLogging(content, 'logging-context');
      
      expect(maskedContent).toBe(content);
    });

    it('should apply conservative masking on scan failure', async () => {
      mockSecurityService.detectPII.mockRejectedValue(new Error('Scan failed'));
      const content = 'Email: test@example.com, SSN: 123-45-6789';
      
      const maskedContent = await verifier.scanBeforeLogging(content, 'logging-context');
      
      expect(maskedContent).not.toContain('test@example.com');
      expect(maskedContent).not.toContain('123-45-6789');
    });
  });

  describe('Masking Strategies', () => {
    it('should apply full masking strategy', async () => {
      const rule: MaskingRule = {
        piiType: 'SSN',
        maskingStrategy: 'full',
        preserveLength: true,
        minimumConfidence: 0.8
      };
      
      verifier.addMaskingRule('SSN', rule);
      
      const content = 'SSN: 123-45-6789';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      expect(maskedContent).toContain('***********');
      expect(maskedContent).not.toContain('123-45-6789');
    });

    it('should apply partial masking strategy', async () => {
      const rule: MaskingRule = {
        piiType: 'EMAIL',
        maskingStrategy: 'partial',
        preserveLength: false,
        minimumConfidence: 0.7
      };
      
      verifier.addMaskingRule('EMAIL', rule);
      
      const content = 'Email: john.doe@example.com';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      // Should preserve some characters
      expect(maskedContent).toMatch(/jo.*\.com/);
      expect(maskedContent).toContain('*');
    });

    it('should apply hash masking strategy', async () => {
      const rule: MaskingRule = {
        piiType: 'EMAIL',
        maskingStrategy: 'hash',
        preserveLength: false,
        minimumConfidence: 0.7
      };
      
      verifier.addMaskingRule('EMAIL', rule);
      
      const content = 'Email: john.doe@example.com';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      expect(maskedContent).toMatch(/\[HASH:[a-f0-9]{8}\]/);
      expect(maskedContent).not.toContain('john.doe@example.com');
    });

    it('should apply redact masking strategy', async () => {
      const rule: MaskingRule = {
        piiType: 'SSN',
        maskingStrategy: 'redact',
        preserveLength: false,
        minimumConfidence: 0.8
      };
      
      verifier.addMaskingRule('SSN', rule);
      
      const content = 'SSN: 123-45-6789';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      expect(maskedContent).toContain('[REDACTED]');
      expect(maskedContent).not.toContain('123-45-6789');
    });

    it('should respect minimum confidence threshold', async () => {
      mockSecurityService.detectPII.mockResolvedValue([
        {
          piiType: 'EMAIL',
          value: 'test@example.com',
          confidence: 0.5, // Below threshold
          position: { start: 0, end: 16 }
        }
      ]);
      
      const rule: MaskingRule = {
        piiType: 'EMAIL',
        maskingStrategy: 'full',
        preserveLength: true,
        minimumConfidence: 0.8 // Higher than detected confidence
      };
      
      verifier.addMaskingRule('EMAIL', rule);
      
      const content = 'test@example.com';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      // Should not mask due to low confidence
      expect(maskedContent).toBe(content);
    });
  });

  describe('Masking Validation', () => {
    it('should validate that masking was effective', async () => {
      const originalContent = 'Email: john.doe@example.com';
      const maskedContent = 'Email: jo*****.com';
      
      // Mock the post-masking scan to return no PII
      mockSecurityService.detectPII.mockResolvedValueOnce([
        {
          piiType: 'EMAIL',
          value: 'john.doe@example.com',
          confidence: 0.95,
          position: { start: 7, end: 26 }
        }
      ]).mockResolvedValueOnce([]); // Second call for validation returns no PII
      
      const isValid = await verifier.validateMasking(originalContent, maskedContent, 'test');
      
      expect(isValid).toBe(true);
    });

    it('should detect when masking failed', async () => {
      const originalContent = 'Email: john.doe@example.com';
      const maskedContent = 'Email: john.doe@example.com'; // No masking applied
      
      const isValid = await verifier.validateMasking(originalContent, maskedContent, 'test');
      
      expect(isValid).toBe(false);
    });

    it('should detect when PII still present after masking', async () => {
      const alertCallback = jest.fn();
      verifier.addAlertCallback(alertCallback);
      
      const originalContent = 'Email: john.doe@example.com';
      const maskedContent = 'Email: john***@example.com'; // Partially masked but still detectable
      
      // Mock to detect PII in masked content
      mockSecurityService.detectPII.mockResolvedValueOnce([
        {
          piiType: 'EMAIL',
          value: 'john.doe@example.com',
          confidence: 0.95,
          position: { start: 7, end: 26 }
        }
      ]).mockResolvedValueOnce([
        {
          piiType: 'EMAIL',
          value: 'john***@example.com',
          confidence: 0.8,
          position: { start: 7, end: 26 }
        }
      ]);
      
      const isValid = await verifier.validateMasking(originalContent, maskedContent, 'test');
      
      expect(isValid).toBe(false);
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          context: expect.stringContaining('Masking validation failed')
        })
      );
    });
  });

  describe('Alert System Integration', () => {
    it('should trigger alerts for high-confidence PII detection', async () => {
      const alertCallback = jest.fn();
      verifier.addAlertCallback(alertCallback);
      
      const content = 'SSN: 123-45-6789';
      await verifier.scanBeforeLogging(content, 'test-context');
      
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          piiType: 'SSN',
          confidence: expect.any(Number),
          source: 'test-context'
        })
      );
    });

    it('should not trigger alerts for low-confidence detection', async () => {
      const alertCallback = jest.fn();
      verifier.addAlertCallback(alertCallback);
      
      mockSecurityService.detectPII.mockResolvedValue([
        {
          piiType: 'EMAIL',
          value: 'maybe@email.com',
          confidence: 0.5, // Below alert threshold
          position: { start: 0, end: 15 }
        }
      ]);
      
      const content = 'maybe@email.com';
      await verifier.scanBeforeLogging(content, 'test-context');
      
      expect(alertCallback).not.toHaveBeenCalled();
    });

    it('should include proper risk assessment in alerts', async () => {
      const alertCallback = jest.fn();
      verifier.addAlertCallback(alertCallback);
      
      const content = 'Credit Card: 4532-1234-5678-9012';
      await verifier.scanBeforeLogging(content, 'test-context');
      
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          riskAssessment: expect.stringContaining('Critical PII exposure risk')
        })
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track masking statistics', async () => {
      // Perform several scans
      await verifier.scanBeforeLogging('john@example.com', 'test1');
      await verifier.scanBeforeLogging('jane@example.com', 'test2');
      await verifier.scanBeforeLogging('regular text', 'test3');
      
      const stats = verifier.getMaskingStatistics();
      
      expect(stats.totalScans).toBeGreaterThan(0);
      expect(stats.piiDetected).toBeGreaterThan(0);
    });

    it('should provide accurate scan counts', async () => {
      const initialStats = verifier.getMaskingStatistics();
      const initialScans = initialStats.totalScans;
      
      await verifier.detectPII('test@example.com', 'test');
      
      const updatedStats = verifier.getMaskingStatistics();
      expect(updatedStats.totalScans).toBe(initialScans + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle security service failures gracefully', async () => {
      mockSecurityService.detectPII.mockRejectedValue(new Error('Service unavailable'));
      
      const content = 'Sensitive data: test@example.com';
      
      // Should not throw error
      await expect(verifier.scanBeforeLogging(content, 'test')).resolves.toBeDefined();
    });

    it('should apply conservative masking on detection failure', async () => {
      mockSecurityService.detectPII.mockRejectedValue(new Error('Detection failed'));
      
      const content = 'Email: test@example.com, SSN: 123-45-6789';
      const maskedContent = await verifier.scanBeforeLogging(content, 'test');
      
      // Should apply pattern-based masking
      expect(maskedContent).not.toContain('test@example.com');
      expect(maskedContent).not.toContain('123-45-6789');
    });

    it('should handle malformed content gracefully', async () => {
      const content = '\x00\x01\x02 invalid characters';
      
      await expect(verifier.detectPII(content, 'test')).resolves.toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache results for identical content', async () => {
      const content = 'test@example.com';
      
      // First call
      const result1 = await verifier.detectPII(content, 'test');
      
      // Second call should use cache
      const result2 = await verifier.detectPII(content, 'test');
      
      expect(result1).toEqual(result2);
      expect(mockSecurityService.detectPII).toHaveBeenCalledTimes(1);
    });

    it('should handle large content efficiently', async () => {
      const largeContent = 'test@example.com '.repeat(1000);
      
      const startTime = Date.now();
      await verifier.detectPII(largeContent, 'test');
      const endTime = Date.now();
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Configuration and Rules', () => {
    it('should allow custom masking rules', async () => {
      const customRule: MaskingRule = {
        piiType: 'CUSTOM_ID',
        maskingStrategy: 'hash',
        preserveLength: false,
        minimumConfidence: 0.9
      };
      
      verifier.addMaskingRule('CUSTOM_ID', customRule);
      
      // Verify rule was added
      const rules = (verifier as any).maskingRules;
      expect(rules.get('CUSTOM_ID')).toEqual(customRule);
    });

    it('should support multiple alert callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      verifier.addAlertCallback(callback1);
      verifier.addAlertCallback(callback2);
      
      const content = 'SSN: 123-45-6789';
      await verifier.scanBeforeLogging(content, 'test');
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});