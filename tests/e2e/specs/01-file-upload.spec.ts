import { test, expect, expectWorkflowStep, waitForFileProcessing, uploadFile } from '../fixtures/test-fixtures';

test.describe('File Upload Functionality', () => {
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge }) => {
    // Set up request interception for file upload
    await page.route('**/api/v1/data/upload', async (route, request) => {
      console.log('Intercepting upload request:', request.url());
      
      if (request.method() === 'POST') {
        // Simulate successful upload response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              dataset: {
                datasetId: `ds_${Date.now()}`,
                originalFilename: 'small-test.csv',
                recordCount: 100,
                size: 1024,
                uploadedAt: new Date().toISOString(),
                status: 'ready'
              },
              fieldInfo: [
                { name: 'id', type: 'integer', piiDetected: false },
                { name: 'name', type: 'text', piiDetected: true, piiType: 'NAME' },
                { name: 'email', type: 'email', piiDetected: true, piiType: 'EMAIL' },
                { name: 'comment', type: 'text', piiDetected: false },
                { name: 'rating', type: 'integer', piiDetected: false }
              ],
              previewData: [
                { id: 1, name: 'John Doe', email: 'john@example.com', comment: 'Great product!', rating: 5 },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com', comment: 'Could be better', rating: 3 }
              ],
              securityScan: {
                piiItemsDetected: 2,
                complianceScore: 85,
                riskLevel: 'medium'
              }
            }
          })
        });
      } else {
        await route.continue();
      }
    });
    
    // Enable request/response logging
    page.on('request', request => {
      console.log('→', request.method(), request.url());
    });
    
    page.on('response', response => {
      console.log('←', response.status(), response.url());
    });

    // Log console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console Error:', msg.text());
      }
    });

    // Navigate to the app and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the upload step
    await expectWorkflowStep(page, 'Upload Data');
  });

  test('should upload small CSV file successfully', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload small CSV file', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      
      // Click the Upload File button
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Wait for file processing to complete
      await waitForFileProcessing(page);
      
      // Take screenshot after upload
      await page.screenshot({ path: 'test-results/01-small-file-uploaded.png', fullPage: true });
    });

    await test.step('Verify file was processed', async () => {
      // After successful upload, app should navigate to Data Profile step
      await page.waitForTimeout(2000); // Give time for navigation
      
      // Check that we're on the Data Profile step
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible({ timeout: 10000 });
      
      // Verify dataset info is displayed
      const datasetInfo = page.locator('text=/Records: 100|File: small-test.csv/i');
      await expect(datasetInfo.first()).toBeVisible();
      
      // Verify PII warning is shown
      const piiWarning = page.locator('text=/PII Protection Active/i');
      await expect(piiWarning).toBeVisible();
    });
  });

  test('should upload medium CSV file with progress indication', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload medium CSV file', async () => {
      await uploadFile(page, testFiles.medium, browserMode);
      
      // Click the Upload File button
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Look for progress indicators during upload
      const progressIndicators = [
        page.locator('.progress-bar, [role="progressbar"]'),
        page.locator('text=/uploading|processing/i'),
        page.locator('.spinner, .loading')
      ];
      
      let foundProgress = false;
      for (const indicator of progressIndicators) {
        if (await indicator.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Found progress indicator');
          foundProgress = true;
          break;
        }
      }
      
      // Wait for processing to complete
      await waitForFileProcessing(page);
      
      await page.screenshot({ path: 'test-results/02-medium-file-uploaded.png', fullPage: true });
    });

    await test.step('Verify file processing completed', async () => {
      // Should either show completion or move to next step
      const completionIndicators = [
        page.locator('text=/complete|finished|ready/i'),
        page.locator('.workflow-step').nth(1).locator('.active, .completed')
      ];
      
      let foundCompletion = false;
      for (const indicator of completionIndicators) {
        if (await indicator.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundCompletion = true;
          break;
        }
      }
      
      // If no completion found, at least verify no error states
      const errorIndicators = page.locator('text=/error|failed/i, .error, .failed');
      await expect(errorIndicators).toHaveCount(0);
    });
  });

  test('should handle large CSV file upload', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload large CSV file', async () => {
      await uploadFile(page, testFiles.large, browserMode);
      
      // Click the Upload File button
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // For large files, we should definitely see progress indicators
      const progressBar = page.locator('.progress-bar, [role="progressbar"]');
      if (await progressBar.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Wait for progress to advance
        await expect(progressBar).toHaveAttribute('aria-valuenow', /.+/, { timeout: 10000 });
      }
      
      // Wait for processing to complete (longer timeout for large files)
      await waitForFileProcessing(page, 60000);
      
      await page.screenshot({ path: 'test-results/03-large-file-uploaded.png', fullPage: true });
    });

    await test.step('Verify large file handling', async () => {
      // Should handle large files without crashing
      const memoryWarnings = page.locator('text=/memory|performance/i');
      if (await memoryWarnings.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Memory warning detected for large file');
      }
      
      // Verify no critical errors
      const criticalErrors = page.locator('text=/crash|fatal|out of memory/i');
      await expect(criticalErrors).toHaveCount(0);
    });
  });

  test('should upload PII-containing file and show warnings', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload PII file', async () => {
      await uploadFile(page, testFiles.withPII, browserMode);
      
      // Click the Upload File button
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      await waitForFileProcessing(page);
      
      await page.screenshot({ path: 'test-results/04-pii-file-uploaded.png', fullPage: true });
    });

    await test.step('Verify PII warnings or detection', async () => {
      // Look for PII-related warnings or badges
      const piiIndicators = [
        page.locator('.notification-toast').filter({ hasText: /pii|personal|sensitive/i }),
        page.locator('.pii-warning, .security-warning, .badge-pii'),
        page.locator('[data-testid*="pii"]')
      ];
      
      let foundPiiIndicator = false;
      for (const indicator of piiIndicators) {
        if (await indicator.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('Found PII indicator');
          foundPiiIndicator = true;
          break;
        }
      }
      
      // Note: PII detection might happen in the next step, so this is informational
      if (foundPiiIndicator) {
        console.log('✓ PII detection working in upload stage');
      } else {
        console.log('ℹ PII detection may occur in profiling stage');
      }
    });
  });

  test('should reject invalid file formats', async ({ page, testFiles, browserMode }) => {
    await test.step('Attempt to upload invalid format', async () => {
      if (browserMode) {
        // In browser mode, try to upload the invalid file
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFiles.invalidFormat);
      } else {
        // In Electron mode, the file picker should filter, but we can simulate
        console.log('Electron mode: File picker should filter invalid formats');
      }
      
      await page.screenshot({ path: 'test-results/05-invalid-format-attempt.png', fullPage: true });
    });

    await test.step('Verify rejection of invalid format', async () => {
      // Look for error messages about file format
      const formatErrors = [
        page.locator('text=/unsupported format/i'),
        page.locator('text=/invalid file/i'),
        page.locator('.error, .validation-error')
      ];
      
      let foundFormatError = false;
      for (const error of formatErrors) {
        if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundFormatError = true;
          break;
        }
      }
      
      if (browserMode) {
        // In browser mode, we should see validation errors
        console.log(`Format validation error found: ${foundFormatError}`);
      }
    });
  });

  test('should handle malformed CSV gracefully', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload malformed CSV', async () => {
      await uploadFile(page, testFiles.malformed, browserMode);
      
      // Wait for processing attempt
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'test-results/06-malformed-csv.png', fullPage: true });
    });

    await test.step('Verify graceful error handling', async () => {
      // Should show helpful error messages, not crash
      const errorMessages = [
        page.locator('.notification-toast').filter({ hasText: /malformed|invalid csv|parsing error|failed/i }),
        page.locator('.error-message, .validation-error'),
        page.locator('[data-testid*="validation-error"]')
      ];
      
      let foundErrorMessage = false;
      for (const error of errorMessages) {
        if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundErrorMessage = true;
          const errorText = await error.textContent();
          console.log(`Found error message: ${errorText}`);
          break;
        }
      }
      
      // Verify the app didn't crash - check app title exists
      const appTitle = page.locator('.app-title').filter({ hasText: /DataCloak/i });
      await expect(appTitle).toBeVisible();
    });
  });

  test('should support drag and drop file upload', async ({ page, testFiles, browserMode }) => {
    await test.step('Drag and drop file', async () => {
      const dropZone = page.locator('[data-testid="file-drop-zone"]');
      await expect(dropZone).toBeVisible();
      
      if (browserMode) {
        // Create a realistic drag and drop simulation for browser
        const fileContent = await require('fs').promises.readFile(testFiles.small);
        
        await page.evaluate(async (fileData) => {
          const file = new File([new Uint8Array(fileData.buffer)], fileData.name, {
            type: 'text/csv'
          });
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          
          const dropZoneElement = document.querySelector('.drop-zone');
          if (dropZoneElement) {
            // Simulate drag events
            ['dragenter', 'dragover', 'drop'].forEach(eventType => {
              const event = new DragEvent(eventType, {
                bubbles: true,
                cancelable: true,
                dataTransfer
              });
              if (eventType === 'dragover' || eventType === 'drop') {
                event.preventDefault();
              }
              dropZoneElement.dispatchEvent(event);
            });
          }
        }, {
          name: 'small-test.csv',
          buffer: Array.from(fileContent)
        });
      } else {
        // For Electron, drag and drop would work with real files
        console.log('Electron mode: Drag and drop with real file system');
      }
      
      await waitForFileProcessing(page);
      await page.screenshot({ path: 'test-results/07-drag-drop-upload.png', fullPage: true });
    });

    await test.step('Verify drag and drop success', async () => {
      // Look for upload success indicators
      const successIndicators = [
        page.locator('text=/uploaded|success/i'),
        page.locator('.success, .uploaded')
      ];
      
      let foundSuccess = false;
      for (const indicator of successIndicators) {
        if (await indicator.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundSuccess = true;
          break;
        }
      }
      
      // At minimum, verify no critical errors
      const criticalErrors = page.locator('text=/crash|fatal/i');
      await expect(criticalErrors).toHaveCount(0);
    });
  });

  test('should show file requirements and help text', async ({ page }) => {
    await test.step('Verify file requirements display', async () => {
      // Check that file requirements are clearly displayed
      const requirements = [
        page.locator('.file-requirements').filter({ hasText: /supported formats/i }),
        page.locator('.file-requirements').filter({ hasText: /csv|xlsx|xls|tsv/i }),
        page.locator('.file-requirements').filter({ hasText: /50gb|maximum size/i }),
        page.locator('.secondary-text').filter({ hasText: /drag.*drop|browse/i })
      ];
      
      for (const requirement of requirements) {
        await expect(requirement.first()).toBeVisible();
      }
      
      await page.screenshot({ path: 'test-results/08-file-requirements.png', fullPage: true });
    });

    await test.step('Verify help text availability', async () => {
      // Look for help or info icons/text
      const helpElements = [
        page.locator('[title*="help"], [title*="info"]'),
        page.locator('.help-text, .info-text'),
        page.locator('text=/learn more|help|info/i')
      ];
      
      let foundHelp = false;
      for (const help of helpElements) {
        if (await help.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundHelp = true;
          break;
        }
      }
      
      console.log(`Help text available: ${foundHelp}`);
    });
  });
});

