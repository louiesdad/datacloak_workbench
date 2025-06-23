const https = require('https');
require('dotenv').config({ path: './.env' });

const apiKey = process.env.OPENAI_API_KEY;

console.log('=== OpenAI API Key Format Analysis ===\n');

// Analyze the key
console.log('1. Key Format Analysis:');
console.log(`   Format: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}`);
console.log(`   Length: ${apiKey.length} characters`);
console.log(`   Type: ${apiKey.startsWith('sk-svcacct-') ? 'Service Account' : apiKey.startsWith('sk-proj-') ? 'Project Key' : 'Standard Key'}`);

// Test different endpoints
console.log('\n2. Testing different OpenAI endpoints:\n');

const endpoints = [
  { path: '/v1/models', method: 'GET', name: 'List Models' },
  { path: '/v1/chat/completions', method: 'POST', name: 'Chat Completion', 
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5
    })
  }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    console.log(`Testing ${endpoint.name}...`);
    
    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: endpoint.path,
      method: endpoint.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (endpoint.body) {
      options.headers['Content-Length'] = endpoint.body.length;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
        
        if (res.statusCode === 401) {
          try {
            const error = JSON.parse(data);
            console.log(`   Error Type: ${error.error?.type || 'Unknown'}`);
            console.log(`   Error Message: ${error.error?.message || data}`);
            console.log(`   Error Code: ${error.error?.code || 'None'}`);
            
            // Check for specific error patterns
            if (error.error?.message?.includes('service account')) {
              console.log('   ⚠️  Service account specific error detected');
            }
            if (error.error?.message?.includes('project')) {
              console.log('   ⚠️  Project-related error detected');
            }
          } catch (e) {
            console.log(`   Raw error: ${data.substring(0, 200)}`);
          }
        } else if (res.statusCode === 200) {
          console.log('   ✅ Success!');
        } else {
          console.log(`   Response: ${data.substring(0, 100)}...`);
        }
        console.log('');
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error(`   Network error: ${e.message}\n`);
      resolve();
    });
    
    if (endpoint.body) {
      req.write(endpoint.body);
    }
    req.end();
  });
}

// Run all tests
(async () => {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n3. Recommendations:');
  console.log('   - If all endpoints return 401, the key format may not be supported');
  console.log('   - Try generating a standard API key (sk-...) instead of service account key');
  console.log('   - Check if your OpenAI account has any restrictions or special requirements');
  console.log('   - Ensure the account has active billing/credits');
  console.log('\n   To generate a new key:');
  console.log('   1. Visit https://platform.openai.com/api-keys');
  console.log('   2. Click "Create new secret key"');
  console.log('   3. Choose "Standard" type (not service account)');
  console.log('   4. The key should start with "sk-" or "sk-proj-"');
})();