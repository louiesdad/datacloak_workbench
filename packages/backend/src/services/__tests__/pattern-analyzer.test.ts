import { PatternAnalyzer } from '../pattern-analyzer';
import { VirtualJoin, JoinRelationship } from '../virtual-joiner';

// RED: Write failing tests for Pattern Correlation Analysis
describe('Pattern Correlation Analysis', () => {
  let analyzer: PatternAnalyzer;

  beforeEach(() => {
    analyzer = new PatternAnalyzer();
  });

  test('should find correlated metrics across files', async () => {
    // Arrange
    const virtualJoin = createTestJoin();
    
    // Act
    const correlations = await analyzer.findCorrelations(virtualJoin);
    
    // Assert
    expect(correlations).toBeDefined();
    expect(correlations.length).toBeGreaterThan(0);
    expect(correlations).toContainEqual(
      expect.objectContaining({
        metric1: 'klaviyo.open_rate',
        metric2: 'reviews.sentiment_score',
        correlation: expect.any(Number),
        pValue: expect.any(Number)
      })
    );
  });

  test('should identify leading indicators', async () => {
    // Arrange
    const virtualJoin = createTestJoin();
    
    // Act
    const patterns = await analyzer.findTemporalPatterns(virtualJoin);
    
    // Assert
    expect(patterns).toBeDefined();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns).toContainEqual(
      expect.objectContaining({
        leadingMetric: 'email_engagement',
        lagDays: 3,
        targetMetric: 'customer_sentiment',
        confidence: expect.any(Number)
      })
    );
  });

  test('should calculate correlation coefficients correctly', async () => {
    // Arrange
    const data = {
      series1: [1, 2, 3, 4, 5],
      series2: [2, 4, 6, 8, 10] // Perfect positive correlation
    };
    
    // Act
    const correlation = await analyzer.calculateCorrelation(data.series1, data.series2);
    
    // Assert
    expect(correlation.coefficient).toBeCloseTo(1.0, 2);
    expect(correlation.pValue).toBeLessThan(0.05);
  });

  test('should handle negative correlations', async () => {
    // Arrange
    const data = {
      series1: [1, 2, 3, 4, 5],
      series2: [10, 8, 6, 4, 2] // Perfect negative correlation
    };
    
    // Act
    const correlation = await analyzer.calculateCorrelation(data.series1, data.series2);
    
    // Assert
    expect(correlation.coefficient).toBeCloseTo(-1.0, 2);
    expect(correlation.pValue).toBeLessThan(0.05);
  });

  test('should detect time-lagged correlations', async () => {
    // Arrange
    const timeSeries1 = [
      { timestamp: new Date('2024-01-01'), value: 100 },
      { timestamp: new Date('2024-01-02'), value: 110 },
      { timestamp: new Date('2024-01-03'), value: 120 },
      { timestamp: new Date('2024-01-04'), value: 130 }
    ];
    
    const timeSeries2 = [
      { timestamp: new Date('2024-01-04'), value: 100 },
      { timestamp: new Date('2024-01-05'), value: 110 },
      { timestamp: new Date('2024-01-06'), value: 120 },
      { timestamp: new Date('2024-01-07'), value: 130 }
    ];
    
    // Act
    const laggedCorrelation = await analyzer.findLaggedCorrelation(
      timeSeries1, 
      timeSeries2, 
      { maxLagDays: 7 }
    );
    
    // Assert
    expect(laggedCorrelation.lagDays).toBe(3);
    expect(laggedCorrelation.correlation).toBeGreaterThan(0.8);
  });

  test('should filter correlations by minimum threshold', async () => {
    // Arrange
    const virtualJoin = createTestJoin();
    const minCorrelation = 0.7;
    
    // Act
    const correlations = await analyzer.findCorrelations(virtualJoin, {
      minCorrelation
    });
    
    // Assert
    correlations.forEach(corr => {
      expect(Math.abs(corr.correlation)).toBeGreaterThanOrEqual(minCorrelation);
    });
  });

  test('should identify sentiment-related metrics', async () => {
    // Arrange
    const virtualJoin = createTestJoin();
    
    // Act
    const sentimentMetrics = await analyzer.findSentimentRelatedMetrics(virtualJoin);
    
    // Assert
    expect(sentimentMetrics).toContain('reviews.sentiment_score');
    expect(sentimentMetrics).toContain('support_tickets.satisfaction_rating');
    expect(sentimentMetrics).toContain('nps_survey.score');
  });

  test('should discover metric relationships across multiple files', async () => {
    // Arrange
    const multiFileJoin = createMultiFileTestJoin();
    
    // Act
    const relationships = await analyzer.discoverMetricRelationships(multiFileJoin);
    
    // Assert
    expect(relationships).toBeDefined();
    expect(relationships.graph).toBeDefined();
    expect(relationships.strongestPaths).toBeDefined();
    expect(relationships.clusters).toBeDefined();
  });

  test('should handle missing data gracefully', async () => {
    // Arrange
    const sparseData = {
      series1: [1, null, 3, undefined, 5],
      series2: [2, 4, null, 8, 10]
    };
    
    // Act
    const correlation = await analyzer.calculateCorrelation(
      sparseData.series1 as number[], 
      sparseData.series2 as number[]
    );
    
    // Assert
    expect(correlation).toBeDefined();
    expect(correlation.dataPoints).toBeLessThan(5);
    expect(correlation.missingDataPercentage).toBeGreaterThan(0);
  });

  test('should rank correlations by statistical significance', async () => {
    // Arrange
    const virtualJoin = createTestJoin();
    
    // Act
    const rankedCorrelations = await analyzer.findCorrelations(virtualJoin, {
      rankBySignificance: true
    });
    
    // Assert
    // Check that correlations are sorted by p-value (ascending)
    for (let i = 1; i < rankedCorrelations.length; i++) {
      expect(rankedCorrelations[i-1].pValue).toBeLessThanOrEqual(
        rankedCorrelations[i].pValue
      );
    }
  });
});

// Helper function to create test virtual join
function createTestJoin(): VirtualJoin {
  const relationship: JoinRelationship = {
    sourceFile: 'klaviyo_metrics.csv',
    sourceColumn: 'customer_id',
    targetFile: 'reviews.csv',
    targetColumn: 'customer_id',
    confidence: 0.95,
    relationshipType: 'ONE_TO_MANY',
    sourceCardinality: 10000,
    targetCardinality: 50000
  };
  
  return new VirtualJoin(relationship);
}

// Helper function to create multi-file test join
function createMultiFileTestJoin(): VirtualJoin {
  // This would be a more complex join involving multiple files
  const relationships: JoinRelationship[] = [
    {
      sourceFile: 'customers.csv',
      sourceColumn: 'id',
      targetFile: 'klaviyo_metrics.csv',
      targetColumn: 'customer_id',
      confidence: 0.98,
      relationshipType: 'ONE_TO_MANY'
    },
    {
      sourceFile: 'customers.csv',
      sourceColumn: 'id',
      targetFile: 'reviews.csv',
      targetColumn: 'customer_id',
      confidence: 0.95,
      relationshipType: 'ONE_TO_MANY'
    },
    {
      sourceFile: 'customers.csv',
      sourceColumn: 'id',
      targetFile: 'support_tickets.csv',
      targetColumn: 'customer_id',
      confidence: 0.92,
      relationshipType: 'ONE_TO_MANY'
    }
  ];
  
  // For testing purposes, return a simple join
  // In real implementation, this would create a MultiJoin
  return new VirtualJoin(relationships[0]);
}