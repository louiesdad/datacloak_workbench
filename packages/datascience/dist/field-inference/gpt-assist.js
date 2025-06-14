"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GPTAssist = void 0;
const cost_estimator_1 = require("../cost-estimator");
class GPTAssist {
    config;
    constructor(config = {}) {
        this.config = {
            confidenceThreshold: 0.7,
            maxSampleSize: 20,
            modelName: 'gpt-3.5-turbo',
            enableCostEstimation: true,
            ...config
        };
    }
    async enhanceInference(fieldName, values, heuristicResult) {
        if (heuristicResult.confidence >= this.config.confidenceThreshold) {
            return heuristicResult;
        }
        const gptResult = await this.analyzeWithGPT(fieldName, values);
        return {
            ...heuristicResult,
            inferredType: gptResult.inferredType,
            confidence: Math.max(heuristicResult.confidence, gptResult.confidence),
            format: gptResult.format || heuristicResult.format,
            subTypes: this.combineSubTypes(heuristicResult.subTypes, [gptResult.inferredType])
        };
    }
    async analyzeWithGPT(fieldName, values) {
        const sample = this.prepareSample(values);
        const prompt = this.buildAnalysisPrompt(fieldName, sample);
        const costEstimate = this.config.enableCostEstimation
            ? cost_estimator_1.CostEstimator.estimateFieldInference(fieldName, sample, {
                modelName: this.config.modelName
            })
            : { estimatedCost: 0 };
        if (this.config.apiKey) {
            try {
                const result = await this.callGPTAPI(prompt);
                return {
                    ...result,
                    estimatedCost: costEstimate.estimatedCost
                };
            }
            catch (error) {
                console.warn('GPT API call failed, falling back to mock analysis:', error);
            }
        }
        return this.mockGPTAnalysis(fieldName, sample, costEstimate.estimatedCost);
    }
    prepareSample(values) {
        const nonNullValues = values.filter(v => v !== null && v !== undefined);
        const sampleSize = Math.min(nonNullValues.length, this.config.maxSampleSize);
        const sample = [];
        const step = Math.max(1, Math.floor(nonNullValues.length / sampleSize));
        for (let i = 0; i < nonNullValues.length && sample.length < sampleSize; i += step) {
            sample.push(nonNullValues[i]);
        }
        return sample;
    }
    buildAnalysisPrompt(fieldName, sample) {
        return `Analyze the field "${fieldName}" and determine its most likely data type and format.

Sample values:
${sample.map((v, i) => `${i + 1}. ${JSON.stringify(v)}`).join('\n')}

Consider these data types:
- string: Plain text
- number: Numeric values (integer or decimal)
- boolean: True/false values
- date: Date/time values in any format
- email: Email addresses
- url: Web URLs
- phone: Phone numbers
- json: JSON objects or arrays
- array: Array values
- object: Object values
- null: Null/empty values
- mixed: Multiple inconsistent types

Respond with a JSON object containing:
{
  "type": "detected_type",
  "confidence": 0.95,
  "reasoning": "explanation of why this type was chosen",
  "format": "specific format if applicable (e.g., 'YYYY-MM-DD', 'email', 'UUID')"
}

Focus on the most common pattern in the sample and provide confidence between 0.0 and 1.0.`;
    }
    async callGPTAPI(prompt) {
        // This would be the actual OpenAI API call
        // For now, we'll mock it since we don't have actual API integration
        throw new Error('Actual GPT API integration not implemented');
    }
    mockGPTAnalysis(fieldName, sample, estimatedCost) {
        const analysis = this.performMockAnalysis(fieldName, sample);
        return {
            inferredType: analysis.type,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            format: analysis.format,
            estimatedCost
        };
    }
    performMockAnalysis(fieldName, sample) {
        const fieldNameLower = fieldName.toLowerCase();
        const sampleStrings = sample.map(v => String(v).toLowerCase());
        // Enhanced heuristics based on field name and patterns
        if (fieldNameLower.includes('email') || sampleStrings.some(s => s.includes('@'))) {
            return {
                type: 'email',
                confidence: 0.95,
                reasoning: 'Field name suggests email and samples contain @ symbols',
                format: 'email'
            };
        }
        if (fieldNameLower.includes('phone') || fieldNameLower.includes('tel')) {
            return {
                type: 'phone',
                confidence: 0.9,
                reasoning: 'Field name indicates phone number',
                format: 'phone'
            };
        }
        if (fieldNameLower.includes('url') || fieldNameLower.includes('link') ||
            sampleStrings.some(s => s.startsWith('http'))) {
            return {
                type: 'url',
                confidence: 0.9,
                reasoning: 'Field name or values suggest URL format',
                format: 'url'
            };
        }
        if (fieldNameLower.includes('date') || fieldNameLower.includes('time') ||
            fieldNameLower.includes('created') || fieldNameLower.includes('updated')) {
            return {
                type: 'date',
                confidence: 0.85,
                reasoning: 'Field name suggests date/time information',
                format: this.detectDateFormat(sample)
            };
        }
        if (fieldNameLower.includes('id') && sampleStrings.every(s => /^[a-f0-9-]{36}$/.test(s))) {
            return {
                type: 'string',
                confidence: 0.9,
                reasoning: 'UUID format detected in ID field',
                format: 'UUID'
            };
        }
        // Analyze actual data patterns
        if (sample.every(v => typeof v === 'number' || !isNaN(Number(v)))) {
            return {
                type: 'number',
                confidence: 0.85,
                reasoning: 'All values are numeric or can be converted to numbers',
                format: sample.some(v => String(v).includes('.')) ? 'decimal' : 'integer'
            };
        }
        if (sample.every(v => typeof v === 'boolean' || v === 'true' || v === 'false')) {
            return {
                type: 'boolean',
                confidence: 0.9,
                reasoning: 'All values are boolean or boolean-like strings'
            };
        }
        return {
            type: 'string',
            confidence: 0.75,
            reasoning: 'Default to string type with moderate confidence',
            format: 'text'
        };
    }
    detectDateFormat(sample) {
        const stringValues = sample.map(v => String(v));
        if (stringValues.some(v => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v))) {
            return 'ISO 8601';
        }
        if (stringValues.some(v => /^\d{4}-\d{2}-\d{2}$/.test(v))) {
            return 'YYYY-MM-DD';
        }
        if (stringValues.some(v => /^\d{2}\/\d{2}\/\d{4}$/.test(v))) {
            return 'MM/DD/YYYY';
        }
        return 'date';
    }
    combineSubTypes(existing, additional) {
        const combined = new Set([...(existing || []), ...(additional || [])]);
        return Array.from(combined);
    }
    shouldUseGPTAssist(result) {
        return result.confidence < this.config.confidenceThreshold;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.GPTAssist = GPTAssist;
//# sourceMappingURL=gpt-assist.js.map