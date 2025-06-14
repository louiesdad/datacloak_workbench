"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostEstimator = void 0;
const token_counter_1 = require("./token-counter");
const pricing_service_1 = require("./pricing-service");
class CostEstimator {
    static estimateDatasetProcessing(dataset, params) {
        const { modelName, systemPrompt = 'You are a helpful assistant.', expectedResponseLength = 500, batchSize = 1, includeOverhead = true } = params;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const systemPromptTokens = token_counter_1.TokenCounter.estimateTokens(systemPrompt);
        for (const [fieldName, values] of Object.entries(dataset.fields)) {
            const fieldPrompt = this.buildFieldAnalysisPrompt(fieldName, values.slice(0, 100));
            const promptTokens = token_counter_1.TokenCounter.estimatePromptTokens(systemPrompt, fieldPrompt);
            const completionTokens = token_counter_1.TokenCounter.estimateCompletionTokens(expectedResponseLength);
            const batches = Math.ceil(values.length / batchSize);
            totalInputTokens += promptTokens * batches;
            totalOutputTokens += completionTokens * batches;
        }
        if (includeOverhead) {
            totalInputTokens *= 1.1;
            totalOutputTokens *= 1.05;
        }
        const estimatedCost = pricing_service_1.ModelPricingService.calculateCost(modelName, totalInputTokens, totalOutputTokens);
        const breakdown = {
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
    static estimateFieldInference(fieldName, sampleValues, params) {
        const { modelName, systemPrompt = 'Analyze the field type and characteristics.', expectedResponseLength = 300, includeOverhead = true } = params;
        const fieldPrompt = this.buildFieldAnalysisPrompt(fieldName, sampleValues);
        const inputTokens = token_counter_1.TokenCounter.estimatePromptTokens(systemPrompt, fieldPrompt);
        const outputTokens = token_counter_1.TokenCounter.estimateCompletionTokens(expectedResponseLength);
        let finalInputTokens = inputTokens;
        let finalOutputTokens = outputTokens;
        if (includeOverhead) {
            finalInputTokens *= 1.1;
            finalOutputTokens *= 1.05;
        }
        const estimatedCost = pricing_service_1.ModelPricingService.calculateCost(modelName, finalInputTokens, finalOutputTokens);
        const breakdown = {
            inputTokens: finalInputTokens,
            outputTokens: finalOutputTokens,
            systemPromptTokens: token_counter_1.TokenCounter.estimateTokens(systemPrompt),
            completionTokens: finalOutputTokens
        };
        return {
            estimatedTokens: finalInputTokens + finalOutputTokens,
            estimatedCost,
            confidence: 0.9,
            breakdown
        };
    }
    static estimateBatchProcessing(items, itemProcessor, params) {
        const { modelName, systemPrompt = 'Process the following items.', expectedResponseLength = 200, batchSize = 10, includeOverhead = true } = params;
        const batches = Math.ceil(items.length / batchSize);
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        for (let i = 0; i < batches; i++) {
            const batchItems = items.slice(i * batchSize, (i + 1) * batchSize);
            const batchContent = batchItems.map(itemProcessor).join('\n---\n');
            const promptTokens = token_counter_1.TokenCounter.estimatePromptTokens(systemPrompt, batchContent);
            const completionTokens = token_counter_1.TokenCounter.estimateCompletionTokens(expectedResponseLength * batchItems.length);
            totalInputTokens += promptTokens;
            totalOutputTokens += completionTokens;
        }
        if (includeOverhead) {
            totalInputTokens *= 1.15;
            totalOutputTokens *= 1.1;
        }
        const estimatedCost = pricing_service_1.ModelPricingService.calculateCost(modelName, totalInputTokens, totalOutputTokens);
        const breakdown = {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            systemPromptTokens: token_counter_1.TokenCounter.estimateTokens(systemPrompt),
            completionTokens: totalOutputTokens
        };
        return {
            estimatedTokens: totalInputTokens + totalOutputTokens,
            estimatedCost,
            confidence: 0.8,
            breakdown
        };
    }
    static buildFieldAnalysisPrompt(fieldName, values) {
        const sampleSize = Math.min(values.length, 50);
        const sample = values.slice(0, sampleSize);
        return `Analyze the field "${fieldName}" with the following sample values:\n\n${sample.map((v, i) => `${i + 1}. ${JSON.stringify(v)}`).join('\n')}\n\nDetermine the field type, patterns, and statistical characteristics.`;
    }
}
exports.CostEstimator = CostEstimator;
//# sourceMappingURL=estimator.js.map