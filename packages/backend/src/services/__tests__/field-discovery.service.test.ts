import { FieldDiscoveryEngine } from '../field-discovery.service';
import { DataCloakService } from '../datacloak.service';

// Mock dependencies
jest.mock('../datacloak.service');

describe('Field Discovery Engine', () => {
  let discoveryEngine: FieldDiscoveryEngine;
  let mockDataCloak: jest.Mocked<DataCloakService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataCloak = {
      detectPII: jest.fn(),
      maskFields: jest.fn()
    } as any;
    
    discoveryEngine = new FieldDiscoveryEngine(mockDataCloak);
  });

  describe('PII Field Discovery', () => {
    test('should discover PII fields with confidence scores', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'user_email', text: 'Contact me at john.doe@example.com' },
        { fieldName: 'user_phone', text: 'My phone is 555-123-4567' },
        { fieldName: 'description', text: 'This is just a regular description' },
        { fieldName: 'user_ssn', text: 'SSN: 123-45-6789' }
      ];

      // Mock PII detection responses
      mockDataCloak.detectPII
        .mockResolvedValueOnce([
          {
            fieldName: 'user_email',
            piiType: 'email',
            confidence: 0.95,
            sample: 'john.doe@example.com',
            masked: '****@******.***'
          }
        ])
        .mockResolvedValueOnce([
          {
            fieldName: 'user_phone',
            piiType: 'phone',
            confidence: 0.88,
            sample: '555-123-4567',
            masked: '***-***-****'
          }
        ])
        .mockResolvedValueOnce([]) // No PII in description
        .mockResolvedValueOnce([
          {
            fieldName: 'user_ssn',
            piiType: 'ssn',
            confidence: 0.92,
            sample: '123-45-6789',
            masked: '***-**-****'
          }
        ]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset);

      // Assert
      expect(result.discoveredFields).toHaveLength(3);
      expect(result.totalFieldsAnalyzed).toBe(4);
      expect(result.piiFieldsFound).toBe(3);
      
      // Check specific field discoveries
      const emailField = result.discoveredFields.find(f => f.fieldName === 'user_email');
      expect(emailField).toBeDefined();
      expect(emailField?.piiTypes).toContain('email');
      expect(emailField?.confidenceScore).toBe(0.95);
      
      const phoneField = result.discoveredFields.find(f => f.fieldName === 'user_phone');
      expect(phoneField?.confidenceScore).toBe(0.88);
      
      const ssnField = result.discoveredFields.find(f => f.fieldName === 'user_ssn');
      expect(ssnField?.confidenceScore).toBe(0.92);
    });

    test('should handle fields with multiple PII types', async () => {
      // Arrange
      const dataset = [
        { 
          fieldName: 'contact_info', 
          text: 'Email me at john@test.com or call 555-1234. My SSN is 123-45-6789' 
        }
      ];

      // Mock detection of multiple PII types in one field
      mockDataCloak.detectPII.mockResolvedValue([
        {
          fieldName: 'contact_info',
          piiType: 'email',
          confidence: 0.93,
          sample: 'john@test.com',
          masked: '****@****.***'
        },
        {
          fieldName: 'contact_info',
          piiType: 'phone',
          confidence: 0.85,
          sample: '555-1234',
          masked: '***-****'
        },
        {
          fieldName: 'contact_info',
          piiType: 'ssn',
          confidence: 0.91,
          sample: '123-45-6789',
          masked: '***-**-****'
        }
      ]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset);

      // Assert
      expect(result.discoveredFields).toHaveLength(1);
      expect(result.discoveredFields[0].piiTypes).toHaveLength(3);
      expect(result.discoveredFields[0].piiTypes).toEqual(['email', 'phone', 'ssn']);
      expect(result.discoveredFields[0].confidenceScore).toBe(0.93); // Highest confidence
    });

    test('should calculate field-level confidence scores', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'maybe_email', text: 'This might be email-like: contact.info' },
        { fieldName: 'definite_email', text: 'Definitely email: user@domain.com' }
      ];

      mockDataCloak.detectPII
        .mockResolvedValueOnce([
          {
            fieldName: 'maybe_email',
            piiType: 'email',
            confidence: 0.45, // Low confidence
            sample: 'contact.info',
            masked: '*******.****'
          }
        ])
        .mockResolvedValueOnce([
          {
            fieldName: 'definite_email',
            piiType: 'email',
            confidence: 0.98, // High confidence
            sample: 'user@domain.com',
            masked: '****@******.***'
          }
        ]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset);

      // Assert
      expect(result.discoveredFields).toHaveLength(2);
      
      const lowConfidenceField = result.discoveredFields.find(f => f.fieldName === 'maybe_email');
      expect(lowConfidenceField?.riskLevel).toBe('low');
      
      const highConfidenceField = result.discoveredFields.find(f => f.fieldName === 'definite_email');
      expect(highConfidenceField?.riskLevel).toBe('high');
    });

    test('should support confidence threshold filtering', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'low_confidence', text: 'Maybe PII: contact.info' },
        { fieldName: 'high_confidence', text: 'Definitely PII: user@test.com' }
      ];

      mockDataCloak.detectPII
        .mockResolvedValueOnce([
          {
            fieldName: 'low_confidence',
            piiType: 'email',
            confidence: 0.3, // Below threshold
            sample: 'contact.info',
            masked: '*******.****'
          }
        ])
        .mockResolvedValueOnce([
          {
            fieldName: 'high_confidence',
            piiType: 'email',
            confidence: 0.95, // Above threshold
            sample: 'user@test.com',
            masked: '****@****.***'
          }
        ]);

      // Act - with confidence threshold of 0.5
      const result = await discoveryEngine.discoverPIIFields(dataset, { 
        confidenceThreshold: 0.5 
      });

      // Assert - only high confidence field should be included
      expect(result.discoveredFields).toHaveLength(1);
      expect(result.discoveredFields[0].fieldName).toBe('high_confidence');
      expect(result.totalFieldsAnalyzed).toBe(2);
      expect(result.piiFieldsFound).toBe(1);
    });
  });

  describe('Field Pattern Analysis', () => {
    test('should analyze field naming patterns for PII hints', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'user_email_address', text: 'No actual email here' },
        { fieldName: 'customer_phone_number', text: 'No phone number here' },
        { fieldName: 'random_field', text: 'Random text content' },
        { fieldName: 'ssn_field', text: 'No SSN content' }
      ];

      // Mock - no PII detected in content
      mockDataCloak.detectPII.mockResolvedValue([]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset, {
        includePatternAnalysis: true
      });

      // Assert
      expect(result.patternAnalysis).toBeDefined();
      expect(result.patternAnalysis?.suspiciousFieldNames).toHaveLength(3);
      expect(result.patternAnalysis?.suspiciousFieldNames).toContain('user_email_address');
      expect(result.patternAnalysis?.suspiciousFieldNames).toContain('customer_phone_number');
      expect(result.patternAnalysis?.suspiciousFieldNames).toContain('ssn_field');
    });

    test('should detect common PII field name patterns', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'email', text: 'Plain text' },
        { fieldName: 'email_addr', text: 'Plain text' },
        { fieldName: 'e_mail', text: 'Plain text' },
        { fieldName: 'phone', text: 'Plain text' },
        { fieldName: 'phoneNumber', text: 'Plain text' },
        { fieldName: 'social_security_number', text: 'Plain text' },
        { fieldName: 'credit_card', text: 'Plain text' },
        { fieldName: 'first_name', text: 'Plain text' },
        { fieldName: 'lastName', text: 'Plain text' }
      ];

      mockDataCloak.detectPII.mockResolvedValue([]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset, {
        includePatternAnalysis: true
      });

      // Assert
      expect(result.patternAnalysis?.piiPatternMatches).toHaveLength(9);
      
      const patterns = result.patternAnalysis?.piiPatternMatches || [];
      expect(patterns.some(p => p.fieldName === 'email' && p.suggestedType === 'email')).toBe(true);
      expect(patterns.some(p => p.fieldName === 'phone' && p.suggestedType === 'phone')).toBe(true);
      expect(patterns.some(p => p.fieldName === 'social_security_number' && p.suggestedType === 'ssn')).toBe(true);
    });
  });

  describe('Sampling and Performance', () => {
    test('should sample large datasets for performance', async () => {
      // Arrange - create large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        fieldName: `field_${i}`,
        text: `Sample text ${i} with potential@email.com`
      }));

      mockDataCloak.detectPII.mockImplementation(async () => [
        {
          fieldName: 'field_0',
          piiType: 'email',
          confidence: 0.85,
          sample: 'potential@email.com',
          masked: '*********@*****.***'
        }
      ]);

      const startTime = Date.now();

      // Act
      const result = await discoveryEngine.discoverPIIFields(largeDataset, {
        enableSampling: true,
        maxSampleSize: 100
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.samplingUsed).toBe(true);
      expect(result.sampleSize).toBe(100);
      expect(result.totalFieldsAnalyzed).toBe(10000);
      
      // Should have called detectPII only for sampled fields
      expect(mockDataCloak.detectPII).toHaveBeenCalledTimes(100);
    });

    test('should disable sampling for small datasets', async () => {
      // Arrange
      const smallDataset = Array.from({ length: 50 }, (_, i) => ({
        fieldName: `field_${i}`,
        text: `Text ${i}`
      }));

      mockDataCloak.detectPII.mockResolvedValue([]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(smallDataset, {
        enableSampling: true,
        maxSampleSize: 100
      });

      // Assert
      expect(result.samplingUsed).toBe(false);
      expect(mockDataCloak.detectPII).toHaveBeenCalledTimes(50); // All fields analyzed
    });
  });

  describe('Results Aggregation', () => {
    test('should provide comprehensive discovery summary', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'emails', text: 'contact@test.com' },
        { fieldName: 'phones', text: '555-1234' },
        { fieldName: 'clean_data', text: 'No PII here' },
        { fieldName: 'mixed', text: 'Email: user@domain.com and phone 555-9876' }
      ];

      mockDataCloak.detectPII
        .mockResolvedValueOnce([{
          fieldName: 'emails', piiType: 'email', confidence: 0.95,
          sample: 'contact@test.com', masked: '*******@****.***'
        }])
        .mockResolvedValueOnce([{
          fieldName: 'phones', piiType: 'phone', confidence: 0.88,
          sample: '555-1234', masked: '***-****'
        }])
        .mockResolvedValueOnce([]) // clean_data
        .mockResolvedValueOnce([
          {
            fieldName: 'mixed', piiType: 'email', confidence: 0.92,
            sample: 'user@domain.com', masked: '****@******.***'
          },
          {
            fieldName: 'mixed', piiType: 'phone', confidence: 0.85,
            sample: '555-9876', masked: '***-****'
          }
        ]);

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset);

      // Assert
      expect(result.summary).toBeDefined();
      expect(result.summary.totalFields).toBe(4);
      expect(result.summary.fieldsWithPII).toBe(3);
      expect(result.summary.piiTypesFound).toContain('email');
      expect(result.summary.piiTypesFound).toContain('phone');
      expect(result.summary.averageConfidence).toBeCloseTo(0.9, 1);
      expect(result.summary.riskDistribution.high).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle DataCloak service errors gracefully', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'test_field', text: 'Some text' }
      ];

      mockDataCloak.detectPII.mockRejectedValue(new Error('DataCloak service unavailable'));

      // Act & Assert
      await expect(discoveryEngine.discoverPIIFields(dataset)).rejects.toThrow('DataCloak service unavailable');
    });

    test('should handle partial failures with continueOnError option', async () => {
      // Arrange
      const dataset = [
        { fieldName: 'field1', text: 'Valid text' },
        { fieldName: 'field2', text: 'Another text' }
      ];

      mockDataCloak.detectPII
        .mockResolvedValueOnce([{
          fieldName: 'field1', piiType: 'email', confidence: 0.85,
          sample: 'test@example.com', masked: '****@*******.***'
        }])
        .mockRejectedValueOnce(new Error('Processing failed'));

      // Act
      const result = await discoveryEngine.discoverPIIFields(dataset, {
        continueOnError: true
      });

      // Assert
      expect(result.discoveredFields).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].fieldName).toBe('field2');
    });
  });
});