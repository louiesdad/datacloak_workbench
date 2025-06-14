import { AccuracyEvaluator, GroundTruth } from '../benchmarks/accuracy-evaluator';
import { PerformanceProfiler } from '../benchmarks/performance-profiler';
import { BenchmarkReporter } from '../benchmarks/reporter';
import { BenchmarkRunner } from '../benchmarks/runner';
import { InferenceResult } from '../types';

describe('Benchmarks', () => {
  describe('AccuracyEvaluator', () => {
    test('evaluates accuracy correctly', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'email',
          inferredType: 'email',
          confidence: 0.95,
          statistics: { nullCount: 0, uniqueCount: 3, totalCount: 3 }
        },
        {
          fieldName: 'name',
          inferredType: 'string',
          confidence: 0.9,
          statistics: { nullCount: 0, uniqueCount: 3, totalCount: 3 }
        },
        {
          fieldName: 'age',
          inferredType: 'string', // Incorrect prediction
          confidence: 0.8,
          statistics: { nullCount: 0, uniqueCount: 3, totalCount: 3 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'email', actualType: 'email' },
        { fieldName: 'name', actualType: 'string' },
        { fieldName: 'age', actualType: 'number' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      expect(metrics.accuracy).toBeCloseTo(2/3, 2); // 2 correct out of 3
      expect(metrics.precision).toBeGreaterThan(0);
      expect(metrics.recall).toBeGreaterThan(0);
      expect(metrics.f1Score).toBeGreaterThan(0);
      expect(metrics.confusionMatrix.totalPredictions).toBe(3);
    });

    test('handles perfect accuracy', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'email',
          inferredType: 'email',
          confidence: 1.0,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'email', actualType: 'email' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      expect(metrics.accuracy).toBe(1.0);
      expect(metrics.precision).toBe(1.0);
      expect(metrics.recall).toBe(1.0);
      expect(metrics.f1Score).toBe(1.0);
    });

    test('handles zero accuracy', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'email',
          inferredType: 'string', // Wrong prediction
          confidence: 0.5,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'email', actualType: 'email' }
      ];

      const metrics = AccuracyEvaluator.evaluate(predictions, groundTruth);

      expect(metrics.accuracy).toBe(0);
    });

    test('compares confidence levels', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'field1',
          inferredType: 'string',
          confidence: 0.9, // High confidence, correct
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'field2',
          inferredType: 'number',
          confidence: 0.5, // Low confidence, incorrect
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        },
        {
          fieldName: 'field3',
          inferredType: 'boolean',
          confidence: 0.8, // High confidence, incorrect
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'field1', actualType: 'string' },
        { fieldName: 'field2', actualType: 'string' },
        { fieldName: 'field3', actualType: 'string' }
      ];

      const confidenceAnalysis = AccuracyEvaluator.compareConfidence(predictions, groundTruth);

      expect(confidenceAnalysis.correctHighConfidence).toBe(1);
      expect(confidenceAnalysis.incorrectHighConfidence).toBe(1);
      expect(confidenceAnalysis.incorrectLowConfidence).toBe(1);
      expect(confidenceAnalysis.averageConfidenceCorrect).toBe(0.9);
    });

    test('throws error for no matching predictions', () => {
      const predictions: InferenceResult[] = [
        {
          fieldName: 'nonexistent',
          inferredType: 'string',
          confidence: 0.5,
          statistics: { nullCount: 0, uniqueCount: 1, totalCount: 1 }
        }
      ];

      const groundTruth: GroundTruth[] = [
        { fieldName: 'different', actualType: 'string' }
      ];

      expect(() => {
        AccuracyEvaluator.evaluate(predictions, groundTruth);
      }).toThrow('No matching predictions found for ground truth');
    });
  });

  describe('PerformanceProfiler', () => {
    test('profiles synchronous operation', async () => {
      const operation = () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const result = await PerformanceProfiler.profile(operation, 1000);

      expect(result.result).toBe(499500); // Sum of 0 to 999
      expect(result.metrics.executionTime).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    test('profiles asynchronous operation', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'completed';
      };

      const result = await PerformanceProfiler.profile(operation);

      expect(result.result).toBe('completed');
      expect(result.metrics.executionTime).toBeGreaterThanOrEqual(10);
    });

    test('runs benchmark with multiple iterations', async () => {
      const operation = () => Math.random() * 100;

      const profile = await PerformanceProfiler.benchmark(
        'random-number-generation',
        operation,
        { iterations: 5, warmupIterations: 2 }
      );

      expect(profile.name).toBe('random-number-generation');
      expect(profile.iterations).toBe(5);
      expect(profile.avgExecutionTime).toBeGreaterThan(0);
      expect(profile.minExecutionTime).toBeLessThanOrEqual(profile.avgExecutionTime);
      expect(profile.maxExecutionTime).toBeGreaterThanOrEqual(profile.avgExecutionTime);
      expect(profile.successRate).toBe(1.0);
    });

    test('handles operation failures in benchmark', async () => {
      let callCount = 0;
      const operation = () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Simulated failure');
        }
        return 'success';
      };

      const profile = await PerformanceProfiler.benchmark(
        'failing-operation',
        operation,
        { iterations: 5, warmupIterations: 0 }
      );

      expect(profile.successRate).toBeLessThan(1.0);
      expect(profile.iterations).toBeLessThan(5);
    });

    test('compares performance profiles', async () => {
      const fastOperation = () => 1 + 1;
      const slowOperation = () => {
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      };

      const fastProfile = await PerformanceProfiler.benchmark('fast-op', fastOperation, { iterations: 3 });
      const slowProfile = await PerformanceProfiler.benchmark('slow-op', slowOperation, { iterations: 3 });

      const comparison = PerformanceProfiler.comparePerformance([fastProfile, slowProfile]);

      expect(comparison.fastest.name).toBe('fast-op');
      expect(comparison.slowest.name).toBe('slow-op');
      expect(comparison.rankings).toHaveLength(2);
      expect(comparison.rankings[0].rank).toBe(1);
      expect(comparison.rankings[1].rank).toBe(2);
    });

    test('profiles memory usage', async () => {
      const operation = () => {
        const largeArray = new Array(1000).fill(0).map((_, i) => ({ id: i, data: 'x'.repeat(100) }));
        return largeArray.length;
      };

      const memoryProfile = await PerformanceProfiler.profileMemoryLeak(operation, 10, 2);

      expect(memoryProfile.memoryTrend.length).toBeGreaterThan(0);
      expect(memoryProfile.recommendations).toBeDefined();
      expect(typeof memoryProfile.leakDetected).toBe('boolean');
    });
  });

  describe('BenchmarkReporter', () => {
    test('generates benchmark report', () => {
      const accuracyResults = [
        {
          name: 'Test 1',
          metrics: {
            accuracy: 0.9,
            precision: 0.85,
            recall: 0.88,
            f1Score: 0.865,
            confusionMatrix: { matrix: {}, totalPredictions: 10 },
            typeSpecificMetrics: {}
          },
          threshold: 0.8
        }
      ];

      const performanceResults = [
        {
          name: 'Perf Test 1',
          iterations: 5,
          avgExecutionTime: 100,
          minExecutionTime: 80,
          maxExecutionTime: 120,
          stdDevExecutionTime: 15,
          avgMemoryUsage: 10,
          peakMemoryUsage: 15,
          avgThroughput: 50,
          totalOperations: 250,
          successRate: 1.0
        }
      ];

      const report = BenchmarkReporter.generateReport(accuracyResults, performanceResults);

      expect(report.timestamp).toBeDefined();
      expect(report.summary.totalTests).toBe(1);
      expect(report.summary.passedTests).toBe(1);
      expect(report.summary.averageAccuracy).toBe(0.9);
      expect(report.accuracyResults).toHaveLength(1);
      expect(report.performanceResults).toHaveLength(1);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    test('exports report to JSON', () => {
      const report = {
        timestamp: '2024-01-01T00:00:00.000Z',
        summary: {
          totalTests: 1,
          passedTests: 1,
          failedTests: 0,
          averageAccuracy: 0.9,
          averageExecutionTime: 100,
          totalExecutionTime: 500
        },
        accuracyResults: [],
        performanceResults: [],
        recommendations: []
      };

      const json = BenchmarkReporter.exportToJson(report);
      const parsed = JSON.parse(json);

      expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(parsed.summary.averageAccuracy).toBe(0.9);
    });

    test('exports accuracy results to CSV', () => {
      const accuracyResults = [
        {
          testName: 'Test 1',
          metrics: {
            accuracy: 0.9,
            precision: 0.85,
            recall: 0.88,
            f1Score: 0.865,
            confusionMatrix: { matrix: {}, totalPredictions: 10 },
            typeSpecificMetrics: {}
          },
          passed: true,
          threshold: 0.8
        }
      ];

      const csv = BenchmarkReporter.exportToCsv(accuracyResults);
      const lines = csv.split('\n');

      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toContain('Test Name');
      expect(lines[1]).toContain('Test 1');
      expect(lines[1]).toContain('0.9000');
    });

    test('compares reports for improvements', () => {
      const currentReport = {
        timestamp: '2024-01-02T00:00:00.000Z',
        summary: { totalTests: 1, passedTests: 1, failedTests: 0, averageAccuracy: 0.9, averageExecutionTime: 80, totalExecutionTime: 400 },
        accuracyResults: [{ testName: 'Test 1', metrics: { accuracy: 0.9 } as any, passed: true, threshold: 0.8 }],
        performanceResults: [{ name: 'Perf 1', avgExecutionTime: 80 } as any],
        recommendations: []
      };

      const previousReport = {
        timestamp: '2024-01-01T00:00:00.000Z',
        summary: { totalTests: 1, passedTests: 1, failedTests: 0, averageAccuracy: 0.8, averageExecutionTime: 100, totalExecutionTime: 500 },
        accuracyResults: [{ testName: 'Test 1', metrics: { accuracy: 0.8 } as any, passed: true, threshold: 0.8 }],
        performanceResults: [{ name: 'Perf 1', avgExecutionTime: 100 } as any],
        recommendations: []
      };

      const comparison = BenchmarkReporter.compareReports(currentReport, previousReport);

      expect(comparison.accuracyChanges).toHaveLength(1);
      expect(comparison.accuracyChanges[0].improvement).toBe(true);
      expect(comparison.performanceChanges).toHaveLength(1);
      expect(comparison.performanceChanges[0].improvement).toBe(true); // Lower time is better
      expect(comparison.overallImprovement).toBe(true);
    });
  });

  describe('BenchmarkRunner', () => {
    let runner: BenchmarkRunner;

    beforeEach(() => {
      runner = new BenchmarkRunner();
    });

    test('runs quick benchmark', async () => {
      const report = await runner.runQuickBenchmark();

      expect(report.timestamp).toBeDefined();
      expect(report.summary.totalTests).toBeGreaterThan(0);
      expect(report.accuracyResults.length).toBeGreaterThan(0);
      expect(report.performanceResults.length).toBeGreaterThan(0);
    }, 30000); // Allow 30 seconds for benchmark

    test('creates benchmark runner', () => {
      expect(runner).toBeInstanceOf(BenchmarkRunner);
    });
  });
});