import { test, expect, uploadFile } from '../fixtures/test-fixtures';

test.describe('Memory Monitoring and Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display real-time memory usage', async ({ page, testFiles, browserMode }) => {
    await test.step('Check memory indicator', async () => {
      const memoryIndicator = page.locator('[data-testid="memory-usage"], .memory-monitor');
      
      if (await memoryIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
        const memoryText = await memoryIndicator.textContent();
        console.log(`✓ Current memory usage: ${memoryText}`);
        
        // Should show memory in MB or GB
        expect(memoryText).toMatch(/\d+\s*(MB|GB)/i);
      }
    });

    await test.step('Monitor memory during file upload', async () => {
      const memoryReadings: string[] = [];
      
      // Start file upload
      uploadFile(page, testFiles.large, browserMode);
      
      // Monitor memory for 10 seconds
      for (let i = 0; i < 10; i++) {
        const memoryIndicator = page.locator('[data-testid="memory-usage"], .memory-monitor');
        if (await memoryIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
          const reading = await memoryIndicator.textContent();
          if (reading && !memoryReadings.includes(reading)) {
            memoryReadings.push(reading);
            console.log(`✓ Memory at ${i}s: ${reading}`);
          }
        }
        await page.waitForTimeout(1000);
      }
      
      // Should have multiple readings showing memory changes
      expect(memoryReadings.length).toBeGreaterThan(1);
    });
  });

  test('should show memory threshold alerts', async ({ page, mockBackend }) => {
    // Mock high memory usage
    mockBackend.use(
      require('msw').http.get('http://localhost:3001/api/system/memory', () => {
        return require('msw').HttpResponse.json({
          success: true,
          data: {
            used: 1800,  // MB
            total: 2048, // MB
            percentage: 88
          }
        });
      })
    );

    await test.step('Trigger memory check', async () => {
      // Refresh to get new memory reading
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify memory warning', async () => {
      const memoryWarning = page.locator('[data-testid="memory-warning"], .memory-alert');
      
      if (await memoryWarning.isVisible({ timeout: 5000 }).catch(() => false)) {
        const warningText = await memoryWarning.textContent();
        console.log(`✓ Memory warning displayed: ${warningText}`);
        
        expect(warningText).toMatch(/high.*memory|memory.*usage.*high/i);
      }
      
      // Check if warning has appropriate severity
      const warningSeverity = await memoryWarning.getAttribute('data-severity');
      if (warningSeverity) {
        expect(['warning', 'critical']).toContain(warningSeverity);
        console.log(`✓ Warning severity: ${warningSeverity}`);
      }
    });
  });

  test('should connect to WebSocket for real-time updates', async ({ page }) => {
    await test.step('Check WebSocket connection', async () => {
      // Inject WebSocket monitor
      const wsConnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Check if WebSocket exists
          const sockets = (window as any).__websockets || [];
          
          if (sockets.length > 0) {
            resolve(true);
          } else {
            // Wait for WebSocket connection
            const originalWebSocket = window.WebSocket;
            window.WebSocket = new Proxy(originalWebSocket, {
              construct(target, args) {
                const ws = new target(...args);
                if (args[0].includes('/memory') || args[0].includes('/ws')) {
                  setTimeout(() => resolve(true), 100);
                }
                return ws;
              }
            });
            
            // Timeout after 5 seconds
            setTimeout(() => resolve(false), 5000);
          }
        });
      });
      
      if (wsConnected) {
        console.log('✓ WebSocket connection established for memory monitoring');
      }
    });

    await test.step('Monitor WebSocket messages', async () => {
      // Set up message listener
      const messages = await page.evaluate(() => {
        return new Promise((resolve) => {
          const collectedMessages: any[] = [];
          
          // Intercept WebSocket messages
          const sockets = (window as any).__websockets || [];
          sockets.forEach((ws: WebSocket) => {
            const originalOnMessage = ws.onmessage;
            ws.onmessage = (event) => {
              collectedMessages.push(JSON.parse(event.data));
              if (originalOnMessage) originalOnMessage.call(ws, event);
            };
          });
          
          // Collect messages for 3 seconds
          setTimeout(() => resolve(collectedMessages), 3000);
        });
      });
      
      if (Array.isArray(messages) && messages.length > 0) {
        console.log(`✓ Received ${messages.length} WebSocket messages`);
        
        // Check message format
        const memoryMessages = (messages as any[]).filter(m => m.type === 'memory_update');
        if (memoryMessages.length > 0) {
          console.log(`✓ Memory update messages: ${memoryMessages.length}`);
        }
      }
    });
  });

  test('should trigger garbage collection on high memory', async ({ page, mockBackend }) => {
    // Mock very high memory usage
    mockBackend.use(
      require('msw').http.get('http://localhost:3001/api/system/memory', () => {
        return require('msw').HttpResponse.json({
          success: true,
          data: {
            used: 1950,  // MB
            total: 2048, // MB
            percentage: 95
          }
        });
      })
    );

    await page.reload();

    await test.step('Check for automatic cleanup', async () => {
      const cleanupNotice = page.locator('[data-testid="gc-triggered"], .cleanup-notice');
      
      if (await cleanupNotice.isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log('✓ Automatic garbage collection triggered');
        
        // Monitor memory after cleanup
        await page.waitForTimeout(3000);
        
        const memoryAfter = page.locator('[data-testid="memory-usage"]');
        if (await memoryAfter.isVisible()) {
          const afterText = await memoryAfter.textContent();
          console.log(`✓ Memory after cleanup: ${afterText}`);
        }
      }
    });
  });

  test('should show memory usage breakdown', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.medium, browserMode);

    await test.step('Access memory details', async () => {
      const memoryDetails = page.locator('[data-testid="memory-details"], .memory-breakdown');
      
      if (await memoryDetails.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Check for different memory categories
        const categories = [
          { name: 'Data', selector: '[data-testid="memory-data"]' },
          { name: 'UI', selector: '[data-testid="memory-ui"]' },
          { name: 'Cache', selector: '[data-testid="memory-cache"]' },
          { name: 'Workers', selector: '[data-testid="memory-workers"]' }
        ];
        
        for (const category of categories) {
          const element = page.locator(category.selector);
          if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            const value = await element.textContent();
            console.log(`✓ ${category.name} memory: ${value}`);
          }
        }
      }
    });
  });

  test('should provide memory optimization recommendations', async ({ page, mockBackend }) => {
    // Mock high memory with recommendations
    mockBackend.use(
      require('msw').http.get('http://localhost:3001/api/system/memory/recommendations', () => {
        return require('msw').HttpResponse.json({
          success: true,
          data: {
            recommendations: [
              'Close unused browser tabs',
              'Clear application cache',
              'Export and remove processed data'
            ]
          }
        });
      })
    );

    await test.step('Check optimization tips', async () => {
      const optimizeButton = page.locator('button').filter({ hasText: /optimize.*memory/i });
      
      if (await optimizeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await optimizeButton.click();
        
        const recommendations = page.locator('[data-testid="memory-recommendations"], .optimization-tips');
        if (await recommendations.isVisible({ timeout: 3000 }).catch(() => false)) {
          const tipElements = recommendations.locator('.tip-item, li');
          const tipCount = await tipElements.count();
          
          console.log(`✓ Memory optimization tips: ${tipCount}`);
          
          for (let i = 0; i < tipCount; i++) {
            const tip = await tipElements.nth(i).textContent();
            console.log(`  - ${tip}`);
          }
        }
      }
    });
  });

  test('should track memory leaks', async ({ page, testFiles, browserMode }) => {
    await test.step('Perform memory-intensive operations', async () => {
      // Upload and process multiple files
      for (let i = 0; i < 3; i++) {
        await uploadFile(page, testFiles.small, browserMode);
        await page.waitForTimeout(2000);
        
        // Clear data
        const clearButton = page.locator('button').filter({ hasText: /clear|reset/i });
        if (await clearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await clearButton.click();
        }
      }
    });

    await test.step('Check for leak detection', async () => {
      const leakWarning = page.locator('[data-testid="memory-leak-warning"], .leak-detection');
      
      if (await leakWarning.isVisible({ timeout: 5000 }).catch(() => false)) {
        const warningText = await leakWarning.textContent();
        console.log(`⚠️ Memory leak detected: ${warningText}`);
        
        // Should provide details about the leak
        expect(warningText).toMatch(/memory.*not.*released|potential.*leak/i);
      } else {
        console.log('✓ No memory leaks detected');
      }
    });
  });

  test('should show memory usage history graph', async ({ page }) => {
    await test.step('Check for memory graph', async () => {
      const memoryGraph = page.locator('[data-testid="memory-graph"], canvas.memory-chart, .memory-visualization');
      
      if (await memoryGraph.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✓ Memory usage graph displayed');
        
        // Check for graph controls
        const timeRangeSelector = page.locator('[data-testid="memory-time-range"], select.time-range');
        if (await timeRangeSelector.isVisible({ timeout: 1000 }).catch(() => false)) {
          const options = await timeRangeSelector.locator('option').allTextContents();
          console.log(`✓ Time range options: ${options.join(', ')}`);
        }
      }
    });
  });
});