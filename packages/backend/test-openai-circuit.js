const axios = require('axios');

async function testOpenAICircuitBreaker() {
  const baseURL = 'http://localhost:3001/api/v1';
  
  console.log('Testing OpenAI Circuit Breaker...\n');
  
  try {
    // Step 1: Reset the circuit breaker
    console.log('1. Resetting circuit breaker...');
    const resetResponse = await axios.post(`${baseURL}/circuit-breaker/reset/openai-api`);
    console.log('   Circuit breaker reset:', resetResponse.data);
    console.log('');
    
    // Step 2: Check circuit breaker status
    console.log('2. Checking circuit breaker status...');
    const statusResponse = await axios.get(`${baseURL}/circuit-breaker/status/openai-api`);
    console.log('   Status:', statusResponse.data);
    console.log('');
    
    // Step 3: Test OpenAI API with a simple request
    console.log('3. Testing OpenAI API connection...');
    const testResponse = await axios.post(`${baseURL}/openai/analyze`, {
      text: 'This is a test message to verify the API connection.',
      model: 'gpt-3.5-turbo'
    });
    console.log('   API Response:', testResponse.data);
    console.log('');
    
    // Step 4: Check circuit breaker status again
    console.log('4. Rechecking circuit breaker status...');
    const finalStatusResponse = await axios.get(`${baseURL}/circuit-breaker/status/openai-api`);
    console.log('   Final Status:', finalStatusResponse.data);
    
    console.log('\n✅ OpenAI API connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.response) {
      console.error('   Response data:', error.response.data);
      console.error('   Response status:', error.response.status);
    }
  }
}

// Run the test
testOpenAICircuitBreaker();