const http = require('http');

console.log('=== Reset Circuit Breaker and Test OpenAI ===\n');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: responseData });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTest() {
  try {
    // Step 1: Reset Circuit Breaker
    console.log('1. Resetting circuit breaker...');
    const resetResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/circuit-breaker/reset/openai-api',
      method: 'POST'
    });
    console.log(`   Status: ${resetResult.status}`);
    console.log(`   Response: ${resetResult.data}\n`);

    // Step 2: Check Circuit Breaker Status
    console.log('2. Checking circuit breaker status...');
    const statusResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/circuit-breaker/status/openai-api',
      method: 'GET'
    });
    console.log(`   Status: ${statusResult.status}`);
    const statusData = JSON.parse(statusResult.data);
    console.log(`   State: ${statusData.metrics?.state || 'Unknown'}`);
    console.log(`   Failures: ${statusData.metrics?.failureCount || 0}\n`);

    // Step 3: Test OpenAI
    console.log('3. Testing OpenAI sentiment analysis...');
    const testData = JSON.stringify({
      text: 'This is a wonderful test!',
      provider: 'openai',
      model: 'gpt-3.5-turbo'
    });
    
    const analysisResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/sentiment/analyze',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': testData.length
      }
    }, testData);
    
    console.log(`   Status: ${analysisResult.status}`);
    
    if (analysisResult.status === 200) {
      const result = JSON.parse(analysisResult.data);
      console.log('   ✅ SUCCESS!');
      console.log(`   Sentiment: ${result.sentiment}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Model: ${result.model || 'N/A'}`);
    } else {
      console.log('   ❌ Failed:', analysisResult.data);
      
      // Check if it's still using old key
      if (analysisResult.data.includes('authentication') || analysisResult.data.includes('401')) {
        console.log('\n   ⚠️  The backend is still using the OLD API key!');
        console.log('   The process needs to be completely restarted.');
      }
    }

    // Step 4: Final Status Check
    console.log('\n4. Final circuit breaker status...');
    const finalStatus = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/circuit-breaker/status/openai-api',
      method: 'GET'
    });
    const finalData = JSON.parse(finalStatus.data);
    console.log(`   State: ${finalData.metrics?.state || 'Unknown'}`);
    
    if (finalData.metrics?.state === 'OPEN') {
      console.log('\n❌ Circuit breaker is OPEN again - API calls are still failing');
      console.log('This confirms the backend is using an invalid API key.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('\nMake sure the backend is running on port 3001');
  }
}

runTest();