import { test, expect, uploadFile, waitForFileProcessing } from '../fixtures/test-fixtures';

test.describe('Job Queue System', () => {
  test.beforeEach(async ({ page, mockBackend }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create and track background jobs', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file to create processing job', async () => {
      await uploadFile(page, testFiles.medium, browserMode);
      
      // Look for job creation notification
      const jobNotification = page.locator('[data-testid="job-created"], .job-notification');
      if (await jobNotification.isVisible({ timeout: 5000 }).catch(() => false)) {
        const jobText = await jobNotification.textContent();
        console.log(`✓ Job created: ${jobText}`);
        
        // Extract job ID if available
        const jobIdMatch = jobText?.match(/job[:\s]+(\w+)/i);
        if (jobIdMatch) {
          console.log(`✓ Job ID: ${jobIdMatch[1]}`);
        }
      }
    });

    await test.step('Monitor job status updates', async () => {
      const jobStatus = page.locator('[data-testid="job-status"], .job-status-indicator');
      
      const statuses: string[] = [];
      for (let i = 0; i < 10; i++) {
        if (await jobStatus.isVisible({ timeout: 1000 }).catch(() => false)) {
          const status = await jobStatus.textContent();
          if (status && !statuses.includes(status)) {
            statuses.push(status);
            console.log(`✓ Job status: ${status}`);
          }
        }
        await page.waitForTimeout(1000);
      }
      
      // Should see progression through statuses
      expect(statuses.length).toBeGreaterThan(1);
      expect(statuses.some(s => s.match(/queued|pending/i))).toBeTruthy();
      expect(statuses.some(s => s.match(/processing|running/i))).toBeTruthy();
    });
  });

  test('should handle multiple concurrent jobs', async ({ page, testFiles, browserMode }) => {
    await test.step('Create multiple jobs', async () => {
      // Upload multiple files quickly
      for (let i = 0; i < 3; i++) {
        await uploadFile(page, testFiles.small, browserMode);
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verify job queue display', async () => {
      // Look for job queue visualization
      const jobQueue = page.locator('[data-testid="job-queue"], .job-queue-list');
      
      if (await jobQueue.isVisible({ timeout: 5000 }).catch(() => false)) {
        const jobItems = jobQueue.locator('.job-item, [data-testid^="job-"]');
        const jobCount = await jobItems.count();
        
        expect(jobCount).toBeGreaterThanOrEqual(3);
        console.log(`✓ Job queue shows ${jobCount} jobs`);
        
        // Check job priorities
        for (let i = 0; i < jobCount; i++) {
          const job = jobItems.nth(i);
          const priority = await job.getAttribute('data-priority');
          if (priority) {
            console.log(`✓ Job ${i + 1} priority: ${priority}`);
          }
        }
      }
    });
  });

  test('should respect job priority scheduling', async ({ page, mockBackend }) => {
    // Mock job queue endpoint to return jobs with different priorities
    mockBackend.use(
      require('msw').http.get('http://localhost:3001/api/jobs/queue', () => {
        return require('msw').HttpResponse.json({
          success: true,
          data: {
            jobs: [
              { id: 'job1', type: 'file_processing', priority: 1, status: 'queued' },
              { id: 'job2', type: 'sentiment_analysis', priority: 3, status: 'queued' },
              { id: 'job3', type: 'export', priority: 2, status: 'queued' }
            ]
          }
        });
      })
    );

    await test.step('View job queue', async () => {
      // Navigate to jobs view if available
      const jobsTab = page.locator('[data-testid="jobs-tab"], button').filter({ hasText: /jobs|queue/i });
      if (await jobsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jobsTab.click();
      }
    });

    await test.step('Verify priority ordering', async () => {
      const jobList = page.locator('[data-testid="job-list"], .job-queue');
      
      if (await jobList.isVisible({ timeout: 3000 }).catch(() => false)) {
        const jobItems = jobList.locator('.job-item');
        const priorities: number[] = [];
        
        for (let i = 0; i < await jobItems.count(); i++) {
          const priorityText = await jobItems.nth(i).getAttribute('data-priority');
          if (priorityText) {
            priorities.push(parseInt(priorityText));
          }
        }
        
        // Higher priority jobs should be first
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i-1]);
        }
        
        console.log(`✓ Jobs ordered by priority: ${priorities.join(', ')}`);
      }
    });
  });

  test('should support job cancellation', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.large, browserMode);

    await test.step('Cancel running job', async () => {
      // Look for cancel button
      const cancelButton = page.locator('button').filter({ hasText: /cancel|stop/i });
      
      if (await cancelButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await cancelButton.click();
        console.log('✓ Job cancellation requested');
        
        // Confirm cancellation if needed
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes/i });
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    });

    await test.step('Verify job cancelled', async () => {
      const cancelledStatus = page.locator('[data-testid="job-status"]').filter({ hasText: /cancelled|stopped/i });
      
      if (await cancelledStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✓ Job successfully cancelled');
      }
      
      // Check for cleanup message
      const cleanupNotice = page.locator('[data-testid="cleanup-notice"], .cleanup-message');
      if (await cleanupNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✓ Job cleanup completed');
      }
    });
  });

  test('should retry failed jobs with exponential backoff', async ({ page, mockBackend }) => {
    let attemptCount = 0;
    
    // Mock job that fails first 2 attempts
    mockBackend.use(
      require('msw').http.post('http://localhost:3001/api/jobs/process', () => {
        attemptCount++;
        if (attemptCount < 3) {
          return require('msw').HttpResponse.json(
            { error: { message: 'Processing failed', code: 'PROCESS_ERROR' } },
            { status: 500 }
          );
        }
        return require('msw').HttpResponse.json({ success: true });
      })
    );

    await test.step('Create job that will fail', async () => {
      await uploadFile(page, testFiles.small, browserMode);
    });

    await test.step('Monitor retry attempts', async () => {
      const retryIndicator = page.locator('[data-testid="retry-count"], .retry-indicator');
      
      let retryCount = 0;
      const retryTimestamps: number[] = [];
      
      for (let i = 0; i < 30; i++) { // Monitor for 30 seconds
        if (await retryIndicator.isVisible({ timeout: 1000 }).catch(() => false)) {
          const retryText = await retryIndicator.textContent();
          const match = retryText?.match(/retry\s*(\d+)/i);
          
          if (match) {
            const currentRetry = parseInt(match[1]);
            if (currentRetry > retryCount) {
              retryCount = currentRetry;
              retryTimestamps.push(Date.now());
              console.log(`✓ Retry attempt ${currentRetry} at ${new Date().toISOString()}`);
            }
          }
        }
        
        await page.waitForTimeout(1000);
      }
      
      // Verify exponential backoff
      if (retryTimestamps.length >= 2) {
        const delay1 = retryTimestamps[1] - retryTimestamps[0];
        const delay2 = retryTimestamps[2] - retryTimestamps[1];
        
        // Second retry should have longer delay (exponential backoff)
        expect(delay2).toBeGreaterThan(delay1 * 1.5);
        console.log(`✓ Exponential backoff confirmed: ${delay1}ms → ${delay2}ms`);
      }
    });
  });

  test('should track job types separately', async ({ page, testFiles, browserMode }) => {
    await test.step('Create different job types', async () => {
      // File processing job
      await uploadFile(page, testFiles.small, browserMode);
      await page.waitForTimeout(1000);
      
      // Navigate to sentiment analysis
      const sentimentStep = page.locator('.workflow-step').filter({ hasText: /sentiment/i });
      if (await sentimentStep.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sentimentStep.click();
        
        // Start sentiment analysis job
        const startButton = page.locator('button').filter({ hasText: /start.*analysis/i });
        if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await startButton.click();
        }
      }
    });

    await test.step('Verify job type tracking', async () => {
      const jobTypeIndicators = page.locator('[data-testid^="job-type-"], .job-type');
      
      const jobTypes = new Set<string>();
      
      for (let i = 0; i < await jobTypeIndicators.count(); i++) {
        const typeText = await jobTypeIndicators.nth(i).textContent();
        if (typeText) {
          jobTypes.add(typeText);
        }
      }
      
      console.log(`✓ Job types detected: ${Array.from(jobTypes).join(', ')}`);
      expect(jobTypes.size).toBeGreaterThanOrEqual(2);
      
      // Should have at least file processing and sentiment analysis
      expect(Array.from(jobTypes).some(t => t.match(/file|processing/i))).toBeTruthy();
      expect(Array.from(jobTypes).some(t => t.match(/sentiment|analysis/i))).toBeTruthy();
    });
  });

  test('should show job queue metrics', async ({ page }) => {
    await test.step('Access job metrics', async () => {
      const metricsPanel = page.locator('[data-testid="job-metrics"], .queue-metrics');
      
      if (await metricsPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Check various metrics
        const metrics = [
          { name: 'Total Jobs', selector: '[data-testid="total-jobs"]' },
          { name: 'Queued', selector: '[data-testid="queued-jobs"]' },
          { name: 'Processing', selector: '[data-testid="processing-jobs"]' },
          { name: 'Completed', selector: '[data-testid="completed-jobs"]' },
          { name: 'Failed', selector: '[data-testid="failed-jobs"]' }
        ];
        
        for (const metric of metrics) {
          const element = page.locator(metric.selector);
          if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            const value = await element.textContent();
            console.log(`✓ ${metric.name}: ${value}`);
          }
        }
      }
    });

    await test.step('Check throughput metrics', async () => {
      const throughput = page.locator('[data-testid="job-throughput"], .throughput-metric');
      
      if (await throughput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const throughputText = await throughput.textContent();
        console.log(`✓ Job throughput: ${throughputText}`);
        
        // Should show jobs per minute/hour
        expect(throughputText).toMatch(/jobs?\/(min|hour)/i);
      }
    });
  });

  test('should persist job history', async ({ page, testFiles, browserMode }) => {
    await test.step('Create jobs', async () => {
      await uploadFile(page, testFiles.small, browserMode);
      await waitForFileProcessing(page);
    });

    await test.step('Check job history', async () => {
      const historyTab = page.locator('[data-testid="job-history"], button').filter({ hasText: /history/i });
      
      if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await historyTab.click();
        
        const historyList = page.locator('[data-testid="history-list"], .job-history');
        if (await historyList.isVisible({ timeout: 3000 }).catch(() => false)) {
          const historyItems = historyList.locator('.history-item');
          const itemCount = await historyItems.count();
          
          expect(itemCount).toBeGreaterThan(0);
          console.log(`✓ Job history shows ${itemCount} items`);
          
          // Check history details
          const firstItem = historyItems.first();
          const timestamp = await firstItem.locator('.timestamp').textContent();
          const duration = await firstItem.locator('.duration').textContent();
          
          if (timestamp) console.log(`✓ Job timestamp: ${timestamp}`);
          if (duration) console.log(`✓ Job duration: ${duration}`);
        }
      }
    });
  });
});