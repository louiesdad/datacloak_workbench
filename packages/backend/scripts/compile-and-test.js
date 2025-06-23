#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Compiling TypeScript files...\n');

try {
  // First, compile the TypeScript files
  execSync('npx tsc --project tsconfig.test.json --outDir test-dist', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
  console.log('✅ Compilation successful!\n');
  
  // Now run the compiled JavaScript files with Jest
  console.log('🧪 Running tests...\n');
  
  execSync('npx jest test-dist/src/services/__tests__/redis-queue.service.test.js --no-coverage', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  
} catch (error) {
  console.error('❌ Test execution failed');
  process.exit(1);
} finally {
  // Clean up
  if (fs.existsSync(path.resolve(__dirname, '../test-dist'))) {
    execSync('rm -rf test-dist', {
      cwd: path.resolve(__dirname, '..')
    });
  }
}