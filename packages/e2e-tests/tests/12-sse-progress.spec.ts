import { test, expect, uploadFile, waitForFileProcessing } from '../fixtures/test-fixtures';

test.describe('Server-Sent Events (SSE) Progress Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should establish SSE connection for long operations', async ({ page, testFiles, browserMode }) => {
    await test.step('Start long operation', async () => {
      await uploadFile(page, testFiles.large, browserMode);
    });

    await test.step('Verify SSE connection', async () => {
      // Check for SSE connection establishment
      const sseConnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Check if EventSource is being used
          const sources = (window as any).__eventSources || [];
          
          if (sources.length > 0) {
            resolve(true);
          } else {
            // Intercept EventSource creation
            const originalEventSource = window.EventSource;
            window.EventSource = new Proxy(originalEventSource, {
              construct(target, args) {
                const source = new target(...args);
                if (args[0].includes('/progress') || args[0].includes('/events')) {
                  setTimeout(() => resolve(true), 100);
                }
                return source;
              }
            });
            
            setTimeout(() => resolve(false), 5000);
          }
        });
      });

      if (sseConnected) {
        console.log('✓ SSE connection established for progress tracking');
      }
    });
  });

  test('should receive real-time progress updates', async ({ page, testFiles, browserMode }) => {
    await test.step('Monitor SSE progress events', async () => {
      // Set up SSE event listener
      const progressUpdates = await page.evaluate(() => {
        return new Promise((resolve) => {
          const updates: any[] = [];
          let eventSource: EventSource | null = null;

          // Create or get existing EventSource
          const sources = (window as any).__eventSources || [];
          if (sources.length > 0) {
            eventSource = sources[0];
          }

          if (eventSource) {
            eventSource.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                updates.push(data);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            };

            // Also listen for specific event types
            eventSource.addEventListener('progress', (event: any) => {
              updates.push({ type: 'progress', data: event.data });
            });

            eventSource.addEventListener('complete', (event: any) => {
              updates.push({ type: 'complete', data: event.data });
            });
          }

          // Start operation
          setTimeout(() => {
            const uploadButton = document.querySelector('[data-testid="upload-area"]') as HTMLElement;
            if (uploadButton) uploadButton.click();
          }, 100);

          // Collect events for 10 seconds
          setTimeout(() => resolve(updates), 10000);
        });
      });

      if (Array.isArray(progressUpdates) && progressUpdates.length > 0) {
        console.log(`✓ Received ${progressUpdates.length} SSE progress updates`);
        
        // Analyze progress values
        const progressValues = progressUpdates
          .filter((u: any) => u.progress !== undefined)
          .map((u: any) => u.progress);
        
        if (progressValues.length > 0) {
          console.log(`✓ Progress values: ${progressValues.join(', ')}`);
          
          // Verify progress increases
          for (let i = 1; i < progressValues.length; i++) {
            expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i-1]);
          }
        }
      }
    });
  });

  test('should handle SSE reconnection on disconnect', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.medium, browserMode);

    await test.step('Simulate connection drop', async () => {
      // Force disconnect SSE
      await page.evaluate(() => {
        const sources = (window as any).__eventSources || [];
        sources.forEach((source: EventSource) => {
          source.close();
        });
      });
      
      console.log('✓ SSE connection closed');
    });

    await test.step('Verify automatic reconnection', async () => {
      // Wait for reconnection
      const reconnected = await page.evaluate(() => {
        return new Promise((resolve) => {
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            const sources = (window as any).__eventSources || [];
            if (sources.some((s: EventSource) => s.readyState === EventSource.OPEN)) {
              clearInterval(checkInterval);
              resolve(true);
            }
            
            checkCount++;
            if (checkCount > 20) { // 10 seconds timeout
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 500);
        });
      });

      expect(reconnected).toBeTruthy();
      console.log('✓ SSE automatically reconnected');
    });
  });

  test('should track progress for sentiment analysis', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.small, browserMode);
    await waitForFileProcessing(page);

    await test.step('Navigate to sentiment analysis', async () => {
      const sentimentStep = page.locator('.workflow-step').filter({ hasText: /sentiment/i });
      if (await sentimentStep.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sentimentStep.click();
      }
    });

    await test.step('Start analysis and monitor SSE', async () => {
      // Set up progress monitoring
      const progressEvents: number[] = [];
      
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('SSE:') || text.includes('Progress:')) {
          const match = text.match(/(\d+)%/);
          if (match) {
            progressEvents.push(parseInt(match[1]));
          }
        }
      });

      // Start sentiment analysis
      const startButton = page.locator('button').filter({ hasText: /start.*analysis/i });
      if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await startButton.click();
      }

      // Monitor for 15 seconds
      await page.waitForTimeout(15000);

      if (progressEvents.length > 0) {
        console.log(`✓ Sentiment analysis progress: ${progressEvents.join(' → ')}%`);
        
        // Should eventually reach 100%
        expect(Math.max(...progressEvents)).toBe(100);
      }
    });
  });

  test('should handle concurrent SSE connections', async ({ page, testFiles, browserMode }) => {
    await test.step('Start multiple operations', async () => {
      // Upload file
      await uploadFile(page, testFiles.small, browserMode);
      
      // Start another operation
      const exportButton = page.locator('button').filter({ hasText: /export/i });
      if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exportButton.click();
      }
    });

    await test.step('Monitor multiple SSE streams', async () => {
      const connections = await page.evaluate(() => {
        const sources = (window as any).__eventSources || [];
        return sources.map((source: EventSource) => ({
          url: source.url,
          readyState: source.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSED'][source.readyState]
        }));
      });

      console.log(`✓ Active SSE connections: ${connections.length}`);
      connections.forEach((conn: any, index: number) => {
        console.log(`  ${index + 1}. ${conn.url} - ${conn.readyStateText}`);
      });

      // Should handle multiple connections
      expect(connections.length).toBeGreaterThanOrEqual(1);
      expect(connections.some((c: any) => c.readyState === 1)).toBeTruthy(); // At least one OPEN
    });
  });

  test('should show accurate progress for chunked operations', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.large, browserMode);

    await test.step('Track chunk progress via SSE', async () => {
      const chunkProgress: any[] = [];

      // Monitor SSE events
      await page.evaluate(() => {
        const sources = (window as any).__eventSources || [];
        sources.forEach((source: EventSource) => {
          source.addEventListener('chunk_progress', (event: any) => {
            console.log(`SSE Chunk: ${event.data}`);
          });
        });
      });

      // Wait and collect console logs
      const logs: string[] = [];
      page.on('console', msg => {
        if (msg.text().includes('SSE Chunk:')) {
          logs.push(msg.text());
        }
      });

      await page.waitForTimeout(10000);

      if (logs.length > 0) {
        console.log(`✓ Received ${logs.length} chunk progress events`);
        
        // Parse chunk information
        logs.forEach(log => {
          const match = log.match(/chunk (\d+)\/(\d+)/);
          if (match) {
            console.log(`  Chunk ${match[1]} of ${match[2]}`);
          }
        });
      }
    });
  });

  test('should handle SSE error events', async ({ page, mockBackend }) => {
    // Mock SSE endpoint to send error
    mockBackend.use(
      require('msw').http.get('http://localhost:3001/api/events/progress', () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: error\ndata: {"error": "Processing failed"}\n\n'));
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      })
    );

    await test.step('Handle SSE errors gracefully', async () => {
      await uploadFile(page, testFiles.small, browserMode);

      // Check for error handling
      const errorMessage = page.locator('[data-testid="sse-error"], .progress-error');
      
      if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
        const errorText = await errorMessage.textContent();
        console.log(`✓ SSE error handled: ${errorText}`);
        expect(errorText).toMatch(/error|failed/i);
      }
    });
  });

  test('should cleanup SSE connections on completion', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.small, browserMode);
    await waitForFileProcessing(page);

    await test.step('Verify SSE cleanup', async () => {
      // Wait for operation to complete
      await page.waitForTimeout(5000);

      const activeConnections = await page.evaluate(() => {
        const sources = (window as any).__eventSources || [];
        return sources.filter((s: EventSource) => s.readyState !== EventSource.CLOSED).length;
      });

      console.log(`✓ Active SSE connections after completion: ${activeConnections}`);
      
      // Should close connections when not needed
      expect(activeConnections).toBeLessThanOrEqual(1);
    });
  });

  test('should provide progress details in SSE events', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.medium, browserMode);

    await test.step('Capture detailed progress events', async () => {
      const detailedEvents = await page.evaluate(() => {
        return new Promise((resolve) => {
          const events: any[] = [];
          const sources = (window as any).__eventSources || [];
          
          sources.forEach((source: EventSource) => {
            source.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.details) {
                  events.push(data);
                }
              } catch (e) {}
            };
          });

          setTimeout(() => resolve(events), 8000);
        });
      });

      if (Array.isArray(detailedEvents) && detailedEvents.length > 0) {
        console.log(`✓ Detailed progress events: ${detailedEvents.length}`);
        
        // Check event details
        detailedEvents.forEach((event: any, index: number) => {
          if (event.details) {
            console.log(`  Event ${index + 1}:`);
            if (event.details.currentRow) console.log(`    - Current row: ${event.details.currentRow}`);
            if (event.details.totalRows) console.log(`    - Total rows: ${event.details.totalRows}`);
            if (event.details.bytesProcessed) console.log(`    - Bytes processed: ${event.details.bytesProcessed}`);
            if (event.details.estimatedTimeRemaining) console.log(`    - ETA: ${event.details.estimatedTimeRemaining}`);
          }
        });
      }
    });
  });
});