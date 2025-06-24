import { SequentialPatternMiner } from '../sequential-pattern-miner';

// RED: Write failing tests for Sequential Pattern Mining
describe('Sequential Pattern Mining', () => {
  let miner: SequentialPatternMiner;

  beforeEach(() => {
    miner = new SequentialPatternMiner();
  });

  test('should discover action sequences', async () => {
    // Arrange
    const sequences = [
      ['login', 'browse', 'purchase'],
      ['login', 'browse', 'support', 'churn']
    ];
    
    // Act
    const patterns = miner.mine(sequences, { minSupport: 0.3 });
    
    // Assert
    expect(patterns).toBeDefined();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns).toContainEqual({
      sequence: ['login', 'browse'],
      support: 1.0,
      outcomes: expect.any(Object)
    });
  });

  test('should calculate sequence support correctly', () => {
    // Arrange
    const sequences = [
      ['A', 'B', 'C'],
      ['A', 'B', 'D'],
      ['A', 'C', 'D'],
      ['B', 'C', 'D']
    ];
    
    // Act
    const patterns = miner.mine(sequences, { minSupport: 0.5 });
    
    // Assert
    const abPattern = patterns.find(p => 
      p.sequence.length === 2 && 
      p.sequence[0] === 'A' && 
      p.sequence[1] === 'B'
    );
    expect(abPattern).toBeDefined();
    expect(abPattern!.support).toBe(0.5); // 2 out of 4 sequences
  });

  test('should find sentiment-impacting sequences', async () => {
    // Arrange
    const customerJourneys = [
      { 
        sequence: ['email_open', 'product_view', 'purchase', 'positive_review'],
        sentiment: 0.9
      },
      { 
        sequence: ['email_open', 'product_view', 'cart_abandon', 'negative_review'],
        sentiment: 0.2
      },
      { 
        sequence: ['support_contact', 'issue_resolved', 'positive_review'],
        sentiment: 0.8
      },
      { 
        sequence: ['support_contact', 'issue_unresolved', 'churn'],
        sentiment: 0.1
      }
    ];
    
    // Act
    const impactfulSequences = await miner.findSentimentImpactingSequences(customerJourneys);
    
    // Assert
    expect(impactfulSequences).toBeDefined();
    expect(impactfulSequences).toContainEqual(
      expect.objectContaining({
        sequence: ['support_contact', 'issue_resolved'],
        avgSentiment: 0.8,
        sentimentImpact: 'positive'
      })
    );
  });

  test('should identify critical paths to churn', async () => {
    // Arrange
    const journeys = [
      ['login', 'browse', 'purchase', 'continue'],
      ['login', 'browse', 'support', 'issue_unresolved', 'churn'],
      ['login', 'error', 'support', 'no_response', 'churn'],
      ['login', 'browse', 'purchase', 'delivery_issue', 'support', 'resolved', 'continue']
    ];
    
    // Act
    const churnPaths = await miner.findChurnPaths(journeys);
    
    // Assert
    expect(churnPaths).toBeDefined();
    expect(churnPaths).toContainEqual(
      expect.objectContaining({
        pattern: ['support', 'issue_unresolved'],
        churnProbability: expect.any(Number),
        occurrences: expect.any(Number)
      })
    );
    expect(churnPaths[0].churnProbability).toBeGreaterThan(0.5);
  });

  test('should mine patterns with minimum and maximum length constraints', () => {
    // Arrange
    const sequences = [
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'B', 'C', 'F'],
      ['A', 'B', 'D', 'E']
    ];
    
    // Act
    const patterns = miner.mine(sequences, {
      minSupport: 0.6,
      minLength: 2,
      maxLength: 3
    });
    
    // Assert
    patterns.forEach(pattern => {
      expect(pattern.sequence.length).toBeGreaterThanOrEqual(2);
      expect(pattern.sequence.length).toBeLessThanOrEqual(3);
    });
    
    // Should not include single items or sequences longer than 3
    expect(patterns).not.toContainEqual(
      expect.objectContaining({ sequence: ['A'] })
    );
    expect(patterns).not.toContainEqual(
      expect.objectContaining({ sequence: ['A', 'B', 'C', 'D'] })
    );
  });

  test('should handle temporal sequences with time gaps', async () => {
    // Arrange
    const temporalSequences = [
      {
        events: [
          { action: 'email_sent', timestamp: new Date('2024-01-01T10:00:00') },
          { action: 'email_opened', timestamp: new Date('2024-01-01T14:00:00') },
          { action: 'link_clicked', timestamp: new Date('2024-01-01T14:05:00') },
          { action: 'purchase', timestamp: new Date('2024-01-02T09:00:00') }
        ]
      },
      {
        events: [
          { action: 'email_sent', timestamp: new Date('2024-01-01T10:00:00') },
          { action: 'email_opened', timestamp: new Date('2024-01-03T10:00:00') },
          { action: 'unsubscribe', timestamp: new Date('2024-01-03T10:01:00') }
        ]
      }
    ];
    
    // Act
    const patterns = await miner.mineTemporalPatterns(temporalSequences, {
      maxTimeGapHours: 24
    });
    
    // Assert
    expect(patterns).toContainEqual(
      expect.objectContaining({
        sequence: ['email_opened', 'link_clicked'],
        avgTimeGapMinutes: 5,
        support: 0.5
      })
    );
  });

  test('should rank patterns by confidence and lift', () => {
    // Arrange
    const sequences = [
      ['A', 'B', 'C'],
      ['A', 'B', 'D'],
      ['A', 'C'],
      ['B', 'C'],
      ['B', 'D']
    ];
    
    // Act
    const patterns = miner.mine(sequences, { 
      minSupport: 0.3,
      calculateMetrics: true 
    });
    
    // Assert
    patterns.forEach(pattern => {
      if (pattern.sequence.length > 1) {
        expect(pattern.confidence).toBeDefined();
        expect(pattern.lift).toBeDefined();
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  test('should discover seasonal patterns', async () => {
    // Arrange
    const seasonalData = [
      { month: 'January', sequence: ['cold_email', 'no_response'] },
      { month: 'February', sequence: ['cold_email', 'no_response'] },
      { month: 'November', sequence: ['holiday_promo', 'high_engagement', 'purchase'] },
      { month: 'December', sequence: ['holiday_promo', 'high_engagement', 'purchase'] },
      { month: 'December', sequence: ['holiday_promo', 'browse', 'purchase'] }
    ];
    
    // Act
    const seasonalPatterns = await miner.findSeasonalPatterns(seasonalData);
    
    // Assert
    expect(seasonalPatterns).toContainEqual(
      expect.objectContaining({
        pattern: ['holiday_promo', 'high_engagement'],
        seasons: expect.arrayContaining(['November', 'December']),
        seasonalSupport: expect.any(Number)
      })
    );
  });

  test('should handle large sequence datasets efficiently', async () => {
    // Arrange - Generate 1000 sequences
    const largeDataset = Array.from({ length: 1000 }, (_, i) => {
      const actions = ['browse', 'search', 'view', 'cart', 'purchase', 'support'];
      const sequenceLength = Math.floor(Math.random() * 5) + 3;
      return Array.from({ length: sequenceLength }, () => 
        actions[Math.floor(Math.random() * actions.length)]
      );
    });
    
    // Act
    const startTime = Date.now();
    const patterns = miner.mine(largeDataset, { 
      minSupport: 0.05,
      maxLength: 3 
    });
    const elapsedTime = Date.now() - startTime;
    
    // Assert
    expect(patterns).toBeDefined();
    expect(patterns.length).toBeGreaterThan(0);
    expect(elapsedTime).toBeLessThan(5000); // Should complete in under 5 seconds
  });

  test('should provide pattern visualization data', () => {
    // Arrange
    const sequences = [
      ['A', 'B', 'C'],
      ['A', 'B', 'D'],
      ['B', 'C', 'D']
    ];
    
    // Act
    const patterns = miner.mine(sequences, { minSupport: 0.3 });
    const visualization = miner.getPatternGraph(patterns);
    
    // Assert
    expect(visualization).toBeDefined();
    expect(visualization.nodes).toBeDefined();
    expect(visualization.edges).toBeDefined();
    expect(visualization.nodes).toContainEqual(
      expect.objectContaining({
        id: expect.any(String),
        label: expect.any(String),
        frequency: expect.any(Number)
      })
    );
  });
});