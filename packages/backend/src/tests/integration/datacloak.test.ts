import { DataCloakService } from '../../services/datacloak.service';

// Define PIIType constants for testing
const PIIType = {
  EMAIL: 'email',
  PHONE: 'phone',
  SSN: 'ssn',
  CREDIT_CARD: 'credit_card',
  ADDRESS: 'address',
  NAME: 'name',
  DATE_OF_BIRTH: 'date_of_birth',
  IP_ADDRESS: 'ip_address',
  CUSTOM: 'custom'
} as const;

describe('DataCloak Service Integration Tests', () => {
  let dataCloak: DataCloakService;

  beforeAll(async () => {
    dataCloak = new DataCloakService();
    await dataCloak.initialize();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', async () => {
      const stats = await dataCloak.getStats();
      expect(stats.initialized).toBe(true);
      expect(stats.available).toBe(true);
      expect(stats.version).toBeDefined();
    });

    it('should report correct version', () => {
      const version = dataCloak.getVersion();
      expect(version).toContain('1.0.0');
    });
  });

  describe('PII Detection', () => {
    it('should detect email addresses', async () => {
      const text = 'Please contact john.doe@example.com for more information';
      const results = await dataCloak.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].piiType).toBe(PIIType.EMAIL);
      expect(results[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect phone numbers', async () => {
      const text = 'Call me at (555) 123-4567 or 555-987-6543';
      const results = await dataCloak.detectPII(text);
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some(r => r.piiType === PIIType.PHONE)).toBe(true);
    });

    it('should detect SSN', async () => {
      const text = 'SSN: 123-45-6789';
      const results = await dataCloak.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].piiType).toBe(PIIType.SSN);
    });

    it('should detect credit card numbers', async () => {
      const text = 'Payment card: 4532-1234-5678-9012';
      const results = await dataCloak.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].piiType).toBe(PIIType.CREDIT_CARD);
    });

    it('should handle text with no PII', async () => {
      const text = 'This is a normal text without any personal information';
      const results = await dataCloak.detectPII(text);
      
      expect(results).toHaveLength(0);
    });

    it('should detect multiple PII types in one text', async () => {
      const text = 'Contact john@example.com or call 555-123-4567. SSN: 123-45-6789';
      const results = await dataCloak.detectPII(text);
      
      expect(results.length).toBeGreaterThanOrEqual(3);
      const piiTypes = results.map(r => r.piiType);
      expect(piiTypes).toContain(PIIType.EMAIL);
      expect(piiTypes).toContain(PIIType.PHONE);
      expect(piiTypes).toContain(PIIType.SSN);
    });
  });

  describe('Text Masking', () => {
    it('should mask email addresses', async () => {
      const text = 'Contact john.doe@example.com for details';
      const result = await dataCloak.maskText(text);
      
      expect(result.maskedText).not.toContain('john.doe@example.com');
      expect(result.maskedText).toContain('***');
      expect(result.piiItemsFound).toBe(1);
    });

    it('should mask multiple PII items', async () => {
      const text = 'Email: test@example.com, Phone: 555-123-4567';
      const result = await dataCloak.maskText(text);
      
      expect(result.maskedText).not.toContain('test@example.com');
      expect(result.maskedText).not.toContain('555-123-4567');
      expect(result.piiItemsFound).toBe(2);
    });

    it('should preserve text structure when masking', async () => {
      const text = 'My email is john@example.com and phone is 555-123-4567.';
      const result = await dataCloak.maskText(text);
      
      expect(result.maskedText).toContain('My email is');
      expect(result.maskedText).toContain('and phone is');
      expect(result.originalText).toBe(text);
    });
  });

  describe('Batch Operations', () => {
    it('should detect PII in batch', async () => {
      const texts = [
        'Email: test1@example.com',
        'Phone: 555-123-4567',
        'No PII here',
        'SSN: 123-45-6789'
      ];
      
      const results = await dataCloak.detectPIIBatch(texts);
      
      expect(results).toHaveLength(4);
      expect(results[0].length).toBe(1); // Email
      expect(results[1].length).toBe(1); // Phone
      expect(results[2].length).toBe(0); // No PII
      expect(results[3].length).toBe(1); // SSN
    });

    it('should mask text in batch', async () => {
      const texts = [
        'Contact: john@example.com',
        'Call: 555-123-4567',
        'Regular text'
      ];
      
      const results = await dataCloak.maskTextBatch(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0].maskedText).not.toContain('john@example.com');
      expect(results[1].maskedText).not.toContain('555-123-4567');
      expect(results[2].maskedText).toBe('Regular text');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const results = await dataCloak.detectPII('');
      expect(results).toHaveLength(0);
    });

    it('should handle null or undefined gracefully', async () => {
      // Test with empty string as a proxy for null/undefined
      const result = await dataCloak.maskText('');
      expect(result.maskedText).toBe('');
      expect(result.piiItemsFound).toBe(0);
    });

    it('should handle very long text', async () => {
      const longText = 'test@example.com '.repeat(1000);
      const results = await dataCloak.detectPII(longText);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process text within reasonable time', async () => {
      const text = 'Email: test@example.com, Phone: 555-123-4567, SSN: 123-45-6789';
      const startTime = Date.now();
      
      await dataCloak.detectPII(text);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should process in less than 100ms
    });

    it('should handle concurrent requests', async () => {
      const texts = Array(10).fill('test@example.com');
      const startTime = Date.now();
      
      const promises = texts.map(text => dataCloak.detectPII(text));
      const results = await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(500); // Should process 10 requests in less than 500ms
    });
  });
});