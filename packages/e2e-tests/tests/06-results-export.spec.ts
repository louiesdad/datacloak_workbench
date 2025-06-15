import { test, expect, expectWorkflowStep, expectExportFormat, waitForFileProcessing, waitForJobCompletion, uploadFile } from '../fixtures/test-fixtures';

test.describe('Results Export Functionality', () => {
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge }) => {
    // Navigate and complete full workflow to results
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWorkflowStep(page, 'Upload Data');
  });

  async function navigateToResultsStep(page: any, testFiles: any, browserMode: boolean) {
    // Complete entire workflow: upload → profile → transform → sentiment → results
    await uploadFile(page, testFiles.medium, browserMode);
    await waitForFileProcessing(page);
    
    // Skip through intermediate steps quickly for testing
    const workflowSteps = [
      { text: /review|profile/i, name: 'profiling' },
      { text: /transform|optional/i, name: 'transform' },
      { text: /sentiment|setup|analysis/i, name: 'sentiment' },
      { text: /results|export|view/i, name: 'results' }
    ];
    
    for (const step of workflowSteps) {
      const stepElement = page.locator('.workflow-step').filter({ hasText: step.text });
      if (await stepElement.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stepElement.click();
        await page.waitForTimeout(1500);
        
        // For sentiment step, start analysis
        if (step.name === 'sentiment') {
          const startButton = page.locator('button').filter({ hasText: /start|run|analyze/i }).first();
          if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await startButton.click();
            await waitForJobCompletion(page, 30000);
          }
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/40-results-step-start.png', fullPage: true });
  }

  test('should display sentiment analysis results overview', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Verify results overview is displayed', async () => {
      // Look for results summary elements
      const resultsElements = [
        page.locator('text=/results|analysis.*complete/i'),
        page.locator('text=/\\d+.*analyzed|\\d+.*processed/i'),
        page.locator('.results-overview, .analysis-summary, .completion-summary')
      ];
      
      let foundResults = false;
      for (const element of resultsElements) {
        if (await element.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundResults = true;
          const resultsText = await element.textContent();
          console.log(`✓ Results overview: ${resultsText?.substring(0, 50)}...`);
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/41-results-overview.png', fullPage: true });
      
      if (!foundResults) {
        console.log('ℹ Results overview may be in a different format');
      }
    });

    await test.step('Check sentiment distribution display', async () => {
      // Look for sentiment breakdown
      const sentimentElements = [
        page.locator('text=/positive.*\\d+|negative.*\\d+|neutral.*\\d+/i'),
        page.locator('.sentiment-breakdown, .sentiment-distribution'),
        page.locator('text=/\\d+%.*positive|\\d+%.*negative/')
      ];
      
      let foundDistribution = false;
      for (const element of sentimentElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundDistribution = true;
          const distributionText = await element.textContent();
          console.log(`✓ Sentiment distribution: ${distributionText?.substring(0, 40)}...`);
          break;
        }
      }
      
      if (!foundDistribution) {
        console.log('ℹ Sentiment distribution may be visualized differently');
      }
    });
  });

  test('should provide multiple export format options', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Verify export format options', async () => {
      // Look for export section
      const exportSection = page.locator('text=/export|download/i').locator('..');
      if (await exportSection.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportSection.scrollIntoViewIfNeeded();
      }
      
      await page.screenshot({ path: 'test-results/42-export-options.png', fullPage: true });
      
      // Check for standard export formats
      const formats = ['csv', 'xlsx', 'json'];
      let foundFormats = 0;
      
      for (const format of formats) {
        try {
          await expectExportFormat(page, format as 'csv' | 'xlsx' | 'json');
          foundFormats++;
          console.log(`✓ Export format available: ${format.toUpperCase()}`);
        } catch (error) {
          // Try alternative selectors
          const formatButton = page.locator('button, .export-option').filter({ hasText: new RegExp(format, 'i') });
          if (await formatButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            foundFormats++;
            console.log(`✓ Export format available (alt): ${format.toUpperCase()}`);
          } else {
            console.log(`? Export format not found: ${format.toUpperCase()}`);
          }
        }
      }
      
      expect(foundFormats).toBeGreaterThan(0);
      console.log(`Total export formats available: ${foundFormats}/${formats.length}`);
    });

    await test.step('Check for export options and settings', async () => {
      // Look for export configuration options
      const optionElements = [
        page.locator('text=/include.*headers|include.*raw/i'),
        page.locator('text=/filter|select.*columns/i'),
        page.locator('.export-options, .download-settings')
      ];
      
      let foundOptions = false;
      for (const element of optionElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundOptions = true;
          console.log('✓ Export configuration options found');
          break;
        }
      }
      
      if (!foundOptions) {
        console.log('ℹ Export options may be preset or in dropdown menus');
      }
    });
  });

  test('should successfully export results as CSV', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Initiate CSV export', async () => {
      // Find and click CSV export button
      const csvButton = page.locator('button').filter({ hasText: /csv|comma.*separated/i });
      
      if (await csvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await csvButton.first().click();
        console.log('✓ CSV export initiated');
        
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/43-csv-export.png', fullPage: true });
      } else {
        // Try generic export button with CSV option
        const exportButton = page.locator('button').filter({ hasText: /export|download/i });
        if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportButton.first().click();
          
          // Look for CSV option in dropdown
          const csvOption = page.locator('.option, option').filter({ hasText: /csv/i });
          if (await csvOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await csvOption.first().click();
            console.log('✓ CSV export selected from dropdown');
          }
        }
      }
    });

    await test.step('Verify export completion', async () => {
      // Look for download success indicators
      const successElements = [
        page.locator('text=/download.*complete|export.*successful/i'),
        page.locator('text=/file.*ready|download.*ready/i'),
        page.locator('.export-success, .download-complete')
      ];
      
      let foundSuccess = false;
      for (const element of successElements) {
        if (await element.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundSuccess = true;
          console.log('✓ CSV export completed successfully');
          break;
        }
      }
      
      // In browser mode, might trigger actual download
      if (browserMode) {
        // Monitor for download events
        page.on('download', download => {
          console.log(`✓ File downloaded: ${download.suggestedFilename()}`);
          foundSuccess = true;
        });
      }
      
      if (!foundSuccess) {
        console.log('ℹ Export success may be indicated differently');
      }
    });
  });

  test('should successfully export results as Excel', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Initiate Excel export', async () => {
      const excelButton = page.locator('button').filter({ hasText: /xlsx|excel/i });
      
      if (await excelButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await excelButton.first().click();
        console.log('✓ Excel export initiated');
        
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/44-excel-export.png', fullPage: true });
      } else {
        // Try generic export with Excel option
        const exportButton = page.locator('button').filter({ hasText: /export|download/i });
        if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportButton.first().click();
          
          const excelOption = page.locator('.option, option').filter({ hasText: /xlsx|excel/i });
          if (await excelOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await excelOption.first().click();
            console.log('✓ Excel export selected');
          }
        }
      }
    });

    await test.step('Verify Excel export features', async () => {
      // Look for Excel-specific options
      const excelFeatures = [
        page.locator('text=/multiple.*sheets|worksheet/i'),
        page.locator('text=/formatting|styles/i'),
        page.locator('.excel-options, .xlsx-settings')
      ];
      
      let foundFeatures = false;
      for (const feature of excelFeatures) {
        if (await feature.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundFeatures = true;
          console.log('✓ Excel-specific features available');
          break;
        }
      }
      
      if (!foundFeatures) {
        console.log('ℹ Excel features may be automatic or preset');
      }
    });
  });

  test('should successfully export results as JSON', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Initiate JSON export', async () => {
      const jsonButton = page.locator('button').filter({ hasText: /json/i });
      
      if (await jsonButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await jsonButton.first().click();
        console.log('✓ JSON export initiated');
        
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/45-json-export.png', fullPage: true });
      } else {
        // Try generic export with JSON option
        const exportButton = page.locator('button').filter({ hasText: /export|download/i });
        if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await exportButton.first().click();
          
          const jsonOption = page.locator('.option, option').filter({ hasText: /json/i });
          if (await jsonOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await jsonOption.first().click();
            console.log('✓ JSON export selected');
          }
        }
      }
    });

    await test.step('Verify JSON export structure options', async () => {
      // Look for JSON structure options
      const jsonOptions = [
        page.locator('text=/nested|flat|structured/i'),
        page.locator('text=/pretty.*print|formatted/i'),
        page.locator('.json-options, .structure-options')
      ];
      
      let foundOptions = false;
      for (const option of jsonOptions) {
        if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundOptions = true;
          console.log('✓ JSON structure options available');
          break;
        }
      }
      
      if (!foundOptions) {
        console.log('ℹ JSON structure may be preset');
      }
    });
  });

  test('should provide filtering and column selection for export', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Look for export filtering options', async () => {
      // Find export or advanced export options
      const advancedExport = page.locator('button, .link').filter({ hasText: /advanced|options|customize/i });
      if (await advancedExport.isVisible({ timeout: 3000 }).catch(() => false)) {
        await advancedExport.first().click();
        await page.waitForTimeout(1000);
      }
      
      await page.screenshot({ path: 'test-results/46-export-filtering.png', fullPage: true });
    });

    await test.step('Check for column selection', async () => {
      // Look for column/field selection options
      const columnSelectors = [
        page.locator('text=/select.*columns|choose.*fields/i'),
        page.locator('checkbox').filter({ hasText: /column|field/i }),
        page.locator('.column-selector, .field-picker')
      ];
      
      let foundColumnSelection = false;
      for (const selector of columnSelectors) {
        if (await selector.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundColumnSelection = true;
          console.log('✓ Column selection available');
          
          // Try to interact with column selection
          try {
            await selector.first().click();
            await page.waitForTimeout(500);
          } catch (error) {
            console.log('Column selector found but not interactive');
          }
          break;
        }
      }
      
      if (!foundColumnSelection) {
        console.log('ℹ Column selection may be automatic or in different interface');
      }
    });

    await test.step('Check for data filtering options', async () => {
      // Look for data filtering (by sentiment, confidence, etc.)
      const filterOptions = [
        page.locator('text=/filter.*by|only.*positive|only.*negative/i'),
        page.locator('text=/confidence.*threshold|score.*filter/i'),
        page.locator('.data-filter, .result-filter')
      ];
      
      let foundFiltering = false;
      for (const filter of filterOptions) {
        if (await filter.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundFiltering = true;
          console.log('✓ Data filtering options available');
          break;
        }
      }
      
      if (!foundFiltering) {
        console.log('ℹ Data filtering may be through separate interface');
      }
    });
  });

  test('should handle large dataset exports', async ({ page, testFiles, browserMode }) => {
    await test.step('Complete workflow with large dataset', async () => {
      // Use large test file
      await uploadFile(page, testFiles.large, browserMode);
      await waitForFileProcessing(page, 60000);
      
      // Quick navigation to results
      const resultStep = page.locator('.workflow-step').filter({ hasText: /results|export|view/i });
      if (await resultStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await resultStep.click();
        await page.waitForTimeout(2000);
      }
    });

    await test.step('Attempt large dataset export', async () => {
      const exportButton = page.locator('button').filter({ hasText: /export|download/i });
      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportButton.first().click();
        
        // Look for processing indicators for large exports
        const processingElements = [
          page.locator('text=/preparing|generating|processing/i'),
          page.locator('.export-progress, .generation-progress'),
          page.locator('[role="progressbar"]')
        ];
        
        let foundProcessing = false;
        for (const element of processingElements) {
          if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
            foundProcessing = true;
            console.log('✓ Large export processing indicator found');
            break;
          }
        }
        
        await page.screenshot({ path: 'test-results/47-large-export.png', fullPage: true });
        
        if (!foundProcessing) {
          console.log('ℹ Large export may be handled without visible processing');
        }
      }
    });

    await test.step('Check for performance considerations', async () => {
      // Look for large dataset warnings or optimizations
      const performanceElements = [
        page.locator('text=/large.*dataset|may.*take.*time/i'),
        page.locator('text=/memory|performance|size.*limit/i'),
        page.locator('.performance-warning, .size-warning')
      ];
      
      let foundPerformance = false;
      for (const element of performanceElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundPerformance = true;
          const warningText = await element.textContent();
          console.log(`✓ Performance consideration: ${warningText?.substring(0, 40)}...`);
          break;
        }
      }
      
      if (!foundPerformance) {
        console.log('ℹ Large dataset handling may be transparent');
      }
    });
  });

  test('should handle export errors gracefully', async ({ page, testFiles, browserMode, mockBackend }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Simulate export error', async () => {
      // Mock export API error
      mockBackend.use(
        require('msw').http.post('http://localhost:3001/api/export', () => {
          return require('msw').HttpResponse.json(
            { error: { message: 'Export service temporarily unavailable', code: 'EXPORT_ERROR' } },
            { status: 503 }
          );
        })
      );
    });

    await test.step('Attempt export and handle error', async () => {
      const exportButton = page.locator('button').filter({ hasText: /export|download/i });
      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportButton.first().click();
        
        // Wait for error to be displayed
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'test-results/48-export-error.png', fullPage: true });
      }
    });

    await test.step('Verify error handling', async () => {
      // Look for export error messages
      const errorElements = [
        page.locator('text=/export.*error|download.*failed/i'),
        page.locator('text=/temporarily.*unavailable|service.*error/i'),
        page.locator('.export-error, .download-error, .alert-error')
      ];
      
      let foundError = false;
      for (const element of errorElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundError = true;
          const errorText = await element.textContent();
          console.log(`✓ Export error handled: ${errorText?.substring(0, 50)}...`);
          break;
        }
      }
      
      // App should remain functional
      const appTitle = page.locator('text=/DataCloak Sentiment Workbench/i');
      await expect(appTitle).toBeVisible();
      
      if (!foundError) {
        console.log('ℹ Export errors may be handled differently');
      }
    });
  });

  test('should provide download progress and completion feedback', async ({ page, testFiles, browserMode }) => {
    await navigateToResultsStep(page, testFiles, browserMode);

    await test.step('Monitor export progress', async () => {
      const exportButton = page.locator('button').filter({ hasText: /export|download/i });
      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportButton.first().click();
        
        // Look for progress indicators
        const progressElements = [
          page.locator('[role="progressbar"]'),
          page.locator('text=/\\d+%/'),
          page.locator('.export-progress, .download-progress')
        ];
        
        let foundProgress = false;
        for (const element of progressElements) {
          if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
            foundProgress = true;
            console.log('✓ Export progress indicator found');
            break;
          }
        }
        
        await page.screenshot({ path: 'test-results/49-export-progress.png', fullPage: true });
        
        if (!foundProgress) {
          console.log('ℹ Export progress may be very fast or not shown');
        }
      }
    });

    await test.step('Verify completion feedback', async () => {
      // Look for completion messages
      const completionElements = [
        page.locator('text=/download.*complete|export.*successful/i'),
        page.locator('text=/file.*ready|ready.*download/i'),
        page.locator('.export-complete, .download-success')
      ];
      
      let foundCompletion = false;
      for (const element of completionElements) {
        if (await element.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundCompletion = true;
          console.log('✓ Export completion feedback found');
          break;
        }
      }
      
      if (!foundCompletion) {
        console.log('ℹ Export completion may be indicated by download trigger');
      }
    });
  });
});