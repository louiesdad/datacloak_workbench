"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkRunner = void 0;
const generators_1 = require("../generators");
const field_inference_1 = require("../field-inference");
const accuracy_evaluator_1 = require("./accuracy-evaluator");
const performance_profiler_1 = require("./performance-profiler");
const reporter_1 = require("./reporter");
class BenchmarkRunner {
    inferenceEngine;
    constructor() {
        this.inferenceEngine = new field_inference_1.FieldInferenceEngine();
    }
    async runBenchmark(config) {
        console.log(`🚀 Starting benchmark: ${config.name}`);
        console.log(`Test cases: ${config.testCases.length}`);
        console.log(`Performance tests: ${config.performanceTests.length}`);
        console.log();
        const accuracyResults = await this.runAccuracyTests(config.testCases, config.accuracyThreshold);
        const performanceResults = await this.runPerformanceTests(config.performanceTests);
        if (config.enableMemoryProfiling) {
            await this.runMemoryProfilingTests(config.performanceTests);
        }
        const report = reporter_1.BenchmarkReporter.generateReport(accuracyResults.map(r => ({
            name: r.name,
            metrics: r.metrics,
            threshold: config.accuracyThreshold
        })), performanceResults);
        reporter_1.BenchmarkReporter.printReport(report);
        if (config.outputPath) {
            reporter_1.BenchmarkReporter.exportToJson(report, config.outputPath);
        }
        return report;
    }
    async runQuickBenchmark() {
        const config = {
            name: 'Quick Benchmark',
            testCases: [
                {
                    name: 'Users Dataset (Small)',
                    datasetType: 'users',
                    recordCount: 100,
                    expectedTypes: {
                        id: 'number',
                        email: 'email',
                        firstName: 'string',
                        lastName: 'string',
                        phone: 'phone',
                        birthDate: 'date',
                        isActive: 'boolean'
                    }
                },
                {
                    name: 'Mixed Types Dataset',
                    datasetType: 'mixed',
                    recordCount: 50,
                    expectedTypes: {
                        stringField: 'string',
                        numberField: 'number',
                        booleanField: 'boolean',
                        dateField: 'date',
                        emailField: 'email'
                    }
                }
            ],
            performanceTests: [
                {
                    name: 'Small Dataset Inference',
                    operation: 'dataset-inference',
                    dataSize: 100,
                    iterations: 5
                }
            ],
            accuracyThreshold: 0.8,
            iterations: 3,
            enableMemoryProfiling: false
        };
        return this.runBenchmark(config);
    }
    async runComprehensiveBenchmark() {
        const config = {
            name: 'Comprehensive Benchmark Suite',
            testCases: [
                {
                    name: 'Users Dataset (Small)',
                    datasetType: 'users',
                    recordCount: 500,
                    expectedTypes: {
                        id: 'number',
                        email: 'email',
                        firstName: 'string',
                        lastName: 'string',
                        phone: 'phone',
                        birthDate: 'date',
                        isActive: 'boolean',
                        lastLogin: 'date',
                        profileUrl: 'url',
                        metadata: 'json'
                    }
                },
                {
                    name: 'Sales Dataset',
                    datasetType: 'sales',
                    recordCount: 300,
                    expectedTypes: {
                        orderId: 'string',
                        customerId: 'number',
                        customerEmail: 'email',
                        orderDate: 'date',
                        amount: 'number',
                        currency: 'string',
                        status: 'string',
                        shippingAddress: 'json',
                        items: 'array'
                    }
                },
                {
                    name: 'Logs Dataset',
                    datasetType: 'logs',
                    recordCount: 1000,
                    expectedTypes: {
                        timestamp: 'date',
                        level: 'string',
                        message: 'string',
                        userId: 'number',
                        sessionId: 'string',
                        ipAddress: 'string',
                        userAgent: 'string',
                        requestId: 'string'
                    }
                },
                {
                    name: 'Mixed Types Dataset',
                    datasetType: 'mixed',
                    recordCount: 200,
                    expectedTypes: {
                        stringField: 'string',
                        numberField: 'number',
                        booleanField: 'boolean',
                        dateField: 'date',
                        emailField: 'email',
                        urlField: 'url',
                        phoneField: 'phone',
                        jsonField: 'json',
                        arrayField: 'array',
                        objectField: 'object'
                    }
                }
            ],
            performanceTests: [
                {
                    name: 'Small Dataset (100 records)',
                    operation: 'dataset-inference',
                    dataSize: 100,
                    iterations: 10
                },
                {
                    name: 'Medium Dataset (500 records)',
                    operation: 'dataset-inference',
                    dataSize: 500,
                    iterations: 5
                },
                {
                    name: 'Large Dataset (1000 records)',
                    operation: 'dataset-inference',
                    dataSize: 1000,
                    iterations: 3
                },
                {
                    name: 'Single Field Inference',
                    operation: 'field-inference',
                    dataSize: 1000,
                    iterations: 20
                }
            ],
            accuracyThreshold: 0.85,
            iterations: 5,
            enableMemoryProfiling: true,
            outputPath: './benchmark-results.json'
        };
        return this.runBenchmark(config);
    }
    async runAccuracyTests(testCases, threshold) {
        const results = [];
        for (const testCase of testCases) {
            console.log(`📋 Running accuracy test: ${testCase.name}`);
            try {
                const dataset = generators_1.DataGenerator.generate({
                    type: testCase.datasetType,
                    recordCount: testCase.recordCount,
                    name: testCase.name
                });
                const groundTruth = Object.entries(testCase.expectedTypes).map(([fieldName, type]) => ({
                    fieldName,
                    actualType: type
                }));
                const predictions = await this.inferenceEngine.inferDataset(dataset);
                const metrics = accuracy_evaluator_1.AccuracyEvaluator.evaluate(predictions, groundTruth);
                const passed = metrics.accuracy >= threshold;
                results.push({
                    name: testCase.name,
                    metrics,
                    passed
                });
                console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(2)}% | ${passed ? '✅ PASS' : '❌ FAIL'}`);
            }
            catch (error) {
                console.error(`  Error in test ${testCase.name}:`, error);
                results.push({
                    name: testCase.name,
                    metrics: { accuracy: 0, precision: 0, recall: 0, f1Score: 0 },
                    passed: false
                });
            }
        }
        return results;
    }
    async runPerformanceTests(testConfigs) {
        const results = [];
        for (const testConfig of testConfigs) {
            console.log(`⚡ Running performance test: ${testConfig.name}`);
            try {
                const operation = this.createPerformanceOperation(testConfig);
                const profile = await performance_profiler_1.PerformanceProfiler.benchmark(testConfig.name, operation, {
                    iterations: testConfig.iterations,
                    warmupIterations: Math.min(3, testConfig.iterations),
                    operationCount: testConfig.dataSize
                });
                results.push(profile);
                console.log(`  Avg time: ${profile.avgExecutionTime.toFixed(2)}ms | Throughput: ${profile.avgThroughput.toFixed(2)} ops/sec`);
            }
            catch (error) {
                console.error(`  Error in performance test ${testConfig.name}:`, error);
            }
        }
        return results;
    }
    async runMemoryProfilingTests(testConfigs) {
        console.log('🧠 Running memory profiling tests...');
        for (const testConfig of testConfigs) {
            try {
                const operation = this.createPerformanceOperation(testConfig);
                const memoryProfile = await performance_profiler_1.PerformanceProfiler.profileMemoryLeak(operation, 50, 5);
                if (memoryProfile.leakDetected) {
                    console.warn(`⚠️  Memory leak detected in ${testConfig.name}`);
                    console.warn(`   Growth: ${memoryProfile.memoryGrowth.toFixed(2)}MB`);
                    memoryProfile.recommendations.forEach(rec => console.warn(`   💡 ${rec}`));
                }
                else {
                    console.log(`✅ No memory leaks detected in ${testConfig.name}`);
                }
            }
            catch (error) {
                console.error(`  Error in memory profiling for ${testConfig.name}:`, error);
            }
        }
    }
    createPerformanceOperation(testConfig) {
        switch (testConfig.operation) {
            case 'field-inference':
                return async () => {
                    const values = Array.from({ length: testConfig.dataSize }, (_, i) => `sample_value_${i}`);
                    return this.inferenceEngine.inferField('test_field', values);
                };
            case 'dataset-inference':
                return async () => {
                    const dataset = generators_1.DataGenerator.generate({
                        type: 'mixed',
                        recordCount: testConfig.dataSize,
                        name: `perf-test-${testConfig.dataSize}`
                    });
                    return this.inferenceEngine.inferDataset(dataset);
                };
            case 'custom':
                if (!testConfig.customOperation) {
                    throw new Error('Custom operation required for custom performance test');
                }
                return testConfig.customOperation;
            default:
                throw new Error(`Unknown performance test operation: ${testConfig.operation}`);
        }
    }
}
exports.BenchmarkRunner = BenchmarkRunner;
//# sourceMappingURL=runner.js.map