import { DatabaseService } from '../database/sqlite';
import { CausalAnalysisService } from './causal-analysis.service';
import { BusinessEventService, BusinessEvent } from './business-event.service';
import { CustomerImpactResolverService } from './customer-impact-resolver.service';
import logger from '../config/logger';

export interface FieldAnalysisOptions {
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  correlationMethod?: 'pearson' | 'spearman' | 'kendall';
  handleMissingData?: 'skip_field' | 'impute' | 'fail';
}

export interface SensitivityAnalysisOptions {
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  sensitivityMetrics: string[];
}

export interface CompositeAnalysisOptions {
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  weightingScheme: 'business_priority' | 'equal' | 'volume_based';
  fieldWeights: { [fieldName: string]: number };
  aggregationMethod: 'weighted_average' | 'geometric_mean' | 'harmonic_mean';
}

export interface WeightingOptions {
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  weightingScheme: 'custom' | 'auto_derive';
  customWeights?: { [fieldName: string]: number };
  weightingCriteria?: {
    businessImpact: number;
    volumeWeight: number;
    customerSegmentWeight: number;
  };
}

export interface AutoWeightOptions {
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  weightingScheme: 'auto_derive';
  derivationCriteria: string[];
}

export interface FieldImpact {
  fieldName: string;
  impactMagnitude: number;
  effectSize: number;
  significance: boolean;
  dataQuality?: string;
}

export interface CorrelationAnalysisResult {
  eventId: string;
  analysisMetadata: {
    totalFields: number;
    analyzedFields?: number;
    skippedFields?: string[];
    correlationMethod?: string;
    beforePeriod: any;
    afterPeriod: any;
    dataQualityWarnings?: string[];
  };
  fieldImpacts: FieldImpact[];
  correlationMatrix: { [key: string]: number };
  overallCorrelation: {
    strength: string;
    direction: string;
    consistency: number;
    reliability?: string;
  };
}

export interface SensitivityMetrics {
  varianceChange: number;
  responseMagnitude: number;
  recoveryTime: number;
}

export interface SensitivityRanking {
  fieldName: string;
  sensitivityScore: number;
  rank: number;
  metrics: SensitivityMetrics;
}

export interface SensitivityAnalysisResult {
  eventId: string;
  sensitivityRanking: SensitivityRanking[];
  overallSensitivity: {
    mostSensitiveField: string;
    leastSensitiveField: string;
    averageSensitivity: number;
    consistencyIndex: number;
  };
}

export interface FieldContribution {
  fieldName: string;
  weight: number;
  rawImpact: number;
  weightedContribution: number;
  contributionPercentage: number;
}

export interface CompositeImpactResult {
  eventId: string;
  compositeScore: number;
  weightedImpact: number;
  fieldContributions: FieldContribution[];
  impactDistribution: {
    primaryDriver: string;
    secondaryDriver: string;
    dominanceIndex: number;
    balanceScore: number;
  };
  aggregationMetadata: {
    method: string;
    totalWeight: number;
    fieldsAnalyzed: number;
    confidenceLevel: number;
  };
}

export interface WeightingFactors {
  businessImpact: number;
  volumeWeight: number;
  customerSegmentWeight: number;
}

export interface FieldWeightingResult {
  eventId: string;
  weightingScheme: string;
  fieldAnalysis: Array<{
    fieldName: string;
    rawImpact: number;
    weight: number;
    weightedImpact: number;
    weightingFactors?: WeightingFactors;
  }>;
  aggregatedImpact: {
    weightedAverage: number;
    dominantField: string;
    impactDistribution: any;
    confidenceScore: number;
  };
  weightValidation: {
    totalWeight: number;
    balanceScore: number;
    recommendedAdjustments: any[];
  };
}

export interface DerivationMetrics {
  fieldName: string;
  varianceStability: number;
  sampleSize: number;
  signalToNoiseRatio: number;
  recommendedWeight: number;
  confidence?: number;
}

export interface AutoWeightResult {
  eventId: string;
  derivedWeights: { [fieldName: string]: number };
  derivationMetrics: DerivationMetrics[];
  weightingRationale: {
    primaryFactor: string;
    secondaryFactors: string[];
    overallConfidence: number;
    recommendedUse: string;
  };
}

// Temporal Analysis Interfaces
export interface TemporalOptions {
  eventDate: string;
  preEventWindows: Array<{ name: string; days: number }>;
  postEventWindows: Array<{ name: string; days: number }>;
  textFields: string[];
  granularity: 'daily' | 'hourly';
}

export interface WindowAnalysis {
  windowName: string;
  days: number;
  dateRange: {
    start: string;
    end: string;
  };
  fieldAnalysis: Array<{
    fieldName: string;
    averageSentiment: number;
    sentimentTrend: 'declining' | 'stable' | 'improving';
    dataPoints: number;
    trendSlope: number;
    recoveryMetrics?: {
      initialDrop: number;
      recoveryRate: number;
      daysToRecovery: number;
    };
  }>;
}

export interface TemporalAnalysisResult {
  eventId: string;
  eventDate: string;
  temporalAnalysis: {
    preEventWindows: WindowAnalysis[];
    postEventWindows: WindowAnalysis[];
  };
  windowComparisons: Array<{
    comparison: string;
    fields: Array<{
      fieldName: string;
      preAverage: number;
      postAverage: number;
      impactMagnitude: number;
    }>;
    statisticalSignificance: boolean;
    effectSize: number;
    impactMagnitude: number;
  }>;
  overallTemporal: {
    preEventTrend: 'declining' | 'stable' | 'improving';
    postEventTrend: 'declining' | 'stable' | 'improving';
    eventImpactMagnitude: number;
    recoveryTimeEstimate: number;
    temporalConsistency: number;
  };
}

export interface SlidingWindowOptions {
  eventDate: string;
  windowSize: number;
  stepSize: number;
  analysisRange: {
    beforeDays: number;
    afterDays: number;
  };
  textFields: string[];
  trendDetection: {
    method: 'linear_regression' | 'polynomial_regression' | 'spline_interpolation';
    minDataPoints: number;
    significanceThreshold: number;
    polynomialDegree?: number;
    splineSmoothing?: number;
  };
  advancedFeatures?: {
    adaptiveWindowSizing: boolean;
    temporalClustering: boolean;
    changePointDetection: boolean;
    seasonalityDetection: boolean;
    outlierFiltering: {
      enabled: boolean;
      method: 'zscore' | 'iqr' | 'isolation_forest';
      threshold: number;
    };
  };
}

export interface SlidingWindowResult {
  eventId: string;
  eventDate: string;
  slidingAnalysis: {
    windowSize: number;
    stepSize: number;
    totalWindows: number;
    windows: Array<{
      windowIndex: number;
      dateRange: {
        start: string;
        end: string;
      };
      windowType: 'pre_event' | 'event_window' | 'post_event';
      fieldMetrics: Array<{
        fieldName: string;
        averageSentiment: number;
        trendSlope: number;
        rSquared: number;
        dataPoints: number;
      }>;
    }>;
  };
  trendAnalysis: {
    preEventTrend: {
      overallSlope: number;
      rSquared: number;
      isSignificant: boolean;
      trendDirection: 'declining' | 'stable' | 'improving';
    };
    postEventTrend: {
      overallSlope: number;
      rSquared: number;
      isSignificant: boolean;
      trendDirection: 'declining' | 'stable' | 'improving';
    };
    eventImpact: {
      immediateChange: number;
      trendChangePoint: string;
      recoveryDetected: boolean;
    };
  };
  anomalyDetection: {
    anomalousWindows: number[];
    eventAnomalyScore: number;
    baselineVariation: number;
  };
}

export interface TemporalDecayOptions {
  eventDate: string;
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  decayFunction: {
    type: 'exponential' | 'linear' | 'polynomial' | 'gaussian' | 'custom';
    halfLife: number;
    maxWeight: number;
    minWeight: number;
    polynomialDegree?: number;
    gaussianSigma?: number;
    customFunction?: string;
  };
  baselineComparison: boolean;
  adaptiveDecay?: boolean;
  temporalClustering?: {
    enabled: boolean;
    clusterSize: number;
    overlapRatio: number;
  };
}

export interface TemporalDecayResult {
  eventId: string;
  eventDate: string;
  decayFunction: {
    type: string;
    halfLife: number;
    maxWeight: number;
    minWeight: number;
  };
  weightedAnalysis: {
    beforePeriod: Array<{
      fieldName: string;
      rawAverage: number;
      weightedAverage: number;
      weightDifference: number;
      totalWeight: number;
      dataPoints: number;
    }>;
    afterPeriod: Array<{
      fieldName: string;
      rawAverage: number;
      weightedAverage: number;
      weightDifference: number;
      totalWeight: number;
      dataPoints: number;
    }>;
  };
  temporalWeights: Array<{
    dataPoint: string;
    daysFromEvent: number;
    weight: number;
    contribution: number;
  }>;
  impactAssessment: {
    rawImpact: number;
    weightedImpact: number;
    temporalSignificance: number;
    decayAdjustedPValue: number;
  };
  recommendations: {
    optimalDecayFunction: string;
    suggestedHalfLife: number;
    dataQualityScore: number;
  };
}

export interface IrregularTemporalOptions {
  eventDate: string;
  beforePeriodDays: number;
  afterPeriodDays: number;
  textFields: string[];
  interpolation: {
    method: 'linear';
    maxGapDays: number;
    fillStrategy: 'interpolate';
  };
  dataQualityThresholds: {
    minDataPointsPerDay: number;
    maxGapDays: number;
    minimumCoverage: number;
  };
}

export interface IrregularTemporalResult {
  eventId: string;
  eventDate: string;
  dataQualityAnalysis: {
    beforePeriod: {
      totalDays: number;
      daysWithData: number;
      coverage: number;
      gaps: Array<{
        start: string;
        end: string;
        duration: number;
      }>;
      qualityScore: number;
    };
    afterPeriod: {
      totalDays: number;
      daysWithData: number;
      coverage: number;
      gaps: Array<{
        start: string;
        end: string;
        duration: number;
      }>;
      qualityScore: number;
    };
  };
  interpolatedData: {
    beforePeriod: Array<{
      date: string;
      originalValue: number;
      interpolatedValue: number;
      isInterpolated: boolean;
      confidence: number;
    }>;
    afterPeriod: Array<{
      date: string;
      originalValue: number;
      interpolatedValue: number;
      isInterpolated: boolean;
      confidence: number;
    }>;
  };
  adjustedAnalysis: {
    beforeAverage: number;
    afterAverage: number;
    confidenceAdjustedImpact: number;
    dataQualityWarnings: string[];
    recommendedMinimumPeriod: number;
  };
  interpolationMetrics: {
    method: string;
    interpolatedPoints: number;
    maxInterpolationGap: number;
    interpolationReliability: number;
  };
}

export class MultiFieldAnalysisService {
  private databaseService: DatabaseService;
  private causalAnalysisService: CausalAnalysisService;
  private businessEventService: BusinessEventService;
  private customerImpactResolver: CustomerImpactResolverService;

  constructor(
    databaseService: DatabaseService,
    causalAnalysisService: CausalAnalysisService,
    businessEventService: BusinessEventService,
    customerImpactResolver: CustomerImpactResolverService
  ) {
    this.databaseService = databaseService;
    this.causalAnalysisService = causalAnalysisService;
    this.businessEventService = businessEventService;
    this.customerImpactResolver = customerImpactResolver;
  }

  async analyzeFieldCorrelations(eventId: string, options: FieldAnalysisOptions): Promise<CorrelationAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(event.eventDate);
      const beforeStart = new Date(eventDate);
      beforeStart.setDate(beforeStart.getDate() - options.beforePeriodDays);
      const afterEnd = new Date(eventDate);
      afterEnd.setDate(afterEnd.getDate() + options.afterPeriodDays);

