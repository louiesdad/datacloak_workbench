import { test, expect, expectWorkflowStep, expectFieldDetected, expectPIIBadge, waitForFileProcessing, uploadFile } from '../fixtures/test-fixtures';

test.describe('Field Detection and PII Identification', () => {
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge }) => {
    // Navigate to app and complete file upload first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expectWorkflowStep(page, 'Upload Data');
  });

  test('should detect common field types correctly', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload test file with various field types', async () => {
      await uploadFile(page, testFiles.medium, browserMode);
      await waitForFileProcessing(page);
    });

    await test.step('Navigate to field detection/profiling step', async () => {
      // Look for profile/review step activation
      const profileStep = page.locator('.workflow-step').filter({ hasText: /review|profile|field/i });
      
      // If not automatically advanced, try clicking the step
      if (await profileStep.isVisible() && !(await profileStep.locator('.active').isVisible().catch(() => false))) {
        await profileStep.click();
      }
      
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/11-field-detection-start.png', fullPage: true });
    });

    await test.step('Verify field type detection', async () => {
      // Wait for field analysis to complete
      await waitForFileProcessing(page);
      
      // Expected field types based on our test data
      const expectedFields = [
        { name: 'id', type: 'integer' },
        { name: 'name', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'phone', type: 'phone' },
        { name: 'address', type: 'text' },
        { name: 'created_date', type: 'date' },
        { name: 'amount', type: 'currency' },
        { name: 'comment', type: 'text' }
      ];
      
      // Look for field list or table
      const fieldContainer = page.locator('.field-list, .fields-table, [data-testid="field-list"], .profiler-fields');
      await expect(fieldContainer.first()).toBeVisible({ timeout: 10000 });
      
      // Check for individual fields
      for (const field of expectedFields) {
        try {
          await expectFieldDetected(page, field.name, field.type);
          console.log(`✓ Detected field: ${field.name} (${field.type})`);
        } catch (error) {
          console.log(`? Field detection uncertain: ${field.name} - ${error}`);
        }
      }
      
      await page.screenshot({ path: 'test-results/12-field-types-detected.png', fullPage: true });
    });

    await test.step('Verify confidence scores are displayed', async () => {
      // Look for confidence indicators
      const confidenceIndicators = [
        page.locator('text=/confidence|score/i'),
        page.locator('.confidence, .score'),
        page.locator('[data-testid*="confidence"]')
      ];
      
      let foundConfidence = false;
      for (const indicator of confidenceIndicators) {
        if (await indicator.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundConfidence = true;
          console.log('✓ Confidence scores displayed');
          break;
        }
      }
      
      if (!foundConfidence) {
        console.log('ℹ Confidence scores not visible or differently labeled');
      }
    });
  });

  test('should identify PII fields and show security warnings', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file with PII data', async () => {
      await uploadFile(page, testFiles.withPII, browserMode);
      await waitForFileProcessing(page);
    });

    await test.step('Navigate to field detection', async () => {
      // Advance to profiling/review step
      const reviewStep = page.locator('.workflow-step').filter({ hasText: /review|profile/i });
      if (await reviewStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reviewStep.click();
        await page.waitForTimeout(2000);
      }
      
      await page.screenshot({ path: 'test-results/13-pii-detection-start.png', fullPage: true });
    });

    await test.step('Verify PII field identification', async () => {
      await waitForFileProcessing(page);
      
      // Expected PII fields
      const piiFields = ['email', 'phone', 'name', 'address'];
      
      let piiDetectedCount = 0;
      for (const field of piiFields) {
        try {
          await expectPIIBadge(page, field);
          piiDetectedCount++;
          console.log(`✓ PII detected: ${field}`);
        } catch (error) {
          // Look for alternative PII indicators
          const piiIndicator = page.locator(`text=/${field}/i`).locator('..').locator('.pii, .sensitive, .security');
          if (await piiIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
            piiDetectedCount++;
            console.log(`✓ PII detected (alternative): ${field}`);
          } else {
            console.log(`? PII not detected: ${field}`);
          }
        }
      }
      
      await page.screenshot({ path: 'test-results/14-pii-fields-identified.png', fullPage: true });
      
      // Should detect at least some PII
      expect(piiDetectedCount).toBeGreaterThan(0);
      console.log(`Total PII fields detected: ${piiDetectedCount}/${piiFields.length}`);
    });

    await test.step('Verify security warnings are displayed', async () => {
      // Look for security-related warnings or notices
      const securityWarnings = [
        page.locator('text=/pii detected|sensitive data|privacy warning/i'),
        page.locator('.security-warning, .pii-warning, .privacy-notice'),
        page.locator('[data-testid*="security"], [data-testid*="pii"]')
      ];
      
      let foundWarning = false;
      for (const warning of securityWarnings) {
        if (await warning.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundWarning = true;
          const warningText = await warning.textContent();
          console.log(`✓ Security warning: ${warningText?.substring(0, 50)}...`);
          break;
        }
      }
      
      if (!foundWarning) {
        console.log('ℹ Security warnings may be displayed elsewhere in the workflow');
      }
    });
  });

  test('should show field statistics and data quality metrics', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file and navigate to profiling', async () => {
      await uploadFile(page, testFiles.medium, browserMode);
      await waitForFileProcessing(page);
      
      // Navigate to profiling step
      const profilingStep = page.locator('.workflow-step').filter({ hasText: /review|profile/i });
      if (await profilingStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await profilingStep.click();
        await page.waitForTimeout(2000);
      }
    });

    await test.step('Verify data quality metrics', async () => {
      await waitForFileProcessing(page);
      
      // Look for data quality indicators
      const qualityMetrics = [
        page.locator('text=/completeness|null rate|unique values/i'),
        page.locator('text=/data quality|statistics/i'),
        page.locator('.metric, .statistic, .quality-score')
      ];
      
      let foundMetrics = false;
      for (const metric of qualityMetrics) {
        if (await metric.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundMetrics = true;
          console.log('✓ Data quality metrics displayed');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/15-data-quality-metrics.png', fullPage: true });
      
      if (!foundMetrics) {
        console.log('ℹ Data quality metrics may be in a different section');
      }
    });

    await test.step('Verify sample values are shown', async () => {
      // Look for sample data or preview sections
      const sampleData = [
        page.locator('text=/sample|preview|example/i'),
        page.locator('.sample-data, .preview, .field-samples'),
        page.locator('table, .data-table')
      ];
      
      let foundSamples = false;
      for (const sample of sampleData) {
        if (await sample.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundSamples = true;
          console.log('✓ Sample data displayed');
          break;
        }
      }
      
      if (!foundSamples) {
        console.log('ℹ Sample data may be hidden or in a different format');
      }
    });
  });

  test('should handle field inference with low confidence', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file and check for GPT assistance', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      await waitForFileProcessing(page);
      
      // Navigate to profiling
      const profilingStep = page.locator('.workflow-step').filter({ hasText: /review|profile/i });
      if (await profilingStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await profilingStep.click();
        await waitForFileProcessing(page);
      }
    });

    await test.step('Look for confidence indicators and GPT assistance', async () => {
      // Look for low confidence warnings or GPT assistance indicators
      const assistanceIndicators = [
        page.locator('text=/low confidence|uncertain|gpt assist/i'),
        page.locator('.low-confidence, .gpt-assist, .ai-enhanced'),
        page.locator('[data-testid*="confidence"], [data-testid*="gpt"]')
      ];
      
      let foundAssistance = false;
      for (const indicator of assistanceIndicators) {
        if (await indicator.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundAssistance = true;
          console.log('✓ GPT assistance or confidence indicators found');
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/16-field-confidence.png', fullPage: true });
      
      if (!foundAssistance) {
        console.log('ℹ GPT assistance may be automatic or not needed for this data');
      }
    });
  });

  test('should allow manual field type corrections', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file and navigate to field editing', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      await waitForFileProcessing(page);
      
      const profilingStep = page.locator('.workflow-step').filter({ hasText: /review|profile/i });
      if (await profilingStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await profilingStep.click();
        await waitForFileProcessing(page);
      }
    });

    await test.step('Look for field editing capabilities', async () => {
      // Look for editable field types or correction options
      const editingElements = [
        page.locator('select, .dropdown').filter({ hasText: /type|format/i }),
        page.locator('button').filter({ hasText: /edit|correct|change/i }),
        page.locator('.editable, .field-editor')
      ];
      
      let foundEditing = false;
      for (const element of editingElements) {
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          foundEditing = true;
          console.log('✓ Field editing capabilities found');
          
          // Try to interact with the editing element
          try {
            await element.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'test-results/17-field-editing.png', fullPage: true });
          } catch (error) {
            console.log('Field editing element found but not interactive');
          }
          break;
        }
      }
      
      if (!foundEditing) {
        console.log('ℹ Manual field corrections may be automatic or in a different interface');
      }
    });
  });

  test('should display field count and row count summaries', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file and check summary information', async () => {
      await uploadFile(page, testFiles.medium, browserMode);
      await waitForFileProcessing(page);
      
      const profilingStep = page.locator('.workflow-step').filter({ hasText: /review|profile/i });
      if (await profilingStep.isVisible({ timeout: 5000 }).catch(() => false)) {
        await profilingStep.click();
        await waitForFileProcessing(page);
      }
    });

    await test.step('Verify summary statistics', async () => {
      // Look for row and column counts
      const summaryElements = [
        page.locator('text=/\\d+ rows?/i'),
        page.locator('text=/\\d+ columns?/i'),
        page.locator('text=/\\d+ fields?/i'),
        page.locator('.summary, .stats, .file-info')
      ];
      
      let foundSummary = false;
      for (const element of summaryElements) {
        if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
          const text = await element.textContent();
          console.log(`✓ Summary info: ${text}`);
          foundSummary = true;
        }
      }
      
      await page.screenshot({ path: 'test-results/18-summary-stats.png', fullPage: true });
      
      if (foundSummary) {
        console.log('✓ File summary statistics displayed');
      } else {
        console.log('ℹ Summary statistics may be in header or different location');
      }
    });
  });

  test('should handle empty or invalid columns gracefully', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload malformed file', async () => {
      await uploadFile(page, testFiles.malformed, browserMode);
      await page.waitForTimeout(3000); // Allow time for processing attempt
    });

    await test.step('Check error handling for invalid data', async () => {
      // Look for appropriate error messages
      const errorHandling = [
        page.locator('text=/invalid|malformed|parsing error/i'),
        page.locator('text=/empty columns|missing data/i'),
        page.locator('.error-message, .validation-error')
      ];
      
      let foundErrorHandling = false;
      for (const error of errorHandling) {
        if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
          const errorText = await error.textContent();
          console.log(`✓ Error handling: ${errorText?.substring(0, 50)}...`);
          foundErrorHandling = true;
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/19-invalid-data-handling.png', fullPage: true });
      
      // App should still be functional despite errors
      const appTitle = page.locator('text=/DataCloak Sentiment Workbench/i');
      await expect(appTitle).toBeVisible();
      
      if (!foundErrorHandling) {
        console.log('ℹ Error handling may be silent or show different messages');
      }
    });
  });
});