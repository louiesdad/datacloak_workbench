import { DatabaseService } from '../database/sqlite';
import logger from '../config/logger';

export interface MultiFieldImpactOptions {
  primaryFields: string[];
  secondaryFields: string[];
  correlationThreshold?: number;
}

export interface FieldCorrelation {
  coefficient: number;
  pValue: number;
  significance: 'significant' | 'not_significant';
  sampleSize: number;
  confidenceInterval?: [number, number];
}

export interface InteractionPattern {
  type: 'multiplicative' | 'additive' | 'dominant';
  rsquared: number;
  coefficients: Record<string, number>;
  pValue: number;
  aic: number;
}

export interface InteractionPatterns {
  bestModel: InteractionPattern;
  models: Record<string, InteractionPattern>;
  modelComparison: {
    bestModelType: string;
    improvementOverLinear: number;
  };
}

export interface DependencyStrength {
  dependencyScore: number;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
  mutualInformation: number;
  conditionalEntropy: number;
}

export interface CausalAnalysis {
  direction: 'x_causes_y' | 'y_causes_x' | 'bidirectional' | 'independent';
  grangerCausality: {
    xCausesY: { fStatistic: number; pValue: number };
    yCausesX: { fStatistic: number; pValue: number };
  };
  lagEffect: number;
  confidence: number;
}

export interface FieldHierarchy {
  levels: string[][];
  relationships: Record<string, { parent?: string; children: string[] }>;
  aggregationFlow: string[];
  confidence: number;
}

export interface CompositeImpactScore {
  overallScore: number;
  fieldContributions: Record<string, number>;
  impactMagnitude: 'weak' | 'moderate' | 'strong';
  confidence: number;
  weightingMethod: string;
}

export interface AdaptiveWeights {
  [fieldName: string]: number;
  correlationEvidence: Record<string, number>;
}

export interface FieldCluster {
  fields: string[];
  centroid: number[];
  coherence: number;
}

export interface FieldClusters {
  clusters: FieldCluster[];
  interClusterCorrelations: Record<string, Record<string, number>>;
  silhouetteScore: number;
}

export interface FieldEvolution {
  recoveryPatterns: Record<string, {
    isRecovering: boolean;
    recoveryRate: number;
    projectedFullRecovery?: number;
  }>;
  fieldSynchronization: Record<string, Record<string, number>>;
  temporalCorrelations: Record<string, number[]>;
}

export interface FieldLagAnalysis {
  optimalLag: number;
  lagCorrelation: number;
  isSignificant: boolean;
  lagStrength: 'weak' | 'moderate' | 'strong';
  crossCorrelationFunction: number[];
}

export interface MultiFieldValidation {
  overallSignificance: { fStatistic: number; pValue: number };
  pairwiseTests: Record<string, Record<string, { tStatistic: number; pValue: number }>>;
  effectSizes: Record<string, number>;
  corrections: {
    bonferroni: Record<string, number>;
    fdr: Record<string, number>;
  };
  powerAnalysis: { observedPower: number; requiredSampleSize: number };
}

export interface RobustMultiFieldAnalysis {
  cleanedDataCount: number;
  outlierCount: number;
  missingDataReport: Record<string, { count: number; percentage: number }>;
  robustCorrelations: Record<string, Record<string, number>>;
  dataQualityScore: number;
}

export interface MultiFieldImpactAssessment {
  correlations: Record<string, Record<string, number>>;
  impactStrength: 'weak' | 'moderate' | 'strong';
  significantRelationships: Array<{
    fieldA: string;
    fieldB: string;
    correlation: number;
    pValue: number;
  }>;
  overallImpactScore: number;
}

