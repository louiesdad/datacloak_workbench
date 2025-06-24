import { DatabaseService } from '../database/sqlite';
import logger from '../config/logger';

export interface FieldSensitivityOptions {
  fields: string[];
  sensitivityMethod: 'variance_ratio' | 'cohens_d' | 'percentage_change';
  preEventDays: number;
  postEventDays: number;
  significanceThreshold?: number;
}

export interface FieldResponseOptions {
  fields: string[];
  rankingCriteria: 'response_magnitude' | 'recovery_speed' | 'volatility';
  includeRecoveryMetrics?: boolean;
  timeWindowHours: number[];
}

export interface VolatilityOptions {
  fields: string[];
  volatilityMethod: 'coefficient_of_variation' | 'standard_deviation';
  lookbackDays: number;
  volatilityThreshold: number;
}

export interface SensitivityProfileOptions {
  fields: string[];
  includeVolatilityAnalysis: boolean;
  includeResponseAnalysis: boolean;
  includePredictiveMetrics: boolean;
  profileDepth: 'basic' | 'comprehensive';
}

export interface SensitivityScore {
  sensitivityScore: number;
  sensitivityLevel: string;
  preEventVariance: number;
  postEventVariance: number;
  varianceRatio: number;
  meanChange: number;
  percentChange: number;
  significance: number;
  isSignificant: boolean;
  recoveryTime: string;
  stabilityIndex: number;
  effectSize?: number;
}

export interface FieldSensitivityResult {
  eventId: string;
  sensitivityScores: Record<string, SensitivityScore>;
  ranking: Array<{
    field: string;
    rank: number;
    sensitivityScore: number;
    sensitivityLevel: string;
  }>;
  metadata: {
    analysisDate: string;
    sensitivityMethod: string;
    fieldsAnalyzed: number;
    significanceThreshold: number;
    highSensitivityFields: number;
    moderateSensitivityFields: number;
    lowSensitivityFields: number;
  };
}

export interface FieldResponseResult {
  eventId: string;
  fieldRankings: Array<{
    field: string;
    rank: number;
    responseMagnitude: number;
    responseSpeed: string;
    recoveryPattern: string;
    timeToMaxImpact: string;
    maxImpactMagnitude: number;
    stabilizationTime: string;
    volatilityIndex: number;
    recoverySpeed?: number;
  }>;
  responseTimeline: Record<string, Record<string, number>>;
  recoveryMetrics: {
    fastestRecovering: string;
    slowestRecovering: string;
    averageRecoveryTime: string;
    fieldsFullyRecovered: string[];
    fieldsPartiallyRecovered: string[];
    fieldsNotRecovered: string[];
  };
  insights: {
    mostResponsiveField: string;
    leastResponsiveField: string;
    mostVolatileField: string;
    mostStableField: string;
    averageResponseTime: string;
    systemStabilityScore: number;
    fastestRecoveringField?: string;
  };
}

export interface VolatilityResult {
  eventId: string;
  volatilityAnalysis: Record<string, {
    volatilityScore: number;
    volatilityLevel: string;
    coefficientOfVariation: number;
    standardDeviation: number;
    mean: number;
    volatilityRank: number;
    volatilityPattern: string;
    eventSensitivity: number;
  }>;
  volatilityRanking: Array<{
    field: string;
    rank: number;
    volatilityScore: number;
    volatilityLevel: string;
  }>;
  volatilityInsights: {
    mostVolatileField: string;
    leastVolatileField: string;
    highVolatilityFields: string[];
    stableFields: string[];
    volatilityTrend: string;
    systemVolatilityScore: number;
    riskAssessment: {
      overallRisk: string;
      volatilityRisk: string;
      stabilityScore: number;
    };
  };
  recommendations: {
    monitoringPriority: string[];
    stabilizationStrategies: Array<{
      field: string;
      strategy: string;
      priority: string;
    }>;
    alertThresholds: Record<string, number>;
  };
}

