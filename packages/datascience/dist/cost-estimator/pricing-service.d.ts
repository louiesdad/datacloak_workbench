import { ModelPricing } from '../types';
export declare class ModelPricingService {
    private static readonly DEFAULT_PRICING;
    static getPricing(modelName: string): ModelPricing;
    static calculateCost(modelName: string, inputTokens: number, outputTokens: number): number;
    static getAllModels(): string[];
    static updatePricing(modelName: string, pricing: ModelPricing): void;
    static compareCost(modelNames: string[], inputTokens: number, outputTokens: number): Array<{
        model: string;
        cost: number;
        pricing: ModelPricing;
    }>;
}
//# sourceMappingURL=pricing-service.d.ts.map