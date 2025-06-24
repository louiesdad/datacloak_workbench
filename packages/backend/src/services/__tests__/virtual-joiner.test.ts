import { VirtualJoiner, JoinRelationship, VirtualJoin } from '../virtual-joiner';

// RED: Write failing tests for Virtual Join Creation
describe('Virtual Join Creation', () => {
  let joiner: VirtualJoiner;

  beforeEach(() => {
    joiner = new VirtualJoiner();
  });

  test('should create virtual join from relationships', async () => {
    // Arrange
    const relationship: JoinRelationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'id',
      targetFile: 'orders.csv',
      targetColumn: 'user_id',
      confidence: 0.95,
      relationshipType: 'ONE_TO_MANY'
    };
    
    // Act
    const virtualJoin = await joiner.createJoin(relationship);
    
    // Assert
    expect(virtualJoin).toBeDefined();
    expect(virtualJoin.getColumns()).toContain('users.id');
    expect(virtualJoin.getColumns()).toContain('orders.user_id');
    expect(virtualJoin.getFiles()).toEqual(['users.csv', 'orders.csv']);
    expect(virtualJoin.getJoinType()).toBe('LEFT');
  });
  
  test('should handle multiple join paths', async () => {
    // Arrange
    const relationships: JoinRelationship[] = [
      { 
        sourceFile: 'users.csv', 
        sourceColumn: 'id',
        targetFile: 'orders.csv', 
        targetColumn: 'user_id',
        confidence: 0.95,
        relationshipType: 'ONE_TO_MANY'
      },
      { 
        sourceFile: 'orders.csv', 
        sourceColumn: 'id',
        targetFile: 'order_items.csv', 
        targetColumn: 'order_id',
        confidence: 0.98,
        relationshipType: 'ONE_TO_MANY'
      }
    ];
    
    // Act
    const multiJoin = await joiner.createMultiJoin(relationships);
    
    // Assert
    expect(multiJoin.getFiles()).toEqual(['users.csv', 'orders.csv', 'order_items.csv']);
    expect(multiJoin.getJoinPath()).toEqual([
      { from: 'users.csv', to: 'orders.csv', on: { left: 'id', right: 'user_id' } },
      { from: 'orders.csv', to: 'order_items.csv', on: { left: 'id', right: 'order_id' } }
    ]);
  });

  test('should optimize join order for performance', async () => {
    // Arrange
    const relationships: JoinRelationship[] = [
      {
        sourceFile: 'large_table.csv',
        sourceColumn: 'id',
        targetFile: 'small_table.csv',
        targetColumn: 'large_id',
        confidence: 0.9,
        relationshipType: 'ONE_TO_ONE',
        sourceCardinality: 1000000,
        targetCardinality: 100
      }
    ];

    // Act
    const optimizedJoin = await joiner.createJoin(relationships[0], { optimize: true });

    // Assert
    expect(optimizedJoin.getJoinOrder()).toEqual(['small_table.csv', 'large_table.csv']);
    expect(optimizedJoin.getJoinType()).toBe('RIGHT'); // Optimized to start with smaller table
  });

  test('should validate join compatibility', async () => {
    // Arrange
    const incompatibleRelationship: JoinRelationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'email',
      targetFile: 'products.csv',
      targetColumn: 'price',
      confidence: 0.1,
      relationshipType: 'NONE',
      dataTypeMatch: false
    };

    // Act & Assert
    await expect(joiner.createJoin(incompatibleRelationship))
      .rejects.toThrow('Incompatible data types for join');
  });

  test('should generate join metadata', async () => {
    // Arrange
    const relationship: JoinRelationship = {
      sourceFile: 'customers.csv',
      sourceColumn: 'customer_id',
      targetFile: 'purchases.csv',
      targetColumn: 'cust_id',
      confidence: 0.88,
      relationshipType: 'ONE_TO_MANY'
    };

    // Act
    const virtualJoin = await joiner.createJoin(relationship);
    const metadata = virtualJoin.getMetadata();

    // Assert
    expect(metadata).toMatchObject({
      joinKey: 'customers.customer_id = purchases.cust_id',
      estimatedRows: expect.any(Number),
      joinComplexity: 'SIMPLE',
      performanceScore: expect.any(Number),
      dataQuality: {
        nullKeys: expect.any(Number),
        unmatchedKeys: expect.any(Number),
        duplicateKeys: expect.any(Number)
      }
    });
  });

  test('should support different join types based on relationship', async () => {
    // Arrange
    const innerJoinRelationship: JoinRelationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'id',
      targetFile: 'active_sessions.csv',
      targetColumn: 'user_id',
      confidence: 1.0,
      relationshipType: 'ONE_TO_ONE',
      requireBothSides: true
    };

    // Act
    const innerJoin = await joiner.createJoin(innerJoinRelationship);

    // Assert
    expect(innerJoin.getJoinType()).toBe('INNER');
  });

  test('should handle circular join detection', async () => {
    // Arrange
    const circularRelationships: JoinRelationship[] = [
      {
        sourceFile: 'table_a.csv',
        sourceColumn: 'b_id',
        targetFile: 'table_b.csv',
        targetColumn: 'id',
        confidence: 0.9,
        relationshipType: 'ONE_TO_ONE'
      },
      {
        sourceFile: 'table_b.csv',
        sourceColumn: 'c_id',
        targetFile: 'table_c.csv',
        targetColumn: 'id',
        confidence: 0.9,
        relationshipType: 'ONE_TO_ONE'
      },
      {
        sourceFile: 'table_c.csv',
        sourceColumn: 'a_id',
        targetFile: 'table_a.csv',
        targetColumn: 'id',
        confidence: 0.9,
        relationshipType: 'ONE_TO_ONE'
      }
    ];

    // Act & Assert
    await expect(joiner.createMultiJoin(circularRelationships))
      .rejects.toThrow('Circular join detected');
  });

  test('should generate SQL for virtual join', async () => {
    // Arrange
    const relationship: JoinRelationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'id',
      targetFile: 'orders.csv',
      targetColumn: 'user_id',
      confidence: 0.95,
      relationshipType: 'ONE_TO_MANY'
    };

    // Act
    const virtualJoin = await joiner.createJoin(relationship);
    const sql = virtualJoin.toSQL();

    // Assert
    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM users');
    expect(sql).toContain('LEFT JOIN orders');
    expect(sql).toContain('ON users.id = orders.user_id');
  });

  test('should estimate join result size', async () => {
    // Arrange
    const relationship: JoinRelationship = {
      sourceFile: 'small_users.csv',
      sourceColumn: 'id',
      targetFile: 'large_orders.csv',
      targetColumn: 'user_id',
      confidence: 0.92,
      relationshipType: 'ONE_TO_MANY',
      sourceCardinality: 1000,
      targetCardinality: 50000,
      avgMatchesPerKey: 50
    };

    // Act
    const virtualJoin = await joiner.createJoin(relationship);
    const estimate = virtualJoin.estimateResultSize();

    // Assert
    expect(estimate.minRows).toBe(1000); // At least all users
    expect(estimate.maxRows).toBe(50000); // At most all orders
    expect(estimate.expectedRows).toBeCloseTo(50000, -2); // Close to total orders
  });

  test('should create index recommendations for joins', async () => {
    // Arrange
    const relationship: JoinRelationship = {
      sourceFile: 'users.csv',
      sourceColumn: 'email',
      targetFile: 'subscriptions.csv',
      targetColumn: 'user_email',
      confidence: 0.99,
      relationshipType: 'ONE_TO_MANY',
      hasIndex: false
    };

    // Act
    const virtualJoin = await joiner.createJoin(relationship);
    const recommendations = virtualJoin.getIndexRecommendations();

    // Assert
    expect(recommendations).toContainEqual({
      table: 'subscriptions',
      column: 'user_email',
      type: 'BTREE',
      reason: 'Join key without index'
    });
  });
});