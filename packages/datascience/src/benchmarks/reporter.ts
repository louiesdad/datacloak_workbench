import { AccuracyMetrics, BenchmarkCase } from './accuracy-evaluator';
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

export class BenchmarkReporter {
  static generateReport(
    accuracyResults: Array<{ name: string; metrics: AccuracyMetrics; threshold?: number }>,
    performanceResults: BenchmarkProfile[]
  ): BenchmarkReport {
    const timestamp = new Date().toISOString();
    
    const accuracyTestResults: AccuracyResult[] = accuracyResults.map(result => ({
      testName: result.name,
      metrics: result.metrics,
      passed: result.metrics.accuracy >= (result.threshold || 0.8),
      threshold: result.threshold || 0.8
    }));

    const summary = this.calculateSummary(accuracyTestResults, performanceResults);
    const recommendations = this.generateRecommendations(accuracyTestResults, performanceResults);

    return {
      timestamp,
      summary,
      accuracyResults: accuracyTestResults,
      performanceResults,
      recommendations
    };
  }

  static printReport(report: BenchmarkReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('BENCHMARK REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${report.timestamp}`);
    console.log();

    this.printSummary(report.summary);
    this.printAccuracyResults(report.accuracyResults);
    this.printPerformanceResults(report.performanceResults);
    this.printRecommendations(report.recommendations);

    console.log('='.repeat(80));
  }

  static exportToJson(report: BenchmarkReport, filepath?: string): string {
    const json = JSON.stringify(report, null, 2);
    
    if (filepath) {
      if (typeof require !== 'undefined') {
        const fs = require('fs');
        fs.writeFileSync(filepath, json);
        console.log(`Report exported to: ${filepath}`);
      }
    }
    
    return json;
  }

  static exportToCsv(accuracyResults: AccuracyResult[]): string {
    const headers = [
      'Test Name',
      'Accuracy',
      'Precision', 
      'Recall',
      'F1 Score',
      'Passed',
      'Threshold'
    ];

    const rows = accuracyResults.map(result => [
      result.testName,
      result.metrics.accuracy.toFixed(4),
      result.metrics.precision.toFixed(4),
      result.metrics.recall.toFixed(4),
      result.metrics.f1Score.toFixed(4),
      result.passed.toString(),
      result.threshold.toFixed(2)
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  static compareReports(
    currentReport: BenchmarkReport,
    previousReport: BenchmarkReport
  ): {
    accuracyChanges: Array<{ test: string; change: number; improvement: boolean }>;
    performanceChanges: Array<{ test: string; change: number; improvement: boolean }>;
    overallImprovement: boolean;
  } {
    const accuracyChanges: Array<{ test: string; change: number; improvement: boolean }> = [];
    const performanceChanges: Array<{ test: string; change: number; improvement: boolean }> = [];

    const currentAccuracyMap = new Map(
      currentReport.accuracyResults.map(r => [r.testName, r.metrics.accuracy])
    );
    
    const previousAccuracyMap = new Map(
      previousReport.accuracyResults.map(r => [r.testName, r.metrics.accuracy])
    );

    for (const [testName, currentAccuracy] of currentAccuracyMap) {
      const previousAccuracy = previousAccuracyMap.get(testName);
      if (previousAccuracy !== undefined) {
        const change = currentAccuracy - previousAccuracy;
        accuracyChanges.push({
          test: testName,
          change,
          improvement: change > 0
        });
      }
    }

    const currentPerfMap = new Map(
      currentReport.performanceResults.map(r => [r.name, r.avgExecutionTime])
    );
    
    const previousPerfMap = new Map(
      previousReport.performanceResults.map(r => [r.name, r.avgExecutionTime])
    );

    for (const [testName, currentTime] of currentPerfMap) {
      const previousTime = previousPerfMap.get(testName);
      if (previousTime !== undefined) {
        const change = ((currentTime - previousTime) / previousTime) * 100;
        performanceChanges.push({
          test: testName,
          change,
          improvement: change < 0 // Lower execution time is better
        });
      }
    }

    const accuracyImprovement = accuracyChanges.filter(c => c.improvement).length > accuracyChanges.filter(c => !c.improvement).length;
    const performanceImprovement = performanceChanges.filter(c => c.improvement).length > performanceChanges.filter(c => !c.improvement).length;
    const overallImprovement = accuracyImprovement && performanceImprovement;

    return {
      accuracyChanges,
      performanceChanges,
      overallImprovement
    };
  }

  private static calculateSummary(
    accuracyResults: AccuracyResult[],
    performanceResults: BenchmarkProfile[]
  ): BenchmarkSummary {
    const totalTests = accuracyResults.length;
    const passedTests = accuracyResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    const averageAccuracy = accuracyResults.length > 0 
      ? accuracyResults.reduce((sum, r) => sum + r.metrics.accuracy, 0) / accuracyResults.length
      : 0;

    const averageExecutionTime = performanceResults.length > 0
      ? performanceResults.reduce((sum, r) => sum + r.avgExecutionTime, 0) / performanceResults.length
      : 0;

    const totalExecutionTime = performanceResults.reduce((sum, r) => sum + (r.avgExecutionTime * r.iterations), 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      averageAccuracy,
      averageExecutionTime,
      totalExecutionTime
    };
  }

  private static generateRecommendations(
    accuracyResults: AccuracyResult[],
    performanceResults: BenchmarkProfile[]
  ): string[] {
    const recommendations: string[] = [];

    const lowAccuracyTests = accuracyResults.filter(r => !r.passed);
    if (lowAccuracyTests.length > 0) {
      recommendations.push(`${lowAccuracyTests.length} tests failed accuracy threshold`);
      recommendations.push('Consider improving field detection algorithms');
      recommendations.push('Review training data quality and coverage');
    }

    const slowTests = performanceResults.filter(r => r.avgExecutionTime > 1000);
    if (slowTests.length > 0) {
      recommendations.push(`${slowTests.length} tests have slow execution time (>1s)`);
      recommendations.push('Consider optimizing algorithms or adding caching');
    }

    const highMemoryTests = performanceResults.filter(r => r.peakMemoryUsage > 100);
    if (highMemoryTests.length > 0) {
      recommendations.push(`${highMemoryTests.length} tests use high memory (>100MB)`);
      recommendations.push('Review memory usage and consider streaming approaches');
    }

    const lowReliabilityTests = performanceResults.filter(r => r.successRate < 0.95);
    if (lowReliabilityTests.length > 0) {
      recommendations.push(`${lowReliabilityTests.length} tests have low success rate (<95%)`);
      recommendations.push('Review error handling and input validation');
    }

    if (recommendations.length === 0) {
      recommendations.push('All tests passed successfully!');
      recommendations.push('Consider adding more challenging test cases');
    }

    return recommendations;
  }

  private static printSummary(summary: BenchmarkSummary): void {
    console.log('SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passedTests} | Failed: ${summary.failedTests}`);
    console.log(`Average Accuracy: ${(summary.averageAccuracy * 100).toFixed(2)}%`);
    console.log(`Average Execution Time: ${summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`Total Execution Time: ${(summary.totalExecutionTime / 1000).toFixed(2)}s`);
    console.log();
  }

  private static printAccuracyResults(results: AccuracyResult[]): void {
    console.log('ACCURACY RESULTS');
    console.log('-'.repeat(40));
    
    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.testName}`);
      console.log(`  Accuracy: ${(result.metrics.accuracy * 100).toFixed(2)}% (threshold: ${(result.threshold * 100).toFixed(0)}%)`);
      console.log(`  Precision: ${(result.metrics.precision * 100).toFixed(2)}%`);
      console.log(`  Recall: ${(result.metrics.recall * 100).toFixed(2)}%`);
      console.log(`  F1 Score: ${(result.metrics.f1Score * 100).toFixed(2)}%`);
      console.log();
    }
  }

  private static printPerformanceResults(results: BenchmarkProfile[]): void {
    console.log('PERFORMANCE RESULTS');
    console.log('-'.repeat(40));
    
    for (const result of results) {
      console.log(`📊 ${result.name}`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Avg Execution Time: ${result.avgExecutionTime.toFixed(2)}ms`);
      console.log(`  Min/Max: ${result.minExecutionTime.toFixed(2)}ms / ${result.maxExecutionTime.toFixed(2)}ms`);
      console.log(`  Memory Usage: ${result.avgMemoryUsage.toFixed(2)}MB (peak: ${result.peakMemoryUsage.toFixed(2)}MB)`);
      console.log(`  Throughput: ${result.avgThroughput.toFixed(2)} ops/sec`);
      console.log(`  Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
      console.log();
    }
  }

  private static printRecommendations(recommendations: string[]): void {
    console.log('RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    for (const recommendation of recommendations) {
      console.log(`💡 ${recommendation}`);
    }
    console.log();
  }
}