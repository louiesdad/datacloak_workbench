import { SecurityService } from '../../services/security.service';

describe('SecurityService with DataCloak Integration', () => {
  let securityService: SecurityService;

  beforeAll(async () => {
    securityService = new SecurityService();
    await securityService.initialize();
  });

  describe('PII Detection with DataCloak', () => {
    it('should detect email addresses using DataCloak', async () => {
      const text = 'Contact john.doe@example.com for more info';
      const results = await securityService.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('email');
      expect(results[0].value).toBe('john.doe@example.com');
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect multiple PII types', async () => {
      const text = 'Email: test@example.com, Phone: 555-123-4567, SSN: 123-45-6789';
      const results = await securityService.detectPII(text);
      
      expect(results.length).toBeGreaterThanOrEqual(3);
      const types = results.map(r => r.type);
      expect(types).toContain('email');
      expect(types).toContain('phone');
      expect(types).toContain('ssn');
    });

    it('should provide confidence scores', async () => {
      const text = 'My email is user@domain.com';
      const results = await securityService.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBeDefined();
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
    });

    it('should handle text with no PII', async () => {
      const text = 'This is a regular text without any personal information.';
      const results = await securityService.detectPII(text);
      
      expect(results).toHaveLength(0);
    });

    it('should detect credit card numbers', async () => {
      const text = 'Payment card: 4532-1234-5678-9012';
      const results = await securityService.detectPII(text);
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      const creditCard = results.find(r => r.type === 'credit_card');
      expect(creditCard).toBeDefined();
      expect(creditCard?.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Text Masking with DataCloak', () => {
    it('should mask text using DataCloak format-preserving masking', async () => {
      const text = 'Email me at john@example.com';
      const result = await securityService.maskText(text);
      
      expect(result.maskedText).not.toContain('john@example.com');
      expect(result.maskedText).toContain('@');
      expect(result.metadata.piiItemsFound).toBe(1);
      expect(result.maskingAccuracy).toBeGreaterThan(0.95);
    });

    it('should mask multiple PII items', async () => {
      const text = 'Contact: test@example.com, Phone: 555-123-4567';
      const result = await securityService.maskText(text);
      
      expect(result.maskedText).not.toContain('test@example.com');
      expect(result.maskedText).not.toContain('555-123-4567');
      expect(result.metadata.piiItemsFound).toBeGreaterThanOrEqual(2);
    });

    it('should respect preserveFormat option', async () => {
      const text = 'My SSN is 123-45-6789';
      
      // With format preservation (default)
      const result1 = await securityService.maskText(text, { preserveFormat: true });
      expect(result1.maskedText).toContain('-');
      
      // Without format preservation
      const result2 = await securityService.maskText(text, { preserveFormat: false });
      expect(result2.maskedText).toContain('[SSN_MASKED]');
    });

    it('should provide metadata about masking operation', async () => {
      const text = 'Email: user@example.com, Phone: 555-555-5555';
      const result = await securityService.maskText(text);
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.fieldsProcessed).toBe(1);
      expect(result.metadata.piiItemsFound).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Security Audit with DataCloak', () => {
    it('should audit files using DataCloak', async () => {
      const result = await securityService.auditFile('/path/to/test.csv');
      
      expect(result.fileProcessed).toBe(true);
      expect(result.piiItemsDetected).toBeDefined();
      expect(result.complianceScore).toBeGreaterThan(0);
      expect(result.maskingAccuracy).toBeGreaterThan(0.9);
    });

    it('should provide recommendations and violations', async () => {
      const result = await securityService.auditFile('/path/to/sensitive.csv');
      
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should calculate compliance score', async () => {
      const result = await securityService.auditFile('/path/to/data.csv');
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.complianceScore).toBeGreaterThan(0);
      expect(result.complianceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance', () => {
    it('should process PII detection quickly', async () => {
      const text = 'Email: test@example.com, Phone: 555-123-4567';
      const startTime = Date.now();
      
      await securityService.detectPII(text);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should handle concurrent requests', async () => {
      const texts = [
        'Email: user1@example.com',
        'Phone: 555-111-1111',
        'SSN: 111-11-1111',
        'Credit card: 4111-1111-1111-1111'
      ];
      
      const startTime = Date.now();
      const promises = texts.map(text => securityService.detectPII(text));
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(4);
      expect(duration).toBeLessThan(200); // Should complete all in less than 200ms
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      await expect(securityService.detectPII('')).rejects.toThrow('Text is required');
      await expect(securityService.maskText('')).rejects.toThrow('Text is required');
    });

    it('should handle invalid file paths', async () => {
      await expect(securityService.auditFile('')).rejects.toThrow('File path is required');
    });
  });
});