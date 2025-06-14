import { FieldStatistics, FieldType } from '../types';
export declare class StatisticsCalculator {
    static calculate(values: any[], inferredType: FieldType): FieldStatistics;
    private static calculateStringStats;
    private static calculateNumberStats;
    private static calculateDateStats;
    private static isStringLikeType;
}
//# sourceMappingURL=statistics-calculator.d.ts.map