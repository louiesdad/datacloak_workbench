import { FieldInferenceEngine } from '../field-inference/engine';
import { TypeDetector } from '../field-inference/type-detector';
import { PatternAnalyzer } from '../field-inference/pattern-analyzer';
import { StatisticsCalculator } from '../field-inference/statistics-calculator';
import { DataGenerator } from '../generators';

describe('Field Inference', () => {
  let engine: FieldInferenceEngine;

  beforeEach(() => {
    engine = new FieldInferenceEngine();
  });

  describe('TypeDetector', () => {
    test('detects string type correctly', () => {
      expect(TypeDetector.detectType('hello world')).toBe('string');
      expect(TypeDetector.detectType('123abc')).toBe('string');
    });

    test('detects number type correctly', () => {
      expect(TypeDetector.detectType(123)).toBe('number');
      expect(TypeDetector.detectType(123.45)).toBe('number');
    });

    test('detects boolean type correctly', () => {
      expect(TypeDetector.detectType(true)).toBe('boolean');
      expect(TypeDetector.detectType(false)).toBe('boolean');
    });

    test('detects email type correctly', () => {
      expect(TypeDetector.detectType('user@example.com')).toBe('email');
      expect(TypeDetector.detectType('test.email+tag@domain.co.uk')).toBe('email');
    });

    test('detects URL type correctly', () => {
      expect(TypeDetector.detectType('https://example.com')).toBe('url');
      expect(TypeDetector.detectType('http://website.org/path')).toBe('url');
    });

    test('detects phone type correctly', () => {
      expect(TypeDetector.detectType('+1-555-123-4567')).toBe('phone');
      expect(TypeDetector.detectType('(555) 987-6543')).toBe('phone');
    });

    test('detects date type correctly', () => {
      expect(TypeDetector.detectType('2024-01-15')).toBe('date');
      expect(TypeDetector.detectType('2024-01-15T10:30:00Z')).toBe('date');
    });

    test('detects JSON type correctly', () => {
      expect(TypeDetector.detectType('{"key": "value"}')).toBe('json');
      expect(TypeDetector.detectType('[1, 2, 3]')).toBe('json');
    });

    test('detects null and undefined correctly', () => {
      expect(TypeDetector.detectType(null)).toBe('null');
      expect(TypeDetector.detectType(undefined)).toBe('undefined');
    });

    test('detects array and object types correctly', () => {
      expect(TypeDetector.detectType([1, 2, 3])).toBe('array');
      expect(TypeDetector.detectType({ key: 'value' })).toBe('object');
    });

    test('detects field type with confidence', () => {
      const values = ['user@example.com', 'test@domain.org', 'admin@site.net'];
      const result = TypeDetector.detectFieldType(values);
      
      expect(result.type).toBe('email');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('handles mixed types correctly', () => {
      const values = ['hello', 123, true, 'world'];
      const result = TypeDetector.detectFieldType(values);
      
      expect(result.type).toBe('string');
      expect(result.confidence).toBeLessThan(1.0);
    });
  });

  describe('PatternAnalyzer', () => {
    test('analyzes common patterns', () => {
      const uuids = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
      ];
      
      const patterns = PatternAnalyzer.analyzePatterns(uuids);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].name).toBe('UUID');
      expect(patterns[0].confidence).toBe(1.0);
    });

    test('detects fixed length patterns', () => {
      const values = Array.from({ length: 12 }, (_, i) => `ABC${i.toString().padStart(2, '0')}`);
      const customPatterns = PatternAnalyzer.detectCustomPatterns(values);
      
      const lengthPattern = customPatterns.find(p => p.name.includes('Fixed Length'));
      expect(lengthPattern).toBeDefined();
      expect(lengthPattern?.confidence).toBe(1.0);
    });

    test('detects common prefix patterns', () => {
      const values = Array.from({ length: 15 }, (_, i) => `PREFIX_${i}`);
      const customPatterns = PatternAnalyzer.detectCustomPatterns(values);
      
      const prefixPattern = customPatterns.find(p => p.name.includes('Common Prefix'));
      expect(prefixPattern).toBeDefined();
    });
  });

  describe('StatisticsCalculator', () => {
    test('calculates string statistics', () => {
      const values = ['hello', 'world', 'test', null];
      const stats = StatisticsCalculator.calculate(values, 'string');
      
      expect(stats.nullCount).toBe(1);
      expect(stats.uniqueCount).toBe(3);
      expect(stats.totalCount).toBe(4);
      expect(stats.minLength).toBe(4);
      expect(stats.maxLength).toBe(5);
    });

    test('calculates number statistics', () => {
      const values = [10, 20, 30, null];
      const stats = StatisticsCalculator.calculate(values, 'number');
      
      expect(stats.nullCount).toBe(1);
      expect(stats.minValue).toBe(10);
      expect(stats.maxValue).toBe(30);
      expect(stats.avgValue).toBe(20);
    });

    test('handles empty arrays', () => {
      const values: any[] = [];
      const stats = StatisticsCalculator.calculate(values, 'string');
      
      expect(stats.nullCount).toBe(0);
      expect(stats.uniqueCount).toBe(0);
      expect(stats.totalCount).toBe(0);
    });
  });

  describe('FieldInferenceEngine', () => {
    test('infers field correctly', async () => {
      const values = ['user@example.com', 'test@domain.org', 'admin@site.net'];
      const result = await engine.inferField('email_field', values);
      
      expect(result.fieldName).toBe('email_field');
      expect(result.inferredType).toBe('email');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.statistics.nullCount).toBe(0);
      expect(result.statistics.uniqueCount).toBe(3);
    });

    test('infers dataset correctly', async () => {
      const dataset = DataGenerator.generate({
        type: 'users',
        recordCount: 50,
        name: 'test-users'
      });
      
      const results = await engine.inferDataset(dataset);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.confidence > 0)).toBe(true);
      expect(results.find(r => r.fieldName === 'email')?.inferredType).toBe('email');
      expect(results.find(r => r.fieldName === 'id')?.inferredType).toBe('number');
    });

    test('infers from sample data', async () => {
      const sampleData = [
        { name: 'John', age: 30, email: 'john@example.com' },
        { name: 'Jane', age: 25, email: 'jane@example.com' },
        { name: 'Bob', age: 35, email: 'bob@example.com' }
      ];
      
      const results = await engine.inferFromSample(sampleData);
      
      expect(results.length).toBe(3);
      expect(results.find(r => r.fieldName === 'name')?.inferredType).toBe('string');
      expect(results.find(r => r.fieldName === 'age')?.inferredType).toBe('number');
      expect(results.find(r => r.fieldName === 'email')?.inferredType).toBe('email');
    });

    test('handles mixed quality data', async () => {
      const values = [
        'user@example.com',
        null,
        'invalid-email',
        'test@domain.org',
        undefined,
        'admin@site.net'
      ];
      
      const result = await engine.inferField('mixed_email_field', values);
      
      expect(result.inferredType).toBe('email');
      expect(result.confidence).toBeLessThan(1.0);
      expect(result.statistics.nullCount).toBe(2);
    });
  });
});