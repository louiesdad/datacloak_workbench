const https = require('https');
require('dotenv').config({ path: './.env' });

const apiKey = process.env.OPENAI_API_KEY;

console.log('Testing OpenAI API key...');
console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');
console.log('API Key length:', apiKey ? apiKey.length : 0);

const data = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'user',
      content: 'Say hello'
    }
  ],
  max_tokens: 10,
  temperature: 0.1
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log('\nStatus Code:', res.statusCode);
  console.log('Status Message:', res.statusMessage);
  console.log('Headers:', res.headers);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:', responseData);
    
    try {
      const parsed = JSON.parse(responseData);
      if (parsed.error) {
        console.log('\nError details:');
        console.log('- Type:', parsed.error.type);
        console.log('- Message:', parsed.error.message);
        console.log('- Code:', parsed.error.code);
      }
    } catch (e) {
      // Not JSON response
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();