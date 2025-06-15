import { test, expect } from '@playwright/test';

test.describe('App Launch', () => {
  test('web UI launches at localhost:5173', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Verify the page loads
    await expect(page).toHaveTitle(/DataCloak Sentiment Workbench/i);
    
    // Check for no console errors on launch
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForLoadState('networkidle');
    expect(consoleErrors.length).toBe(0);
  });

  test('verify all main UI elements present', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Check workflow sidebar
    const workflowSteps = [
      'Upload Data',
      'Data Profile',
      'Transform',
      'Configure',
      'Execute',
      'Results'
    ];
    
    for (const step of workflowSteps) {
      const stepElement = page.locator('.workflow-step, [data-step]').filter({ hasText: step });
      await expect(stepElement).toBeVisible();
    }
    
    // Check main content area
    await expect(page.locator('main, .main-content')).toBeVisible();
    
    // Check header/navigation
    await expect(page.locator('text=/DataCloak Sentiment Workbench/i')).toBeVisible();
    
    // Check initial upload interface
    const uploadArea = page.locator('.drop-zone, [data-testid="drop-zone"], .upload-area');
    await expect(uploadArea.first()).toBeVisible();
  });

  test('check platform bridge initialization', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Check if platform bridge is available (browser mode)
    const hasPlatformBridge = await page.evaluate(() => {
      return typeof window.electronAPI !== 'undefined';
    });
    
    // In browser mode, should not have electronAPI
    expect(hasPlatformBridge).toBe(false);
    
    // Check for platform bridge warning/info
    const platformWarning = page.locator('text=/platform bridge|browser mode/i');
    const warningVisible = await platformWarning.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Should show some indication about browser vs electron mode
    console.log(`Platform mode indication shown: ${warningVisible}`);
  });

  test('verify responsive design on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Check that content fits viewport
    const mainContent = page.locator('main, .main-content').first();
    const contentBox = await mainContent.boundingBox();
    
    expect(contentBox).toBeTruthy();
    expect(contentBox!.width).toBeLessThanOrEqual(390);
    
    // Check workflow navigation is accessible
    const workflowNav = page.locator('.workflow-step').first();
    await expect(workflowNav).toBeVisible();
  });

  test('verify dark mode toggle if available', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Look for theme toggle
    const themeToggle = page.locator('[aria-label*="theme"], [title*="theme"], .theme-toggle');
    const hasThemeToggle = await themeToggle.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasThemeToggle) {
      // Get initial theme
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.body.classList.contains('dark') ? 'dark' : 'light';
      });
      
      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(500);
      
      // Check theme changed
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 
               document.body.classList.contains('dark') ? 'dark' : 'light';
      });
      
      expect(newTheme).not.toBe(initialTheme);
    } else {
      console.log('No theme toggle found - feature may not be implemented');
    }
  });

  test('verify app version display', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Look for version info
    const versionSelectors = [
      '[data-testid="app-version"]',
      '.version',
      'text=/v\\d+\\.\\d+\\.\\d+/i'
    ];
    
    let versionFound = false;
    for (const selector of versionSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        const version = await element.textContent();
        console.log(`App version found: ${version}`);
        versionFound = true;
        break;
      }
    }
    
    // Version display is optional but log if not found
    if (!versionFound) {
      console.log('No version information displayed');
    }
  });

  test('verify initial performance metrics', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // App should load in reasonable time
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
    
    // Check for performance marks if available
    const performanceMetrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
          loadComplete: nav.loadEventEnd - nav.loadEventStart,
          totalTime: nav.loadEventEnd - nav.fetchStart
        };
      }
      return null;
    });
    
    if (performanceMetrics) {
      console.log('Performance metrics:', performanceMetrics);
      expect(performanceMetrics.totalTime).toBeLessThan(3000);
    }
  });
});