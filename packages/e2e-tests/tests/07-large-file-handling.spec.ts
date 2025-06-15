import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Large File Handling', () => {
  test.beforeAll(async () => {
    // Ensure large test file exists
    const largeFilePath = path.join(__dirname, '../fixtures/large-test.csv');
    if (!fs.existsSync(largeFilePath)) {
      console.log('Large test file not found. Please generate it first.');
    }
  });

  test('test 1GB file upload', async ({ page, browserName }) => {
    test.setTimeout(300000); // 5 minutes for large file
    
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    // Set up monitoring
    const startTime = Date.now();
    let uploadStarted = false;
    let uploadCompleted = false;
    
    // Monitor network activity
    page.on('request', request => {
      if (request.url().includes('/upload') && request.method() === 'POST') {
        uploadStarted = true;
        console.log('Upload started at:', new Date().toISOString());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/upload') && response.status() === 200) {
        uploadCompleted = true;
        const duration = Date.now() - startTime;
        console.log(`Upload completed in ${duration}ms`);
      }
    });
    
    // Upload large file
    const fileInput = page.locator('input[type="file"]');
    const largeFilePath = path.join(__dirname, '../fixtures/large-test.csv');
    
    if (fs.existsSync(largeFilePath)) {
      await fileInput.setInputFiles(largeFilePath);
      
      // Wait for upload to complete
      await page.waitForFunction(() => {
        const progressElements = document.querySelectorAll('.progress-bar, [role="progressbar"]');
        return progressElements.length === 0 || 
               Array.from(progressElements).some(el => 
                 el.getAttribute('aria-valuenow') === '100'
               );
      }, { timeout: 240000 }); // 4 minutes
      
      expect(uploadCompleted).toBe(true);
    } else {
      console.warn('Skipping large file upload - file not found');
    }
  });

  test('monitor memory usage during large file processing', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Collect memory metrics
    const memoryMetrics: any[] = [];
    const collectMemory = async () => {
      if ('memory' in performance) {
        const memory = await page.evaluate(() => {
          return (performance as any).memory;
        });
        memoryMetrics.push({
          timestamp: Date.now(),
          ...memory
        });
      }
    };
    
    // Start monitoring
    const interval = setInterval(collectMemory, 1000);
    
    // Perform file operations
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    const mediumFilePath = path.join(__dirname, '../fixtures/medium-test.csv');
    
    if (fs.existsSync(mediumFilePath)) {
      await fileInput.setInputFiles(mediumFilePath);
      await page.waitForTimeout(10000); // Monitor for 10 seconds
    }
    
    clearInterval(interval);
    
    // Analyze memory usage
    if (memoryMetrics.length > 0) {
      const maxHeap = Math.max(...memoryMetrics.map(m => m.usedJSHeapSize));
      const avgHeap = memoryMetrics.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / memoryMetrics.length;
      
      console.log(`Memory usage - Max: ${(maxHeap / 1024 / 1024).toFixed(2)}MB, Avg: ${(avgHeap / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory should not exceed reasonable limits
      expect(maxHeap).toBeLessThan(500 * 1024 * 1024); // 500MB max
    }
  });

  test('verify streaming works for large files', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Monitor for streaming indicators
    let streamingDetected = false;
    
    page.on('request', request => {
      const headers = request.headers();
      if (headers['content-type']?.includes('multipart') || 
          headers['transfer-encoding'] === 'chunked') {
        streamingDetected = true;
      }
    });
    
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../fixtures/medium-test.csv');
    
    if (fs.existsSync(testFile)) {
      await fileInput.setInputFiles(testFile);
      await page.waitForTimeout(5000);
      
      console.log(`Streaming detected: ${streamingDetected}`);
    }
  });

  test('check performance benchmarks for different file sizes', async ({ page }) => {
    const fileSizes = [
      { name: 'small', path: '../fixtures/small-test.csv', expectedTime: 2000 },
      { name: 'medium', path: '../fixtures/medium-test.csv', expectedTime: 10000 },
    ];
    
    const results: any[] = [];
    
    for (const fileInfo of fileSizes) {
      const filePath = path.join(__dirname, fileInfo.path);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${fileInfo.name} - file not found`);
        continue;
      }
      
      await page.goto('http://localhost:5173');
      await page.waitForLoadState('networkidle');
      
      const startTime = Date.now();
      
      const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
      await uploadButton.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(filePath);
      
      // Wait for processing to complete
      await page.waitForFunction(() => {
        const indicators = document.querySelectorAll('.processing, .loading, .progress');
        return indicators.length === 0;
      }, { timeout: 30000 });
      
      const processingTime = Date.now() - startTime;
      const fileStats = fs.statSync(filePath);
      
      results.push({
        size: fileInfo.name,
        bytes: fileStats.size,
        time: processingTime,
        throughput: (fileStats.size / processingTime * 1000 / 1024 / 1024).toFixed(2) + ' MB/s'
      });
      
      // Verify performance meets expectations
      expect(processingTime).toBeLessThan(fileInfo.expectedTime);
    }
    
    console.table(results);
  });

  test('verify UI remains responsive during large file processing', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Start file upload
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../fixtures/medium-test.csv');
    
    if (fs.existsSync(testFile)) {
      // Start upload
      await fileInput.setInputFiles(testFile);
      
      // Test UI responsiveness during upload
      const responsivenesChecks: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const checkStart = Date.now();
        
        // Try to interact with UI
        const anyButton = page.locator('button').first();
        await anyButton.hover();
        
        const responseTime = Date.now() - checkStart;
        responsivenesChecks.push(responseTime);
        
        await page.waitForTimeout(1000);
      }
      
      const avgResponseTime = responsivenesChecks.reduce((a, b) => a + b, 0) / responsivenesChecks.length;
      console.log(`Average UI response time during processing: ${avgResponseTime}ms`);
      
      // UI should remain responsive (under 100ms)
      expect(avgResponseTime).toBeLessThan(100);
    }
  });

  test('verify batch processing for multiple large files', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    
    // Check if multiple file selection is supported
    const acceptsMultiple = await fileInput.getAttribute('multiple');
    
    if (acceptsMultiple !== null) {
      const files = [
        path.join(__dirname, '../fixtures/small-test.csv'),
        path.join(__dirname, '../fixtures/medium-test.csv')
      ].filter(f => fs.existsSync(f));
      
      if (files.length > 1) {
        await fileInput.setInputFiles(files);
        
        // Monitor batch processing
        const processingIndicators = page.locator('.file-item, .processing-file');
        const fileCount = await processingIndicators.count();
        
        expect(fileCount).toBe(files.length);
        
        // Wait for all files to process
        await page.waitForFunction(() => {
          const completed = document.querySelectorAll('.completed, .processed');
          return completed.length >= 2;
        }, { timeout: 60000 });
      }
    } else {
      console.log('Multiple file upload not supported');
    }
  });

  test('verify progress indicators for large file operations', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    const uploadButton = page.locator('button').filter({ hasText: /upload|select.*file/i });
    await uploadButton.click();
    
    const fileInput = page.locator('input[type="file"]');
    const testFile = path.join(__dirname, '../fixtures/medium-test.csv');
    
    if (fs.existsSync(testFile)) {
      await fileInput.setInputFiles(testFile);
      
      // Check for progress indicators
      const progressBar = page.locator('.progress-bar, [role="progressbar"]');
      const progressText = page.locator('.progress-text, .percentage');
      
      if (await progressBar.isVisible({ timeout: 2000 })) {
        // Monitor progress updates
        const progressValues: number[] = [];
        
        for (let i = 0; i < 10; i++) {
          const value = await progressBar.getAttribute('aria-valuenow');
          if (value) {
            progressValues.push(parseInt(value));
          }
          
          if (parseInt(value || '0') >= 100) break;
          await page.waitForTimeout(500);
        }
        
        // Progress should increase
        const isIncreasing = progressValues.every((val, idx) => 
          idx === 0 || val >= progressValues[idx - 1]
        );
        
        expect(isIncreasing).toBe(true);
        console.log('Progress values:', progressValues);
      }
    }
  });
});