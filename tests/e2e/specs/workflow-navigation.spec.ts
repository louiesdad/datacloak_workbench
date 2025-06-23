import { test, expect } from '../fixtures/test-fixtures';

test.describe('Workflow Navigation', () => {
  test('should progress through workflow steps', async ({ page, mockBackend, testFiles, browserMode }) => {
    // Add console error handler
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console Error:', msg.text());
      }
    });
    
    // Add page error handler
    page.on('pageerror', error => {
      console.log('Page Error:', error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/workflow-01-initial.png', fullPage: true });
    
    // Step 1: Upload a file
    console.log('Step 1: Uploading file...');
    
    // Use the uploadFile helper function
    const { uploadFile } = await import('../fixtures/test-fixtures');
    await uploadFile(page, testFiles.small, browserMode);
    
    // Wait for any processing
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/workflow-02-after-upload.png', fullPage: true });
    
    // Check current step header
    const stepHeader = page.locator('.workflow-step-container .step-header h1');
    const activeStepText = await stepHeader.textContent().catch(() => 'No step header found');
    console.log('Current step after upload:', activeStepText);
    
    // Look for Continue button in step actions
    const continueButton = page.locator('.step-actions button').filter({ hasText: /continue|skip.*sentiment/i }).first();
    if (await continueButton.isVisible({ timeout: 5000 })) {
      console.log('Found continue button, clicking...');
      await continueButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/workflow-03-after-continue.png', fullPage: true });
    }
    
    // Check if we're on transform step
    const transformHeading = page.locator('.step-header h1').filter({ hasText: /transform/i });
    if (await transformHeading.isVisible({ timeout: 5000 })) {
      console.log('On transform step');
      
      // Try to skip transform using the button with data-testid
      const skipButton = page.locator('[data-testid="skip-transform-button"]');
      if (await skipButton.isVisible()) {
        console.log('Skip button found, clicking...');
        await skipButton.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/workflow-04-after-skip-transform.png', fullPage: true });
      }
    }
    
    // Check if we reached sentiment analysis configuration
    const sentimentHeading = page.locator('.step-header h1').filter({ hasText: /configure.*sentiment/i });
    const isSentimentVisible = await sentimentHeading.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Reached sentiment analysis step:', isSentimentVisible);
    
    // Log all visible workflow steps in navigation
    const allSteps = await page.locator('.workflow-step').allTextContents();
    console.log('All workflow steps:', allSteps);
    
    // If on sentiment configuration, try to proceed
    const nextButton = page.locator('button').filter({ hasText: /next/i }).first();
    if (await nextButton.isVisible({ timeout: 2000 })) {
      console.log('Clicking Next on sentiment configuration...');
      await nextButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/workflow-05-after-next.png', fullPage: true });
      
      // Check if we reached execute step
      const executeStep = page.locator('text=/execute|run.*analysis/i');
      const isExecuteVisible = await executeStep.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Reached execute step:', isExecuteVisible);
      
      // Try to start analysis
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible() && await startButton.isEnabled()) {
        console.log('Start analysis button is enabled, clicking...');
        await startButton.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/workflow-06-analysis-started.png', fullPage: true });
      } else {
        console.log('Start analysis button not enabled');
        const isDisabled = await startButton.isDisabled().catch(() => true);
        console.log('Button disabled state:', isDisabled);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/workflow-07-final-state.png', fullPage: true });
  });
});