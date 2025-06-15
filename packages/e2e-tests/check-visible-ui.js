const { chromium } = require('playwright');

async function checkVisibleUI() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);
  
  // Get all elements with data-testid
  const testIds = await page.evaluate(() => {
    const elements = document.querySelectorAll('[data-testid]');
    return Array.from(elements).map(el => ({
      testId: el.getAttribute('data-testid'),
      tagName: el.tagName,
      visible: el.offsetParent !== null,
      text: el.textContent?.substring(0, 50)
    }));
  });
  
  // Get component class names
  const components = await page.evaluate(() => {
    const elements = document.querySelectorAll('[class*="component"], [class*="ui"], [class*="container"]');
    return Array.from(elements).slice(0, 20).map(el => ({
      className: el.className,
      tagName: el.tagName,
      visible: el.offsetParent !== null
    }));
  });
  
  console.log('\n🔍 Visible UI Elements Analysis\n');
  console.log('='.repeat(80));
  
  console.log('\n📌 Elements with data-testid:');
  if (testIds.length === 0) {
    console.log('   ❌ No elements with data-testid found!');
  } else {
    testIds.forEach(el => {
      console.log(`   ${el.visible ? '✅' : '❌'} [${el.testId}] ${el.tagName} - "${el.text}"`);
    });
  }
  
  console.log('\n📦 Component Classes Found:');
  const uniqueClasses = [...new Set(components.map(c => c.className))];
  uniqueClasses.slice(0, 15).forEach(className => {
    console.log(`   - ${className}`);
  });
  
  // Check specific workflow states
  const workflowState = await page.evaluate(() => {
    const workflow = document.querySelector('[class*="workflow"]');
    return workflow?.textContent || 'No workflow content found';
  });
  
  console.log('\n🔄 Current Workflow State:');
  console.log(`   ${workflowState.substring(0, 200)}...`);
  
  // Check for any error messages
  const errors = await page.locator('.error, [class*="error"]').allTextContents();
  if (errors.length > 0) {
    console.log('\n⚠️ Error Messages Found:');
    errors.forEach(err => console.log(`   - ${err}`));
  }
  
  await browser.close();
}

checkVisibleUI().catch(console.error);