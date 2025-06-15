import { test, expect } from '../fixtures/test-fixtures';

test.describe('Sentiment Analysis Execution', () => {
  test('should complete sentiment configuration and enable execution', async ({ page, mockBackend, testFiles, browserMode }) => {
    // Set up error handlers
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console Error:', msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Quick navigation to sentiment config
    console.log('Navigating to sentiment configuration...');
    
    // Upload file
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
    }
    
    if (browserMode) {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFiles.small);
    }
    
    await page.waitForTimeout(2000);
    
    // Continue from data profile
    const continueButton = page.locator('button').filter({ hasText: /continue/i }).first();
    if (await continueButton.isVisible({ timeout: 5000 })) {
      await continueButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Skip transform
    const skipButton = page.locator('button').filter({ hasText: /skip transform/i }).first();
    if (await skipButton.isVisible({ timeout: 5000 })) {
      await skipButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Now we should be on sentiment configuration
    await page.screenshot({ path: 'test-results/sentiment-01-config-start.png', fullPage: true });
    
    // Check if we're on the sentiment wizard
    const sentimentWizard = page.locator('text=/sentiment analysis wizard/i');
    const isWizardVisible = await sentimentWizard.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Sentiment wizard visible:', isWizardVisible);
    
    // Complete the wizard steps
    let stepCount = 0;
    while (stepCount < 5) {
      const nextButton = page.locator('button').filter({ hasText: /next/i }).first();
      const finishButton = page.locator('button').filter({ hasText: /finish|complete|start analysis/i }).first();
      
      if (await finishButton.isVisible({ timeout: 1000 })) {
        console.log('Found finish button, clicking...');
        await finishButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `test-results/sentiment-0${stepCount + 2}-after-finish.png`, fullPage: true });
        break;
      } else if (await nextButton.isVisible({ timeout: 1000 })) {
        console.log(`Wizard step ${stepCount + 1}, clicking next...`);
        await nextButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `test-results/sentiment-0${stepCount + 2}-step.png`, fullPage: true });
      } else {
        console.log('No navigation buttons found');
        break;
      }
      stepCount++;
    }
    
    // Check if we reached the execute step
    const executeStep = page.locator('.workflow-step').filter({ hasText: /execute/i });
    const isExecuteActive = await executeStep.locator('.active').count() > 0;
    console.log('Execute step active:', isExecuteActive);
    
    // Check the state of the execute button
    const executeButtons = await page.locator('button').filter({ hasText: /start|run.*analysis|execute/i }).all();
    console.log(`Found ${executeButtons.length} potential execute buttons`);
    
    for (let i = 0; i < executeButtons.length; i++) {
      const btn = executeButtons[i];
      const text = await btn.textContent();
      const isEnabled = await btn.isEnabled();
      const isVisible = await btn.isVisible();
      console.log(`Button ${i}: "${text}" - Enabled: ${isEnabled}, Visible: ${isVisible}`);
      
      if (isEnabled && isVisible) {
        console.log('Found enabled execute button!');
        await btn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/sentiment-execution-started.png', fullPage: true });
        break;
      }
    }
    
    // Final state
    await page.screenshot({ path: 'test-results/sentiment-final-state.png', fullPage: true });
    
    // Check for any error messages
    const errorMessages = await page.locator('.error, .error-message, [role="alert"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('Error messages found:', errorMessages);
    }
  });
});