      const fieldImpacts: FieldImpact[] = [];
      const fieldData: { [fieldName: string]: { before: number[]; after: number[] } } = {};
      const skippedFields: string[] = [];
      const dataQualityWarnings: string[] = [];

      // Analyze each field
      for (const fieldName of options.textFields) {
        try {
          const beforeData = await this.getSentimentData(eventId, beforeStart, eventDate, fieldName);
          const afterData = await this.getSentimentData(eventId, eventDate, afterEnd, fieldName);

          const beforeScores = beforeData.map(d => d.sentiment_score);
          const afterScores = afterData.map(d => d.sentiment_score);

          // Check data quality
          if (beforeScores.length < 2 || afterScores.length < 2) {
            if (options.handleMissingData === 'skip_field') {
              skippedFields.push(fieldName);
              dataQualityWarnings.push(`Insufficient data for ${fieldName}`);
              continue;
            } else if (options.handleMissingData === 'fail') {
              throw new Error(`Insufficient data for field: ${fieldName}`);
            }
          }

          // Calculate impact metrics
          const beforeMean = this.mean(beforeScores);
          const afterMean = this.mean(afterScores);
          const impactMagnitude = afterMean - beforeMean;
          const effectSize = this.calculateCohenD(beforeScores, afterScores);

          // Simple significance test (would use proper statistical test in production)
          const pooledStd = this.pooledStandardDeviation(beforeScores, afterScores);
          const standardError = pooledStd * Math.sqrt(1/beforeScores.length + 1/afterScores.length);
          const tStatistic = Math.abs(impactMagnitude) / standardError;
          const significance = tStatistic > 2.0; // Rough threshold

          fieldImpacts.push({
            fieldName,
            impactMagnitude,
            effectSize,
            significance,
            dataQuality: 'complete'
          });

          fieldData[fieldName] = { before: beforeScores, after: afterScores };

        } catch (error) {
          if (options.handleMissingData === 'skip_field') {
            skippedFields.push(fieldName);
            dataQualityWarnings.push(`Error analyzing ${fieldName}: ${error instanceof Error ? error.message : error}`);
          } else {
            throw error;
          }
        }
      }

      // Calculate correlation matrix
      const correlationMatrix: { [key: string]: number } = {};
      const fieldNames = Object.keys(fieldData);
      
      for (let i = 0; i < fieldNames.length; i++) {
        for (let j = i + 1; j < fieldNames.length; j++) {
          const field1 = fieldNames[i];
          const field2 = fieldNames[j];
          
          const correlation = this.calculateCorrelation(
            fieldData[field1].after.map((v, idx) => v - fieldData[field1].before[idx]),
            fieldData[field2].after.map((v, idx) => v - fieldData[field2].before[idx]),
            options.correlationMethod || 'pearson'
          );
          
          correlationMatrix[`${field1}-${field2}`] = correlation;
        }
      }

      // Calculate overall correlation strength
      const correlationValues = Object.values(correlationMatrix);
      let overallStrength = 'insufficient_data';
      let overallDirection = 'unknown';
      let consistency = 0;
      let reliability = 'low';

      if (correlationValues.length > 0) {
        const avgCorrelation = correlationValues.reduce((sum, corr) => sum + Math.abs(corr), 0) / correlationValues.length;
        const positiveCorrelations = correlationValues.filter(corr => corr > 0).length;
        
        if (avgCorrelation > 0.7) overallStrength = 'strong';
        else if (avgCorrelation > 0.3) overallStrength = 'moderate';
        else overallStrength = 'weak';

        if (positiveCorrelations > correlationValues.length / 2) overallDirection = 'positive';
        else if (positiveCorrelations < correlationValues.length / 2) overallDirection = 'negative';
        else overallDirection = 'mixed';

        consistency = avgCorrelation;
        reliability = fieldImpacts.length >= 2 ? 'medium' : 'low';
      }

