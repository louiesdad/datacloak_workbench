import { DatabaseService } from './enhanced-database.service';
import { BusinessEventRegistry, BusinessEvent } from './business-event-registry.service';

interface SentimentStats {
  mean: number;
  stddev: number;
  count: number;
}

interface TTestResult {
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  confidence: number;
  warning?: string;
}

interface ImpactAnalysis {
  eventId: string;
  eventType?: string;
  sentimentBefore: number;
  sentimentAfter: number;
  impact: number;
  percentageChange: number;
  isSignificant: boolean;
  confidence: number;
  pValue: number;
  customersAffected?: number;
}

interface ImpactAnalysisWithControl extends ImpactAnalysis {
  affectedGroupImpact: number;
  controlGroupImpact: number;
  netImpact: number;
  controlGroupSize: number;
}

interface CalculateImpactOptions {
  daysBefore?: number;
  daysAfter?: number;
}

// Constants
const IMPACT_CONSTANTS = {
  DEFAULT_DAYS_BEFORE: 30,
  DEFAULT_DAYS_AFTER: 30,
  SIGNIFICANCE_LEVEL: 0.05,
  SMALL_SAMPLE_SIZE: 30,
  EFFECT_SIZE_THRESHOLDS: {
    NEGLIGIBLE: 0.2,
    SMALL: 0.5,
    MEDIUM: 0.8,
  },
} as const;

export class ImpactCalculator {

  constructor(
    private database: DatabaseService,
    private eventRegistry: BusinessEventRegistry
  ) {}

  async calculateEventImpact(
    eventId: string, 
    options: CalculateImpactOptions = {}
  ): Promise<ImpactAnalysis> {
    const daysBefore = options.daysBefore || IMPACT_CONSTANTS.DEFAULT_DAYS_BEFORE;
    const daysAfter = options.daysAfter || IMPACT_CONSTANTS.DEFAULT_DAYS_AFTER;

    // Get event details
    const events = await this.eventRegistry.getEventsByDateRange(
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
      new Date()
    );
    const event = events.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Get sentiment before event
    const beforeStats = await this.getSentimentStats(
      event.affectedCustomers,
      new Date(event.eventDate.getTime() - daysBefore * 24 * 60 * 60 * 1000),
      event.eventDate
    );

    // Get sentiment after event
    const afterStats = await this.getSentimentStats(
      event.affectedCustomers,
      event.eventDate,
      new Date(event.eventDate.getTime() + daysAfter * 24 * 60 * 60 * 1000)
    );

    // Calculate impact
    const impact = afterStats.mean - beforeStats.mean;
    const percentageChange = (impact / beforeStats.mean) * 100;

    // Perform statistical test
    const testResult = this.performTTest(beforeStats, afterStats);

    return {
      eventId,
      eventType: event.eventType,
      sentimentBefore: beforeStats.mean,
      sentimentAfter: afterStats.mean,
      impact,
      percentageChange,
      isSignificant: testResult.isSignificant,
      confidence: testResult.confidence,
      pValue: testResult.pValue,
      customersAffected: Array.isArray(event.affectedCustomers) 
        ? event.affectedCustomers.length 
        : beforeStats.count
    };
  }

  async calculateEventImpactWithControl(eventId: string): Promise<ImpactAnalysisWithControl> {
    // Get event details
    const events = await this.eventRegistry.getEventsByDateRange(
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      new Date()
    );
    const event = events.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Get control group
    const controlGroup = await this.identifyControlGroup(event);

    // Calculate impact for affected group
    const affectedImpact = await this.calculateEventImpact(eventId);

    // Calculate sentiment change for control group
    const controlBeforeStats = await this.getSentimentStats(
      controlGroup,
      new Date(event.eventDate.getTime() - IMPACT_CONSTANTS.DEFAULT_DAYS_BEFORE * 24 * 60 * 60 * 1000),
      event.eventDate
    );

    const controlAfterStats = await this.getSentimentStats(
      controlGroup,
      event.eventDate,
      new Date(event.eventDate.getTime() + IMPACT_CONSTANTS.DEFAULT_DAYS_AFTER * 24 * 60 * 60 * 1000)
    );

    const controlGroupImpact = controlAfterStats.mean - controlBeforeStats.mean;
    const netImpact = affectedImpact.impact - controlGroupImpact;

    return {
      ...affectedImpact,
      affectedGroupImpact: affectedImpact.impact,
      controlGroupImpact,
      netImpact,
      controlGroupSize: controlGroup.length
    };
  }

  async analyzeEventImpacts(startDate: Date, endDate: Date): Promise<ImpactAnalysis[]> {
    const events = await this.eventRegistry.getEventsByDateRange(startDate, endDate);
    const impacts: ImpactAnalysis[] = [];

    for (const event of events) {
      if (event.id) {
        try {
          const impact = await this.calculateEventImpact(event.id);
          impacts.push(impact);
        } catch (error) {
          console.error(`Failed to calculate impact for event ${event.id}:`, error);
        }
      }
    }

    return impacts;
  }

  rankEventsByImpact(impacts: Partial<ImpactAnalysis>[]): Partial<ImpactAnalysis>[] {
    return [...impacts].sort((a, b) => {
      const aImpact = Math.abs(a.impact || 0);
      const bImpact = Math.abs(b.impact || 0);
      return bImpact - aImpact;
    });
  }

