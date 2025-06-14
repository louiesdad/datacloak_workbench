"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternAnalyzer = void 0;
class PatternAnalyzer {
    static COMMON_PATTERNS = [
        { name: 'UUID', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
        { name: 'IPv4', pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/ },
        { name: 'Credit Card', pattern: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/ },
        { name: 'SSN', pattern: /^\d{3}-\d{2}-\d{4}$/ },
        { name: 'ZIP Code', pattern: /^\d{5}(-\d{4})?$/ },
        { name: 'ISO Date', pattern: /^\d{4}-\d{2}-\d{2}$/ },
        { name: 'Time', pattern: /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/ },
        { name: 'Currency', pattern: /^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/ },
        { name: 'Percentage', pattern: /^\d+(\.\d+)?%$/ },
        { name: 'Hex Color', pattern: /^#[0-9A-Fa-f]{6}$/ },
    ];
    static analyzePatterns(values) {
        const patternMatches = [];
        const nonEmptyValues = values.filter(v => v && v.trim() !== '');
        if (nonEmptyValues.length === 0) {
            return patternMatches;
        }
        for (const { name, pattern } of this.COMMON_PATTERNS) {
            const matchCount = nonEmptyValues.filter(v => pattern.test(v)).length;
            if (matchCount > 0) {
                const confidence = matchCount / nonEmptyValues.length;
                patternMatches.push({
                    pattern,
                    name,
                    confidence,
                    matchCount
                });
            }
        }
        return patternMatches.sort((a, b) => b.confidence - a.confidence);
    }
    static detectCustomPatterns(values) {
        const customPatterns = [];
        const nonEmptyValues = values.filter(v => v && v.trim() !== '');
        if (nonEmptyValues.length < 10) {
            return customPatterns;
        }
        const lengthPattern = this.detectLengthPattern(nonEmptyValues);
        if (lengthPattern) {
            customPatterns.push(lengthPattern);
        }
        const prefixPattern = this.detectPrefixPattern(nonEmptyValues);
        if (prefixPattern) {
            customPatterns.push(prefixPattern);
        }
        return customPatterns;
    }
    static detectLengthPattern(values) {
        const lengths = values.map(v => v.length);
        const uniqueLengths = [...new Set(lengths)];
        if (uniqueLengths.length === 1) {
            return {
                pattern: new RegExp(`^.{${uniqueLengths[0]}}$`),
                name: `Fixed Length (${uniqueLengths[0]})`,
                confidence: 1.0,
                matchCount: values.length
            };
        }
        return null;
    }
    static detectPrefixPattern(values) {
        if (values.length < 10)
            return null;
        let commonPrefix = values[0];
        for (const value of values.slice(1)) {
            while (commonPrefix && !value.startsWith(commonPrefix)) {
                commonPrefix = commonPrefix.slice(0, -1);
            }
            if (!commonPrefix)
                break;
        }
        if (commonPrefix && commonPrefix.length >= 2) {
            const pattern = new RegExp(`^${commonPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
            return {
                pattern,
                name: `Common Prefix "${commonPrefix}"`,
                confidence: 1.0,
                matchCount: values.length
            };
        }
        return null;
    }
}
exports.PatternAnalyzer = PatternAnalyzer;
//# sourceMappingURL=pattern-analyzer.js.map