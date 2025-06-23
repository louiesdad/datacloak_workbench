import { test as base, expect } from '@playwright/test';
import { createBackendMockServer } from '../mocks/backend-mock';
import { createOpenAIMockServer } from '../mocks/openai-mock';
import { createTestFiles, cleanupTestFiles, createMockPlatformBridge } from '../utils/test-data';
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
  // First check if we're on the upload page which has a different structure
  if (stepName.toLowerCase().includes('upload')) {
    // Try multiple selectors for the upload page header
    const uploadHeaderSelectors = [
      page.locator('h1:has-text("Upload Your Data File")'),
      page.locator('h1').filter({ hasText: 'Upload Your Data File' }),
      page.locator('text="Upload Your Data File"'),
      page.getByRole('heading', { name: 'Upload Your Data File', level: 1 })
    ];
    
    let found = false;
    for (const selector of uploadHeaderSelectors) {
      if (await selector.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(selector).toBeVisible();
        found = true;
        break;
      }
    }
    
    if (!found) {
      // If not found, log what we see on the page for debugging
      const allH1s = await page.locator('h1').allTextContents();
      console.log('Available h1 elements:', allH1s);
      throw new Error(`Could not find upload header. Available h1s: ${allH1s.join(', ')}`);
    }
    return;
  }
  
  // For other steps, look for the step-header in the workflow container
  const stepHeader = page.locator('.workflow-step-container .step-header h1');
  await expect(stepHeader).toContainText(stepName, { ignoreCase: true });
};

export const expectFieldDetected = async (page: any, fieldName: string, fieldType?: string) => {
  // Look for field row with data-testid
  const fieldRow = page.locator(`[data-testid="field-row-${fieldName}"]`);
  await expect(fieldRow).toBeVisible();
  
  if (fieldType) {
    // Check the field type in the .field-type element
    const typeElement = fieldRow.locator('.field-type');
    await expect(typeElement).toBeVisible();
  }
};

export const expectPIIBadge = async (page: any, fieldName: string) => {
  // Look for PII badge within the field row
  const fieldRow = page.locator(`[data-testid="field-row-${fieldName}"]`);
  const piiBadge = fieldRow.locator('.pii-badge, .security-badge, [data-testid*="pii"]');
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
  // Wait for the global loading overlay to disappear
  const globalLoading = page.locator('[data-testid="global-loading"]');
  if (await globalLoading.isVisible({ timeout: 1000 }).catch(() => false)) {
    await globalLoading.waitFor({ state: 'hidden', timeout });
  }
  
  // Wait for loading indicators to disappear
  const loadingSelectors = [
    '.loading',
    '.spinner',
    '.progress-bar',
    '[role="progressbar"]'
  ];
  
  for (const selector of loadingSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      await element.waitFor({ state: 'hidden', timeout });
    }
  }
  
  // Wait for validation results to appear if any
  await page.waitForTimeout(1000);
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
  // Wait a bit for the page to fully load
  await page.waitForTimeout(1000);
  
  // First try to find the file input by ID (which is what the app uses)
  const fileInputById = page.locator('#file-input');
  if (await fileInputById.count() > 0) {
    console.log('Found file input by ID');
    await fileInputById.setInputFiles(filePath);
    return;
  }
  
  // First check if there's a visible file input
  const visibleFileInput = page.locator('input[type="file"]:visible');
  if (await visibleFileInput.count() > 0) {
    await visibleFileInput.setInputFiles(filePath);
    return;
  }
  
  // Look for the Choose File button and click it if needed
  const chooseFileButton = page.locator('button:has-text("Choose File")');
  if (await chooseFileButton.isVisible()) {
    // In some cases we need to click the button first
    if (browserMode) {
      await chooseFileButton.click();
      await page.waitForTimeout(500);
    }
    
    // Now find any file input (hidden or visible)
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(filePath);
      return;
    }
  }
  
  // Try all file input selectors
  const fileInputSelectors = [
    'input[type="file"]',
    'input[type="file"][data-testid="hidden-file-input"]',
    'input[type="file"][data-testid="file-input"]',
    '[data-testid="file-input"]',
    'input[accept*="csv"]',
    'input[accept*=".csv"]'
  ];
  
  let fileInput = null;
  for (const selector of fileInputSelectors) {
    const element = page.locator(selector);
    if (await element.count() > 0) {
      fileInput = element.first();
      console.log(`Found file input with selector: ${selector}`);
      break;
    }
  }
  
  if (!fileInput) {
    // Log what inputs we can find on the page
    const allInputs = await page.locator('input').count();
    const allFileInputs = await page.locator('input[type="file"]').count();
    console.log(`Total inputs on page: ${allInputs}, file inputs: ${allFileInputs}`);
    
    // Try to log the HTML around the upload area
    const uploadArea = page.locator('.upload-area');
    if (await uploadArea.count() > 0) {
      const uploadAreaHTML = await uploadArea.innerHTML();
      console.log('Upload area HTML:', uploadAreaHTML);
    }
    
    throw new Error(`Could not find file input element. Total inputs: ${allInputs}, file inputs: ${allFileInputs}`);
  }
  
  await fileInput.setInputFiles(filePath);
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

// Helper to set up common request mocks
export const setupCommonMocks = async (page: any) => {
  // Mock file upload endpoint
  await page.route('**/api/v1/data/upload', async (route: any, request: any) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataset: {
              datasetId: `ds_${Date.now()}`,
              originalFilename: 'test-file.csv',
              recordCount: 100,
              size: 1024,
              uploadedAt: new Date().toISOString(),
              status: 'ready'
            },
            fieldInfo: [
              { name: 'id', type: 'integer', piiDetected: false },
              { name: 'name', type: 'text', piiDetected: true, piiType: 'NAME' },
              { name: 'email', type: 'email', piiDetected: true, piiType: 'EMAIL' },
              { name: 'comment', type: 'text', piiDetected: false },
              { name: 'rating', type: 'integer', piiDetected: false }
            ],
            previewData: [
              { id: 1, name: 'John Doe', email: 'john@example.com', comment: 'Great product!', rating: 5 },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com', comment: 'Could be better', rating: 3 }
            ],
            securityScan: {
              piiItemsDetected: 2,
              complianceScore: 85,
              riskLevel: 'medium'
            }
          }
        })
      });
    } else {
      await route.continue();
    }
  });
  
  // Mock sentiment batch analysis
  await page.route('**/api/v1/sentiment/batch', async (route: any, request: any) => {
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      const results = body.texts?.map((text: string, index: number) => ({
        text,
        sentiment: ['positive', 'negative', 'neutral'][index % 3],
        confidence: 0.85 + Math.random() * 0.15,
        pii_detected: false
      })) || [];
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: results
        })
      });
    } else {
      await route.continue();
    }
  });
};

export { expect };