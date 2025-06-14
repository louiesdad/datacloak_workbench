import { FieldGenerator } from '../generators/field-generator';
import { SyntheticDataset } from '../generators/synthetic-dataset';
import { DataGenerator } from '../generators/data-generator';

describe('Data Generators', () => {
  describe('FieldGenerator', () => {
    test('generates string fields', () => {
      const values = FieldGenerator.generate('string', {
        count: 10,
        minLength: 5,
        maxLength: 15,
        nullRate: 0
      });
      
      expect(values).toHaveLength(10);
      expect(values.every(v => typeof v === 'string' && v.length >= 5 && v.length <= 15)).toBe(true);
    });

    test('generates number fields', () => {
      const values = FieldGenerator.generate('number', {
        count: 10,
        minValue: 0,
        maxValue: 100,
        nullRate: 0
      });
      
      expect(values).toHaveLength(10);
      expect(values.every(v => typeof v === 'number' && v >= 0 && v <= 100)).toBe(true);
    });

    test('generates boolean fields', () => {
      const values = FieldGenerator.generate('boolean', {
        count: 10,
        nullRate: 0
      });
      
      expect(values).toHaveLength(10);
      expect(values.every(v => typeof v === 'boolean')).toBe(true);
    });

    test('generates email fields', () => {
      const values = FieldGenerator.generate('email', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => typeof v === 'string' && v.includes('@'))).toBe(true);
    });

    test('generates URL fields', () => {
      const values = FieldGenerator.generate('url', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://')))).toBe(true);
    });

    test('generates phone fields', () => {
      const values = FieldGenerator.generate('phone', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => typeof v === 'string' && /\d/.test(v))).toBe(true);
    });

    test('generates date fields', () => {
      const values = FieldGenerator.generate('date', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => typeof v === 'string' && !isNaN(Date.parse(v)))).toBe(true);
    });

    test('generates JSON fields', () => {
      const values = FieldGenerator.generate('json', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => {
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      })).toBe(true);
    });

    test('generates array fields', () => {
      const values = FieldGenerator.generate('array', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => Array.isArray(v))).toBe(true);
    });

    test('generates object fields', () => {
      const values = FieldGenerator.generate('object', {
        count: 5,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))).toBe(true);
    });

    test('respects null rate', () => {
      const values = FieldGenerator.generate('string', {
        count: 100,
        nullRate: 0.5
      });
      
      const nullCount = values.filter(v => v === null).length;
      expect(nullCount).toBeGreaterThan(20); // Should be around 50, but allow variance
      expect(nullCount).toBeLessThan(80);
    });

    test('uses custom patterns for strings', () => {
      const patterns = ['PREFIX_001', 'PREFIX_002', 'PREFIX_003'];
      const values = FieldGenerator.generate('string', {
        count: 10,
        patterns,
        nullRate: 0
      });
      
      expect(values).toHaveLength(10);
      expect(values.every(v => patterns.includes(v))).toBe(true);
    });

    test('uses custom generator', () => {
      const customGenerator = () => 'CUSTOM_VALUE';
      const values = FieldGenerator.generate('string', {
        count: 5,
        customGenerator,
        nullRate: 0
      });
      
      expect(values).toHaveLength(5);
      expect(values.every(v => v === 'CUSTOM_VALUE')).toBe(true);
    });
  });

  describe('SyntheticDataset', () => {
    test('generates dataset with custom schema', () => {
      const schema = {
        id: { type: 'number' as const, options: { minValue: 1, maxValue: 1000 } },
        name: { type: 'string' as const, options: { minLength: 3, maxLength: 20 } },
        email: { type: 'email' as const },
        active: { type: 'boolean' as const }
      };
      
      const dataset = SyntheticDataset.generate({
        recordCount: 50,
        schema,
        name: 'test-dataset'
      });
      
      expect(dataset.name).toBe('test-dataset');
      expect(dataset.fields.id).toHaveLength(50);
      expect(dataset.fields.name).toHaveLength(50);
      expect(dataset.fields.email).toHaveLength(50);
      expect(dataset.fields.active).toHaveLength(50);
      expect(dataset.metadata?.recordCount).toBe(50);
    });

    test('generates user dataset', () => {
      const dataset = SyntheticDataset.generateUserDataset(100);
      
      expect(dataset.name).toBe('users-dataset');
      expect(dataset.fields.id).toHaveLength(100);
      expect(dataset.fields.email).toHaveLength(100);
      expect(dataset.fields.firstName).toHaveLength(100);
      expect(dataset.fields.lastName).toHaveLength(100);
      expect(dataset.metadata?.recordCount).toBe(100);
    });

    test('generates sales dataset', () => {
      const dataset = SyntheticDataset.generateSalesDataset(50);
      
      expect(dataset.name).toBe('sales-dataset');
      expect(dataset.fields.orderId).toHaveLength(50);
      expect(dataset.fields.customerId).toHaveLength(50);
      expect(dataset.fields.amount).toHaveLength(50);
      expect(dataset.metadata?.recordCount).toBe(50);
    });

    test('generates logs dataset', () => {
      const dataset = SyntheticDataset.generateLogDataset(200);
      
      expect(dataset.name).toBe('logs-dataset');
      expect(dataset.fields.timestamp).toHaveLength(200);
      expect(dataset.fields.level).toHaveLength(200);
      expect(dataset.fields.message).toHaveLength(200);
      expect(dataset.metadata?.recordCount).toBe(200);
    });

    test('generates mixed types dataset', () => {
      const dataset = SyntheticDataset.generateMixedTypesDataset(30);
      
      expect(dataset.name).toBe('mixed-types-dataset');
      expect(Object.keys(dataset.fields)).toHaveLength(10);
      expect(dataset.fields.stringField).toHaveLength(30);
      expect(dataset.fields.numberField).toHaveLength(30);
      expect(dataset.fields.booleanField).toHaveLength(30);
    });
  });

  describe('DataGenerator', () => {
    test('generates users dataset', () => {
      const dataset = DataGenerator.generate({
        type: 'users',
        recordCount: 50
      });
      
      expect(dataset.name).toBe('users-dataset');
      expect(dataset.fields.email).toHaveLength(50);
    });

    test('generates sales dataset', () => {
      const dataset = DataGenerator.generate({
        type: 'sales',
        recordCount: 30
      });
      
      expect(dataset.name).toBe('sales-dataset');
      expect(dataset.fields.orderId).toHaveLength(30);
    });

    test('generates logs dataset', () => {
      const dataset = DataGenerator.generate({
        type: 'logs',
        recordCount: 100
      });
      
      expect(dataset.name).toBe('logs-dataset');
      expect(dataset.fields.timestamp).toHaveLength(100);
    });

    test('generates mixed dataset', () => {
      const dataset = DataGenerator.generate({
        type: 'mixed',
        recordCount: 25
      });
      
      expect(dataset.name).toBe('mixed-types-dataset');
      expect(Object.keys(dataset.fields).length).toBeGreaterThan(5);
    });

    test('generates custom dataset', () => {
      const schema = {
        customField: { type: 'string' as const, options: { patterns: ['CUSTOM'] } }
      };
      
      const dataset = DataGenerator.generate({
        type: 'custom',
        recordCount: 10,
        schema,
        name: 'my-custom-dataset'
      });
      
      expect(dataset.name).toBe('my-custom-dataset');
      expect(dataset.fields.customField).toHaveLength(10);
      expect(dataset.fields.customField.every(v => v === 'CUSTOM' || v === null)).toBe(true);
    });

    test('throws error for custom type without schema', () => {
      expect(() => {
        DataGenerator.generate({
          type: 'custom',
          recordCount: 10
        });
      }).toThrow('Custom dataset type requires a schema');
    });

    test('generates multiple datasets', () => {
      const configs = [
        { type: 'users' as const, recordCount: 20 },
        { type: 'sales' as const, recordCount: 15 },
        { type: 'logs' as const, recordCount: 25 }
      ];
      
      const datasets = DataGenerator.generateMultiple(configs);
      
      expect(datasets).toHaveLength(3);
      expect(datasets[0].fields.email).toHaveLength(20);
      expect(datasets[1].fields.orderId).toHaveLength(15);
      expect(datasets[2].fields.timestamp).toHaveLength(25);
    });

    test('generates benchmark suite', () => {
      const datasets = DataGenerator.generateBenchmarkSuite();
      
      expect(datasets.length).toBeGreaterThan(0);
      expect(datasets.every(d => d.metadata?.recordCount)).toBe(true);
    });

    test('creates quality variations', () => {
      const variations = DataGenerator.createQualityVariations();
      
      expect(variations).toHaveLength(3);
      expect(variations.find(v => v.name === 'high-quality')).toBeDefined();
      expect(variations.find(v => v.name === 'low-quality')).toBeDefined();
      expect(variations.find(v => v.name === 'sparse')).toBeDefined();
    });

    test('creates size variations', () => {
      const variations = DataGenerator.createSizeVariations([10, 50, 100]);
      
      expect(variations).toHaveLength(3);
      expect(variations[0]).toEqual({ name: 'size-10', recordCount: 10 });
      expect(variations[1]).toEqual({ name: 'size-50', recordCount: 50 });
      expect(variations[2]).toEqual({ name: 'size-100', recordCount: 100 });
    });
  });
});