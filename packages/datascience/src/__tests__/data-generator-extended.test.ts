import { DataGenerator } from '../generators/data-generator';
import { SyntheticDataset } from '../generators/synthetic-dataset';

describe('DataGenerator Extended Tests', () => {
  describe('Variation Generation', () => {
    test('generates datasets with quality variations', () => {
      const baseOptions = {
        type: 'custom' as const,
        recordCount: 50,
        schema: {
          testField: { 
            type: 'string' as const, 
            options: { nullRate: 0.1 } 
          }
        },
        name: 'base-test'
      };

      const variations = DataGenerator.createQualityVariations();
      const datasets = DataGenerator.generateWithVariations(baseOptions, variations);

      expect(datasets).toHaveLength(4); // Base + 3 variations
      expect(datasets[0].name).toBe('base-test');
      expect(datasets[1].name).toBe('base-test-high-quality');
      expect(datasets[2].name).toBe('base-test-low-quality');
      expect(datasets[3].name).toBe('base-test-sparse');
    });

    test('creates size variations', () => {
      const sizeVariations = DataGenerator.createSizeVariations([10, 50, 100]);

      expect(sizeVariations).toHaveLength(3);
      expect(sizeVariations[0]).toEqual({ name: 'size-10', recordCount: 10 });
      expect(sizeVariations[1]).toEqual({ name: 'size-50', recordCount: 50 });
      expect(sizeVariations[2]).toEqual({ name: 'size-100', recordCount: 100 });
    });

    test('uses default size variations', () => {
      const defaultSizeVariations = DataGenerator.createSizeVariations();

      expect(defaultSizeVariations).toHaveLength(4);
      expect(defaultSizeVariations[0].recordCount).toBe(100);
      expect(defaultSizeVariations[3].recordCount).toBe(5000);
    });
  });

  describe('Benchmark Suite Generation', () => {
    test('generates comprehensive benchmark suite', () => {
      const datasets = DataGenerator.generateBenchmarkSuite();

      expect(datasets.length).toBeGreaterThan(0);
      
      // Check that different types are represented
      const types = ['users', 'sales', 'logs', 'mixed'];
      const sizes = [100, 500, 1000];
      
      expect(datasets.length).toBe(types.length * sizes.length);

      // Verify each dataset has proper structure
      datasets.forEach(dataset => {
        expect(dataset.name).toMatch(/^(benchmark-)?(users|sales|logs|mixed)(-dataset)?(-\d+)?$/);
        expect(dataset.metadata?.recordCount).toBeDefined();
        expect(Object.keys(dataset.fields).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Multiple Dataset Generation', () => {
    test('generates multiple datasets with different configurations', () => {
      const configs = [
        { type: 'users' as const, recordCount: 20, name: 'small-users' },
        { type: 'sales' as const, recordCount: 15, name: 'small-sales' },
        { type: 'logs' as const, recordCount: 25, name: 'small-logs' }
      ];

      const datasets = DataGenerator.generateMultiple(configs);

      expect(datasets).toHaveLength(3);
      expect(datasets[0].name).toBe('users-dataset'); // Default name takes precedence
      expect(datasets[1].name).toBe('sales-dataset');
      expect(datasets[2].name).toBe('logs-dataset');
      
      expect(datasets[0].fields.email).toHaveLength(20);
      expect(datasets[1].fields.orderId).toHaveLength(15);
      expect(datasets[2].fields.timestamp).toHaveLength(25);
    });
  });

  describe('Error Handling', () => {
    test('throws error for unknown dataset type', () => {
      expect(() => {
        DataGenerator.generate({
          type: 'unknown' as any,
          recordCount: 10
        });
      }).toThrow('Unknown dataset type: unknown');
    });

    test('throws error for custom type without schema', () => {
      expect(() => {
        DataGenerator.generate({
          type: 'custom',
          recordCount: 10
        });
      }).toThrow('Custom dataset type requires a schema');
    });
  });
});

describe('SyntheticDataset Extended Tests', () => {
  describe('Seeded Generation', () => {
    test('generates reproducible data with seed', () => {
      const schema = {
        randomField: { 
          type: 'string' as const, 
          options: { minLength: 5, maxLength: 10 } 
        }
      };

      const dataset1 = SyntheticDataset.generate({
        recordCount: 10,
        schema,
        seed: 12345
      });

      const dataset2 = SyntheticDataset.generate({
        recordCount: 10,
        schema,
        seed: 12345
      });

      // With the same seed, should generate identical data
      expect(dataset1.fields.randomField).toEqual(dataset2.fields.randomField);
    });

    test('generates different data with different seeds', () => {
      const schema = {
        randomField: { 
          type: 'string' as const, 
          options: { minLength: 5, maxLength: 10 } 
        }
      };

      const dataset1 = SyntheticDataset.generate({
        recordCount: 10,
        schema,
        seed: 12345
      });

      const dataset2 = SyntheticDataset.generate({
        recordCount: 10,
        schema,
        seed: 54321
      });

      // Different seeds should produce different data
      expect(dataset1.fields.randomField).not.toEqual(dataset2.fields.randomField);
    });
  });

  describe('Predefined Datasets with Custom Sizes', () => {
    test('generates user dataset with custom size', () => {
      const dataset = SyntheticDataset.generateUserDataset(25);

      expect(dataset.name).toBe('users-dataset');
      expect(dataset.fields.id).toHaveLength(25);
      expect(dataset.fields.email).toHaveLength(25);
      expect(dataset.metadata?.recordCount).toBe(25);
    });

    test('generates sales dataset with custom size', () => {
      const dataset = SyntheticDataset.generateSalesDataset(15);

      expect(dataset.name).toBe('sales-dataset');
      expect(dataset.fields.orderId).toHaveLength(15);
      expect(dataset.fields.amount).toHaveLength(15);
      expect(dataset.metadata?.recordCount).toBe(15);
    });

    test('generates logs dataset with custom size', () => {
      const dataset = SyntheticDataset.generateLogDataset(75);

      expect(dataset.name).toBe('logs-dataset');
      expect(dataset.fields.timestamp).toHaveLength(75);
      expect(dataset.fields.level).toHaveLength(75);
      expect(dataset.metadata?.recordCount).toBe(75);
    });

    test('generates mixed types dataset with custom size', () => {
      const dataset = SyntheticDataset.generateMixedTypesDataset(12);

      expect(dataset.name).toBe('mixed-types-dataset');
      expect(Object.keys(dataset.fields)).toHaveLength(10); // All 10 field types
      expect(dataset.fields.stringField).toHaveLength(12);
      expect(dataset.fields.numberField).toHaveLength(12);
      expect(dataset.metadata?.recordCount).toBe(12);
    });
  });

  describe('Metadata Validation', () => {
    test('includes comprehensive metadata', () => {
      const schema = {
        field1: { type: 'string' as const },
        field2: { type: 'number' as const },
        field3: { type: 'boolean' as const }
      };

      const dataset = SyntheticDataset.generate({
        recordCount: 100,
        schema,
        name: 'metadata-test'
      });

      expect(dataset.metadata).toBeDefined();
      expect(dataset.metadata?.generatedAt).toBeDefined();
      expect(dataset.metadata?.recordCount).toBe(100);
      expect(dataset.metadata?.fieldCount).toBe(3);
      expect(dataset.metadata?.schema).toEqual(schema);
    });
  });
});