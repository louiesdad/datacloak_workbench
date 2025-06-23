export interface SentimentDataPoint {
  date: Date;
  sentiment: number;
  customerId: string;
}

export interface LinearTrendResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export interface PredictionResult {
  predicted: number;
  confidence: {
    lower: number;
    upper: number;
    level: number;
  };
}

export interface TrajectoryClassification {
  classification: 'declining' | 'stable' | 'improving' | 'volatile';
  severity: 'high' | 'medium' | 'low' | 'positive';
  volatility?: number;
}

export interface RiskAssessment {
  isHighRisk: boolean;
  predictedDropBelowThreshold: boolean;
  daysUntilThreshold: number;
  currentSentiment: number;
}

export interface BatchProcessingItem {
  customerId: string;
  history: SentimentDataPoint[];
}

export interface BatchProcessingResult {
  customerId: string;
  trajectory: TrajectoryClassification;
  trend?: LinearTrendResult;
  predictions?: PredictionResult[];
}

export class TrendCalculator {
  private readonly MIN_DATA_POINTS = 3;
  private readonly CONFIDENCE_LEVEL = 0.95;
  private readonly T_STATISTIC_95 = 2.776; // For small samples (df=5)

  calculateLinearTrend(data: SentimentDataPoint[]): LinearTrendResult | null {
    if (data.length < this.MIN_DATA_POINTS) {
      return null;
    }

    // Convert dates to numeric values (days from first date)
    const firstDate = data[0].date.getTime();
    const points = data.map(d => ({
      x: (d.date.getTime() - firstDate) / (1000 * 60 * 60 * 24), // Days
      y: d.sentiment
    }));

    // Calculate means
    const n = points.length;
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;
    for (const point of points) {
      numerator += (point.x - meanX) * (point.y - meanY);
      denominator += Math.pow(point.x - meanX, 2);
    }

    if (denominator === 0) {
      return null;
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared
    const yPredicted = points.map(p => slope * p.x + intercept);
    const ssRes = points.reduce((sum, p, i) => sum + Math.pow(p.y - yPredicted[i], 2), 0);
    const ssTot = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

    // Convert slope to per-week rate
    const slopePerWeek = slope * 7;

    return {
      slope: slopePerWeek,
      intercept,
      rSquared
    };
  }

  predictWithConfidence(data: SentimentDataPoint[], targetDate: Date): PredictionResult | null {
    const trend = this.calculateLinearTrend(data);
    if (!trend || data.length < this.MIN_DATA_POINTS) {
      return null;
    }

    // Calculate days from first data point
    const firstDate = data[0].date.getTime();
    const daysAhead = (targetDate.getTime() - firstDate) / (1000 * 60 * 60 * 24);

    // Make prediction
    const predicted = trend.intercept + (trend.slope / 7) * daysAhead;

    // Calculate standard error
    const points = data.map(d => ({
      x: (d.date.getTime() - firstDate) / (1000 * 60 * 60 * 24),
      y: d.sentiment
    }));

    const n = points.length;
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
    
    // Calculate residual standard error
    const yPredicted = points.map(p => trend.intercept + (trend.slope / 7) * p.x);
    const residuals = points.map((p, i) => p.y - yPredicted[i]);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    const mse = sse / (n - 2);
    const se = Math.sqrt(mse);

    // Calculate prediction interval
    const sumXDiffSquared = points.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0);
    const predictionSE = se * Math.sqrt(1 + 1/n + Math.pow(daysAhead - meanX, 2) / sumXDiffSquared);
    
    // Wider intervals for predictions further in the future
    const timeMultiplier = 1 + (daysAhead / 30); // Increase uncertainty over time more aggressively
    // For perfect linear data (se = 0), add a base uncertainty that increases with time
    const baseUncertainty = se === 0 ? 0.5 * timeMultiplier : 0;
    const margin = Math.max(1, this.T_STATISTIC_95 * predictionSE * timeMultiplier + baseUncertainty); // Ensure margin is at least 1

    return {
      predicted,
      confidence: {
        lower: predicted - margin,
        upper: predicted + margin,
        level: this.CONFIDENCE_LEVEL
      }
    };
  }

  classifyTrajectory(data: SentimentDataPoint[]): TrajectoryClassification {
    const trend = this.calculateLinearTrend(data);
    
    if (!trend) {
      return {
        classification: 'stable',
        severity: 'low'
      };
    }

    // Calculate volatility
    const sentiments = data.map(d => d.sentiment);
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    const stdDev = Math.sqrt(variance);
    const volatility = stdDev / mean;

    // High volatility threshold - lower threshold for better detection
    if (volatility > 0.4 || stdDev > 25) {
      return {
        classification: 'volatile',
        severity: 'medium',
        volatility
      };
    }

    // Classification based on slope
    const weeklyChange = Math.abs(trend.slope);
    
    if (trend.slope < -3 && trend.rSquared > 0.7) {
      return {
        classification: 'declining',
        severity: weeklyChange > 5 ? 'high' : 'medium',
        volatility
      };
    } else if (trend.slope > 3 && trend.rSquared > 0.7) {
      return {
        classification: 'improving',
        severity: 'positive',
        volatility
      };
    } else {
      return {
        classification: 'stable',
        severity: 'low',
        volatility
      };
    }
  }

  assessRisk(data: SentimentDataPoint[], threshold: number): RiskAssessment {
    const currentSentiment = data[data.length - 1].sentiment;
    const trend = this.calculateLinearTrend(data);
    
    if (!trend || trend.slope >= 0) {
      return {
        isHighRisk: false,
        predictedDropBelowThreshold: false,
        daysUntilThreshold: Infinity,
        currentSentiment
      };
    }

    // Calculate when sentiment will drop below threshold
    const daysUntilThreshold = (threshold - currentSentiment) / (trend.slope / 7);
    
    return {
      isHighRisk: currentSentiment < 50 && trend.slope < -2,
      predictedDropBelowThreshold: daysUntilThreshold > 0 && daysUntilThreshold < 30,
      daysUntilThreshold: Math.max(0, Math.floor(daysUntilThreshold)),
      currentSentiment
    };
  }

  async processBatch(batchData: BatchProcessingItem[]): Promise<BatchProcessingResult[]> {
    const results: BatchProcessingResult[] = [];

    for (const item of batchData) {
      const trajectory = this.classifyTrajectory(item.history);
      const trend = this.calculateLinearTrend(item.history);

      results.push({
        customerId: item.customerId,
        trajectory,
        trend: trend || undefined
      });
    }

    return results;
  }
}