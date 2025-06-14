"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceProfiler = void 0;
class PerformanceProfiler {
    static getMemoryUsage() {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed / 1024 / 1024; // MB
        }
        return 0;
    }
    static async profile(operation, operationCount = 1) {
        const startTime = Date.now();
        const startMemory = this.getMemoryUsage();
        let peakMemory = startMemory;
        const memoryMonitor = setInterval(() => {
            const currentMemory = this.getMemoryUsage();
            if (currentMemory > peakMemory) {
                peakMemory = currentMemory;
            }
        }, 10);
        try {
            const result = await operation();
            const endTime = Date.now();
            const endMemory = this.getMemoryUsage();
            clearInterval(memoryMonitor);
            const executionTime = endTime - startTime;
            const memoryUsage = endMemory - startMemory;
            const throughput = operationCount / (executionTime / 1000);
            const metrics = {
                executionTime,
                memoryUsage,
                peakMemoryUsage: peakMemory - startMemory,
                throughput,
                operationsPerSecond: throughput
            };
            return {
                result,
                metrics,
                timestamp: new Date(startTime).toISOString()
            };
        }
        catch (error) {
            clearInterval(memoryMonitor);
            throw error;
        }
    }
    static async benchmark(name, operation, options = {}) {
        const { iterations = 10, warmupIterations = 3, operationCount = 1, timeout = 30000 } = options;
        console.log(`Running benchmark: ${name}`);
        console.log(`Warmup iterations: ${warmupIterations}`);
        console.log(`Benchmark iterations: ${iterations}`);
        for (let i = 0; i < warmupIterations; i++) {
            try {
                await Promise.race([
                    operation(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), timeout))
                ]);
            }
            catch (error) {
                console.warn(`Warmup iteration ${i + 1} failed:`, error);
            }
        }
        const results = [];
        let successCount = 0;
        for (let i = 0; i < iterations; i++) {
            try {
                console.log(`Iteration ${i + 1}/${iterations}`);
                const result = await Promise.race([
                    this.profile(operation, operationCount),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Benchmark timeout')), timeout))
                ]);
                results.push(result);
                successCount++;
            }
            catch (error) {
                console.warn(`Iteration ${i + 1} failed:`, error);
            }
        }
        if (results.length === 0) {
            throw new Error(`All ${iterations} benchmark iterations failed`);
        }
        return this.calculateBenchmarkProfile(name, results, operationCount, successCount, iterations);
    }
    static async profileMemoryLeak(operation, iterations = 100, samplingInterval = 10) {
        const memorySnapshots = [];
        let initialMemory = null;
        for (let i = 0; i < iterations; i++) {
            if (i % samplingInterval === 0) {
                if (global.gc) {
                    global.gc();
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                const currentMemory = this.getMemoryUsage();
                if (initialMemory === null) {
                    initialMemory = currentMemory;
                }
                memorySnapshots.push({ iteration: i, memory: currentMemory });
            }
            try {
                await operation();
            }
            catch (error) {
                console.warn(`Memory leak test iteration ${i} failed:`, error);
            }
        }
        if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const finalMemory = this.getMemoryUsage();
        const memoryGrowth = finalMemory - (initialMemory || 0);
        const growthThreshold = 10; // MB
        const leakDetected = memoryGrowth > growthThreshold;
        const recommendations = [];
        if (leakDetected) {
            recommendations.push('Potential memory leak detected');
            recommendations.push('Review object references and event listeners');
            recommendations.push('Consider using WeakMap/WeakSet for caching');
            recommendations.push('Ensure proper cleanup in async operations');
        }
        return {
            memoryGrowth,
            memoryTrend: memorySnapshots,
            leakDetected,
            recommendations
        };
    }
    static comparePerformance(profiles) {
        if (profiles.length === 0) {
            throw new Error('No profiles to compare');
        }
        const fastest = profiles.reduce((min, profile) => profile.avgExecutionTime < min.avgExecutionTime ? profile : min);
        const slowest = profiles.reduce((max, profile) => profile.avgExecutionTime > max.avgExecutionTime ? profile : max);
        const mostMemoryEfficient = profiles.reduce((min, profile) => profile.avgMemoryUsage < min.avgMemoryUsage ? profile : min);
        const highestThroughput = profiles.reduce((max, profile) => profile.avgThroughput > max.avgThroughput ? profile : max);
        const rankings = profiles.map(profile => {
            const timeScore = 1 / profile.avgExecutionTime;
            const memoryScore = 1 / Math.max(profile.avgMemoryUsage, 0.1);
            const throughputScore = profile.avgThroughput;
            const reliabilityScore = profile.successRate;
            const score = (timeScore * 0.3) + (memoryScore * 0.2) + (throughputScore * 0.3) + (reliabilityScore * 0.2);
            return { name: profile.name, rank: 0, score };
        }).sort((a, b) => b.score - a.score)
            .map((item, index) => ({ ...item, rank: index + 1 }));
        return {
            fastest,
            slowest,
            mostMemoryEfficient,
            highestThroughput,
            rankings
        };
    }
    static calculateBenchmarkProfile(name, results, operationCount, successCount, totalIterations) {
        const executionTimes = results.map(r => r.metrics.executionTime);
        const memoryUsages = results.map(r => r.metrics.memoryUsage);
        const throughputs = results.map(r => r.metrics.throughput);
        const avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
        const minExecutionTime = Math.min(...executionTimes);
        const maxExecutionTime = Math.max(...executionTimes);
        const variance = executionTimes.reduce((sum, time) => sum + Math.pow(time - avgExecutionTime, 2), 0) / executionTimes.length;
        const stdDevExecutionTime = Math.sqrt(variance);
        const avgMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
        const peakMemoryUsage = Math.max(...results.map(r => r.metrics.peakMemoryUsage));
        const avgThroughput = throughputs.reduce((sum, tp) => sum + tp, 0) / throughputs.length;
        return {
            name,
            iterations: results.length,
            avgExecutionTime,
            minExecutionTime,
            maxExecutionTime,
            stdDevExecutionTime,
            avgMemoryUsage,
            peakMemoryUsage,
            avgThroughput,
            totalOperations: results.length * operationCount,
            successRate: successCount / totalIterations
        };
    }
}
exports.PerformanceProfiler = PerformanceProfiler;
//# sourceMappingURL=performance-profiler.js.map