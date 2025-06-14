import { Dataset, InferenceResult } from '../types';
import { DataGenerator } from '../generators';
import { FieldInferenceEngine } from '../field-inference';
import { AccuracyEvaluator, BenchmarkCase, GroundTruth } from './accuracy-evaluator';
import { PerformanceProfiler, BenchmarkProfile } from './performance-profiler';
import { BenchmarkReporter, BenchmarkReport } from './reporter';

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

export class BenchmarkRunner {
  private inferenceEngine: FieldInferenceEngine;
  
  constructor() {
    this.inferenceEngine = new FieldInferenceEngine();
  }

  async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkReport> {
    console.log(`🚀 Starting benchmark: ${config.name}`);
    console.log(`Test cases: ${config.testCases.length}`);
    console.log(`Performance tests: ${config.performanceTests.length}`);
    console.log();

    const accuracyResults = await this.runAccuracyTests(config.testCases, config.accuracyThreshold);
    const performanceResults = await this.runPerformanceTests(config.performanceTests);

    if (config.enableMemoryProfiling) {
      await this.runMemoryProfilingTests(config.performanceTests);
    }

    const report = BenchmarkReporter.generateReport(
      accuracyResults.map(r => ({ 
        name: r.name, 
        metrics: r.metrics, 
        threshold: config.accuracyThreshold 
      })),
      performanceResults
    );

    BenchmarkReporter.printReport(report);

    if (config.outputPath) {
      BenchmarkReporter.exportToJson(report, config.outputPath);
    }

    return report;
  }

  async runQuickBenchmark(): Promise<BenchmarkReport> {
    const config: BenchmarkConfig = {
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

  async runComprehensiveBenchmark(): Promise<BenchmarkReport> {
    const config: BenchmarkConfig = {
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

  private async runAccuracyTests(
    testCases: TestCaseConfig[], 
    threshold: number
  ): Promise<Array<{ name: string; metrics: any; passed: boolean }>> {
    const results: Array<{ name: string; metrics: any; passed: boolean }> = [];

    for (const testCase of testCases) {
      console.log(`📋 Running accuracy test: ${testCase.name}`);
      
      try {
        const dataset = DataGenerator.generate({
          type: testCase.datasetType,
          recordCount: testCase.recordCount,
          name: testCase.name
        });

        const groundTruth: GroundTruth[] = Object.entries(testCase.expectedTypes).map(
          ([fieldName, type]) => ({
            fieldName,
            actualType: type as any
          })
        );

        const predictions = await this.inferenceEngine.inferDataset(dataset);
        const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);
        const passed = metrics.accuracy >= threshold;

        results.push({
          name: testCase.name,
          metrics,
          passed
        });

        console.log(`  Accuracy: ${(metrics.accuracy * 100).toFixed(2)}% | ${passed ? '✅ PASS' : '❌ FAIL'}`);
      } catch (error) {
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

  private async runPerformanceTests(testConfigs: PerformanceTestConfig[]): Promise<BenchmarkProfile[]> {
    const results: BenchmarkProfile[] = [];

    for (const testConfig of testConfigs) {
      console.log(`⚡ Running performance test: ${testConfig.name}`);
      
      try {
        const operation = this.createPerformanceOperation(testConfig);
        const profile = await PerformanceProfiler.benchmark(
          testConfig.name,
          operation,
          {
            iterations: testConfig.iterations,
            warmupIterations: Math.min(3, testConfig.iterations),
            operationCount: testConfig.dataSize
          }
        );

        results.push(profile);
        console.log(`  Avg time: ${profile.avgExecutionTime.toFixed(2)}ms | Throughput: ${profile.avgThroughput.toFixed(2)} ops/sec`);
      } catch (error) {
        console.error(`  Error in performance test ${testConfig.name}:`, error);
      }
    }

    return results;
  }

  private async runMemoryProfilingTests(testConfigs: PerformanceTestConfig[]): Promise<void> {
    console.log('🧠 Running memory profiling tests...');

    for (const testConfig of testConfigs) {
      try {
        const operation = this.createPerformanceOperation(testConfig);
        const memoryProfile = await PerformanceProfiler.profileMemoryLeak(
          operation,
          50,
          5
        );

        if (memoryProfile.leakDetected) {
          console.warn(`⚠️  Memory leak detected in ${testConfig.name}`);
          console.warn(`   Growth: ${memoryProfile.memoryGrowth.toFixed(2)}MB`);
          memoryProfile.recommendations.forEach(rec => 
            console.warn(`   💡 ${rec}`)
          );
        } else {
          console.log(`✅ No memory leaks detected in ${testConfig.name}`);
        }
      } catch (error) {
        console.error(`  Error in memory profiling for ${testConfig.name}:`, error);
      }
    }
  }

  private createPerformanceOperation(testConfig: PerformanceTestConfig): () => Promise<any> {
    switch (testConfig.operation) {
      case 'field-inference':
        return async () => {
          const values = Array.from({ length: testConfig.dataSize }, (_, i) => `sample_value_${i}`);
          return this.inferenceEngine.inferField('test_field', values);
        };

      case 'dataset-inference':
        return async () => {
          const dataset = DataGenerator.generate({
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