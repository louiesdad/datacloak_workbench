const http = require('http');
const https = require('https');

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: body,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.setTimeout(15000);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testAPI() {
  const BASE_URL = 'http://localhost:3001';
  
  console.log('OpenAI API Connection Test\n');
  console.log('=' .repeat(50));
  
  // Test 1: Backend health check
  console.log('\n1. Backend Health Check');
  try {
    const result = await makeRequest(`${BASE_URL}/api/health`);
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Response: ${result.body || 'OK'}`);
  } catch (err) {
    console.log(`   ERROR: Backend not accessible - ${err.message}`);
    console.log('\n   The backend server is not running on port 3001.');
    console.log('   Please start the backend server first with:');
    console.log('     cd packages/backend');
    console.log('     npm run dev');
    return;
  }
  
  // Test 2: Reset circuit breaker
  console.log('\n2. Reset OpenAI Circuit Breaker');
  try {
    const result = await makeRequest(`${BASE_URL}/api/v1/circuit-breaker/reset/openai-api`, 'POST');
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Response: ${result.body}`);
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
  
  // Test 3: Check circuit breaker status
  console.log('\n3. Circuit Breaker Status');
  try {
    const result = await makeRequest(`${BASE_URL}/api/v1/circuit-breaker/status/openai-api`);
    console.log(`   Status: ${result.statusCode}`);
    const status = JSON.parse(result.body);
    console.log(`   State: ${status.state}`);
    console.log(`   Details: ${JSON.stringify(status, null, 2)}`);
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
  
  // Test 4: OpenAI connection test
  console.log('\n4. OpenAI Connection Test');
  try {
    const result = await makeRequest(`${BASE_URL}/api/v1/sentiment/openai/test`);
    console.log(`   Status: ${result.statusCode}`);
    console.log(`   Response: ${result.body}`);
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
  
  // Test 5: Sentiment analysis
  console.log('\n5. Sentiment Analysis Test');
  const testData = JSON.stringify({
    text: "This is a wonderful test!",
    provider: "openai",
    model: "gpt-3.5-turbo"
  });
  
  try {
    const result = await makeRequest(`${BASE_URL}/api/v1/sentiment/analyze`, 'POST', testData);
    console.log(`   Status: ${result.statusCode}`);
    if (result.statusCode === 200) {
      const analysis = JSON.parse(result.body);
      console.log(`   Sentiment: ${analysis.sentiment}`);
      console.log(`   Score: ${analysis.score}`);
      console.log(`   Full response: ${JSON.stringify(analysis, null, 2)}`);
    } else {
      console.log(`   Response: ${result.body}`);
    }
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
  
  // Test 6: Final circuit breaker status
  console.log('\n6. Final Circuit Breaker Status');
  try {
    const result = await makeRequest(`${BASE_URL}/api/v1/circuit-breaker/status/openai-api`);
    const status = JSON.parse(result.body);
    console.log(`   State: ${status.state}`);
    console.log(`   Details: ${JSON.stringify(status, null, 2)}`);
  } catch (err) {
    console.log(`   ERROR: ${err.message}`);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('Test Complete\n');
}

// Run the test
testAPI().catch(console.error);