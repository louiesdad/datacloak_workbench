import seedrandom from 'seedrandom';

export interface CausalEventRecord {
  event_id: string;
  customer_id: string;
  event_type: 'price_change' | 'service_outage' | 'feature_launch' | 'support_quality';
  event_date: string;
  affected: boolean;
  pre_sentiment: number;
  post_sentiment: number;
  confounding_factors: Record<string, any>;
  timestamp: string;
}

export interface ComplexCausalRecord extends CausalEventRecord {
  time_delay_weeks: number;
  interaction_effects: string[];
  causal_chain_id: string;
}

export interface CausalEventDataset {
  metadata: {
    recordCount: number;
    uniqueCustomers: number;
    timeRange: string;
    filename: string;
    seed: number;
    generatedAt: string;
  };
  headers: string[];
  records: CausalEventRecord[];
}

export interface ComplexCausalDataset {
  metadata: {
    recordCount: number;
    uniqueCustomers: number;
    timePeriods: number;
    filename: string;
    seed: number;
    generatedAt: string;
  };
  headers: string[];
  records: ComplexCausalRecord[];
}

export class CausalEventGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private baseDate = new Date('2024-06-23T00:00:00.000Z');

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateEventImpactData(): CausalEventDataset {
    const records: CausalEventRecord[] = [];
    const uniqueCustomers = 2000;
    const totalRecords = 30000;

    // Event distribution based on spec
    const eventDistribution = {
      price_change: 0.35,   // 35% of events
      service_outage: 0.25, // 25% of events
      feature_launch: 0.25, // 25% of events
      support_quality: 0.15 // 15% of events
    };

    let eventIdCounter = 1;

    // Generate events
    for (let i = 0; i < totalRecords; i++) {
      const customerId = `CUST-${String(Math.floor(this.rng() * uniqueCustomers) + 1).padStart(5, '0')}`;
      const eventType = this.selectEventType(eventDistribution);
      const record = this.generateEventRecord(eventIdCounter++, customerId, eventType);
      records.push(record);
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueCustomers,
        timeRange: '12 months',
        filename: 'test_causal_events_30k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString()
      },
      headers: [
        'event_id',
        'customer_id',
        'event_type',
        'event_date',
        'affected',
        'pre_sentiment',
        'post_sentiment',
        'confounding_factors',
        'timestamp'
      ],
      records
    };
  }

  generateComplexCausalChains(): ComplexCausalDataset {
    const records: ComplexCausalRecord[] = [];
    const uniqueCustomers = 500;
    const timePeriods = 30;
    const totalRecords = 15000;

    let eventIdCounter = 1;
    let chainIdCounter = 1;

    // Generate complex causal scenarios
    for (let i = 0; i < totalRecords; i++) {
      const customerId = `CUST-${String(Math.floor(this.rng() * uniqueCustomers) + 1).padStart(5, '0')}`;
      const eventType = this.selectEventType({
        price_change: 0.3,
        service_outage: 0.3,
        feature_launch: 0.25,
        support_quality: 0.15
      });
      
      const record = this.generateComplexEventRecord(
        eventIdCounter++, 
        customerId, 
        eventType, 
        chainIdCounter
      );
      
      records.push(record);
      
      // Sometimes start new chain
      if (this.rng() < 0.1) {
        chainIdCounter++;
      }
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueCustomers,
        timePeriods,
        filename: 'test_causal_complex_15k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString()
      },
      headers: [
        'event_id',
        'customer_id',
        'event_type',
        'event_date',
        'affected',
        'pre_sentiment',
        'post_sentiment',
        'confounding_factors',
        'time_delay_weeks',
        'interaction_effects',
        'causal_chain_id',
        'timestamp'
      ],
      records
    };
  }

  private selectEventType(distribution: Record<string, number>): CausalEventRecord['event_type'] {
    const rand = this.rng();
    let cumulative = 0;
    
    for (const [eventType, probability] of Object.entries(distribution)) {
      cumulative += probability;
      if (rand <= cumulative) {
        return eventType as CausalEventRecord['event_type'];
      }
    }
    
    return 'price_change'; // Fallback
  }

  private generateEventRecord(
    eventId: number,
    customerId: string,
    eventType: CausalEventRecord['event_type']
  ): CausalEventRecord {
    const eventDate = this.generateEventDate();
    const affected = this.determineAffected(eventType);
    const { preSentiment, postSentiment } = this.generateSentimentImpact(eventType, affected);
    
    return {
      event_id: `EVENT-${String(eventId).padStart(6, '0')}`,
      customer_id: customerId,
      event_type: eventType,
      event_date: eventDate.toISOString(),
      affected,
      pre_sentiment: preSentiment,
      post_sentiment: postSentiment,
      confounding_factors: this.generateConfoundingFactors(),
      timestamp: eventDate.toISOString()
    };
  }

  private generateComplexEventRecord(
    eventId: number,
    customerId: string,
    eventType: CausalEventRecord['event_type'],
    chainId: number
  ): ComplexCausalRecord {
    const baseRecord = this.generateEventRecord(eventId, customerId, eventType);
    
    return {
      ...baseRecord,
      time_delay_weeks: Math.floor(this.rng() * 5), // 0-4 weeks delay
      interaction_effects: this.generateInteractionEffects(),
      causal_chain_id: `CHAIN-${String(chainId).padStart(4, '0')}`
    };
  }

  private generateEventDate(): Date {
    const eventDate = new Date(this.baseDate);
    const daysAgo = Math.floor(this.rng() * 365); // Random day in past year
    eventDate.setDate(eventDate.getDate() - daysAgo);
    return eventDate;
  }

  private determineAffected(eventType: CausalEventRecord['event_type']): boolean {
    switch (eventType) {
      case 'price_change':
        return this.rng() < 0.5; // 50% affected (treatment group)
      case 'service_outage':
        return this.rng() < 0.15; // 15% affected (regional)
      case 'feature_launch':
        return this.rng() < 0.5; // 50% got the feature
      case 'support_quality':
        return this.rng() < 0.1; // 10% got new support team
      default:
        return this.rng() < 0.5;
    }
  }

  private generateSentimentImpact(
    eventType: CausalEventRecord['event_type'],
    affected: boolean
  ): { preSentiment: number; postSentiment: number } {
    const baseSentiment = 60 + this.rng() * 30; // Base 60-90%
    
    if (!affected) {
      // Control group - minimal change
      const change = (this.rng() - 0.5) * 4; // ±2% random variation
      return {
        preSentiment: Math.round(baseSentiment),
        postSentiment: Math.round(Math.max(0, Math.min(100, baseSentiment + change)))
      };
    }

    // Affected group - specific impacts by event type
    let impactRange: [number, number];
    
    switch (eventType) {
      case 'price_change':
        impactRange = [-15, -5]; // Price increases decrease sentiment
        break;
      case 'service_outage':
        impactRange = [-25, -10]; // Outages significantly decrease sentiment
        break;
      case 'feature_launch':
        impactRange = [-5, 15]; // Features can help or hurt
        break;
      case 'support_quality':
        impactRange = [-10, 10]; // Support changes vary in impact
        break;
      default:
        impactRange = [-10, 10];
    }

    const impact = impactRange[0] + this.rng() * (impactRange[1] - impactRange[0]);
    const postSentiment = Math.max(0, Math.min(100, baseSentiment + impact));

    return {
      preSentiment: Math.round(baseSentiment),
      postSentiment: Math.round(postSentiment)
    };
  }

  private generateConfoundingFactors(): Record<string, any> {
    const factors: Record<string, any> = {};
    
    // Randomly add confounding factors
    if (this.rng() < 0.3) {
      factors.seasonal = this.rng() < 0.5 ? 'holiday_season' : 'regular_season';
    }
    
    if (this.rng() < 0.2) {
      factors.competitor_action = this.rng() < 0.5 ? 'price_cut' : 'new_product';
    }
    
    if (this.rng() < 0.25) {
      factors.market_trend = this.rng() < 0.5 ? 'economic_downturn' : 'market_growth';
    }
    
    if (this.rng() < 0.15) {
      factors.customer_segment = ['enterprise', 'smb', 'individual'][Math.floor(this.rng() * 3)];
    }
    
    return factors;
  }

  private generateInteractionEffects(): string[] {
    const effects: string[] = [];
    
    if (this.rng() < 0.3) {
      effects.push('compounding_negative');
    }
    
    if (this.rng() < 0.2) {
      effects.push('offsetting_positive');
    }
    
    if (this.rng() < 0.15) {
      effects.push('amplifying_effect');
    }
    
    return effects;
  }
}