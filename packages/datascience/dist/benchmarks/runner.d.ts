import { BenchmarkReport } from './reporter';
export interface BenchmarkConfig {
    name: string;
    testCases: TestCaseConfig[];
    performanceTests: PerformanceTestConfig[];
    accuracyThreshold: number;
    iterations: number;
    enableMemoryProfiling: boolean;
    outputPath?: string;
}
export interface TestCaseConfig {
    name: string;
    datasetType: 'users' | 'sales' | 'logs' | 'mixed' | 'custom';
    recordCount: number;
    expectedTypes: Record<string, string>;
    description?: string;
}
export interface PerformanceTestConfig {
    name: string;
    operation: 'field-inference' | 'dataset-inference' | 'custom';
    dataSize: number;
    iterations: number;
    customOperation?: () => Promise<any>;
}
export declare class BenchmarkRunner {
    private inferenceEngine;
    constructor();
    runBenchmark(config: BenchmarkConfig): Promise<BenchmarkReport>;
    runQuickBenchmark(): Promise<BenchmarkReport>;
    runComprehensiveBenchmark(): Promise<BenchmarkReport>;
    private runAccuracyTests;
    private runPerformanceTests;
    private runMemoryProfilingTests;
    private createPerformanceOperation;
}
//# sourceMappingURL=runner.d.ts.map