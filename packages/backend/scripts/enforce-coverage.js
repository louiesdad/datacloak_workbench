#!/usr/bin/env node

/**
 * Coverage Enforcement Script
 * dev01-022: Set up coverage enforcement
 * 
 * This script enforces test coverage thresholds and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Coverage thresholds (should match jest.config.js)
const COVERAGE_THRESHOLDS = {
  global: {
    branches: 75,
    functions: 80,
    lines: 80,
    statements: 80
  },
  critical: {
    'src/services/cache.service.ts': { branches: 85, functions: 90, lines: 90, statements: 90 },
    'src/services/config.service.ts': { branches: 85, functions: 90, lines: 90, statements: 90 },
    'src/services/security.service.ts': { branches: 80, functions: 85, lines: 85, statements: 85 }
  }
};

function runCoverageCheck() {
  console.log('🔍 Running coverage enforcement...\n');
  
  try {
    // Run tests with coverage
    console.log('📊 Generating coverage report...');
    execSync('npm run test:coverage', { stdio: 'inherit' });
    
    // Check if coverage directory exists
    const coverageDir = path.join(__dirname, '..', 'coverage');
    if (!fs.existsSync(coverageDir)) {
      console.error('❌ Coverage directory not found. Run tests with coverage first.');
      process.exit(1);
    }
    
    // Read coverage summary
    const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
    if (!fs.existsSync(coverageSummaryPath)) {
      console.error('❌ Coverage summary not found.');
      process.exit(1);
    }
    
    const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
    
    console.log('\n📈 Coverage Report:');
    console.log('==================');
    
    const total = coverageSummary.total;
    const results = {
      branches: total.branches.pct,
      functions: total.functions.pct,
      lines: total.lines.pct,
      statements: total.statements.pct
    };
    
    let passed = true;
    
    // Check global thresholds
    console.log('\n🌍 Global Coverage:');
    for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS.global)) {
      const actual = results[metric];
      const status = actual >= threshold ? '✅' : '❌';
      console.log(`  ${status} ${metric}: ${actual.toFixed(1)}% (required: ${threshold}%)`);
      
      if (actual < threshold) {
        passed = false;
      }
    }
    
    // Check critical file thresholds
    console.log('\n🔥 Critical Files:');
    for (const [filePath, thresholds] of Object.entries(COVERAGE_THRESHOLDS.critical)) {
      const fileData = coverageSummary[filePath];
      if (fileData) {
        console.log(`\n📁 ${filePath}:`);
        for (const [metric, threshold] of Object.entries(thresholds)) {
          const actual = fileData[metric].pct;
          const status = actual >= threshold ? '✅' : '❌';
          console.log(`  ${status} ${metric}: ${actual.toFixed(1)}% (required: ${threshold}%)`);
          
          if (actual < threshold) {
            passed = false;
          }
        }
      } else {
        console.log(`⚠️  ${filePath}: No coverage data found`);
      }
    }
    
    // Generate coverage badges
    generateCoverageBadges(results);
    
    // Final result
    console.log('\n' + '='.repeat(50));
    if (passed) {
      console.log('🎉 All coverage thresholds met!');
      console.log('📊 Coverage report: coverage/lcov-report/index.html');
      process.exit(0);
    } else {
      console.log('❌ Coverage thresholds not met. Please add more tests.');
      console.log('📊 Coverage report: coverage/lcov-report/index.html');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Coverage enforcement failed:', error.message);
    process.exit(1);
  }
}

function generateCoverageBadges(results) {
  console.log('\n🏷️  Generating coverage badges...');
  
  const badgesDir = path.join(__dirname, '..', 'coverage', 'badges');
  if (!fs.existsSync(badgesDir)) {
    fs.mkdirSync(badgesDir, { recursive: true });
  }
  
  // Generate simple text badges (could be enhanced with SVG generation)
  const badges = {
    overall: Math.round((results.lines + results.functions + results.branches + results.statements) / 4),
    lines: Math.round(results.lines),
    functions: Math.round(results.functions),
    branches: Math.round(results.branches),
    statements: Math.round(results.statements)
  };
  
  const badgeContent = JSON.stringify(badges, null, 2);
  fs.writeFileSync(path.join(badgesDir, 'coverage.json'), badgeContent);
  
  console.log('  📊 Coverage badges generated: coverage/badges/coverage.json');
}

// Add npm script check
function checkNpmScripts() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (!packageJson.scripts['test:coverage']) {
    console.log('⚠️  Adding test:coverage script to package.json...');
    packageJson.scripts['test:coverage'] = 'jest --coverage';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ test:coverage script added');
  }
  
  if (!packageJson.scripts['coverage:enforce']) {
    console.log('⚠️  Adding coverage:enforce script to package.json...');
    packageJson.scripts['coverage:enforce'] = 'node scripts/enforce-coverage.js';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ coverage:enforce script added');
  }
}

// CLI
if (require.main === module) {
  checkNpmScripts();
  runCoverageCheck();
}

module.exports = { runCoverageCheck, COVERAGE_THRESHOLDS };