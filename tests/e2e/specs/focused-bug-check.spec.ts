import { test, expect } from '../fixtures/test-fixtures';

test.describe('Focused Bug Verification', () => {
  test('Bugs #8, #11, #12 - Backend errors, Skip transform, Cost estimation', async ({ page, mockBackend, testFiles, browserMode }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== FOCUSED BUG VERIFICATION ===\n');
    
    // First, upload a file to progress through workflow
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
    }
    
    if (browserMode) {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFiles.small);
      await page.waitForTimeout(3000);
    }
    
    // Check Bug #8 at upload screen
    console.log('Checking at Upload screen:');
    let errorCount = await page.locator('[role="alert"], .error-message').count();
    console.log(`  Error messages: ${errorCount}`);
    
    // Continue to profile
    const continueButton = page.locator('button').filter({ hasText: /continue/i }).first();
    if (await continueButton.isVisible({ timeout: 5000 })) {
      await continueButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Check Bug #8 at profile screen
    console.log('\nChecking at Profile screen:');
    await page.screenshot({ path: 'test-results/focused-profile-screen.png' });
    errorCount = await page.locator('[role="alert"], .error-message').count();
    console.log(`  Error messages: ${errorCount}`);
    
    // Check Bug #9 - Navigate to transform
    const transformHeading = await page.locator('h1').filter({ hasText: /transform/i }).isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`\nBug #9 - On transform step: ${transformHeading ? 'YES' : 'NO'}`);
    
    if (transformHeading) {
      await page.screenshot({ path: 'test-results/focused-transform-screen.png' });
      errorCount = await page.locator('[role="alert"], .error-message').count();
      console.log(`  Transform step error messages: ${errorCount}`);
      console.log(`  Bug #9 status: ${errorCount === 0 ? '✅ FIXED' : '❌ STILL HAS ERRORS'}`);
      
      // Bug #11 - Try skip transform
      console.log('\nBug #11 - Testing skip transform:');
      const skipButton = page.locator('button').filter({ hasText: /skip transform/i }).first();
      if (await skipButton.isVisible()) {
        await skipButton.click();
        await page.waitForTimeout(3000);
        
        // Check if we crashed
        const errorPage = await page.locator('text=/something went wrong/i').isVisible({ timeout: 1000 }).catch(() => false);
        const sentimentWizard = await page.locator('text=/sentiment.*wizard/i').isVisible({ timeout: 2000 }).catch(() => false);
        
        console.log(`  Error page visible: ${errorPage}`);
        console.log(`  Sentiment wizard visible: ${sentimentWizard}`);
        console.log(`  Bug #11 status: ${!errorPage && sentimentWizard ? '✅ FIXED' : '❌ STILL CRASHES'}`);
        
        await page.screenshot({ path: 'test-results/focused-after-skip.png' });
        
        // Bug #12 - Check cost estimation
        if (sentimentWizard && !errorPage) {
          console.log('\nBug #12 - Checking cost estimation:');
          const costValue = await page.locator('text=/$[0-9]+\\.[0-9]+/').isVisible({ timeout: 3000 }).catch(() => false);
          const costError = await page.locator('text=/cost.*unavailable/i').isVisible({ timeout: 1000 }).catch(() => false);
          
          console.log(`  Cost value visible: ${costValue}`);
          console.log(`  Cost error visible: ${costError}`);
          console.log(`  Bug #12 status: ${costValue && !costError ? '✅ FIXED' : '❌ STILL BROKEN'}`);
          
          await page.screenshot({ path: 'test-results/focused-cost-estimation.png' });
        }
      }
    }
    
    console.log('\n=== END FOCUSED VERIFICATION ===\n');
  });
});