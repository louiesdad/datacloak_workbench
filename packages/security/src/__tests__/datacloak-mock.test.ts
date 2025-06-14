import { DataCloakMock } from '../mock/datacloak-mock';
import { PIIType } from '../interfaces/datacloak';

describe('DataCloakMock', () => {
  let dataCloakMock: DataCloakMock;

  beforeEach(() => {
    dataCloakMock = new DataCloakMock();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await dataCloakMock.initialize({ apiKey: 'test-key' });
      expect(dataCloakMock.isAvailable()).toBe(true);
    });

    it('should throw error when not initialized', async () => {
      await expect(dataCloakMock.detectPII('test')).rejects.toThrow('DataCloak not initialized');
    });
  });

  describe('PII detection', () => {
    beforeEach(async () => {
      await dataCloakMock.initialize({});
    });

    it('should detect email addresses', async () => {
      const text = 'Contact us at john.doe@example.com for more info';
      const results = await dataCloakMock.detectPII(text);
      
      const emailPII = results.find(r => r.piiType === PIIType.EMAIL);
      expect(emailPII).toBeDefined();
      expect(emailPII?.sample).toBe('john.doe@example.com');
    });

    it('should detect phone numbers', async () => {
      const text = 'Call us at 555-123-4567';
      const results = await dataCloakMock.detectPII(text);
      
      const phonePII = results.find(r => r.piiType === PIIType.PHONE);
      expect(phonePII).toBeDefined();
      expect(phonePII?.sample).toBe('555-123-4567');
    });

    it('should detect SSN', async () => {
      const text = 'SSN: 123-45-6789';
      const results = await dataCloakMock.detectPII(text);
      
      const ssnPII = results.find(r => r.piiType === PIIType.SSN);
      expect(ssnPII).toBeDefined();
      expect(ssnPII?.sample).toBe('123-45-6789');
    });

    it('should return confidence scores', async () => {
      const text = 'test@example.com';
      const results = await dataCloakMock.detectPII(text);
      
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });
    });
  });

  describe('text masking', () => {
    beforeEach(async () => {
      await dataCloakMock.initialize({});
    });

    it('should mask email addresses', async () => {
      const text = 'Email: john.doe@example.com';
      const result = await dataCloakMock.maskText(text);
      
      expect(result.maskedText).toContain('****@example.com');
      expect(result.detectedPII).toHaveLength(1);
    });

    it('should mask phone numbers', async () => {
      const text = 'Phone: 555-123-4567';
      const result = await dataCloakMock.maskText(text);
      
      expect(result.maskedText).toContain('XXX-XXX-XXXX');
      expect(result.detectedPII).toHaveLength(1);
    });

    it('should provide processing metadata', async () => {
      const text = 'test@example.com';
      const result = await dataCloakMock.maskText(text);
      
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.fieldsProcessed).toBe(1);
      expect(result.metadata.piiItemsFound).toBeGreaterThan(0);
    });
  });

  describe('security audit', () => {
    beforeEach(async () => {
      await dataCloakMock.initialize({});
    });

    it('should perform security audit', async () => {
      const result = await dataCloakMock.auditSecurity('/test/file.csv');
      
      expect(result.fileProcessed).toBe('/test/file.csv');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.complianceScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should include violations when compliance is low', async () => {
      const result = await dataCloakMock.auditSecurity('/test/file.csv');
      
      if (result.complianceScore < 0.9) {
        expect(result.violations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('version and availability', () => {
    it('should return version', () => {
      expect(dataCloakMock.getVersion()).toBe('1.0.0-mock');
    });

    it('should report availability after initialization', async () => {
      expect(dataCloakMock.isAvailable()).toBe(false);
      await dataCloakMock.initialize({});
      expect(dataCloakMock.isAvailable()).toBe(true);
    });
  });
});