// Load environment variables without shell override
const env = require('dotenv').config();
console.log('\n=== Debug OpenAI Key Loading ===');
console.log('Dotenv loaded:', env.parsed ? 'Success' : 'Failed');
if (env.parsed && env.parsed.OPENAI_API_KEY) {
  console.log('Key from .env file:');
  console.log('  First 10:', env.parsed.OPENAI_API_KEY.substring(0, 10));
  console.log('  Last 10:', env.parsed.OPENAI_API_KEY.slice(-10));
  console.log('  Length:', env.parsed.OPENAI_API_KEY.length);
}

console.log('\nKey in process.env:');
console.log('  First 10:', process.env.OPENAI_API_KEY?.substring(0, 10));
console.log('  Last 10:', process.env.OPENAI_API_KEY?.slice(-10));
console.log('  Length:', process.env.OPENAI_API_KEY?.length);

// Test the key directly
const https = require('https');
const testKey = env.parsed?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (testKey) {
  console.log('\nTesting API key from .env file...');
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testKey}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    console.log('Response Status:', res.statusCode, res.statusMessage);
    
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        const models = JSON.parse(data);
        console.log('✅ API Key is VALID!');
        console.log('Available models:', models.data.slice(0, 3).map(m => m.id).join(', '), '...');
      } else {
        console.log('❌ API Key is INVALID');
        try {
          const error = JSON.parse(data);
          console.log('Error:', error.error?.message || data);
        } catch {
          console.log('Error response:', data);
        }
      }
    });
  });

  req.on('error', (e) => console.error('Request failed:', e.message));
  req.end();
}