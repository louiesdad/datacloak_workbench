import { GPTAssist } from '../field-inference/gpt-assist';
import { FieldInferenceEngine } from '../field-inference/engine';

describe('GPTAssist', () => {
  let gptAssist: GPTAssist;

  beforeEach(() => {
    gptAssist = new GPTAssist({
      confidenceThreshold: 0.7,
      maxSampleSize: 10,
      modelName: 'gpt-3.5-turbo',
      enableCostEstimation: true
    });
  });

  describe('configuration management', () => {
    it('should initialize with default config', () => {
      const defaultGPT = new GPTAssist();
      const config = defaultGPT.getConfig();
      
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.maxSampleSize).toBe(20);
      expect(config.modelName).toBe('gpt-3.5-turbo');
    });

    it('should update configuration', () => {
      gptAssist.updateConfig({ confidenceThreshold: 0.8 });
      expect(gptAssist.getConfig().confidenceThreshold).toBe(0.8);
    });
  });

  describe('should use GPT assist', () => {
    it('should return true for low confidence results', () => {
      const lowConfidenceResult = {
        fieldName: 'test',
        inferredType: 'string' as const,
        confidence: 0.5,
        statistics: {
          nullCount: 0,
          uniqueCount: 5,
          totalCount: 10
        }
      };

      expect(gptAssist.shouldUseGPTAssist(lowConfidenceResult)).toBe(true);
    });

    it('should return false for high confidence results', () => {
      const highConfidenceResult = {
        fieldName: 'test',
        inferredType: 'email' as const,
        confidence: 0.9,
        statistics: {
          nullCount: 0,
          uniqueCount: 5,
          totalCount: 10
        }
      };

      expect(gptAssist.shouldUseGPTAssist(highConfidenceResult)).toBe(false);
    });
  });

  describe('mock GPT analysis', () => {
    it('should detect email field from name and content', async () => {
      const emailValues = [
        'john.doe@example.com',
        'jane.smith@company.org',
        'admin@website.net'
      ];

      const result = await gptAssist.analyzeWithGPT('user_email', emailValues);
      
      expect(result.inferredType).toBe('email');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toContain('email');
      expect(result.format).toBe('email');
    });

    it('should detect phone field from name', async () => {
      const phoneValues = [
        '555-123-4567',
        '(555) 987-6543',
        '+1-555-555-5555'
      ];

      const result = await gptAssist.analyzeWithGPT('phone_number', phoneValues);
      
      expect(result.inferredType).toBe('phone');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.format).toBe('phone');
    });

    it('should detect URL field from content', async () => {
      const urlValues = [
        'https://example.com',
        'http://website.org/path',
        'https://api.service.net/v1/endpoint'
      ];

      const result = await gptAssist.analyzeWithGPT('website_url', urlValues);
      
      expect(result.inferredType).toBe('url');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.format).toBe('url');
    });

    it('should detect date field from name pattern', async () => {
      const dateValues = [
        '2023-12-25',
        '2024-01-15',
        '2024-06-14'
      ];

      const result = await gptAssist.analyzeWithGPT('created_date', dateValues);
      
      expect(result.inferredType).toBe('date');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.format).toBe('YYYY-MM-DD');
    });

    it('should detect UUID format in ID fields', async () => {
      const uuidValues = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6ba7b811-9dad-11d1-80b4-00c04fd430c8'
      ];

      const result = await gptAssist.analyzeWithGPT('user_id', uuidValues);
      
      expect(result.inferredType).toBe('string');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.format).toBe('UUID');
    });

    it('should detect numeric fields', async () => {
      const numberValues = [123, 456.78, 999, 12.34];

      const result = await gptAssist.analyzeWithGPT('price', numberValues);
      
      expect(result.inferredType).toBe('number');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.format).toBe('decimal');
    });

    it('should detect boolean fields', async () => {
      const booleanValues = [true, false, 'true', 'false'];

      const result = await gptAssist.analyzeWithGPT('is_active', booleanValues);
      
      expect(result.inferredType).toBe('boolean');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should default to string with moderate confidence', async () => {
      const mixedValues = ['random', 'text', 'values', 'here'];

      const result = await gptAssist.analyzeWithGPT('comments', mixedValues);
      
      expect(result.inferredType).toBe('string');
      expect(result.confidence).toBe(0.75);
      expect(result.format).toBe('text');
    });
  });

  describe('enhance inference', () => {
    it('should enhance low confidence inference results', async () => {
      const originalResult = {
        fieldName: 'user_email',
        inferredType: 'string' as const,
        confidence: 0.6,
        statistics: {
          nullCount: 0,
          uniqueCount: 5,
          totalCount: 10
        }
      };

      const emailValues = [
        'john@example.com',
        'jane@company.org',
        'admin@site.net'
      ];

      const enhanced = await gptAssist.enhanceInference('user_email', emailValues, originalResult);
      
      expect(enhanced.inferredType).toBe('email');
      expect(enhanced.confidence).toBeGreaterThan(originalResult.confidence);
      expect(enhanced.format).toBe('email');
    });

    it('should not change high confidence results', async () => {
      const highConfidenceResult = {
        fieldName: 'test_field',
        inferredType: 'number' as const,
        confidence: 0.95,
        statistics: {
          nullCount: 0,
          uniqueCount: 5,
          totalCount: 10
        }
      };

      const values = [1, 2, 3, 4, 5];
      const result = await gptAssist.enhanceInference('test_field', values, highConfidenceResult);
      
      expect(result).toBe(highConfidenceResult);
    });
  });

  describe('cost estimation', () => {
    it('should include cost estimation when enabled', async () => {
      const values = ['test', 'values', 'here'];
      const result = await gptAssist.analyzeWithGPT('test_field', values);
      
      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('should skip cost estimation when disabled', () => {
      const noCostGPT = new GPTAssist({ enableCostEstimation: false });
      // This test would need to be implemented based on the specific behavior
      expect(noCostGPT.getConfig().enableCostEstimation).toBe(false);
    });
  });
});

describe('FieldInferenceEngine with GPT integration', () => {
  let engine: FieldInferenceEngine;

  beforeEach(() => {
    engine = new FieldInferenceEngine({
      confidenceThreshold: 0.7,
      modelName: 'gpt-3.5-turbo'
    });
  });

  it('should use GPT assist for ambiguous email detection', async () => {
    const ambiguousEmails = [
      'contact@example.com',
      'invalid-email-format',
      'another@valid.org',
      'not-an-email'
    ];

    const result = await engine.inferField('contact_info', ambiguousEmails);
    
    // Should detect email despite mixed data quality
    expect(result.inferredType).toBe('email');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should enhance field detection for unclear patterns', async () => {
    const unclearData = [
      '2023-12-01',
      'Dec 1, 2023',
      '01/12/2023',
      null
    ];

    const result = await engine.inferField('event_date', unclearData);
    
    // GPT should help identify this as a date field despite mixed formats
    expect(result.inferredType).toBe('date');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should maintain high confidence for clear patterns', async () => {
    const clearNumbers = [123, 456, 789, 101112];

    const result = await engine.inferField('quantity', clearNumbers);
    
    // Should not need GPT assist for obvious numeric data
    expect(result.inferredType).toBe('number');
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});