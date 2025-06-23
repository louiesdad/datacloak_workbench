#!/usr/bin/env node

/**
 * Selective Test Runner
 * Companion to integration test coordinator for targeted test execution
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class SelectiveTestRunner {
  constructor() {
    this.testGroups = {
      unit: {
        pattern: '**/__tests__/**/*.test.ts',
        timeout: 6000,
        workers: 4,
        description: 'Unit tests (fast)'
      },
      
      integration: {
        pattern: '**/tests/integration/**/*.test.ts',
        timeout: 15000,
        workers: 2,
        description: 'Integration tests'
      },
      
      e2e: {
        pattern: '**/tests/e2e/**/*.test.ts',
        timeout: 30000,
        workers: 1,
        description: 'End-to-end tests'
      },
      
      performance: {
        pattern: '**/tests/performance/**/*.test.ts',
        timeout: 60000,
        workers: 1,
        description: 'Performance tests'
      },
      
      critical: {
        files: [
          'src/services/__tests__/cache.service.test.ts',
          'src/services/__tests__/config.service.test.ts',
          'src/services/__tests__/security.service.test.ts',
          'src/services/__tests__/enhanced-cache.service.test.ts'
        ],
        timeout: 8000,
        workers: 2,
        description: 'Critical service tests'
      },
      
      redis: {
        files: [
          'src/services/__tests__/redis-queue.service.test.ts',
          'src/services/__tests__/cache.service.test.ts',
          'src/tests/redis-queue.test.ts'
        ],
        timeout: 10000,
        workers: 1,
        description: 'Redis-dependent tests'
      }
    };
  }

  async runTestGroup(groupName, options = {}) {
    const group = this.testGroups[groupName];
    if (!group) {
      throw new Error(`Unknown test group: ${groupName}`);
    }

    console.log(`🚀 Running ${group.description}...`);
    console.log('='.repeat(50));

    const {
      coverage = false,
      silent = false,
      bail = false,
      watch = false
    } = options;

    let command = 'npm test --';
    
    // Add test pattern or files
    if (group.pattern) {
      command += ` --testPathPattern="${group.pattern}"`;
    } else if (group.files) {
      const existingFiles = group.files.filter(file => fs.existsSync(file));
      if (existingFiles.length === 0) {
        console.log('⚠️  No test files found for this group');
        return { success: true, skipped: true };
      }
      command += ` ${existingFiles.join(' ')}`;
    }

    // Add options
    command += ` --testTimeout=${group.timeout}`;
    command += ` --maxWorkers=${group.workers}`;
    
    if (coverage) {
      command += ' --coverage';
    }
    
    if (silent) {
      command += ' --silent';
    }
    
    if (bail) {
      command += ' --bail';
    }
    
    if (watch) {
      command += ' --watch';
    }

    try {
      console.log(`📋 Command: ${command}`);
      console.log('');
      
      const startTime = Date.now();
      execSync(command, { 
        stdio: silent ? 'pipe' : 'inherit',
        timeout: group.timeout + 10000
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ ${group.description} completed in ${duration}s`);
      
      return { success: true, duration: parseFloat(duration) };

    } catch (error) {
      console.log(`\n❌ ${group.description} failed`);
      if (!silent) {
        console.error(error.message);
      }
      
      return { success: false, error: error.message };
    }
  }

  async runMultipleGroups(groupNames, options = {}) {
    console.log('🎯 Running multiple test groups...');
    console.log(`Groups: ${groupNames.join(', ')}`);
    console.log('='.repeat(50));

    const results = {};
    let totalDuration = 0;
    let failed = 0;

    for (const groupName of groupNames) {
      console.log(`\n📂 Starting group: ${groupName}`);
      const result = await this.runTestGroup(groupName, options);
      
      results[groupName] = result;
      
      if (result.duration) {
        totalDuration += result.duration;
      }
      
      if (!result.success && !result.skipped) {
        failed++;
        
        if (options.bail) {
          console.log('🛑 Stopping due to failure (bail option)');
          break;
        }
      }
      
      // Add delay between groups
      if (groupNames.indexOf(groupName) < groupNames.length - 1) {
        console.log('⏳ Waiting 2s before next group...');
        await this.sleep(2000);
      }
    }

    // Summary
    console.log('\n📊 Multi-group Test Summary');
    console.log('='.repeat(50));
    console.log(`Total duration: ${totalDuration.toFixed(1)}s`);
    console.log(`Groups run: ${Object.keys(results).length}`);
    console.log(`Failed: ${failed}`);
    
    for (const [group, result] of Object.entries(results)) {
      const status = result.skipped ? '⚠️ ' : (result.success ? '✅' : '❌');
      const duration = result.duration ? ` (${result.duration}s)` : '';
      console.log(`  ${status} ${group}${duration}`);
    }

    return {
      success: failed === 0,
      results,
      totalDuration,
      failed
    };
  }

  listTestGroups() {
    console.log('📋 Available Test Groups:');
    console.log('='.repeat(30));
    
    for (const [name, group] of Object.entries(this.testGroups)) {
      console.log(`\n🏷️  ${name}`);
      console.log(`   ${group.description}`);
      console.log(`   Timeout: ${group.timeout}ms`);
      console.log(`   Workers: ${group.workers}`);
      
      if (group.pattern) {
        console.log(`   Pattern: ${group.pattern}`);
      } else if (group.files) {
        console.log(`   Files: ${group.files.length} specific test files`);
      }
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI handling
if (require.main === module) {
  const runner = new SelectiveTestRunner();
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('🧪 Selective Test Runner');
    console.log('=======================');
    console.log('');
    console.log('Usage:');
    console.log('  node selective-test-runner.js <group-name> [options]');
    console.log('  node selective-test-runner.js --list');
    console.log('  node selective-test-runner.js --groups unit,integration');
    console.log('');
    console.log('Options:');
    console.log('  --coverage     Include coverage collection');
    console.log('  --silent       Run silently');
    console.log('  --bail         Stop on first failure');
    console.log('  --watch        Watch mode');
    console.log('  --groups       Run multiple groups (comma-separated)');
    console.log('');
    runner.listTestGroups();
    process.exit(0);
  }

  const options = {
    coverage: args.includes('--coverage'),
    silent: args.includes('--silent'),
    bail: args.includes('--bail'),
    watch: args.includes('--watch')
  };

  async function run() {
    try {
      if (args[0] === '--list') {
        runner.listTestGroups();
        return;
      }

      if (args[0] === '--groups') {
        const groupsArg = args.find(arg => arg.startsWith('--groups='));
        if (!groupsArg) {
          console.error('❌ --groups flag requires a value. Example: --groups=unit,integration');
          process.exit(1);
        }
        
        const groups = groupsArg.split('=')[1].split(',');
        const result = await runner.runMultipleGroups(groups, options);
        process.exit(result.success ? 0 : 1);
        return;
      }

      // Single group
      const groupName = args[0];
      const result = await runner.runTestGroup(groupName, options);
      process.exit(result.success ? 0 : 1);

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  run();
}

module.exports = SelectiveTestRunner;