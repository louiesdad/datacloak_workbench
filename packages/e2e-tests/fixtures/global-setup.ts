import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Suite Global Setup...');
  
  // Wait for web servers to be ready
  console.log('⏳ Waiting for web servers to start...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check backend health
    console.log('🔍 Checking backend health...');
    const backendResponse = await page.goto('http://localhost:3001/health');
    if (!backendResponse?.ok()) {
      throw new Error('Backend server not responding');
    }
    console.log('✅ Backend server is healthy');
    
    // Check frontend
    console.log('🔍 Checking frontend...');
    const frontendResponse = await page.goto('http://localhost:5173');
    if (!frontendResponse?.ok()) {
      throw new Error('Frontend server not responding');
    }
    console.log('✅ Frontend server is ready');
    
    // Verify app loads correctly
    await page.waitForSelector('text=/DataCloak Sentiment Workbench/i', { timeout: 10000 });
    console.log('✅ Application loaded successfully');
    
    // Take initial screenshot for reference
    await page.screenshot({ path: './test-results/00-global-setup-app-ready.png', fullPage: true });
    console.log('📸 Initial app screenshot saved');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('✅ Global setup completed successfully');
}

export default globalSetup;