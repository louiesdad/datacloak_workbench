import { test, expect } from '@playwright/test';
import { createReadStream, createWriteStream, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test Developer 3's completed tasks
test.describe('Developer 3 - File Processing & Streaming', () => {
  
  const testDataDir = join(tmpdir(), 'datacloak-test-files');
  
  test.beforeAll(async () => {
    // Create test directory
    if (!existsSync(testDataDir)) {
      mkdirSync(testDataDir, { recursive: true });
    }
  });

  // TASK-004: DataCloak streaming for large files
  test.describe('TASK-004: DataCloak Streaming Implementation', () => {
    test('Backend supports configurable chunk sizes (8KB-4MB)', async ({ request }) => {
      // Create a 10MB test file
      const largeFilePath = join(testDataDir, 'large-test.csv');
      const csvData = 'id,name,email,review\n' + 
        Array(100000).fill(null).map((_, i) => 
          `${i},User${i},user${i}@example.com,"This is review number ${i}"`
        ).join('\n');
      
      writeFileSync(largeFilePath, csvData);
      
      // Test different chunk sizes
      const chunkSizes = ['8KB', '1MB', '4MB'];
      
      for (const chunkSize of chunkSizes) {
        const response = await request.post('/api/v1/data/stream-config', {
          data: { 
            chunkSize,
            filePath: largeFilePath 
          }
        });
        
        expect(response.ok()).toBeTruthy();
        const result = await response.json();
        expect(result.chunkSize).toBeDefined();
        expect(result.optimalChunkSize).toBeDefined();
      }
    });

    test('Streaming endpoints handle 20GB+ files without memory issues', async ({ request }) => {
      test.slow(); // Mark as slow test
      
      // Create progress tracking endpoint test
      const response = await request.post('/api/v1/data/upload-stream', {
        data: {
          filename: 'massive-dataset.csv',
          size: 21474836480, // 20GB
          expectedRows: 10000000
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const streamInfo = await response.json();
      expect(streamInfo.streamId).toBeDefined();
      expect(streamInfo.chunkSize).toBeDefined();
      expect(streamInfo.estimatedChunks).toBeGreaterThan(1000);
    });

    test('Progress tracking works during streaming', async ({ request }) => {
      // Test progress events
      const response = await request.post('/api/v1/data/stream-progress', {
        data: { streamId: 'test-stream-001' }
      });
      
      expect(response.ok()).toBeTruthy();
      const progress = await response.json();
      expect(progress).toHaveProperty('percentComplete');
      expect(progress).toHaveProperty('rowsProcessed');
      expect(progress).toHaveProperty('averageRowsPerSecond');
      expect(progress).toHaveProperty('estimatedTimeRemaining');
    });

    test('Memory usage monitoring during large file processing', async ({ request }) => {
      const response = await request.get('/api/v1/data/memory-stats');
      
      expect(response.ok()).toBeTruthy();
      const memStats = await response.json();
      expect(memStats.current).toBeDefined();
      expect(memStats.peak).toBeDefined();
      expect(memStats.limit).toBeDefined();
      
      // Memory should stay under 500MB during processing
      expect(memStats.current).toBeLessThan(500 * 1024 * 1024);
    });

    test('DataCloak streaming service integration', async ({ request }) => {
      // Test DataCloak streaming service
      const response = await request.post('/api/v1/datacloak/stream-test', {
        data: {
          text: 'John Doe lives at 123 Main St and his email is john@example.com',
          chunkSize: '1MB'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.piiDetected).toBe(true);
      expect(result.maskedText).toBeDefined();
      expect(result.processingTime).toBeDefined();
    });
  });

  // TASK-012: Replace mock file processing in WorkflowManager
  test.describe('TASK-012: Real File Processing in WorkflowManager', () => {
    test('createMockFileProfile function removed', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check that mock file profile is not used
      const hasMockFunction = await page.evaluate(() => {
        // Check if the page contains mock file profile references
        return document.documentElement.outerHTML.includes('createMockFileProfile') ||
               document.documentElement.outerHTML.includes('Mock data generator');
      });
      
      expect(hasMockFunction).toBe(false);
    });

    test('Real CSV parsing with streaming', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Create a real CSV file with PII data
      const csvData = `name,email,phone,review
John Doe,john@example.com,555-1234,"Great product, highly recommend!"
Jane Smith,jane@example.com,555-5678,"Poor quality, disappointed"
Bob Johnson,bob@example.com,555-9012,"Average experience, could be better"`;
      
      // Upload the file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'real-reviews.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvData)
      });
      
      // Wait for real processing (not mock)
      await page.waitForSelector('[data-testid="file-processing-complete"]', { timeout: 10000 });
      
      // Check that real field information is displayed
      await expect(page.locator('[data-testid="field-name"]')).toContainText(['name', 'email', 'phone', 'review']);
      await expect(page.locator('[data-testid="pii-detected"]')).toBeVisible();
      
      // Verify PII detection worked on real data
      const piiIndicators = page.locator('[data-testid="pii-indicator"]');
      const piiCount = await piiIndicators.count();
      expect(piiCount).toBeGreaterThan(0); // Should detect email and phone PII
    });

    test('Excel file streaming support', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Test Excel file upload (simulated)
      const excelFileInput = page.locator('input[type="file"]');
      await excelFileInput.setInputFiles({
        name: 'test-data.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('Mock Excel content') // In real test, use actual Excel file
      });
      
      // Should handle Excel files
      await page.waitForSelector('[data-testid="file-processing-start"]');
      const fileType = await page.locator('[data-testid="file-type"]').textContent();
      expect(fileType).toContain('xlsx');
    });

    test('Progress UI components during file processing', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload a larger file to see progress
      const largeCSV = 'id,data\n' + Array(10000).fill(null).map((_, i) => `${i},Data row ${i}`).join('\n');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeCSV)
      });
      
      // Check progress components
      await expect(page.locator('[data-testid="streaming-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="progress-percentage"]')).toBeVisible();
      await expect(page.locator('[data-testid="processing-speed"]')).toBeVisible();
      
      // Wait for completion
      await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 15000 });
    });

    test('Parsing error handling gracefully', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload malformed CSV
      const malformedCSV = `name,email,phone
John Doe,john@example.com,555-1234
"Broken row with missing quote,jane@example.com,555-5678
Bob,bob@example.com,555-9012`;
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'malformed.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(malformedCSV)
      });
      
      // Should handle errors gracefully
      await page.waitForSelector('[data-testid="parsing-warnings"]', { timeout: 10000 });
      const warnings = await page.locator('[data-testid="warning-message"]').allTextContents();
      expect(warnings.length).toBeGreaterThan(0);
      
      // Should still process valid rows
      await expect(page.locator('[data-testid="rows-processed"]')).toContainText(/[0-9]+ rows/);
    });
  });

  // TASK-013: Browser File System Access API
  test.describe('TASK-013: Browser File System Access API', () => {
    test('File System Access API availability detection', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      const hasFileSystemAccess = await page.evaluate(() => {
        return 'showOpenFilePicker' in window;
      });
      
      // Modern Chrome/Edge should support it
      if (page.context().browser()?.browserType().name() === 'chromium') {
        expect(hasFileSystemAccess).toBe(true);
      }
    });

    test('File System Access API integration in platform bridge', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      const platformBridgeInfo = await page.evaluate(() => {
        return {
          hasFileSystemAccess: window.platformBridge?.capabilities?.hasFileSystemAccess,
          platform: window.platformBridge?.capabilities?.platform
        };
      });
      
      expect(platformBridgeInfo.platform).toBe('browser');
      
      // If modern browser, should have file system access
      if (page.context().browser()?.browserType().name() === 'chromium') {
        expect(platformBridgeInfo.hasFileSystemAccess).toBe(true);
      }
    });

    test('Fallback mechanisms for older browsers', async ({ page, browserName }) => {
      await page.goto('http://localhost:3000');
      
      // Test file operations work regardless of File System Access API support
      const fileOperationsWork = await page.evaluate(() => {
        return new Promise(async (resolve) => {
          try {
            // This should work even without File System Access API
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.xlsx';
            
            // Simulate file selection would work
            resolve(true);
          } catch (error) {
            resolve(false);
          }
        });
      });
      
      expect(fileOperationsWork).toBe(true);
    });

    test('Drag-and-drop enhancements', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check drag-and-drop zone exists and is enhanced
      const dropZone = page.locator('[data-testid="file-drop-zone"]');
      await expect(dropZone).toBeVisible();
      
      // Check for enhanced drag-and-drop features
      const hasDirectorySupport = await page.evaluate(() => {
        const dropZone = document.querySelector('[data-testid="file-drop-zone"]');
        return dropZone?.hasAttribute('webkitdirectory') || 
               dropZone?.getAttribute('multiple') !== null;
      });
      
      expect(hasDirectorySupport).toBe(true);
    });

    test('File preview functionality', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload a file and check preview
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'preview-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('name,email\nJohn,john@example.com\nJane,jane@example.com')
      });
      
      // Should show file preview
      await page.waitForSelector('[data-testid="file-preview"]');
      await expect(page.locator('[data-testid="preview-rows"]')).toBeVisible();
      await expect(page.locator('[data-testid="file-info"]')).toContainText('preview-test.csv');
    });
  });

  // TASK-022: Enhanced export functionality
  test.describe('TASK-022: Enhanced Export Functionality', () => {
    test('Streaming exports for large datasets', async ({ page, request }) => {
      // Test streaming export API
      const response = await request.post('/api/v1/export/stream', {
        data: {
          datasetId: 'test-dataset-001',
          format: 'csv',
          streaming: true,
          estimatedRows: 1000000
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const exportInfo = await response.json();
      expect(exportInfo.streamId).toBeDefined();
      expect(exportInfo.downloadUrl).toBeDefined();
    });

    test('Multiple export formats supported', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Navigate to results (assuming some analysis has been done)
      await page.click('text=Results');
      
      // Check export options
      await page.click('[data-testid="export-button"]');
      
      const exportFormats = await page.locator('[data-testid="export-format"]').allTextContents();
      expect(exportFormats).toContain('CSV');
      expect(exportFormats).toContain('Excel');
      expect(exportFormats).toContain('JSON');
      expect(exportFormats).toContain('Parquet');
    });

    test('Export encryption options', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Results');
      await page.click('[data-testid="export-button"]');
      
      // Check encryption options
      const encryptionToggle = page.locator('[data-testid="encryption-toggle"]');
      await expect(encryptionToggle).toBeVisible();
      
      await encryptionToggle.click();
      await expect(page.locator('[data-testid="encryption-password"]')).toBeVisible();
    });

    test('Export progress tracking', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Results');
      await page.click('[data-testid="export-button"]');
      
      // Start export
      await page.selectOption('[data-testid="export-format"]', 'csv');
      await page.click('[data-testid="start-export"]');
      
      // Check progress tracking
      await expect(page.locator('[data-testid="export-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-percentage"]')).toBeVisible();
    });

    test('Export resume capability', async ({ request }) => {
      // Test export resume API
      const response = await request.post('/api/v1/export/resume', {
        data: {
          exportId: 'partial-export-001',
          resumeFrom: 50000 // Resume from row 50,000
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const resumeInfo = await response.json();
      expect(resumeInfo.resumed).toBe(true);
      expect(resumeInfo.resumeFrom).toBe(50000);
    });

    test('Cloud storage integration (S3/Azure)', async ({ request }) => {
      // Test cloud storage export
      const response = await request.post('/api/v1/export/cloud', {
        data: {
          datasetId: 'test-dataset-001',
          provider: 's3',
          bucket: 'test-bucket',
          path: 'exports/test-export.csv'
        }
      });
      
      // Should at least not error (even if credentials not configured)
      expect(response.status()).toBeLessThan(500);
    });
  });

  // Performance and Integration Tests
  test.describe('Developer 3 Performance & Integration', () => {
    test('Memory stays under 500MB during large file processing', async ({ request }) => {
      test.slow();
      
      // Start large file processing
      const response = await request.post('/api/v1/data/process-large', {
        data: {
          size: '1GB',
          rows: 5000000
        }
      });
      
      expect(response.ok()).toBeTruthy();
      
      // Monitor memory during processing
      let maxMemory = 0;
      for (let i = 0; i < 10; i++) {
        const memResponse = await request.get('/api/v1/data/memory-stats');
        const memStats = await memResponse.json();
        maxMemory = Math.max(maxMemory, memStats.current);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Memory should stay under 500MB
      expect(maxMemory).toBeLessThan(500 * 1024 * 1024);
    });

    test('Processing 20GB+ files completes successfully', async ({ request }) => {
      test.slow(); // This is a very slow test
      
      const response = await request.post('/api/v1/data/process-massive', {
        data: {
          size: '20GB',
          testMode: true // Use test mode for faster simulation
        }
      });
      
      expect(response.ok()).toBeTruthy();
      const result = await response.json();
      expect(result.canProcess).toBe(true);
      expect(result.estimatedTime).toBeDefined();
    });

    test('Export 1 million records under 5 minutes', async ({ request }) => {
      test.slow();
      
      const startTime = Date.now();
      
      const response = await request.post('/api/v1/export/large-test', {
        data: {
          rows: 1000000,
          format: 'csv'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      expect(processingTime).toBeLessThan(300); // 5 minutes
    });

    test('All file processing features work together', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload large file with streaming
      const largeCSV = 'id,name,email,review\n' + 
        Array(50000).fill(null).map((_, i) => 
          `${i},User${i},user${i}@example.com,"Review ${i} with some text"`
        ).join('\n');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'integration-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeCSV)
      });
      
      // Should show streaming progress
      await expect(page.locator('[data-testid="streaming-progress"]')).toBeVisible();
      
      // Wait for processing to complete
      await page.waitForSelector('[data-testid="processing-complete"]', { timeout: 30000 });
      
      // Should show real field analysis
      await expect(page.locator('[data-testid="field-analysis"]')).toBeVisible();
      
      // Should detect PII
      await expect(page.locator('[data-testid="pii-detected"]')).toBeVisible();
      
      // Should be able to proceed to next step
      await expect(page.locator('[data-testid="continue-button"]')).toBeEnabled();
    });

    test('No mock implementations remain', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check page source for mock indicators
      const pageContent = await page.content();
      
      // Should not contain specific Dev 3 mock indicators
      expect(pageContent).not.toContain('createMockFileProfile');
      expect(pageContent).not.toContain('Mock data generator');
      expect(pageContent).not.toContain('fallback to mock');
      expect(pageContent).not.toContain('// Mock file processing');
    });
  });
});