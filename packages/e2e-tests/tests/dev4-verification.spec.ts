import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import { createReadStream } from 'fs';
import { join } from 'path';

// Test Developer 4's completed tasks
test.describe('Developer 4 - Frontend Integration & Real-time Features', () => {
  
  // TASK-011: Real-time Dashboard WebSocket
  test.describe('TASK-011: WebSocket Real-time Dashboard', () => {
    test('WebSocket server is running and accepts connections', async ({ page }) => {
      // Navigate to dashboard
      await page.goto('http://localhost:3000');
      await page.click('text=Dashboard');
      
      // Check WebSocket connection indicator
      const connectionStatus = page.locator('[data-testid="websocket-status"]');
      await expect(connectionStatus).toBeVisible();
      
      // Should show connected within 5 seconds
      await expect(connectionStatus).toHaveText(/connected/i, { timeout: 5000 });
    });

    test('Real-time sentiment updates replace mock setInterval', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Dashboard');
      
      // Check that real-time feed exists
      const realTimeFeed = page.locator('[data-testid="realtime-sentiment-feed"]');
      await expect(realTimeFeed).toBeVisible();
      
      // Capture initial sentiment count
      const initialCount = await page.locator('[data-testid="sentiment-count"]').textContent();
      
      // Wait for WebSocket update (not setInterval)
      await page.waitForTimeout(3000);
      
      // Count should update via WebSocket
      const updatedCount = await page.locator('[data-testid="sentiment-count"]').textContent();
      expect(updatedCount).not.toBe(initialCount);
      
      // Verify no setInterval in network traffic
      const hasInterval = await page.evaluate(() => {
        // Check if RealTimeDashboard uses setInterval
        return window.toString().includes('setInterval');
      });
      expect(hasInterval).toBe(false);
    });

    test('WebSocket reconnection works after disconnect', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Dashboard');
      
      // Wait for initial connection
      await expect(page.locator('[data-testid="websocket-status"]')).toHaveText(/connected/i);
      
      // Simulate disconnect by disabling network
      await page.context().setOffline(true);
      await expect(page.locator('[data-testid="websocket-status"]')).toHaveText(/disconnected|reconnecting/i);
      
      // Re-enable network
      await page.context().setOffline(false);
      
      // Should reconnect automatically
      await expect(page.locator('[data-testid="websocket-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    });

    test('Can handle 100+ concurrent connections', async () => {
      const connections: WebSocket[] = [];
      const connectionPromises = [];
      
      // Create 100 WebSocket connections
      for (let i = 0; i < 100; i++) {
        const promise = new Promise((resolve, reject) => {
          const ws = new WebSocket('ws://localhost:3001/ws');
          ws.on('open', () => {
            connections.push(ws);
            resolve(ws);
          });
          ws.on('error', reject);
        });
        connectionPromises.push(promise);
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      expect(connections.length).toBe(100);
      
      // Clean up
      connections.forEach(ws => ws.close());
    });
  });

  // TASK-010: Replace mock security audit
  test.describe('TASK-010: Security Audit Implementation', () => {
    test('Real compliance scoring replaces mock', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload a file with PII
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-pii.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`name,email,phone,ssn
John Doe,john@example.com,555-1234,123-45-6789
Jane Smith,jane@example.com,555-5678,987-65-4321`)
      });
      
      // Wait for security audit
      await page.waitForSelector('[data-testid="security-audit-report"]', { timeout: 10000 });
      
      // Check compliance score is calculated
      const complianceScore = page.locator('[data-testid="compliance-score"]');
      await expect(complianceScore).toBeVisible();
      const score = await complianceScore.textContent();
      expect(score).toMatch(/\d+%/); // Should be a percentage
      
      // Check GDPR/CCPA/HIPAA indicators
      await expect(page.locator('[data-testid="gdpr-compliance"]')).toBeVisible();
      await expect(page.locator('[data-testid="ccpa-compliance"]')).toBeVisible();
      await expect(page.locator('[data-testid="hipaa-compliance"]')).toBeVisible();
    });

    test('Audit report can be downloaded', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Navigate to security audit
      await page.click('text=Security');
      await page.click('text=Run Audit');
      
      // Wait for audit to complete
      await page.waitForSelector('[data-testid="download-audit-report"]');
      
      // Download report
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="download-audit-report"]')
      ]);
      
      expect(download.suggestedFilename()).toMatch(/audit-report.*\.(pdf|csv|json)/);
    });

    test('Audit history is tracked', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Security');
      
      // Check audit history exists
      const auditHistory = page.locator('[data-testid="audit-history"]');
      await expect(auditHistory).toBeVisible();
      
      // Run a new audit
      await page.click('text=Run Audit');
      await page.waitForSelector('[data-testid="audit-complete"]');
      
      // History should update
      const historyItems = page.locator('[data-testid="audit-history-item"]');
      const count = await historyItems.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // TASK-014: Complete platform bridge for Electron
  test.describe('TASK-014: Platform Bridge Electron Support', () => {
    test('File System Access API works in browser', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check if File System Access is available
      const hasFileSystemAccess = await page.evaluate(() => {
        return window.platformBridge.capabilities.hasFileSystemAccess;
      });
      
      // Modern browsers should support it
      if (page.context().browser()?.browserType().name() === 'chromium') {
        expect(hasFileSystemAccess).toBe(true);
      }
    });

    test('Browser file operations do not throw errors', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Test file operations
      const fileOperations = await page.evaluate(async () => {
        const results = {
          readFile: false,
          writeFile: false,
          selectFile: false
        };
        
        try {
          // These should not throw "not available in browser" errors
          if (window.platformBridge.fileSystem) {
            // Test select file (might prompt user)
            try {
              await window.platformBridge.fileSystem.selectFile();
              results.selectFile = true;
            } catch (e: any) {
              // User cancelled is ok
              results.selectFile = !e.message.includes('not available in browser');
            }
          }
        } catch (e) {
          console.error(e);
        }
        
        return results;
      });
      
      // Should not have "not available" errors
      expect(fileOperations.selectFile).toBe(true);
    });

    test('Platform bridge identifies browser correctly', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      const platform = await page.evaluate(() => {
        return window.platformBridge.capabilities.platform;
      });
      
      expect(platform).toBe('browser');
    });
  });

  // TASK-016: Replace mock analytics and insights
  test.describe('TASK-016: Real Analytics Implementation', () => {
    test('Word frequency analysis uses real data', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Upload and analyze a file
      await page.click('text=Upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'reviews.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`review
This product is excellent and amazing!
Terrible experience, very disappointed.
Good quality, would recommend.
Excellent service, amazing support!`)
      });
      
      // Navigate through workflow to results
      await page.click('text=Continue');
      await page.click('text=Skip Transform');
      await page.click('text=Start Analysis');
      
      // Wait for analysis
      await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 30000 });
      
      // Check word frequency
      await page.click('text=Analytics');
      const wordFrequency = page.locator('[data-testid="word-frequency"]');
      await expect(wordFrequency).toBeVisible();
      
      // Should show "excellent" appears 2 times (not mock data)
      await expect(wordFrequency).toContainText('excellent');
      await expect(wordFrequency).toContainText('2');
    });

    test('Sentiment trends show real calculations', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Analytics');
      
      const trendChart = page.locator('[data-testid="sentiment-trend-chart"]');
      await expect(trendChart).toBeVisible();
      
      // Check that data points exist
      const dataPoints = await page.evaluate(() => {
        const chart = document.querySelector('[data-testid="sentiment-trend-chart"]');
        return chart?.querySelectorAll('.data-point').length || 0;
      });
      
      expect(dataPoints).toBeGreaterThan(0);
    });

    test('Analytics can be exported', async ({ page }) => {
      await page.goto('http://localhost:3000');
      await page.click('text=Analytics');
      
      // Export analytics
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-analytics"]')
      ]);
      
      expect(download.suggestedFilename()).toMatch(/analytics.*\.(csv|json|xlsx)/);
    });

    test('Keyword extraction works on real text', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Analyze some text
      await page.fill('[data-testid="text-input"]', 'The customer service was excellent. Product quality exceeded expectations. Highly recommend this amazing product to everyone.');
      await page.click('text=Extract Keywords');
      
      await page.waitForSelector('[data-testid="keywords-result"]');
      const keywords = await page.locator('[data-testid="keyword-item"]').allTextContents();
      
      // Should extract real keywords
      expect(keywords).toContain('customer service');
      expect(keywords).toContain('product quality');
      expect(keywords).toContain('excellent');
    });
  });

  // Integration tests
  test.describe('Overall Dev 4 Integration', () => {
    test('All real-time features work together', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check all components are present
      await expect(page.locator('[data-testid="websocket-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="realtime-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="analytics-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-indicators"]')).toBeVisible();
    });

    test('No mock data in production mode', async ({ page }) => {
      await page.goto('http://localhost:3000');
      
      // Check page source for mock indicators
      const pageContent = await page.content();
      
      // Should not contain mock data indicators
      expect(pageContent).not.toContain('mock-data');
      expect(pageContent).not.toContain('setInterval');
      expect(pageContent).not.toContain('// Mock');
      expect(pageContent).not.toContain('hardcoded');
    });

    test('Performance: Analytics process 100k records under 30s', async ({ page }) => {
      test.slow(); // Mark as slow test
      
      await page.goto('http://localhost:3000');
      
      // Upload large dataset
      const largeData = Array(100000).fill(null).map((_, i) => 
        `review${i},This is review number ${i}. ${i % 3 === 0 ? 'Excellent' : i % 3 === 1 ? 'Good' : 'Bad'} product.`
      ).join('\n');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(`id,review\n${largeData}`)
      });
      
      const startTime = Date.now();
      
      // Process through analytics
      await page.click('text=Analyze');
      await page.waitForSelector('[data-testid="analysis-complete"]', { timeout: 35000 });
      
      const endTime = Date.now();
      const processingTime = (endTime - startTime) / 1000;
      
      expect(processingTime).toBeLessThan(30);
    });
  });
});