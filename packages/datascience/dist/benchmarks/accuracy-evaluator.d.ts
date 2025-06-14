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
export declare class AccuracyEvaluator {
    static evaluate(predictions: InferenceResult[], groundTruth: GroundTruth[]): AccuracyMetrics;
    static evaluateMultiple(benchmarkCases: BenchmarkCase[], inferenceFunction: (dataset: Dataset) => Promise<InferenceResult[]>): Promise<AccuracyMetrics[]>;
    static compareConfidence(predictions: InferenceResult[], groundTruth: GroundTruth[]): {
        correctHighConfidence: number;
        correctLowConfidence: number;
        incorrectHighConfidence: number;
        incorrectLowConfidence: number;
        averageConfidenceCorrect: number;
        averageConfidenceIncorrect: number;
    };
    private static buildConfusionMatrix;
    private static calculateTypeSpecificMetrics;
    private static calculateOverallMetrics;
}
//# sourceMappingURL=accuracy-evaluator.d.ts.map