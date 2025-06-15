const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Track network requests and responses
  const networkLogs = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      networkLogs.push(`${response.status()} ${response.url()}`);
    }
  });
  
  // Track console errors in detail
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Track page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });
  
  console.log('🚀 Loading app and checking for rendering issues...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Wait for React to potentially render
  await page.waitForTimeout(3000);
  
  // Check if any actual content rendered
  const hasContent = await page.locator('text=/DataCloak/i').count() > 0;
  const hasNavigation = await page.locator('[data-testid="navigation"]').count() > 0;
  const hasWorkflow = await page.locator('[data-testid="workflow-manager"]').count() > 0;
  const hasError = await page.locator('text=/error/i').count() > 0;
  
  console.log(`\n📊 App Rendering Status:`);
  console.log(`   Title text found: ${hasContent}`);
  console.log(`   Navigation rendered: ${hasNavigation}`);
  console.log(`   Workflow manager rendered: ${hasWorkflow}`);
  console.log(`   Error text present: ${hasError}`);
  
  console.log(`\n🌐 Network Issues (${networkLogs.length}):`);
  networkLogs.forEach(log => console.log(`   ${log}`));
  
  console.log(`\n🔴 Console Errors (${consoleErrors.length}):`);
  consoleErrors.slice(0, 5).forEach(error => console.log(`   ${error}`));
  
  console.log(`\n🚨 Page Errors (${pageErrors.length}):`);
  pageErrors.slice(0, 5).forEach(error => console.log(`   ${error}`));
  
  // Try to get the actual rendered HTML
  const rootContent = await page.locator('#root').innerHTML().catch(() => '');
  console.log(`\n🌳 Root Content Length: ${rootContent.length} characters`);
  if (rootContent.length < 100) {
    console.log(`   Content: "${rootContent}"`);
  } else {
    console.log(`   First 200 chars: "${rootContent.substring(0, 200)}..."`);
  }
  
  await browser.close();
})().catch(console.error);