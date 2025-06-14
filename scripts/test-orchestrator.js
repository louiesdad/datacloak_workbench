#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');

// Test configurations per package
const TEST_CONFIGS = {
  'web-ui': {
    testCommand: 'npm run test:ci',
    coverageThreshold: 70,
    parallel: true,
    timeout: 300000 // 5 minutes
  },
  'backend': {
    testCommand: 'npm run test:ci',
    coverageThreshold: 85,
    parallel: true,
    timeout: 600000 // 10 minutes
  },
  'datascience': {
    testCommand: 'npm run test:ci',
    coverageThreshold: 90,
    parallel: true,
    timeout: 900000 // 15 minutes
  },
  'security': {
    testCommand: 'npm run test:ci',
    coverageThreshold: 100,
    parallel: false, // Security tests run sequentially for accuracy
    timeout: 1200000 // 20 minutes
  },
  'electron-shell': {
    testCommand: 'npm run test:e2e',
    coverageThreshold: 60,
    parallel: false, // E2E tests must run sequentially
    timeout: 1800000 // 30 minutes
  }
};

class TestOrchestrator {
  constructor(options = {}) {
    this.options = {
      parallel: options.parallel !== false,
      bail: options.bail || false,
      verbose: options.verbose || false,
      packages: options.packages || null,
      testType: options.testType || 'all' // all, unit, integration, e2e
    };
    
    this.results = {};
    this.startTime = Date.now();
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async runCommand(command, cwd, packageName) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      this.log(`Starting tests for ${packageName}...`);
      
      const child = spawn('npm', ['run', command.split(' ').slice(1).join(' ')], {
        cwd,
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      if (!this.options.verbose) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Test timeout for ${packageName} after ${TEST_CONFIGS[packageName]?.timeout || 300000}ms`));
      }, TEST_CONFIGS[packageName]?.timeout || 300000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        const result = {
          package: packageName,
          success: code === 0,
          duration,
          stdout,
          stderr,
          exitCode: code
        };

        this.results[packageName] = result;

        if (code === 0) {
          this.log(`Tests passed for ${packageName} (${duration}ms)`);
          resolve(result);
        } else {
          this.log(`Tests failed for ${packageName} (exit code: ${code})`, 'error');
          if (this.options.bail) {
            reject(new Error(`Tests failed for ${packageName}`));
          } else {
            resolve(result);
          }
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        this.log(`Test process error for ${packageName}: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  getAvailablePackages() {
    if (!fs.existsSync(PACKAGES_DIR)) {
      return [];
    }

    return fs.readdirSync(PACKAGES_DIR)
      .filter(pkg => {
        const packagePath = path.join(PACKAGES_DIR, pkg);
        const packageJsonPath = path.join(packagePath, 'package.json');
        return fs.existsSync(packageJsonPath);
      })
      .filter(pkg => this.options.packages ? this.options.packages.includes(pkg) : true);
  }

  async runTestsSequentially(packages) {
    const results = [];
    
    for (const pkg of packages) {
      const packagePath = path.join(PACKAGES_DIR, pkg);
      const config = TEST_CONFIGS[pkg];
      
      if (!config) {
        this.log(`No test configuration found for ${pkg}`, 'warn');
        continue;
      }

      try {
        const result = await this.runCommand(config.testCommand, packagePath, pkg);
        results.push(result);
      } catch (error) {
        this.log(`Failed to run tests for ${pkg}: ${error.message}`, 'error');
        if (this.options.bail) {
          throw error;
        }
        results.push({
          package: pkg,
          success: false,
          error: error.message,
          duration: 0
        });
      }
    }
    
    return results;
  }

  async runTestsInParallel(packages) {
    const promises = packages.map(pkg => {
      const packagePath = path.join(PACKAGES_DIR, pkg);
      const config = TEST_CONFIGS[pkg];
      
      if (!config) {
        this.log(`No test configuration found for ${pkg}`, 'warn');
        return Promise.resolve({
          package: pkg,
          success: false,
          error: 'No configuration found',
          duration: 0
        });
      }

      return this.runCommand(config.testCommand, packagePath, pkg)
        .catch(error => ({
          package: pkg,
          success: false,
          error: error.message,
          duration: 0
        }));
    });

    return Promise.all(promises);
  }

  async generateReport() {
    this.ensureDir(TEST_RESULTS_DIR);
    
    const totalDuration = Date.now() - this.startTime;
    const successCount = Object.values(this.results).filter(r => r.success).length;
    const totalCount = Object.keys(this.results).length;
    
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration,
      summary: {
        total: totalCount,
        passed: successCount,
        failed: totalCount - successCount,
        successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0
      },
      packages: this.results,
      system: {
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
      }
    };

    // Write JSON report
    const jsonReportPath = path.join(TEST_RESULTS_DIR, 'test-report.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Write console-friendly report
    const textReportPath = path.join(TEST_RESULTS_DIR, 'test-summary.txt');
    const textReport = this.generateTextReport(report);
    fs.writeFileSync(textReportPath, textReport);

    this.log(`Test report generated: ${jsonReportPath}`);
    
    return report;
  }

  generateTextReport(report) {
    const lines = [
      '='.repeat(60),
      'TEST ORCHESTRATOR REPORT',
      '='.repeat(60),
      `Timestamp: ${report.timestamp}`,
      `Total Duration: ${Math.round(report.totalDuration / 1000)}s`,
      `Success Rate: ${report.summary.successRate}% (${report.summary.passed}/${report.summary.total})`,
      '',
      'PACKAGE RESULTS:',
      '-'.repeat(40)
    ];

    for (const [pkg, result] of Object.entries(report.packages)) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = Math.round(result.duration / 1000);
      lines.push(`${status} ${pkg.padEnd(20)} (${duration}s)`);
      
      if (!result.success && result.error) {
        lines.push(`    Error: ${result.error}`);
      }
    }

    lines.push('', '='.repeat(60));
    
    return lines.join('\n');
  }

  async run() {
    const packages = this.getAvailablePackages();
    
    if (packages.length === 0) {
      this.log('No packages found to test', 'warn');
      return { success: false, results: {} };
    }

    this.log(`Found ${packages.length} packages to test: ${packages.join(', ')}`);

    // Separate sequential and parallel packages
    const sequentialPackages = packages.filter(pkg => 
      TEST_CONFIGS[pkg] && !TEST_CONFIGS[pkg].parallel
    );
    const parallelPackages = packages.filter(pkg => 
      TEST_CONFIGS[pkg] && TEST_CONFIGS[pkg].parallel
    );

    try {
      // Run sequential tests first
      if (sequentialPackages.length > 0) {
        this.log(`Running ${sequentialPackages.length} packages sequentially...`);
        await this.runTestsSequentially(sequentialPackages);
      }

      // Run parallel tests
      if (parallelPackages.length > 0) {
        this.log(`Running ${parallelPackages.length} packages in parallel...`);
        await this.runTestsInParallel(parallelPackages);
      }

      const report = await this.generateReport();
      
      // Print summary
      console.log('\n' + this.generateTextReport(report));

      const allPassed = Object.values(this.results).every(r => r.success);
      
      if (allPassed) {
        this.log('All tests passed! 🎉');
        return { success: true, results: this.results };
      } else {
        this.log('Some tests failed', 'error');
        return { success: false, results: this.results };
      }

    } catch (error) {
      this.log(`Test orchestration failed: ${error.message}`, 'error');
      await this.generateReport();
      return { success: false, error: error.message, results: this.results };
    }
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--parallel':
        options.parallel = true;
        break;
      case '--sequential':
        options.parallel = false;
        break;
      case '--bail':
        options.bail = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--packages':
        options.packages = args[++i]?.split(',');
        break;
      case '--type':
        options.testType = args[++i];
        break;
      case '--help':
        console.log(`
Test Orchestrator - Coordinate tests across all packages

Usage: node test-orchestrator.js [options]

Options:
  --parallel          Run tests in parallel (default)
  --sequential        Run all tests sequentially
  --bail              Stop on first test failure
  --verbose           Show detailed output
  --packages pkg1,pkg2 Run tests only for specified packages
  --type unit|integration|e2e|all  Run specific test types
  --help              Show this help message

Examples:
  node test-orchestrator.js
  node test-orchestrator.js --packages web-ui,backend --verbose
  node test-orchestrator.js --type unit --bail
        `);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const orchestrator = new TestOrchestrator(options);
  
  const result = await orchestrator.run();
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TestOrchestrator;