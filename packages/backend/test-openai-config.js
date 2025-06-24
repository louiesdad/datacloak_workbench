require('dotenv').config();
const path = require('path');

console.log('=== OpenAI Configuration Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
console.log('.env path:', path.join(process.cwd(), '.env'));

// Check raw environment variable
console.log('\n1. Raw Environment Variable:');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
console.log('OPENAI_API_KEY first 10 chars:', process.env.OPENAI_API_KEY?.substring(0, 10));
console.log('OPENAI_API_KEY last 10 chars:', process.env.OPENAI_API_KEY?.slice(-10));

// Check ConfigService
try {
  const { ConfigService } = require('./dist/services/config.service.js');
  const configService = ConfigService.getInstance();
  
  console.log('\n2. ConfigService:');
  console.log('isOpenAIConfigured:', configService.isOpenAIConfigured());
  const openaiConfig = configService.getOpenAIConfig();
  console.log('Config API Key exists:', !!openaiConfig.apiKey);
  console.log('Config API Key length:', openaiConfig.apiKey?.length);
  console.log('Config Model:', openaiConfig.model);
  console.log('Config Max Tokens:', openaiConfig.maxTokens);
  console.log('Config Temperature:', openaiConfig.temperature);
} catch (error) {
  console.error('Error loading ConfigService:', error.message);
}

// Test direct API call
console.log('\n3. Testing Direct API Call:');
const https = require('https');

const testApiKey = process.env.OPENAI_API_KEY;
if (testApiKey) {
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testApiKey}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Status Message:', res.statusMessage);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log('API Key is VALID - Found', parsed.data?.length || 0, 'models');
        } else {
          console.log('API Error:', parsed.error?.message || 'Unknown error');
        }
      } catch (e) {
        console.log('Response:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Request failed:', e.message);
  });

  req.end();
}