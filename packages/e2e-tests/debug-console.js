const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Collect all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  // Collect all errors
  page.on('pageerror', error => {
    consoleMessages.push(`[PAGE ERROR] ${error.message}`);
  });
  
  console.log('🚀 Loading frontend app and monitoring console...');
  await page.goto('http://localhost:5173');
  
  // Wait for app to load and log messages
  await page.waitForTimeout(5000);
  
  console.log('\n📊 All Console Messages:');
  consoleMessages.forEach((msg, i) => console.log(`${i+1}. ${msg}`));
  
  // Try to see DOM structure
  const rootElement = await page.locator('#root').innerHTML().catch(() => 'Could not get root innerHTML');
  console.log(`\n🌳 Root element content: ${rootElement.substring(0, 500)}...`);
  
  // Check for specific React/Vite issues
  const viteConnected = await page.locator('text=/connected/i').count() > 0;
  console.log(`\n⚡ Vite HMR connected: ${viteConnected}`);
  
  await browser.close();
})().catch(console.error);