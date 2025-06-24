import { DynamicQueryBuilder } from '../../database/query-builder/dynamic-query-builder';
import { TestDatabaseFactory } from '../utils/test-database-factory';

describe('Dynamic Query Builder - TDD', () => {
  let db: any;
  let queryBuilder: DynamicQueryBuilder;

  beforeEach(async () => {
    db = await TestDatabaseFactory.createTestDatabase();
    queryBuilder = new DynamicQueryBuilder(db);
  });

  afterEach(async () => {
    await TestDatabaseFactory.cleanup(db);
  });

  describe('RED Phase - Query Builder Tests', () => {
    it('should build simple join query from recommendation', async () => {
      // RED: This test should FAIL initially
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }]
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query).toBeDefined();
      expect(query.toString()).toContain('JOIN');
      expect(query.toString()).toContain('users.id = orders.user_id');
    });

    it('should build complex multi-table join query', async () => {
      // Test multiple table joins
      const recommendation = {
        files: ['users', 'orders', 'products'],
        joinKeys: [
          { left: 'id', right: 'user_id', leftTable: 'users', rightTable: 'orders' },
          { left: 'product_id', right: 'id', leftTable: 'orders', rightTable: 'products' }
        ]
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query.toString()).toContain('users');
      expect(query.toString()).toContain('orders');
      expect(query.toString()).toContain('products');
      expect(query.toString()).toContain('users.id = orders.user_id');
      expect(query.toString()).toContain('orders.product_id = products.id');
    });

    it('should optimize for DuckDB analytics', async () => {
      // Test DuckDB-specific optimizations
      const recommendation = {
        files: ['large_dataset', 'reference_data'],
        joinKeys: [{ left: 'key', right: 'ref_key' }],
        sampleSize: 10000
      };
      
      const query = queryBuilder.buildAnalyticsQuery(recommendation);
      
      expect(query.toString()).toContain('SAMPLE');
      expect(query.toString()).toContain('10000');
    });

    it('should handle different join types', async () => {
      // Test different join types (INNER, LEFT, RIGHT, FULL)
      const recommendation = {
        files: ['table_a', 'table_b'],
        joinKeys: [{ left: 'id', right: 'foreign_id' }],
        joinType: 'LEFT'
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query.toString()).toContain('LEFT JOIN');
    });

    it('should select only relevant columns', async () => {
      // Test column selection optimization
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }],
        includeColumns: ['users.name', 'users.email', 'orders.amount', 'orders.date']
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query.toString()).toContain('users.name');
      expect(query.toString()).toContain('users.email');
      expect(query.toString()).toContain('orders.amount');
      expect(query.toString()).not.toContain('SELECT *');
    });

    it('should add WHERE conditions for filtering', async () => {
      // Test conditional filtering
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }],
        conditions: [
          { column: 'users.active', operator: '=', value: true },
          { column: 'orders.amount', operator: '>', value: 100 }
        ]
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query.toString()).toContain('WHERE');
      expect(query.toString()).toContain('users.active = ?');
      expect(query.toString()).toContain('orders.amount > ?');
    });

    it('should handle aggregate functions', async () => {
      // Test aggregation queries
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }],
        aggregations: [
          { function: 'COUNT', column: 'orders.id', alias: 'order_count' },
          { function: 'SUM', column: 'orders.amount', alias: 'total_amount' }
        ],
        groupBy: ['users.id', 'users.name']
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      expect(query.toString()).toContain('COUNT(orders.id) AS order_count');
      expect(query.toString()).toContain('SUM(orders.amount) AS total_amount');
      expect(query.toString()).toContain('GROUP BY');
    });

    it('should generate parameterized queries for security', async () => {
      // Test SQL injection prevention
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }],
        conditions: [
          { column: 'users.email', operator: '=', value: 'test@example.com' }
        ]
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      const params = query.getParameters();
      
      expect(query.toString()).toContain('?');
      expect(params).toContain('test@example.com');
      expect(query.toString()).not.toContain('test@example.com'); // Value should be parameterized
    });
  });

  describe('Query Validation Tests', () => {
    it('should validate table names to prevent SQL injection', async () => {
      // Test table name validation
      const invalidRecommendation = {
        files: ['users; DROP TABLE users; --', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }]
      };
      
      expect(() => {
        queryBuilder.buildJoinQuery(invalidRecommendation);
      }).toThrow('Invalid table name');
    });

    it('should validate column names', async () => {
      // Test column name validation
      const invalidRecommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id; SELECT * FROM passwords; --', right: 'user_id' }]
      };
      
      expect(() => {
        queryBuilder.buildJoinQuery(invalidRecommendation);
      }).toThrow('Invalid column name');
    });

    it('should require at least one join key', async () => {
      // Test join key requirement
      const invalidRecommendation = {
        files: ['users', 'orders'],
        joinKeys: []
      };
      
      expect(() => {
        queryBuilder.buildJoinQuery(invalidRecommendation);
      }).toThrow('At least one join key is required');
    });
  });

  describe('Performance Optimization Tests', () => {
    it('should add table sampling for large datasets', async () => {
      // Test automatic sampling
      const recommendation = {
        files: ['huge_table', 'reference'],
        joinKeys: [{ left: 'id', right: 'ref_id' }],
        estimatedRows: 10000000 // 10M rows
      };
      
      const query = queryBuilder.buildAnalyticsQuery(recommendation);
      
      expect(query.toString()).toContain('TABLESAMPLE');
    });

    it('should optimize join order based on table sizes', async () => {
      // Test join order optimization
      const recommendation = {
        files: ['small_table', 'large_table'],
        joinKeys: [{ left: 'id', right: 'foreign_id' }],
        tableSizes: { small_table: 1000, large_table: 1000000 }
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      
      // Smaller table should come first in the join
      const queryStr = query.toString();
      const smallTableIndex = queryStr.indexOf('small_table');
      const largeTableIndex = queryStr.indexOf('large_table');
      
      expect(smallTableIndex).toBeLessThan(largeTableIndex);
    });

    it('should add appropriate indexes suggestions', async () => {
      // Test index recommendations
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{ left: 'id', right: 'user_id' }]
      };
      
      const query = queryBuilder.buildJoinQuery(recommendation);
      const indexSuggestions = query.getIndexSuggestions();
      
      expect(indexSuggestions).toContain('CREATE INDEX idx_users_id ON users(id)');
      expect(indexSuggestions).toContain('CREATE INDEX idx_orders_user_id ON orders(user_id)');
    });
  });
});