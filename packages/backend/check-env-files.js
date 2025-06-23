const fs = require('fs');
const path = require('path');

console.log('=== Checking for Multiple .env Files ===\n');

// Check current directory
console.log('Current directory:', process.cwd());

// Find all .env files
const envFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '../.env',
  '../../.env'
];

console.log('\nChecking for .env files:');
envFiles.forEach(file => {
  const fullPath = path.resolve(file);
  if (fs.existsSync(fullPath)) {
    console.log(`\nFound: ${file} (${fullPath})`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const openaiLine = lines.find(line => line.startsWith('OPENAI_API_KEY='));
    if (openaiLine) {
      const key = openaiLine.split('=')[1];
      console.log(`  OPENAI_API_KEY ends with: ...${key.slice(-10)}`);
    } else {
      console.log('  No OPENAI_API_KEY found');
    }
  }
});

// Check what dotenv loads
console.log('\n\nTesting dotenv loading:');
console.log('1. Default dotenv.config():');
require('dotenv').config();
console.log(`   Key ends with: ...${process.env.OPENAI_API_KEY?.slice(-10) || 'NOT SET'}`);

// Clear and reload
delete process.env.OPENAI_API_KEY;
console.log('\n2. Explicit path dotenv.config({ path: "./.env" }):');
require('dotenv').config({ path: './.env' });
console.log(`   Key ends with: ...${process.env.OPENAI_API_KEY?.slice(-10) || 'NOT SET'}`);

// Clear and check the app's loading pattern
delete process.env.OPENAI_API_KEY;
console.log('\n3. App pattern (path.join(__dirname, "../../.env")):');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
console.log(`   Key ends with: ...${process.env.OPENAI_API_KEY?.slice(-10) || 'NOT SET'}`);

// Show the actual value being used
console.log('\n\nActual key in memory:');
console.log(`Full key: ${process.env.OPENAI_API_KEY?.substring(0, 20)}...${process.env.OPENAI_API_KEY?.slice(-10)}`);
console.log(`Length: ${process.env.OPENAI_API_KEY?.length || 0}`);