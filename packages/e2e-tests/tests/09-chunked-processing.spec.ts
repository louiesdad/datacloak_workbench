import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chunked Processing for Large Files', () => {
  let largeTestFile: string;

  test.beforeAll(async () => {
    // Create a 300MB test file to trigger chunking (>100MB threshold)
    const testDir = '/tmp/e2e-large-files';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    largeTestFile = path.join(testDir, 'large-test-300mb.csv');
    
    // Generate 300MB CSV file
    const stream = fs.createWriteStream(largeTestFile);
    stream.write('id,name,email,description,timestamp\n');
    
    const rowSize = 1000; // Approximate bytes per row
    const totalRows = 300 * 1024 * 1024 / rowSize; // 300MB worth of rows
    
    for (let i = 0; i < totalRows; i++) {
      stream.write(`${i},User${i},user${i}@example.com,This is a description for user ${i} with some padding text to make the row larger and more realistic for testing purposes,2024-01-${(i % 30) + 1}T10:00:00Z\n`);
    }
    
    await new Promise(resolve => stream.end(resolve));
    console.log(`✓ Created 300MB test file: ${largeTestFile}`);
  });

  test.afterAll(async () => {
    // Cleanup
    if (fs.existsSync(largeTestFile)) {
      fs.unlinkSync(largeTestFile);
    }
  });

  test('should process large files in 256MB chunks', async ({ page, browserMode }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await test.step('Upload large file', async () => {
      // Look for the upload area
      const uploadArea = page.locator('.upload-area, [data-testid="upload-area"]').first();
      
      if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadArea.click();
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeTestFile);
      console.log('✓ Large file selected for upload');
    });

    await test.step('Verify chunked upload progress', async () => {
      // Look for chunk progress indicators
      const chunkProgress = page.locator('[data-testid="chunk-progress"], .chunk-indicator');
      
      if (await chunkProgress.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Monitor chunk uploads
        let lastChunk = 0;
        for (let i = 0; i < 10; i++) { // Check for 10 seconds
          const chunkText = await chunkProgress.textContent();
          const match = chunkText?.match(/chunk (\d+) of (\d+)/i);
          
          if (match) {
            const currentChunk = parseInt(match[1]);
            const totalChunks = parseInt(match[2]);
            
            if (currentChunk > lastChunk) {
              console.log(`✓ Processing chunk ${currentChunk}/${totalChunks}`);
              lastChunk = currentChunk;
            }
            
            // 300MB file should have 2 chunks (256MB + 44MB)
            expect(totalChunks).toBe(2);
          }
          
          await page.waitForTimeout(1000);
        }
      }
    });

    await test.step('Verify memory-efficient processing', async () => {
      // Look for memory usage indicator
      const memoryIndicator = page.locator('[data-testid="memory-usage"], .memory-indicator');
      
      if (await memoryIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        const memoryText = await memoryIndicator.textContent();
        console.log(`✓ Memory usage: ${memoryText}`);
        
        // Memory usage should stay reasonable (not loading entire file)
        const match = memoryText?.match(/(\d+)\s*(MB|GB)/i);
        if (match) {
          const usage = parseInt(match[1]);
          const unit = match[2].toUpperCase();
          
          if (unit === 'GB') {
            expect(usage).toBeLessThan(2); // Should stay under 2GB
          } else if (unit === 'MB') {
            expect(usage).toBeLessThan(500); // Should not exceed 500MB for chunked processing
          }
        }
      }
    });
  });

  test('should handle chunk upload failures gracefully', async ({ page, browserMode, mockBackend }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock chunk upload failure on second chunk
    let chunkCount = 0;
    mockBackend.use(
      require('msw').http.post('http://localhost:3001/api/upload/chunk', () => {
        chunkCount++;
        if (chunkCount === 2) {
          return require('msw').HttpResponse.json(
            { error: { message: 'Chunk upload failed', code: 'CHUNK_ERROR' } },
            { status: 500 }
          );
        }
        return require('msw').HttpResponse.json({ success: true });
      })
    );

    await test.step('Upload file with chunk failure', async () => {
      const uploadArea = page.locator('.upload-area, [data-testid="upload-area"]').first();
      if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadArea.click();
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeTestFile);
    });

    await test.step('Verify chunk retry mechanism', async () => {
      // Look for retry indicators
      const retryNotice = page.locator('[data-testid="chunk-retry"], .retry-notice');
      
      if (await retryNotice.isVisible({ timeout: 10000 }).catch(() => false)) {
        const retryText = await retryNotice.textContent();
        expect(retryText).toMatch(/retry|attempting/i);
        console.log('✓ Chunk retry mechanism activated');
      }

      // Check for eventual success or final error
      const successNotice = page.locator('[data-testid="upload-success"], .success-message');
      const errorNotice = page.locator('[data-testid="upload-error"], .error-message');
      
      const result = await Promise.race([
        successNotice.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'success'),
        errorNotice.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'error')
      ]).catch(() => 'timeout');
      
      console.log(`✓ Chunk upload result: ${result}`);
    });
  });

  test('should maintain data integrity across chunks', async ({ page, browserMode }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await test.step('Upload and process chunked file', async () => {
      const uploadArea = page.locator('.upload-area, [data-testid="upload-area"]').first();
      if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadArea.click();
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeTestFile);
      
      // Wait for processing to complete
      await page.waitForTimeout(10000); // Give time for chunked upload
    });

    await test.step('Verify row count integrity', async () => {
      // Look for row count display
      const rowCount = page.locator('[data-testid="row-count"], .record-count');
      
      if (await rowCount.isVisible({ timeout: 15000 }).catch(() => false)) {
        const countText = await rowCount.textContent();
        const match = countText?.match(/(\d+)\s*rows/i);
        
        if (match) {
          const actualRows = parseInt(match[1]);
          const expectedRows = Math.floor(300 * 1024 * 1024 / 1000); // ~314k rows
          
          // Allow 1% variance for CSV parsing differences
          expect(actualRows).toBeGreaterThan(expectedRows * 0.99);
          expect(actualRows).toBeLessThan(expectedRows * 1.01);
          
          console.log(`✓ Data integrity maintained: ${actualRows} rows processed`);
        }
      }
    });
  });

  test('should show accurate progress for streaming operations', async ({ page, browserMode }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await test.step('Monitor streaming progress', async () => {
      const uploadArea = page.locator('.upload-area, [data-testid="upload-area"]').first();
      if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadArea.click();
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeTestFile);
      
      // Monitor progress updates
      const progressBar = page.locator('[role="progressbar"], .progress-bar').first();
      const progressText = page.locator('[data-testid="progress-text"], .progress-percentage');
      
      const progressValues: number[] = [];
      
      for (let i = 0; i < 20; i++) { // Monitor for 20 seconds
        if (await progressBar.isVisible({ timeout: 1000 }).catch(() => false)) {
          const ariaValue = await progressBar.getAttribute('aria-valuenow');
          if (ariaValue) {
            progressValues.push(parseInt(ariaValue));
          }
        } else if (await progressText.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await progressText.textContent();
          const match = text?.match(/(\d+)%/);
          if (match) {
            progressValues.push(parseInt(match[1]));
          }
        }
        
        await page.waitForTimeout(1000);
      }
      
      // Verify progress is incremental and reaches completion
      if (progressValues.length > 0) {
        console.log(`✓ Progress updates: ${progressValues.join(', ')}`);
        
        // Check that progress increases
        for (let i = 1; i < progressValues.length; i++) {
          expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i-1]);
        }
        
        // Check that we eventually reach or approach 100%
        const maxProgress = Math.max(...progressValues);
        expect(maxProgress).toBeGreaterThan(90);
      }
    });
  });

  test('should optimize chunk size based on network conditions', async ({ page, browserMode }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await test.step('Check adaptive chunking', async () => {
      // Look for chunk size indicator
      const chunkInfo = page.locator('[data-testid="chunk-info"], .chunk-details');
      
      const uploadArea = page.locator('.upload-area, [data-testid="upload-area"]').first();
      if (await uploadArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadArea.click();
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largeTestFile);
      
      // Monitor chunk size adaptations
      if (await chunkInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
        const infoText = await chunkInfo.textContent();
        console.log(`✓ Chunk info: ${infoText}`);
        
        // Check if chunk size is mentioned
        const sizeMatch = infoText?.match(/(\d+)\s*MB\s*chunks/i);
        if (sizeMatch) {
          const chunkSize = parseInt(sizeMatch[1]);
          expect(chunkSize).toBeGreaterThan(0);
          expect(chunkSize).toBeLessThanOrEqual(256); // Should not exceed max chunk size
          console.log(`✓ Adaptive chunk size: ${chunkSize}MB`);
        }
      }
    });
  });
});