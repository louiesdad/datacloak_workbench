require('dotenv').config({ path: './.env' });

console.log('=== Environment Variable Debug ===\n');

// Check raw environment variable
console.log('1. Raw OPENAI_API_KEY from process.env:');
console.log(`   Value: "${process.env.OPENAI_API_KEY}"`);
console.log(`   Length: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0}`);
console.log(`   First 20 chars: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) : 'UNDEFINED'}`);
console.log(`   Last 20 chars: ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 20) : 'UNDEFINED'}`);

// Check for common issues
if (process.env.OPENAI_API_KEY) {
  console.log('\n2. Checking for common issues:');
  console.log(`   Contains whitespace: ${process.env.OPENAI_API_KEY !== process.env.OPENAI_API_KEY.trim()}`);
  console.log(`   Contains quotes: ${process.env.OPENAI_API_KEY.includes('"') || process.env.OPENAI_API_KEY.includes("'")}`);
  console.log(`   Contains newlines: ${process.env.OPENAI_API_KEY.includes('\n') || process.env.OPENAI_API_KEY.includes('\r')}`);
  console.log(`   Is multi-line: ${process.env.OPENAI_API_KEY.includes('\\n')}`);
}

// Load config the same way the app does
console.log('\n3. Loading via config/env.ts pattern:');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
console.log(`   Value after second load: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);

// Check file content directly
console.log('\n4. Reading .env file directly:');
const fs = require('fs');
const envContent = fs.readFileSync('./.env', 'utf8');
const lines = envContent.split('\n');
const openaiLine = lines.find(line => line.startsWith('OPENAI_API_KEY='));
if (openaiLine) {
  console.log(`   Raw line: "${openaiLine}"`);
  console.log(`   Line length: ${openaiLine.length}`);
  const keyValue = openaiLine.split('=')[1];
  console.log(`   Extracted value length: ${keyValue ? keyValue.length : 0}`);
}

// Test making a request
console.log('\n5. Testing API call with the key:');
const https = require('https');

const testPayload = JSON.stringify({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Say hello' }],
  max_tokens: 10
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': testPayload.length
  }
};

const req = https.request(options, (res) => {
  console.log(`   Status Code: ${res.statusCode}`);
  console.log(`   Status Message: ${res.statusMessage}`);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode === 401) {
        console.log('   ❌ Authentication failed');
        console.log(`   Error: ${parsed.error?.message || 'Unknown'}`);
        console.log(`   Type: ${parsed.error?.type || 'Unknown'}`);
      } else if (res.statusCode === 200) {
        console.log('   ✅ API key is valid!');
      } else {
        console.log(`   ⚠️  Unexpected response: ${data.substring(0, 200)}`);
      }
    } catch (e) {
      console.log('   Response:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error('   Request error:', e.message);
});

req.write(testPayload);
req.end();