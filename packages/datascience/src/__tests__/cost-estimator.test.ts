import { CostEstimator } from '../cost-estimator/estimator';
import { TokenCounter } from '../cost-estimator/token-counter';
import { ModelPricingService } from '../cost-estimator/pricing-service';
import { DataGenerator } from '../generators';

describe('Cost Estimator', () => {
  describe('TokenCounter', () => {
    test('estimates tokens for simple text', () => {
      const text = 'Hello world, this is a test';
      const tokens = TokenCounter.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    test('estimates tokens for empty text', () => {
      expect(TokenCounter.estimateTokens('')).toBe(0);
      expect(TokenCounter.estimateTokens('   ')).toBeGreaterThan(0);
    });

    test('estimates tokens for JSON', () => {
      const obj = { name: 'John', age: 30, active: true };
      const tokens = TokenCounter.estimateTokensForJson(obj);
      
      expect(tokens).toBeGreaterThan(0);
    });

    test('estimates tokens for array', () => {
      const items = ['apple', 'banana', 'cherry'];
      const tokens = TokenCounter.estimateTokensForArray(items);
      
      expect(tokens).toBeGreaterThan(0);
    });

    test('estimates prompt tokens', () => {
      const systemPrompt = 'You are a helpful assistant';
      const userPrompt = 'Analyze this data';
      const context = 'Additional context here';
      
      const tokens = TokenCounter.estimatePromptTokens(systemPrompt, userPrompt, context);
      
      expect(tokens).toBeGreaterThan(0);
    });

    test('estimates completion tokens', () => {
      const expectedLength = 500;
      const tokens = TokenCounter.estimateCompletionTokens(expectedLength);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(expectedLength);
    });
  });

  describe('ModelPricingService', () => {
    test('gets pricing for known models', () => {
      const gpt4Pricing = ModelPricingService.getPricing('gpt-4');
      
      expect(gpt4Pricing.inputTokenCost).toBeGreaterThan(0);
      expect(gpt4Pricing.outputTokenCost).toBeGreaterThan(0);
      expect(gpt4Pricing.currency).toBe('USD');
      expect(gpt4Pricing.per).toBe(1000);
    });

    test('falls back to default pricing for unknown models', () => {
      const unknownPricing = ModelPricingService.getPricing('unknown-model');
      
      expect(unknownPricing).toBeDefined();
      expect(unknownPricing.inputTokenCost).toBeGreaterThan(0);
    });

    test('calculates cost correctly', () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const cost = ModelPricingService.calculateCost('gpt-3.5-turbo', inputTokens, outputTokens);
      
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should be less than $1 for these amounts
    });

    test('gets all available models', () => {
      const models = ModelPricingService.getAllModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('gpt-4');
      expect(models).toContain('claude-3-opus');
    });

    test('compares costs across models', () => {
      const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'];
      const comparison = ModelPricingService.compareCost(models, 1000, 500);
      
      expect(comparison.length).toBe(3);
      expect(comparison[0].cost).toBeLessThanOrEqual(comparison[1].cost);
      expect(comparison[1].cost).toBeLessThanOrEqual(comparison[2].cost);
    });

    test('updates pricing for models', () => {
      const originalPricing = ModelPricingService.getPricing('gpt-4');
      const newPricing = {
        inputTokenCost: 0.05,
        outputTokenCost: 0.10,
        currency: 'USD',
        per: 1000
      };
      
      ModelPricingService.updatePricing('gpt-4', newPricing);
      const updatedPricing = ModelPricingService.getPricing('gpt-4');
      
      expect(updatedPricing.inputTokenCost).toBe(0.05);
      expect(updatedPricing.outputTokenCost).toBe(0.10);
      
      // Restore original pricing
      ModelPricingService.updatePricing('gpt-4', originalPricing);
    });
  });

  describe('CostEstimator', () => {
    test('estimates dataset processing cost', () => {
      const dataset = DataGenerator.generate({
        type: 'users',
        recordCount: 100,
        name: 'test-users'
      });
      
      const estimate = CostEstimator.estimateDatasetProcessing(dataset, {
        modelName: 'gpt-3.5-turbo',
        expectedResponseLength: 300
      });
      
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThan(0);
      expect(estimate.breakdown.inputTokens).toBeGreaterThan(0);
      expect(estimate.breakdown.outputTokens).toBeGreaterThan(0);
    });

    test('estimates field inference cost', () => {
      const sampleValues = [
        'user@example.com',
        'test@domain.org',
        'admin@site.net'
      ];
      
      const estimate = CostEstimator.estimateFieldInference('email_field', sampleValues, {
        modelName: 'claude-3-sonnet'
      });
      
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThan(0.8);
    });

    test('estimates batch processing cost', () => {
      const items = ['item1', 'item2', 'item3', 'item4', 'item5'];
      const itemProcessor = (item: string) => `Process: ${item}`;
      
      const estimate = CostEstimator.estimateBatchProcessing(items, itemProcessor, {
        modelName: 'gpt-4',
        batchSize: 2,
        expectedResponseLength: 100
      });
      
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThan(0);
    });

    test('handles different model pricing', () => {
      const dataset = DataGenerator.generate({
        type: 'mixed',
        recordCount: 50,
        name: 'test-mixed'
      });
      
      const expensiveEstimate = CostEstimator.estimateDatasetProcessing(dataset, {
        modelName: 'gpt-4'
      });
      
      const cheapEstimate = CostEstimator.estimateDatasetProcessing(dataset, {
        modelName: 'gpt-3.5-turbo'
      });
      
      expect(expensiveEstimate.estimatedCost).toBeGreaterThan(cheapEstimate.estimatedCost);
    });

    test('includes overhead calculations', () => {
      const values = ['test1', 'test2', 'test3'];
      
      const withOverhead = CostEstimator.estimateFieldInference('test_field', values, {
        modelName: 'gpt-4',
        includeOverhead: true
      });
      
      const withoutOverhead = CostEstimator.estimateFieldInference('test_field', values, {
        modelName: 'gpt-4',
        includeOverhead: false
      });
      
      expect(withOverhead.estimatedCost).toBeGreaterThan(withoutOverhead.estimatedCost);
    });

    test('handles custom system prompts', () => {
      const values = ['a', 'b', 'c'];
      const customPrompt = 'This is a very long custom system prompt that should increase the token count significantly because it contains many more words than the default prompt';
      
      const customEstimate = CostEstimator.estimateFieldInference('test_field', values, {
        modelName: 'gpt-4',
        systemPrompt: customPrompt
      });
      
      const defaultEstimate = CostEstimator.estimateFieldInference('test_field', values, {
        modelName: 'gpt-4'
      });
      
      expect(customEstimate.estimatedCost).toBeGreaterThan(defaultEstimate.estimatedCost);
    });

    test('estimates large dataset processing', () => {
      const largeDataset = DataGenerator.generate({
        type: 'logs',
        recordCount: 1000,
        name: 'large-logs'
      });
      
      const estimate = CostEstimator.estimateDatasetProcessing(largeDataset, {
        modelName: 'claude-3-haiku',
        batchSize: 50
      });
      
      expect(estimate.estimatedTokens).toBeGreaterThan(10000);
      expect(estimate.estimatedCost).toBeGreaterThan(0.01);
    });
  });
});