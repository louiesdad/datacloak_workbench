import seedrandom from 'seedrandom';

export interface TrajectoryRecord {
  customer_id: string;
  week_number: number;
  sentiment_score: number;
  confidence: number;
  data_points: number;
  major_events: string[];
  pattern_type: 'linear_decline' | 'seasonal' | 'volatile_stable' | 'recovery' | 'cliff_drop';
  timestamp: string;
}

export interface TrajectoryDataset {
  metadata: {
    recordCount: number;
    uniqueCustomers: number;
    timePeriods: number;
    filename: string;
    seed: number;
    generatedAt: string;
  };
  headers: string[];
  records: TrajectoryRecord[];
}

export class TrajectoryPatternGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private baseDate = new Date('2024-06-23T00:00:00.000Z');
  private customerPatterns: Map<string, TrajectoryRecord['pattern_type']> = new Map();

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateHistoricalSentimentSeries(): TrajectoryDataset {
    const records: TrajectoryRecord[] = [];
    const uniqueCustomers = 1000;
    const timePeriods = 50;

    // Assign pattern types to customers according to spec
    const patternDistribution = {
      linear_decline: 200,
      seasonal: 300,
      volatile_stable: 200,
      recovery: 150,
      cliff_drop: 150
    };

    this.assignPatternTypes(uniqueCustomers, patternDistribution);

    // Generate records for each customer over time
    for (let customerId = 1; customerId <= uniqueCustomers; customerId++) {
      const customerIdStr = `CUST-${String(customerId).padStart(5, '0')}`;
      const pattern = this.customerPatterns.get(customerIdStr)!;

      for (let week = 1; week <= timePeriods; week++) {
        const record = this.generateTrajectoryRecord(customerIdStr, week, pattern);
        records.push(record);
      }
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueCustomers,
        timePeriods,
        filename: 'test_sentiment_history_50k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString()
      },
      headers: [
        'customer_id',
        'week_number',
        'sentiment_score',
        'confidence',
        'data_points',
        'major_events',
        'pattern_type',
        'timestamp'
      ],
      records
    };
  }

  generateFutureValidationSet(): TrajectoryDataset {
    const records: TrajectoryRecord[] = [];
    const uniqueCustomers = 200;
    const timePeriods = 50;

    // Reset customer patterns for this dataset
    this.customerPatterns.clear();
    
    // Assign pattern types
    const patternDistribution = {
      linear_decline: 40,
      seasonal: 60,
      volatile_stable: 40,
      recovery: 30,
      cliff_drop: 30
    };

    this.assignPatternTypes(uniqueCustomers, patternDistribution);

    // Generate records for each customer over time
    for (let customerId = 1; customerId <= uniqueCustomers; customerId++) {
      const customerIdStr = `CUST-${String(customerId).padStart(5, '0')}`;
      const pattern = this.customerPatterns.get(customerIdStr)!;

      for (let week = 1; week <= timePeriods; week++) {
        const record = this.generateTrajectoryRecord(customerIdStr, week, pattern);
        records.push(record);
      }
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueCustomers,
        timePeriods,
        filename: 'test_future_outcomes_10k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString()
      },
      headers: [
        'customer_id',
        'week_number',
        'sentiment_score',
        'confidence',
        'data_points',
        'major_events',
        'pattern_type',
        'timestamp'
      ],
      records
    };
  }

  private assignPatternTypes(
    customerCount: number,
    distribution: Record<string, number>
  ): void {
    let currentIndex = 1;
    
    for (const [pattern, count] of Object.entries(distribution)) {
      for (let i = 0; i < count && currentIndex <= customerCount; i++) {
        const customerId = `CUST-${String(currentIndex).padStart(5, '0')}`;
        this.customerPatterns.set(customerId, pattern as TrajectoryRecord['pattern_type']);
        currentIndex++;
      }
    }
  }

  private generateTrajectoryRecord(
    customerId: string,
    week: number,
    pattern: TrajectoryRecord['pattern_type']
  ): TrajectoryRecord {
    const weekDate = new Date(this.baseDate);
    weekDate.setDate(weekDate.getDate() - (50 - week) * 7); // Go back in time

    let sentiment: number;
    
    switch (pattern) {
      case 'linear_decline':
        sentiment = this.generateLinearDecline(week);
        break;
      case 'seasonal':
        sentiment = this.generateSeasonal(week);
        break;
      case 'volatile_stable':
        sentiment = this.generateVolatileStable(week);
        break;
      case 'recovery':
        sentiment = this.generateRecovery(week);
        break;
      case 'cliff_drop':
        sentiment = this.generateCliffDrop(week);
        break;
      default:
        sentiment = 50 + (this.rng() - 0.5) * 20;
    }

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      confidence: 0.5 + this.rng() * 0.5, // Between 0.5 and 1.0
      data_points: Math.floor(this.rng() * 45) + 5, // Between 5 and 50
      major_events: this.generateMajorEvents(week),
      pattern_type: pattern,
      timestamp: weekDate.toISOString()
    };
  }

  private generateLinearDecline(week: number): number {
    // Steady decrease of 1-2% per week
    const startSentiment = 75 + this.rng() * 15; // Start 75-90%
    const declineRate = 1 + this.rng() * 1; // 1-2% per week
    const decline = week * declineRate;
    const noise = (this.rng() - 0.5) * 5;
    
    return startSentiment - decline + noise;
  }

  private generateSeasonal(week: number): number {
    // Holiday shopping peaks, summer slowdowns, back-to-school bumps
    const baseSentiment = 65 + this.rng() * 10;
    
    // Create seasonal patterns (peaks around weeks 12, 24, 36, 48)
    const seasonalEffect = 
      10 * Math.sin((week / 50) * 2 * Math.PI * 4) + // Main seasonal cycle
      5 * Math.sin((week / 50) * 2 * Math.PI * 2) +  // Secondary cycle
      (this.rng() - 0.5) * 8; // Noise
    
    return baseSentiment + seasonalEffect;
  }

  private generateVolatileStable(week: number): number {
    // High week-to-week variance but stable long-term average
    const baseSentiment = 60 + this.rng() * 20;
    const volatility = (this.rng() - 0.5) * 25; // High volatility
    
    return baseSentiment + volatility;
  }

  private generateRecovery(week: number): number {
    // Decline, then intervention, then improvement
    const interventionWeek = 15 + this.rng() * 10; // Intervention between weeks 15-25
    
    if (week < interventionWeek) {
      // Decline phase
      const startSentiment = 70 + this.rng() * 10;
      const decline = week * 1.5;
      return startSentiment - decline + (this.rng() - 0.5) * 5;
    } else {
      // Recovery phase with different speeds
      const lowestPoint = 35 + this.rng() * 10;
      const recoveryWeeks = week - interventionWeek;
      const recoveryRate = 1.5 + this.rng() * 1; // Variable recovery speed
      const recovery = recoveryWeeks * recoveryRate;
      
      return Math.min(75, lowestPoint + recovery) + (this.rng() - 0.5) * 5;
    }
  }

  private generateCliffDrop(week: number): number {
    // Stable then sudden catastrophic drop
    const dropWeek = 20 + this.rng() * 15; // Drop between weeks 20-35
    
    if (week < dropWeek) {
      // Stable phase
      return 70 + (this.rng() - 0.5) * 10;
    } else {
      // Post-drop phase - very low with slow recovery
      const weeksSinceDrop = week - dropWeek;
      const baseDropSentiment = 15 + this.rng() * 10;
      const slowRecovery = weeksSinceDrop * 0.5; // Very slow recovery
      
      return Math.min(40, baseDropSentiment + slowRecovery) + (this.rng() - 0.5) * 5;
    }
  }

  private generateMajorEvents(week: number): string[] {
    const events: string[] = [];
    
    // Random chance of events occurring
    if (this.rng() < 0.05) { // 5% chance per week
      const eventTypes = ['product_launch', 'outage', 'holiday', 'promotion'];
      const eventType = eventTypes[Math.floor(this.rng() * eventTypes.length)];
      events.push(eventType);
    }
    
    // Specific scheduled events
    if (week === 12 || week === 24 || week === 36 || week === 48) {
      if (this.rng() < 0.3) { // 30% chance of holiday events
        events.push('holiday');
      }
    }
    
    return events;
  }
}