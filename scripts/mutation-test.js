#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = path.join(__dirname, '..', 'packages');
const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'mutation');

// Packages that require mutation testing (from PRD: Security & DataScience ≥85%)
const MUTATION_PACKAGES = {
  'security': {
    threshold: 85,
    timeout: 600000, // 10 minutes
    files: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts']
  },
  'datascience': {
    threshold: 85,
    timeout: 900000, // 15 minutes
    files: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts']
  }
};

class MutationTester {
  constructor(options = {}) {
    this.options = {
      packages: options.packages || Object.keys(MUTATION_PACKAGES),
      verbose: options.verbose || false,
      dryRun: options.dryRun || false
    };
    
    this.results = {};
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

  async checkStrykerInstallation() {
    try {
      execSync('npx stryker --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      this.log('Stryker not found, installing...', 'warn');
      try {
        execSync('npm install -g @stryker-mutator/core @stryker-mutator/typescript-checker @stryker-mutator/jest-runner', 
          { stdio: 'inherit' });
        return true;
      } catch (installError) {
        this.log('Failed to install Stryker', 'error');
        return false;
      }
    }
  }

  generateStrykerConfig(packageName, config) {
    const configPath = path.join(PACKAGES_DIR, packageName, 'stryker.conf.js');
    
    const strykerConfig = `
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'jest',
  jesRunner: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  coverageAnalysis: 'perTest',
  mutate: ${JSON.stringify(config.files)},
  thresholds: {
    high: ${config.threshold},
    low: ${Math.max(config.threshold - 10, 60)},
    break: ${Math.max(config.threshold - 20, 50)}
  },
  timeoutMS: ${config.timeout},
  timeoutFactor: 1.5,
  maxConcurrentTestRunners: ${Math.max(1, require('os').cpus().length - 1)},
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
  logLevel: '${this.options.verbose ? 'debug' : 'info'}',
  fileLogLevel: 'trace',
  dashboard: {
    project: 'github.com/datacloak/sentiment-workbench',
    version: '${packageName}',
    module: '${packageName}'
  },
  htmlReporter: {
    baseDir: '../../reports/mutation/${packageName}'
  },
  jsonReporter: {
    fileName: '../../reports/mutation/${packageName}/mutation-report.json'
  }
};`;

    fs.writeFileSync(configPath, strykerConfig);
    return configPath;
  }

  async runMutationTest(packageName, config) {
    const packagePath = path.join(PACKAGES_DIR, packageName);
    
    if (!fs.existsSync(packagePath)) {
      throw new Error(`Package not found: ${packageName}`);
    }

    // Check if package has tests
    const testFiles = this.findTestFiles(packagePath);
    if (testFiles.length === 0) {
      throw new Error(`No test files found for ${packageName}`);
    }

    this.log(`Running mutation tests for ${packageName} (${testFiles.length} test files)...`);

    if (this.options.dryRun) {
      this.log(`[DRY RUN] Would run mutation tests for ${packageName}`, 'warn');
      return {
        package: packageName,
        success: true,
        dryRun: true,
        mutationScore: 100
      };
    }

    // Generate Stryker configuration
    const configPath = this.generateStrykerConfig(packageName, config);
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const child = spawn('npx', ['stryker', 'run'], {
        cwd: packagePath,
        stdio: this.options.verbose ? 'inherit' : 'pipe'
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
        reject(new Error(`Mutation test timeout for ${packageName}`));
      }, config.timeout);

      child.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        // Parse mutation score from output
        let mutationScore = 0;
        const scoreMatch = stdout.match(/Mutation score: (\d+\.?\d*)%/);
        if (scoreMatch) {
          mutationScore = parseFloat(scoreMatch[1]);
        }

        const result = {
          package: packageName,
          success: code === 0,
          mutationScore,
          duration,
          stdout,
          stderr,
          exitCode: code,
          threshold: config.threshold,
          passed: mutationScore >= config.threshold
        };

        // Clean up config file
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
        }

        if (result.passed) {
          this.log(`Mutation tests passed for ${packageName}: ${mutationScore}% >= ${config.threshold}%`);
        } else {
          this.log(`Mutation tests failed for ${packageName}: ${mutationScore}% < ${config.threshold}%`, 'error');
        }

        resolve(result);
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  findTestFiles(packagePath) {
    const testPatterns = [
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js'
    ];

    const testFiles = [];
    
    function searchDir(dir) {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          searchDir(filePath);
        } else if (testPatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
          return regex.test(filePath);
        })) {
          testFiles.push(filePath);
        }
      }
    }

    searchDir(path.join(packagePath, 'src'));
    return testFiles;
  }

  async generateReport() {
    this.ensureDir(REPORTS_DIR);
    
    const report = {
      timestamp: new Date().toISOString(),
      packages: this.results,
      summary: {
        total: Object.keys(this.results).length,
        passed: Object.values(this.results).filter(r => r.passed).length,
        averageScore: Object.values(this.results).length > 0 ? 
          Math.round(Object.values(this.results).reduce((sum, r) => sum + r.mutationScore, 0) / Object.values(this.results).length) : 0
      }
    };

    // Write JSON report
    const jsonReportPath = path.join(REPORTS_DIR, 'mutation-summary.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // Write text summary
    const textReportPath = path.join(REPORTS_DIR, 'mutation-summary.txt');
    const textReport = this.generateTextReport(report);
    fs.writeFileSync(textReportPath, textReport);

    this.log(`Mutation test report generated: ${jsonReportPath}`);
    
    return report;
  }

  generateTextReport(report) {
    const lines = [
      '='.repeat(60),
      'MUTATION TEST REPORT',
      '='.repeat(60),
      `Timestamp: ${report.timestamp}`,
      `Average Mutation Score: ${report.summary.averageScore}%`,
      `Packages Passed: ${report.summary.passed}/${report.summary.total}`,
      '',
      'PACKAGE RESULTS:',
      '-'.repeat(40)
    ];

    for (const [pkg, result] of Object.entries(report.packages)) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const score = result.mutationScore.toFixed(1);
      const threshold = result.threshold;
      lines.push(`${status} ${pkg.padEnd(15)} ${score}% (≥${threshold}%)`);
    }

    lines.push('', '='.repeat(60));
    
    return lines.join('\n');
  }

  async run() {
    // Check Stryker installation
    const strykerAvailable = await this.checkStrykerInstallation();
    if (!strykerAvailable) {
      throw new Error('Stryker mutation testing framework is not available');
    }

    const packagesToTest = this.options.packages.filter(pkg => 
      MUTATION_PACKAGES[pkg] && fs.existsSync(path.join(PACKAGES_DIR, pkg))
    );

    if (packagesToTest.length === 0) {
      this.log('No packages available for mutation testing', 'warn');
      return { success: true, results: {} };
    }

    this.log(`Running mutation tests for ${packagesToTest.length} packages: ${packagesToTest.join(', ')}`);

    for (const pkg of packagesToTest) {
      try {
        const result = await this.runMutationTest(pkg, MUTATION_PACKAGES[pkg]);
        this.results[pkg] = result;
      } catch (error) {
        this.log(`Mutation test failed for ${pkg}: ${error.message}`, 'error');
        this.results[pkg] = {
          package: pkg,
          success: false,
          error: error.message,
          mutationScore: 0,
          passed: false
        };
      }
    }

    const report = await this.generateReport();
    
    // Print summary
    console.log('\n' + this.generateTextReport(report));

    const allPassed = Object.values(this.results).every(r => r.passed);
    
    return {
      success: allPassed,
      results: this.results,
      report
    };
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--packages':
        options.packages = args[++i]?.split(',');
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Mutation Tester - Run mutation tests on security-critical packages

Usage: node mutation-test.js [options]

Options:
  --packages pkg1,pkg2  Run mutation tests only for specified packages
  --verbose             Show detailed output
  --dry-run             Show what would be tested without running
  --help                Show this help message

Default packages: security, datascience (≥85% mutation score required)

Examples:
  node mutation-test.js
  node mutation-test.js --packages security --verbose
  node mutation-test.js --dry-run
        `);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const tester = new MutationTester(options);
  
  try {
    const result = await tester.run();
    
    if (result.success) {
      console.log('\n✅ All mutation tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some mutation tests failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Mutation testing failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MutationTester;