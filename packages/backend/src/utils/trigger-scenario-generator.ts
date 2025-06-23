import seedrandom from 'seedrandom';

export interface TriggerScenarioRecord {
  customer_id: string;
  week_number: number;
  sentiment_score: number;
  order_value: number;
  order_frequency: number;
  support_tickets: number;
  scenario_type: 'sentiment_decline' | 'sudden_drop' | 'high_value_at_risk' | 'false_positive' | 'positive_trigger' | 'normal';
  timestamp: string;
}

export interface TriggerScenarioDataset {
  metadata: {
    recordCount: number;
    uniqueCustomers: number;
    timePeriods: number;
    filename: string;
    seed: number;
    generatedAt: string;
  };
  headers: string[];
  records: TriggerScenarioRecord[];
}

export class TriggerScenarioGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private baseDate = new Date('2024-06-23T00:00:00.000Z');
  private customerDropWeeks: Map<string, number> = new Map();

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateTriggerScenarios(): TriggerScenarioDataset {
    const records: TriggerScenarioRecord[] = [];
    const uniqueCustomers = 1000;
    const timePeriods = 20;

    // Assign scenario types to customers
    const customerScenarios = this.assignScenarioTypes(uniqueCustomers);

    // Generate records for each customer over time
    for (let customerId = 1; customerId <= uniqueCustomers; customerId++) {
      const customerIdStr = `CUST-${String(customerId).padStart(5, '0')}`;
      const scenario = customerScenarios.get(customerIdStr)!;

      for (let week = 1; week <= timePeriods; week++) {
        const record = this.generateScenarioRecord(customerIdStr, week, scenario);
        records.push(record);
      }
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueCustomers,
        timePeriods,
        filename: 'test_trigger_scenarios_20k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString()
      },
      headers: [
        'customer_id',
        'week_number',
        'sentiment_score',
        'order_value',
        'order_frequency',
        'support_tickets',
        'scenario_type',
        'timestamp'
      ],
      records
    };
  }

  private assignScenarioTypes(customerCount: number): Map<string, TriggerScenarioRecord['scenario_type']> {
    const scenarios = new Map<string, TriggerScenarioRecord['scenario_type']>();
    
    // Distribute scenarios according to spec
    const distribution = {
      sentiment_decline: 200,
      sudden_drop: 100,
      high_value_at_risk: 50,
      false_positive: 150,
      positive_trigger: 200,
      normal: 300
    };

    let currentIndex = 1;
    
    for (const [scenario, count] of Object.entries(distribution)) {
      for (let i = 0; i < count && currentIndex <= customerCount; i++) {
        const customerId = `CUST-${String(currentIndex).padStart(5, '0')}`;
        scenarios.set(customerId, scenario as TriggerScenarioRecord['scenario_type']);
        currentIndex++;
      }
    }

    return scenarios;
  }

  private generateScenarioRecord(
    customerId: string,
    week: number,
    scenarioType: TriggerScenarioRecord['scenario_type']
  ): TriggerScenarioRecord {
    const weekDate = new Date(this.baseDate);
    weekDate.setDate(weekDate.getDate() - (20 - week) * 7); // Go back in time

    switch (scenarioType) {
      case 'sentiment_decline':
        return this.generateSentimentDecline(customerId, week, weekDate);
      case 'sudden_drop':
        return this.generateSuddenDrop(customerId, week, weekDate);
      case 'high_value_at_risk':
        return this.generateHighValueAtRisk(customerId, week, weekDate);
      case 'false_positive':
        return this.generateFalsePositive(customerId, week, weekDate);
      case 'positive_trigger':
        return this.generatePositiveTrigger(customerId, week, weekDate);
      default:
        return this.generateNormal(customerId, week, weekDate);
    }
  }

  private generateSentimentDecline(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // Start high (80%+), gradual decline to <30% over 8+ weeks
    const startSentiment = 85 + this.rng() * 10;
    const endSentiment = 15 + this.rng() * 10; // Lower end sentiment to ensure < 30
    
    let sentiment: number;
    if (week <= 8) {
      // Stable high sentiment
      sentiment = startSentiment + (this.rng() - 0.5) * 5;
    } else {
      // Gradual decline - ensure it reaches low sentiment by week 20
      const progress = Math.min(1, (week - 8) / 8); // Faster decline
      sentiment = startSentiment - (startSentiment - endSentiment) * progress;
      sentiment += (this.rng() - 0.5) * 3; // Less noise
    }

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: this.generateOrderValue(true),
      order_frequency: Math.max(0, 5 - Math.floor(week / 5)), // Decreasing frequency
      support_tickets: week > 10 ? Math.floor(this.rng() * 3) : 0,
      scenario_type: 'sentiment_decline',
      timestamp: date.toISOString()
    };
  }

  private generateSuddenDrop(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // Get or set drop week for this customer
    if (!this.customerDropWeeks.has(customerId)) {
      this.customerDropWeeks.set(customerId, 8 + Math.floor(this.rng() * 4)); // Drop between week 8-11
    }
    const dropWeek = this.customerDropWeeks.get(customerId)!;
    
    let sentiment: number;
    if (week < dropWeek) {
      sentiment = 68 + this.rng() * 7; // Stable 68-75%
    } else if (week === dropWeek) {
      sentiment = 18 + this.rng() * 5; // Drop to 18-23% (ensuring 45+ point drop)
    } else {
      // Some recovery attempts but stay low
      const weeksSinceDrop = week - dropWeek;
      sentiment = 20 + Math.min(15, weeksSinceDrop * 3) + (this.rng() - 0.5) * 5;
    }

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: this.generateOrderValue(true),
      order_frequency: week < dropWeek ? 4 : 1,
      support_tickets: week >= dropWeek ? 1 + Math.floor(this.rng() * 2) : 0,
      scenario_type: 'sudden_drop',
      timestamp: date.toISOString()
    };
  }

  private generateHighValueAtRisk(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // High order values, declining sentiment and frequency
    const sentiment = 75 - week * 2.5 + (this.rng() - 0.5) * 10;
    
    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: 1000 + this.rng() * 4000, // High value orders
      order_frequency: Math.max(1, 6 - Math.floor(week / 4)),
      support_tickets: week > 10 ? Math.floor(this.rng() * 4) : 0,
      scenario_type: 'high_value_at_risk',
      timestamp: date.toISOString()
    };
  }

  private generateFalsePositive(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // Temporary dips that recover
    const dipWeek = 5 + Math.floor(this.rng() * 10);
    const isDipPeriod = week >= dipWeek && week <= dipWeek + 2;
    
    const baseSentiment = 75 + (this.rng() - 0.5) * 10;
    const sentiment = isDipPeriod ? baseSentiment - 30 : baseSentiment;

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: this.generateOrderValue(false),
      order_frequency: 3 + Math.floor(this.rng() * 2),
      support_tickets: isDipPeriod ? 1 : 0,
      scenario_type: 'false_positive',
      timestamp: date.toISOString()
    };
  }

  private generatePositiveTrigger(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // Jump to 90%+ sentiment
    const jumpWeek = 10 + Math.floor(this.rng() * 5);
    
    let sentiment: number;
    if (week < jumpWeek) {
      sentiment = 60 + (this.rng() - 0.5) * 20;
    } else {
      sentiment = 90 + this.rng() * 10;
    }

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: week >= jumpWeek ? this.generateOrderValue(true) * 1.5 : this.generateOrderValue(false),
      order_frequency: week >= jumpWeek ? 5 : 3,
      support_tickets: 0,
      scenario_type: 'positive_trigger',
      timestamp: date.toISOString()
    };
  }

  private generateNormal(customerId: string, week: number, date: Date): TriggerScenarioRecord {
    // Stable patterns with normal variation
    const sentiment = 65 + Math.sin(week / 3) * 10 + (this.rng() - 0.5) * 15;

    return {
      customer_id: customerId,
      week_number: week,
      sentiment_score: Math.max(0, Math.min(100, Math.round(sentiment))),
      order_value: this.generateOrderValue(false),
      order_frequency: 2 + Math.floor(this.rng() * 3),
      support_tickets: this.rng() > 0.9 ? 1 : 0,
      scenario_type: 'normal',
      timestamp: date.toISOString()
    };
  }

  private generateOrderValue(isHighValue: boolean): number {
    if (isHighValue) {
      return Math.round((500 + this.rng() * 1500) * 100) / 100;
    }
    return Math.round((50 + this.rng() * 450) * 100) / 100;
  }
}