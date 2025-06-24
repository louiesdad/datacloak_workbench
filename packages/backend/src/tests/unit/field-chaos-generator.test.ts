import { FieldChaosGenerator } from '../../utils/field-chaos-generator';

describe('FieldChaosGenerator', () => {
  describe('TDD: RED Phase - Failing Tests', () => {
    it('should generate dataset with extreme field variety', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      expect(dataset).toBeDefined();
      expect(dataset.metadata.recordCount).toBe(2000);
      expect(dataset.metadata.uniqueFieldCombinations).toBeGreaterThan(20);
      expect(dataset.headers.length).toBeGreaterThan(30); // Many different fields
    });

    it('should include problematic field characteristics', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      // Should have fields with special characters
      const problematicFields = dataset.headers.filter(h => 
        h.includes(' ') || h.includes('-') || h.includes('.') || h.includes('(')
      );
      expect(problematicFields.length).toBeGreaterThan(5);
    });

    it('should generate records with varying field sets', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      // Different records should have different available fields
      const record1Fields = Object.keys(dataset.records[0]).filter(k => dataset.records[0][k] !== null);
      const record100Fields = Object.keys(dataset.records[100]).filter(k => dataset.records[100][k] !== null);
      
      expect(record1Fields.length).not.toBe(record100Fields.length);
    });

    it('should include mixed data types in text fields', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      // Find text fields that might contain mixed content
      const textFields = dataset.headers.filter(h => h.includes('comment') || h.includes('feedback') || h.includes('notes'));
      expect(textFields.length).toBeGreaterThan(3);
      
      // Check for mixed content types
      const sampleRecord = dataset.records[0];
      const textValues = textFields.map(field => sampleRecord[field as keyof typeof sampleRecord]).filter(v => v);
      expect(textValues.length).toBeGreaterThan(0);
    });

    it('should have inconsistent field naming patterns', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      const fieldNames = dataset.headers;
      
      // Should have different naming conventions
      const camelCase = fieldNames.filter(f => /^[a-z][a-zA-Z]*$/.test(f));
      const snakeCase = fieldNames.filter(f => /^[a-z_]+$/.test(f));
      const spacedNames = fieldNames.filter(f => f.includes(' '));
      
      expect(camelCase.length).toBeGreaterThan(0);
      expect(snakeCase.length).toBeGreaterThan(0);
      expect(spacedNames.length).toBeGreaterThan(0);
    });

    it('should include duplicate-like fields with subtle differences', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      const fieldNames = dataset.headers;
      
      // Look for similar field names
      const customerFields = fieldNames.filter(f => f.toLowerCase().includes('customer'));
      const commentFields = fieldNames.filter(f => f.toLowerCase().includes('comment'));
      
      expect(customerFields.length).toBeGreaterThan(1);
      expect(commentFields.length).toBeGreaterThan(1);
    });

    it('should generate reproducible chaos with same seed', () => {
      const generator1 = new FieldChaosGenerator(123);
      const generator2 = new FieldChaosGenerator(123);
      
      const dataset1 = generator1.generateFieldChaosDataset();
      const dataset2 = generator2.generateFieldChaosDataset();
      
      expect(dataset1.headers).toEqual(dataset2.headers);
      expect(dataset1.records[0]).toEqual(dataset2.records[0]);
    });

    it('should include extreme edge cases in field content', () => {
      const generator = new FieldChaosGenerator(42);
      const dataset = generator.generateFieldChaosDataset();
      
      // Check for various edge cases in the data
      const allValues = dataset.records.flatMap(record => 
        Object.values(record).filter(v => v !== null && v !== undefined)
      );
      
      // Should have empty strings
      expect(allValues.some(v => v === '')).toBe(true);
      
      // Should have very long strings
      expect(allValues.some(v => typeof v === 'string' && v.length > 500)).toBe(true);
      
      // Should have strings with special characters
      expect(allValues.some(v => typeof v === 'string' && /[<>{}[\]\\]/.test(v))).toBe(true);
    });
  });
});