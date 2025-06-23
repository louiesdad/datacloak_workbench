#!/usr/bin/env node

/**
 * Integration Test Coordinator
 * dev01-023: Complete integration test coordination
 * 
 * Coordinates integration tests, manages test data, and ensures proper sequencing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTestCoordinator {
  constructor() {
    this.testSequences = {
      // Core infrastructure tests (must run first)
      infrastructure: [
        'src/tests/infrastructure.test.ts',
        'src/tests/config-integration.test.ts',
        'src/tests/config-service.test.ts'
      ],
      
      // Service integration tests
      integration: [
        'src/tests/integration/api-integration-simple.test.ts',
        'src/tests/integration/datacloak-integration.test.ts',
        'src/tests/integration/security-datacloak.test.ts',
        'src/tests/integration/realtime-coordination-fixed.test.ts'
      ],
      
      // End-to-end workflow tests
      e2e: [
        'src/tests/e2e/simple-workflow-fixed.test.ts',
        'src/tests/e2e/api-workflows.test.ts',
        'src/tests/e2e/compliance-workflows.test.ts',
        'src/tests/e2e/realtime-workflow.test.ts'
      ],
      
      // Performance tests (run last)
      performance: [
        'src/tests/performance/cache-load-testing.test.ts',
        'src/tests/performance/job-queue-performance.test.ts',
        'src/tests/performance/api-performance.test.ts'
      ]
    };
    
    this.results = {
      passed: [],
      failed: [],
      skipped: []
    };
  }

  async runTestSequence(sequenceName, tests) {
    console.log(`\n🔄 Running ${sequenceName} tests...`);
    console.log('='.repeat(50));
    
    for (const testFile of tests) {
      if (!fs.existsSync(testFile)) {
        console.log(`⚠️  Skipping ${testFile} (not found)`);
        this.results.skipped.push(testFile);
        continue;
      }
      
      console.log(`\n📋 Running: ${testFile}`);
      
      try {
        // Run test with appropriate timeout based on sequence type
        const timeout = this.getTimeoutForSequence(sequenceName);
        const maxWorkers = this.getMaxWorkersForSequence(sequenceName);
        
        execSync(`npm test -- ${testFile} --testTimeout=${timeout} --maxWorkers=${maxWorkers}`, {
          stdio: 'inherit',
          timeout: timeout + 10000 // Add buffer for Jest overhead
        });
        
        console.log(`✅ Passed: ${testFile}`);
        this.results.passed.push(testFile);
        
      } catch (error) {
        console.log(`❌ Failed: ${testFile}`);
        this.results.failed.push(testFile);
        
        // For infrastructure tests, fail fast
        if (sequenceName === 'infrastructure') {
          console.log(`💥 Infrastructure test failed. Stopping test coordination.`);
          throw new Error(`Critical infrastructure test failed: ${testFile}`);
        }
        
        // For other tests, continue but log the failure
        console.log(`⚠️  Continuing with remaining tests...`);
      }
      
      // Add delay between tests to avoid resource conflicts
      await this.sleep(1000);
    }
  }

  getTimeoutForSequence(sequenceName) {
    const timeouts = {
      infrastructure: 10000,
      integration: 15000,
      e2e: 30000,
      performance: 60000
    };
    return timeouts[sequenceName] || 15000;
  }

  getMaxWorkersForSequence(sequenceName) {
    // Check if CI environment for more conservative settings
    const isCI = process.env.CI === 'true';
    
    const workers = {
      infrastructure: 1,  // Run infrastructure tests sequentially
      integration: isCI ? 1 : 2,     // Allow 2 workers locally, 1 in CI
      e2e: 1,             // E2E tests should run sequentially
      performance: 1      // Performance tests need isolated execution
    };
    return workers[sequenceName] || 1;
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Check system resources
      this.logSystemResources();
      
      // Clear any existing test databases
      const testDbPath = path.join(__dirname, '..', 'test-*.db');
      execSync(`rm -f ${testDbPath}`, { stdio: 'pipe' });
      
      // Clear Redis test data if Redis is available
      try {
        execSync('redis-cli -n 1 flushdb', { stdio: 'pipe' });
        console.log('✅ Redis test database cleared');
      } catch (error) {
        console.log('⚠️  Redis not available or already clean');
      }
      
      // Ensure coverage directory exists
      const coverageDir = path.join(__dirname, '..', 'coverage');
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }
      
      // Create test coordination lock file
      const lockFile = path.join(__dirname, '..', '.test-coordination.lock');
      fs.writeFileSync(lockFile, JSON.stringify({
        startTime: new Date().toISOString(),
        pid: process.pid
      }));
      
      console.log('✅ Test environment ready');
      
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error.message);
      throw error;
    }
  }

  logSystemResources() {
    try {
      const os = require('os');
      console.log('📊 System Resources:');
      console.log(`  CPU cores: ${os.cpus().length}`);
      console.log(`  Total memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
      console.log(`  Free memory: ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)}GB`);
      console.log(`  Load average: ${os.loadavg().map(x => x.toFixed(2)).join(', ')}`);
    } catch (error) {
      console.log('⚠️  Could not read system resources');
    }
  }

  async cleanupTestEnvironment() {
    console.log('\n🧹 Cleaning up test environment...');
    
    try {
      // Clean up test files
      const testDbPath = path.join(__dirname, '..', 'test-*.db');
      execSync(`rm -f ${testDbPath}`, { stdio: 'pipe' });
      
      // Remove coordination lock file
      const lockFile = path.join(__dirname, '..', '.test-coordination.lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
      
      // Clear test Redis data
      try {
        execSync('redis-cli -n 1 flushdb', { stdio: 'pipe' });
      } catch (error) {
        // Redis might not be available
      }
      
      console.log('✅ Test environment cleaned');
      
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error.message);
    }
  }

  generateReport() {
    console.log('\n📊 Integration Test Report');
    console.log('='.repeat(50));
    
    const total = this.results.passed.length + this.results.failed.length + this.results.skipped.length;
    const passRate = total > 0 ? (this.results.passed.length / total * 100).toFixed(1) : '0.0';
    
    console.log(`📈 Total tests: ${total}`);
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Skipped: ${this.results.skipped.length}`);
    console.log(`📊 Pass rate: ${passRate}%`);
    
    if (this.results.failed.length > 0) {
      console.log('\n❌ Failed tests:');
      this.results.failed.forEach(test => console.log(`  - ${test}`));
    }
    
    if (this.results.skipped.length > 0) {
      console.log('\n⚠️  Skipped tests:');
      this.results.skipped.forEach(test => console.log(`  - ${test}`));
    }
    
    // Write report to file
    const reportPath = path.join(__dirname, '..', 'integration-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: {
        total,
        passed: this.results.passed.length,
        failed: this.results.failed.length,
        skipped: this.results.skipped.length,
        passRate: parseFloat(passRate)
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: integration-test-report.json`);
    
    return this.results.failed.length === 0;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async coordinateTests() {
    console.log('🚀 Starting Integration Test Coordination');
    console.log('==========================================');
    
    try {
      // Setup
      await this.setupTestEnvironment();
      
      // Run test sequences in order
      for (const [sequenceName, tests] of Object.entries(this.testSequences)) {
        await this.runTestSequence(sequenceName, tests);
      }
      
      // Generate report
      const success = this.generateReport();
      
      // Cleanup
      await this.cleanupTestEnvironment();
      
      if (success) {
        console.log('\n🎉 All integration tests completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Some integration tests failed. See report for details.');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('\n💥 Integration test coordination failed:', error.message);
      await this.cleanupTestEnvironment();
      process.exit(1);
    }
  }
}

// CLI
if (require.main === module) {
  const coordinator = new IntegrationTestCoordinator();
  coordinator.coordinateTests();
}

module.exports = IntegrationTestCoordinator;