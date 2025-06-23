const https = require('https');
require('dotenv').config({ path: './.env' });

const apiKey = process.env.OPENAI_API_KEY;

console.log('=== Testing OpenAI API - Detailed Error Capture ===\n');
console.log(`Using key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`Key length: ${apiKey.length}\n`);

// Test with exact same parameters as the app
const payload = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content: 'You are a sentiment analysis assistant. Analyze the sentiment and provide a JSON response.'
    },
    {
      role: 'user', 
      content: 'Analyze the sentiment of the following text and respond with ONLY a JSON object in this exact format:\n\n{\n  "sentiment": "positive" | "negative" | "neutral",\n  "score": <number between -1 and 1>,\n  "confidence": <number between 0 and 1>,\n  "reasoning": "<brief explanation>"\n}\n\nText to analyze: "This is a wonderful test to verify that the OpenAI API is working correctly!"'
    }
  ],
  max_tokens: 500,
  temperature: 0.7
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DataCloak-Sentiment-Workbench/1.0',
    'Content-Length': payload.length
  }
};

console.log('Making request to OpenAI API...\n');

const req = https.request(options, (res) => {
  console.log(`Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
  console.log('\nResponse Body:');
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
    
    if (res.statusCode === 200) {
      console.log('\n✅ SUCCESS! The API key is working correctly.');
      try {
        const parsed = JSON.parse(data);
        if (parsed.choices && parsed.choices[0]) {
          console.log('\nGenerated response:', parsed.choices[0].message.content);
        }
      } catch (e) {}
    } else if (res.statusCode === 401) {
      console.log('\n❌ AUTHENTICATION FAILED');
      try {
        const error = JSON.parse(data);
        console.log('\nError details:');
        console.log('- Type:', error.error?.type);
        console.log('- Code:', error.error?.code);
        console.log('- Message:', error.error?.message);
        console.log('- Param:', error.error?.param);
      } catch (e) {}
    } else {
      console.log(`\n⚠️ Unexpected status code: ${res.statusCode}`);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(payload);
req.end();