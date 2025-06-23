const axios = require('axios');

async function testOpenAICircuitBreaker() {
  const baseURL = 'http://localhost:3001';
  
  console.log('=== Testing OpenAI Circuit Breaker ===\n');
  
  try {
    // Step 1: Reset the circuit breaker
    console.log('1. Resetting OpenAI circuit breaker...');
    try {
      const resetResponse = await axios.post(`${baseURL}/api/v1/circuit-breaker/reset/openai-api`);
      console.log('   ✓ Circuit breaker reset:', resetResponse.data);
    } catch (error) {
      console.log('   ✗ Failed to reset:', error.response?.data || error.message);
    }
    console.log('');
    
    // Step 2: Check circuit breaker status
    console.log('2. Checking circuit breaker status...');
    try {
      const statusResponse = await axios.get(`${baseURL}/api/v1/circuit-breaker/status/openai-api`);
      console.log('   ✓ Circuit breaker status:', JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      console.log('   ✗ Failed to get status:', error.response?.data || error.message);
    }
    console.log('');
    
    // Step 3: Test OpenAI connection
    console.log('3. Testing OpenAI connection...');
    try {
      const testResponse = await axios.get(`${baseURL}/api/v1/sentiment/openai/test`);
      console.log('   ✓ OpenAI connection test:', testResponse.data);
    } catch (error) {
      console.log('   ✗ OpenAI test failed:', error.response?.data || error.message);
    }
    console.log('');
    
    // Step 4: Try a simple sentiment analysis
    console.log('4. Testing sentiment analysis with OpenAI...');
    try {
      const analyzeResponse = await axios.post(`${baseURL}/api/v1/sentiment/analyze`, {
        text: 'This is a wonderful test to verify that the OpenAI API is working correctly!',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      });
      console.log('   ✓ Analysis result:', JSON.stringify(analyzeResponse.data, null, 2));
    } catch (error) {
      console.log('   ✗ Analysis failed:', error.response?.data || error.message);
    }
    console.log('');
    
    // Step 5: Check circuit breaker status again
    console.log('5. Final circuit breaker status check...');
    try {
      const finalStatusResponse = await axios.get(`${baseURL}/api/v1/circuit-breaker/status/openai-api`);
      const metrics = finalStatusResponse.data.metrics;
      console.log('   ✓ Final status:', {
        state: metrics.state,
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        lastSuccess: metrics.lastSuccess,
        lastFailure: metrics.lastFailure
      });
      
      if (metrics.state === 'CLOSED') {
        console.log('\n✅ SUCCESS: Circuit breaker is CLOSED - OpenAI API is working correctly!');
      } else {
        console.log(`\n⚠️  WARNING: Circuit breaker is ${metrics.state}`);
      }
    } catch (error) {
      console.log('   ✗ Failed to get final status:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }
}

// Add a check for backend availability
async function checkBackendAndRun() {
  console.log('Checking if backend is running on port 3001...\n');
  
  try {
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✓ Backend is running:', healthResponse.data);
    console.log('');
    
    // Run the test
    await testOpenAICircuitBreaker();
    
  } catch (error) {
    console.error('❌ Backend is not running on port 3001!');
    console.error('Please start the backend with: npm run dev');
    console.error('Error:', error.message);
  }
}

// Run the check and test
checkBackendAndRun();