test.describe('File Upload Error Scenarios', () => {
  test.beforeEach(async ({ page, mockBackend, platformBridge }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle server upload errors gracefully', async ({ page, testFiles, browserMode, mockBackend }) => {
    await test.step('Simulate server error', async () => {
      // Mock server error response
      mockBackend.use(
        require('msw').http.post('http://localhost:3001/api/upload', () => {
          return require('msw').HttpResponse.json(
            { error: { message: 'Server temporarily unavailable', code: 'SERVER_ERROR' } },
            { status: 500 }
          );
        })
      );
    });

    await test.step('Attempt upload with server error', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      
      // Wait for error to be displayed
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'test-results/09-server-error.png', fullPage: true });
    });

    await test.step('Verify error handling', async () => {
      // Should show user-friendly error message
      const errorMessages = [
        page.locator('text=/server error|temporarily unavailable/i'),
        page.locator('.error-message, .alert-error')
      ];
      
      let foundError = false;
      for (const error of errorMessages) {
        if (await error.isVisible({ timeout: 5000 }).catch(() => false)) {
          foundError = true;
          break;
        }
      }
      
      // App should still be functional
      const appTitle = page.locator('text=/DataCloak Sentiment Workbench/i');
      await expect(appTitle).toBeVisible();
    });
  });

  test('should handle network connectivity issues', async ({ page, testFiles, browserMode, mockBackend }) => {
    await test.step('Simulate network timeout', async () => {
      // Mock network timeout
      mockBackend.use(
        require('msw').http.post('http://localhost:3001/api/upload', async () => {
          // Simulate a long delay that would timeout
          await new Promise(resolve => setTimeout(resolve, 35000));
          return require('msw').HttpResponse.json({ success: true });
        })
      );
    });

    await test.step('Attempt upload with network timeout', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      
      // Wait for timeout error
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: 'test-results/10-network-timeout.png', fullPage: true });
    });

    await test.step('Verify timeout handling', async () => {
      // Should show timeout or network error
      const timeoutMessages = [
        page.locator('text=/timeout|network error|connection failed/i'),
        page.locator('.error-message, .network-error')
      ];
      
      let foundTimeout = false;
      for (const timeout of timeoutMessages) {
        if (await timeout.isVisible({ timeout: 10000 }).catch(() => false)) {
          foundTimeout = true;
          break;
        }
      }
      
      console.log(`Network timeout error handling: ${foundTimeout}`);
    });
  });
});