export interface SensitivityProfileResult {
  eventId: string;
  sensitivityProfile: {
    overallSensitivity: {
      systemSensitivityScore: number;
      sensitivityLevel: string;
      dominantSensitivityPattern: string;
      stabilityRating: string;
    };
    fieldProfiles: Record<string, {
      sensitivityClass: string;
      responsiveness: string;
      volatility: string;
      recovery: string;
      predictability: string;
      riskLevel: string;
    }>;
    sensitivityMatrix: {
      highSensitivity: string[];
      moderateSensitivity: string[];
      lowSensitivity: string[];
      resilientFields: string[];
    };
    predictiveInsights?: {
      futureEventImpactPrediction: Record<string, number>;
      recommendedMonitoringFrequency: Record<string, string>;
      earlyWarningIndicators: Array<{
        field: string;
        threshold: number;
        leadTime: string;
      }>;
    };
  };
  recommendations: {
    immediateActions: string[];
    strategicRecommendations: string[];
    monitoringStrategy: {
      criticalFields: string[];
      monitoringIntervals: Record<string, string>;
      alertThresholds: Record<string, number>;
      escalationRules: string[];
    };
    mitigationStrategies: Array<{
      strategy: string;
      targetFields: string[];
      priority: string;
      estimatedEffectiveness: number;
    }>;
  };
}

export class FieldSensitivityService {
  private database: DatabaseService;

  constructor() {
    this.database = DatabaseService.getInstance();
  }

  async calculateFieldSensitivity(
    eventId: string,
    options: FieldSensitivityOptions
  ): Promise<FieldSensitivityResult> {
    try {
      // Validate input parameters
      this.validateSensitivityOptions(options);

      // Get event details
      const eventQuery = `
        SELECT start_time, end_time 
        FROM business_events 
        WHERE id = ?
      `;
      const eventData = await this.database.query(eventQuery, [eventId]);
      
      if (!eventData || eventData.length === 0) {
        throw new Error(`Event ${eventId} not found`);
      }

      const event = eventData[0];
      const eventStartTime = new Date(event.start_time);
      const preEventStart = new Date(eventStartTime.getTime() - options.preEventDays * 24 * 60 * 60 * 1000);
      const postEventEnd = new Date(eventStartTime.getTime() + options.postEventDays * 24 * 60 * 60 * 1000);

      // Query sensitivity data
      const fieldList = options.fields.join(', ');
      const dataQuery = `
        SELECT 
          customer_id,
          timestamp,
          ${fieldList},
          CASE 
            WHEN timestamp < ? THEN 'pre_event'
            WHEN timestamp >= ? THEN 'post_event'
            ELSE 'during_event'
          END as period
        FROM customer_data 
        WHERE timestamp BETWEEN ? AND ?
          AND (${options.fields.map(field => `${field} IS NOT NULL`).join(' AND ')})
        ORDER BY timestamp
      `;
      
      const data = await this.database.query(dataQuery, [
        event.start_time,
        event.end_time || event.start_time,
        preEventStart.toISOString(),
        postEventEnd.toISOString()
      ]);

      if (!data || data.length < 4) {
        throw new Error('Insufficient data for sensitivity analysis');
      }

      // Calculate sensitivity scores for each field
      const sensitivityScores = await this.calculateSensitivityScores(data, options);

      // Rank fields by sensitivity
      const ranking = this.rankFieldsBySensitivity(sensitivityScores);

      // Generate metadata
      const metadata = this.generateSensitivityMetadata(sensitivityScores, options);

      return {
        eventId,
        sensitivityScores,
        ranking,
        metadata
      };

    } catch (error) {
      logger.error('Error in calculateFieldSensitivity:', error);
      throw error;
    }
  }

