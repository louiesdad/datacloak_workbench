import { test as base, expect } from '@playwright/test';
import { createBackendMockServer } from '../helpers/mock-api-server';
import { createOpenAIMockServer } from '../helpers/openai-mock';
import { createTestFiles, cleanupTestFiles, createMockPlatformBridge } from '../helpers/test-data-generator';
import type { MockedRequest } from 'msw';

export interface TestFixtures {
  mockBackend: ReturnType<typeof createBackendMockServer>;
  mockOpenAI: ReturnType<typeof createOpenAIMockServer>;
  testFiles: Awaited<ReturnType<typeof createTestFiles>>;
  testDataDir: string;
  browserMode: boolean;
  electronMode: boolean;
  platformBridge: ReturnType<typeof createMockPlatformBridge>;
  apiRequests: MockedRequest[];
}

export const test = base.extend<TestFixtures>({
  // Mock servers
  mockBackend: async ({}, use) => {
    const server = createBackendMockServer();
    server.listen({ onUnhandledRequest: 'warn' });
    await use(server);
    server.close();
  },

  mockOpenAI: async ({}, use) => {
    const server = createOpenAIMockServer();
    server.listen({ onUnhandledRequest: 'warn' });
    await use(server);
    server.close();
  },

  // Test data directory
  testDataDir: async ({}, use) => {
    const testDir = `/tmp/e2e-test-data-${Date.now()}`;
    await use(testDir);
    await cleanupTestFiles(testDir);
  },

  // Test files
  testFiles: async ({ testDataDir }, use) => {
    const files = await createTestFiles(testDataDir);
    await use(files);
  },

  // Browser mode detection
  browserMode: async ({ page }, use) => {
    const isBrowser = !process.env.ELECTRON_PATH;
    await use(isBrowser);
  },

  // Electron mode detection
  electronMode: async ({ browserMode }, use) => {
    await use(!browserMode);
  },

  // Platform bridge mock for browser testing
  platformBridge: async ({ page, browserMode }, use) => {
    if (browserMode) {
      const mockBridge = createMockPlatformBridge();
      
      // Inject the mock platform bridge into the page
      await page.addInitScript((bridge) => {
        (window as any).platformBridge = bridge;
      }, mockBridge);
      
      await use(mockBridge);
    } else {
      // In Electron mode, use the real platform bridge
      await use({} as any);
    }
  },

  // API request tracking
  apiRequests: async ({ page }, use) => {
    const requests: MockedRequest[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/') || request.url().includes('openai.com')) {
        requests.push(request as any);
      }
    });
    
    await use(requests);
  }
});

// Custom assertions for E2E tests
export const expectWorkflowStep = async (page: any, stepName: string) => {
  const activeStep = page.locator('.workflow-step.active, .step.active, [data-step].active');
  await expect(activeStep).toContainText(stepName, { ignoreCase: true });
};

export const expectFieldDetected = async (page: any, fieldName: string, fieldType?: string) => {
  const fieldElement = page.locator(`[data-testid="field-${fieldName}"], .field`).filter({ hasText: fieldName });
  await expect(fieldElement).toBeVisible();
  
  if (fieldType) {
    await expect(fieldElement).toContainText(fieldType, { ignoreCase: true });
  }
};

export const expectPIIBadge = async (page: any, fieldName: string) => {
  const piiBadge = page.locator(`[data-testid="pii-badge-${fieldName}"], .pii-badge, .badge-pii`).filter({ hasText: fieldName });
  await expect(piiBadge).toBeVisible();
};

export const expectSentimentResult = async (page: any, sentiment: 'positive' | 'negative' | 'neutral', count?: number) => {
  const sentimentElement = page.locator(`[data-testid="sentiment-${sentiment}"], .sentiment-${sentiment}`);
  await expect(sentimentElement).toBeVisible();
  
  if (count !== undefined) {
    await expect(sentimentElement).toContainText(count.toString());
  }
};

export const expectExportFormat = async (page: any, format: 'csv' | 'xlsx' | 'json') => {
  const exportButton = page.locator(`[data-testid="export-${format}"], button`).filter({ hasText: format.toUpperCase() });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toBeEnabled();
};

export const waitForFileProcessing = async (page: any, timeout = 30000) => {
  // Wait for loading indicators to disappear
  const loadingSelectors = [
    '.loading',
    '.spinner',
    '[data-testid="loading"]',
    '.progress-bar',
    '[role="progressbar"]'
  ];
  
  for (const selector of loadingSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      await element.waitFor({ state: 'hidden', timeout });
    }
  }
  
  // Wait for any "processing" text to disappear (but not the subtitle)
  const processingText = page.locator('text=/^Processing|Analyzing|Loading/');
  if (await processingText.isVisible({ timeout: 1000 }).catch(() => false)) {
    await processingText.waitFor({ state: 'hidden', timeout });
  }
};

export const waitForJobCompletion = async (page: any, timeout = 60000) => {
  // Wait for job status to show "completed"
  const completedStatus = page.locator('text=/completed|finished|done/i');
  await expect(completedStatus).toBeVisible({ timeout });
  
  // Also wait for any progress bars to reach 100%
  const progressBar = page.locator('[role="progressbar"], .progress-bar');
  if (await progressBar.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(progressBar).toHaveAttribute('aria-valuenow', '100', { timeout });
  }
};

export const uploadFile = async (page: any, filePath: string, browserMode: boolean) => {
  if (browserMode) {
    // Use the hidden file input for browser mode
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles(filePath);
  } else {
    // For Electron mode, use the browse files button
    const browseButton = page.getByRole('button', { name: /browse files/i });
    await browseButton.click();
    
    // Handle the native file dialog (this would need to be mocked in real Electron tests)
    await page.locator('input[type="file"]').setInputFiles(filePath);
  }
};

export const mockFileUploadResponse = (mockBackend: any, fileData: any) => {
  // Add custom response for specific file
  mockBackend.use(
    require('msw').http.post('http://localhost:3001/api/upload', () => {
      return require('msw').HttpResponse.json({
        success: true,
        data: {
          fileId: `test_${Date.now()}`,
          fileName: fileData.name,
          fileSize: fileData.size,
          uploadedAt: new Date().toISOString()
        }
      });
    })
  );
};

export { expect };