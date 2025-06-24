import { test, expect } from '@playwright/test';
import path from 'path';

// Test data files paths
const TEST_DATA_DIR = path.join(__dirname, '../../../test-data');
const USERS_CSV = path.join(TEST_DATA_DIR, 'users.csv');
const ORDERS_CSV = path.join(TEST_DATA_DIR, 'orders.csv');
const KLAVIYO_CSV = path.join(TEST_DATA_DIR, 'klaviyo.csv');
const REVIEWS_CSV = path.join(TEST_DATA_DIR, 'reviews.csv');

test.describe('Multi-File Analysis E2E Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Ensure we're starting fresh
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Complete multi-file analysis workflow - relationship discovery to insights', async ({ page }) => {
    // Step 1: Create Analysis Session
    await test.step('Create new analysis session', async () => {
      await page.click('[data-testid="create-session-button"]');
      
      await page.fill('[data-testid="session-name-input"]', 'Customer Churn Analysis');
      await page.fill('[data-testid="session-description-input"]', 'Analyzing customer behavior patterns across multiple data sources');
      
      await page.click('[data-testid="create-session-submit"]');
      
      // Verify session created
      await expect(page.locator('[data-testid="session-created-success"]')).toBeVisible();
      await expect(page.locator('h1')).toContainText('Customer Churn Analysis');
    });

    // Step 2: Upload Multiple Files
    await test.step('Upload multiple CSV files', async () => {
      // Upload users.csv
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      await expect(page.locator('text=users.csv')).toBeVisible();
      await expect(page.locator('[data-testid="progress-users.csv"]')).toBeVisible();
      
      // Wait for upload completion
      await expect(page.locator('text=rows')).toBeVisible({ timeout: 10000 });
      
      // Upload orders.csv
      await page.setInputFiles('[data-testid="file-input"]', [ORDERS_CSV]);
      await expect(page.locator('text=orders.csv')).toBeVisible();
      
      // Upload klaviyo.csv (marketing data)
      await page.setInputFiles('[data-testid="file-input"]', [KLAVIYO_CSV]);
      await expect(page.locator('text=klaviyo.csv')).toBeVisible();
      
      // Upload reviews.csv (sentiment data)
      await page.setInputFiles('[data-testid="file-input"]', [REVIEWS_CSV]);
      await expect(page.locator('text=reviews.csv')).toBeVisible();
      
      // Verify all files uploaded successfully
      await expect(page.locator('[data-testid="uploaded-files"] .file-item')).toHaveCount(4);
    });

    // Step 3: File Metadata Preview
    await test.step('Review file metadata and potential keys', async () => {
      // Expand users.csv details
      await page.click('text=users.csv >> .. >> button:has-text("Show columns")');
      
      // Verify column information is displayed
      await expect(page.locator('text=customer_id (string)')).toBeVisible();
      await expect(page.locator('text=email (email)')).toBeVisible();
      await expect(page.locator('text=99% unique')).toBeVisible();
      
      // Check potential keys are identified
      await expect(page.locator('text=Potential keys: customer_id, email')).toBeVisible();
      
      // Verify other files show metadata
      await expect(page.locator('text=orders.csv >> .. >> text=rows')).toBeVisible();
      await expect(page.locator('text=klaviyo.csv >> .. >> text=columns')).toBeVisible();
    });

    // Step 4: Discover Relationships
    await test.step('Discover relationships between files', async () => {
      await page.click('[data-testid="discover-relationships-button"]');
      
      // Wait for discovery process
      await expect(page.locator('[data-testid="discovery-progress"]')).toBeVisible();
      await expect(page.locator('text=Analyzing file relationships...')).toBeVisible();
      
      // Wait for completion (may take up to 2 minutes per PRD)
      await expect(page.locator('[data-testid="relationships-graph"]')).toBeVisible({ timeout: 120000 });
      
      // Verify relationships found
      await expect(page.locator('[data-testid="relationship-count"]')).toContainText('relationships found');
      
      // Check specific relationship types
      await expect(page.locator('text=users → orders (customer_id)')).toBeVisible();
      await expect(page.locator('text=users → klaviyo (email)')).toBeVisible();
      await expect(page.locator('text=users → reviews (customer_id)')).toBeVisible();
    });

    // Step 5: Relationship Graph Visualization
    await test.step('Interact with relationship graph', async () => {
      const graph = page.locator('[data-testid="relationship-graph"]');
      
      // Verify graph nodes are rendered
      await expect(graph.locator('[data-testid="node-users"]')).toBeVisible();
      await expect(graph.locator('[data-testid="node-orders"]')).toBeVisible();
      await expect(graph.locator('[data-testid="node-klaviyo"]')).toBeVisible();
      await expect(graph.locator('[data-testid="node-reviews"]')).toBeVisible();
      
      // Test node interaction
      await graph.locator('[data-testid="node-users"]').hover();
      await expect(page.locator('[data-testid="node-tooltip"]')).toContainText('users.csv');
      
      // Test edge interaction
      await graph.locator('[data-testid="edge-users-orders"]').click();
      await expect(page.locator('[data-testid="relationship-details"]')).toBeVisible();
      await expect(page.locator('text=customer_id')).toBeVisible();
      await expect(page.locator('text=ONE_TO_MANY')).toBeVisible();
    });

    // Step 6: Pattern Analysis
    await test.step('Analyze behavioral patterns', async () => {
      await page.click('[data-testid="analyze-patterns-button"]');
      
      // Wait for pattern analysis (up to 5 minutes per PRD)
      await expect(page.locator('[data-testid="pattern-analysis-progress"]')).toBeVisible();
      await expect(page.locator('text=Mining behavioral patterns...')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="patterns-results"]')).toBeVisible({ timeout: 300000 });
      
      // Verify pattern discovery
      await expect(page.locator('[data-testid="patterns-count"]')).toContainText('patterns discovered');
      
      // Check for temporal patterns
      await expect(page.locator('text=Leading Indicators')).toBeVisible();
      await expect(page.locator('text=Correlated Behaviors')).toBeVisible();
    });

    // Step 7: Join Recommendations
    await test.step('Review join recommendations', async () => {
      await page.click('[data-testid="view-recommendations-button"]');
      
      // Verify recommendations are displayed
      await expect(page.locator('[data-testid="join-recommendations"]')).toBeVisible();
      
      // Check recommendation details
      const firstRecommendation = page.locator('[data-testid="recommendation-0"]');
      await expect(firstRecommendation.locator('text=Expected Improvement')).toBeVisible();
      await expect(firstRecommendation.locator('text=Sentiment Coverage')).toBeVisible();
      
      // View sample query
      await firstRecommendation.locator('[data-testid="view-query-button"]').click();
      await expect(page.locator('[data-testid="sample-query-modal"]')).toBeVisible();
      await expect(page.locator('text=WITH joined_data AS')).toBeVisible();
      await expect(page.locator('text=JOIN')).toBeVisible();
      
      await page.locator('[data-testid="close-modal"]').click();
    });

    // Step 8: Generate Insights
    await test.step('Generate natural language insights', async () => {
      await page.click('[data-testid="generate-insights-button"]');
      
      // Wait for insight generation
      await expect(page.locator('[data-testid="insights-progress"]')).toBeVisible();
      await expect(page.locator('text=Generating insights...')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="insights-results"]')).toBeVisible({ timeout: 60000 });
      
      // Verify insight categories
      await expect(page.locator('[data-testid="leading-indicators"]')).toBeVisible();
      await expect(page.locator('[data-testid="data-quality-insights"]')).toBeVisible();
      await expect(page.locator('[data-testid="hidden-segments"]')).toBeVisible();
      
      // Check specific insight content
      await expect(page.locator('text=Email engagement predicts')).toBeVisible();
      await expect(page.locator('text=days before')).toBeVisible();
      await expect(page.locator('text=correlation')).toBeVisible();
    });

    // Step 9: Review Executive Summary
    await test.step('Review executive summary and recommendations', async () => {
      await page.click('[data-testid="executive-summary-tab"]');
      
      // Verify summary sections
      await expect(page.locator('[data-testid="key-findings"]')).toBeVisible();
      await expect(page.locator('[data-testid="recommended-actions"]')).toBeVisible();
      await expect(page.locator('[data-testid="confidence-scores"]')).toBeVisible();
      
      // Check actionable recommendations
      await expect(page.locator('text=Monitor')).toBeVisible();
      await expect(page.locator('text=Set up alerts')).toBeVisible();
      await expect(page.locator('text=Include in predictive models')).toBeVisible();
    });

    // Step 10: Export and Save Results
    await test.step('Export analysis results', async () => {
      // Export insights as PDF
      await page.click('[data-testid="export-dropdown"]');
      await page.click('[data-testid="export-pdf"]');
      
      // Wait for download
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('Customer_Churn_Analysis');
      
      // Export data as CSV
      await page.click('[data-testid="export-dropdown"]');
      await page.click('[data-testid="export-csv"]');
      
      const csvDownload = await page.waitForEvent('download');
      expect(csvDownload.suggestedFilename()).toContain('.csv');
      
      // Save session for later
      await page.click('[data-testid="save-session-button"]');
      await expect(page.locator('text=Session saved successfully')).toBeVisible();
    });
  });

  test('Multi-file upload with validation and error handling', async ({ page }) => {
    await test.step('Create session and test file validation', async () => {
      // Create session
      await page.click('[data-testid="create-session-button"]');
      await page.fill('[data-testid="session-name-input"]', 'File Validation Test');
      await page.click('[data-testid="create-session-submit"]');
      
      // Test invalid file type
      const invalidFile = path.join(__dirname, '../fixtures/document.pdf');
      await page.setInputFiles('[data-testid="file-input"]', [invalidFile]);
      await expect(page.locator('text=Only CSV files are allowed')).toBeVisible();
      
      // Test file size limit (if implemented)
      // This would require a large test file
      
      // Test duplicate file name
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      await expect(page.locator('text=users.csv')).toBeVisible();
      
      // Try to upload same file again
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      await expect(page.locator('text=File users.csv already staged')).toBeVisible();
    });
  });

  test('Real-time progress updates and WebSocket communication', async ({ page }) => {
    await test.step('Test real-time progress for long-running operations', async () => {
      // Create session and upload files
      await page.click('[data-testid="create-session-button"]');
      await page.fill('[data-testid="session-name-input"]', 'Progress Test');
      await page.click('[data-testid="create-session-submit"]');
      
      // Upload multiple files
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV, ORDERS_CSV, KLAVIYO_CSV]);
      
      // Start discovery process
      await page.click('[data-testid="discover-relationships-button"]');
      
      // Monitor progress updates
      const progressBar = page.locator('[data-testid="discovery-progress-bar"]');
      await expect(progressBar).toBeVisible();
      
      // Check that progress updates occur
      let initialProgress = await progressBar.getAttribute('value');
      
      // Wait a bit and check progress changed
      await page.waitForTimeout(5000);
      let updatedProgress = await progressBar.getAttribute('value');
      
      expect(parseInt(updatedProgress || '0')).toBeGreaterThan(parseInt(initialProgress || '0'));
      
      // Check progress messages
      await expect(page.locator('[data-testid="progress-message"]')).toBeVisible();
      await expect(page.locator('text=Analyzing relationships')).toBeVisible();
    });
  });

  test('Session management and persistence', async ({ page }) => {
    let sessionId: string;

    await test.step('Create and save session', async () => {
      // Create session
      await page.click('[data-testid="create-session-button"]');
      await page.fill('[data-testid="session-name-input"]', 'Persistence Test');
      await page.fill('[data-testid="session-description-input"]', 'Testing session persistence');
      await page.click('[data-testid="create-session-submit"]');
      
      // Get session ID
      sessionId = await page.locator('[data-testid="session-id"]').textContent() || '';
      expect(sessionId).toBeTruthy();
      
      // Upload a file
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      await expect(page.locator('text=users.csv')).toBeVisible();
      
      // Save session
      await page.click('[data-testid="save-session-button"]');
      await expect(page.locator('text=Session saved')).toBeVisible();
    });

    await test.step('Navigate away and return to session', async () => {
      // Navigate to sessions list
      await page.click('[data-testid="sessions-list-link"]');
      
      // Find our session
      await expect(page.locator(`text=Persistence Test`)).toBeVisible();
      
      // Click to reopen session
      await page.click(`[data-testid="session-${sessionId}"]`);
      
      // Verify session state restored
      await expect(page.locator('h1')).toContainText('Persistence Test');
      await expect(page.locator('text=Testing session persistence')).toBeVisible();
      await expect(page.locator('text=users.csv')).toBeVisible();
    });
  });

  test('Performance benchmarks and monitoring', async ({ page }) => {
    await test.step('Monitor performance metrics during analysis', async () => {
      // Create session
      await page.click('[data-testid="create-session-button"]');
      await page.fill('[data-testid="session-name-input"]', 'Performance Test');
      await page.click('[data-testid="create-session-submit"]');
      
      // Record start time
      const startTime = Date.now();
      
      // Upload multiple files quickly
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV, ORDERS_CSV, KLAVIYO_CSV, REVIEWS_CSV]);
      
      // Wait for all uploads to complete
      await expect(page.locator('[data-testid="uploaded-files"] .file-item')).toHaveCount(4, { timeout: 30000 });
      
      const uploadTime = Date.now() - startTime;
      
      // Per PRD: File staging should be <30 seconds per 1GB file
      // Our test files are small, so should be much faster
      expect(uploadTime).toBeLessThan(30000); // 30 seconds
      
      // Start relationship discovery
      const discoveryStartTime = Date.now();
      await page.click('[data-testid="discover-relationships-button"]');
      
      // Wait for discovery completion
      await expect(page.locator('[data-testid="relationships-graph"]')).toBeVisible({ timeout: 120000 });
      
      const discoveryTime = Date.now() - discoveryStartTime;
      
      // Per PRD: Relationship discovery should be <2 minutes for 10 files
      // With 4 files, should be faster
      expect(discoveryTime).toBeLessThan(120000); // 2 minutes
    });
  });

  test('Error recovery and resilience', async ({ page }) => {
    await test.step('Test error handling and recovery scenarios', async () => {
      // Create session
      await page.click('[data-testid="create-session-button"]');
      await page.fill('[data-testid="session-name-input"]', 'Error Recovery Test');
      await page.click('[data-testid="create-session-submit"]');
      
      // Mock network failure during upload
      await page.route('**/api/v3/sessions/*/files', route => {
        route.abort('failed');
      });
      
      // Try to upload file
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      
      // Should show error message
      await expect(page.locator('text=Failed to upload')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Restore network and retry
      await page.unroute('**/api/v3/sessions/*/files');
      await page.click('[data-testid="retry-button"]');
      
      // Should succeed now
      await expect(page.locator('text=users.csv')).toBeVisible();
      await expect(page.locator('text=rows')).toBeVisible();
    });
  });

  test('Responsive design across different screen sizes', async ({ page }) => {
    await test.step('Test mobile responsiveness', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Navigate and create session
      await page.click('[data-testid="mobile-menu-button"]');
      await page.click('[data-testid="create-session-button"]');
      
      // Mobile form should be properly sized
      await expect(page.locator('[data-testid="session-name-input"]')).toBeVisible();
      
      await page.fill('[data-testid="session-name-input"]', 'Mobile Test');
      await page.click('[data-testid="create-session-submit"]');
      
      // Upload should work on mobile
      await page.setInputFiles('[data-testid="file-input"]', [USERS_CSV]);
      await expect(page.locator('text=users.csv')).toBeVisible();
    });

    await test.step('Test tablet responsiveness', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Relationship graph should adapt
      await page.setInputFiles('[data-testid="file-input"]', [ORDERS_CSV]);
      await page.click('[data-testid="discover-relationships-button"]');
      
      await expect(page.locator('[data-testid="relationships-graph"]')).toBeVisible();
      
      // Graph should be responsive
      const graph = page.locator('[data-testid="relationships-graph"]');
      const graphBox = await graph.boundingBox();
      expect(graphBox?.width).toBeLessThanOrEqual(768);
    });
  });
});