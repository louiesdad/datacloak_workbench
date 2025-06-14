export interface PerformanceMetrics {
    executionTime: number;
    memoryUsage: number;
    peakMemoryUsage: number;
    cpuUsage?: number;
    throughput: number;
    operationsPerSecond: number;
}
export interface ProfiledExecution<T> {
    result: T;
    metrics: PerformanceMetrics;
    timestamp: string;
}
export interface BenchmarkProfile {
    name: string;
    iterations: number;
    avgExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    stdDevExecutionTime: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    avgThroughput: number;
    totalOperations: number;
    successRate: number;
}
export declare class PerformanceProfiler {
    private static getMemoryUsage;
    static profile<T>(operation: () => Promise<T> | T, operationCount?: number): Promise<ProfiledExecution<T>>;
    static benchmark<T>(name: string, operation: () => Promise<T> | T, options?: {
        iterations?: number;
        warmupIterations?: number;
        operationCount?: number;
        timeout?: number;
    }): Promise<BenchmarkProfile>;
    static profileMemoryLeak<T>(operation: () => Promise<T> | T, iterations?: number, samplingInterval?: number): Promise<{
        memoryGrowth: number;
        memoryTrend: Array<{
            iteration: number;
            memory: number;
        }>;
        leakDetected: boolean;
        recommendations: string[];
    }>;
    static comparePerformance(profiles: BenchmarkProfile[]): {
        fastest: BenchmarkProfile;
        slowest: BenchmarkProfile;
        mostMemoryEfficient: BenchmarkProfile;
        highestThroughput: BenchmarkProfile;
        rankings: Array<{
            name: string;
            rank: number;
            score: number;
        }>;
    };
    private static calculateBenchmarkProfile;
}
//# sourceMappingURL=performance-profiler.d.ts.map