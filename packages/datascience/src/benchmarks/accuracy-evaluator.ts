import { FieldType, InferenceResult, Dataset } from '../types';

export interface GroundTruth {
  fieldName: string;
  actualType: FieldType;
  format?: string;
  expectedPatterns?: string[];
}

export interface AccuracyMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  confusionMatrix: ConfusionMatrix;
  typeSpecificMetrics: Record<FieldType, TypeMetrics>;
}

export interface TypeMetrics {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ConfusionMatrix {
  matrix: Record<FieldType, Record<FieldType, number>>;
  totalPredictions: number;
}

export interface BenchmarkCase {
  dataset: Dataset;
  groundTruth: GroundTruth[];
  name: string;
  description?: string;
}

export class AccuracyEvaluator {
  static evaluate(predictions: InferenceResult[], groundTruth: GroundTruth[]): AccuracyMetrics {
    const truthMap = new Map(groundTruth.map(gt => [gt.fieldName, gt]));
    const validPredictions = predictions.filter(p => truthMap.has(p.fieldName));

    if (validPredictions.length === 0) {
      throw new Error('No matching predictions found for ground truth');
    }

    const confusionMatrix = this.buildConfusionMatrix(validPredictions, truthMap);
    const typeSpecificMetrics = this.calculateTypeSpecificMetrics(confusionMatrix);
    
    const overallMetrics = this.calculateOverallMetrics(typeSpecificMetrics);

    return {
      ...overallMetrics,
      confusionMatrix,
      typeSpecificMetrics
    };
  }

  static evaluateMultiple(benchmarkCases: BenchmarkCase[], inferenceFunction: (dataset: Dataset) => Promise<InferenceResult[]>): Promise<AccuracyMetrics[]> {
    return Promise.all(
      benchmarkCases.map(async (benchmarkCase) => {
        const predictions = await inferenceFunction(benchmarkCase.dataset);
        return this.evaluate(predictions, benchmarkCase.groundTruth);
      })
    );
  }

  static compareConfidence(predictions: InferenceResult[], groundTruth: GroundTruth[]): {
    correctHighConfidence: number;
    correctLowConfidence: number;
    incorrectHighConfidence: number;
    incorrectLowConfidence: number;
    averageConfidenceCorrect: number;
    averageConfidenceIncorrect: number;
  } {
    const truthMap = new Map(groundTruth.map(gt => [gt.fieldName, gt]));
    const validPredictions = predictions.filter(p => truthMap.has(p.fieldName));

    let correctHighConf = 0, correctLowConf = 0;
    let incorrectHighConf = 0, incorrectLowConf = 0;
    let correctConfidenceSum = 0, incorrectConfidenceSum = 0;
    let correctCount = 0, incorrectCount = 0;

    const confidenceThreshold = 0.7;

    for (const prediction of validPredictions) {
      const truth = truthMap.get(prediction.fieldName);
      const isCorrect = truth?.actualType === prediction.inferredType;
      const isHighConfidence = prediction.confidence >= confidenceThreshold;

      if (isCorrect) {
        correctCount++;
        correctConfidenceSum += prediction.confidence;
        if (isHighConfidence) correctHighConf++;
        else correctLowConf++;
      } else {
        incorrectCount++;
        incorrectConfidenceSum += prediction.confidence;
        if (isHighConfidence) incorrectHighConf++;
        else incorrectLowConf++;
      }
    }

    return {
      correctHighConfidence: correctHighConf,
      correctLowConfidence: correctLowConf,
      incorrectHighConfidence: incorrectHighConf,
      incorrectLowConfidence: incorrectLowConf,
      averageConfidenceCorrect: correctCount > 0 ? correctConfidenceSum / correctCount : 0,
      averageConfidenceIncorrect: incorrectCount > 0 ? incorrectConfidenceSum / incorrectCount : 0
    };
  }

  private static buildConfusionMatrix(
    predictions: InferenceResult[], 
    truthMap: Map<string, GroundTruth>
  ): ConfusionMatrix {
    const allTypes: FieldType[] = [
      'string', 'number', 'boolean', 'date', 'email', 'url', 'phone', 
      'json', 'array', 'object', 'null', 'undefined', 'mixed'
    ];
    
    const matrix: Record<FieldType, Record<FieldType, number>> = {};
    
    for (const actualType of allTypes) {
      matrix[actualType] = {};
      for (const predictedType of allTypes) {
        matrix[actualType][predictedType] = 0;
      }
    }

    for (const prediction of predictions) {
      const truth = truthMap.get(prediction.fieldName);
      if (truth) {
        matrix[truth.actualType][prediction.inferredType]++;
      }
    }

    return {
      matrix,
      totalPredictions: predictions.length
    };
  }

  private static calculateTypeSpecificMetrics(confusionMatrix: ConfusionMatrix): Record<FieldType, TypeMetrics> {
    const metrics: Record<FieldType, TypeMetrics> = {} as Record<FieldType, TypeMetrics>;
    const { matrix } = confusionMatrix;

    for (const actualType of Object.keys(matrix) as FieldType[]) {
      let truePositives = matrix[actualType][actualType] || 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      for (const predictedType of Object.keys(matrix[actualType]) as FieldType[]) {
        if (predictedType !== actualType) {
          falseNegatives += matrix[actualType][predictedType];
        }
      }

      for (const otherActualType of Object.keys(matrix) as FieldType[]) {
        if (otherActualType !== actualType) {
          falsePositives += matrix[otherActualType][actualType] || 0;
        }
      }

      const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
      const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
      const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      metrics[actualType] = {
        truePositives,
        falsePositives,
        falseNegatives,
        precision,
        recall,
        f1Score
      };
    }

    return metrics;
  }

  private static calculateOverallMetrics(typeMetrics: Record<FieldType, TypeMetrics>): {
    precision: number;
    recall: number;
    f1Score: number;
    accuracy: number;
  } {
    const metrics = Object.values(typeMetrics);
    const totalTP = metrics.reduce((sum, m) => sum + m.truePositives, 0);
    const totalFP = metrics.reduce((sum, m) => sum + m.falsePositives, 0);
    const totalFN = metrics.reduce((sum, m) => sum + m.falseNegatives, 0);

    const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
    const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const accuracy = totalTP / (totalTP + totalFP + totalFN);

    return { precision, recall, f1Score, accuracy };
  }
}