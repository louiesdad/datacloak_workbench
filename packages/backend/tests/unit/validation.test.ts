import {
  sentimentAnalysisSchema,
  batchSentimentAnalysisSchema,
  paginationSchema,
  exportDataSchema,
  datasetIdSchema
} from '../../src/validation/schemas';

describe('Validation Schemas', () => {
  describe('sentimentAnalysisSchema', () => {
    it('should validate valid sentiment analysis request', () => {
      const validData = { text: 'This is a test message' };
      const { error } = sentimentAnalysisSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject empty text', () => {
      const invalidData = { text: '' };
      const { error } = sentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('empty');
    });

    it('should reject missing text', () => {
      const invalidData = {};
      const { error } = sentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('required');
    });

    it('should reject text that is too long', () => {
      const invalidData = { text: 'a'.repeat(10001) };
      const { error } = sentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('10,000');
    });

    it('should trim whitespace and validate', () => {
      const validData = { text: '  This is a test  ' };
      const { error, value } = sentimentAnalysisSchema.validate(validData);
      expect(error).toBeUndefined();
      expect(value.text).toBe('This is a test');
    });
  });

  describe('batchSentimentAnalysisSchema', () => {
    it('should validate valid batch request', () => {
      const validData = { texts: ['Text 1', 'Text 2', 'Text 3'] };
      const { error } = batchSentimentAnalysisSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject empty array', () => {
      const invalidData = { texts: [] };
      const { error } = batchSentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('least one');
    });

    it('should reject array with too many items', () => {
      const invalidData = { texts: new Array(1001).fill('text') };
      const { error } = batchSentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('1000');
    });

    it('should reject missing texts array', () => {
      const invalidData = {};
      const { error } = batchSentimentAnalysisSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('required');
    });

    it('should validate array with valid text lengths', () => {
      const validData = { texts: ['Short', 'Medium length text', 'A bit longer text for testing'] };
      const { error } = batchSentimentAnalysisSchema.validate(validData);
      expect(error).toBeUndefined();
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination parameters', () => {
      const validData = { page: 1, pageSize: 10 };
      const { error } = paginationSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should use default values when parameters are missing', () => {
      const { error, value } = paginationSchema.validate({});
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.pageSize).toBe(10);
    });

    it('should reject invalid page number', () => {
      const invalidData = { page: 0, pageSize: 10 };
      const { error } = paginationSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should reject invalid page size', () => {
      const invalidData = { page: 1, pageSize: 101 };
      const { error } = paginationSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should accept string numbers and convert them', () => {
      const validData = { page: '2', pageSize: '20' };
      const { error, value } = paginationSchema.validate(validData);
      expect(error).toBeUndefined();
      expect(value.page).toBe(2);
      expect(value.pageSize).toBe(20);
    });
  });

  describe('exportDataSchema', () => {
    it('should validate valid export request', () => {
      const validData = { format: 'csv' };
      const { error } = exportDataSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should accept all valid formats', () => {
      const formats = ['csv', 'json', 'xlsx'];
      formats.forEach(format => {
        const { error } = exportDataSchema.validate({ format });
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid format', () => {
      const invalidData = { format: 'pdf' };
      const { error } = exportDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('csv, json, xlsx');
    });

    it('should reject missing format', () => {
      const invalidData = {};
      const { error } = exportDataSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('required');
    });

    it('should validate with optional parameters', () => {
      const validData = {
        format: 'json',
        datasetId: '123e4567-e89b-12d3-a456-426614174000',
        dateRange: {
          start: '2023-01-01T00:00:00.000Z',
          end: '2023-12-31T23:59:59.999Z'
        },
        sentimentFilter: 'positive'
      };
      const { error } = exportDataSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should validate sentiment filter options', () => {
      const sentiments = ['positive', 'negative', 'neutral'];
      sentiments.forEach(sentiment => {
        const { error } = exportDataSchema.validate({ 
          format: 'csv', 
          sentimentFilter: sentiment 
        });
        expect(error).toBeUndefined();
      });
    });

    it('should reject invalid sentiment filter', () => {
      const invalidData = { format: 'csv', sentimentFilter: 'invalid' };
      const { error } = exportDataSchema.validate(invalidData);
      expect(error).toBeDefined();
    });

    it('should validate date range ordering', () => {
      const invalidData = {
        format: 'csv',
        dateRange: {
          start: '2023-12-31T00:00:00.000Z',
          end: '2023-01-01T00:00:00.000Z'
        }
      };
      const { error } = exportDataSchema.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('datasetIdSchema', () => {
    it('should validate valid UUID', () => {
      const validData = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const { error } = datasetIdSchema.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid UUID format', () => {
      const invalidData = { id: 'not-a-uuid' };
      const { error } = datasetIdSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('Invalid dataset ID format');
    });

    it('should reject missing ID', () => {
      const invalidData = {};
      const { error } = datasetIdSchema.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('required');
    });

    it('should accept various valid UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        '00000000-0000-0000-0000-000000000000'
      ];
      
      validUUIDs.forEach(uuid => {
        const { error } = datasetIdSchema.validate({ id: uuid });
        expect(error).toBeUndefined();
      });
    });
  });
});