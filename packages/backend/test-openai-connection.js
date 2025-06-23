const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
    
    req.on('error', (error) => reject(error));
    req.setTimeout(15000);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testOpenAIConnection() {
  const baseOptions = {
    hostname: 'localhost',
    port: 3001,
  };
  
  console.log('Testing OpenAI API Connection...\n');
  
  try {
    // 1. Check if backend is accessible
    console.log('1. Checking if backend is accessible...');
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/health',
        method: 'GET'
      });
      console.log(`   ✓ Backend is accessible (status: ${response.statusCode})`);
    } catch (error) {
      console.log(`   ✗ Backend not accessible: ${error.message}`);
      return;
    }
    
    // 2. Reset OpenAI circuit breaker
    console.log('\n2. Resetting OpenAI circuit breaker...');
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/v1/circuit-breaker/reset/openai-api',
        method: 'POST'
      });
      console.log(`   Circuit breaker reset: ${response.statusCode}`);
      if (response.body) {
        console.log(`   Response: ${response.body}`);
      }
    } catch (error) {
      console.log(`   ✗ Failed to reset circuit breaker: ${error.message}`);
    }
    
    // 3. Check circuit breaker status
    console.log('\n3. Checking circuit breaker status...');
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/v1/circuit-breaker/status/openai-api',
        method: 'GET'
      });
      console.log(`   Status code: ${response.statusCode}`);
      if (response.statusCode === 200) {
        const status = JSON.parse(response.body);
        console.log(`   Circuit breaker state: ${status.state || 'UNKNOWN'}`);
        console.log(`   Full status: ${JSON.stringify(status, null, 2)}`);
      }
    } catch (error) {
      console.log(`   ✗ Failed to check status: ${error.message}`);
    }
    
    // 4. Test OpenAI connection
    console.log('\n4. Testing OpenAI connection...');
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/v1/sentiment/openai/test',
        method: 'GET'
      });
      console.log(`   OpenAI test status: ${response.statusCode}`);
      if (response.body) {
        try {
          const data = JSON.parse(response.body);
          console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        } catch {
          console.log(`   Response: ${response.body}`);
        }
      }
    } catch (error) {
      console.log(`   ✗ OpenAI test failed: ${error.message}`);
    }
    
    // 5. Test sentiment analysis
    console.log('\n5. Testing sentiment analysis...');
    const payload = JSON.stringify({
      text: "This is a wonderful test!",
      provider: "openai",
      model: "gpt-3.5-turbo"
    });
    
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/v1/sentiment/analyze',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);
      
      console.log(`   Sentiment analysis status: ${response.statusCode}`);
      if (response.body) {
        try {
          const data = JSON.parse(response.body);
          console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        } catch {
          console.log(`   Response: ${response.body}`);
        }
      }
    } catch (error) {
      console.log(`   ✗ Sentiment analysis failed: ${error.message}`);
    }
    
    // 6. Check final circuit breaker status
    console.log('\n6. Checking final circuit breaker status...');
    try {
      const response = await makeRequest({
        ...baseOptions,
        path: '/api/v1/circuit-breaker/status/openai-api',
        method: 'GET'
      });
      if (response.statusCode === 200) {
        const status = JSON.parse(response.body);
        console.log(`   Final circuit breaker state: ${status.state || 'UNKNOWN'}`);
        console.log(`   Full status: ${JSON.stringify(status, null, 2)}`);
      }
    } catch (error) {
      console.log(`   ✗ Failed to check final status: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Test completed');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testOpenAIConnection();