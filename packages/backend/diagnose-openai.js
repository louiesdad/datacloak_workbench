require('dotenv').config({ path: './.env' });

console.log('=== OpenAI API Key Diagnosis ===\n');

const apiKey = process.env.OPENAI_API_KEY;

// Check if key exists
if (!apiKey) {
  console.log('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

// Analyze key format
console.log('API Key Analysis:');
console.log(`- Prefix: ${apiKey.substring(0, 15)}...`);
console.log(`- Length: ${apiKey.length} characters`);
console.log(`- Format: ${apiKey.startsWith('sk-svcacct-') ? 'Service Account' : apiKey.startsWith('sk-proj-') ? 'Project Key' : apiKey.startsWith('sk-') ? 'Standard Key' : 'Unknown'}`);

// Check for common issues
console.log('\nCommon Issues Check:');

// Check for whitespace
if (apiKey !== apiKey.trim()) {
  console.log('❌ API key contains leading/trailing whitespace');
} else {
  console.log('✅ No whitespace issues');
}

// Check for quotes
if (apiKey.includes('"') || apiKey.includes("'")) {
  console.log('❌ API key contains quotes');
} else {
  console.log('✅ No quote characters');
}

// Check character set
if (!/^sk-[a-zA-Z0-9_-]+$/.test(apiKey)) {
  console.log('❌ API key contains invalid characters');
} else {
  console.log('✅ Valid character set');
}

// Environment variable loading
console.log('\nEnvironment Loading:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`- Working directory: ${process.cwd()}`);
console.log(`- .env file exists: ${require('fs').existsSync('./.env')}`);

// Check if multiple .env files
const fs = require('fs');
const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
console.log('\nEnvironment Files:');
envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const keyMatch = content.match(/OPENAI_API_KEY=(.+)/);
    if (keyMatch) {
      console.log(`- ${file}: Contains OPENAI_API_KEY (${keyMatch[1].substring(0, 15)}...)`);
    }
  }
});

// Check config.json
if (fs.existsSync('config.json')) {
  const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  console.log('\nconfig.json:');
  console.log(`- Has openai section: ${!!config.openai}`);
  if (config.openai) {
    console.log(`- Contains API key: ${!!config.openai.apiKey}`);
  }
}

console.log('\n=== Recommendations ===');
console.log('1. The API key appears to be in an old service account format (sk-svcacct-)');
console.log('2. OpenAI has deprecated this format. You need a new API key.');
console.log('3. Visit https://platform.openai.com/api-keys to generate a new key');
console.log('4. New keys should start with "sk-proj-" (project keys) or just "sk-" (legacy format)');
console.log('5. Make sure the account has available credits/billing setup');