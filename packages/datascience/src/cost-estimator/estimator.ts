import { CostEstimate, CostBreakdown, Dataset } from '../types';
import { TokenCounter } from './token-counter';
import { ModelPricingService } from './pricing-service';

export interface EstimationParams {
  modelName: string;
  systemPrompt?: string;
  expectedResponseLength?: number;
  batchSize?: number;
  includeOverhead?: boolean;
}

export class CostEstimator {
  static estimateDatasetProcessing(
    dataset: Dataset,
    params: EstimationParams
  ): CostEstimate {
    const {
      modelName,
      systemPrompt = 'You are a helpful assistant.',
      expectedResponseLength = 500,
      batchSize = 1,
      includeOverhead = true
    } = params;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const systemPromptTokens = TokenCounter.estimateTokens(systemPrompt);

    for (const [fieldName, values] of Object.entries(dataset.fields)) {
      const fieldPrompt = this.buildFieldAnalysisPrompt(fieldName, values.slice(0, 100));
      const promptTokens = TokenCounter.estimatePromptTokens(systemPrompt, fieldPrompt);
      const completionTokens = TokenCounter.estimateCompletionTokens(expectedResponseLength);

      const batches = Math.ceil(values.length / batchSize);
      totalInputTokens += promptTokens * batches;
      totalOutputTokens += completionTokens * batches;
    }

    if (includeOverhead) {
      totalInputTokens *= 1.1;
      totalOutputTokens *= 1.05;
    }

    const estimatedCost = ModelPricingService.calculateCost(
      modelName,
      totalInputTokens,
      totalOutputTokens
    );

    const breakdown: CostBreakdown = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      systemPromptTokens,
      completionTokens: totalOutputTokens
    };

    return {
      estimatedTokens: totalInputTokens + totalOutputTokens,
      estimatedCost,
      confidence: 0.85,
      breakdown
    };
  }

  static estimateFieldInference(
    fieldName: string,
    sampleValues: any[],
    params: EstimationParams
  ): CostEstimate {
    const {
      modelName,
      systemPrompt = 'Analyze the field type and characteristics.',
      expectedResponseLength = 300,
      includeOverhead = true
    } = params;

    const fieldPrompt = this.buildFieldAnalysisPrompt(fieldName, sampleValues);
    const inputTokens = TokenCounter.estimatePromptTokens(systemPrompt, fieldPrompt);
    const outputTokens = TokenCounter.estimateCompletionTokens(expectedResponseLength);

    let finalInputTokens = inputTokens;
    let finalOutputTokens = outputTokens;

    if (includeOverhead) {
      finalInputTokens *= 1.1;
      finalOutputTokens *= 1.05;
    }

    const estimatedCost = ModelPricingService.calculateCost(
      modelName,
      finalInputTokens,
      finalOutputTokens
    );

    const breakdown: CostBreakdown = {
      inputTokens: finalInputTokens,
      outputTokens: finalOutputTokens,
      systemPromptTokens: TokenCounter.estimateTokens(systemPrompt),
      completionTokens: finalOutputTokens
    };

    return {
      estimatedTokens: finalInputTokens + finalOutputTokens,
      estimatedCost,
      confidence: 0.9,
      breakdown
    };
  }

  static estimateBatchProcessing(
    items: any[],
    itemProcessor: (item: any) => string,
    params: EstimationParams
  ): CostEstimate {
    const {
      modelName,
      systemPrompt = 'Process the following items.',
      expectedResponseLength = 200,
      batchSize = 10,
      includeOverhead = true
    } = params;

    const batches = Math.ceil(items.length / batchSize);
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < batches; i++) {
      const batchItems = items.slice(i * batchSize, (i + 1) * batchSize);
      const batchContent = batchItems.map(itemProcessor).join('\n---\n');
      
      const promptTokens = TokenCounter.estimatePromptTokens(systemPrompt, batchContent);
      const completionTokens = TokenCounter.estimateCompletionTokens(
        expectedResponseLength * batchItems.length
      );

      totalInputTokens += promptTokens;
      totalOutputTokens += completionTokens;
    }

    if (includeOverhead) {
      totalInputTokens *= 1.15;
      totalOutputTokens *= 1.1;
    }

    const estimatedCost = ModelPricingService.calculateCost(
      modelName,
      totalInputTokens,
      totalOutputTokens
    );

    const breakdown: CostBreakdown = {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      systemPromptTokens: TokenCounter.estimateTokens(systemPrompt),
      completionTokens: totalOutputTokens
    };

    return {
      estimatedTokens: totalInputTokens + totalOutputTokens,
      estimatedCost,
      confidence: 0.8,
      breakdown
    };
  }

  private static buildFieldAnalysisPrompt(fieldName: string, values: any[]): string {
    const sampleSize = Math.min(values.length, 50);
    const sample = values.slice(0, sampleSize);
    
    return `Analyze the field "${fieldName}" with the following sample values:\n\n${
      sample.map((v, i) => `${i + 1}. ${JSON.stringify(v)}`).join('\n')
    }\n\nDetermine the field type, patterns, and statistical characteristics.`;
  }
}