import { AppError } from '../middleware/error.middleware';

export interface CostEstimationRequest {
  textCount: number;
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo' | 'claude-3' | 'text-davinci-003';
  averageTextLength?: number;
  includePIIProcessing?: boolean;
}

export interface CostEstimationResult {
  totalCost: number;
  costBreakdown: {
    sentimentAnalysis: number;
    piiProcessing?: number;
    dataProcessing: number;
  };
  estimatedTokens: number;
  processingTime: {
    estimated: number; // in seconds
    range: {
      min: number;
      max: number;
    };
  };
  recommendations: string[];
  limits: {
    maxTextsPerBatch: number;
    estimatedMemoryUsage: string;
  };
}

export class CostEstimationService {
  // Token pricing per 1K tokens (USD)
  private readonly MODEL_PRICING = {
    'gpt-3.5-turbo': {
      input: 0.0015,
      output: 0.002
    },
    'gpt-4': {
      input: 0.03,
      output: 0.06
    },
    'gpt-4-turbo': {
      input: 0.01,
      output: 0.03
    },
    'claude-3': {
      input: 0.015,
      output: 0.075
    },
    'text-davinci-003': {
      input: 0.02,
      output: 0.02
    }
  };

  // Base processing costs (per text analyzed)
  private readonly BASE_PROCESSING_COST = {
    sentimentAnalysis: 0.001, // $0.001 per text
    piiProcessing: 0.0005,   // $0.0005 per text for PII scanning
    dataProcessing: 0.0001   // $0.0001 per text for data handling
  };

  async estimateCost(request: CostEstimationRequest): Promise<CostEstimationResult> {
    if (!request.textCount || request.textCount <= 0) {
      throw new AppError('Text count must be greater than 0', 400, 'INVALID_TEXT_COUNT');
    }

    if (request.textCount > 100000) {
      throw new AppError('Text count exceeds maximum limit of 100,000', 400, 'TEXT_COUNT_TOO_LARGE');
    }

    if (!this.MODEL_PRICING[request.model]) {
      throw new AppError(`Unsupported model: ${request.model}`, 400, 'UNSUPPORTED_MODEL');
    }

    const modelPricing = this.MODEL_PRICING[request.model];
    const averageTextLength = request.averageTextLength || 100; // Default 100 characters
    
    // Estimate tokens (rough approximation: 4 characters = 1 token)
    const estimatedTokensPerText = Math.ceil(averageTextLength / 4);
    const totalTokens = estimatedTokensPerText * request.textCount;
    
    // Calculate sentiment analysis prompt tokens (system prompt + user text)
    const systemPromptTokens = 50; // Estimated system prompt size
    const inputTokensPerText = systemPromptTokens + estimatedTokensPerText;
    const outputTokensPerText = 10; // Short sentiment response
    
    const totalInputTokens = inputTokensPerText * request.textCount;
    const totalOutputTokens = outputTokensPerText * request.textCount;
    
    // Calculate API costs
    const apiCost = (totalInputTokens / 1000) * modelPricing.input + 
                   (totalOutputTokens / 1000) * modelPricing.output;
    
    // Calculate processing costs
    const sentimentProcessingCost = request.textCount * this.BASE_PROCESSING_COST.sentimentAnalysis;
    const piiProcessingCost = request.includePIIProcessing 
      ? request.textCount * this.BASE_PROCESSING_COST.piiProcessing 
      : 0;
    const dataProcessingCost = request.textCount * this.BASE_PROCESSING_COST.dataProcessing;
    
    const totalCost = apiCost + sentimentProcessingCost + piiProcessingCost + dataProcessingCost;
    
    // Estimate processing time (based on API rate limits and processing speed)
    const estimatedTimePerText = this.getProcessingTimePerText(request.model);
    const totalEstimatedTime = estimatedTimePerText * request.textCount;
    const timeRange = {
      min: Math.floor(totalEstimatedTime * 0.8), // 20% faster
      max: Math.ceil(totalEstimatedTime * 1.5)   // 50% slower
    };
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(request, totalCost, totalEstimatedTime);
    
    // Calculate limits
    const limits = this.calculateLimits(request);
    
    return {
      totalCost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
      costBreakdown: {
        sentimentAnalysis: Math.round((apiCost + sentimentProcessingCost) * 100) / 100,
        piiProcessing: piiProcessingCost > 0 ? Math.round(piiProcessingCost * 100) / 100 : undefined,
        dataProcessing: Math.round(dataProcessingCost * 100) / 100
      },
      estimatedTokens: totalTokens,
      processingTime: {
        estimated: Math.round(totalEstimatedTime),
        range: timeRange
      },
      recommendations,
      limits
    };
  }

