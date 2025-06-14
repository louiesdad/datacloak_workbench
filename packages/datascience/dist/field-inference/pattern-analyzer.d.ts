import { PatternMatch } from '../types';
export declare class PatternAnalyzer {
    private static readonly COMMON_PATTERNS;
    static analyzePatterns(values: string[]): PatternMatch[];
    static detectCustomPatterns(values: string[]): PatternMatch[];
    private static detectLengthPattern;
    private static detectPrefixPattern;
}
//# sourceMappingURL=pattern-analyzer.d.ts.map