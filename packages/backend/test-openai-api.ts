import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testOpenAIConnection() {
  console.log('Testing OpenAI API Connection...\n');
  
  const results: any = {};
  
  try {
    // 1. Check if backend is accessible
    console.log('1. Checking if backend is accessible...');
    try {
      const response = await axios.get(`${BASE_URL}/api/health`);
      results.backendAccessible = true;
      results.healthStatus = response.status;
      console.log(`   ✓ Backend is accessible (status: ${response.status})`);
    } catch (error: any) {
      results.backendAccessible = false;
      console.log(`   ✗ Backend not accessible: ${error.message}`);
      return results;
    }
    
    // 2. Reset OpenAI circuit breaker
    console.log('\n2. Resetting OpenAI circuit breaker...');
    try {
      const response = await axios.post(`${BASE_URL}/api/v1/circuit-breaker/reset/openai-api`);
      results.circuitBreakerReset = response.status === 200;
      console.log(`   Circuit breaker reset: ${response.status}`);
      if (response.data) {
        console.log(`   Response:`, response.data);
      }
    } catch (error: any) {
      results.circuitBreakerReset = false;
      console.log(`   ✗ Failed to reset circuit breaker: ${error.message}`);
    }
    
    // 3. Check circuit breaker status
    console.log('\n3. Checking circuit breaker status...');
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/circuit-breaker/status/openai-api`);
      results.circuitBreakerState = response.data.state || 'UNKNOWN';
      console.log(`   Circuit breaker state: ${response.data.state || 'UNKNOWN'}`);
      console.log(`   Full status:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      results.circuitBreakerState = 'ERROR';
      console.log(`   ✗ Failed to check status: ${error.message}`);
    }
    
    // 4. Test OpenAI connection
    console.log('\n4. Testing OpenAI connection...');
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/sentiment/openai/test`);
      results.openaiTestSuccess = response.status === 200;
      console.log(`   OpenAI test status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      results.openaiTestSuccess = false;
      console.log(`   ✗ OpenAI test failed: ${error.message}`);
      if (error.response?.data) {
        console.log(`   Error details:`, error.response.data);
      }
    }
    
    // 5. Test sentiment analysis
    console.log('\n5. Testing sentiment analysis...');
    try {
      const response = await axios.post(`${BASE_URL}/api/v1/sentiment/analyze`, {
        text: "This is a wonderful test!",
        provider: "openai",
        model: "gpt-3.5-turbo"
      });
      results.sentimentAnalysisSuccess = response.status === 200;
      console.log(`   Sentiment analysis status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      results.sentimentAnalysisSuccess = false;
      console.log(`   ✗ Sentiment analysis failed: ${error.message}`);
      if (error.response?.data) {
        console.log(`   Error details:`, error.response.data);
      }
    }
    
    // 6. Check final circuit breaker status
    console.log('\n6. Checking final circuit breaker status...');
    try {
      const response = await axios.get(`${BASE_URL}/api/v1/circuit-breaker/status/openai-api`);
      results.finalCircuitBreakerState = response.data.state || 'UNKNOWN';
      console.log(`   Final circuit breaker state: ${response.data.state || 'UNKNOWN'}`);
      console.log(`   Full status:`, JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      results.finalCircuitBreakerState = 'ERROR';
      console.log(`   ✗ Failed to check final status: ${error.message}`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Backend accessible: ${results.backendAccessible || false}`);
    console.log(`Circuit breaker state: ${results.circuitBreakerState || 'UNKNOWN'} → ${results.finalCircuitBreakerState || 'UNKNOWN'}`);
    console.log(`OpenAI test successful: ${results.openaiTestSuccess || false}`);
    console.log(`Sentiment analysis successful: ${results.sentimentAnalysisSuccess || false}`);
    
    return results;
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return results;
  }
}

// Run the test
testOpenAIConnection().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});