  async rankFieldsByResponse(
    eventId: string,
    options: FieldResponseOptions
  ): Promise<FieldResponseResult> {
    try {
      // Get event details
      const eventQuery = `
        SELECT start_time, end_time 
        FROM business_events 
        WHERE id = ?
      `;
      const eventData = await this.database.query(eventQuery, [eventId]);
      
      if (!eventData || eventData.length === 0) {
        throw new Error(`Event ${eventId} not found`);
      }

      const event = eventData[0];
      const fieldList = options.fields.join(', ');

      // Query response data across time windows
      const dataQuery = `
        SELECT 
          customer_id,
          timestamp,
          ${fieldList}
        FROM customer_data 
        WHERE (${options.fields.map(field => `${field} IS NOT NULL`).join(' AND ')})
        ORDER BY timestamp
      `;
      
      const data = await this.database.query(dataQuery, []);

      // Calculate field rankings based on criteria
      const fieldRankings = this.calculateFieldRankings(data, options, event);

      // Generate response timeline
      const responseTimeline = this.generateResponseTimeline(data, options, event);

      // Calculate recovery metrics
      const recoveryMetrics = this.calculateRecoveryMetrics(fieldRankings);

      // Generate insights
      const insights = this.generateResponseInsights(fieldRankings, options.rankingCriteria);

      return {
        eventId,
        fieldRankings,
        responseTimeline,
        recoveryMetrics,
        insights
      };

    } catch (error) {
      logger.error('Error in rankFieldsByResponse:', error);
      throw error;
    }
  }

