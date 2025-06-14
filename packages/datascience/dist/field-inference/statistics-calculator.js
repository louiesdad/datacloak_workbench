"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsCalculator = void 0;
const pattern_analyzer_1 = require("./pattern-analyzer");
class StatisticsCalculator {
    static calculate(values, inferredType) {
        const nullCount = values.filter(v => v === null || v === undefined).length;
        const nonNullValues = values.filter(v => v !== null && v !== undefined);
        const uniqueCount = new Set(nonNullValues).size;
        const stats = {
            nullCount,
            uniqueCount,
            totalCount: values.length,
        };
        if (nonNullValues.length === 0) {
            return stats;
        }
        switch (inferredType) {
            case 'string':
            case 'email':
            case 'url':
            case 'phone':
            case 'json':
                this.calculateStringStats(stats, nonNullValues);
                break;
            case 'number':
                this.calculateNumberStats(stats, nonNullValues);
                break;
            case 'date':
                this.calculateDateStats(stats, nonNullValues);
                break;
        }
        if (inferredType === 'string' || this.isStringLikeType(inferredType)) {
            stats.patterns = pattern_analyzer_1.PatternAnalyzer.analyzePatterns(nonNullValues.map(v => String(v)));
        }
        return stats;
    }
    static calculateStringStats(stats, values) {
        const lengths = values.map(v => String(v).length);
        stats.minLength = Math.min(...lengths);
        stats.maxLength = Math.max(...lengths);
        stats.avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    }
    static calculateNumberStats(stats, values) {
        const numbers = values.filter(v => typeof v === 'number' && !isNaN(v));
        if (numbers.length === 0)
            return;
        stats.minValue = Math.min(...numbers);
        stats.maxValue = Math.max(...numbers);
        stats.avgValue = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }
    static calculateDateStats(stats, values) {
        const dates = values
            .map(v => new Date(v))
            .filter(d => !isNaN(d.getTime()));
        if (dates.length === 0)
            return;
        const timestamps = dates.map(d => d.getTime());
        stats.minValue = Math.min(...timestamps);
        stats.maxValue = Math.max(...timestamps);
        stats.avgValue = timestamps.reduce((sum, ts) => sum + ts, 0) / timestamps.length;
    }
    static isStringLikeType(type) {
        return ['string', 'email', 'url', 'phone', 'json', 'date'].includes(type);
    }
}
exports.StatisticsCalculator = StatisticsCalculator;
//# sourceMappingURL=statistics-calculator.js.map