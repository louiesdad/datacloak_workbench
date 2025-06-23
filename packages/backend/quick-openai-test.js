const http = require('http');

console.log('=== Quick OpenAI API Test ===\n');

// Test 1: Reset Circuit Breaker
console.log('1. Resetting circuit breaker...');
const resetOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/circuit-breaker/reset/openai-api',
  method: 'POST'
};

const resetReq = http.request(resetOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`   Status: ${res.statusCode}`);
    try {
      console.log('   Response:', JSON.parse(data));
    } catch (e) {
      console.log('   Response:', data);
    }
    
    // Test 2: Check Status
    console.log('\n2. Checking circuit breaker status...');
    http.get('http://localhost:3001/api/v1/circuit-breaker/status/openai-api', (res) => {
      let statusData = '';
      res.on('data', (chunk) => { statusData += chunk; });
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        try {
          const status = JSON.parse(statusData);
          console.log('   State:', status.metrics?.state || 'Unknown');
          console.log('   Success Count:', status.metrics?.successCount || 0);
          console.log('   Failure Count:', status.metrics?.failureCount || 0);
        } catch (e) {
          console.log('   Response:', statusData);
        }
        
        // Test 3: Test OpenAI
        console.log('\n3. Testing OpenAI connection...');
        http.get('http://localhost:3001/api/v1/sentiment/openai/test', (res) => {
          let testData = '';
          res.on('data', (chunk) => { testData += chunk; });
          res.on('end', () => {
            console.log(`   Status: ${res.statusCode}`);
            try {
              console.log('   Response:', JSON.parse(testData));
            } catch (e) {
              console.log('   Response:', testData);
            }
            
            // Test 4: Simple sentiment analysis
            console.log('\n4. Testing sentiment analysis...');
            const postData = JSON.stringify({
              text: 'This product is amazing!',
              provider: 'openai',
              model: 'gpt-3.5-turbo'
            });
            
            const analysisOptions = {
              hostname: 'localhost',
              port: 3001,
              path: '/api/v1/sentiment/analyze',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
              }
            };
            
            const analysisReq = http.request(analysisOptions, (res) => {
              let analysisData = '';
              res.on('data', (chunk) => { analysisData += chunk; });
              res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                try {
                  const result = JSON.parse(analysisData);
                  if (result.sentiment) {
                    console.log('   ✅ SUCCESS! Sentiment:', result.sentiment);
                    console.log('   Score:', result.score);
                  } else {
                    console.log('   ❌ FAILED:', result);
                  }
                } catch (e) {
                  console.log('   Response:', analysisData);
                }
                
                console.log('\n=== Test Complete ===');
              });
            }).on('error', (e) => {
              console.error('   ❌ Analysis request error:', e.message);
            });
            
            analysisReq.write(postData);
            analysisReq.end();
          });
        }).on('error', (e) => {
          console.error('   ❌ Test request error:', e.message);
        });
      });
    }).on('error', (e) => {
      console.error('   ❌ Status request error:', e.message);
    });
  });
}).on('error', (e) => {
  console.error('   ❌ Reset request error:', e.message);
  console.error('\n❌ Backend is not running on port 3001!');
  console.error('Please make sure the backend is running with: npm run dev');
});

resetReq.end();