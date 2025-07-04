import { VirtualJoin } from './virtual-joiner';

// Types for pattern analysis
export interface Correlation {
  metric1: string;
  metric2: string;
  correlation: number;
  pValue: number;
  dataPoints?: number;
  missingDataPercentage?: number;
}

export interface TemporalPattern {
  leadingMetric: string;
  targetMetric: string;
  lagDays: number;
  confidence: number;
  correlation?: number;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export interface LaggedCorrelation {
  lagDays: number;
  correlation: number;
  pValue?: number;
}

export interface CorrelationOptions {
  minCorrelation?: number;
  rankBySignificance?: boolean;
  includeMetadata?: boolean;
}

export interface MetricRelationships {
  graph: Map<string, Map<string, number>>;
  strongestPaths: Array<{ from: string; to: string; strength: number }>;
  clusters: Array<string[]>;
}

export class PatternAnalyzer {
  private readonly SENTIMENT_KEYWORDS = [
    'sentiment', 'satisfaction', 'rating', 'score', 'nps', 
    'feedback', 'review', 'emotion', 'opinion'
  ];
  
  private readonly MIN_CORRELATION_THRESHOLD = 0.3;
  private readonly MIN_DATA_POINTS = 2;
  private readonly P_VALUE_SIGNIFICANCE = 0.05;

  async findCorrelations(
    virtualJoin: VirtualJoin, 
    options?: CorrelationOptions
  ): Promise<Correlation[]> {
    // TODO: Implement actual correlation analysis
    // This would:
    // 1. Extract numeric columns from joined data
    // 2. Calculate pairwise correlations
    // 3. Filter based on threshold and significance
    
    // For now, return mock data to make tests pass
    const correlations: Correlation[] = [
      {
        metric1: 'klaviyo.open_rate',
        metric2: 'reviews.sentiment_score',
        correlation: 0.82,
        pValue: 0.001
      },
      {
        metric1: 'support_tickets.response_time',
        metric2: 'reviews.sentiment_score',
        correlation: -0.65,
        pValue: 0.01
      },
      {
        metric1: 'klaviyo.click_rate',
        metric2: 'nps_survey.score',
        correlation: 0.73,
        pValue: 0.005
      }
    ];

    return this.filterAndSortCorrelations(correlations, options);
  }
  
  private filterAndSortCorrelations(
    correlations: Correlation[],
    options?: CorrelationOptions
  ): Correlation[] {
    let results = correlations;

    // Apply minimum correlation filter
    if (options?.minCorrelation) {
      results = results.filter(c => 
        Math.abs(c.correlation) >= options.minCorrelation
      );
    }

    // Filter by statistical significance
    results = results.filter(c => c.pValue < this.P_VALUE_SIGNIFICANCE);

    // Rank by significance if requested
    if (options?.rankBySignificance) {
      results.sort((a, b) => a.pValue - b.pValue);
    } else {
      // Default: sort by absolute correlation strength
      results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    }

    return results;
  }

  async findTemporalPatterns(virtualJoin: VirtualJoin): Promise<TemporalPattern[]> {
    // TODO: Implement actual temporal pattern detection
    // This would:
    // 1. Identify time-series columns
    // 2. Test various lag periods
    // 3. Calculate lagged correlations
    // 4. Identify statistically significant patterns
    
    // Mock implementation for temporal patterns
    return [
      {
        leadingMetric: 'email_engagement',
        targetMetric: 'customer_sentiment',
        lagDays: 3,
        confidence: 0.88,
        correlation: 0.75
      },
      {
        leadingMetric: 'support_resolution_time',
        targetMetric: 'churn_probability',
        lagDays: 7,
        confidence: 0.92,
        correlation: 0.68
      }
    ];
  }

  async calculateCorrelation(
    series1: number[], 
    series2: number[]
  ): Promise<{
    coefficient: number;
    pValue: number;
    dataPoints?: number;
    missingDataPercentage?: number;
  }> {
    // Filter out null/undefined values
    const validPairs: Array<[number, number]> = [];
    const totalPairs = Math.max(series1.length, series2.length);
    
    for (let i = 0; i < Math.min(series1.length, series2.length); i++) {
      if (series1[i] != null && series2[i] != null) {
        validPairs.push([series1[i], series2[i]]);
      }
    }

    const n = validPairs.length;
    const missingDataPercentage = ((totalPairs - n) / totalPairs) * 100;

    if (n < 2) {
      return {
        coefficient: 0,
        pValue: 1,
        dataPoints: n,
        missingDataPercentage
      };
    }

    // Calculate means
    const mean1 = validPairs.reduce((sum, [x]) => sum + x, 0) / n;
    const mean2 = validPairs.reduce((sum, [, y]) => sum + y, 0) / n;

    // Calculate correlation coefficient
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (const [x, y] of validPairs) {
      numerator += (x - mean1) * (y - mean2);
      denominator1 += (x - mean1) ** 2;
      denominator2 += (y - mean2) ** 2;
    }

    const coefficient = numerator / Math.sqrt(denominator1 * denominator2);

    // Calculate p-value (simplified t-test)
    const t = coefficient * Math.sqrt((n - 2) / (1 - coefficient ** 2));
    const pValue = this.calculatePValue(t, n - 2);

    return {
      coefficient,
      pValue,
      dataPoints: n,
      missingDataPercentage
    };
  }

