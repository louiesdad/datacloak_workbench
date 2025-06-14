export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'phone' | 'json' | 'array' | 'object' | 'null' | 'undefined' | 'mixed';
export interface FieldStatistics {
    nullCount: number;
    uniqueCount: number;
    totalCount: number;
    minLength?: number;
    maxLength?: number;
    avgLength?: number;
    minValue?: number;
    maxValue?: number;
    avgValue?: number;
    patterns?: PatternMatch[];
}
export interface PatternMatch {
    pattern: RegExp;
    name: string;
    confidence: number;
    matchCount: number;
}
export interface InferenceResult {
    fieldName: string;
    inferredType: FieldType;
    confidence: number;
    statistics: FieldStatistics;
    subTypes?: FieldType[];
    format?: string;
}
export interface CostEstimate {
    estimatedTokens: number;
    estimatedCost: number;
    confidence: number;
    breakdown: CostBreakdown;
}
export interface CostBreakdown {
    inputTokens: number;
    outputTokens: number;
    systemPromptTokens: number;
    completionTokens: number;
}
export interface ModelPricing {
    inputTokenCost: number;
    outputTokenCost: number;
    currency: string;
    per: number;
}
export interface Dataset {
    name: string;
    fields: Record<string, any[]>;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=index.d.ts.map