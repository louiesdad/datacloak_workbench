const http = require('http');

console.log('=== Verifying Which API Key the Running Backend is Using ===\n');

// Make a request to the backend to trigger an OpenAI call
const testData = JSON.stringify({
  text: 'Test sentiment',
  provider: 'openai',
  model: 'gpt-3.5-turbo'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/sentiment/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log('1. Making request to backend to check which key it\'s using...\n');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Response Status: ${res.statusCode}`);
    console.log('Response:', data);
    
    if (data.includes('Circuit breaker is OPEN')) {
      console.log('\n❌ Circuit breaker is blocking requests');
      console.log('The backend needs the circuit breaker reset.');
      console.log('\nTo fix:');
      console.log('1. Reset the circuit breaker:');
      console.log('   curl -X POST http://localhost:3001/api/v1/circuit-breaker/reset/openai-api');
      console.log('\n2. Then try the sentiment analysis again');
    } else if (data.includes('authentication') || data.includes('401')) {
      console.log('\n❌ Backend is still using the OLD API key');
      console.log('The backend process needs to be fully restarted.');
      console.log('\nTo fix:');
      console.log('1. Stop the backend completely (Ctrl+C or kill the process)');
      console.log('2. Make sure no node processes are running: pkill node');
      console.log('3. Start the backend again: npm run dev');
    } else if (res.statusCode === 200) {
      console.log('\n✅ Backend is working correctly!');
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Cannot connect to backend:', e.message);
  console.error('Make sure the backend is running on port 3001');
});

req.write(testData);
req.end();

// Also check the environment
console.log('\n2. Current environment check:');
require('dotenv').config({ path: './.env' });
const currentKey = process.env.OPENAI_API_KEY;
console.log(`   .env file key ends with: ...${currentKey ? currentKey.slice(-10) : 'NOT FOUND'}`);
console.log(`   Expected ending: ...G9FteEcA`);

if (currentKey && currentKey.endsWith('G9FteEcA')) {
  console.log('   ✅ The .env file has the correct new key');
} else {
  console.log('   ❌ The .env file does not have the expected key');
}