export class MultiFieldImpactAssessmentService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async analyzeMultiFieldImpact(
    eventId: string,
    options: MultiFieldImpactOptions
  ): Promise<MultiFieldImpactAssessment> {
    try {
      const allFields = [...options.primaryFields, ...options.secondaryFields];
      const fieldSelects = allFields.map(field => `${field}`).join(', ');
      
      const query = `
        SELECT customer_id, ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${allFields.map(field => `${field} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      if (data.length < 3) {
        throw new Error('Insufficient data for multi-field analysis');
      }

      // Calculate correlations between all field pairs
      const correlations: Record<string, Record<string, number>> = {};
      const significantRelationships: Array<{
        fieldA: string;
        fieldB: string;
        correlation: number;
        pValue: number;
      }> = [];

      for (const primaryField of options.primaryFields) {
        correlations[primaryField] = {};
        
        for (const secondaryField of options.secondaryFields) {
          const correlation = await this.calculateFieldCorrelation(primaryField, secondaryField, eventId);
          correlations[primaryField][secondaryField] = correlation.coefficient;
          
          if (correlation.significance === 'significant' && 
              Math.abs(correlation.coefficient) >= (options.correlationThreshold || 0.5)) {
            significantRelationships.push({
              fieldA: primaryField,
              fieldB: secondaryField,
              correlation: correlation.coefficient,
              pValue: correlation.pValue
            });
          }
        }
      }

      // Calculate overall impact strength
      const avgCorrelation = significantRelationships.reduce((sum, rel) => 
        sum + Math.abs(rel.correlation), 0) / Math.max(significantRelationships.length, 1);
      
      let impactStrength: 'weak' | 'moderate' | 'strong' = 'weak';
      if (avgCorrelation > 0.7) impactStrength = 'strong';
      else if (avgCorrelation > 0.5) impactStrength = 'moderate';

      return {
        correlations,
        impactStrength,
        significantRelationships,
        overallImpactScore: avgCorrelation
      };
    } catch (error) {
      logger.error('Failed to analyze multi-field impact', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async calculateFieldCorrelation(
    fieldA: string,
    fieldB: string,
    eventId: string
  ): Promise<FieldCorrelation> {
    try {
      const query = `
        SELECT ${fieldA}, ${fieldB}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${fieldA} IS NOT NULL 
        AND ${fieldB} IS NOT NULL
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      if (data.length < 3) {
        return {
          coefficient: 0,
          pValue: 1,
          significance: 'not_significant',
          sampleSize: data.length
        };
      }

      const valuesA = data.map(row => row[fieldA]);
      const valuesB = data.map(row => row[fieldB]);
      
      const correlation = this.pearsonCorrelation(valuesA, valuesB);
      const tStatistic = correlation * Math.sqrt((data.length - 2) / (1 - correlation * correlation));
      const pValue = this.tTestPValue(tStatistic, data.length - 2);
      
      return {
        coefficient: correlation,
        pValue,
        significance: pValue < 0.05 ? 'significant' : 'not_significant',
        sampleSize: data.length,
        confidenceInterval: this.correlationConfidenceInterval(correlation, data.length)
      };
    } catch (error) {
      logger.error('Failed to calculate field correlation', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        fieldA,
        fieldB,
        eventId
      });
      throw error;
    }
  }

  async detectInteractionPatterns(
    eventId: string,
    options: {
      fields: string[];
      targetField: string;
      interactionTypes: string[];
    }
  ): Promise<InteractionPatterns> {
    try {
      const fieldSelects = [...options.fields, options.targetField].join(', ');
      const query = `
        SELECT ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${[...options.fields, options.targetField].map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const models: Record<string, InteractionPattern> = {};
      let bestModel: InteractionPattern;
      let bestAIC = Infinity;
      let bestModelType = '';

      for (const interactionType of options.interactionTypes) {
        const model = this.fitInteractionModel(data, options.fields, options.targetField, interactionType);
        models[interactionType] = model;
        
        if (model.aic < bestAIC) {
          bestAIC = model.aic;
          bestModel = model;
          bestModelType = interactionType;
        }
      }

      // Calculate improvement over linear model
      const linearModel = this.fitInteractionModel(data, options.fields, options.targetField, 'additive');
      const improvementOverLinear = linearModel.aic - bestAIC;

      return {
        bestModel: bestModel!,
        models,
        modelComparison: {
          bestModelType,
          improvementOverLinear
        }
      };
    } catch (error) {
      logger.error('Failed to detect interaction patterns', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async analyzeDependencyStrength(
    sourceField: string,
    targetField: string,
    eventId: string
  ): Promise<DependencyStrength> {
    try {
      const query = `
        SELECT ${sourceField}, ${targetField}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${sourceField} IS NOT NULL 
        AND ${targetField} IS NOT NULL
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const sourceValues = data.map(row => row[sourceField]);
      const targetValues = data.map(row => row[targetField]);
      
      const correlation = this.pearsonCorrelation(sourceValues, targetValues);
      const mutualInfo = this.mutualInformation(sourceValues, targetValues);
      const conditionalEntropy = this.conditionalEntropy(targetValues, sourceValues);
      
      const dependencyScore = Math.abs(correlation) * 0.6 + mutualInfo * 0.4;
      const direction = correlation > 0.1 ? 'positive' : correlation < -0.1 ? 'negative' : 'neutral';
      const confidence = Math.min(0.95, Math.max(0.5, Math.abs(correlation) + mutualInfo * 0.5));

      return {
        dependencyScore,
        direction,
        confidence,
        mutualInformation: mutualInfo,
        conditionalEntropy
      };
    } catch (error) {
      logger.error('Failed to analyze dependency strength', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        sourceField,
        targetField,
        eventId
      });
      throw error;
    }
  }

  async analyzeCausalDirection(
    fieldX: string,
    fieldY: string,
    eventId: string
  ): Promise<CausalAnalysis> {
    try {
      const query = `
        SELECT ${fieldX}, ${fieldY}, timestamp
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${fieldX} IS NOT NULL 
        AND ${fieldY} IS NOT NULL
        ORDER BY timestamp
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const valuesX = data.map(row => row[fieldX]);
      const valuesY = data.map(row => row[fieldY]);
      
      // Simplified Granger causality test
      const grangerXY = this.grangerCausalityTest(valuesX, valuesY);
      const grangerYX = this.grangerCausalityTest(valuesY, valuesX);
      
      let direction: CausalAnalysis['direction'] = 'independent';
      if (grangerXY.pValue < 0.05 && grangerYX.pValue >= 0.05) {
        direction = 'x_causes_y';
      } else if (grangerYX.pValue < 0.05 && grangerXY.pValue >= 0.05) {
        direction = 'y_causes_x';
      } else if (grangerXY.pValue < 0.05 && grangerYX.pValue < 0.05) {
        direction = 'bidirectional';
      }
      
      const lagEffect = this.calculateOptimalLag(valuesX, valuesY);
      const confidence = Math.min(grangerXY.pValue < 0.05 ? 1 - grangerXY.pValue : 0.5,
                                  grangerYX.pValue < 0.05 ? 1 - grangerYX.pValue : 0.5);

      return {
        direction,
        grangerCausality: {
          xCausesY: grangerXY,
          yCausesX: grangerYX
        },
        lagEffect,
        confidence
      };
    } catch (error) {
      logger.error('Failed to analyze causal direction', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        fieldX,
        fieldY,
        eventId
      });
      throw error;
    }
  }

  async detectFieldHierarchy(
    eventId: string,
    options: {
      candidateFields: string[];
      hierarchyTypes: string[];
    }
  ): Promise<FieldHierarchy> {
    try {
      const fieldSelects = options.candidateFields.join(', ');
      const query = `
        SELECT ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${options.candidateFields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      // Calculate correlations between all field pairs
      const correlations: Record<string, Record<string, number>> = {};
      for (const fieldA of options.candidateFields) {
        correlations[fieldA] = {};
        for (const fieldB of options.candidateFields) {
          if (fieldA !== fieldB) {
            const valuesA = data.map(row => row[fieldA]);
            const valuesB = data.map(row => row[fieldB]);
            correlations[fieldA][fieldB] = this.pearsonCorrelation(valuesA, valuesB);
          }
        }
      }
      
      // Detect hierarchy based on correlation patterns
      const aggregationFlow = this.detectAggregationFlow(correlations, options.candidateFields);
      const levels = this.organizeLevels(aggregationFlow);
      const relationships = this.buildRelationships(aggregationFlow);
      
      // Calculate confidence based on correlation strength
      const avgCorrelation = Object.values(correlations)
        .flatMap(row => Object.values(row))
        .reduce((sum, val) => sum + Math.abs(val), 0) / 
        (options.candidateFields.length * (options.candidateFields.length - 1));

      return {
        levels,
        relationships,
        aggregationFlow,
        confidence: avgCorrelation
      };
    } catch (error) {
      logger.error('Failed to detect field hierarchy', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async calculateCompositeImpactScore(
    eventId: string,
    options: {
      fields: Array<{ name: string; weight: number }>;
      aggregationMethod: string;
      includeDelta: boolean;
    }
  ): Promise<CompositeImpactScore> {
    try {
      const fieldNames = options.fields.map(f => f.name);
      const beforeFields = options.includeDelta ? fieldNames.map(f => `before_${f}`) : [];
      const allFields = [...fieldNames, ...beforeFields];
      
      const fieldSelects = allFields.join(', ');
      const query = `
        SELECT customer_id, ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${allFields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const fieldContributions: Record<string, number> = {};
      let overallScore = 0;
      
      for (const fieldConfig of options.fields) {
        const currentValues = data.map(row => row[fieldConfig.name]);
        let fieldScore = 0;
        
        if (options.includeDelta) {
          const beforeValues = data.map(row => row[`before_${fieldConfig.name}`]);
          const deltas = currentValues.map((val, i) => val - beforeValues[i]);
          fieldScore = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
        } else {
          fieldScore = currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length;
        }
        
        fieldContributions[fieldConfig.name] = fieldScore;
        overallScore += fieldScore * fieldConfig.weight;
      }
      
      const impactMagnitude = Math.abs(overallScore) > 0.5 ? 'strong' : 
                             Math.abs(overallScore) > 0.2 ? 'moderate' : 'weak';
      
      const confidence = data.length >= 5 ? 0.9 : data.length >= 3 ? 0.85 : 0.5;

      return {
        overallScore,
        fieldContributions,
        impactMagnitude,
        confidence,
        weightingMethod: options.aggregationMethod
      };
    } catch (error) {
      logger.error('Failed to calculate composite impact score', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async calculateAdaptiveWeights(
    eventId: string,
    options: {
      primaryKpi: string;
      candidateFields: string[];
      weightingMethod: string;
    }
  ): Promise<AdaptiveWeights> {
    try {
      const allFields = [options.primaryKpi, ...options.candidateFields];
      const fieldSelects = allFields.join(', ');
      const query = `
        SELECT ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${allFields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const primaryValues = data.map(row => row[options.primaryKpi]);
      const correlationEvidence: Record<string, number> = {};
      const rawWeights: Record<string, number> = {};
      
      let totalAbsCorrelation = 0;
      
      for (const field of options.candidateFields) {
        const fieldValues = data.map(row => row[field]);
        const correlation = Math.abs(this.pearsonCorrelation(primaryValues, fieldValues));
        correlationEvidence[field] = correlation;
        rawWeights[field] = correlation;
        totalAbsCorrelation += correlation;
      }
      
      // Normalize weights to sum to 1
      const weights: AdaptiveWeights = { correlationEvidence };
      for (const field of options.candidateFields) {
        weights[field] = totalAbsCorrelation > 0 ? rawWeights[field] / totalAbsCorrelation : 1 / options.candidateFields.length;
      }

      return weights;
    } catch (error) {
      logger.error('Failed to calculate adaptive weights', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async identifyFieldClusters(
    eventId: string,
    options: {
      fields: string[];
      clusteringMethod: string;
      minClusterSize: number;
    }
  ): Promise<FieldClusters> {
    try {
      const fieldSelects = options.fields.join(', ');
      const query = `
        SELECT ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${options.fields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      // Calculate correlation matrix
      const correlationMatrix: number[][] = [];
      for (let i = 0; i < options.fields.length; i++) {
        correlationMatrix[i] = [];
        const valuesI = data.map(row => row[options.fields[i]]);
        
        for (let j = 0; j < options.fields.length; j++) {
          const valuesJ = data.map(row => row[options.fields[j]]);
          correlationMatrix[i][j] = i === j ? 1 : this.pearsonCorrelation(valuesI, valuesJ);
        }
      }
      
      // Simple clustering based on correlation thresholds
      const clusters = this.correlationBasedClustering(
        options.fields, 
        correlationMatrix, 
        options.minClusterSize
      );
      
      // Calculate inter-cluster correlations
      const interClusterCorrelations: Record<string, Record<string, number>> = {};
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const clusterA = `cluster_${i}`;
          const clusterB = `cluster_${j}`;
          
          if (!interClusterCorrelations[clusterA]) {
            interClusterCorrelations[clusterA] = {};
          }
          
          // Calculate average inter-cluster correlation
          let totalCorr = 0;
          let count = 0;
          
          for (const fieldA of clusters[i].fields) {
            for (const fieldB of clusters[j].fields) {
              const indexA = options.fields.indexOf(fieldA);
              const indexB = options.fields.indexOf(fieldB);
              totalCorr += Math.abs(correlationMatrix[indexA][indexB]);
              count++;
            }
          }
          
          interClusterCorrelations[clusterA][clusterB] = count > 0 ? totalCorr / count : 0;
        }
      }
      
      const silhouetteScore = this.calculateSilhouetteScore(correlationMatrix, clusters);

      return {
        clusters,
        interClusterCorrelations,
        silhouetteScore
      };
    } catch (error) {
      logger.error('Failed to identify field clusters', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async analyzeFieldEvolution(
    eventId: string,
    options: {
      fields: string[];
      timeWindows: string[];
      recoveryThreshold: number;
    }
  ): Promise<FieldEvolution> {
    try {
      const fieldSelects = options.fields.join(', ');
      const query = `
        SELECT time_window, ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND time_window IN (${options.timeWindows.map(() => '?').join(',')})
        AND ${options.fields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId, ...options.timeWindows]);
      
      // Group data by time window
      const timeWindowData: Record<string, Record<string, number>> = {};
      for (const row of data) {
        if (!timeWindowData[row.time_window]) {
          timeWindowData[row.time_window] = {};
        }
        for (const field of options.fields) {
          timeWindowData[row.time_window][field] = row[field];
        }
      }
      
      const recoveryPatterns: Record<string, any> = {};
      const fieldSynchronization: Record<string, Record<string, number>> = {};
      const temporalCorrelations: Record<string, number[]> = {};
      
      for (const field of options.fields) {
        const fieldValues = options.timeWindows.map(tw => timeWindowData[tw]?.[field] || 0);
        temporalCorrelations[field] = fieldValues;
        
        // Analyze recovery pattern
        const initialValue = fieldValues[0] || 0;
        const minValue = Math.min(...fieldValues);
        const finalValue = fieldValues[fieldValues.length - 1] || 0;
        
        const isRecovering = finalValue > minValue;
        const recoveryRate = fieldValues.length > 1 ? 
          (finalValue - minValue) / (fieldValues.length - 1) : 0;
        
        recoveryPatterns[field] = {
          isRecovering,
          recoveryRate,
          projectedFullRecovery: isRecovering && recoveryRate > 0 ? 
            (options.recoveryThreshold - finalValue) / recoveryRate : undefined
        };
        
        // Calculate synchronization with other fields
        fieldSynchronization[field] = {};
        for (const otherField of options.fields) {
          if (field !== otherField) {
            const otherValues = options.timeWindows.map(tw => timeWindowData[tw]?.[otherField] || 0);
            fieldSynchronization[field][otherField] = this.pearsonCorrelation(fieldValues, otherValues);
          }
        }
      }

      return {
        recoveryPatterns,
        fieldSynchronization,
        temporalCorrelations
      };
    } catch (error) {
      logger.error('Failed to analyze field evolution', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async detectFieldLags(
    eventId: string,
    options: {
      leadingField: string;
      laggingField: string;
      maxLag: number;
      minCorrelation: number;
    }
  ): Promise<FieldLagAnalysis> {
    try {
      const query = `
        SELECT day, ${options.leadingField}, ${options.laggingField}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${options.leadingField} IS NOT NULL 
        AND ${options.laggingField} IS NOT NULL
        ORDER BY day
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      const leadingValues = data.map(row => row[options.leadingField]);
      const laggingValues = data.map(row => row[options.laggingField]);
      
      const crossCorrelationFunction: number[] = [];
      let optimalLag = 0;
      let maxCorrelation = 0;
      
      for (let lag = 0; lag <= options.maxLag; lag++) {
        if (lag >= leadingValues.length) break;
        
        const laggedLeading = leadingValues.slice(0, leadingValues.length - lag);
        const alignedLagging = laggingValues.slice(lag);
        
        const correlation = this.pearsonCorrelation(laggedLeading, alignedLagging);
        crossCorrelationFunction.push(correlation);
        
        if (Math.abs(correlation) > Math.abs(maxCorrelation)) {
          maxCorrelation = correlation;
          optimalLag = lag;
        }
      }
      
      const isSignificant = Math.abs(maxCorrelation) >= options.minCorrelation;
      const lagStrength = Math.abs(maxCorrelation) > 0.7 ? 'strong' : 
                         Math.abs(maxCorrelation) > 0.5 ? 'moderate' : 'weak';

      return {
        optimalLag,
        lagCorrelation: maxCorrelation,
        isSignificant,
        lagStrength,
        crossCorrelationFunction
      };
    } catch (error) {
      logger.error('Failed to detect field lags', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async validateMultiFieldSignificance(
    eventId: string,
    options: {
      fields: string[];
      testType: string;
      alpha: number;
      corrections: string[];
    }
  ): Promise<MultiFieldValidation> {
    try {
      const fieldSelects = options.fields.join(', ');
      const query = `
        SELECT ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ? 
        AND ${options.fields.map(f => `${f} IS NOT NULL`).join(' AND ')}
      `;
      
      const data = await this.db.all(query, [eventId]);
      
      // Multivariate ANOVA (simplified)
      const grandMean = this.calculateGrandMean(data, options.fields);
      const totalSumSquares = this.calculateTotalSumSquares(data, options.fields, grandMean);
      const betweenGroupsSumSquares = this.calculateBetweenGroupsSumSquares(data, options.fields, grandMean);
      const withinGroupsSumSquares = totalSumSquares - betweenGroupsSumSquares;
      
      const dfBetween = options.fields.length - 1;
      const dfWithin = data.length * options.fields.length - options.fields.length;
      const fStatistic = (betweenGroupsSumSquares / dfBetween) / (withinGroupsSumSquares / dfWithin);
      const pValue = this.fTestPValue(fStatistic, dfBetween, dfWithin);
      
      // Pairwise tests
      const pairwiseTests: Record<string, Record<string, { tStatistic: number; pValue: number }>> = {};
      for (let i = 0; i < options.fields.length; i++) {
        pairwiseTests[options.fields[i]] = {};
        for (let j = i + 1; j < options.fields.length; j++) {
          const valuesA = data.map(row => row[options.fields[i]]);
          const valuesB = data.map(row => row[options.fields[j]]);
          const { tStatistic, pValue: pairwisePValue } = this.tTest(valuesA, valuesB);
          pairwiseTests[options.fields[i]][options.fields[j]] = { tStatistic, pValue: pairwisePValue };
        }
      }
      
      // Effect sizes (Cohen's d)
      const effectSizes: Record<string, number> = {};
      for (const field of options.fields) {
        const values = data.map(row => row[field]);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length);
        effectSizes[field] = Math.abs(mean - grandMean) / std;
      }
      
      // Multiple comparison corrections
      const corrections: any = {};
      if (options.corrections.includes('bonferroni')) {
        corrections.bonferroni = {};
        const numComparisons = (options.fields.length * (options.fields.length - 1)) / 2;
        for (const fieldA of Object.keys(pairwiseTests)) {
          for (const fieldB of Object.keys(pairwiseTests[fieldA])) {
            corrections.bonferroni[`${fieldA}_${fieldB}`] = 
              Math.min(1, pairwiseTests[fieldA][fieldB].pValue * numComparisons);
          }
        }
      }
      
      if (options.corrections.includes('fdr')) {
        corrections.fdr = this.benjaminiHochbergCorrection(pairwiseTests, options.alpha);
      }
      
      // Power analysis (simplified)
      const effectSize = Object.values(effectSizes).reduce((sum, es) => sum + es, 0) / options.fields.length;
      const observedPower = this.calculatePower(effectSize, data.length, options.alpha);
      const requiredSampleSize = this.calculateRequiredSampleSize(effectSize, 0.8, options.alpha);

      return {
        overallSignificance: { fStatistic, pValue },
        pairwiseTests,
        effectSizes,
        corrections,
        powerAnalysis: { observedPower, requiredSampleSize }
      };
    } catch (error) {
      logger.error('Failed to validate multi-field significance', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  async performRobustMultiFieldAnalysis(
    eventId: string,
    options: {
      fields: string[];
      missingDataStrategy: string;
      outlierDetection: string;
      outlierHandling: string;
    }
  ): Promise<RobustMultiFieldAnalysis> {
    try {
      const fieldSelects = options.fields.join(', ');
      const query = `
        SELECT customer_id, ${fieldSelects}
        FROM sentiment_analysis 
        WHERE event_id = ?
      `;
      
      const rawData = await this.db.all(query, [eventId]);
      
      // Analyze missing data
      const missingDataReport: Record<string, { count: number; percentage: number }> = {};
      for (const field of options.fields) {
        const missingCount = rawData.filter(row => row[field] == null).length;
        missingDataReport[field] = {
          count: missingCount,
          percentage: (missingCount / rawData.length) * 100
        };
      }
      
      // Handle missing data
      let cleanedData = rawData;
      if (options.missingDataStrategy === 'pairwise_deletion') {
        // Keep all rows for pairwise analysis
        cleanedData = rawData;
      } else {
        // Listwise deletion - remove rows with any missing values
        cleanedData = rawData.filter(row => 
          options.fields.every(field => row[field] != null)
        );
      }
      
      // Detect outliers
      let outlierCount = 0;
      if (options.outlierDetection === 'iqr') {
        for (const field of options.fields) {
          const values = cleanedData.map(row => row[field]).filter(val => val != null);
          const outlierInfo = this.detectIQROutliers(values);
          outlierCount += outlierInfo.outliers.length;
          
          if (options.outlierHandling === 'winsorize') {
            this.winsorizeField(cleanedData, field, outlierInfo);
          }
        }
      }
      
      // Calculate robust correlations
      const robustCorrelations: Record<string, Record<string, number>> = {};
      for (const fieldA of options.fields) {
        robustCorrelations[fieldA] = {};
        for (const fieldB of options.fields) {
          if (fieldA !== fieldB) {
            const validPairs = cleanedData.filter(row => 
              row[fieldA] != null && row[fieldB] != null
            );
            
            if (validPairs.length > 2) {
              const valuesA = validPairs.map(row => row[fieldA]);
              const valuesB = validPairs.map(row => row[fieldB]);
              robustCorrelations[fieldA][fieldB] = this.spearmanCorrelation(valuesA, valuesB);
            } else {
              robustCorrelations[fieldA][fieldB] = 0;
            }
          } else {
            robustCorrelations[fieldA][fieldB] = 1;
          }
        }
      }
      
      // Calculate data quality score
      const completenessScore = cleanedData.length / rawData.length;
      const outlierScore = 1 - (outlierCount / (rawData.length * options.fields.length));
      const dataQualityScore = (completenessScore + outlierScore) / 2;

      return {
        cleanedDataCount: cleanedData.length,
        outlierCount,
        missingDataReport,
        robustCorrelations,
        dataQualityScore
      };
    } catch (error) {
      logger.error('Failed to perform robust multi-field analysis', {
        component: 'multi-field-impact-assessment',
        error: error instanceof Error ? error.message : error,
        eventId
      });
      throw error;
    }
  }

  // Helper methods for statistical calculations
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private spearmanCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const xRanks = this.getRanks(x.slice(0, n));
    const yRanks = this.getRanks(y.slice(0, n));
    
    return this.pearsonCorrelation(xRanks, yRanks);
  }

  private getRanks(values: number[]): number[] {
    const indexed = values.map((val, i) => ({ val, i }));
    indexed.sort((a, b) => a.val - b.val);
    
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].i] = i + 1;
    }
    
    return ranks;
  }

  private tTestPValue(tStatistic: number, degreesOfFreedom: number): number {
    // Simplified t-test p-value calculation
    const absTStat = Math.abs(tStatistic);
    if (degreesOfFreedom < 1) return 1;
    
    // Rough approximation for two-tailed test
    if (absTStat > 2.576) return 0.01;
    if (absTStat > 1.960) return 0.05;
    if (absTStat > 1.645) return 0.10;
    return 0.20;
  }

  private correlationConfidenceInterval(r: number, n: number): [number, number] {
    if (n < 4) return [r, r];
    
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const margin = 1.96 * se; // 95% CI
    
    const zLower = z - margin;
    const zUpper = z + margin;
    
    const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
    const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);
    
    return [rLower, rUpper];
  }

  private fitInteractionModel(
    data: any[], 
    fields: string[], 
    targetField: string, 
    interactionType: string
  ): InteractionPattern {
    const n = data.length;
    let sumSquaredError = 0;
    const coefficients: Record<string, number> = {};
    
    // Simple model fitting based on interaction type
    const targetValues = data.map(row => row[targetField]);
    const meanTarget = targetValues.reduce((sum, val) => sum + val, 0) / n;
    
    if (interactionType === 'additive') {
      // Linear additive model: y = b0 + b1*x1 + b2*x2 + ...
      coefficients.intercept = meanTarget;
      for (const field of fields) {
        const fieldValues = data.map(row => row[field]);
        coefficients[field] = this.pearsonCorrelation(fieldValues, targetValues) * 0.5;
      }
    } else if (interactionType === 'multiplicative') {
      // Multiplicative model: y = b0 * x1^b1 * x2^b2 * ...
      coefficients.intercept = meanTarget;
      for (const field of fields) {
        const fieldValues = data.map(row => row[field]);
        coefficients[field] = this.pearsonCorrelation(fieldValues, targetValues) * 0.3;
      }
    } else if (interactionType === 'dominant') {
      // Dominant field model
      let maxCorr = 0;
      let dominantField = fields[0];
      for (const field of fields) {
        const fieldValues = data.map(row => row[field]);
        const corr = Math.abs(this.pearsonCorrelation(fieldValues, targetValues));
        if (corr > maxCorr) {
          maxCorr = corr;
          dominantField = field;
        }
      }
      coefficients[dominantField] = maxCorr;
    }
    
    // Calculate residuals and metrics
    let predictions: number[] = [];
    for (const row of data) {
      let prediction = coefficients.intercept || meanTarget;
      
      if (interactionType === 'additive') {
        for (const field of fields) {
          prediction += (coefficients[field] || 0) * row[field];
        }
      } else if (interactionType === 'multiplicative') {
        for (const field of fields) {
          prediction *= Math.pow(row[field], coefficients[field] || 0);
        }
      } else if (interactionType === 'dominant') {
        const dominantField = Object.keys(coefficients).find(k => k !== 'intercept');
        if (dominantField) {
          prediction = coefficients[dominantField] * row[dominantField];
        }
      }
      
      predictions.push(prediction);
    }
    
    // Calculate R-squared
    const ssRes = targetValues.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);
    const ssTot = targetValues.reduce((sum, val) => sum + Math.pow(val - meanTarget, 2), 0);
    const rsquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
    
    // Simple AIC calculation
    const k = Object.keys(coefficients).length;
    const aic = n * Math.log(ssRes / n) + 2 * k;
    
    const pValue = rsquared > 0.5 ? 0.01 : rsquared > 0.3 ? 0.05 : 0.20;

    return {
      type: interactionType as any,
      rsquared: Math.max(0, Math.min(1, rsquared)),
      coefficients,
      pValue,
      aic
    };
  }

  private mutualInformation(x: number[], y: number[]): number {
    // Simplified mutual information calculation
    // Discretize values into bins
    const bins = 5;
    const xBinned = this.discretize(x, bins);
    const yBinned = this.discretize(y, bins);
    
    const n = x.length;
    const jointCounts: Record<string, number> = {};
    const xCounts: Record<number, number> = {};
    const yCounts: Record<number, number> = {};
    
    for (let i = 0; i < n; i++) {
      const key = `${xBinned[i]}_${yBinned[i]}`;
      jointCounts[key] = (jointCounts[key] || 0) + 1;
      xCounts[xBinned[i]] = (xCounts[xBinned[i]] || 0) + 1;
      yCounts[yBinned[i]] = (yCounts[yBinned[i]] || 0) + 1;
    }
    
    let mi = 0;
    for (const [key, jointCount] of Object.entries(jointCounts)) {
      const [xBin, yBin] = key.split('_').map(Number);
      const pXY = jointCount / n;
      const pX = xCounts[xBin] / n;
      const pY = yCounts[yBin] / n;
      
      if (pX > 0 && pY > 0 && pXY > 0) {
        mi += pXY * Math.log2(pXY / (pX * pY));
      }
    }
    
    return Math.max(0, mi);
  }

  private conditionalEntropy(y: number[], x: number[]): number {
    // H(Y|X) = H(Y) - I(X;Y)
    const hY = this.entropy(y);
    const mi = this.mutualInformation(x, y);
    return Math.max(0, hY - mi);
  }

  private entropy(values: number[]): number {
    const bins = 5;
    const binned = this.discretize(values, bins);
    const counts: Record<number, number> = {};
    
    for (const bin of binned) {
      counts[bin] = (counts[bin] || 0) + 1;
    }
    
    const n = values.length;
    let entropy = 0;
    
    for (const count of Object.values(counts)) {
      const p = count / n;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    
    return entropy;
  }

  private discretize(values: number[], bins: number): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range === 0) {
      return values.map(() => 0);
    }
    
    return values.map(val => {
      const bin = Math.floor(((val - min) / range) * bins);
      return Math.min(bins - 1, Math.max(0, bin));
    });
  }

  private grangerCausalityTest(x: number[], y: number[]): { fStatistic: number; pValue: number } {
    // Simplified Granger causality test
    const lag = 1;
    const n = Math.min(x.length, y.length) - lag;
    
    if (n < 3) {
      return { fStatistic: 0, pValue: 1 };
    }
    
    // Restricted model: y(t) = a + b*y(t-1)
    const yLagged = y.slice(0, n);
    const yCurrent = y.slice(lag, lag + n);
    const corrRestricted = this.pearsonCorrelation(yLagged, yCurrent);
    const ssrRestricted = yCurrent.reduce((sum, val, i) => {
      const predicted = corrRestricted * yLagged[i];
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    // Unrestricted model: y(t) = a + b*y(t-1) + c*x(t-1)
    const xLagged = x.slice(0, n);
    const xCorr = this.pearsonCorrelation(xLagged, yCurrent);
    const yCorr = this.pearsonCorrelation(yLagged, yCurrent);
    
    const ssrUnrestricted = yCurrent.reduce((sum, val, i) => {
      const predicted = yCorr * yLagged[i] + xCorr * xLagged[i];
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    // F-statistic
    const dfRestricted = n - 2;
    const dfUnrestricted = n - 3;
    const fStatistic = ((ssrRestricted - ssrUnrestricted) / 1) / (ssrUnrestricted / dfUnrestricted);
    
    // Simplified p-value
    const pValue = fStatistic > 4 ? 0.01 : fStatistic > 3 ? 0.05 : 0.20;
    
    return { fStatistic: Math.max(0, fStatistic), pValue };
  }

  private calculateOptimalLag(x: number[], y: number[]): number {
    const maxLag = Math.min(3, Math.floor(x.length / 3));
    let bestLag = 0;
    let bestCorrelation = 0;
    
    for (let lag = 0; lag <= maxLag; lag++) {
      if (lag >= x.length) break;
      
      const xLagged = x.slice(0, x.length - lag);
      const yAligned = y.slice(lag);
      const correlation = Math.abs(this.pearsonCorrelation(xLagged, yAligned));
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }
    
    return bestLag;
  }

  private detectAggregationFlow(
    correlations: Record<string, Record<string, number>>, 
    fields: string[]
  ): string[] {
    // Simple heuristic: fields with higher average correlations are more "central"/general
    const avgCorrelations: Record<string, number> = {};
    
    for (const field of fields) {
      const correlationValues = Object.values(correlations[field] || {});
      avgCorrelations[field] = correlationValues.length > 0 ?
        correlationValues.reduce((sum, val) => sum + Math.abs(val), 0) / correlationValues.length : 0;
    }
    
    // Sort by average correlation (ascending = more specific, descending = more general)
    // But for hierarchy, we want specific -> general, so reverse
    return fields.sort((a, b) => avgCorrelations[b] - avgCorrelations[a]);
  }

  private organizeLevels(aggregationFlow: string[]): string[][] {
    // Simple organization: every 2 fields form a level
    const levels: string[][] = [];
    for (let i = 0; i < aggregationFlow.length; i += 2) {
      levels.push(aggregationFlow.slice(i, i + 2));
    }
    return levels;
  }

  private buildRelationships(aggregationFlow: string[]): Record<string, { parent?: string; children: string[] }> {
    const relationships: Record<string, { parent?: string; children: string[] }> = {};
    
    for (let i = 0; i < aggregationFlow.length; i++) {
      const field = aggregationFlow[i];
      relationships[field] = { children: [] };
      
      if (i > 0) {
        relationships[field].parent = aggregationFlow[i - 1];
      }
      
      if (i < aggregationFlow.length - 1) {
        relationships[field].children = [aggregationFlow[i + 1]];
      }
    }
    
    return relationships;
  }

  private correlationBasedClustering(
    fields: string[], 
    correlationMatrix: number[][], 
    minClusterSize: number
  ): FieldCluster[] {
    const threshold = 0.6; // Lower threshold to allow more clustering
    const clusters: FieldCluster[] = [];
    const assigned = new Set<number>();
    
    for (let i = 0; i < fields.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster: FieldCluster = {
        fields: [fields[i]],
        centroid: correlationMatrix[i].slice(),
        coherence: 0
      };
      
      assigned.add(i);
      
      // Find highly correlated fields
      for (let j = i + 1; j < fields.length; j++) {
        if (assigned.has(j)) continue;
        
        if (Math.abs(correlationMatrix[i][j]) >= threshold) {
          cluster.fields.push(fields[j]);
          assigned.add(j);
        }
      }
      
      if (cluster.fields.length >= minClusterSize) {
        // Calculate cluster coherence (average intra-cluster correlation)
        let totalCorrelation = 0;
        let count = 0;
        
        for (let fi = 0; fi < cluster.fields.length; fi++) {
          for (let fj = fi + 1; fj < cluster.fields.length; fj++) {
            const indexI = fields.indexOf(cluster.fields[fi]);
            const indexJ = fields.indexOf(cluster.fields[fj]);
            totalCorrelation += Math.abs(correlationMatrix[indexI][indexJ]);
            count++;
          }
        }
        
        cluster.coherence = count > 0 ? totalCorrelation / count : 0;
        clusters.push(cluster);
      }
    }
    
    // If we don't have enough clusters, create separate clusters for remaining fields
    if (clusters.length < 2 && assigned.size < fields.length) {
      const remainingFields = fields.filter((_, i) => !assigned.has(i));
      if (remainingFields.length >= minClusterSize) {
        const remainingCluster: FieldCluster = {
          fields: remainingFields,
          centroid: remainingFields.map((_, i) => i < correlationMatrix.length ? correlationMatrix[i] || [] : []).flat(),
          coherence: 0.5 // Default coherence
        };
        clusters.push(remainingCluster);
      }
    }
    
    return clusters;
  }

  private calculateSilhouetteScore(correlationMatrix: number[][], clusters: FieldCluster[]): number {
    // Simplified silhouette score calculation
    if (clusters.length < 2) return 0;
    
    let totalSilhouette = 0;
    let pointCount = 0;
    
    for (const cluster of clusters) {
      for (const field of cluster.fields) {
        // This is a simplified version - in practice would need more complex distance calculations
        const silhouette = cluster.coherence; // Use coherence as proxy for silhouette
        totalSilhouette += silhouette;
        pointCount++;
      }
    }
    
    return pointCount > 0 ? totalSilhouette / pointCount : 0;
  }

  private calculateGrandMean(data: any[], fields: string[]): number {
    let sum = 0;
    let count = 0;
    
    for (const row of data) {
      for (const field of fields) {
        if (row[field] != null) {
          sum += row[field];
          count++;
        }
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  private calculateTotalSumSquares(data: any[], fields: string[], grandMean: number): number {
    let sumSquares = 0;
    
    for (const row of data) {
      for (const field of fields) {
        if (row[field] != null) {
          sumSquares += Math.pow(row[field] - grandMean, 2);
        }
      }
    }
    
    return sumSquares;
  }

  private calculateBetweenGroupsSumSquares(data: any[], fields: string[], grandMean: number): number {
    let sumSquares = 0;
    
    for (const field of fields) {
      const fieldValues = data.map(row => row[field]).filter(val => val != null);
      const fieldMean = fieldValues.reduce((sum, val) => sum + val, 0) / fieldValues.length;
      sumSquares += fieldValues.length * Math.pow(fieldMean - grandMean, 2);
    }
    
    return sumSquares;
  }

  private fTestPValue(fStatistic: number, df1: number, df2: number): number {
    // Simplified F-test p-value calculation
    if (fStatistic > 4) return 0.01;
    if (fStatistic > 3) return 0.05;
    if (fStatistic > 2) return 0.10;
    return 0.20;
  }

  private tTest(x: number[], y: number[]): { tStatistic: number; pValue: number } {
    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;
    
    const varX = x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0) / (x.length - 1);
    const varY = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0) / (y.length - 1);
    
    const pooledVar = ((x.length - 1) * varX + (y.length - 1) * varY) / (x.length + y.length - 2);
    const se = Math.sqrt(pooledVar * (1/x.length + 1/y.length));
    
    const tStatistic = se > 0 ? (meanX - meanY) / se : 0;
    const df = x.length + y.length - 2;
    const pValue = this.tTestPValue(Math.abs(tStatistic), df);
    
    return { tStatistic, pValue };
  }

  private benjaminiHochbergCorrection(
    pairwiseTests: Record<string, Record<string, { tStatistic: number; pValue: number }>>,
    alpha: number
  ): Record<string, number> {
    const pValues: Array<{ key: string; pValue: number }> = [];
    
    for (const fieldA of Object.keys(pairwiseTests)) {
      for (const fieldB of Object.keys(pairwiseTests[fieldA])) {
        pValues.push({
          key: `${fieldA}_${fieldB}`,
          pValue: pairwiseTests[fieldA][fieldB].pValue
        });
      }
    }
    
    pValues.sort((a, b) => a.pValue - b.pValue);
    
    const correctedPValues: Record<string, number> = {};
    const m = pValues.length;
    
    for (let i = 0; i < pValues.length; i++) {
      const criticalValue = ((i + 1) / m) * alpha;
      const adjustedPValue = Math.min(1, pValues[i].pValue * m / (i + 1));
      correctedPValues[pValues[i].key] = adjustedPValue;
    }
    
    return correctedPValues;
  }

  private calculatePower(effectSize: number, sampleSize: number, alpha: number): number {
    // Simplified power calculation
    const zAlpha = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645;
    const zBeta = effectSize * Math.sqrt(sampleSize / 2) - zAlpha;
    
    // Approximate normal CDF
    const power = zBeta > 0 ? 0.5 + 0.4 * Math.tanh(zBeta * 0.8) : 0.5 - 0.4 * Math.tanh(-zBeta * 0.8);
    return Math.max(0, Math.min(1, power));
  }

  private calculateRequiredSampleSize(effectSize: number, power: number, alpha: number): number {
    // Simplified sample size calculation
    const zAlpha = alpha <= 0.01 ? 2.576 : alpha <= 0.05 ? 1.96 : 1.645;
    const zBeta = power >= 0.9 ? 1.282 : power >= 0.8 ? 0.842 : 0.524;
    
    const n = 2 * Math.pow((zAlpha + zBeta) / effectSize, 2);
    return Math.ceil(Math.max(10, n));
  }

  private detectIQROutliers(values: number[]): { outliers: number[]; indices: number[] } {
    if (values.length < 4) {
      return { outliers: [], indices: [] };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    // If IQR is 0, consider values more than 2 standard deviations away
    let lowerBound, upperBound;
    if (iqr === 0) {
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length);
      lowerBound = mean - 2 * std;
      upperBound = mean + 2 * std;
    } else {
      lowerBound = q1 - 1.5 * iqr;
      upperBound = q3 + 1.5 * iqr;
    }
    
    const outliers: number[] = [];
    const indices: number[] = [];
    
    values.forEach((val, i) => {
      if (val < lowerBound || val > upperBound) {
        outliers.push(val);
        indices.push(i);
      }
    });
    
    return { outliers, indices };
  }

  private winsorizeField(data: any[], field: string, outlierInfo: { outliers: number[]; indices: number[] }): void {
    if (outlierInfo.outliers.length === 0) return;
    
    const values = data.map(row => row[field]).filter(val => val != null);
    const sorted = [...values].sort((a, b) => a - b);
    
    const p5 = sorted[Math.floor(sorted.length * 0.05)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    
    for (const row of data) {
      if (row[field] != null) {
        if (row[field] < p5) row[field] = p5;
        if (row[field] > p95) row[field] = p95;
      }
    }
  }
}

export default MultiFieldImpactAssessmentService;