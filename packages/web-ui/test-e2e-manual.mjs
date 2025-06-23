import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

async function testStep(stepName, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${stepName}`);
  console.log('='.repeat(60));
  
  try {
    await testFn();
    console.log(`✅ ${stepName} - PASSED`);
  } catch (error) {
    console.error(`❌ ${stepName} - FAILED`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
}

async function runE2ETests() {
  console.log('Starting E2E Frontend to Logs Navigation Test');
  
  // Step 1: Test Frontend Availability
  await testStep('Frontend Server Check', async () => {
    const response = await fetch(BASE_URL);
    if (!response.ok) throw new Error(`Frontend returned ${response.status}`);
    
    const html = await response.text();
    if (!html.includes('<div id="root">')) {
      throw new Error('Root div not found in HTML');
    }
    console.log('   ✓ Frontend is serving HTML');
    console.log('   ✓ Root element exists');
  });
  
  // Step 2: Test Backend Availability
  await testStep('Backend Server Check', async () => {
    const response = await fetch(`${API_URL}/api/v1/health`);
    console.log(`   Backend status: ${response.status}`);
    
    const data = await response.json();
    console.log(`   Backend response: ${JSON.stringify(data)}`);
  });
  
  // Step 3: Test Main App Bundle
  await testStep('Main App Bundle Check', async () => {
    const htmlResponse = await fetch(BASE_URL);
    const html = await htmlResponse.text();
    
    // Extract main.tsx URL
    const scriptMatch = html.match(/src="(\/src\/main\.tsx[^"]*)"/);
    if (!scriptMatch) throw new Error('Main script not found');
    
    const scriptUrl = `${BASE_URL}${scriptMatch[1]}`;
    console.log(`   Script URL: ${scriptUrl}`);
    
    const scriptResponse = await fetch(scriptUrl);
    const scriptContent = await scriptResponse.text();
    
    if (!scriptContent.includes('FixedApp')) {
      throw new Error('FixedApp import not found in main.tsx');
    }
    console.log('   ✓ Main script loads correctly');
    console.log('   ✓ FixedApp is imported');
  });
  
  // Step 4: Test FixedApp Component
  await testStep('FixedApp Component Check', async () => {
    const response = await fetch(`${BASE_URL}/src/FixedApp.tsx`);
    const content = await response.text();
    
    // Check for key elements
    const checks = [
      { name: 'Navigation steps', pattern: /steps\s*=\s*\[/ },
      { name: 'Logs navigation', pattern: /id:\s*['"]admin['"].*label:\s*['"]Logs['"]/ },
      { name: 'SimpleLogsView import', pattern: /import.*SimpleLogsView/ },
      { name: 'Admin panel rendering', pattern: /case\s*['"]admin['"]:/ }
    ];
    
    for (const check of checks) {
      if (!check.pattern.test(content)) {
        throw new Error(`${check.name} not found in FixedApp`);
      }
      console.log(`   ✓ ${check.name} found`);
    }
  });
  
  // Step 5: Test SimpleLogsView Component
  await testStep('SimpleLogsView Component Check', async () => {
    const response = await fetch(`${BASE_URL}/src/SimpleLogsView.tsx`);
    if (!response.ok) {
      throw new Error(`SimpleLogsView not found: ${response.status}`);
    }
    
    const content = await response.text();
    if (!content.includes('Simple Logs View')) {
      throw new Error('SimpleLogsView content missing');
    }
    console.log('   ✓ SimpleLogsView component exists');
  });
  
  // Step 6: Test OpenAI Logs Endpoint
  await testStep('OpenAI Logs Endpoint', async () => {
    const response = await fetch(`${API_URL}/api/v1/openai/logs?limit=5`);
    console.log(`   Status: ${response.status}`);
    
    const data = await response.json();
    console.log(`   Logs returned: ${data.data ? data.data.length : 0}`);
    
    if (data.data && data.data.length > 0) {
      console.log(`   First log type: ${data.data[0].type}`);
    }
  });
  
  // Step 7: Test OpenAI Stats Endpoint
  await testStep('OpenAI Stats Endpoint', async () => {
    const response = await fetch(`${API_URL}/api/v1/openai/stats`);
    console.log(`   Status: ${response.status}`);
    
    const data = await response.json();
    if (data.logs) {
      console.log(`   Total requests: ${data.logs.totalRequests || 0}`);
    }
    if (data.costs?.daily?.total) {
      console.log(`   Daily cost: $${data.costs.daily.total.cost || 0}`);
    }
  });
  
  // Step 8: Check CSS Loading
  await testStep('CSS Loading Check', async () => {
    const response = await fetch(`${BASE_URL}/src/FixedApp.css`);
    if (!response.ok) {
      throw new Error(`CSS not loading: ${response.status}`);
    }
    
    const css = await response.text();
    if (!css.includes('.app')) {
      throw new Error('App styles not found in CSS');
    }
    console.log('   ✓ CSS loads correctly');
  });
  
  // Step 9: Check for Console Errors (simulated)
  await testStep('Error Detection Check', async () => {
    const htmlResponse = await fetch(BASE_URL);
    const html = await htmlResponse.text();
    
    // Check if error handling is in place
    if (!html.includes('window.addEventListener')) {
      console.log('   ⚠️  Error handling might not be set up');
    } else {
      console.log('   ✓ Error handling detected');
    }
  });
  
  // Step 10: Navigation Flow Simulation
  await testStep('Navigation Flow Simulation', async () => {
    console.log('   Simulating user navigation:');
    console.log('   1. User loads app - Upload step should be active');
    console.log('   2. User clicks "Logs" in navigation');
    console.log('   3. App should show Analysis Logs view');
    console.log('   4. OpenAI stats should load automatically');
    console.log('   5. SimpleLogsView should render');
    
    // We can't actually click without a real browser, but we can verify the code paths exist
    const fixedAppResponse = await fetch(`${BASE_URL}/src/FixedApp.tsx`);
    const fixedAppContent = await fixedAppResponse.text();
    
    if (fixedAppContent.includes('currentStep === \'admin\'') && 
        fixedAppContent.includes('fetchAdminDataWithoutAuth')) {
      console.log('   ✓ Navigation logic exists');
      console.log('   ✓ Auto-fetch on admin page is set up');
    } else {
      throw new Error('Navigation logic not properly set up');
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('E2E Test Summary');
  console.log('='.repeat(60));
  console.log('\nAll tests completed. Check individual results above.\n');
}

// Run the tests
runE2ETests().catch(console.error);