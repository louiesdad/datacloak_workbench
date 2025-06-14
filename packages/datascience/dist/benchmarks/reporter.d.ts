import { AccuracyMetrics } from './accuracy-evaluator';
import { BenchmarkProfile } from './performance-profiler';
export interface BenchmarkReport {
    timestamp: string;
    summary: BenchmarkSummary;
    accuracyResults: AccuracyResult[];
    performanceResults: BenchmarkProfile[];
    recommendations: string[];
}
export interface BenchmarkSummary {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageAccuracy: number;
    averageExecutionTime: number;
    totalExecutionTime: number;
}
export interface AccuracyResult {
    testName: string;
    metrics: AccuracyMetrics;
    passed: boolean;
    threshold: number;
}
export declare class BenchmarkReporter {
    static generateReport(accuracyResults: Array<{
        name: string;
        metrics: AccuracyMetrics;
        threshold?: number;
    }>, performanceResults: BenchmarkProfile[]): BenchmarkReport;
    static printReport(report: BenchmarkReport): void;
    static exportToJson(report: BenchmarkReport, filepath?: string): string;
    static exportToCsv(accuracyResults: AccuracyResult[]): string;
    static compareReports(currentReport: BenchmarkReport, previousReport: BenchmarkReport): {
        accuracyChanges: Array<{
            test: string;
            change: number;
            improvement: boolean;
        }>;
        performanceChanges: Array<{
            test: string;
            change: number;
            improvement: boolean;
        }>;
        overallImprovement: boolean;
    };
    private static calculateSummary;
    private static generateRecommendations;
    private static printSummary;
    private static printAccuracyResults;
    private static printPerformanceResults;
    private static printRecommendations;
}
//# sourceMappingURL=reporter.d.ts.map