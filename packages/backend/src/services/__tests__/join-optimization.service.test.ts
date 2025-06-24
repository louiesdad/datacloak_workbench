import { JoinOptimizationService } from '../join-optimization.service';
import { Relationship } from '../relationship-discoverer.service';

describe('Join Optimization Service', () => {
  let service: JoinOptimizationService;

  beforeEach(() => {
    service = new JoinOptimizationService();
  });

  describe('Join Path Generation', () => {
    test('should generate all valid join paths', () => {
      // RED: Test path generation - this should FAIL initially
      const relationships: Relationship[] = [
        {
          sourceFile: 'A',
          sourceColumn: 'id',
          targetFile: 'B',
          targetColumn: 'a_id',
          confidence: 0.9,
          matchType: 'SEMANTIC'
        },
        {
          sourceFile: 'B',
          sourceColumn: 'id',
          targetFile: 'C',
          targetColumn: 'b_id',
          confidence: 0.8,
          matchType: 'SEMANTIC'
        },
        {
          sourceFile: 'A',
          sourceColumn: 'id',
          targetFile: 'C',
          targetColumn: 'a_id',
          confidence: 0.7,
          matchType: 'SEMANTIC'
        }
      ];

      const paths = service.generatePaths(relationships);

      expect(paths).toContainEqual(['A', 'B', 'C']);
      expect(paths).toContainEqual(['A', 'C']);
      expect(paths.length).toBeGreaterThan(0);
    });

    test('should avoid circular paths', () => {
      // RED: Test cycle detection - this should FAIL initially
      const relationships: Relationship[] = [
        {
          sourceFile: 'A',
          sourceColumn: 'id',
          targetFile: 'B',
          targetColumn: 'a_id',
          confidence: 0.9,
          matchType: 'SEMANTIC'
        },
        {
          sourceFile: 'B',
          sourceColumn: 'id',
          targetFile: 'C',
          targetColumn: 'b_id',
          confidence: 0.8,
          matchType: 'SEMANTIC'
        },
        {
          sourceFile: 'C',
          sourceColumn: 'id',
          targetFile: 'A',
          targetColumn: 'c_id',
          confidence: 0.7,
          matchType: 'SEMANTIC'
        }
      ];

      const paths = service.generatePaths(relationships);
      
      // Should not contain circular paths
      expect(paths).not.toContainEqual(['A', 'B', 'C', 'A']);
      expect(paths.every(path => new Set(path).size === path.length)).toBe(true);
    });

    test('should handle empty relationships', () => {
      // RED: Test edge case - this should FAIL initially
      const relationships: Relationship[] = [];
      
      const paths = service.generatePaths(relationships);
      
      expect(paths).toEqual([]);
    });

    test('should generate single file paths for isolated files', () => {
      // RED: Test single file case - this should FAIL initially
      const relationships: Relationship[] = [
        {
          sourceFile: 'A',
          sourceColumn: 'id',
          targetFile: 'B',
          targetColumn: 'a_id',
          confidence: 0.9,
          matchType: 'SEMANTIC'
        }
      ];

      const paths = service.generatePaths(relationships);
      
      expect(paths).toContainEqual(['A', 'B']);
      expect(paths.length).toBe(1);
    });

    test('should limit path length to prevent exponential explosion', () => {
      // RED: Test performance constraint - this should FAIL initially
      const relationships: Relationship[] = [
        { sourceFile: 'A', sourceColumn: 'id', targetFile: 'B', targetColumn: 'a_id', confidence: 0.9, matchType: 'SEMANTIC' },
        { sourceFile: 'B', sourceColumn: 'id', targetFile: 'C', targetColumn: 'b_id', confidence: 0.8, matchType: 'SEMANTIC' },
        { sourceFile: 'C', sourceColumn: 'id', targetFile: 'D', targetColumn: 'c_id', confidence: 0.7, matchType: 'SEMANTIC' },
        { sourceFile: 'D', sourceColumn: 'id', targetFile: 'E', targetColumn: 'd_id', confidence: 0.6, matchType: 'SEMANTIC' },
        { sourceFile: 'E', sourceColumn: 'id', targetFile: 'F', targetColumn: 'e_id', confidence: 0.5, matchType: 'SEMANTIC' }
      ];

      const paths = service.generatePaths(relationships, { maxPathLength: 3 });
      
      expect(paths.every(path => path.length <= 3)).toBe(true);
    });
  });

  describe('Join Quality Evaluation', () => {
    test('should calculate join selectivity', async () => {
      // RED: Test quality metrics - this should FAIL initially
      const join = {
        leftFile: 'users',
        rightFile: 'orders',
        joinKey: {
          leftColumn: 'id',
          rightColumn: 'user_id'
        }
      };

      const quality = await service.evaluateJoinQuality(join);

      expect(quality).toMatchObject({
        selectivity: expect.any(Number),
        dataCompleteness: expect.any(Number),
        sentimentCoverage: expect.any(Number)
      });
      expect(quality.selectivity).toBeGreaterThanOrEqual(0);
      expect(quality.selectivity).toBeLessThanOrEqual(1);
    });

    test('should predict sentiment improvement', async () => {
      // RED: Test improvement calculation - this should FAIL initially
      const join = {
        leftFile: 'users',
        rightFile: 'orders',
        joinKey: {
          leftColumn: 'id',
          rightColumn: 'user_id'
        }
      };

      const baseline = await service.calculateBaselineSentimentQuality();
      const joined = await service.calculateJoinedSentimentQuality(join);

      expect(baseline).toBeGreaterThan(0);
      expect(joined).toBeGreaterThan(0);
      
      const improvement = (joined - baseline) / baseline;
      expect(improvement).toBeGreaterThanOrEqual(-1); // Can be negative for poor joins
    });

    test('should handle missing file scenarios', async () => {
      // RED: Test error handling - this should FAIL initially
      const invalidJoin = {
        leftFile: 'nonexistent',
        rightFile: 'orders',
        joinKey: {
          leftColumn: 'id',
          rightColumn: 'user_id'
        }
      };

      await expect(service.evaluateJoinQuality(invalidJoin))
        .rejects.toThrow('File not found');
    });

    test('should calculate cardinality estimates', async () => {
      // RED: Test cardinality calculation - this should FAIL initially
      const join = {
        leftFile: 'users',
        rightFile: 'orders',
        joinKey: {
          leftColumn: 'id',
          rightColumn: 'user_id'
        }
      };

      const cardinality = await service.estimateJoinCardinality(join);

      expect(cardinality).toMatchObject({
        leftRows: expect.any(Number),
        rightRows: expect.any(Number),
        estimatedResultRows: expect.any(Number),
        joinType: expect.stringMatching(/ONE_TO_ONE|ONE_TO_MANY|MANY_TO_MANY/)
      });
    });
  });

  describe('SQL Query Generation', () => {
    test('should generate valid join queries', () => {
      // RED: Test query generation - this should FAIL initially
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{
          leftFile: 'users',
          leftColumn: 'id',
          rightFile: 'orders',
          rightColumn: 'user_id'
        }]
      };

      const sql = service.generateJoinQuery(recommendation);

      expect(sql).toContain('JOIN');
      expect(sql).toContain('users.id = orders.user_id');
      expect(sql).toMatch(/SELECT[\s\S]*FROM[\s\S]*JOIN/i);
    });

    test('should include relevant columns only', () => {
      // RED: Test column selection - this should FAIL initially
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{
          leftFile: 'users',
          leftColumn: 'id',
          rightFile: 'orders',
          rightColumn: 'user_id'
        }]
      };

      const sql = service.generateJoinQuery(recommendation, {
        includeColumns: ['sentiment_relevant']
      });

      expect(sql).not.toContain('SELECT *');
      expect(sql).toContain('sentiment_relevant');
    });

    test('should handle multiple joins', () => {
      // RED: Test complex joins - this should FAIL initially
      const recommendation = {
        files: ['users', 'orders', 'reviews'],
        joinKeys: [
          {
            leftFile: 'users',
            leftColumn: 'id',
            rightFile: 'orders',
            rightColumn: 'user_id'
          },
          {
            leftFile: 'orders',
            leftColumn: 'id',
            rightFile: 'reviews',
            rightColumn: 'order_id'
          }
        ]
      };

      const sql = service.generateJoinQuery(recommendation);

      expect(sql).toContain('users');
      expect(sql).toContain('orders');
      expect(sql).toContain('reviews');
      expect(sql.match(/JOIN/gi)?.length).toBe(2);
    });

    test('should optimize for DuckDB analytics', () => {
      // RED: Test DuckDB optimization - this should FAIL initially
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{
          leftFile: 'users',
          leftColumn: 'id',
          rightFile: 'orders',
          rightColumn: 'user_id'
        }]
      };

      const sql = service.generateAnalyticsQuery(recommendation);

      expect(sql).toContain('WITH');
      expect(sql).toMatch(/SAMPLE|TABLESAMPLE/i);
    });

    test('should handle edge cases in query generation', () => {
      // RED: Test edge cases - this should FAIL initially
      const emptyRecommendation = {
        files: [],
        joinKeys: []
      };

      expect(() => service.generateJoinQuery(emptyRecommendation))
        .toThrow('Cannot generate query for empty recommendation');
    });
  });

  describe('Integration: End-to-End Join Optimization', () => {
    test('should complete full join optimization workflow', async () => {
      // Integration test: path generation → quality evaluation → query generation
      const relationships: Relationship[] = [
        {
          sourceFile: 'users',
          sourceColumn: 'id',
          targetFile: 'orders',
          targetColumn: 'user_id',
          confidence: 0.9,
          matchType: 'SEMANTIC'
        },
        {
          sourceFile: 'orders',
          sourceColumn: 'id',
          targetFile: 'reviews',
          targetColumn: 'order_id',
          confidence: 0.85,
          matchType: 'SEMANTIC'
        }
      ];

      // Step 1: Generate join paths
      const paths = service.generatePaths(relationships);
      expect(paths.length).toBeGreaterThan(0);

      // Step 2: Evaluate join quality for a path
      const joinSpec = {
        leftFile: 'users',
        rightFile: 'orders',
        joinKey: {
          leftColumn: 'id',
          rightColumn: 'user_id'
        }
      };

      const quality = await service.evaluateJoinQuality(joinSpec);
      expect(quality.selectivity).toBeGreaterThan(0);

      // Step 3: Generate SQL query
      const recommendation = {
        files: ['users', 'orders'],
        joinKeys: [{
          leftFile: 'users',
          leftColumn: 'id',
          rightFile: 'orders',
          rightColumn: 'user_id'
        }]
      };

      const sql = service.generateJoinQuery(recommendation);
      expect(sql).toContain('JOIN');
      expect(sql).toContain('users.id = orders.user_id');

      // Step 4: Generate analytics query
      const analyticsQuery = service.generateAnalyticsQuery(recommendation);
      expect(analyticsQuery).toContain('WITH');
      expect(analyticsQuery).toContain('TABLESAMPLE');
    });

    test('should recommend optimal join strategy', async () => {
      // Test the full recommendation pipeline
      const joinSpec = {
        leftFile: 'users',
        rightFile: 'klaviyo',
        joinKey: {
          leftColumn: 'email',
          rightColumn: 'email'
        }
      };

      const baseline = await service.calculateBaselineSentimentQuality();
      const joined = await service.calculateJoinedSentimentQuality(joinSpec);
      const cardinality = await service.estimateJoinCardinality(joinSpec);

      expect(joined).toBeGreaterThanOrEqual(baseline);
      expect(cardinality.joinType).toMatch(/ONE_TO_ONE|ONE_TO_MANY|MANY_TO_MANY/);

      // Verify improvement is positive or neutral
      const improvement = (joined - baseline) / baseline;
      expect(improvement).toBeGreaterThanOrEqual(0);
    });
  });
});