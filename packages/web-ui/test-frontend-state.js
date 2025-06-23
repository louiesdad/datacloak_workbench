// Test script to check frontend state
const fetch = require('node-fetch');

async function testFrontend() {
  console.log('Testing frontend state...\n');
  
  try {
    // Test 1: Check if frontend is running
    console.log('1. Checking if frontend is accessible...');
    const response = await fetch('http://localhost:5173/');
    console.log(`   Status: ${response.status}`);
    console.log(`   OK: ${response.ok}`);
    
    // Test 2: Get HTML content
    console.log('\n2. Checking HTML content...');
    const html = await response.text();
    console.log(`   HTML length: ${html.length} characters`);
    console.log(`   Has <div id="root">: ${html.includes('<div id="root">')}`);
    console.log(`   Has script tag: ${html.includes('<script')}`);
    
    // Test 3: Check for error messages in HTML
    console.log('\n3. Checking for error indicators...');
    const hasError = html.includes('error') || html.includes('Error');
    console.log(`   Contains 'error': ${hasError}`);
    
    // Test 4: Extract title
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      console.log(`   Page title: "${titleMatch[1]}"`);
    }
    
    // Test 5: Check main script
    const scriptMatch = html.match(/src="(\/src\/main\.tsx[^"]*)"/);
    if (scriptMatch) {
      console.log(`\n4. Main script: ${scriptMatch[1]}`);
    }
    
    // Test 6: Check if backend is accessible
    console.log('\n5. Checking backend connection...');
    try {
      const backendHealth = await fetch('http://localhost:3001/api/v1/health');
      console.log(`   Backend status: ${backendHealth.status}`);
    } catch (e) {
      console.log(`   Backend error: ${e.message}`);
    }
    
    // Test 7: Check OpenAI endpoints
    console.log('\n6. Checking OpenAI endpoints...');
    try {
      const logsResponse = await fetch('http://localhost:3001/api/v1/openai/logs?limit=1');
      console.log(`   Logs endpoint status: ${logsResponse.status}`);
      const logsData = await logsResponse.json();
      console.log(`   Logs data: ${JSON.stringify(logsData).substring(0, 100)}...`);
    } catch (e) {
      console.log(`   Logs endpoint error: ${e.message}`);
    }
    
  } catch (error) {
    console.error('Error testing frontend:', error);
  }
}

// Run the test
testFrontend();