      const duration = Date.now() - startTime;
      logger.info('Multi-field correlation analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        totalFields: options.textFields.length,
        analyzedFields: fieldImpacts.length,
        skippedFields: skippedFields.length,
        duration
      });

      return {
        eventId,
        analysisMetadata: {
          totalFields: options.textFields.length,
          analyzedFields: fieldImpacts.length,
          skippedFields,
          correlationMethod: options.correlationMethod || 'pearson',
          beforePeriod: { start: beforeStart, end: eventDate },
          afterPeriod: { start: eventDate, end: afterEnd },
          dataQualityWarnings
        },
        fieldImpacts,
        correlationMatrix,
        overallCorrelation: {
          strength: overallStrength,
          direction: overallDirection,
          consistency,
          reliability
        }
      };

    } catch (error) {
      logger.error('Failed to analyze field correlations', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async analyzeSensitivityPatterns(eventId: string, options: SensitivityAnalysisOptions): Promise<SensitivityAnalysisResult> {
    try {
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(event.eventDate);
      const beforeStart = new Date(eventDate);
      beforeStart.setDate(beforeStart.getDate() - options.beforePeriodDays);
      const afterEnd = new Date(eventDate);
      afterEnd.setDate(afterEnd.getDate() + options.afterPeriodDays);

      const sensitivityRanking: SensitivityRanking[] = [];

      for (const fieldName of options.textFields) {
        const beforeData = await this.getSentimentDataTimeSeries(eventId, beforeStart, eventDate, fieldName);
        const afterData = await this.getSentimentDataTimeSeries(eventId, eventDate, afterEnd, fieldName);

        const beforeScores = beforeData.map(d => d.sentiment_score);
        const afterScores = afterData.map(d => d.sentiment_score);

        // Calculate sensitivity metrics
        const beforeVariance = this.variance(beforeScores);
        const afterVariance = this.variance(afterScores);
        const varianceChange = Math.abs(afterVariance - beforeVariance);

        const beforeMean = this.mean(beforeScores);
        const afterMean = this.mean(afterScores);
        const responseMagnitude = Math.abs(afterMean - beforeMean);

        // Calculate recovery time (simplified - time to return to baseline)
        const recoveryTime = this.calculateRecoveryTime(afterScores, beforeMean);

        // Calculate composite sensitivity score
        const sensitivityScore = (responseMagnitude * 0.5) + (varianceChange * 0.3) + (1 / Math.max(recoveryTime, 1) * 0.2);

        sensitivityRanking.push({
          fieldName,
          sensitivityScore,
          rank: 0, // Will be set after sorting
          metrics: {
            varianceChange,
            responseMagnitude,
            recoveryTime
          }
        });
      }

      // Sort by sensitivity score and assign ranks
      sensitivityRanking.sort((a, b) => b.sensitivityScore - a.sensitivityScore);
      sensitivityRanking.forEach((item, index) => {
        item.rank = index + 1;
      });

      const mostSensitiveField = sensitivityRanking[0]?.fieldName || '';
      const leastSensitiveField = sensitivityRanking[sensitivityRanking.length - 1]?.fieldName || '';
      const averageSensitivity = sensitivityRanking.reduce((sum, item) => sum + item.sensitivityScore, 0) / sensitivityRanking.length;
      
      // Calculate consistency index (how consistent rankings are across metrics)
      const consistencyIndex = this.calculateConsistencyIndex(sensitivityRanking);

      return {
        eventId,
        sensitivityRanking,
        overallSensitivity: {
          mostSensitiveField,
          leastSensitiveField,
          averageSensitivity,
          consistencyIndex
        }
      };

    } catch (error) {
      logger.error('Failed to analyze sensitivity patterns', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async calculateCompositeImpactScore(eventId: string, options: CompositeAnalysisOptions): Promise<CompositeImpactResult> {
    try {
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(event.eventDate);
      const beforeStart = new Date(eventDate);
      beforeStart.setDate(beforeStart.getDate() - options.beforePeriodDays);
      const afterEnd = new Date(eventDate);
      afterEnd.setDate(afterEnd.getDate() + options.afterPeriodDays);

      const fieldContributions: FieldContribution[] = [];
      let totalWeightedImpact = 0;
      let totalRawImpact = 0;

      for (const fieldName of options.textFields) {
        const beforeData = await this.getSentimentData(eventId, beforeStart, eventDate, fieldName);
        const afterData = await this.getSentimentData(eventId, eventDate, afterEnd, fieldName);

        const beforeScores = beforeData.map(d => d.sentiment_score);
        const afterScores = afterData.map(d => d.sentiment_score);

        const beforeMean = this.mean(beforeScores);
        const afterMean = this.mean(afterScores);
        const rawImpact = afterMean - beforeMean;

        const weight = options.fieldWeights[fieldName] || 0;
        const weightedContribution = rawImpact * weight;

        fieldContributions.push({
          fieldName,
          weight,
          rawImpact,
          weightedContribution,
          contributionPercentage: 0 // Will be calculated after totals
        });

        totalWeightedImpact += weightedContribution;
        totalRawImpact += Math.abs(rawImpact);
      }

      // Calculate contribution percentages
      fieldContributions.forEach(contribution => {
        contribution.contributionPercentage = totalRawImpact > 0 
          ? (Math.abs(contribution.weightedContribution) / Math.abs(totalWeightedImpact)) * 100
          : 0;
      });

      // Sort contributions to find primary and secondary drivers
      const sortedContributions = [...fieldContributions].sort((a, b) => 
        Math.abs(b.weightedContribution) - Math.abs(a.weightedContribution)
      );

      const primaryDriver = sortedContributions[0]?.fieldName || '';
      const secondaryDriver = sortedContributions[1]?.fieldName || '';

      // Calculate dominance index (how much primary driver dominates)
      const dominanceIndex = sortedContributions.length > 1
        ? Math.abs(sortedContributions[0].weightedContribution) / Math.abs(sortedContributions[1].weightedContribution)
        : 1;

      // Calculate balance score (how evenly distributed impact is)
      const maxContribution = Math.max(...fieldContributions.map(f => Math.abs(f.weightedContribution)));
      const balanceScore = maxContribution > 0
        ? 1 - (maxContribution / Math.abs(totalWeightedImpact))
        : 1;

      // Apply aggregation method
      let compositeScore = totalRawImpact / options.textFields.length; // Default to simple average
      if (options.aggregationMethod === 'weighted_average') {
        compositeScore = totalWeightedImpact;
      } else if (options.aggregationMethod === 'geometric_mean') {
        const validImpacts = fieldContributions.map(f => Math.abs(f.rawImpact)).filter(impact => impact > 0);
        if (validImpacts.length > 0) {
          const product = validImpacts.reduce((prod, impact) => prod * impact, 1);
          compositeScore = Math.pow(product, 1 / validImpacts.length);
          if (totalRawImpact < 0) compositeScore = -compositeScore;
        }
      }

      const totalWeight = Object.values(options.fieldWeights).reduce((sum, weight) => sum + weight, 0);

      return {
        eventId,
        compositeScore,
        weightedImpact: totalWeightedImpact,
        fieldContributions,
        impactDistribution: {
          primaryDriver,
          secondaryDriver,
          dominanceIndex,
          balanceScore
        },
        aggregationMetadata: {
          method: options.aggregationMethod,
          totalWeight,
          fieldsAnalyzed: options.textFields.length,
          confidenceLevel: 0.85 // Simplified confidence calculation
        }
      };

    } catch (error) {
      logger.error('Failed to calculate composite impact score', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async applyFieldWeighting(eventId: string, options: WeightingOptions): Promise<FieldWeightingResult> {
    try {
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(event.eventDate);
      const beforeStart = new Date(eventDate);
      beforeStart.setDate(beforeStart.getDate() - options.beforePeriodDays);
      const afterEnd = new Date(eventDate);
      afterEnd.setDate(afterEnd.getDate() + options.afterPeriodDays);

      const fieldAnalysis: any[] = [];
      let totalWeightedImpact = 0;
      let maxWeightedImpact = 0;
      let dominantField = '';

      for (const fieldName of options.textFields) {
        const beforeData = await this.getSentimentData(eventId, beforeStart, eventDate, fieldName);
        const afterData = await this.getSentimentData(eventId, eventDate, afterEnd, fieldName);

        const beforeScores = beforeData.map(d => d.sentiment_score);
        const afterScores = afterData.map(d => d.sentiment_score);

        const beforeMean = this.mean(beforeScores);
        const afterMean = this.mean(afterScores);
        const rawImpact = afterMean - beforeMean;

        const weight = options.customWeights?.[fieldName] || (1 / options.textFields.length);
        const weightedImpact = rawImpact * weight;

        // Calculate weighting factors if criteria provided
        let weightingFactors: WeightingFactors | undefined;
        if (options.weightingCriteria) {
          weightingFactors = {
            businessImpact: options.weightingCriteria.businessImpact * Math.abs(rawImpact),
            volumeWeight: options.weightingCriteria.volumeWeight * beforeScores.length / 100,
            customerSegmentWeight: options.weightingCriteria.customerSegmentWeight * 0.8 // Simplified
          };
        }

        fieldAnalysis.push({
          fieldName,
          rawImpact,
          weight,
          weightedImpact,
          weightingFactors
        });

        totalWeightedImpact += weightedImpact;
        
        if (Math.abs(weightedImpact) > maxWeightedImpact) {
          maxWeightedImpact = Math.abs(weightedImpact);
          dominantField = fieldName;
        }
      }

      const weightedAverage = totalWeightedImpact / options.textFields.length;
      const totalWeight = Object.values(options.customWeights || {}).reduce((sum, weight) => sum + weight, 0) || 1.0;
      const balanceScore = 1 - (Math.abs(totalWeight - 1.0)); // How close to 1.0 total weight is

      return {
        eventId,
        weightingScheme: options.weightingScheme,
        fieldAnalysis,
        aggregatedImpact: {
          weightedAverage,
          dominantField,
          impactDistribution: {}, // Simplified
          confidenceScore: 0.8
        },
        weightValidation: {
          totalWeight,
          balanceScore,
          recommendedAdjustments: [] // Simplified
        }
      };

    } catch (error) {
      logger.error('Failed to apply field weighting', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async deriveAutomaticWeights(eventId: string, options: AutoWeightOptions): Promise<AutoWeightResult> {
    try {
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(event.eventDate);
      const beforeStart = new Date(eventDate);
      beforeStart.setDate(beforeStart.getDate() - options.beforePeriodDays);
      const afterEnd = new Date(eventDate);
      afterEnd.setDate(afterEnd.getDate() + options.afterPeriodDays);

      const derivationMetrics: DerivationMetrics[] = [];
      const rawWeights: { [fieldName: string]: number } = {};

      for (const fieldName of options.textFields) {
        const beforeData = await this.getSentimentData(eventId, beforeStart, eventDate, fieldName);
        const afterData = await this.getSentimentData(eventId, eventDate, afterEnd, fieldName);

        const beforeScores = beforeData.map(d => d.sentiment_score);
        const afterScores = afterData.map(d => d.sentiment_score);

        // Calculate metrics for weight derivation
        const beforeVariance = this.variance(beforeScores);
        const afterVariance = this.variance(afterScores);
        const varianceStability = 1 / (1 + Math.abs(afterVariance - beforeVariance)); // Higher = more stable

        const sampleSize = beforeScores.length + afterScores.length;
        
        const beforeMean = this.mean(beforeScores);
        const afterMean = this.mean(afterScores);
        const signal = Math.abs(afterMean - beforeMean);
        const noise = Math.sqrt((beforeVariance + afterVariance) / 2);
        const signalToNoiseRatio = noise > 0 ? signal / noise : 0;

        // Calculate composite score for weight recommendation
        const sampleSizeScore = Math.min(sampleSize / 200, 1); // Normalize to max of 200 samples
        const compositeScore = (varianceStability * 0.4) + (sampleSizeScore * 0.4) + (signalToNoiseRatio * 0.2);
        
        rawWeights[fieldName] = compositeScore;

        derivationMetrics.push({
          fieldName,
          varianceStability,
          sampleSize,
          signalToNoiseRatio,
          recommendedWeight: compositeScore, // Will be normalized later
          confidence: Math.min(compositeScore, 0.95)
        });
      }

      // Normalize weights to sum to 1.0
      const totalRawWeight = Object.values(rawWeights).reduce((sum, weight) => sum + weight, 0);
      const derivedWeights: { [fieldName: string]: number } = {};
      
      if (totalRawWeight > 0) {
        for (const fieldName of options.textFields) {
          derivedWeights[fieldName] = rawWeights[fieldName] / totalRawWeight;
        }
      } else {
        // Fallback to equal weights
        const equalWeight = 1 / options.textFields.length;
        for (const fieldName of options.textFields) {
          derivedWeights[fieldName] = equalWeight;
        }
      }

      // Update recommended weights in metrics
      derivationMetrics.forEach(metric => {
        metric.recommendedWeight = derivedWeights[metric.fieldName];
      });

      // Determine primary factor
      const avgVarianceStability = derivationMetrics.reduce((sum, m) => sum + m.varianceStability, 0) / derivationMetrics.length;
      const avgSampleSize = derivationMetrics.reduce((sum, m) => sum + m.sampleSize, 0) / derivationMetrics.length;
      const avgSignalToNoise = derivationMetrics.reduce((sum, m) => sum + m.signalToNoiseRatio, 0) / derivationMetrics.length;

      let primaryFactor = 'variance_stability';
      if (avgSampleSize > avgVarianceStability && avgSampleSize > avgSignalToNoise) {
        primaryFactor = 'sample_size';
      } else if (avgSignalToNoise > avgVarianceStability) {
        primaryFactor = 'signal_to_noise_ratio';
      }

      const overallConfidence = derivationMetrics.reduce((sum, m) => sum + (m.confidence || 0), 0) / derivationMetrics.length;

      return {
        eventId,
        derivedWeights,
        derivationMetrics,
        weightingRationale: {
          primaryFactor,
          secondaryFactors: options.derivationCriteria.filter(c => c !== primaryFactor),
          overallConfidence,
          recommendedUse: overallConfidence > 0.7 ? 'recommended' : 'use_with_caution'
        }
      };

    } catch (error) {
      logger.error('Failed to derive automatic weights', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  // Helper methods
  private async getSentimentData(eventId: string, startDate: Date, endDate: Date, textField?: string): Promise<any[]> {
    const fieldClause = textField ? `AND text_field = ?` : '';
    const params = [startDate.toISOString(), endDate.toISOString()];
    if (textField) params.push(textField);

    const sql = `
      SELECT sentiment_score, customer_id, created_at, text_field
      FROM sentiment_analysis 
      WHERE created_at BETWEEN ? AND ? ${fieldClause}
      AND deleted_at IS NULL
      ORDER BY created_at
    `;

    return await this.databaseService.query(sql, params);
  }

  private async getSentimentDataTimeSeries(eventId: string, startDate: Date, endDate: Date, textField: string): Promise<any[]> {
    const sql = `
      SELECT sentiment_score, customer_id, created_at, text_field
      FROM sentiment_analysis 
      WHERE created_at BETWEEN ? AND ? 
      AND text_field = ?
      AND deleted_at IS NULL
      ORDER BY created_at
    `;

    return await this.databaseService.query(sql, [startDate.toISOString(), endDate.toISOString(), textField]);
  }

  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private variance(values: number[]): number {
    const avg = this.mean(values);
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    return this.mean(squareDiffs);
  }

  private pooledStandardDeviation(group1: number[], group2: number[]): number {
    const n1 = group1.length;
    const n2 = group2.length;
    const var1 = this.variance(group1);
    const var2 = this.variance(group2);
    
    return Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  }

  private calculateCohenD(group1: number[], group2: number[]): number {
    const mean1 = this.mean(group1);
    const mean2 = this.mean(group2);
    const pooledStd = this.pooledStandardDeviation(group1, group2);
    return (mean1 - mean2) / pooledStd;
  }

  private calculateCorrelation(values1: number[], values2: number[], method: string): number {
    if (values1.length !== values2.length || values1.length === 0) return 0;

    if (method === 'pearson') {
      const mean1 = this.mean(values1);
      const mean2 = this.mean(values2);
      
      let numerator = 0;
      let sum1Sq = 0;
      let sum2Sq = 0;
      
      for (let i = 0; i < values1.length; i++) {
        const diff1 = values1[i] - mean1;
        const diff2 = values2[i] - mean2;
        numerator += diff1 * diff2;
        sum1Sq += diff1 * diff1;
        sum2Sq += diff2 * diff2;
      }
      
      const denominator = Math.sqrt(sum1Sq * sum2Sq);
      return denominator === 0 ? 0 : numerator / denominator;
    } else if (method === 'spearman') {
      // Spearman rank correlation
      const ranks1 = this.calculateRanks(values1);
      const ranks2 = this.calculateRanks(values2);
      return this.calculateCorrelation(ranks1, ranks2, 'pearson');
    } else if (method === 'kendall') {
      // Kendall's tau (simplified)
      let concordant = 0;
      let discordant = 0;
      
      for (let i = 0; i < values1.length; i++) {
        for (let j = i + 1; j < values1.length; j++) {
          const sign1 = Math.sign(values1[j] - values1[i]);
          const sign2 = Math.sign(values2[j] - values2[i]);
          
          if (sign1 * sign2 > 0) concordant++;
          else if (sign1 * sign2 < 0) discordant++;
        }
      }
      
      const total = concordant + discordant;
      return total === 0 ? 0 : (concordant - discordant) / total;
    }
    
    return 0;
  }

  private calculateRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    
    const ranks = new Array(values.length);
    let currentRank = 1;
    
    for (let i = 0; i < indexed.length; i++) {
      // Handle tied values by averaging ranks
      let j = i;
      while (j < indexed.length && indexed[j].value === indexed[i].value) {
        j++;
      }
      
      const avgRank = (currentRank + j - 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[indexed[k].index] = avgRank;
      }
      
      currentRank = j + 1;
      i = j - 1;
    }
    
    return ranks;
  }

  private calculateRecoveryTime(scores: number[], baseline: number): number {
    // Find when scores return to within 10% of baseline
    const threshold = baseline * 0.1;
    
    for (let i = 0; i < scores.length; i++) {
      if (Math.abs(scores[i] - baseline) <= threshold) {
        return i + 1;
      }
    }
    
    return scores.length; // Didn't recover within the period
  }

  private calculateConsistencyIndex(rankings: SensitivityRanking[]): number {
    // Calculate how consistent the rankings are across different metrics
    // Simplified implementation
    if (rankings.length < 2) return 1.0;
    
    const scoreVariances = rankings.map(r => {
      const metrics = [r.metrics.varianceChange, r.metrics.responseMagnitude, 1/r.metrics.recoveryTime];
      return this.variance(metrics);
    });
    
    const avgVariance = this.mean(scoreVariances);
    return Math.max(0, 1 - avgVariance); // Higher consistency = lower variance
  }

  // Temporal Analysis Methods
  async analyzeTemporalWindows(eventId: string, options: TemporalOptions): Promise<TemporalAnalysisResult> {
    try {
      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(options.eventDate);
      const preEventWindows: WindowAnalysis[] = [];
      const postEventWindows: WindowAnalysis[] = [];

      // Analyze pre-event windows
      for (const window of options.preEventWindows) {
        const windowStart = new Date(eventDate);
        windowStart.setDate(windowStart.getDate() - window.days);
        
        const windowAnalysis = await this.analyzeTimeWindow(
          eventId,
          windowStart.toISOString(),
          eventDate.toISOString(),
          options.textFields,
          window.name,
          window.days,
          'pre'
        );
        
        preEventWindows.push(windowAnalysis);
      }

      // Analyze post-event windows
      for (const window of options.postEventWindows) {
        const windowEnd = new Date(eventDate);
        windowEnd.setDate(windowEnd.getDate() + window.days);
        
        const windowAnalysis = await this.analyzeTimeWindow(
          eventId,
          eventDate.toISOString(),
          windowEnd.toISOString(),
          options.textFields,
          window.name,
          window.days,
          'post'
        );
        
        postEventWindows.push(windowAnalysis);
      }

      // Compare immediate windows
      const windowComparisons = [];
      if (preEventWindows.length > 0 && postEventWindows.length > 0) {
        const immediateComparison = this.compareWindows(
          preEventWindows[0], // immediate_pre
          postEventWindows[0], // immediate_post
          'immediate_pre_vs_immediate_post'
        );
        windowComparisons.push(immediateComparison);
      }

      // Calculate overall temporal trends
      const overallTemporal = this.calculateOverallTemporalTrends(preEventWindows, postEventWindows);

      logger.info('Temporal window analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        preWindowsAnalyzed: preEventWindows.length,
        postWindowsAnalyzed: postEventWindows.length
      });

      return {
        eventId,
        eventDate: options.eventDate,
        temporalAnalysis: {
          preEventWindows,
          postEventWindows
        },
        windowComparisons,
        overallTemporal
      };

    } catch (error) {
      logger.error('Failed to analyze temporal windows', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async analyzeSlidingWindows(eventId: string, options: SlidingWindowOptions): Promise<SlidingWindowResult> {
    try {
      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(options.eventDate);
      const totalDays = options.analysisRange.beforeDays + options.analysisRange.afterDays + 1;
      const totalWindows = Math.floor((totalDays - options.windowSize) / options.stepSize) + 1;
      
      const windows = [];
      let windowIndex = 0;

      // Generate sliding windows
      for (let dayOffset = -options.analysisRange.beforeDays; 
           dayOffset <= options.analysisRange.afterDays - options.windowSize + 1; 
           dayOffset += options.stepSize) {
        
        const windowStart = new Date(eventDate);
        windowStart.setDate(windowStart.getDate() + dayOffset);
        
        const windowEnd = new Date(windowStart);
        windowEnd.setDate(windowEnd.getDate() + options.windowSize - 1);

        const windowType = this.determineWindowType(dayOffset, options.windowSize);
        
        const fieldMetrics = [];
        for (const field of options.textFields) {
          const metrics = await this.calculateSlidingWindowMetrics(
            eventId,
            field,
            windowStart.toISOString(),
            windowEnd.toISOString(),
            options.trendDetection
          );
          fieldMetrics.push(metrics);
        }

        windows.push({
          windowIndex,
          dateRange: {
            start: windowStart.toISOString(),
            end: windowEnd.toISOString()
          },
          windowType,
          fieldMetrics
        });

        windowIndex++;
      }

      // Analyze trends
      const preEventWindows = windows.filter(w => w.windowType === 'pre_event');
      const postEventWindows = windows.filter(w => w.windowType === 'post_event');
      
      const trendAnalysis = this.analyzeSlidingTrends(preEventWindows, postEventWindows, eventDate);
      const anomalyDetection = this.detectSlidingAnomalies(windows, eventDate);

      logger.info('Sliding window analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        totalWindows: windows.length,
        windowSize: options.windowSize,
        stepSize: options.stepSize
      });

      return {
        eventId,
        eventDate: options.eventDate,
        slidingAnalysis: {
          windowSize: options.windowSize,
          stepSize: options.stepSize,
          totalWindows: windows.length,
          windows
        },
        trendAnalysis,
        anomalyDetection
      };

    } catch (error) {
      logger.error('Failed to analyze sliding windows', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async applyTemporalDecay(eventId: string, options: TemporalDecayOptions): Promise<TemporalDecayResult> {
    try {
      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(options.eventDate);
      
      // Get sentiment data for before and after periods
      const beforePeriod = [];
      const afterPeriod = [];
      const temporalWeights = [];

      for (const field of options.textFields) {
        // Before period analysis
        const beforeData = await this.getSentimentDataWithTimestamps(
          eventId,
          field,
          options.beforePeriodDays,
          true,
          eventDate
        );

        const beforeAnalysis = this.applyDecayWeighting(
          beforeData,
          eventDate,
          options.decayFunction,
          true
        );

        beforePeriod.push({
          fieldName: field,
          rawAverage: this.calculateRawAverage(beforeData),
          weightedAverage: beforeAnalysis.weightedAverage,
          weightDifference: beforeAnalysis.weightDifference,
          totalWeight: beforeAnalysis.totalWeight,
          dataPoints: beforeData.length
        });

        // Track temporal weights for this field
        temporalWeights.push(...beforeAnalysis.weights);

        // After period analysis
        const afterData = await this.getSentimentDataWithTimestamps(
          eventId,
          field,
          options.afterPeriodDays,
          false,
          eventDate
        );

        const afterAnalysis = this.applyDecayWeighting(
          afterData,
          eventDate,
          options.decayFunction,
          false
        );

        afterPeriod.push({
          fieldName: field,
          rawAverage: this.calculateRawAverage(afterData),
          weightedAverage: afterAnalysis.weightedAverage,
          weightDifference: afterAnalysis.weightDifference,
          totalWeight: afterAnalysis.totalWeight,
          dataPoints: afterData.length
        });

        temporalWeights.push(...afterAnalysis.weights);
      }

      // Calculate impact assessment
      const rawImpact = this.calculateRawImpact(beforePeriod, afterPeriod);
      const weightedImpact = this.calculateWeightedImpact(beforePeriod, afterPeriod);
      
      const impactAssessment = {
        rawImpact,
        weightedImpact,
        temporalSignificance: Math.abs(weightedImpact - rawImpact),
        decayAdjustedPValue: this.calculateDecayAdjustedPValue(weightedImpact, temporalWeights)
      };

      // Generate recommendations
      const recommendations = this.generateDecayRecommendations(
        options.decayFunction,
        impactAssessment,
        temporalWeights
      );

      logger.info('Temporal decay analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        decayType: options.decayFunction.type,
        halfLife: options.decayFunction.halfLife,
        fieldsAnalyzed: options.textFields.length
      });

      return {
        eventId,
        eventDate: options.eventDate,
        decayFunction: options.decayFunction,
        weightedAnalysis: {
          beforePeriod,
          afterPeriod
        },
        temporalWeights,
        impactAssessment,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to apply temporal decay', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async handleIrregularTemporal(eventId: string, options: IrregularTemporalOptions): Promise<IrregularTemporalResult> {
    try {
      // Get business event
      const event = await this.businessEventService.getEventById(eventId);
      if (!event) {
        throw new Error(`Business event not found: ${eventId}`);
      }

      const eventDate = new Date(options.eventDate);

      // Analyze data quality for before and after periods
      const beforePeriodAnalysis = await this.analyzeDataQuality(
        eventId,
        options.textFields[0], // Use first field for gap analysis
        options.beforePeriodDays,
        true,
        eventDate,
        options.dataQualityThresholds
      );

      const afterPeriodAnalysis = await this.analyzeDataQuality(
        eventId,
        options.textFields[0],
        options.afterPeriodDays,
        false,
        eventDate,
        options.dataQualityThresholds
      );

      // Interpolate missing data
      const beforeInterpolated = await this.interpolateMissingData(
        beforePeriodAnalysis.rawData,
        options.interpolation,
        'before'
      );

      const afterInterpolated = await this.interpolateMissingData(
        afterPeriodAnalysis.rawData,
        options.interpolation,
        'after'
      );

      // Calculate adjusted analysis with confidence intervals
      const adjustedAnalysis = this.calculateConfidenceAdjustedAnalysis(
        beforeInterpolated,
        afterInterpolated,
        beforePeriodAnalysis.qualityScore,
        afterPeriodAnalysis.qualityScore
      );

      // Calculate interpolation metrics
      const interpolationMetrics = this.calculateInterpolationMetrics(
        beforeInterpolated,
        afterInterpolated,
        options.interpolation
      );

      logger.info('Irregular temporal analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        beforeCoverage: beforePeriodAnalysis.coverage,
        afterCoverage: afterPeriodAnalysis.coverage,
        interpolatedPoints: interpolationMetrics.interpolatedPoints
      });

      return {
        eventId,
        eventDate: options.eventDate,
        dataQualityAnalysis: {
          beforePeriod: beforePeriodAnalysis,
          afterPeriod: afterPeriodAnalysis
        },
        interpolatedData: {
          beforePeriod: beforeInterpolated,
          afterPeriod: afterInterpolated
        },
        adjustedAnalysis,
        interpolationMetrics
      };

    } catch (error) {
      logger.error('Failed to handle irregular temporal data', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  // REFACTOR: Advanced Temporal Analysis Methods
  async analyzeTemporalPatternsAdvanced(eventId: string, options: TemporalOptions & {
    patternDetection: {
      seasonality: boolean;
      cyclical: boolean;
      changePoints: boolean;
      outlierDetection: boolean;
    };
    clustering: {
      enabled: boolean;
      method: 'kmeans' | 'hierarchical' | 'dbscan';
      numClusters?: number;
    };
  }): Promise<TemporalAnalysisResult & {
    patterns: {
      seasonalComponents: any[];
      changePoints: Array<{ date: string; magnitude: number; confidence: number }>;
      clusters: Array<{ id: string; members: string[]; centroid: any }>;
      outliers: Array<{ date: string; field: string; score: number; reason: string }>;
    };
    forecast: {
      nextPeriodPrediction: Array<{ field: string; predictedValue: number; confidence: number }>;
      recoveryTimeEstimate: number;
      uncertainty: number;
    };
  }> {
    try {
      // Get base temporal analysis
      const baseResult = await this.analyzeTemporalWindows(eventId, options);
      
      // Perform pattern detection
      const patterns = await this.detectTemporalPatterns(eventId, options);
      
      // Perform temporal clustering if enabled
      const clusters = options.clustering.enabled 
        ? await this.performTemporalClustering(eventId, options)
        : [];
      
      // Generate forecasts
      const forecast = await this.generateTemporalForecast(eventId, options, baseResult);
      
      logger.info('Advanced temporal pattern analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        patternsDetected: patterns.changePoints.length,
        clustersFound: clusters.length,
        forecastConfidence: forecast.uncertainty
      });

      return {
        ...baseResult,
        patterns: {
          seasonalComponents: patterns.seasonalComponents,
          changePoints: patterns.changePoints,
          clusters,
          outliers: patterns.outliers
        },
        forecast
      };

    } catch (error) {
      logger.error('Failed to perform advanced temporal pattern analysis', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async analyzeAdaptiveSlidingWindows(eventId: string, options: SlidingWindowOptions): Promise<SlidingWindowResult & {
    adaptiveMetrics: {
      optimalWindowSizes: { [field: string]: number };
      windowEfficiencyScores: number[];
      adaptationEvents: Array<{ windowIndex: number; reason: string; newSize: number }>;
    };
    temporalClusters: Array<{
      id: string;
      timeRange: { start: string; end: string };
      avgSentiment: number;
      volatility: number;
      members: string[];
    }>;
    changePointAnalysis: {
      detectedChangePoints: Array<{
        windowIndex: number;
        date: string;
        magnitude: number;
        confidence: number;
        type: 'trend_change' | 'variance_change' | 'level_change';
      }>;
      eventChangePointScore: number;
    };
  }> {
    try {
      // Get base sliding window analysis
      const baseResult = await this.analyzeSlidingWindows(eventId, options);
      
      // Perform adaptive window sizing if enabled
      const adaptiveMetrics = options.advancedFeatures?.adaptiveWindowSizing 
        ? await this.optimizeWindowSizes(eventId, options, baseResult)
        : { optimalWindowSizes: {}, windowEfficiencyScores: [], adaptationEvents: [] };
      
      // Perform temporal clustering if enabled
      const temporalClusters = options.advancedFeatures?.temporalClustering
        ? await this.clusterTemporalWindows(baseResult.slidingAnalysis.windows)
        : [];
      
      // Detect change points if enabled
      const changePointAnalysis = options.advancedFeatures?.changePointDetection
        ? await this.detectChangePoints(baseResult.slidingAnalysis.windows, new Date(options.eventDate))
        : { detectedChangePoints: [], eventChangePointScore: 0 };

      logger.info('Adaptive sliding window analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        adaptiveWindowsUsed: adaptiveMetrics.adaptationEvents.length,
        clustersFound: temporalClusters.length,
        changePointsDetected: changePointAnalysis.detectedChangePoints.length
      });

      return {
        ...baseResult,
        adaptiveMetrics,
        temporalClusters,
        changePointAnalysis
      };

    } catch (error) {
      logger.error('Failed to perform adaptive sliding window analysis', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  async applyAdvancedTemporalDecay(eventId: string, options: TemporalDecayOptions): Promise<TemporalDecayResult & {
    adaptiveDecayMetrics: {
      optimalDecayFunction: string;
      decayParameterEvolution: Array<{ time: string; parameters: any }>;
      adaptationTriggers: string[];
    };
    temporalClusters: Array<{
      clusterId: string;
      timeRange: { start: string; end: string };
      decayProfile: string;
      weightDistribution: number[];
      significance: number;
    }>;
    uncertaintyQuantification: {
      weightUncertainty: number[];
      impactConfidenceInterval: { lower: number; upper: number };
      robustnessScore: number;
    };
  }> {
    try {
      // Get base decay analysis
      const baseResult = await this.applyTemporalDecay(eventId, options);
      
      // Apply adaptive decay if enabled
      const adaptiveDecayMetrics = options.adaptiveDecay
        ? await this.optimizeDecayFunction(eventId, options, baseResult)
        : { optimalDecayFunction: options.decayFunction.type, decayParameterEvolution: [], adaptationTriggers: [] };
      
      // Perform temporal clustering if enabled
      const temporalClusters = options.temporalClustering?.enabled
        ? await this.clusterTemporalDecayRegions(baseResult, options)
        : [];
      
      // Quantify uncertainty
      const uncertaintyQuantification = await this.quantifyDecayUncertainty(baseResult, options);

      logger.info('Advanced temporal decay analysis completed', {
        component: 'multi-field-analysis',
        eventId,
        optimalDecayFunction: adaptiveDecayMetrics.optimalDecayFunction,
        temporalClustersFound: temporalClusters.length,
        uncertaintyScore: uncertaintyQuantification.robustnessScore
      });

      return {
        ...baseResult,
        adaptiveDecayMetrics,
        temporalClusters,
        uncertaintyQuantification
      };

    } catch (error) {
      logger.error('Failed to perform advanced temporal decay analysis', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  // Advanced weighting methods for REFACTOR phase
  async applyDynamicFieldWeighting(eventId: string, options: FieldAnalysisOptions & { 
    adaptiveStrategy: 'variance_based' | 'volume_based' | 'signal_strength' | 'temporal_stability';
    weightingWindow: number;
  }): Promise<CorrelationAnalysisResult & { dynamicWeights: { [fieldName: string]: number } }> {
    const baseResult = await this.analyzeFieldCorrelations(eventId, options);
    
    // Calculate dynamic weights based on strategy
    const dynamicWeights: { [fieldName: string]: number } = {};
    
    for (const impact of baseResult.fieldImpacts) {
      let weight = 1.0;
      
      switch (options.adaptiveStrategy) {
        case 'variance_based':
          // Weight inversely proportional to variance (more stable = higher weight)
          weight = 1 / (1 + Math.abs(impact.effectSize) * 0.1);
          break;
          
        case 'volume_based':
          // Weight based on data volume (simplified)
          weight = Math.min(1.0, 0.1 + (impact.significance ? 0.5 : 0.2));
          break;
          
        case 'signal_strength':
          // Weight based on effect size magnitude
          weight = Math.min(1.0, Math.abs(impact.effectSize) / 2);
          break;
          
        case 'temporal_stability':
          // Weight based on consistency over time (simplified)
          weight = impact.significance ? 0.8 : 0.3;
          break;
      }
      
      dynamicWeights[impact.fieldName] = weight;
    }
    
    // Normalize weights
    const totalWeight = Object.values(dynamicWeights).reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      for (const fieldName in dynamicWeights) {
        dynamicWeights[fieldName] /= totalWeight;
      }
    }

    logger.info('Dynamic field weighting applied', {
      component: 'multi-field-analysis',
      eventId,
      strategy: options.adaptiveStrategy,
      weightsCalculated: Object.keys(dynamicWeights).length
    });

    return {
      ...baseResult,
      dynamicWeights
    };
  }

  async optimizeFieldWeighting(eventId: string, options: FieldAnalysisOptions & {
    optimizationObjective: 'maximize_correlation' | 'minimize_noise' | 'balance_fields';
    iterationLimit: number;
  }): Promise<{
    eventId: string;
    optimizedWeights: { [fieldName: string]: number };
    optimizationResults: {
      initialScore: number;
      finalScore: number;
      iterations: number;
      convergence: boolean;
    };
    fieldPerformance: Array<{
      fieldName: string;
      initialWeight: number;
      optimizedWeight: number;
      improvementScore: number;
    }>;
  }> {
    try {
      const baseResult = await this.analyzeFieldCorrelations(eventId, options);
      
      // Initialize weights equally
      const initialWeights: { [fieldName: string]: number } = {};
      const numFields = baseResult.fieldImpacts.length;
      baseResult.fieldImpacts.forEach(impact => {
        initialWeights[impact.fieldName] = 1 / numFields;
      });

      let currentWeights = { ...initialWeights };
      let bestWeights = { ...initialWeights };
      let bestScore = this.calculateObjectiveScore(baseResult, currentWeights, options.optimizationObjective);
      let iterations = 0;
      let converged = false;

      // Simple gradient descent-like optimization
      while (iterations < options.iterationLimit && !converged) {
        const perturbedWeights = this.perturbWeights(currentWeights, 0.1);
        const perturbedScore = this.calculateObjectiveScore(baseResult, perturbedWeights, options.optimizationObjective);
        
        if (perturbedScore > bestScore) {
          bestScore = perturbedScore;
          bestWeights = { ...perturbedWeights };
          currentWeights = { ...perturbedWeights };
        } else {
          // Check for convergence
          const weightDifference = this.calculateWeightDifference(currentWeights, bestWeights);
          if (weightDifference < 0.001) {
            converged = true;
          }
        }
        
        iterations++;
      }

      // Calculate field performance improvements
      const fieldPerformance = baseResult.fieldImpacts.map(impact => ({
        fieldName: impact.fieldName,
        initialWeight: initialWeights[impact.fieldName],
        optimizedWeight: bestWeights[impact.fieldName],
        improvementScore: bestWeights[impact.fieldName] - initialWeights[impact.fieldName]
      }));

      logger.info('Field weighting optimization completed', {
        component: 'multi-field-analysis',
        eventId,
        objective: options.optimizationObjective,
        iterations,
        converged,
        initialScore: this.calculateObjectiveScore(baseResult, initialWeights, options.optimizationObjective),
        finalScore: bestScore
      });

      return {
        eventId,
        optimizedWeights: bestWeights,
        optimizationResults: {
          initialScore: this.calculateObjectiveScore(baseResult, initialWeights, options.optimizationObjective),
          finalScore: bestScore,
          iterations,
          convergence: converged
        },
        fieldPerformance
      };

    } catch (error) {
      logger.error('Failed to optimize field weighting', {
        component: 'multi-field-analysis',
        eventId,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private calculateObjectiveScore(
    analysisResult: CorrelationAnalysisResult, 
    weights: { [fieldName: string]: number }, 
    objective: string
  ): number {
    switch (objective) {
      case 'maximize_correlation':
        // Score based on weighted correlation strength
        const correlationValues = Object.values(analysisResult.correlationMatrix);
        const avgCorrelation = correlationValues.length > 0 
          ? correlationValues.reduce((sum, corr) => sum + Math.abs(corr), 0) / correlationValues.length
          : 0;
        return avgCorrelation;

      case 'minimize_noise':
        // Score based on consistency and significance
        const significantFields = analysisResult.fieldImpacts.filter(f => f.significance);
        const weightedSignificance = significantFields.reduce((sum, field) => 
          sum + (weights[field.fieldName] || 0) * Math.abs(field.effectSize), 0);
        return weightedSignificance;

      case 'balance_fields':
        // Score based on weight distribution balance
        const weightValues = Object.values(weights);
        const weightVariance = this.variance(weightValues);
        return 1 / (1 + weightVariance); // Lower variance = higher score

      default:
        return 0;
    }
  }

  private perturbWeights(weights: { [fieldName: string]: number }, perturbationSize: number): { [fieldName: string]: number } {
    const perturbed: { [fieldName: string]: number } = {};
    const fieldNames = Object.keys(weights);
    
    for (const fieldName of fieldNames) {
      // Add random perturbation
      const perturbation = (Math.random() - 0.5) * 2 * perturbationSize;
      perturbed[fieldName] = Math.max(0.01, weights[fieldName] + perturbation);
    }
    
    // Normalize to sum to 1
    const total = Object.values(perturbed).reduce((sum, weight) => sum + weight, 0);
    for (const fieldName of fieldNames) {
      perturbed[fieldName] /= total;
    }
    
    return perturbed;
  }

  private calculateWeightDifference(weights1: { [fieldName: string]: number }, weights2: { [fieldName: string]: number }): number {
    let totalDifference = 0;
    const fieldNames = Object.keys(weights1);
    
    for (const fieldName of fieldNames) {
      totalDifference += Math.abs((weights1[fieldName] || 0) - (weights2[fieldName] || 0));
    }
    
    return totalDifference / fieldNames.length;
  }

  // Helper methods for temporal analysis
  private async analyzeTimeWindow(
    eventId: string,
    startDate: string,
    endDate: string,
    textFields: string[],
    windowName: string,
    days: number,
    type: 'pre' | 'post'
  ): Promise<WindowAnalysis> {
    const fieldAnalysis = [];
    
    for (const field of textFields) {
      // Get sentiment data for this field in the time window
      const sql = `
        SELECT sentiment_score, created_at 
        FROM sentiment_analysis 
        WHERE text_field = ? 
        AND created_at >= ? 
        AND created_at <= ?
        ORDER BY created_at
      `;
      
      const sentimentData = await this.databaseService.query(sql, [field, startDate, endDate]);
      const scores = sentimentData.map((row: any) => row.sentiment_score);
      
      if (scores.length === 0) {
        fieldAnalysis.push({
          fieldName: field,
          averageSentiment: 0,
          sentimentTrend: 'stable' as const,
          dataPoints: 0,
          trendSlope: 0
        });
        continue;
      }

      const averageSentiment = this.mean(scores);
      const trendSlope = this.calculateTrendSlope(scores);
      const sentimentTrend = this.determineTrend(trendSlope);
      
      const fieldResult: any = {
        fieldName: field,
        averageSentiment,
        sentimentTrend,
        dataPoints: scores.length,
        trendSlope
      };

      // Add recovery metrics for post-event windows
      if (type === 'post' && scores.length > 1) {
        const initialScore = scores[0];
        const finalScore = scores[scores.length - 1];
        const recoveryRate = (finalScore - initialScore) / days;
        
        fieldResult.recoveryMetrics = {
          initialDrop: initialScore - averageSentiment,
          recoveryRate,
          daysToRecovery: this.calculateRecoveryTime(scores, averageSentiment)
        };
      }

      fieldAnalysis.push(fieldResult);
    }

    return {
      windowName,
      days,
      dateRange: {
        start: startDate,
        end: endDate
      },
      fieldAnalysis
    };
  }

  private compareWindows(
    preWindow: WindowAnalysis,
    postWindow: WindowAnalysis,
    comparisonName: string
  ): any {
    const fields = [];
    let totalImpact = 0;
    let significantFields = 0;

    for (const preField of preWindow.fieldAnalysis) {
      const postField = postWindow.fieldAnalysis.find(f => f.fieldName === preField.fieldName);
      if (!postField) continue;

      const impactMagnitude = postField.averageSentiment - preField.averageSentiment;
      totalImpact += Math.abs(impactMagnitude);
      
      if (Math.abs(impactMagnitude) > 0.3) { // Threshold for significance
        significantFields++;
      }

      fields.push({
        fieldName: preField.fieldName,
        preAverage: preField.averageSentiment,
        postAverage: postField.averageSentiment,
        impactMagnitude
      });
    }

    const effectSize = fields.length > 0 ? totalImpact / fields.length : 0;
    const statisticalSignificance = significantFields > 0;

    return {
      comparison: comparisonName,
      fields,
      statisticalSignificance,
      effectSize,
      impactMagnitude: totalImpact
    };
  }

  private calculateOverallTemporalTrends(
    preEventWindows: WindowAnalysis[],
    postEventWindows: WindowAnalysis[]
  ): any {
    // Calculate pre-event trend
    const preSlopes = preEventWindows.flatMap(w => 
      w.fieldAnalysis.map(f => f.trendSlope)
    );
    const avgPreSlope = preSlopes.length > 0 ? this.mean(preSlopes) : 0;
    const preEventTrend = this.determineTrend(avgPreSlope);

    // Calculate post-event trend  
    const postSlopes = postEventWindows.flatMap(w => 
      w.fieldAnalysis.map(f => f.trendSlope)
    );
    const avgPostSlope = postSlopes.length > 0 ? this.mean(postSlopes) : 0;
    const postEventTrend = this.determineTrend(avgPostSlope);

    // Calculate impact magnitude
    const eventImpactMagnitude = Math.abs(avgPostSlope - avgPreSlope);
    
    // Estimate recovery time (simplified)
    const recoveryTimeEstimate = postEventTrend === 'improving' ? 7 : 14;
    
    // Calculate temporal consistency
    const allSlopes = [...preSlopes, ...postSlopes];
    const slopeVariance = allSlopes.length > 0 ? this.variance(allSlopes) : 0;
    const temporalConsistency = Math.max(0, 1 - slopeVariance);

    return {
      preEventTrend,
      postEventTrend,
      eventImpactMagnitude,
      recoveryTimeEstimate,
      temporalConsistency
    };
  }

  private calculateTrendSlope(scores: number[]): number {
    if (scores.length < 2) return 0;
    
    // Simple linear regression slope
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = scores;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  private determineTrend(slope: number): 'declining' | 'stable' | 'improving' {
    const threshold = 0.01; // More sensitive threshold
    if (slope > threshold) return 'improving';
    if (slope < -threshold) return 'declining';
    return 'stable';
  }

  private determineWindowType(dayOffset: number, windowSize: number): 'pre_event' | 'event_window' | 'post_event' {
    if (dayOffset + windowSize <= 0) return 'pre_event';
    if (dayOffset >= 1) return 'post_event';
    return 'event_window';
  }

  private async calculateSlidingWindowMetrics(
    eventId: string,
    field: string,
    startDate: string,
    endDate: string,
    trendDetection: any
  ): Promise<any> {
    // Get sentiment data for this window
    const sql = `
      SELECT sentiment_score, created_at 
      FROM sentiment_analysis 
      WHERE text_field = ? 
      AND created_at >= ? 
      AND created_at <= ?
      ORDER BY created_at
    `;
    
    const sentimentData = await this.databaseService.query(sql, [field, startDate, endDate]);
    const scores = sentimentData.map((row: any) => row.sentiment_score);
    
    if (scores.length === 0) {
      return {
        fieldName: field,
        averageSentiment: 0,
        trendSlope: 0,
        rSquared: 0,
        dataPoints: 0
      };
    }

    const averageSentiment = this.mean(scores);
    const trendSlope = this.calculateTrendSlope(scores);
    const rSquared = this.calculateRSquared(scores, trendSlope);

    return {
      fieldName: field,
      averageSentiment,
      trendSlope,
      rSquared,
      dataPoints: scores.length
    };
  }

  private calculateRSquared(scores: number[], slope: number): number {
    if (scores.length < 2) return 0;
    
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const yMean = this.mean(scores);
    
    // Calculate predicted values
    const intercept = yMean - slope * this.mean(x);
    const predicted = x.map(xi => intercept + slope * xi);
    
    // Calculate R-squared
    const totalSumSquares = scores.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = scores.reduce((acc, yi, i) => acc + Math.pow(yi - predicted[i], 2), 0);
    
    if (totalSumSquares === 0) return 1;
    return Math.max(0, 1 - (residualSumSquares / totalSumSquares));
  }

  private analyzeSlidingTrends(preEventWindows: any[], postEventWindows: any[], eventDate: Date): any {
    // Analyze pre-event trends
    const preSlopes = preEventWindows.flatMap(w => 
      w.fieldMetrics.map((f: any) => f.trendSlope)
    );
    const preRSquared = preEventWindows.flatMap(w => 
      w.fieldMetrics.map((f: any) => f.rSquared)
    );
    
    const preOverallSlope = preSlopes.length > 0 ? this.mean(preSlopes) : 0;
    const preOverallRSquared = preRSquared.length > 0 ? this.mean(preRSquared) : 0;
    
    // Analyze post-event trends
    const postSlopes = postEventWindows.flatMap(w => 
      w.fieldMetrics.map((f: any) => f.trendSlope)
    );
    const postRSquared = postEventWindows.flatMap(w => 
      w.fieldMetrics.map((f: any) => f.rSquared)
    );
    
    const postOverallSlope = postSlopes.length > 0 ? this.mean(postSlopes) : 0;
    const postOverallRSquared = postRSquared.length > 0 ? this.mean(postRSquared) : 0;

    // Calculate event impact
    const immediateChange = postOverallSlope - preOverallSlope;
    const recoveryDetected = postOverallSlope > 0 && preOverallSlope < 0;

    return {
      preEventTrend: {
        overallSlope: preOverallSlope,
        rSquared: preOverallRSquared,
        isSignificant: preOverallRSquared > 0.05,
        trendDirection: this.determineTrend(preOverallSlope)
      },
      postEventTrend: {
        overallSlope: postOverallSlope,
        rSquared: postOverallRSquared,
        isSignificant: postOverallRSquared > 0.05,
        trendDirection: this.determineTrend(postOverallSlope)
      },
      eventImpact: {
        immediateChange,
        trendChangePoint: eventDate.toISOString(),
        recoveryDetected
      }
    };
  }

  private detectSlidingAnomalies(windows: any[], eventDate: Date): any {
    // Calculate baseline metrics
    const allAverages = windows.flatMap(w => 
      w.fieldMetrics.map((f: any) => f.averageSentiment)
    );
    
    const baseline = this.mean(allAverages);
    const baselineStd = Math.sqrt(this.variance(allAverages));
    const threshold = 2 * baselineStd; // 2 standard deviations
    
    // Detect anomalous windows
    const anomalousWindows: number[] = [];
    let eventAnomalyScore = 0;
    
    windows.forEach((window, index) => {
      const windowAverage = this.mean(window.fieldMetrics.map((f: any) => f.averageSentiment));
      const deviation = Math.abs(windowAverage - baseline);
      
      if (deviation > threshold) {
        anomalousWindows.push(index);
      }
      
      // Check if this window contains the event
      const windowStart = new Date(window.dateRange.start);
      const windowEnd = new Date(window.dateRange.end);
      if (eventDate >= windowStart && eventDate <= windowEnd) {
        eventAnomalyScore = deviation / baselineStd;
      }
    });

    return {
      anomalousWindows,
      eventAnomalyScore,
      baselineVariation: baselineStd
    };
  }

  private async getSentimentDataWithTimestamps(
    eventId: string,
    field: string,
    periodDays: number,
    isBefore: boolean,
    eventDate: Date
  ): Promise<Array<{ score: number; timestamp: string; daysFromEvent: number }>> {
    const startDate = new Date(eventDate);
    const endDate = new Date(eventDate);
    
    if (isBefore) {
      startDate.setDate(startDate.getDate() - periodDays);
    } else {
      endDate.setDate(endDate.getDate() + periodDays);
    }

    const sql = `
      SELECT sentiment_score, created_at 
      FROM sentiment_analysis 
      WHERE text_field = ? 
      AND created_at >= ? 
      AND created_at <= ?
      ORDER BY created_at
    `;
    
    const sentimentData = await this.databaseService.query(sql, [
      field, 
      isBefore ? startDate.toISOString() : eventDate.toISOString(),
      isBefore ? eventDate.toISOString() : endDate.toISOString()
    ]);
    
    return sentimentData.map((row: any) => {
      const timestamp = new Date(row.created_at);
      const daysDiff = Math.abs((timestamp.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        score: row.sentiment_score,
        timestamp: row.created_at,
        daysFromEvent: daysDiff
      };
    });
  }

  private applyDecayWeighting(
    data: Array<{ score: number; timestamp: string; daysFromEvent: number }>,
    eventDate: Date,
    decayFunction: any,
    isBefore: boolean
  ): any {
    let totalWeight = 0;
    let weightedSum = 0;
    const weights = [];

    for (const point of data) {
      const weight = this.calculateDecayWeight(point.daysFromEvent, decayFunction);
      totalWeight += weight;
      weightedSum += point.score * weight;
      
      weights.push({
        dataPoint: point.timestamp,
        daysFromEvent: point.daysFromEvent,
        weight,
        contribution: point.score * weight
      });
    }

    const rawAverage = data.length > 0 ? this.mean(data.map(d => d.score)) : 0;
    const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const weightDifference = weightedAverage - rawAverage;

    return {
      weightedAverage,
      weightDifference,
      totalWeight,
      weights
    };
  }

  private calculateDecayWeight(daysFromEvent: number, decayFunction: any): number {
    const { type, halfLife, maxWeight, minWeight, polynomialDegree = 2, gaussianSigma = halfLife / 2 } = decayFunction;
    
    switch (type) {
      case 'exponential':
        const decayConstant = Math.log(2) / halfLife;
        const weight = maxWeight * Math.exp(-decayConstant * daysFromEvent);
        return Math.max(minWeight, weight);
        
      case 'linear':
        const linearWeight = maxWeight - (maxWeight - minWeight) * (daysFromEvent / halfLife);
        return Math.max(minWeight, Math.min(maxWeight, linearWeight));
        
      case 'polynomial':
        // Polynomial decay: weight = max * (1 - (days/halfLife)^degree)
        const normalizedDays = Math.min(daysFromEvent / halfLife, 1);
        const polyWeight = maxWeight * (1 - Math.pow(normalizedDays, polynomialDegree));
        return Math.max(minWeight, polyWeight);
        
      case 'gaussian':
        // Gaussian decay centered at event
        const gaussianWeight = maxWeight * Math.exp(-0.5 * Math.pow(daysFromEvent / gaussianSigma, 2));
        return Math.max(minWeight, gaussianWeight);
        
      case 'custom':
        // Custom function evaluation (simplified - in real implementation would parse function string)
        // For demo, use a combination of exponential and polynomial
        const customWeight = maxWeight * Math.exp(-daysFromEvent / halfLife) * Math.pow(0.9, daysFromEvent);
        return Math.max(minWeight, customWeight);
        
      default:
        return 1.0; // Default uniform weight
    }
  }

  private calculateRawAverage(data: Array<{ score: number }>): number {
    return data.length > 0 ? this.mean(data.map(d => d.score)) : 0;
  }

  private calculateRawImpact(beforePeriod: any[], afterPeriod: any[]): number {
    const beforeAvg = beforePeriod.length > 0 ? this.mean(beforePeriod.map(f => f.rawAverage)) : 0;
    const afterAvg = afterPeriod.length > 0 ? this.mean(afterPeriod.map(f => f.rawAverage)) : 0;
    return afterAvg - beforeAvg;
  }

  private calculateWeightedImpact(beforePeriod: any[], afterPeriod: any[]): number {
    const beforeAvg = beforePeriod.length > 0 ? this.mean(beforePeriod.map(f => f.weightedAverage)) : 0;
    const afterAvg = afterPeriod.length > 0 ? this.mean(afterPeriod.map(f => f.weightedAverage)) : 0;
    return afterAvg - beforeAvg;
  }

  private calculateDecayAdjustedPValue(weightedImpact: number, temporalWeights: any[]): number {
    // Simplified p-value calculation based on weighted impact
    const totalContribution = temporalWeights.reduce((sum, w) => sum + Math.abs(w.contribution), 0);
    const avgContribution = totalContribution / Math.max(temporalWeights.length, 1);
    
    // Convert to rough p-value (simplified for demo)
    const zScore = Math.abs(weightedImpact) / Math.max(avgContribution, 0.1);
    return Math.max(0.001, 1 - (zScore / 5)); // Rough approximation
  }

  private generateDecayRecommendations(
    decayFunction: any,
    impactAssessment: any,
    temporalWeights: any[]
  ): any {
    const { type, halfLife } = decayFunction;
    
    // Analyze weight distribution to suggest optimal function
    const weightValues = temporalWeights.map(w => w.weight);
    const weightVariance = this.variance(weightValues);
    
    let optimalDecayFunction = type;
    let suggestedHalfLife = halfLife;
    
    if (weightVariance > 0.1) {
      optimalDecayFunction = 'exponential'; // High variance suggests exponential is better
    } else {
      optimalDecayFunction = 'linear'; // Low variance suggests linear is sufficient
    }
    
    // Suggest half-life based on temporal distribution
    const maxDays = Math.max(...temporalWeights.map(w => w.daysFromEvent));
    suggestedHalfLife = Math.max(3, Math.min(14, Math.round(maxDays * 0.4)));
    
    // Data quality score
    const dataQualityScore = Math.min(1.0, temporalWeights.length / 10); // More data = higher quality
    
    return {
      optimalDecayFunction,
      suggestedHalfLife,
      dataQualityScore
    };
  }

  private async analyzeDataQuality(
    eventId: string,
    field: string,
    periodDays: number,
    isBefore: boolean,
    eventDate: Date,
    thresholds: any
  ): Promise<any> {
    const data = await this.getSentimentDataWithTimestamps(eventId, field, periodDays, isBefore, eventDate);
    
    // Group data by day
    const dataByDay = new Map<string, number[]>();
    for (const point of data) {
      const day = point.timestamp.split('T')[0];
      if (!dataByDay.has(day)) {
        dataByDay.set(day, []);
      }
      dataByDay.get(day)!.push(point.score);
    }
    
    // Calculate coverage and gaps
    const totalDays = periodDays;
    const daysWithData = dataByDay.size;
    const coverage = daysWithData / totalDays;
    
    // Find gaps
    const gaps = this.findDataGaps(dataByDay, periodDays, eventDate, isBefore);
    
    // Calculate quality score
    const qualityScore = Math.min(1.0, 
      (coverage * 0.6) + 
      ((daysWithData / Math.max(totalDays, 1)) * 0.4)
    );
    
    return {
      totalDays,
      daysWithData,
      coverage,
      gaps,
      qualityScore,
      rawData: data
    };
  }

  private findDataGaps(
    dataByDay: Map<string, number[]>,
    periodDays: number,
    eventDate: Date,
    isBefore: boolean
  ): Array<{ start: string; end: string; duration: number }> {
    const gaps = [];
    let currentGapStart: string | null = null;
    
    for (let i = 0; i < periodDays; i++) {
      const checkDate = new Date(eventDate);
      if (isBefore) {
        checkDate.setDate(checkDate.getDate() - periodDays + i);
      } else {
        checkDate.setDate(checkDate.getDate() + i);
      }
      
      const dayStr = checkDate.toISOString().split('T')[0];
      const hasData = dataByDay.has(dayStr);
      
      if (!hasData && currentGapStart === null) {
        currentGapStart = dayStr;
      } else if (hasData && currentGapStart !== null) {
        const gapEndDate = new Date(checkDate);
        gapEndDate.setDate(gapEndDate.getDate() - 1);
        
        gaps.push({
          start: currentGapStart,
          end: gapEndDate.toISOString().split('T')[0],
          duration: Math.floor((gapEndDate.getTime() - new Date(currentGapStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
        });
        
        currentGapStart = null;
      }
    }
    
    return gaps;
  }

  private async interpolateMissingData(
    data: Array<{ score: number; timestamp: string; daysFromEvent: number }>,
    interpolation: any,
    period: string
  ): Promise<Array<{ date: string; originalValue: number; interpolatedValue: number; isInterpolated: boolean; confidence: number }>> {
    // Sort data by timestamp
    const sortedData = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (sortedData.length === 0) return [];
    
    const result = [];
    
    // Simple linear interpolation implementation
    for (let i = 0; i < sortedData.length; i++) {
      const current = sortedData[i];
      result.push({
        date: current.timestamp.split('T')[0],
        originalValue: current.score,
        interpolatedValue: current.score,
        isInterpolated: false,
        confidence: 1.0
      });
      
      // Check for gaps between this point and next
      if (i < sortedData.length - 1) {
        const next = sortedData[i + 1];
        const currentDate = new Date(current.timestamp);
        const nextDate = new Date(next.timestamp);
        const daysDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Interpolate missing days (up to maxGapDays)
        if (daysDiff > 1 && daysDiff <= interpolation.maxGapDays) {
          for (let d = 1; d < daysDiff; d++) {
            const interpolatedDate = new Date(currentDate);
            interpolatedDate.setDate(interpolatedDate.getDate() + d);
            
            // Linear interpolation
            const ratio = d / daysDiff;
            const interpolatedValue = current.score + (next.score - current.score) * ratio;
            const confidence = Math.max(0.3, 1 - (daysDiff / interpolation.maxGapDays));
            
            result.push({
              date: interpolatedDate.toISOString().split('T')[0],
              originalValue: 0, // No original value
              interpolatedValue,
              isInterpolated: true,
              confidence
            });
          }
        }
      }
    }
    
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateConfidenceAdjustedAnalysis(
    beforeData: Array<{ interpolatedValue: number; confidence: number; isInterpolated: boolean }>,
    afterData: Array<{ interpolatedValue: number; confidence: number; isInterpolated: boolean }>,
    beforeQuality: number,
    afterQuality: number
  ): any {
    // Calculate weighted averages based on confidence
    const beforeValues = beforeData.map(d => d.interpolatedValue * d.confidence);
    const beforeWeights = beforeData.map(d => d.confidence);
    const beforeAverage = beforeWeights.reduce((sum, w) => sum + w, 0) > 0 
      ? beforeValues.reduce((sum, v) => sum + v, 0) / beforeWeights.reduce((sum, w) => sum + w, 0)
      : 0;
      
    const afterValues = afterData.map(d => d.interpolatedValue * d.confidence);
    const afterWeights = afterData.map(d => d.confidence);
    const afterAverage = afterWeights.reduce((sum, w) => sum + w, 0) > 0
      ? afterValues.reduce((sum, v) => sum + v, 0) / afterWeights.reduce((sum, w) => sum + w, 0)
      : 0;
    
    const confidenceAdjustedImpact = (afterAverage - beforeAverage) * Math.min(beforeQuality, afterQuality);
    
    // Generate warnings
    const dataQualityWarnings = [];
    if (beforeQuality < 0.6) dataQualityWarnings.push('Before period has insufficient data coverage');
    if (afterQuality < 0.6) dataQualityWarnings.push('After period has insufficient data coverage');
    
    const interpolatedCount = beforeData.filter(d => d.isInterpolated).length + 
                             afterData.filter(d => d.isInterpolated).length;
    if (interpolatedCount > (beforeData.length + afterData.length) * 0.3) {
      dataQualityWarnings.push('High proportion of interpolated data points');
    }
    
    // Recommend minimum period
    const recommendedMinimumPeriod = Math.max(7, Math.ceil(14 / Math.min(beforeQuality, afterQuality)));
    
    return {
      beforeAverage,
      afterAverage,
      confidenceAdjustedImpact,
      dataQualityWarnings,
      recommendedMinimumPeriod
    };
  }

  private calculateInterpolationMetrics(
    beforeData: Array<{ isInterpolated: boolean }>,
    afterData: Array<{ isInterpolated: boolean }>,
    interpolation: any
  ): any {
    const allData = [...beforeData, ...afterData];
    const interpolatedPoints = allData.filter(d => d.isInterpolated).length;
    const totalPoints = allData.length;
    
    // Find maximum interpolation gap
    let maxGap = 0;
    let currentGap = 0;
    
    for (const point of allData) {
      if (point.isInterpolated) {
        currentGap++;
      } else {
        maxGap = Math.max(maxGap, currentGap);
        currentGap = 0;
      }
    }
    maxGap = Math.max(maxGap, currentGap);
    
    // Calculate reliability
    const interpolationRatio = totalPoints > 0 ? interpolatedPoints / totalPoints : 0;
    const interpolationReliability = Math.max(0, 1 - interpolationRatio);
    
    return {
      method: interpolation.method,
      interpolatedPoints,
      maxInterpolationGap: maxGap,
      interpolationReliability
    };
  }

  // REFACTOR: Advanced helper methods for temporal analysis
  private async detectTemporalPatterns(eventId: string, options: any): Promise<any> {
    // Simplified pattern detection implementation
    const patterns = {
      seasonalComponents: [],
      changePoints: [],
      outliers: []
    };

    // Detect change points using sliding window variance analysis
    for (const field of options.textFields) {
      const data = await this.getSentimentDataWithTimestamps(
        eventId, field, options.preEventWindows[0].days + options.postEventWindows[0].days, 
        false, new Date(options.eventDate)
      );
      
      // Simple change point detection based on variance shifts
      const windowSize = 5;
      for (let i = windowSize; i < data.length - windowSize; i++) {
        const beforeWindow = data.slice(i - windowSize, i).map(d => d.score);
        const afterWindow = data.slice(i, i + windowSize).map(d => d.score);
        
        const beforeVar = this.variance(beforeWindow);
        const afterVar = this.variance(afterWindow);
        const varRatio = Math.abs(afterVar - beforeVar) / Math.max(beforeVar, 0.1);
        
        if (varRatio > 1.5) { // Threshold for significant change
          patterns.changePoints.push({
            date: data[i].timestamp,
            magnitude: varRatio,
            confidence: Math.min(0.95, varRatio / 3)
          });
        }
      }
      
      // Simple outlier detection using z-score
      const scores = data.map(d => d.score);
      const mean = this.mean(scores);
      const std = Math.sqrt(this.variance(scores));
      
      data.forEach(point => {
        const zScore = Math.abs((point.score - mean) / std);
        if (zScore > 3) { // 3-sigma rule
          patterns.outliers.push({
            date: point.timestamp,
            field,
            score: zScore,
            reason: 'statistical_outlier'
          });
        }
      });
    }

    return patterns;
  }

  private async performTemporalClustering(eventId: string, options: any): Promise<any[]> {
    // Simplified clustering implementation using time-based grouping
    const clusters = [];
    
    for (const field of options.textFields) {
      const data = await this.getSentimentDataWithTimestamps(
        eventId, field, 30, false, new Date(options.eventDate)
      );
      
      // Simple k-means style clustering by sentiment similarity
      const numClusters = options.clustering.numClusters || 3;
      const clusterSize = Math.ceil(data.length / numClusters);
      
      for (let i = 0; i < numClusters; i++) {
        const clusterData = data.slice(i * clusterSize, (i + 1) * clusterSize);
        if (clusterData.length > 0) {
          clusters.push({
            id: `cluster_${i}_${field}`,
            members: clusterData.map(d => d.timestamp),
            centroid: {
              avgSentiment: this.mean(clusterData.map(d => d.score)),
              timeRange: {
                start: clusterData[0].timestamp,
                end: clusterData[clusterData.length - 1].timestamp
              }
            }
          });
        }
      }
    }
    
    return clusters;
  }

  private async generateTemporalForecast(eventId: string, options: any, baseResult: any): Promise<any> {
    // Simplified forecasting using trend extrapolation
    const forecast = {
      nextPeriodPrediction: [],
      recoveryTimeEstimate: 0,
      uncertainty: 0.3
    };

    for (const field of options.textFields) {
      // Get recent trend from post-event windows
      const postWindows = baseResult.temporalAnalysis.postEventWindows;
      if (postWindows.length > 0) {
        const fieldAnalysis = postWindows[0].fieldAnalysis.find((f: any) => f.fieldName === field);
        if (fieldAnalysis) {
          const trendSlope = fieldAnalysis.trendSlope;
          const currentSentiment = fieldAnalysis.averageSentiment;
          
          // Simple linear extrapolation
          const predictedValue = currentSentiment + (trendSlope * 7); // 7 days ahead
          const confidence = Math.max(0.1, 1 - Math.abs(trendSlope) * 10); // Lower confidence for steep trends
          
          forecast.nextPeriodPrediction.push({
            field,
            predictedValue,
            confidence
          });
        }
      }
    }

    // Estimate recovery time based on trend direction
    const improvingWindows = baseResult.temporalAnalysis.postEventWindows.filter(
      (w: any) => w.fieldAnalysis.some((f: any) => f.sentimentTrend === 'improving')
    );
    
    forecast.recoveryTimeEstimate = improvingWindows.length > 0 ? 14 : 30; // Days
    
    return forecast;
  }

  private async optimizeWindowSizes(eventId: string, options: SlidingWindowOptions, baseResult: SlidingWindowResult): Promise<any> {
    // Simplified window size optimization
    const adaptiveMetrics = {
      optimalWindowSizes: {},
      windowEfficiencyScores: [],
      adaptationEvents: []
    };

    // Analyze efficiency of current windows
    for (const window of baseResult.slidingAnalysis.windows) {
      const efficiency = window.fieldMetrics.reduce((acc: number, metric: any) => 
        acc + metric.rSquared, 0) / window.fieldMetrics.length;
      
      adaptiveMetrics.windowEfficiencyScores.push(efficiency);
      
      // Suggest adaptation if efficiency is low
      if (efficiency < 0.3 && options.windowSize < 7) {
        adaptiveMetrics.adaptationEvents.push({
          windowIndex: window.windowIndex,
          reason: 'low_efficiency',
          newSize: options.windowSize + 2
        });
      }
    }

    // Calculate optimal window sizes per field
    for (const field of options.textFields) {
      adaptiveMetrics.optimalWindowSizes[field] = Math.max(3, 
        Math.min(10, options.windowSize + adaptiveMetrics.adaptationEvents.length)
      );
    }

    return adaptiveMetrics;
  }

  private async clusterTemporalWindows(windows: any[]): Promise<any[]> {
    // Simple clustering by sentiment similarity
    const clusters = [];
    const clusterThreshold = 0.5; // Sentiment difference threshold
    
    let clusterId = 0;
    const processed = new Set<number>();
    
    for (let i = 0; i < windows.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = {
        id: `cluster_${clusterId++}`,
        timeRange: {
          start: windows[i].dateRange.start,
          end: windows[i].dateRange.end
        },
        avgSentiment: 0,
        volatility: 0,
        members: [windows[i].dateRange.start]
      };
      
      const windowSentiment = this.mean(windows[i].fieldMetrics.map((f: any) => f.averageSentiment));
      let clusterSentiments = [windowSentiment];
      processed.add(i);
      
      // Find similar windows
      for (let j = i + 1; j < windows.length; j++) {
        if (processed.has(j)) continue;
        
        const otherSentiment = this.mean(windows[j].fieldMetrics.map((f: any) => f.averageSentiment));
        if (Math.abs(windowSentiment - otherSentiment) < clusterThreshold) {
          cluster.members.push(windows[j].dateRange.start);
          clusterSentiments.push(otherSentiment);
          cluster.timeRange.end = windows[j].dateRange.end;
          processed.add(j);
        }
      }
      
      cluster.avgSentiment = this.mean(clusterSentiments);
      cluster.volatility = Math.sqrt(this.variance(clusterSentiments));
      clusters.push(cluster);
    }
    
    return clusters;
  }

  private async detectChangePoints(windows: any[], eventDate: Date): Promise<any> {
    const changePoints = [];
    let eventChangePointScore = 0;
    
    // Detect change points using cumulative sum (CUSUM) approach
    for (let i = 1; i < windows.length - 1; i++) {
      const before = this.mean(windows[i - 1].fieldMetrics.map((f: any) => f.averageSentiment));
      const current = this.mean(windows[i].fieldMetrics.map((f: any) => f.averageSentiment));
      const after = this.mean(windows[i + 1].fieldMetrics.map((f: any) => f.averageSentiment));
      
      // Calculate change magnitude
      const magnitude = Math.abs(current - before) + Math.abs(after - current);
      
      if (magnitude > 0.5) { // Threshold for significant change
        const windowStart = new Date(windows[i].dateRange.start);
        const changePoint = {
          windowIndex: i,
          date: windows[i].dateRange.start,
          magnitude,
          confidence: Math.min(0.95, magnitude / 2),
          type: this.classifyChangeType(before, current, after)
        };
        
        changePoints.push(changePoint);
        
        // Check if this change point is near the event
        const daysDiff = Math.abs((windowStart.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 3) {
          eventChangePointScore = Math.max(eventChangePointScore, magnitude);
        }
      }
    }
    
    return {
      detectedChangePoints: changePoints,
      eventChangePointScore
    };
  }

  private classifyChangeType(before: number, current: number, after: number): 'trend_change' | 'variance_change' | 'level_change' {
    const beforeToCurrentChange = current - before;
    const currentToAfterChange = after - current;
    
    // Trend change: direction reverses
    if (Math.sign(beforeToCurrentChange) !== Math.sign(currentToAfterChange) && 
        Math.abs(beforeToCurrentChange) > 0.2 && Math.abs(currentToAfterChange) > 0.2) {
      return 'trend_change';
    }
    
    // Level change: significant shift in level
    if (Math.abs(beforeToCurrentChange) > 0.5) {
      return 'level_change';
    }
    
    // Default to variance change
    return 'variance_change';
  }

  private async optimizeDecayFunction(eventId: string, options: TemporalDecayOptions, baseResult: TemporalDecayResult): Promise<any> {
    // Simplified decay function optimization
    const testFunctions = ['exponential', 'linear', 'polynomial', 'gaussian'];
    let bestFunction = options.decayFunction.type;
    let bestScore = Math.abs(baseResult.impactAssessment.weightedImpact);
    
    // Test different decay functions
    for (const testType of testFunctions) {
      if (testType === options.decayFunction.type) continue;
      
      const testOptions = {
        ...options,
        decayFunction: {
          ...options.decayFunction,
          type: testType
        }
      };
      
      try {
        const testResult = await this.applyTemporalDecay(eventId, testOptions);
        const testScore = Math.abs(testResult.impactAssessment.weightedImpact);
        
        if (testScore > bestScore) {
          bestScore = testScore;
          bestFunction = testType;
        }
      } catch (error) {
        // Skip this function if it fails
        continue;
      }
    }
    
    return {
      optimalDecayFunction: bestFunction,
      decayParameterEvolution: [{
        time: new Date().toISOString(),
        parameters: { type: bestFunction, score: bestScore }
      }],
      adaptationTriggers: bestFunction !== options.decayFunction.type ? ['better_fit_detected'] : []
    };
  }

  private async clusterTemporalDecayRegions(baseResult: TemporalDecayResult, options: TemporalDecayOptions): Promise<any[]> {
    const clusters = [];
    const clusterSize = options.temporalClustering?.clusterSize || 7;
    
    // Group temporal weights into clusters
    const weights = baseResult.temporalWeights;
    for (let i = 0; i < weights.length; i += clusterSize) {
      const clusterWeights = weights.slice(i, i + clusterSize);
      
      if (clusterWeights.length > 0) {
        const avgWeight = this.mean(clusterWeights.map(w => w.weight));
        const startDate = clusterWeights[0].dataPoint;
        const endDate = clusterWeights[clusterWeights.length - 1].dataPoint;
        
        clusters.push({
          clusterId: `decay_cluster_${clusters.length}`,
          timeRange: { start: startDate, end: endDate },
          decayProfile: this.classifyDecayProfile(clusterWeights.map(w => w.weight)),
          weightDistribution: clusterWeights.map(w => w.weight),
          significance: avgWeight
        });
      }
    }
    
    return clusters;
  }

  private classifyDecayProfile(weights: number[]): string {
    if (weights.length < 2) return 'uniform';
    
    const firstHalf = weights.slice(0, Math.floor(weights.length / 2));
    const secondHalf = weights.slice(Math.floor(weights.length / 2));
    
    const firstAvg = this.mean(firstHalf);
    const secondAvg = this.mean(secondHalf);
    
    if (firstAvg > secondAvg * 1.5) return 'front_loaded';
    if (secondAvg > firstAvg * 1.5) return 'back_loaded';
    return 'balanced';
  }

  private async quantifyDecayUncertainty(baseResult: TemporalDecayResult, options: TemporalDecayOptions): Promise<any> {
    const weights = baseResult.temporalWeights.map(w => w.weight);
    const weightVariance = this.variance(weights);
    const weightUncertainty = weights.map(w => Math.abs(w - this.mean(weights)));
    
    // Calculate confidence interval for impact (simplified)
    const impact = baseResult.impactAssessment.weightedImpact;
    const uncertainty = Math.sqrt(weightVariance);
    
    return {
      weightUncertainty,
      impactConfidenceInterval: {
        lower: impact - 1.96 * uncertainty,
        upper: impact + 1.96 * uncertainty
      },
      robustnessScore: Math.max(0, 1 - weightVariance)
    };
  }
}

export default MultiFieldAnalysisService;