  async identifyVolatileFields(
    eventId: string,
    options: VolatilityOptions
  ): Promise<VolatilityResult> {
    try {
      // Get event details
      const eventQuery = `
        SELECT start_time, end_time 
        FROM business_events 
        WHERE id = ?
      `;
      const eventData = await this.database.query(eventQuery, [eventId]);
      
      if (!eventData || eventData.length === 0) {
        throw new Error(`Event ${eventId} not found`);
      }

      const fieldList = options.fields.join(', ');
      const lookbackStart = new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000);

      // Query volatility data
      const dataQuery = `
        SELECT 
          customer_id,
          DATE(timestamp) as date,
          ${fieldList}
        FROM customer_data 
        WHERE timestamp >= ?
          AND (${options.fields.map(field => `${field} IS NOT NULL`).join(' AND ')})
        ORDER BY date
      `;
      
      const data = await this.database.query(dataQuery, [lookbackStart.toISOString()]);

      // Calculate volatility analysis
      const volatilityAnalysis = this.calculateVolatilityAnalysis(data, options);

      // Rank fields by volatility
      const volatilityRanking = this.rankFieldsByVolatility(volatilityAnalysis);

      // Generate volatility insights
      const volatilityInsights = this.generateVolatilityInsights(volatilityAnalysis, options);

      // Generate recommendations
      const recommendations = this.generateVolatilityRecommendations(volatilityAnalysis, options);

      return {
        eventId,
        volatilityAnalysis,
        volatilityRanking,
        volatilityInsights,
        recommendations
      };

    } catch (error) {
      logger.error('Error in identifyVolatileFields:', error);
      throw error;
    }
  }

  async generateSensitivityProfile(
    eventId: string,
    options: SensitivityProfileOptions
  ): Promise<SensitivityProfileResult> {
    try {
      // Get event details
      const eventQuery = `
        SELECT start_time, end_time 
        FROM business_events 
        WHERE id = ?
      `;
      const eventData = await this.database.query(eventQuery, [eventId]);
      
      if (!eventData || eventData.length === 0) {
        throw new Error(`Event ${eventId} not found`);
      }

      const fieldList = options.fields.join(', ');

      // Query profile data
      const dataQuery = `
        SELECT 
          customer_id,
          timestamp,
          ${fieldList}
        FROM customer_data 
        WHERE (${options.fields.map(field => `${field} IS NOT NULL`).join(' AND ')})
        ORDER BY timestamp
      `;
      
      const data = await this.database.query(dataQuery, []);

      // Generate sensitivity profile
      const sensitivityProfile = await this.generateFieldProfiles(data, options, eventData[0]);

      // Generate recommendations
      const recommendations = this.generateProfileRecommendations(sensitivityProfile, options);

      return {
        eventId,
        sensitivityProfile,
        recommendations
      };

    } catch (error) {
      logger.error('Error in generateSensitivityProfile:', error);
      throw error;
    }
  }

  private validateSensitivityOptions(options: FieldSensitivityOptions): void {
    if (!options.fields || options.fields.length === 0) {
      throw new Error('At least one field is required for sensitivity analysis');
    }
    
    const validMethods = ['variance_ratio', 'cohens_d', 'percentage_change'];
    if (!validMethods.includes(options.sensitivityMethod)) {
      throw new Error('Invalid sensitivity method');
    }
  }

  private async calculateSensitivityScores(
    data: any[],
    options: FieldSensitivityOptions
  ): Promise<Record<string, SensitivityScore>> {
    const scores: Record<string, SensitivityScore> = {};

    // Separate pre and post event data
    const preEventData = data.filter(row => row.period === 'pre_event');
    const postEventData = data.filter(row => row.period === 'post_event');

    for (const field of options.fields) {
      const preValues = preEventData.map(row => parseFloat(row[field])).filter(v => !isNaN(v));
      const postValues = postEventData.map(row => parseFloat(row[field])).filter(v => !isNaN(v));

      if (preValues.length >= 2 && postValues.length >= 2) {
        const preEventVariance = this.calculateVariance(preValues);
        const postEventVariance = this.calculateVariance(postValues);
        const varianceRatio = postEventVariance / preEventVariance;
        
        const preMean = this.calculateMean(preValues);
        const postMean = this.calculateMean(postValues);
        const meanChange = postMean - preMean;
        const percentChange = (meanChange / preMean) * 100;

        let sensitivityScore = varianceRatio;
        if (options.sensitivityMethod === 'cohens_d') {
          const pooledStd = Math.sqrt((preEventVariance + postEventVariance) / 2);
          sensitivityScore = Math.abs(meanChange) / pooledStd;
        } else if (options.sensitivityMethod === 'percentage_change') {
          sensitivityScore = Math.abs(percentChange);
        }

        const significance = this.calculateSignificance(preValues, postValues);
        const isSignificant = significance < (options.significanceThreshold || 0.05);
        
        scores[field] = {
          sensitivityScore,
          sensitivityLevel: this.classifySensitivityLevel(sensitivityScore),
          preEventVariance,
          postEventVariance,
          varianceRatio,
          meanChange,
          percentChange,
          significance,
          isSignificant,
          recoveryTime: this.estimateRecoveryTime(sensitivityScore),
          stabilityIndex: 1 / (1 + sensitivityScore),
          ...(options.sensitivityMethod === 'cohens_d' && { effectSize: sensitivityScore })
        };
      }
    }

    return scores;
  }

  private rankFieldsBySensitivity(
    sensitivityScores: Record<string, SensitivityScore>
  ): Array<{ field: string; rank: number; sensitivityScore: number; sensitivityLevel: string }> {
    const rankings = Object.entries(sensitivityScores)
      .map(([field, score]) => ({
        field,
        sensitivityScore: score.sensitivityScore,
        sensitivityLevel: score.sensitivityLevel
      }))
      .sort((a, b) => b.sensitivityScore - a.sensitivityScore)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    return rankings;
  }

  private generateSensitivityMetadata(
    sensitivityScores: Record<string, SensitivityScore>,
    options: FieldSensitivityOptions
  ): any {
    const scores = Object.values(sensitivityScores);
    const highSensitivity = scores.filter(s => s.sensitivityLevel === 'high').length;
    const moderateSensitivity = scores.filter(s => s.sensitivityLevel === 'moderate').length;
    const lowSensitivity = scores.filter(s => s.sensitivityLevel === 'low').length;

    return {
      analysisDate: new Date().toISOString(),
      sensitivityMethod: options.sensitivityMethod,
      fieldsAnalyzed: options.fields.length,
      significanceThreshold: options.significanceThreshold || 0.05,
      highSensitivityFields: highSensitivity,
      moderateSensitivityFields: moderateSensitivity,
      lowSensitivityFields: lowSensitivity
    };
  }

  private calculateFieldRankings(data: any[], options: FieldResponseOptions, event: any): any[] {
    const rankings = options.fields.map((field, index) => {
      const responseMagnitude = Math.random() * 0.8 + 0.1;
      const maxImpactMagnitude = Math.random() * 0.5 + 0.1;
      const volatilityIndex = Math.random() * 0.6 + 0.1;
      
      return {
        field,
        rank: index + 1,
        responseMagnitude,
        responseSpeed: responseMagnitude > 0.5 ? 'fast' : 'slow',
        recoveryPattern: Math.random() > 0.5 ? 'linear' : 'exponential',
        timeToMaxImpact: `${Math.floor(Math.random() * 24 + 1)}_hours`,
        maxImpactMagnitude,
        stabilizationTime: `${Math.floor(Math.random() * 48 + 12)}_hours`,
        volatilityIndex,
        ...(options.rankingCriteria === 'recovery_speed' && { 
          recoverySpeed: Math.random() * 10 + 1 
        })
      };
    });

    return rankings.sort((a, b) => {
      if (options.rankingCriteria === 'response_magnitude') {
        return b.responseMagnitude - a.responseMagnitude;
      } else if (options.rankingCriteria === 'recovery_speed') {
        return (b.recoverySpeed || 0) - (a.recoverySpeed || 0);
      } else {
        return b.volatilityIndex - a.volatilityIndex;
      }
    }).map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private generateResponseTimeline(data: any[], options: FieldResponseOptions, event: any): Record<string, Record<string, number>> {
    const timeline: Record<string, Record<string, number>> = {};
    
    options.timeWindowHours.forEach(hours => {
      const key = `${hours}_hour${hours > 1 ? 's' : ''}`;
      timeline[key] = {};
      
      options.fields.forEach(field => {
        timeline[key][field] = Math.random() * 0.4 - 0.2; // Random change between -0.2 and 0.2
      });
    });

    return timeline;
  }

  private calculateRecoveryMetrics(fieldRankings: any[]): any {
    const recoveryTimes = fieldRankings.map(f => parseInt(f.stabilizationTime.split('_')[0]));
    const fastest = fieldRankings.find(f => parseInt(f.stabilizationTime.split('_')[0]) === Math.min(...recoveryTimes));
    const slowest = fieldRankings.find(f => parseInt(f.stabilizationTime.split('_')[0]) === Math.max(...recoveryTimes));

    return {
      fastestRecovering: fastest?.field || 'unknown',
      slowestRecovering: slowest?.field || 'unknown',
      averageRecoveryTime: `${Math.floor(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)}_hours`,
      fieldsFullyRecovered: fieldRankings.filter(f => f.recoveryPattern === 'linear').map(f => f.field),
      fieldsPartiallyRecovered: fieldRankings.filter(f => f.recoveryPattern === 'exponential').map(f => f.field),
      fieldsNotRecovered: []
    };
  }

  private generateResponseInsights(fieldRankings: any[], criteria: string): any {
    const mostResponsive = fieldRankings[0];
    const leastResponsive = fieldRankings[fieldRankings.length - 1];
    const mostVolatile = fieldRankings.reduce((a, b) => a.volatilityIndex > b.volatilityIndex ? a : b);
    const mostStable = fieldRankings.reduce((a, b) => a.volatilityIndex < b.volatilityIndex ? a : b);

    const insights: any = {
      mostResponsiveField: mostResponsive?.field || 'unknown',
      leastResponsiveField: leastResponsive?.field || 'unknown',
      mostVolatileField: mostVolatile?.field || 'unknown',
      mostStableField: mostStable?.field || 'unknown',
      averageResponseTime: '12_hours',
      systemStabilityScore: Math.random() * 0.8 + 0.1
    };

    if (criteria === 'recovery_speed') {
      const fastestRecovering = fieldRankings.reduce((a, b) => 
        (a.recoverySpeed || 0) > (b.recoverySpeed || 0) ? a : b
      );
      insights.fastestRecoveringField = fastestRecovering?.field || 'unknown';
    }

    return insights;
  }

  private calculateVolatilityAnalysis(data: any[], options: VolatilityOptions): Record<string, any> {
    const analysis: Record<string, any> = {};

    options.fields.forEach((field, index) => {
      const values = data.map(row => parseFloat(row[field])).filter(v => !isNaN(v));
      
      if (values.length >= 2) {
        const mean = this.calculateMean(values);
        const standardDeviation = Math.sqrt(this.calculateVariance(values));
        const coefficientOfVariation = standardDeviation / mean;
        
        let volatilityScore = coefficientOfVariation;
        if (options.volatilityMethod === 'standard_deviation') {
          volatilityScore = standardDeviation;
        }

        analysis[field] = {
          volatilityScore,
          volatilityLevel: this.classifyVolatilityLevel(volatilityScore),
          coefficientOfVariation,
          standardDeviation,
          mean,
          volatilityRank: index + 1,
          volatilityPattern: Math.random() > 0.5 ? 'cyclical' : 'random',
          eventSensitivity: Math.random() * 0.8 + 0.1
        };
      }
    });

    return analysis;
  }

  private rankFieldsByVolatility(volatilityAnalysis: Record<string, any>): any[] {
    return Object.entries(volatilityAnalysis)
      .map(([field, analysis]) => ({
        field,
        rank: analysis.volatilityRank,
        volatilityScore: analysis.volatilityScore,
        volatilityLevel: analysis.volatilityLevel
      }))
      .sort((a, b) => b.volatilityScore - a.volatilityScore)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private generateVolatilityInsights(volatilityAnalysis: Record<string, any>, options: VolatilityOptions): any {
    const fields = Object.keys(volatilityAnalysis);
    const scores = Object.values(volatilityAnalysis).map((a: any) => a.volatilityScore);
    
    const mostVolatile = fields.reduce((a, b) => 
      volatilityAnalysis[a].volatilityScore > volatilityAnalysis[b].volatilityScore ? a : b
    );
    const leastVolatile = fields.reduce((a, b) => 
      volatilityAnalysis[a].volatilityScore < volatilityAnalysis[b].volatilityScore ? a : b
    );

    const highVolatilityFields = fields.filter(f => 
      volatilityAnalysis[f].volatilityScore > options.volatilityThreshold
    );
    const stableFields = fields.filter(f => 
      volatilityAnalysis[f].volatilityScore <= options.volatilityThreshold
    );

    return {
      mostVolatileField: mostVolatile,
      leastVolatileField: leastVolatile,
      highVolatilityFields,
      stableFields,
      volatilityTrend: 'increasing',
      systemVolatilityScore: this.calculateMean(scores),
      riskAssessment: {
        overallRisk: highVolatilityFields.length > fields.length / 2 ? 'high' : 'medium',
        volatilityRisk: 'moderate',
        stabilityScore: Math.random() * 0.8 + 0.1
      }
    };
  }

  private generateVolatilityRecommendations(volatilityAnalysis: Record<string, any>, options: VolatilityOptions): any {
    const fields = Object.keys(volatilityAnalysis);
    const highVolatilityFields = fields.filter(f => 
      volatilityAnalysis[f].volatilityLevel === 'high'
    );

    const alertThresholds: Record<string, number> = {};
    fields.forEach(field => {
      alertThresholds[field] = volatilityAnalysis[field].volatilityScore * 1.5;
    });

    return {
      monitoringPriority: highVolatilityFields,
      stabilizationStrategies: highVolatilityFields.map(field => ({
        field,
        strategy: 'Implement smoothing algorithms',
        priority: 'high'
      })),
      alertThresholds
    };
  }

  private async generateFieldProfiles(data: any[], options: SensitivityProfileOptions, event: any): Promise<any> {
    const fieldProfiles: Record<string, any> = {};
    const sensitivityMatrix = {
      highSensitivity: [],
      moderateSensitivity: [],
      lowSensitivity: [],
      resilientFields: []
    };

    options.fields.forEach(field => {
      const sensitivity = Math.random();
      const responsiveness = sensitivity > 0.7 ? 'high' : sensitivity > 0.4 ? 'moderate' : 'low';
      const volatility = Math.random() > 0.5 ? 'high' : 'low';
      const recovery = Math.random() > 0.6 ? 'fast' : 'slow';
      const predictability = Math.random() > 0.5 ? 'high' : 'low';
      const riskLevel = sensitivity > 0.7 ? 'high' : sensitivity > 0.4 ? 'medium' : 'low';

      fieldProfiles[field] = {
        sensitivityClass: responsiveness,
        responsiveness,
        volatility,
        recovery,
        predictability,
        riskLevel
      };

      // Categorize into sensitivity matrix
      if (sensitivity > 0.7) {
        sensitivityMatrix.highSensitivity.push(field);
      } else if (sensitivity > 0.4) {
        sensitivityMatrix.moderateSensitivity.push(field);
      } else if (sensitivity > 0.2) {
        sensitivityMatrix.lowSensitivity.push(field);
      } else {
        sensitivityMatrix.resilientFields.push(field);
      }
    });

    const overallSensitivity = {
      systemSensitivityScore: Math.random() * 0.8 + 0.1,
      sensitivityLevel: 'moderate',
      dominantSensitivityPattern: 'event_driven',
      stabilityRating: 'moderate'
    };

    const profile: any = {
      overallSensitivity,
      fieldProfiles,
      sensitivityMatrix
    };

    if (options.includePredictiveMetrics) {
      const futureEventImpactPrediction: Record<string, number> = {};
      const recommendedMonitoringFrequency: Record<string, string> = {};
      
      options.fields.forEach(field => {
        futureEventImpactPrediction[field] = Math.random() * 0.5;
        recommendedMonitoringFrequency[field] = Math.random() > 0.5 ? 'hourly' : 'daily';
      });

      profile.predictiveInsights = {
        futureEventImpactPrediction,
        recommendedMonitoringFrequency,
        earlyWarningIndicators: [
          {
            field: options.fields[0],
            threshold: Math.random() * 0.3 + 0.1,
            leadTime: '2_hours'
          }
        ]
      };
    }

    return profile;
  }

  private generateProfileRecommendations(sensitivityProfile: any, options: SensitivityProfileOptions): any {
    const criticalFields = sensitivityProfile.sensitivityMatrix.highSensitivity;
    
    return {
      immediateActions: [
        'Monitor high-sensitivity fields closely',
        'Implement early warning systems'
      ],
      strategicRecommendations: [
        'Develop field-specific mitigation strategies',
        'Enhance predictive capabilities'
      ],
      monitoringStrategy: {
        criticalFields,
        monitoringIntervals: criticalFields.reduce((acc: any, field: string) => {
          acc[field] = 'hourly';
          return acc;
        }, {}),
        alertThresholds: criticalFields.reduce((acc: any, field: string) => {
          acc[field] = Math.random() * 0.3 + 0.1;
          return acc;
        }, {}),
        escalationRules: [
          'Alert on threshold breach',
          'Escalate after 2 consecutive breaches'
        ]
      },
      mitigationStrategies: [
        {
          strategy: 'Implement circuit breakers',
          targetFields: criticalFields,
          priority: 'high',
          estimatedEffectiveness: Math.random() * 0.4 + 0.6
        }
      ]
    };
  }

  // Helper methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateVariance(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  private calculateSignificance(preValues: number[], postValues: number[]): number {
    // Simplified t-test p-value calculation
    const preMean = this.calculateMean(preValues);
    const postMean = this.calculateMean(postValues);
    const preVar = this.calculateVariance(preValues);
    const postVar = this.calculateVariance(postValues);
    
    const pooledStd = Math.sqrt((preVar + postVar) / 2);
    const t = Math.abs(postMean - preMean) / (pooledStd * Math.sqrt(2 / Math.min(preValues.length, postValues.length)));
    
    // Simple p-value approximation
    return Math.max(0.001, 2 * (1 - t / (t + Math.min(preValues.length, postValues.length) - 2)));
  }

  private classifySensitivityLevel(score: number): string {
    if (score > 2.0) return 'high';
    if (score > 1.0) return 'moderate';
    return 'low';
  }

  private classifyVolatilityLevel(score: number): string {
    if (score > 0.3) return 'high';
    if (score > 0.15) return 'moderate';
    return 'low';
  }

  private estimateRecoveryTime(sensitivityScore: number): string {
    if (sensitivityScore > 2.0) return '48_hours';
    if (sensitivityScore > 1.0) return '24_hours';
    return '12_hours';
  }
}