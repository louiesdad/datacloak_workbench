export interface TimeSeriesPoint {
  date?: string;
  timestamp?: Date;
  value: number;
}

export interface LaggedCorrelationOptions {
  maxLagDays: number;
  minCorrelation?: number;
}

export interface LaggedCorrelationResult {
  lagDays: number;
  coefficient: number;
  pValue?: number;
}

export class TemporalAnalyzer {
  async findLaggedCorrelation(
    series1: TimeSeriesPoint[],
    series2: TimeSeriesPoint[],
    options: LaggedCorrelationOptions
  ): Promise<LaggedCorrelationResult | null> {
    const { maxLagDays, minCorrelation = 0.5 } = options;
    
    // Normalize dates to Date objects
    const normalizedSeries1 = this.normalizeDates(series1);
    const normalizedSeries2 = this.normalizeDates(series2);
    
    let bestCorrelation: LaggedCorrelationResult | null = null;
    
    // Try different lag values
    for (let lagDays = 0; lagDays <= maxLagDays; lagDays++) {
      const correlation = this.calculateLaggedCorrelation(
        normalizedSeries1, 
        normalizedSeries2, 
        lagDays
      );
      
      if (correlation !== null && 
          Math.abs(correlation.coefficient) >= minCorrelation &&
          (bestCorrelation === null || 
           Math.abs(correlation.coefficient) > Math.abs(bestCorrelation.coefficient))) {
        bestCorrelation = correlation;
      }
    }
    
    return bestCorrelation;
  }
  
  private normalizeDates(series: TimeSeriesPoint[]): Array<{ date: Date, value: number }> {
    return series.map(point => ({
      date: point.timestamp || new Date(point.date!),
      value: point.value
    }));
  }
  
  private calculateLaggedCorrelation(
    series1: Array<{ date: Date, value: number }>,
    series2: Array<{ date: Date, value: number }>,
    lagDays: number
  ): LaggedCorrelationResult | null {
    // Create lagged version of series1 (shift series1 forward by lagDays)
    const laggedSeries1 = series1.map(point => ({
      date: new Date(point.date.getTime() + (lagDays * 24 * 60 * 60 * 1000)),
      value: point.value
    }));
    
    // Find overlapping data points between lagged series1 and series2
    const alignedPairs: Array<{ value1: number, value2: number }> = [];
    
    for (const point1 of laggedSeries1) {
      const matchingPoint = series2.find(point2 => 
        Math.abs(point1.date.getTime() - point2.date.getTime()) < 24 * 60 * 60 * 1000 // Within 1 day
      );
      
      if (matchingPoint) {
        alignedPairs.push({
          value1: point1.value,
          value2: matchingPoint.value
        });
      }
    }
    
    if (alignedPairs.length < 2) {
      return null;
    }
    
    // Calculate Pearson correlation coefficient
    const coefficient = this.calculatePearsonCorrelation(
      alignedPairs.map(p => p.value1),
      alignedPairs.map(p => p.value2)
    );
    
    return {
      lagDays,
      coefficient,
      pValue: this.calculatePValue(coefficient, alignedPairs.length)
    };
  }
  
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  private calculatePValue(correlation: number, sampleSize: number): number {
    // Simplified p-value calculation (for production, use proper statistical libraries)
    const t = Math.abs(correlation) * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    
    // Rough approximation - in production use proper t-distribution
    if (t > 2.0) return 0.01;
    if (t > 1.5) return 0.05;
    return 0.1;
  }
}