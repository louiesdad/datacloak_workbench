const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function runTests() {
  console.log('Testing DataCloak Sentiment Workbench with Real DataCloak Library\n');
  
  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✓ Health check passed:', healthResponse.data);
    
    // Test 2: API Status
    console.log('\n2. Testing API Status...');
    const statusResponse = await axios.get(`${API_URL}/api/v1/health/status`);
    console.log('✓ API status check passed:', statusResponse.data);
    
    // Test 3: Security Stats (to check if DataCloak is loaded)
    console.log('\n3. Testing DataCloak Stats...');
    try {
      const statsResponse = await axios.get(`${API_URL}/api/v1/security/stats`);
      console.log('✓ DataCloak stats:', statsResponse.data);
      if (statsResponse.data.fallbackMode === false) {
        console.log('✓ CONFIRMED: Real DataCloak library is loaded!');
      } else {
        console.log('⚠ WARNING: DataCloak is running in fallback mode');
      }
    } catch (error) {
      console.log('⚠ Stats endpoint not available');
    }
    
    // Test 4: PII Detection (Basic Test)
    console.log('\n4. Testing PII Detection...');
    const testData = {
      text: 'Contact john.doe@example.com or call 555-123-4567. SSN: 123-45-6789'
    };
    
    try {
      const detectResponse = await axios.post(`${API_URL}/api/v1/security/detect`, testData, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✓ PII detection succeeded!');
      console.log('Detected PII:', JSON.stringify(detectResponse.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.error('✗ PII detection failed:', error.response.status, error.response.data);
      } else if (error.code === 'ECONNRESET') {
        console.error('✗ Connection reset - possible segmentation fault in FFI');
      } else {
        console.error('✗ PII detection error:', error.message);
      }
    }
    
    // Test 5: Text Masking
    console.log('\n5. Testing Text Masking...');
    try {
      const maskResponse = await axios.post(`${API_URL}/api/v1/security/mask`, testData, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✓ Text masking succeeded!');
      console.log('Masked result:', JSON.stringify(maskResponse.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.error('✗ Text masking failed:', error.response.status, error.response.data);
      } else if (error.code === 'ECONNRESET') {
        console.error('✗ Connection reset - possible segmentation fault in FFI');
      } else {
        console.error('✗ Text masking error:', error.message);
      }
    }
    
    // Test 6: Sentiment Analysis with PII
    console.log('\n6. Testing Sentiment Analysis with PII...');
    const sentimentData = {
      text: 'I love this product! Please contact me at john@example.com for more info.',
      config: {
        enablePIIDetection: true
      }
    };
    
    try {
      const sentimentResponse = await axios.post(`${API_URL}/api/v1/sentiment/analyze`, sentimentData, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('✓ Sentiment analysis succeeded!');
      console.log('Result:', JSON.stringify(sentimentResponse.data, null, 2));
    } catch (error) {
      if (error.response) {
        console.error('✗ Sentiment analysis failed:', error.response.status, error.response.data);
      } else {
        console.error('✗ Sentiment analysis error:', error.message);
      }
    }
    
    console.log('\n=== Test Summary ===');
    console.log('Tests completed. Check results above for any failures.');
    
  } catch (error) {
    console.error('\nFatal error during testing:', error.message);
  }
}

// Run tests
runTests().catch(console.error);