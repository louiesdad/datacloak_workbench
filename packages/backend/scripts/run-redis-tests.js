#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running Redis Queue Tests with ts-node...\n');

const testFiles = [
  'src/services/__tests__/redis-queue.service.test.ts',
  'src/tests/redis-queue.test.ts'
];

let totalPassed = 0;
let totalFailed = 0;

for (const testFile of testFiles) {
  console.log(`\n📋 Running ${testFile}...`);
  console.log('='.repeat(50));
  
  try {
    // Use ts-node to run the test file directly
    const result = execSync(
      `npx ts-node -r tsconfig-paths/register --project tsconfig.test.json -e "
        process.env.NODE_ENV = 'test';
        require('${path.resolve(__dirname, '../tests/setup.ts')}');
        const jest = require('jest');
        jest.run(['${testFile}', '--no-coverage']);
      "`,
      { 
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..')
      }
    );
    totalPassed++;
  } catch (error) {
    console.error(`\n❌ Failed to run ${testFile}`);
    totalFailed++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`✅ Total Passed: ${totalPassed}`);
console.log(`❌ Total Failed: ${totalFailed}`);

process.exit(totalFailed > 0 ? 1 : 0);