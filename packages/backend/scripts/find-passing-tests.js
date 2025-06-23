#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Finding passing tests...\n');

// Get all test files
const testFiles = execSync('npx jest --listTests 2>/dev/null', { encoding: 'utf8' })
  .split('\n')
  .filter(file => file.endsWith('.test.ts') || file.endsWith('.test.js'))
  .filter(file => !file.includes('__tests__')); // Skip the new test files we created

const passingTests = [];
const failingTests = [];

// Test each file individually
for (const testFile of testFiles) {
  if (!testFile) continue;
  
  try {
    // Run test without coverage to be faster
    execSync(`npx jest "${testFile}" --no-coverage --testTimeout=10000`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });
    passingTests.push(testFile);
    console.log(`✅ ${path.basename(testFile)}`);
  } catch (error) {
    failingTests.push(testFile);
    console.log(`❌ ${path.basename(testFile)}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`✅ Passing: ${passingTests.length}`);
console.log(`❌ Failing: ${failingTests.length}`);

// Save results
fs.writeFileSync(
  path.join(__dirname, 'passing-tests.txt'),
  passingTests.join('\n')
);

fs.writeFileSync(
  path.join(__dirname, 'failing-tests.txt'),
  failingTests.join('\n')
);

console.log('\n📝 Results saved to:');
console.log('- scripts/passing-tests.txt');
console.log('- scripts/failing-tests.txt');

// Run coverage on passing tests only
if (passingTests.length > 0) {
  console.log('\n🧪 Running coverage on passing tests...');
  
  try {
    const coverageCmd = `npx jest ${passingTests.map(t => `"${t}"`).join(' ')} --coverage --coverageReporters="text-summary" --collectCoverageFrom="src/**/*.ts"`;
    
    execSync(coverageCmd, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to run coverage:', error.message);
  }
}