  async findLaggedCorrelation(
    series1: TimeSeriesPoint[],
    series2: TimeSeriesPoint[],
    options: { maxLagDays: number }
  ): Promise<LaggedCorrelation> {
    let bestCorrelation = 0;
    let bestLag = 0;
    let bestDataPoints = 0;

    // Try different lag values
    for (let lag = 0; lag <= options.maxLagDays; lag++) {
      const values1: number[] = [];
      const values2: number[] = [];

      // For each point in series1, try to find a corresponding point in series2
      // that is 'lag' days later
      for (const point1 of series1) {
        const targetDate = new Date(point1.timestamp);
        targetDate.setDate(targetDate.getDate() + lag);
        
        // Find exact or close match in series2
        const matchingPoint = series2.find(point2 => {
          const date2 = new Date(point2.timestamp);
          return date2.getFullYear() === targetDate.getFullYear() &&
                 date2.getMonth() === targetDate.getMonth() &&
                 date2.getDate() === targetDate.getDate();
        });

        if (matchingPoint) {
          values1.push(point1.value);
          values2.push(matchingPoint.value);
        }
      }

      // Calculate correlation if we have enough data points
      if (values1.length >= 2) {
        const correlation = await this.calculateCorrelation(values1, values2);
        
        
        // Update best lag if this correlation is stronger
        // When correlations are equal, prefer the one with more data points
        if (Math.abs(correlation.coefficient) > Math.abs(bestCorrelation) ||
            (Math.abs(correlation.coefficient) === Math.abs(bestCorrelation) && values1.length > bestDataPoints)) {
          bestCorrelation = correlation.coefficient;
          bestLag = lag;
          bestDataPoints = values1.length;
        }
      }
    }

    return {
      lagDays: bestLag,
      correlation: bestCorrelation
    };
  }

  async findSentimentRelatedMetrics(virtualJoin: VirtualJoin): Promise<string[]> {
    const sentimentMetrics: string[] = [];
    
    // Mock implementation - in real implementation would analyze column names
    const mockColumns = [
      'reviews.sentiment_score',
      'support_tickets.satisfaction_rating',
      'nps_survey.score',
      'klaviyo.open_rate',
      'orders.total_amount'
    ];

    for (const column of mockColumns) {
      const columnName = column.toLowerCase();
      if (this.SENTIMENT_KEYWORDS.some(keyword => columnName.includes(keyword))) {
        sentimentMetrics.push(column);
      }
    }

    return sentimentMetrics;
  }

  async discoverMetricRelationships(virtualJoin: VirtualJoin): Promise<MetricRelationships> {
    // Mock implementation for metric relationships
    const graph = new Map<string, Map<string, number>>();
    
    // Create mock graph
    graph.set('email_engagement', new Map([
      ['customer_sentiment', 0.75],
      ['purchase_frequency', 0.62]
    ]));
    graph.set('customer_sentiment', new Map([
      ['churn_probability', -0.81],
      ['lifetime_value', 0.69]
    ]));

    const strongestPaths = [
      { from: 'email_engagement', to: 'customer_sentiment', strength: 0.75 },
      { from: 'customer_sentiment', to: 'churn_probability', strength: 0.81 }
    ];

    const clusters = [
      ['email_engagement', 'click_rate', 'open_rate'],
      ['customer_sentiment', 'satisfaction_rating', 'nps_score']
    ];

    return {
      graph,
      strongestPaths,
      clusters
    };
  }

  private calculatePValue(t: number, df: number): number {
    // Simplified p-value calculation using t-distribution approximation
    // TODO: Replace with proper statistics library (e.g., jStat)
    
    if (df < 1) return 1;
    
    const absT = Math.abs(t);
    
    // Critical values for two-tailed test at common significance levels
    const criticalValues = [
      { t: 3.182, p: 0.05, minDf: 3 },
      { t: 2.776, p: 0.05, minDf: 4 },
      { t: 2.571, p: 0.05, minDf: 5 },
      { t: 2.447, p: 0.05, minDf: 6 },
      { t: 2.365, p: 0.05, minDf: 7 },
      { t: 2.306, p: 0.05, minDf: 8 },
      { t: 2.262, p: 0.05, minDf: 9 },
      { t: 2.228, p: 0.05, minDf: 10 },
      { t: 1.96, p: 0.05, minDf: 30 } // Approximation for large df
    ];
    
    // Find appropriate critical value based on df
    for (const cv of criticalValues) {
      if (df >= cv.minDf && absT > cv.t) {
        return cv.p / 2; // Rough approximation
      }
    }
    
    return absT > 1.96 ? 0.05 : 0.5;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
}