  private getProcessingTimePerText(model: string): number {
    // Processing time per text in seconds (including API latency)
    const baseTimes = {
      'gpt-3.5-turbo': 0.5,
      'gpt-4': 2.0,
      'gpt-4-turbo': 1.0,
      'claude-3': 1.5,
      'text-davinci-003': 1.2
    };
    return baseTimes[model as keyof typeof baseTimes] || 1.0;
  }

  private generateRecommendations(
    request: CostEstimationRequest, 
    totalCost: number, 
    totalTime: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Cost-based recommendations
    if (totalCost > 100) {
      recommendations.push('Consider using a more cost-effective model like gpt-3.5-turbo for large datasets');
    }
    
    if (request.textCount > 10000) {
      recommendations.push('Process texts in smaller batches to reduce memory usage and improve reliability');
    }
    
    if (totalTime > 3600) { // More than 1 hour
      recommendations.push('Consider processing during off-peak hours for better performance');
    }
    
    if (request.model === 'gpt-4' && request.textCount > 1000) {
      recommendations.push('GPT-4 is expensive for large volumes. Consider GPT-3.5-turbo for cost savings');
    }
    
    if (!request.includePIIProcessing) {
      recommendations.push('Enable PII processing to ensure data privacy compliance');
    }
    
    // Performance recommendations
    if (request.textCount > 50000) {
      recommendations.push('Use streaming processing for large datasets to handle memory efficiently');
    }
    
    return recommendations;
  }

  private calculateLimits(request: CostEstimationRequest): { maxTextsPerBatch: number; estimatedMemoryUsage: string } {
    // Calculate safe batch size based on model and text count
    const modelLimits = {
      'gpt-3.5-turbo': 1000,
      'gpt-4': 500,
      'gpt-4-turbo': 750,
      'claude-3': 600,
      'text-davinci-003': 400
    };
    
    const maxTextsPerBatch = Math.min(
      modelLimits[request.model] || 500,
      Math.max(100, Math.floor(request.textCount / 10))
    );
    
    // Estimate memory usage (rough calculation)
    const averageTextLength = request.averageTextLength || 100;
    const estimatedMemoryMB = Math.ceil((request.textCount * averageTextLength * 2) / 1024 / 1024);
    
    return {
      maxTextsPerBatch,
      estimatedMemoryUsage: `${estimatedMemoryMB}MB`
    };
  }

  async getCostForModel(textCount: number, model: string): Promise<number> {
    const request: CostEstimationRequest = {
      textCount,
      model: model as any,
      averageTextLength: 100,
      includePIIProcessing: true
    };
    
    const estimation = await this.estimateCost(request);
    return estimation.totalCost;
  }

  async compareCosts(textCount: number): Promise<{
    model: string;
    cost: number;
    processingTime: number;
    recommended?: boolean;
  }[]> {
    const models = Object.keys(this.MODEL_PRICING);
    const comparisons = [];
    
    for (const model of models) {
      try {
        const estimation = await this.estimateCost({
          textCount,
          model: model as any,
          averageTextLength: 100,
          includePIIProcessing: true
        });
        
        comparisons.push({
          model,
          cost: estimation.totalCost,
          processingTime: estimation.processingTime.estimated,
          recommended: false
        });
      } catch (error) {
        // Skip unsupported models
      }
    }
    
    // Mark the most cost-effective option as recommended
    if (comparisons.length > 0) {
      const cheapest = comparisons.reduce((prev, current) => 
        prev.cost < current.cost ? prev : current
      );
      cheapest.recommended = true;
    }
    
    return comparisons.sort((a, b) => a.cost - b.cost);
  }
}