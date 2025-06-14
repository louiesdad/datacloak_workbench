import { CostEstimate, Dataset } from '../types';
export interface EstimationParams {
    modelName: string;
    systemPrompt?: string;
    expectedResponseLength?: number;
    batchSize?: number;
    includeOverhead?: boolean;
}
export declare class CostEstimator {
    static estimateDatasetProcessing(dataset: Dataset, params: EstimationParams): CostEstimate;
    static estimateFieldInference(fieldName: string, sampleValues: any[], params: EstimationParams): CostEstimate;
    static estimateBatchProcessing(items: any[], itemProcessor: (item: any) => string, params: EstimationParams): CostEstimate;
    private static buildFieldAnalysisPrompt;
}
//# sourceMappingURL=estimator.d.ts.map