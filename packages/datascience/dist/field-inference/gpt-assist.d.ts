import { FieldType, InferenceResult } from '../types';
export interface GPTAssistConfig {
    confidenceThreshold: number;
    maxSampleSize: number;
    modelName: string;
    apiKey?: string;
    enableCostEstimation: boolean;
}
export interface GPTAssistResult {
    inferredType: FieldType;
    confidence: number;
    reasoning: string;
    format?: string;
    estimatedCost: number;
}
export declare class GPTAssist {
    private config;
    constructor(config?: Partial<GPTAssistConfig>);
    enhanceInference(fieldName: string, values: any[], heuristicResult: InferenceResult): Promise<InferenceResult>;
    analyzeWithGPT(fieldName: string, values: any[]): Promise<GPTAssistResult>;
    private prepareSample;
    private buildAnalysisPrompt;
    private callGPTAPI;
    private mockGPTAnalysis;
    private performMockAnalysis;
    private detectDateFormat;
    private combineSubTypes;
    shouldUseGPTAssist(result: InferenceResult): boolean;
    updateConfig(newConfig: Partial<GPTAssistConfig>): void;
    getConfig(): GPTAssistConfig;
}
//# sourceMappingURL=gpt-assist.d.ts.map