const http = require('http');

// Test if the dev server is actually running
const testUrl = (url) => {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      console.log(`Testing ${url}:`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Response length: ${data.length} bytes`);
        console.log(`First 500 chars:`, data.substring(0, 500));
        resolve({ status: res.statusCode, data });
      });
    }).on('error', (err) => {
      console.error(`Error testing ${url}:`, err.message);
      reject(err);
    });
  });
};

// Test different ports
const test = async () => {
  console.log('Testing frontend servers...\n');
  
  // Test Vite dev server
  try {
    await testUrl('http://localhost:5173');
  } catch (e) {
    console.log('Vite dev server not accessible on port 5173');
  }
  
  console.log('\n---\n');
  
  // Test Docker nginx server
  try {
    await testUrl('http://localhost:3000');
  } catch (e) {
    console.log('Docker nginx server not accessible on port 3000');
  }
  
  console.log('\n---\n');
  
  // Test backend
  try {
    await testUrl('http://localhost:3001/health');
  } catch (e) {
    console.log('Backend not accessible on port 3001');
  }
};

test();