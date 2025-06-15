const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('🚀 Loading frontend app...');
  await page.goto('http://localhost:5173');
  
  // Wait a moment for initial load
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'debug-app-load.png', fullPage: true });
  console.log('📸 Screenshot saved as debug-app-load.png');
  
  // Check console errors
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
  });
  
  await page.waitForTimeout(2000);
  
  // Print console messages
  console.log('\n🟡 Console messages:');
  consoleMessages.slice(-10).forEach(msg => console.log(msg));
  
  // Try to find the title
  try {
    const title = await page.textContent('title');
    console.log(`\n📄 Page title: ${title}`);
  } catch (e) {
    console.log('\n❌ Could not get page title');
  }
  
  // Try to find app content
  try {
    const appText = await page.textContent('body');
    console.log(`\n📝 First 200 chars of page content: ${appText?.substring(0, 200)}...`);
  } catch (e) {
    console.log('\n❌ Could not get page content');
  }
  
  // Check for React errors
  const hasReactError = await page.locator('text=/maximum update depth/i').count() > 0;
  console.log(`\n🔄 React infinite loop detected: ${hasReactError}`);
  
  await browser.close();
})().catch(console.error);