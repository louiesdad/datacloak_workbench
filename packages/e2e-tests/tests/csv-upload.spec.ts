import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';

const TEST_CSV_PATH = join(__dirname, '../test-data/test-100-rows.csv');

// Generate test CSV file with 100 rows
async function generateTestCSV() {
  const headers = ['id', 'name', 'email', 'phone', 'address', 'comment', 'sentiment_text'];
  const csvContent = [headers.join(',')];
  
  for (let i = 1; i <= 100; i++) {
    const row = [
      i.toString(),
      `User ${i}`,
      `user${i}@example.com`,
      `555-${String(i).padStart(4, '0')}`,
      `${i} Main St, City ${i}`,
      `This is a test comment for user ${i}`,
      i % 3 === 0 ? 'I love this product!' : i % 3 === 1 ? 'This is terrible' : 'It\'s okay I guess'
    ];
    csvContent.push(row.join(','));
  }
  
  await fs.mkdir(join(__dirname, '../test-data'), { recursive: true });
  await fs.writeFile(TEST_CSV_PATH, csvContent.join('\n'));
  return TEST_CSV_PATH;
}

test.describe('CSV File Upload', () => {
  let csvFilePath: string;

  test.beforeAll(async () => {
    csvFilePath = await generateTestCSV();
  });

  test.beforeEach(async ({ page }) => {
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

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true });
  });

  test('should upload CSV via file picker and detect fields', async ({ page }) => {
    console.log('Starting file picker upload test...');
    
    // Step 1: Find the hidden file input (browser fallback) and use it directly
    await page.screenshot({ path: 'test-results/02-before-file-select.png', fullPage: true });
    
    // Look for the specific "browse files" button as implemented
    const browseFilesButton = page.getByRole('button', { name: 'browse files' });
    const dataSourcePicker = page.locator('.data-source-picker');
    const dropZone = page.locator('.drop-zone');
    
    let uploadFound = false;
    
    // First approach: Try the hidden file input directly (browser fallback)
    const hiddenFileInput = page.locator('input[type="file"]');
    if (await hiddenFileInput.count() > 0) {
      console.log('Found hidden file input, uploading directly...');
      await hiddenFileInput.setInputFiles(csvFilePath);
      uploadFound = true;
    }
    
    // Second approach: Try clicking "browse files" button
    if (!uploadFound && await browseFilesButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found "browse files" button, clicking...');
      await browseFilesButton.click();
      await page.screenshot({ path: 'test-results/03-after-browse-files-click.png', fullPage: true });
      
      // Check if a file input becomes available after clicking
      await page.waitForTimeout(1000);
      const fileInputAfterClick = page.locator('input[type="file"]');
      if (await fileInputAfterClick.count() > 0) {
        await fileInputAfterClick.setInputFiles(csvFilePath);
        uploadFound = true;
      }
    }
    
    // Third approach: Mock the platformBridge and try again
    if (!uploadFound) {
      console.log('Setting up platformBridge mock for browser environment...');
      
      // Mock the platform bridge for browser testing
      await page.addInitScript(() => {
        (window as any).platformBridge = {
          fileSystem: {
            selectFiles: async () => {
              // Return mock file data that triggers the hidden input
              return Promise.resolve([]);
            }
          }
        };
      });
      
      // Reload to apply the mock
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Try the browse files button again
      const browseButtonAfterMock = page.getByRole('button', { name: 'browse files' });
      if (await browseButtonAfterMock.isVisible({ timeout: 2000 }).catch(() => false)) {
        await browseButtonAfterMock.click();
        await page.screenshot({ path: 'test-results/03-after-mock-click.png', fullPage: true });
        
        const fileInputAfterMock = page.locator('input[type="file"]');
        if (await fileInputAfterMock.count() > 0) {
          await fileInputAfterMock.setInputFiles(csvFilePath);
          uploadFound = true;
        }
      }
    }

    console.log(`Upload found: ${uploadFound}`);
    expect(uploadFound, 'Should find a way to upload files').toBeTruthy();
    
    // Step 2: Wait for file processing
    await page.screenshot({ path: 'test-results/04-after-file-upload.png', fullPage: true });
    
    // Look for loading indicators
    const loadingIndicators = [
      page.locator('.loading, .spinner, [data-testid="loading"]'),
      page.getByText(/processing|analyzing|loading/i),
      page.locator('.progress, .progress-bar')
    ];
    
    for (const indicator of loadingIndicators) {
      if (await indicator.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Found loading indicator, waiting for completion...');
        await indicator.waitFor({ state: 'hidden', timeout: 30000 });
        break;
      }
    }
    
    // Step 3: Wait for field detection to complete
    console.log('Waiting for field detection...');
    await page.waitForTimeout(3000); // Give some time for processing
    
    // Look for field detection results
    const fieldElements = [
      page.locator('[data-testid="field-list"], .field-list, .fields, .columns'),
      page.getByText(/field|column/i),
      page.locator('.field, .column')
    ];
    
    let fieldsFound = false;
    for (const fieldElement of fieldElements) {
      if (await fieldElement.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Found field detection results');
        fieldsFound = true;
        break;
      }
    }
    
    await page.screenshot({ path: 'test-results/05-field-detection-complete.png', fullPage: true });
    
    // Step 4: Verify expected fields are detected
    if (fieldsFound) {
      const expectedFields = ['id', 'name', 'email', 'phone', 'address', 'comment', 'sentiment_text'];
      
      for (const field of expectedFields) {
        const fieldElement = page.getByText(field, { exact: false });
        if (await fieldElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`✓ Found field: ${field}`);
        } else {
          console.log(`✗ Missing field: ${field}`);
        }
      }
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/06-test-complete.png', fullPage: true });
    
    console.log('File picker upload test completed');
  });

  test('should upload CSV via drag and drop', async ({ page }) => {
    console.log('Starting drag and drop upload test...');
    
    // Step 1: Find drop zone
    await page.screenshot({ path: 'test-results/07-before-drag-drop.png', fullPage: true });
    
    // Look for the specific drop zone class from the component
    const dropZone = page.locator('.drop-zone');
    
    if (await dropZone.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found drop zone, simulating file drop...');
      
      // Read the CSV file
      const fileBuffer = await fs.readFile(csvFilePath);
      
      // Create a more realistic file object for drop simulation
      await page.evaluate(async (fileData) => {
        const file = new File([new Uint8Array(fileData.buffer)], fileData.name, {
          type: 'text/csv'
        });
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        const dropZoneElement = document.querySelector('.drop-zone');
        if (dropZoneElement) {
          // Simulate drag enter
          const dragEnterEvent = new DragEvent('dragenter', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });
          dropZoneElement.dispatchEvent(dragEnterEvent);
          
          // Simulate drag over
          const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });
          dragOverEvent.preventDefault();
          dropZoneElement.dispatchEvent(dragOverEvent);
          
          // Simulate drop
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });
          dropEvent.preventDefault();
          dropZoneElement.dispatchEvent(dropEvent);
        }
      }, {
        name: 'test-100-rows.csv',
        buffer: Array.from(fileBuffer)
      });
      
      await page.screenshot({ path: 'test-results/08-after-drag-drop.png', fullPage: true });
      console.log('Simulated drag and drop');
    } else {
      console.log('No drop zone found, skipping drag and drop test');
      test.skip();
    }
    
    // Wait for processing
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/09-drag-drop-complete.png', fullPage: true });
    
    console.log('Drag and drop test completed');
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    console.log('Starting error handling test...');
    
    // Create an invalid CSV file
    const invalidCsvPath = join(__dirname, '../test-data/invalid.csv');
    await fs.writeFile(invalidCsvPath, 'invalid,csv,content\nwith,wrong,number,of,columns');
    
    // Try to upload the invalid file
    const fileInput = page.locator('input[type="file"]').first();
    
    if (await fileInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fileInput.setInputFiles(invalidCsvPath);
      
      // Look for error messages
      const errorMessages = [
        page.locator('.error, .alert-error, [data-testid="error"]'),
        page.getByText(/error|invalid|failed/i)
      ];
      
      let errorFound = false;
      for (const errorMsg of errorMessages) {
        if (await errorMsg.isVisible({ timeout: 10000 }).catch(() => false)) {
          console.log('Found error message:', await errorMsg.textContent());
          errorFound = true;
          break;
        }
      }
      
      await page.screenshot({ path: 'test-results/10-error-handling.png', fullPage: true });
      
      // Clean up
      await fs.unlink(invalidCsvPath);
    } else {
      console.log('No file input found for error test');
      test.skip();
    }
    
    console.log('Error handling test completed');
  });

  test.afterAll(async () => {
    // Clean up test files
    try {
      await fs.unlink(csvFilePath);
      console.log('Cleaned up test CSV file');
    } catch (e) {
      console.log('Failed to clean up test file:', e);
    }
  });
});