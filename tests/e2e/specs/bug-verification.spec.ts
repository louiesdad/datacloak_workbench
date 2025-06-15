import { test, expect } from '../fixtures/test-fixtures';

test.describe('Bug Fix Verification', () => {
  test('should verify all reported bugs are fixed', async ({ page, mockBackend, testFiles, browserMode }) => {
    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== BUG VERIFICATION REPORT ===\n');
    
    // Bug #8: Check for duplicate backend errors
    await test.step('Bug #8: Duplicate backend errors', async () => {
      const errorAlerts = await page.locator('[role="alert"], .error-message, .backend-error').all();
      const errorTexts = await Promise.all(errorAlerts.map(alert => alert.textContent()));
      
      // Check for duplicates
      const uniqueErrors = [...new Set(errorTexts)];
      const hasDuplicates = errorTexts.length !== uniqueErrors.length;
      
      console.log(`Bug #8 - Duplicate backend errors: ${hasDuplicates ? '❌ STILL PRESENT' : '✅ FIXED'}`);
      console.log(`  Found ${errorTexts.length} error messages, ${uniqueErrors.length} unique`);
      
      await page.screenshot({ path: 'test-results/bug8-backend-errors.png' });
    });
    
    // Bug #1-5: File upload functionality
    await test.step('Bugs #1-5: File upload issues', async () => {
      const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
      
      // Bug #2: Check if upload button is clickable
      let uploadClickable = false;
      if (await uploadButton.isVisible()) {
        await uploadButton.click();
        await page.waitForTimeout(1000);
        
        // Check if file input is available
        const fileInput = page.locator('input[type="file"]');
        uploadClickable = await fileInput.isVisible({ timeout: 2000 }).catch(() => false);
      }
      
      console.log(`Bug #2 - Upload button triggers file selection: ${uploadClickable ? '✅ FIXED' : '❌ STILL PRESENT'}`);
      
      if (browserMode && uploadClickable) {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFiles.small);
        await page.waitForTimeout(2000);
        
        // Bug #3: Check workflow advancement
        const profileStep = page.locator('.workflow-step').filter({ hasText: /profile/i });
        const isProfileActive = await profileStep.locator('.active').count() > 0;
        console.log(`Bug #3 - File processing advances workflow: ${isProfileActive ? '✅ FIXED' : '❌ STILL PRESENT'}`);
        
        // Bug #4: Check for feedback
        const feedbackElements = await page.locator('text=/success|complete|processed/i').count();
        console.log(`Bug #4 - Upload feedback shown: ${feedbackElements > 0 ? '✅ FIXED' : '❌ STILL PRESENT'}`);
      }
      
      await page.screenshot({ path: 'test-results/bugs1-5-file-upload.png' });
    });
    
    // Navigate to profile step
    const continueButton = page.locator('button').filter({ hasText: /continue/i }).first();
    if (await continueButton.isVisible({ timeout: 5000 })) {
      await continueButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Bug #9: Transform step
    await test.step('Bug #9: Transform step errors', async () => {
      const transformErrors = await page.locator('.error-message, [role="alert"]').count();
      console.log(`Bug #9 - Transform step errors: ${transformErrors === 0 ? '✅ NO ERRORS' : `❌ ${transformErrors} ERRORS FOUND`}`);
      
      await page.screenshot({ path: 'test-results/bug9-transform-step.png' });
    });
    
    // Bug #11: Skip transform
    await test.step('Bug #11: Skip transform crash', async () => {
      const skipButton = page.locator('button').filter({ hasText: /skip transform/i }).first();
      let skipWorked = false;
      
      if (await skipButton.isVisible({ timeout: 5000 })) {
        await skipButton.click();
        await page.waitForTimeout(3000);
        
        // Check if we reached sentiment config without crash
        const sentimentWizard = await page.locator('text=/sentiment.*wizard/i').isVisible({ timeout: 5000 }).catch(() => false);
        const errorPage = await page.locator('text=/something went wrong/i').isVisible({ timeout: 1000 }).catch(() => false);
        
        skipWorked = sentimentWizard && !errorPage;
      }
      
      console.log(`Bug #11 - Skip transform works: ${skipWorked ? '✅ FIXED' : '❌ STILL CRASHES'}`);
      await page.screenshot({ path: 'test-results/bug11-skip-transform.png' });
    });
    
    // Bug #12: Cost estimation
    await test.step('Bug #12: Cost estimation', async () => {
      const costEstimate = await page.locator('text=/$[0-9]+\\.[0-9]+/').isVisible({ timeout: 5000 }).catch(() => false);
      const costError = await page.locator('text=/cost.*unavailable/i').isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(`Bug #12 - Cost estimation: ${costEstimate && !costError ? '✅ FIXED' : '❌ STILL BROKEN'}`);
      await page.screenshot({ path: 'test-results/bug12-cost-estimation.png' });
    });
    
    // Complete sentiment config
    const nextButton = page.locator('button').filter({ hasText: /next|start analysis/i }).first();
    if (await nextButton.isVisible({ timeout: 2000 })) {
      await nextButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Bug #10: Execute button
    let executeEnabled = false;
    await test.step('Bug #10: Execute button disabled', async () => {
      const executeButton = page.locator('button').filter({ hasText: /execute|run.*analysis|start/i }).first();
      
      if (await executeButton.isVisible({ timeout: 5000 })) {
        executeEnabled = await executeButton.isEnabled();
      }
      
      console.log(`Bug #10 - Execute button enabled: ${executeEnabled ? '✅ FIXED' : '❌ STILL DISABLED'}`);
      await page.screenshot({ path: 'test-results/bug10-execute-button.png' });
    });
    
    // Navigate to results if possible
    if (executeEnabled) {
      const executeButton = page.locator('button').filter({ hasText: /execute|run.*analysis|start/i }).first();
      await executeButton.click();
      await page.waitForTimeout(3000);
    }
    
    // Bug #6-7: Export functionality
    await test.step('Bugs #6-7: Export functionality', async () => {
      // Try to reach results page
      const resultsButton = page.locator('button').filter({ hasText: /results|export/i }).first();
      if (await resultsButton.isVisible({ timeout: 2000 }) && await resultsButton.isEnabled()) {
        await resultsButton.click();
        await page.waitForTimeout(2000);
      }
      
      const csvOption = await page.locator('text=/csv/i').isVisible({ timeout: 3000 }).catch(() => false);
      const xlsxOption = await page.locator('text=/xlsx|excel/i').isVisible({ timeout: 1000 }).catch(() => false);
      const jsonOption = await page.locator('text=/json/i').isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(`Bug #6 - Export formats available:`);
      console.log(`  CSV: ${csvOption ? '✅' : '❌'}`);
      console.log(`  XLSX: ${xlsxOption ? '✅' : '❌'}`);
      console.log(`  JSON: ${jsonOption ? '✅' : '❌'}`);
      
      const exportButton = page.locator('button').filter({ hasText: /export|download/i }).first();
      const exportEnabled = await exportButton.isEnabled().catch(() => false);
      console.log(`Bug #7 - Export button enabled: ${exportEnabled ? '✅ FIXED' : '❌ STILL DISABLED'}`);
      
      await page.screenshot({ path: 'test-results/bugs6-7-export.png' });
    });
    
    console.log('\n=== END OF VERIFICATION ===\n');
    console.log('Console errors found:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors.slice(0, 3).join('\n'));
    }
  });
  
  // Bug #13: Mobile view
  test('should verify mobile view layout (Bug #13)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== MOBILE VIEW VERIFICATION ===\n');
    
    // Check error banner size
    const errorBanner = page.locator('[role="alert"], .error-banner').first();
    let bannerHeightRatio = 0;
    
    if (await errorBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      const bannerBox = await errorBanner.boundingBox();
      const viewportHeight = 844;
      bannerHeightRatio = bannerBox.height / viewportHeight;
      
      console.log(`Bug #13 - Error banner height ratio: ${(bannerHeightRatio * 100).toFixed(1)}%`);
      console.log(`  ${bannerHeightRatio < 0.15 ? '✅ ACCEPTABLE' : '❌ TOO LARGE'}`);
    } else {
      console.log(`Bug #13 - No error banner visible ✅`);
    }
    
    // Check responsive layout
    const mainContent = page.locator('main, .main-content').first();
    const contentBox = await mainContent.boundingBox();
    const contentFitsViewport = contentBox && contentBox.width <= 390;
    
    console.log(`Mobile layout fits viewport: ${contentFitsViewport ? '✅' : '❌'}`);
    
    await page.screenshot({ path: 'test-results/bug13-mobile-view.png', fullPage: true });
  });
});