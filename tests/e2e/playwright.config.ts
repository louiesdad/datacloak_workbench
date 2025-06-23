import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000, // 60 second timeout for E2E tests
  reporter: [
    ['html', { outputFolder: './test-results/html' }],
    ['json', { outputFile: './test-results/results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    // Browser Mode Testing
    {
      name: 'browser-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      },
      testMatch: /.*\.spec\.ts$/,
    },
    {
      name: 'browser-firefox',
      use: { 
        ...devices['Desktop Firefox'],
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      },
      testMatch: /.*\.spec\.ts$/,
    },
    {
      name: 'browser-webkit',
      use: { 
        ...devices['Desktop Safari'],
        contextOptions: {
          ignoreHTTPSErrors: true,
        }
      },
      testMatch: /.*\.spec\.ts$/,
    },
    
    // Electron Mode Testing (if Electron path is provided)
    ...(process.env.ELECTRON_PATH ? [{
      name: 'electron',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.ELECTRON_PATH,
          args: ['../../packages/electron-shell/dist/main.js']
        }
      },
      testMatch: /.*\.spec\.ts$/,
    }] : []),
    
    // Mobile Browser Testing (optional)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: /01-file-upload\.spec\.ts|02-field-detection\.spec\.ts/, // Subset for mobile
    }
  ],
  webServer: [
    {
      command: 'npm run dev --workspace=packages/backend',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
      timeout: 30000,
    },
    {
      command: 'npm run dev --workspace=packages/web-ui',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      cwd: '../../',
      timeout: 30000,
    },
  ],
  outputDir: './test-results/artifacts',
  
  // Global setup for mock servers
  // globalSetup: require.resolve('./fixtures/global-setup.ts'),
  // globalTeardown: require.resolve('./fixtures/global-teardown.ts'),
});