  performTTest(beforeData: SentimentStats, afterData: SentimentStats): TTestResult {
    // Pooled standard deviation
    const pooledStdDev = Math.sqrt(
      ((beforeData.count - 1) * beforeData.stddev ** 2 + 
       (afterData.count - 1) * afterData.stddev ** 2) /
      (beforeData.count + afterData.count - 2)
    );

    // Standard error
    const standardError = pooledStdDev * Math.sqrt(
      1 / beforeData.count + 1 / afterData.count
    );

    // T-statistic
    const tStatistic = Math.abs(
      (beforeData.mean - afterData.mean) / standardError
    );

    // Degrees of freedom
    const df = beforeData.count + afterData.count - 2;

    // Approximate p-value using t-distribution
    // For simplicity, using critical values
    const criticalValue = this.getCriticalValue(df);
    const pValue = tStatistic > criticalValue ? 0.001 : 0.1;
    const isSignificant = pValue < IMPACT_CONSTANTS.SIGNIFICANCE_LEVEL;
    const confidence = 1 - pValue;

    const result: TTestResult = {
      tStatistic,
      pValue,
      isSignificant,
      confidence
    };

    // Add warning for small sample sizes
    if (beforeData.count < IMPACT_CONSTANTS.SMALL_SAMPLE_SIZE || 
        afterData.count < IMPACT_CONSTANTS.SMALL_SAMPLE_SIZE) {
      result.warning = 'Small sample size may affect reliability';
      result.confidence = Math.min(result.confidence, 0.9);
    }

    return result;
  }

  calculateEffectSize(beforeData: SentimentStats, afterData: SentimentStats): number {
    // Cohen's d
    const pooledStdDev = Math.sqrt(
      (beforeData.stddev ** 2 + afterData.stddev ** 2) / 2
    );
    
    return Math.abs(beforeData.mean - afterData.mean) / pooledStdDev;
  }

  interpretEffectSize(effectSize: number): string {
    const { NEGLIGIBLE, SMALL, MEDIUM } = IMPACT_CONSTANTS.EFFECT_SIZE_THRESHOLDS;
    
    if (effectSize < NEGLIGIBLE) return 'negligible';
    if (effectSize < SMALL) return 'small';
    if (effectSize < MEDIUM) return 'medium';
    return 'large';
  }

  async saveImpactAnalysis(analysis: ImpactAnalysis): Promise<{ id: string } & ImpactAnalysis> {
    const query = `
      INSERT INTO event_impacts (
        event_id, impact_percentage, customers_affected, 
        sentiment_before, sentiment_after, is_significant,
        confidence, p_value, calculated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id, event_id, impact_percentage, customers_affected, calculated_at
    `;

    const values = [
      analysis.eventId,
      analysis.impact,
      analysis.customersAffected || 0,
      analysis.sentimentBefore,
      analysis.sentimentAfter,
      analysis.isSignificant,
      analysis.confidence,
      analysis.pValue
    ];

    const result = await this.database.query(query, values);
    return { id: result.rows[0].id, ...analysis };
  }

  async getCachedImpact(eventId: string): Promise<ImpactAnalysis | null> {
    const query = `
      SELECT * FROM event_impacts 
      WHERE event_id = $1 
      ORDER BY calculated_at DESC 
      LIMIT 1
    `;

    const result = await this.database.query(query, [eventId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      eventId: row.event_id,
      sentimentBefore: row.sentiment_before,
      sentimentAfter: row.sentiment_after,
      impact: row.impact_percentage,
      percentageChange: (row.impact_percentage / row.sentiment_before) * 100,
      isSignificant: row.is_significant,
      confidence: row.confidence,
      pValue: row.p_value,
      customersAffected: row.customers_affected
    };
  }

  private async getSentimentStats(
    affectedCustomers: string[] | 'all',
    startDate: Date,
    endDate: Date
  ): Promise<SentimentStats> {
    let query: string;
    let params: any[];

    if (affectedCustomers === 'all') {
      query = `
        SELECT 
          AVG(sentiment_score) as avg_sentiment,
          COUNT(*) as count,
          STDDEV(sentiment_score) as stddev
        FROM sentiment_results
        WHERE created_at BETWEEN $1 AND $2
      `;
      params = [startDate, endDate];
    } else {
      query = `
        SELECT 
          AVG(sentiment_score) as avg_sentiment,
          COUNT(*) as count,
          STDDEV(sentiment_score) as stddev
        FROM sentiment_results
        WHERE customer_id = ANY($1)
        AND created_at BETWEEN $2 AND $3
      `;
      params = [affectedCustomers, startDate, endDate];
    }

    const result = await this.database.query(query, params);
    const row = result.rows[0];

    return {
      mean: parseFloat(row.avg_sentiment) || 0,
      stddev: parseFloat(row.stddev) || 0,
      count: parseInt(row.count) || 0
    };
  }

  private async identifyControlGroup(event: BusinessEvent): Promise<string[]> {
    if (event.affectedCustomers === 'all') {
      // Cannot have control group if all customers affected
      return [];
    }

    const affectedCustomers = event.affectedCustomers as string[];
    
    // Get similar customers not affected by the event
    const query = `
      SELECT DISTINCT customer_id 
      FROM sentiment_results
      WHERE customer_id NOT IN (${affectedCustomers.map((_, i) => `$${i + 1}`).join(',')})
      AND created_at > $${affectedCustomers.length + 1}
      LIMIT $${affectedCustomers.length + 2}
    `;

    const params = [
      ...affectedCustomers,
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      affectedCustomers.length // Same size as affected group
    ];

    const result = await this.database.query(query, params);
    return result.rows.map(row => row.customer_id);
  }

  private getCriticalValue(df: number): number {
    // Simplified critical values for two-tailed test at 0.05 significance
    if (df >= 120) return 1.96;
    if (df >= 60) return 2.0;
    if (df >= 30) return 2.04;
    if (df >= 20) return 2.09;
    if (df >= 10) return 2.23;
    return 2.31; // df < 10
  }
}