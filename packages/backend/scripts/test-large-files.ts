#!/usr/bin/env ts-node

/**
 * Script to test large file handling capabilities
 */

import { LargeFilePerformanceTest } from '../src/tests/performance/large-file-test';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🚀 DataCloak Backend - Large File Performance Testing');
  console.log('====================================================\n');

  const test = new LargeFilePerformanceTest();

  // Test different file sizes
  const testSizes = [
    { size: 0.1, name: '100MB' },
    { size: 1, name: '1GB' },
    { size: 5, name: '5GB' },
    { size: 10, name: '10GB' },
    { size: 50, name: '50GB' }
  ];

  for (const { size, name } of testSizes) {
    console.log(`\n📊 Testing ${name} file...`);
    console.log('─'.repeat(40));

    const testFile = path.join(__dirname, `../test-data/test-${name}.csv`);

    // Generate test file if it doesn't exist
    if (!fs.existsSync(testFile)) {
      console.log(`📝 Generating ${name} test file...`);
      await test.generateTestFile(size, testFile);
    }

    try {
      // Run performance test
      const metrics = await test.testLargeFileProcessing(testFile);

      // Save results
      const results = {
        fileSize: name,
        sizeGB: size,
        ...metrics,
        timestamp: new Date().toISOString()
      };

      const resultsFile = path.join(__dirname, '../test-results/large-file-performance.json');
      const existingResults = fs.existsSync(resultsFile) 
        ? JSON.parse(fs.readFileSync(resultsFile, 'utf8'))
        : [];
      
      existingResults.push(results);
      fs.writeFileSync(resultsFile, JSON.stringify(existingResults, null, 2));

      console.log(`✅ ${name} test completed successfully`);

      // Clean up test file if it's large
      if (size > 5) {
        console.log(`🧹 Cleaning up ${name} test file...`);
        fs.unlinkSync(testFile);
      }

    } catch (error) {
      console.error(`❌ ${name} test failed:`, error);
    }
  }

  // Run memory limit test
  console.log('\n📊 Testing memory limit compliance...');
  console.log('─'.repeat(40));
  const memoryOk = await test.testMemoryLimit();
  console.log(memoryOk ? '✅ Memory limit test PASSED' : '❌ Memory limit test FAILED');

  // Run DuckDB test
  console.log('\n📊 Testing DuckDB performance...');
  console.log('─'.repeat(40));
  await test.testDuckDBPerformance();

  console.log('\n✅ All tests completed!');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});