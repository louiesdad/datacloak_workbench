#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');

// Memory usage threshold (4GB)
const MEMORY_THRESHOLD_MB = 4096;

// Get initial system info
console.log('System Information:');
console.log('- Total Memory:', Math.round(os.totalmem() / 1024 / 1024), 'MB');
console.log('- Free Memory:', Math.round(os.freemem() / 1024 / 1024), 'MB');
console.log('- CPUs:', os.cpus().length);
console.log('- Memory Threshold:', MEMORY_THRESHOLD_MB, 'MB');
console.log('');

// Start monitoring interval
const monitoringInterval = setInterval(() => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  
  if (rssMB > MEMORY_THRESHOLD_MB) {
    console.error(`⚠️  Memory usage exceeded threshold: ${rssMB}MB > ${MEMORY_THRESHOLD_MB}MB`);
    console.error('Terminating test process to prevent system instability...');
    testProcess.kill('SIGTERM');
    process.exit(1);
  }
  
  // Log memory usage every 10 seconds
  if (Date.now() % 10000 < 1000) {
    console.log(`Memory: Heap ${heapUsedMB}/${heapTotalMB}MB, RSS ${rssMB}MB`);
  }
}, 1000);

// Run Jest with memory optimization flags
const args = [
  '--expose-gc',  // Allow manual garbage collection
  '--max-old-space-size=3072',  // Limit heap to 3GB
  'node_modules/.bin/jest',
  ...process.argv.slice(2)
];

console.log('Starting Jest with args:', args.join(' '));
console.log('');

const testProcess = spawn('node', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--expose-gc --max-old-space-size=3072'
  }
});

testProcess.on('exit', (code) => {
  clearInterval(monitoringInterval);
  
  const used = process.memoryUsage();
  console.log('');
  console.log('Final Memory Usage:');
  console.log('- Heap Used:', Math.round(used.heapUsed / 1024 / 1024), 'MB');
  console.log('- Heap Total:', Math.round(used.heapTotal / 1024 / 1024), 'MB');
  console.log('- RSS:', Math.round(used.rss / 1024 / 1024), 'MB');
  
  process.exit(code);
});

testProcess.on('error', (err) => {
  clearInterval(monitoringInterval);
  console.error('Failed to start test process:', err);
  process.exit(1);
});

// Handle termination signals
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    clearInterval(monitoringInterval);
    testProcess.kill(signal);
    process.exit(0);
  });
});