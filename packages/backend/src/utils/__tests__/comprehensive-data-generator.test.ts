import { ComprehensiveDataGenerator } from '../comprehensive-data-generator';

describe('ComprehensiveDataGenerator', () => {
  describe('constructor', () => {
    it('should create instance with default seed', () => {
      const generator = new ComprehensiveDataGenerator();
      expect(generator).toBeInstanceOf(ComprehensiveDataGenerator);
    });

    it('should create instance with custom seed', () => {
      const generator = new ComprehensiveDataGenerator(42);
      expect(generator).toBeInstanceOf(ComprehensiveDataGenerator);
    });
  });

  describe('generateEcommerceStandardDataset', () => {
    it('should generate dataset with 10000 records', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      expect(dataset).toBeDefined();
      expect(dataset.metadata.recordCount).toBe(10000);
      expect(dataset.metadata.filename).toBe('test_ecommerce_standard_10k.csv');
    });

    it('should have required fields', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      const requiredFields = [
        'customer_id',
        'email',
        'phone',
        'order_date',
        'product_review',
        'customer_comment',
        'support_ticket',
        'loyalty_status',
        'last_purchase_amount'
      ];
      
      expect(dataset.headers).toEqual(expect.arrayContaining(requiredFields));
    });

    it('should generate reproducible data with same seed', () => {
      const generator1 = new ComprehensiveDataGenerator(42);
      const generator2 = new ComprehensiveDataGenerator(42);
      
      const dataset1 = generator1.generateEcommerceStandardDataset();
      const dataset2 = generator2.generateEcommerceStandardDataset();
      
      expect(dataset1.records[0]).toEqual(dataset2.records[0]);
      expect(dataset1.records[100]).toEqual(dataset2.records[100]);
    });

    it('should generate different data with different seeds', () => {
      const generator1 = new ComprehensiveDataGenerator(42);
      const generator2 = new ComprehensiveDataGenerator(123);
      
      const dataset1 = generator1.generateEcommerceStandardDataset();
      const dataset2 = generator2.generateEcommerceStandardDataset();
      
      expect(dataset1.records[0]).not.toEqual(dataset2.records[0]);
    });
  });
});