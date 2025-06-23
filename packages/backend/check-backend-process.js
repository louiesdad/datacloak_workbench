const { exec } = require('child_process');
const http = require('http');

console.log('=== Checking Backend Process ===\n');

// Check if any process is listening on port 3001
exec('lsof -i :3001', (error, stdout, stderr) => {
  console.log('1. Checking port 3001:');
  if (error) {
    console.log('   No process found listening on port 3001');
    console.log('   The backend is NOT running\n');
    
    console.log('To start the backend:');
    console.log('   cd /Users/thomaswagner/Documents/datacloak-sentiment-workbench/packages/backend');
    console.log('   npm run dev\n');
  } else {
    console.log('   Process found on port 3001:');
    console.log(stdout);
  }
  
  // Check for node processes
  exec('ps aux | grep -E "node.*backend|npm.*dev" | grep -v grep', (error, stdout, stderr) => {
    console.log('\n2. Node/npm processes related to backend:');
    if (stdout) {
      console.log(stdout);
    } else {
      console.log('   No backend-related node processes found');
    }
  });
});

// Try different ports
console.log('\n3. Trying to connect to common ports:');
const ports = [3000, 3001, 3002, 4000, 5000, 8080];

ports.forEach(port => {
  const options = {
    hostname: 'localhost',
    port: port,
    path: '/health',
    method: 'GET',
    timeout: 1000
  };
  
  const req = http.request(options, (res) => {
    console.log(`   ✓ Port ${port}: Something is responding (status ${res.statusCode})`);
  });
  
  req.on('error', () => {
    // Silent fail - port not open
  });
  
  req.on('timeout', () => {
    req.destroy();
  });
  
  req.end();
});