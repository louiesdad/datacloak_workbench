#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Group test files by category to run in batches
const testBatches = [
  {
    name: 'Unit Tests - Services Part 1',
    pattern: 'src/services/__tests__/(cache|config|compliance|connection-status).service.test.ts'
  },
  {
    name: 'Unit Tests - Services Part 2', 
    pattern: 'src/services/__tests__/(data|datacloak|datacloak-stream).service.test.ts'
  },
  {
    name: 'Unit Tests - Services Part 3',
    pattern: 'src/services/__tests__/(enhanced-cache|enhanced-database|openai).service.test.ts'
  },
  {
    name: 'Unit Tests - Services Part 4',
    pattern: 'src/services/__tests__/(redis-queue|security|sentiment).service.test.ts'
  },
  {
    name: 'Unit Tests - Services Part 5',
    pattern: 'src/services/__tests__/(transform-validation|websocket).service.test.ts'
  },
  {
    name: 'Unit Tests - Other',
    pattern: 'src/tests/unit/**/*.test.ts'
  },
  {
    name: 'Integration Tests',
    pattern: 'src/tests/integration/**/*.test.ts',
    timeout: 60000
  }
];

let totalPassed = 0;
let totalFailed = 0;
let coverageData = {};

console.log('Running tests in batches to avoid timeouts...\n');

for (const batch of testBatches) {
  console.log(`\n🔄 Running: ${batch.name}`);
  console.log(`Pattern: ${batch.pattern}\n`);
  
  try {
    const timeout = batch.timeout || 30000;
    const cmd = `npx jest "${batch.pattern}" --coverage --collectCoverageFrom="src/**/*.ts" --coverageReporters="json-summary" --testTimeout=${timeout} --maxWorkers=1 --forceExit`;
    
    execSync(cmd, { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    
    totalPassed++;
    console.log(`✅ ${batch.name} - PASSED\n`);
  } catch (error) {
    totalFailed++;
    console.log(`❌ ${batch.name} - FAILED\n`);
  }
}

console.log('\n📊 Test Summary:');
console.log(`✅ Passed: ${totalPassed} batches`);
console.log(`❌ Failed: ${totalFailed} batches`);

// Try to get overall coverage
try {
  const coverageSummary = require('../coverage/coverage-summary.json');
  console.log('\n📈 Coverage Summary:');
  console.log(`Statements: ${coverageSummary.total.statements.pct}%`);
  console.log(`Branches: ${coverageSummary.total.branches.pct}%`);
  console.log(`Functions: ${coverageSummary.total.functions.pct}%`);
  console.log(`Lines: ${coverageSummary.total.lines.pct}%`);
} catch (error) {
  console.log('\n⚠️  Could not read coverage summary');
}

process.exit(totalFailed > 0 ? 1 : 0);