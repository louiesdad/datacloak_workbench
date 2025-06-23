import { DataCloakService } from '../datacloak.service';
import { dataCloakManager } from '../datacloak/manager';

// Mock the manager
jest.mock('../datacloak/manager');

describe('DataCloak Multi-Field Wrapper', () => {
  let dataCloak: DataCloakService;
  let mockManager: jest.Mocked<typeof dataCloakManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockManager = dataCloakManager as jest.Mocked<typeof dataCloakManager>;
    dataCloak = new DataCloakService();
  });

  describe('Multi-field masking', () => {
    test('should accept array of fields for masking', async () => {
      // Arrange
      const fields = [
        { fieldName: 'email', text: 'Contact me at john.doe@example.com' },
        { fieldName: 'phone', text: 'My phone is 555-123-4567' },
        { fieldName: 'address', text: 'I live at 123 Main St, Anytown USA' }
      ];

      // Mock the maskText method for each field
      mockManager.maskText
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'Contact me at john.doe@example.com',
            maskedText: 'Contact me at ****@******.***',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 1,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'My phone is 555-123-4567',
            maskedText: 'My phone is ***-***-****',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 1,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'I live at 123 Main St, Anytown USA',
            maskedText: 'I live at *** **** **, ******* ***',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 1,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        });

      const expectedResults = [
        {
          fieldName: 'email',
          originalText: 'Contact me at john.doe@example.com',
          maskedText: 'Contact me at ****@******.***',
          piiItemsFound: 1,
          metadata: undefined,
          success: true
        },
        {
          fieldName: 'phone',
          originalText: 'My phone is 555-123-4567',
          maskedText: 'My phone is ***-***-****',
          piiItemsFound: 1,
          metadata: undefined,
          success: true
        },
        {
          fieldName: 'address',
          originalText: 'I live at 123 Main St, Anytown USA',
          maskedText: 'I live at *** **** **, ******* ***',
          piiItemsFound: 1,
          metadata: undefined,
          success: true
        }
      ];

      const result = await dataCloak.maskFields(fields);

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toEqual(expectedResults);
    });

    test('should maintain backward compatibility with single field', async () => {
      // Arrange
      const text = 'Email me at test@example.com';
      
      mockManager.maskText.mockResolvedValue({
        success: true,
        data: {
          originalText: text,
          maskedText: 'Email me at ****@******.***',
          detectedPII: [],
          metadata: {
            processingTime: 10,
            fieldsProcessed: 1,
            piiItemsFound: 1,
            fallbackUsed: false,
            processingMode: 'fast',
            version: '1.0.0'
          }
        },
        metadata: {
          executionTime: 10,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: 'closed'
        }
      });

      // Test existing single field method still works
      const result = await dataCloak.maskText(text);

      // Assert
      expect(result.originalText).toBe(text);
      expect(result.maskedText).toBe('Email me at ****@******.***');
      expect(result.piiItemsFound).toBe(1);
    });

    test('should process multiple fields in single batch', async () => {
      // Arrange
      const fields = [
        { fieldName: 'field1', text: 'Text with email@test.com' },
        { fieldName: 'field2', text: 'Text with 555-1234' },
        { fieldName: 'field3', text: 'Text with SSN 123-45-6789' }
      ];

      // Setup performance tracking
      const startTime = Date.now();

      // This method doesn't exist yet - test should FAIL
      const result = await dataCloak.maskFields(fields);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - batch processing should be more efficient than sequential
      expect(result).toHaveLength(3);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second for small batch
    });

    test('should handle empty fields array', async () => {
      // This method doesn't exist yet - test should FAIL
      const result = await dataCloak.maskFields([]);

      expect(result).toEqual([]);
    });

    test('should handle fields with no PII', async () => {
      // Arrange
      const fields = [
        { fieldName: 'field1', text: 'This is just regular text' },
        { fieldName: 'field2', text: 'No personal information here' }
      ];

      // Mock responses with no PII found
      mockManager.maskText
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'This is just regular text',
            maskedText: 'This is just regular text',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 0,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'No personal information here',
            maskedText: 'No personal information here',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 0,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        });

      const result = await dataCloak.maskFields(fields);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].maskedText).toBe(result[0].originalText);
      expect(result[0].piiItemsFound).toBe(0);
      expect(result[1].maskedText).toBe(result[1].originalText);
      expect(result[1].piiItemsFound).toBe(0);
    });

    test('should preserve field metadata through processing', async () => {
      // Arrange
      const fields = [
        { 
          fieldName: 'customer_feedback',
          text: 'Call me at 555-1234',
          metadata: { customerId: '12345', timestamp: '2024-01-01' }
        }
      ];

      // This method doesn't exist yet - test should FAIL
      const result = await dataCloak.maskFields(fields);

      // Assert
      expect(result[0].fieldName).toBe('customer_feedback');
      expect(result[0].metadata).toEqual({ 
        customerId: '12345', 
        timestamp: '2024-01-01' 
      });
    });

    test('should handle mixed success and failure in batch', async () => {
      // Arrange
      const fields = [
        { fieldName: 'field1', text: 'Valid text with email@test.com' },
        { fieldName: 'field2', text: null as any }, // Invalid input
        { fieldName: 'field3', text: 'Another valid text' }
      ];

      // Mock successful responses for valid fields
      mockManager.maskText
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'Valid text with email@test.com',
            maskedText: 'Valid text with ****@****.***',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 1,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            originalText: 'Another valid text',
            maskedText: 'Another valid text',
            detectedPII: [],
            metadata: {
              processingTime: 10,
              fieldsProcessed: 1,
              piiItemsFound: 0,
              fallbackUsed: false,
              processingMode: 'fast',
              version: '1.0.0'
            }
          },
          metadata: {
            executionTime: 10,
            retryCount: 0,
            fallbackUsed: false,
            circuitBreakerState: 'closed'
          }
        });

      // Test with continueOnError option to handle invalid fields gracefully
      const result = await dataCloak.maskFields(fields, { continueOnError: true });

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
      expect(result[1].error).toBeDefined();
      expect(result[1].error?.message).toBe('Text cannot be null or undefined');
      expect(result[2].success).toBe(true);
    });
  });

  describe('Performance optimizations', () => {
    test('should batch process fields efficiently', async () => {
      // Arrange - create 100 fields
      const fields = Array.from({ length: 100 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i} with email${i}@test.com`
      }));

      const startTime = Date.now();

      // This method doesn't exist yet - test should FAIL
      const result = await dataCloak.maskFields(fields);

      const endTime = Date.now();
      const avgTimePerField = (endTime - startTime) / fields.length;

      // Assert
      expect(result).toHaveLength(100);
      expect(avgTimePerField).toBeLessThan(50); // Less than 50ms per field average
    });

    test('should support configurable batch size', async () => {
      // Arrange
      const fields = Array.from({ length: 250 }, (_, i) => ({
        fieldName: `field${i}`,
        text: `Text ${i}`
      }));

      const options = {
        batchSize: 50 // Process 50 fields at a time
      };

      // This method doesn't exist yet - test should FAIL
      const result = await dataCloak.maskFields(fields, options);

      // Assert
      expect(result).toHaveLength(250);
      // Verify batching was used (would need to spy on internal methods)
    });
  });

  describe('Error handling', () => {
    test('should handle manager errors gracefully', async () => {
      // Arrange
      const fields = [
        { fieldName: 'field1', text: 'Some text' }
      ];

      mockManager.maskText.mockRejectedValue(new Error('DataCloak service unavailable'));

      // With continueOnError: false (default), it should throw
      await expect(dataCloak.maskFields(fields, { continueOnError: false })).rejects.toThrow('DataCloak service unavailable');
    });

    test('should validate field structure', async () => {
      // Arrange - invalid field structure
      const invalidFields = [
        { text: 'Missing fieldName' } as any,
        { fieldName: 'Missing text' } as any
      ];

      // This method doesn't exist yet - test should FAIL
      await expect(dataCloak.maskFields(invalidFields)).rejects.toThrow('Invalid field structure');
    });
  });
});