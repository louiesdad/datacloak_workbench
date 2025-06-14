"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldInferenceEngine = void 0;
const type_detector_1 = require("./type-detector");
const statistics_calculator_1 = require("./statistics-calculator");
const gpt_assist_1 = require("./gpt-assist");
class FieldInferenceEngine {
    gptAssist;
    constructor(gptConfig) {
        this.gptAssist = new gpt_assist_1.GPTAssist(gptConfig);
    }
    async inferField(fieldName, values) {
        const typeResult = type_detector_1.TypeDetector.detectFieldType(values);
        const statistics = statistics_calculator_1.StatisticsCalculator.calculate(values, typeResult.type);
        let result = {
            fieldName,
            inferredType: typeResult.type,
            confidence: typeResult.confidence,
            statistics,
        };
        const format = this.detectFormat(values, typeResult.type);
        if (format) {
            result.format = format;
        }
        // Use GPT assist for low confidence results
        if (this.gptAssist.shouldUseGPTAssist(result)) {
            result = await this.gptAssist.enhanceInference(fieldName, values, result);
        }
        return result;
    }
    async inferDataset(dataset) {
        const results = [];
        for (const [fieldName, values] of Object.entries(dataset.fields)) {
            const result = await this.inferField(fieldName, values);
            results.push(result);
        }
        return results;
    }
    async inferFromSample(data) {
        if (data.length === 0) {
            return [];
        }
        const fieldNames = Object.keys(data[0]);
        const results = [];
        for (const fieldName of fieldNames) {
            const values = data.map(row => row[fieldName]);
            const result = await this.inferField(fieldName, values);
            results.push(result);
        }
        return results;
    }
    detectFormat(values, type) {
        const nonNullValues = values.filter(v => v !== null && v !== undefined);
        if (nonNullValues.length === 0)
            return undefined;
        switch (type) {
            case 'date':
                return this.detectDateFormat(nonNullValues);
            case 'number':
                return this.detectNumberFormat(nonNullValues);
            default:
                return undefined;
        }
    }
    detectDateFormat(values) {
        const stringValues = values.map(v => String(v));
        const formats = [
            { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, format: 'ISO 8601' },
            { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
            { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'MM/DD/YYYY' },
            { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'MM-DD-YYYY' },
        ];
        for (const { pattern, format } of formats) {
            if (stringValues.some(v => pattern.test(v))) {
                return format;
            }
        }
        return undefined;
    }
    detectNumberFormat(values) {
        const hasDecimals = values.some(v => Number(v) % 1 !== 0);
        const hasNegatives = values.some(v => Number(v) < 0);
        if (hasDecimals && hasNegatives)
            return 'decimal';
        if (hasDecimals)
            return 'positive decimal';
        if (hasNegatives)
            return 'integer';
        return 'positive integer';
    }
}
exports.FieldInferenceEngine = FieldInferenceEngine;
//# sourceMappingURL=engine.js.map