#!/usr/bin/env ts-node

import { BenchmarkRunner } from '../src/benchmarks/runner';

async function main(): Promise<void> {
  const runner = new BenchmarkRunner();
  
  const args = process.argv.slice(2);
  const benchmarkType = args[0] || 'quick';

  console.log('🔬 DataCloak Data Science Benchmark Suite');
  console.log('==========================================\n');

  try {
    let report;
    
    switch (benchmarkType) {
      case 'quick':
        console.log('Running quick benchmark...\n');
        report = await runner.runQuickBenchmark();
        break;
      
      case 'comprehensive':
        console.log('Running comprehensive benchmark...\n');
        report = await runner.runComprehensiveBenchmark();
        break;
      
      default:
        console.log('Usage: npm run benchmark [quick|comprehensive]');
        console.log('  quick        - Run a quick benchmark with small datasets');
        console.log('  comprehensive - Run a full benchmark suite');
        process.exit(1);
    }

    const passRate = (report.summary.passedTests / report.summary.totalTests) * 100;
    console.log(`\n🎯 Overall Results:`);
    console.log(`   Pass Rate: ${passRate.toFixed(1)}%`);
    console.log(`   Average Accuracy: ${(report.summary.averageAccuracy * 100).toFixed(2)}%`);
    console.log(`   Total Execution Time: ${(report.summary.totalExecutionTime / 1000).toFixed(2)}s`);

    if (passRate >= 80) {
      console.log('🎉 Benchmark suite passed!');
      process.exit(0);
    } else {
      console.log('❌ Benchmark suite failed - accuracy below threshold');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}