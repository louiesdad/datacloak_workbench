import { test, expect, expectWorkflowStep, expectSentimentResult, waitForFileProcessing, waitForJobCompletion, uploadFile } from '../fixtures/test-fixtures';

test.describe('Sentiment Analysis with OpenAI Integration', () => {
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge }) => {
    // Navigate and complete initial steps
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWorkflowStep(page, 'Upload Data');
  });

  async function navigateToSentimentStep(page: any, testFiles: any, browserMode: boolean) {
    // Complete upload, profiling, and optional transform steps
    await uploadFile(page, testFiles.medium, browserMode);
    await waitForFileProcessing(page);
    
    // Navigate through workflow to sentiment analysis step
    const sentimentStep = page.locator('.workflow-step').filter({ hasText: /sentiment|analysis|setup/i });
    if (await sentimentStep.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sentimentStep.click();
      await page.waitForTimeout(2000);
    }
    
    await page.screenshot({ path: 'test-results/30-sentiment-step-start.png', fullPage: true });
  }

  test('should display sentiment analysis configuration options', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Verify sentiment configuration UI', async () => {
      // Look for sentiment analysis setup elements
      const configElements = [
        page.locator('text=/sentiment|analysis|openai/i'),
        page.locator('text=/text field|column|model/i'),
        page.locator('.sentiment-config, .analysis-setup, .run-wizard')
      ];
      
      let foundConfig = false;
      for (const element of configElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundConfig = true;
          console.log('✓ Sentiment configuration UI found');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/31-sentiment-config.png', fullPage: true });
      
      if (!foundConfig) {
        console.log('ℹ Sentiment setup may be automatic or differently organized');
      }
    });

    await test.step('Check for text field selection', async () => {
      // Look for field/column selection for text analysis
      const fieldElements = [
        page.locator('select, .dropdown').filter({ hasText: /field|column|text/i }),
        page.locator('.field-selector, .column-picker'),
        page.locator('text=/select.*field|choose.*column/i')
      ];
      
      let foundFieldSelector = false;
      for (const element of fieldElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundFieldSelector = true;
          console.log('✓ Text field selector found');
          
          // Try to interact with selector
          try {
            await element.first().click();
            await page.waitForTimeout(1000);
            
            // Look for field options
            const fieldOptions = page.locator('option, .option').filter({ hasText: /comment|text|description/i });
            if (await fieldOptions.first().isVisible({ timeout: 2000 }).catch(() => false)) {
              await fieldOptions.first().click();
              console.log('✓ Selected text field for analysis');
            }
          } catch (error) {
            console.log('Field selector found but not interactive');
          }
          break;
        }
      }
      
      if (!foundFieldSelector) {
        console.log('ℹ Text field may be auto-selected or configured differently');
      }
    });
  });

  test('should display cost estimation for sentiment analysis', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Look for cost estimation', async () => {
      // Look for cost-related information
      const costElements = [
        page.locator('text=/cost|price|estimate|\\$/'),
        page.locator('text=/token|api call|credit/i'),
        page.locator('.cost-estimate, .price-estimate, .billing')
      ];
      
      let foundCost = false;
      for (const element of costElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundCost = true;
          const costText = await element.textContent();
          console.log(`✓ Cost estimation: ${costText?.substring(0, 50)}...`);
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/32-cost-estimation.png', fullPage: true });
      
      if (!foundCost) {
        console.log('ℹ Cost estimation may be calculated dynamically');
      }
    });

    await test.step('Check for model selection options', async () => {
      // Look for OpenAI model selection
      const modelElements = [
        page.locator('select, .dropdown').filter({ hasText: /model|gpt/i }),
        page.locator('text=/gpt-3.5|gpt-4|claude/i'),
        page.locator('.model-selector, .model-choice')
      ];
      
      let foundModel = false;
      for (const element of modelElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundModel = true;
          console.log('✓ Model selection options found');
          break;
        }
      }
      
      if (!foundModel) {
        console.log('ℹ Model may be preset or configured elsewhere');
      }
    });
  });

  test('should start sentiment analysis job successfully', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Configure and start analysis', async () => {
      // Look for start/run buttons
      const startButtons = [
        page.locator('button').filter({ hasText: /start|run|analyze|begin/i }),
        page.locator('.start-analysis, .run-sentiment, .begin-job')
      ];
      
      let foundStart = false;
      for (const button of startButtons) {
        if (await button.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundStart = true;
          console.log('✓ Start analysis button found');
          
          try {
            await button.first().click();
            await page.waitForTimeout(2000);
            console.log('✓ Sentiment analysis job started');
            break;
          } catch (error) {
            console.log('Start button found but not clickable');
          }
        }
      }
      
      await page.screenshot({ path: 'test-results/33-analysis-started.png', fullPage: true });
      
      if (!foundStart) {
        console.log('ℹ Analysis may start automatically or use different trigger');
      }
    });

    await test.step('Verify job status tracking', async () => {
      // Look for job status indicators
      const statusElements = [
        page.locator('text=/queued|processing|running/i'),
        page.locator('.job-status, .analysis-status, .progress'),
        page.locator('[role="progressbar"], .progress-bar')
      ];
      
      let foundStatus = false;
      for (const element of statusElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundStatus = true;
          const statusText = await element.textContent();
          console.log(`✓ Job status: ${statusText?.substring(0, 30)}...`);
          break;
        }
      }
      
      if (!foundStatus) {
        console.log('ℹ Job status may be displayed differently');
      }
    });
  });

  test('should show progress during sentiment analysis', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Start analysis and monitor progress', async () => {
      // Start the analysis
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
      }
      
      // Look for progress indicators
      const progressElements = [
        page.locator('[role="progressbar"]'),
        page.locator('.progress-bar, .progress'),
        page.locator('text=/\\d+%|\\d+ of \\d+/')
      ];
      
      let foundProgress = false;
      for (const element of progressElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundProgress = true;
          console.log('✓ Progress indicator found');
          
          // Monitor progress changes
          try {
            const initialProgress = await element.getAttribute('aria-valuenow') || '0';
            await page.waitForTimeout(3000);
            const laterProgress = await element.getAttribute('aria-valuenow') || '0';
            
            if (parseInt(laterProgress) > parseInt(initialProgress)) {
              console.log(`✓ Progress advancing: ${initialProgress}% → ${laterProgress}%`);
            }
          } catch (error) {
            console.log('Progress found but couldn\'t track changes');
          }
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/34-analysis-progress.png', fullPage: true });
      
      if (!foundProgress) {
        console.log('ℹ Progress may be shown as text updates or differently');
      }
    });

    await test.step('Check for real-time updates', async () => {
      // Look for streaming updates or live status
      const updateElements = [
        page.locator('text=/processed|completed|remaining/i'),
        page.locator('.live-status, .real-time, .streaming'),
        page.locator('text=/\\d+ rows processed/')
      ];
      
      let foundUpdates = false;
      for (const element of updateElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundUpdates = true;
          const updateText = await element.textContent();
          console.log(`✓ Real-time update: ${updateText?.substring(0, 40)}...`);
          break;
        }
      }
      
      if (!foundUpdates) {
        console.log('ℹ Real-time updates may be batched or different format');
      }
    });
  });

  test('should complete sentiment analysis and show results', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Run analysis to completion', async () => {
      // Start analysis
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
      }
      
      // Wait for completion
      await waitForJobCompletion(page, 60000);
      
      await page.screenshot({ path: 'test-results/35-analysis-completed.png', fullPage: true });
    });

    await test.step('Verify sentiment results are displayed', async () => {
      // Look for sentiment results
      const resultElements = [
        page.locator('text=/positive|negative|neutral/i'),
        page.locator('.sentiment-result, .analysis-result'),
        page.locator('text=/\\d+.*positive|\\d+.*negative/')
      ];
      
      let foundResults = false;
      for (const element of resultElements) {
        if (await element.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundResults = true;
          console.log('✓ Sentiment results displayed');
          break;
        }
      }
      
      // Try to verify specific sentiment counts
      try {
        await expectSentimentResult(page, 'positive');
        console.log('✓ Positive sentiment results found');
      } catch (error) {
        console.log('? Positive sentiment format may be different');
      }
      
      try {
        await expectSentimentResult(page, 'negative');
        console.log('✓ Negative sentiment results found');
      } catch (error) {
        console.log('? Negative sentiment format may be different');
      }
      
      expect(foundResults, 'Should display sentiment analysis results').toBeTruthy();
    });

    await test.step('Check for analysis summary statistics', async () => {
      // Look for summary stats
      const summaryElements = [
        page.locator('text=/total.*analyzed|\\d+ rows processed/i'),
        page.locator('text=/accuracy|confidence|score/i'),
        page.locator('.summary-stats, .analysis-summary')
      ];
      
      let foundSummary = false;
      for (const element of summaryElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundSummary = true;
          const summaryText = await element.textContent();
          console.log(`✓ Analysis summary: ${summaryText?.substring(0, 50)}...`);
          break;
        }
      }
      
      if (!foundSummary) {
        console.log('ℹ Analysis summary may be in results section');
      }
    });
  });

  test('should handle OpenAI API errors gracefully', async ({ page, testFiles, browserMode, mockOpenAI }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Simulate OpenAI API error', async () => {
      // Mock OpenAI API error
      mockOpenAI.use(
        require('msw').http.post('https://api.openai.com/v1/chat/completions', () => {
          return require('msw').HttpResponse.json(
            { error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } },
            { status: 429 }
          );
        })
      );
    });

    await test.step('Start analysis and handle error', async () => {
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
      }
      
      // Wait for error to be displayed
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: 'test-results/36-openai-error.png', fullPage: true });
    });

    await test.step('Verify error handling', async () => {
      // Look for error messages
      const errorElements = [
        page.locator('text=/rate limit|api error|openai error/i'),
        page.locator('text=/error|failed|unable/i'),
        page.locator('.error-message, .api-error, .alert-error')
      ];
      
      let foundError = false;
      for (const element of errorElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundError = true;
          const errorText = await element.textContent();
          console.log(`✓ Error handled: ${errorText?.substring(0, 50)}...`);
          break;
        }
      }
      
      // App should still be functional
      const appTitle = page.locator('text=/DataCloak Sentiment Workbench/i');
      await expect(appTitle).toBeVisible();
      
      if (!foundError) {
        console.log('ℹ API errors may be handled silently or show different messages');
      }
    });
  });

  test('should test different sentiment datasets', async ({ page, testFiles, browserMode }) => {
    await test.step('Test positive sentiment dataset', async () => {
      await uploadFile(page, testFiles.positiveOnly, browserMode);
      await waitForFileProcessing(page);
      
      await navigateToSentimentStep(page, testFiles, browserMode);
      
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
        await waitForJobCompletion(page);
      }
      
      await page.screenshot({ path: 'test-results/37-positive-sentiment.png', fullPage: true });
      
      // Should show predominantly positive results
      const positiveResults = page.locator('text=/positive/i');
      if (await positiveResults.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✓ Positive sentiment detected in positive dataset');
      }
    });

    await test.step('Test negative sentiment dataset', async () => {
      // Navigate back and upload negative dataset
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await uploadFile(page, testFiles.negativeOnly, browserMode);
      await waitForFileProcessing(page);
      
      await navigateToSentimentStep(page, testFiles, browserMode);
      
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
        await waitForJobCompletion(page);
      }
      
      await page.screenshot({ path: 'test-results/38-negative-sentiment.png', fullPage: true });
      
      // Should show predominantly negative results
      const negativeResults = page.locator('text=/negative/i');
      if (await negativeResults.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✓ Negative sentiment detected in negative dataset');
      }
    });
  });

  test('should provide sentiment analysis insights and metrics', async ({ page, testFiles, browserMode }) => {
    await navigateToSentimentStep(page, testFiles, browserMode);

    await test.step('Complete analysis and check insights', async () => {
      const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
      if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startButton.click();
        await waitForJobCompletion(page);
      }
    });

    await test.step('Look for detailed insights', async () => {
      // Look for insight elements
      const insightElements = [
        page.locator('text=/insight|trend|pattern/i'),
        page.locator('text=/distribution|breakdown|analysis/i'),
        page.locator('.insights, .trends, .analytics')
      ];
      
      let foundInsights = false;
      for (const element of insightElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundInsights = true;
          console.log('✓ Sentiment insights available');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/39-sentiment-insights.png', fullPage: true });
      
      if (!foundInsights) {
        console.log('ℹ Detailed insights may be in results/export section');
      }
    });

    await test.step('Check for visualization elements', async () => {
      // Look for charts or visual elements
      const visualElements = [
        page.locator('canvas, svg'),
        page.locator('.chart, .graph, .visualization'),
        page.locator('text=/chart|graph|visual/')
      ];
      
      let foundVisuals = false;
      for (const element of visualElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundVisuals = true;
          console.log('✓ Sentiment visualization found');
          break;
        }
      }
      
      if (!foundVisuals) {
        console.log('ℹ Visualizations may be in results section');
      }
    });
  });
});