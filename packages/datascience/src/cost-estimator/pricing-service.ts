import { ModelPricing } from '../types';

export class ModelPricingService {
  private static readonly DEFAULT_PRICING: Record<string, ModelPricing> = {
    'gpt-4': {
      inputTokenCost: 0.03,
      outputTokenCost: 0.06,
      currency: 'USD',
      per: 1000
    },
    'gpt-4-turbo': {
      inputTokenCost: 0.01,
      outputTokenCost: 0.03,
      currency: 'USD',
      per: 1000
    },
    'gpt-3.5-turbo': {
      inputTokenCost: 0.0015,
      outputTokenCost: 0.002,
      currency: 'USD',
      per: 1000
    },
    'claude-3-opus': {
      inputTokenCost: 0.015,
      outputTokenCost: 0.075,
      currency: 'USD',
      per: 1000
    },
    'claude-3-sonnet': {
      inputTokenCost: 0.003,
      outputTokenCost: 0.015,
      currency: 'USD',
      per: 1000
    },
    'claude-3-haiku': {
      inputTokenCost: 0.00025,
      outputTokenCost: 0.00125,
      currency: 'USD',
      per: 1000
    }
  };

  static getPricing(modelName: string): ModelPricing {
    const pricing = this.DEFAULT_PRICING[modelName.toLowerCase()];
    
    if (!pricing) {
      console.warn(`Unknown model: ${modelName}. Using GPT-4 pricing as fallback.`);
      return this.DEFAULT_PRICING['gpt-4'];
    }

    return pricing;
  }

  static calculateCost(
    modelName: string, 
    inputTokens: number, 
    outputTokens: number
  ): number {
    const pricing = this.getPricing(modelName);
    
    const inputCost = (inputTokens / pricing.per) * pricing.inputTokenCost;
    const outputCost = (outputTokens / pricing.per) * pricing.outputTokenCost;
    
    return inputCost + outputCost;
  }

  static getAllModels(): string[] {
    return Object.keys(this.DEFAULT_PRICING);
  }

  static updatePricing(modelName: string, pricing: ModelPricing): void {
    this.DEFAULT_PRICING[modelName.toLowerCase()] = pricing;
  }

  static compareCost(
    modelNames: string[], 
    inputTokens: number, 
    outputTokens: number
  ): Array<{ model: string; cost: number; pricing: ModelPricing }> {
    return modelNames.map(model => ({
      model,
      cost: this.calculateCost(model, inputTokens, outputTokens),
      pricing: this.getPricing(model)
    })).sort((a, b) => a.cost - b.cost);
  }
}