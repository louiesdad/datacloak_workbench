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

    it('should have temporal consistency in order dates', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Group records by customer
      const customerRecords = new Map<string, typeof dataset.records>();
      dataset.records.forEach(record => {
        if (!customerRecords.has(record.customer_id)) {
          customerRecords.set(record.customer_id, []);
        }
        customerRecords.get(record.customer_id)!.push(record);
      });

      // Check temporal consistency for customers with multiple orders
      let customersWithMultipleOrders = 0;
      customerRecords.forEach((records, customerId) => {
        if (records.length > 1) {
          customersWithMultipleOrders++;
          // Sort by date
          const sortedRecords = [...records].sort((a, b) => 
            new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
          );
          
          // Reviews should come after orders
          for (let i = 0; i < sortedRecords.length; i++) {
            if (sortedRecords[i].product_review) {
              // If there's a review, it should be for a past order
              expect(new Date(sortedRecords[i].order_date).getTime()).toBeLessThanOrEqual(Date.now());
            }
          }
        }
      });

      // Ensure we have some customers with multiple orders
      expect(customersWithMultipleOrders).toBeGreaterThan(0);
    });

    it('should have realistic missing data patterns', () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Count populated fields
      let reviewCount = 0;
      let commentCount = 0;
      let ticketCount = 0;
      
      dataset.records.forEach(record => {
        if (record.product_review) reviewCount++;
        if (record.customer_comment) commentCount++;
        if (record.support_ticket) ticketCount++;
      });

      // Check realistic proportions (based on spec: 70%, 40%, 20% populated)
      const reviewPercentage = reviewCount / dataset.records.length;
      const commentPercentage = commentCount / dataset.records.length;
      const ticketPercentage = ticketCount / dataset.records.length;

      expect(reviewPercentage).toBeCloseTo(0.7, 1);
      expect(commentPercentage).toBeCloseTo(0.4, 1);
      expect(ticketPercentage).toBeCloseTo(0.2, 1);
    });
  });
});