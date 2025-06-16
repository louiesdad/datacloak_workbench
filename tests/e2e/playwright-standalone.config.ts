import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000, // 30 second timeout for standalone tests
  reporter: [
    ['html', { outputFolder: './test-results/html' }],
    ['json', { outputFile: './test-results/results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['line']
  ],
  use: {
    // No baseURL for standalone tests
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'standalone-verification',
      use: { 
        ...devices['Desktop Chrome'],
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      },
      testMatch: /system-verification-e2e\.spec\.ts$/,
    }
  ],
  // No webServer for standalone tests
  outputDir: './test-results/artifacts',
});