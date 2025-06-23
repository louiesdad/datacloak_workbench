#!/usr/bin/env node

/**
 * Script to optimize test timeouts across the codebase
 * 
 * This script:
 * 1. Identifies long timeouts in tests
 * 2. Suggests optimizations
 * 3. Can automatically apply safe optimizations
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Timeout mappings for optimization
const TIMEOUT_MAPPINGS = {
  // Circuit breaker timeouts
  'resetTimeout: 30000': 'resetTimeout: 1000',
  'resetTimeout: 10000': 'resetTimeout: 500',
  'resetTimeout: 5000': 'resetTimeout: 200',
  
  // Rate limiter timeouts
  'windowMs: 60000': 'windowMs: 1000',
  'windowMs: 900000': 'windowMs: 1000',
  
  // Promise timeouts
  'setTimeout(resolve, 5000)': 'setTimeout(resolve, 500)',
  'setTimeout(resolve, 3000)': 'setTimeout(resolve, 300)',
  'setTimeout(resolve, 2000)': 'setTimeout(resolve, 200)',
  'setTimeout(resolve, 1000)': 'setTimeout(resolve, 100)',
  
  // Wait timeouts
  'waitForJob(jobId, 30000)': 'waitForJob(jobId, 2000)',
  'waitForJob(jobId, 15000)': 'waitForJob(jobId, 1500)',
  'waitForJob(jobId, 10000)': 'waitForJob(jobId, 1000)',
  'waitForJob(jobId, 5000)': 'waitForJob(jobId, 500)',
  
  // API timeouts
  'timeout: 30000': 'timeout: 5000',
  'timeout: 10000': 'timeout: 2000',
  'timeout: 5000': 'timeout: 1000',
  
  // Test-specific timeouts
  'jest.setTimeout(60000)': 'jest.setTimeout(10000)',
  'jest.setTimeout(30000)': 'jest.setTimeout(5000)',
};

// Patterns to identify test files
const TEST_FILE_PATTERNS = [
  'src/**/*.test.ts',
  'src/**/*.test.js',
  'tests/**/*.test.ts',
  'tests/**/*.test.js'
];

// Patterns that should NOT be optimized
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/performance/**', // Performance tests may need longer timeouts
];

class TestTimeoutOptimizer {
  constructor(options = {}) {
    this.dryRun = options.dryRun !== false;
    this.verbose = options.verbose || false;
    this.stats = {
      filesProcessed: 0,
      optimizationsFound: 0,
      optimizationsApplied: 0,
      errors: 0
    };
  }

  async optimize() {
    console.log('🚀 Starting test timeout optimization...\n');
    
    const testFiles = this.findTestFiles();
    console.log(`Found ${testFiles.length} test files to analyze\n`);
    
    for (const file of testFiles) {
      await this.processFile(file);
    }
    
    this.printSummary();
  }

  findTestFiles() {
    const files = [];
    
    for (const pattern of TEST_FILE_PATTERNS) {
      const matches = glob.sync(pattern, {
        ignore: EXCLUDE_PATTERNS,
        absolute: true
      });
      files.push(...matches);
    }
    
    return [...new Set(files)]; // Remove duplicates
  }

  async processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const optimizations = this.findOptimizations(content);
      
      if (optimizations.length === 0) {
        return;
      }
      
      this.stats.filesProcessed++;
      
      console.log(`\n📄 ${path.relative(process.cwd(), filePath)}`);
      console.log(`   Found ${optimizations.length} potential optimizations:`);
      
      let optimizedContent = content;
      
      for (const opt of optimizations) {
        console.log(`   - Line ${opt.line}: ${opt.original} → ${opt.replacement}`);
        this.stats.optimizationsFound++;
        
        if (!this.dryRun) {
          optimizedContent = optimizedContent.replace(opt.original, opt.replacement);
          this.stats.optimizationsApplied++;
        }
      }
      
      if (!this.dryRun && optimizedContent !== content) {
        fs.writeFileSync(filePath, optimizedContent);
        console.log(`   ✅ Applied optimizations`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${filePath}:`, error.message);
      this.stats.errors++;
    }
  }

  findOptimizations(content) {
    const lines = content.split('\n');
    const optimizations = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      for (const [pattern, replacement] of Object.entries(TIMEOUT_MAPPINGS)) {
        if (line.includes(pattern)) {
          optimizations.push({
            line: lineNumber,
            original: pattern,
            replacement: replacement
          });
        }
      }
      
      // Check for custom patterns
      const customPatterns = [
        {
          regex: /setTimeout\(\s*\(\)\s*=>\s*resolve\([^)]*\)\s*,\s*(\d{4,})\)/g,
          handler: (match, timeout) => {
            const ms = parseInt(timeout);
            if (ms >= 1000) {
              const optimized = Math.min(ms / 10, 500);
              return {
                original: match,
                replacement: match.replace(timeout, optimized.toString())
              };
            }
          }
        },
        {
          regex: /await\s+new\s+Promise.*setTimeout.*,\s*(\d{4,})\)/g,
          handler: (match, timeout) => {
            const ms = parseInt(timeout);
            if (ms >= 1000) {
              const optimized = Math.min(ms / 10, 500);
              return {
                original: match,
                replacement: match.replace(timeout, optimized.toString())
              };
            }
          }
        }
      ];
      
      for (const { regex, handler } of customPatterns) {
        const matches = line.matchAll(regex);
        for (const match of matches) {
          const result = handler(match[0], match[1]);
          if (result) {
            optimizations.push({
              line: lineNumber,
              ...result
            });
          }
        }
      }
    }
    
    return optimizations;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Optimization Summary:');
    console.log('='.repeat(60));
    console.log(`Files processed:        ${this.stats.filesProcessed}`);
    console.log(`Optimizations found:    ${this.stats.optimizationsFound}`);
    console.log(`Optimizations applied:  ${this.stats.optimizationsApplied}`);
    console.log(`Errors:                 ${this.stats.errors}`);
    
    if (this.dryRun) {
      console.log('\n⚠️  Running in dry-run mode. No files were modified.');
      console.log('   Run with --apply to apply optimizations.');
    } else {
      console.log('\n✅ Optimizations applied successfully!');
    }
    
    // Suggest next steps
    console.log('\n💡 Next steps:');
    console.log('1. Run tests to ensure they still pass: npm test');
    console.log('2. Check for any flaky tests that may need adjustment');
    console.log('3. Consider using jest.config.optimized.js for faster test runs');
    console.log('4. Use TEST_TIMEOUTS constants from timeout-optimization.ts');
  }
}

// CLI handling
const args = process.argv.slice(2);
const options = {
  dryRun: !args.includes('--apply'),
  verbose: args.includes('--verbose')
};

if (args.includes('--help')) {
  console.log(`
Test Timeout Optimizer

Usage: node optimize-test-timeouts.js [options]

Options:
  --apply     Apply optimizations (default is dry-run)
  --verbose   Show detailed output
  --help      Show this help message

Examples:
  # Preview optimizations (dry-run)
  node optimize-test-timeouts.js

  # Apply optimizations
  node optimize-test-timeouts.js --apply
`);
  process.exit(0);
}

// Run the optimizer
const optimizer = new TestTimeoutOptimizer(options);
optimizer.optimize().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});