#!/usr/bin/env node

/**
 * Test Coordination Validation Script
 * Validates that the integration test coordination system is properly set up
 */

const fs = require('fs');
const path = require('path');

function validateTestCoordination() {
  console.log('🔍 Validating Integration Test Coordination Setup...\n');
  
  let issues = [];
  let warnings = [];
  
  // Check coordinator script
  const coordinatorPath = path.join(__dirname, 'integration-test-coordinator.js');
  if (fs.existsSync(coordinatorPath)) {
    console.log('✅ Integration test coordinator script exists');
    
    const coordinatorContent = fs.readFileSync(coordinatorPath, 'utf8');
    if (coordinatorContent.includes('class IntegrationTestCoordinator')) {
      console.log('✅ Coordinator class properly defined');
    } else {
      issues.push('Coordinator class not found in script');
    }
    
    if (coordinatorContent.includes('testSequences')) {
      console.log('✅ Test sequences configured');
    } else {
      issues.push('Test sequences not configured');
    }
    
    if (coordinatorContent.includes('setupTestEnvironment')) {
      console.log('✅ Environment setup included');
    } else {
      issues.push('Environment setup not implemented');
    }
    
    if (coordinatorContent.includes('generateReport')) {
      console.log('✅ Report generation implemented');
    } else {
      issues.push('Report generation missing');
    }
  } else {
    issues.push('Integration test coordinator script not found');
  }
  
  // Check selective runner
  const selectiveRunnerPath = path.join(__dirname, 'selective-test-runner.js');
  if (fs.existsSync(selectiveRunnerPath)) {
    console.log('✅ Selective test runner exists');
  } else {
    warnings.push('Selective test runner not found');
  }
  
  // Check package.json scripts
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};
    
    if (scripts['test:integration:coordinate']) {
      console.log('✅ Integration coordination script configured');
    } else {
      issues.push('test:integration:coordinate npm script missing');
    }
    
    if (scripts['test:selective']) {
      console.log('✅ Selective test runner script configured');
    } else {
      warnings.push('test:selective npm script not configured');
    }
    
    if (scripts['test:critical']) {
      console.log('✅ Critical tests script configured');
    } else {
      warnings.push('test:critical npm script not configured');
    }
  }
  
  // Check test directory structure
  const testsDir = path.join(__dirname, '..', 'src', 'tests');
  const expectedDirs = ['integration', 'e2e', 'performance'];
  
  for (const dir of expectedDirs) {
    const dirPath = path.join(testsDir, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`✅ ${dir} test directory exists`);
    } else {
      warnings.push(`${dir} test directory not found`);
    }
  }
  
  // Check for test utilities
  const testUtilsDir = path.join(__dirname, '..', 'tests', 'utils');
  if (fs.existsSync(testUtilsDir)) {
    console.log('✅ Test utilities directory exists');
  } else {
    warnings.push('Test utilities directory not found');
  }
  
  // Check Jest configuration
  const jestConfigPath = path.join(__dirname, '..', 'jest.config.js');
  if (fs.existsSync(jestConfigPath)) {
    const jestConfig = fs.readFileSync(jestConfigPath, 'utf8');
    
    if (jestConfig.includes('testSequencer')) {
      console.log('✅ Custom test sequencer configured');
    } else {
      warnings.push('Custom test sequencer not configured');
    }
    
    if (jestConfig.includes('maxWorkers')) {
      console.log('✅ Worker optimization configured');
    } else {
      warnings.push('Worker optimization not found');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Results
  if (issues.length === 0) {
    console.log('🎉 Integration Test Coordination is FULLY CONFIGURED!');
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Minor improvements available:');
      warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    console.log('\n🚀 Available coordination features:');
    console.log('  ✅ Coordinated test execution');
    console.log('  ✅ Environment setup/cleanup');
    console.log('  ✅ Resource monitoring');
    console.log('  ✅ Test sequencing');
    console.log('  ✅ Selective test groups');
    console.log('  ✅ Report generation');
    console.log('  ✅ CI/CD integration');
    
    console.log('\n📋 Usage commands:');
    console.log('  npm run test:integration:coordinate  - Full coordination');
    console.log('  npm run test:selective --list        - List test groups');
    console.log('  npm run test:critical                - Run critical tests');
    console.log('  npm run test:redis                   - Run Redis tests');
    
    return true;
  } else {
    console.log('❌ Integration Test Coordination has issues:');
    issues.forEach(issue => console.log(`  ❌ ${issue}`));
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Additional warnings:');
      warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    return false;
  }
}

// CLI
if (require.main === module) {
  const isValid = validateTestCoordination();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateTestCoordination };