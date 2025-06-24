import { RelationshipDiscoverer } from '../relationship-discoverer.service';
import { RelationshipClassifier } from '../relationship-classifier.service';

describe('Relationship Discovery Engine', () => {
  let discoverer: RelationshipDiscoverer;

  beforeEach(() => {
    discoverer = new RelationshipDiscoverer();
  });

  describe('Basic Relationship Detection', () => {
    it('should detect exact column name matches', async () => {
      // RED: Simple matching test - this should FAIL initially
      const file1 = { 
        name: 'users.csv',
        columns: [{ name: 'user_id', type: 'string', uniqueness: 0.95 }] 
      };
      const file2 = { 
        name: 'orders.csv',
        columns: [{ name: 'user_id', type: 'string', uniqueness: 0.45 }] 
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        sourceFile: 'users.csv',
        sourceColumn: 'user_id',
        targetFile: 'orders.csv',
        targetColumn: 'user_id',
        confidence: expect.any(Number),
        matchType: 'EXACT_NAME'
      });
      expect(relationships[0].confidence).toBeGreaterThan(0.8);
    });
    
    it('should detect relationships with different column names', async () => {
      // RED: Test semantic matching - this should FAIL initially
      const file1 = {
        name: 'customers.csv',
        columns: [{ name: 'customer_id', type: 'string', uniqueness: 0.98 }]
      };
      const file2 = {
        name: 'purchases.csv', 
        columns: [{ name: 'cust_id', type: 'string', uniqueness: 0.42 }]
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      expect(relationships).toHaveLength(1);
      expect(relationships[0]).toMatchObject({
        sourceFile: 'customers.csv',
        sourceColumn: 'customer_id',
        targetFile: 'purchases.csv',
        targetColumn: 'cust_id',
        confidence: expect.any(Number),
        matchType: 'SEMANTIC'
      });
      expect(relationships[0].confidence).toBeGreaterThan(0.6);
    });

    it('should not create relationships for low confidence matches', async () => {
      // RED: Test confidence threshold filtering
      const file1 = {
        name: 'products.csv',
        columns: [{ name: 'name', type: 'string', uniqueness: 0.25 }]
      };
      const file2 = {
        name: 'categories.csv',
        columns: [{ name: 'title', type: 'string', uniqueness: 0.85 }]
      };
      
      const relationships = await discoverer.discover([file1, file2], { minConfidence: 0.7 });
      
      expect(relationships).toHaveLength(0);
    });

    it('should handle multiple files and find all relationships', async () => {
      // RED: Test multi-file discovery
      const files = [
        {
          name: 'users.csv',
          columns: [
            { name: 'id', type: 'integer', uniqueness: 1.0 },
            { name: 'email', type: 'email', uniqueness: 0.99 }
          ]
        },
        {
          name: 'orders.csv', 
          columns: [
            { name: 'order_id', type: 'integer', uniqueness: 1.0 },
            { name: 'user_id', type: 'integer', uniqueness: 0.45 }
          ]
        },
        {
          name: 'payments.csv',
          columns: [
            { name: 'payment_id', type: 'integer', uniqueness: 1.0 },
            { name: 'order_id', type: 'integer', uniqueness: 0.85 }
          ]
        }
      ];
      
      const relationships = await discoverer.discover(files);
      
      // Should find: users.id -> orders.user_id AND orders.order_id -> payments.order_id
      expect(relationships).toHaveLength(2);
      
      const userOrderRelation = relationships.find(r => 
        r.sourceFile === 'users.csv' && r.targetFile === 'orders.csv'
      );
      expect(userOrderRelation).toBeDefined();
      
      const orderPaymentRelation = relationships.find(r =>
        r.sourceFile === 'orders.csv' && r.targetFile === 'payments.csv'
      );
      expect(orderPaymentRelation).toBeDefined();
    });

    it('should prioritize high uniqueness columns as source keys', async () => {
      // RED: Test key prioritization logic
      const file1 = {
        name: 'primary.csv',
        columns: [
          { name: 'id', type: 'integer', uniqueness: 1.0 },
          { name: 'ref_id', type: 'integer', uniqueness: 0.3 }
        ]
      };
      const file2 = {
        name: 'secondary.csv',
        columns: [
          { name: 'foreign_id', type: 'integer', uniqueness: 0.4 }
        ]
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      expect(relationships).toHaveLength(1);
      expect(relationships[0].sourceColumn).toBe('id'); // High uniqueness should be source
      expect(relationships[0].targetColumn).toBe('foreign_id');
    });
  });

  describe('Relationship Type Detection', () => {
    let classifier: RelationshipClassifier;

    beforeEach(() => {
      classifier = new RelationshipClassifier();
    });

    it('should identify one-to-one relationships', async () => {
      // RED: Test cardinality detection - this should FAIL initially
      const samples = {
        left: ['1', '2', '3'],
        right: ['1', '2', '3']
      };
      
      const type = await classifier.classify(samples);
      expect(type).toBe('ONE_TO_ONE');
    });
    
    it('should identify one-to-many relationships', async () => {
      // RED: Test one-to-many detection
      const samples = {
        left: ['1', '1', '2', '2'],
        right: ['A', 'B', 'C', 'D']
      };
      
      const type = await classifier.classify(samples);
      expect(type).toBe('ONE_TO_MANY');
    });

    it('should identify many-to-many relationships', async () => {
      // RED: Test many-to-many detection
      const samples = {
        left: ['1', '1', '2', '2', '3'],
        right: ['A', 'B', 'A', 'C', 'B']
      };
      
      const type = await classifier.classify(samples);
      expect(type).toBe('MANY_TO_MANY');
    });

    it('should calculate relationship quality metrics', async () => {
      // RED: Test quality metrics calculation
      const samples = {
        left: ['1', '2', '3', '4', '5'],
        right: ['1', '2', '3', '4', null] // 20% null values
      };
      
      const analysis = await classifier.analyzeRelationship(samples);
      
      expect(analysis).toMatchObject({
        type: 'ONE_TO_ONE',
        quality: expect.any(Number),
        completeness: 0.8, // 80% complete (1 null out of 5)
        selectivity: expect.any(Number)
      });
      expect(analysis.quality).toBeLessThan(1.0);
    });
  });

  describe('Confidence Scoring', () => {
    it('should score exact name matches highly', async () => {
      // RED: Test confidence scoring
      const file1 = { 
        name: 'table1.csv',
        columns: [{ name: 'user_id', type: 'integer', uniqueness: 0.95 }] 
      };
      const file2 = { 
        name: 'table2.csv',
        columns: [{ name: 'user_id', type: 'integer', uniqueness: 0.4 }] 
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      expect(relationships[0].confidence).toBeGreaterThan(0.9);
    });

    it('should score semantic matches moderately', async () => {
      // RED: Test semantic match scoring
      const file1 = {
        name: 'users.csv',
        columns: [{ name: 'customer_id', type: 'string', uniqueness: 0.98 }]
      };
      const file2 = {
        name: 'orders.csv',
        columns: [{ name: 'cust_id', type: 'string', uniqueness: 0.45 }]
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      expect(relationships[0].confidence).toBeGreaterThan(0.6);
      expect(relationships[0].confidence).toBeLessThan(0.9);
    });

    it('should factor in data type compatibility', async () => {
      // RED: Test data type scoring
      const file1 = {
        name: 'table1.csv',
        columns: [{ name: 'id', type: 'integer', uniqueness: 0.95 }]
      };
      const file2 = {
        name: 'table2.csv', 
        columns: [{ name: 'id', type: 'string', uniqueness: 0.4 }] // Type mismatch
      };
      
      const relationships = await discoverer.discover([file1, file2]);
      
      if (relationships.length > 0) {
        expect(relationships[0].confidence).toBeLessThan(0.8); // Penalized for type mismatch
      }
    });
  });

  describe('Temporal Relationship Discovery', () => {
    it('should detect time-lagged correlations', async () => {
      // RED: Test temporal pattern detection
      const { TemporalAnalyzer } = await import('../temporal-analyzer.service');
      const analyzer = new TemporalAnalyzer();
      
      const timeSeries1 = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 },
        { date: '2024-01-03', value: 120 },
        { date: '2024-01-04', value: 130 }
      ];
      const timeSeries2 = [
        { date: '2024-01-04', value: 95 },
        { date: '2024-01-05', value: 105 },
        { date: '2024-01-06', value: 115 },
        { date: '2024-01-07', value: 125 }
      ];
      
      const correlation = await analyzer.findLaggedCorrelation(
        timeSeries1, 
        timeSeries2, 
        { maxLagDays: 7 }
      );
      
      expect(correlation.lagDays).toBe(3);
      expect(correlation.coefficient).toBeGreaterThan(0.7);
    });

    it('should handle different date formats', async () => {
      // RED: Test date format handling
      const { TemporalAnalyzer } = await import('../temporal-analyzer.service');
      const analyzer = new TemporalAnalyzer();
      
      const timeSeries1 = [
        { timestamp: new Date('2024-01-01'), value: 100 },
        { timestamp: new Date('2024-01-02'), value: 110 }
      ];
      const timeSeries2 = [
        { timestamp: new Date('2024-01-03'), value: 95 },
        { timestamp: new Date('2024-01-04'), value: 105 }
      ];
      
      const correlation = await analyzer.findLaggedCorrelation(
        timeSeries1, 
        timeSeries2, 
        { maxLagDays: 5 }
      );
      
      expect(correlation).toBeDefined();
      expect(correlation.lagDays).toBeGreaterThanOrEqual(0);
    });

    it('should return null for no significant correlation', async () => {
      // RED: Test no correlation case
      const { TemporalAnalyzer } = await import('../temporal-analyzer.service');
      const analyzer = new TemporalAnalyzer();
      
      const timeSeries1 = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 50 }
      ];
      const timeSeries2 = [
        { date: '2024-01-01', value: 200 },
        { date: '2024-01-02', value: 300 }
      ];
      
      const correlation = await analyzer.findLaggedCorrelation(
        timeSeries1, 
        timeSeries2, 
        { maxLagDays: 3, minCorrelation: 0.8 }
      );
      
      expect(correlation).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty file arrays gracefully', async () => {
      // RED: Test edge cases
      const relationships = await discoverer.discover([]);
      expect(relationships).toHaveLength(0);
    });

    it('should handle files with no columns', async () => {
      // RED: Test malformed data
      const files = [
        { name: 'empty.csv', columns: [] },
        { name: 'normal.csv', columns: [{ name: 'id', type: 'integer', uniqueness: 1.0 }] }
      ];
      
      const relationships = await discoverer.discover(files);
      expect(relationships).toHaveLength(0);
    });

    it('should handle invalid column metadata gracefully', async () => {
      // RED: Test bad input handling
      const files = [
        { name: 'bad.csv', columns: [{ name: null, type: 'string' }] },
        { name: 'good.csv', columns: [{ name: 'id', type: 'integer', uniqueness: 1.0 }] }
      ];
      
      expect(async () => {
        await discoverer.discover(files);
      }).not.toThrow();
    });
  });
});