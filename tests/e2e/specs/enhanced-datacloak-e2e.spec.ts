import { test, expect } from '@playwright/test';

/**
 * Enhanced DataCloak E2E Test Suite
 * Tests the complete enhanced DataCloak system including:
 * - Compliance framework selection
 * - Risk assessment functionality
 * - Advanced configuration
 * - Real-time monitoring
 * - File processing with enhanced features
 */

// Test data and configuration
const TEST_DATA = {
  csvWithPII: `name,email,phone,ssn,credit_card,medical_id
John Doe,john.doe@email.com,555-123-4567,123-45-6789,4532015112830366,MRN123456
Jane Smith,jane.smith@company.com,555-987-6543,987-65-4321,4556737586899855,MRN789012
Bob Johnson,bob.j@test.org,555-555-5555,111-22-3333,4000000000000002,MRN345678`,
  
  complianceFrameworks: ['HIPAA', 'PCI_DSS', 'GDPR', 'GENERAL'],
  
  riskThresholds: {
    low: 0,
    medium: 40,
    high: 60,
    critical: 80
  }
};

test.describe('Enhanced DataCloak E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the app to be ready
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible({ timeout: 10000 });
  });

  test('Complete Enhanced DataCloak Workflow - HIPAA Compliance', async ({ page }) => {
    console.log('🏥 Testing HIPAA Compliance Workflow');
    
    // Step 1: Select HIPAA Compliance Framework
    await test.step('Select HIPAA compliance framework', async () => {
      // Look for compliance selector or navigate to it
      const complianceSelector = page.locator('[data-testid="compliance-selector"]');
      if (await complianceSelector.isVisible()) {
        await complianceSelector.click();
      } else {
        // Navigate to compliance selection page
        await page.click('[data-testid="compliance-setup"]');
      }
      
      // Select HIPAA framework
      await page.click('[data-testid="framework-hipaa"]');
      await expect(page.locator('.selected-framework')).toContainText('HIPAA');
      
      await page.screenshot({ path: 'test-results/enhanced-01-hipaa-selected.png' });
    });

    // Step 2: Upload file with medical PII data
    await test.step('Upload file with medical PII', async () => {
      // Create test file with medical data
      const fileContent = TEST_DATA.csvWithPII;
      
      // Navigate to file upload if not already there
      const uploadArea = page.locator('[data-testid="upload-area"]');
      if (!(await uploadArea.isVisible())) {
        await page.click('[data-testid="upload-data"]');
      }
      
      // Upload the file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'medical-records.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(fileContent)
      });
      
      // Wait for upload to complete
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 15000 });
      
      await page.screenshot({ path: 'test-results/enhanced-02-medical-file-uploaded.png' });
    });

    // Step 3: Verify enhanced PII detection
    await test.step('Verify enhanced PII detection', async () => {
      // Wait for PII detection results
      await expect(page.locator('[data-testid="pii-detection-results"]')).toBeVisible({ timeout: 20000 });
      
      // Verify medical-specific patterns are detected
      await expect(page.locator('[data-testid="pii-type-medical_record_number"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-type-ssn"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-type-email"]')).toBeVisible();
      
      // Check HIPAA-specific detection confidence
      const medicalRecordConfidence = await page.locator('[data-testid="confidence-medical_record_number"]').textContent();
      expect(parseFloat(medicalRecordConfidence || '0')).toBeGreaterThan(0.8);
      
      await page.screenshot({ path: 'test-results/enhanced-03-pii-detection-complete.png' });
    });

    // Step 4: Review risk assessment dashboard
    await test.step('Review risk assessment dashboard', async () => {
      // Navigate to risk assessment
      await page.click('[data-testid="risk-assessment-tab"]');
      
      // Verify risk score is calculated
      const riskScore = await page.locator('[data-testid="overall-risk-score"]').textContent();
      const scoreValue = parseFloat(riskScore || '0');
      expect(scoreValue).toBeGreaterThan(0);
      expect(scoreValue).toBeLessThanOrEqual(100);
      
      // Verify HIPAA compliance status
      await expect(page.locator('[data-testid="compliance-status-hipaa"]')).toBeVisible();
      
      // Check for violation alerts if risk is high
      if (scoreValue >= TEST_DATA.riskThresholds.high) {
        await expect(page.locator('[data-testid="compliance-violations"]')).toBeVisible();
      }
      
      // Verify recommendations are shown
      await expect(page.locator('[data-testid="risk-recommendations"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/enhanced-04-risk-assessment.png' });
    });

    // Step 5: Test advanced configuration
    await test.step('Test advanced configuration interface', async () => {
      // Navigate to configuration
      await page.click('[data-testid="advanced-config"]');
      
      // Adjust confidence threshold
      const confidenceSlider = page.locator('[data-testid="confidence-threshold-slider"]');
      await confidenceSlider.fill('0.9');
      
      // Verify real-time preview updates
      await expect(page.locator('[data-testid="config-preview"]')).toBeVisible();
      
      // Test pattern priority adjustment
      const patternPriority = page.locator('[data-testid="pattern-priority-medical"]');
      if (await patternPriority.isVisible()) {
        await patternPriority.selectOption('high');
      }
      
      await page.screenshot({ path: 'test-results/enhanced-05-advanced-config.png' });
    });

    // Step 6: Generate compliance report
    await test.step('Generate and verify compliance report', async () => {
      // Navigate to reporting
      await page.click('[data-testid="compliance-reporting"]');
      
      // Generate HIPAA compliance report
      await page.click('[data-testid="generate-hipaa-report"]');
      
      // Wait for report generation
      await expect(page.locator('[data-testid="report-generated"]')).toBeVisible({ timeout: 30000 });
      
      // Verify report contents
      await expect(page.locator('[data-testid="report-executive-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-detailed-findings"]')).toBeVisible();
      await expect(page.locator('[data-testid="report-recommendations"]')).toBeVisible();
      
      // Test export options
      await page.click('[data-testid="export-report-pdf"]');
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible({ timeout: 15000 });
      
      await page.screenshot({ path: 'test-results/enhanced-06-compliance-report.png' });
    });
  });

  test('Multi-Framework Compliance Comparison', async ({ page }) => {
    console.log('⚖️ Testing Multi-Framework Compliance');
    
    await test.step('Compare GDPR vs PCI-DSS frameworks', async () => {
      // Navigate to framework comparison
      await page.click('[data-testid="framework-comparison"]');
      
      // Select GDPR
      await page.click('[data-testid="compare-framework-gdpr"]');
      
      // Select PCI-DSS
      await page.click('[data-testid="compare-framework-pci-dss"]');
      
      // Verify comparison table
      await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();
      
      // Check framework-specific requirements
      await expect(page.locator('[data-testid="gdpr-requirements"]')).toBeVisible();
      await expect(page.locator('[data-testid="pci-dss-requirements"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/enhanced-07-framework-comparison.png' });
    });
  });

  test('Real-time Risk Assessment During Upload', async ({ page }) => {
    console.log('📊 Testing Real-time Risk Assessment');
    
    await test.step('Monitor real-time risk calculation', async () => {
      // Start file upload
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'high-risk-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(TEST_DATA.csvWithPII)
      });
      
      // Monitor real-time risk updates via WebSocket
      let riskUpdates = 0;
      
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          const data = JSON.parse(event.payload);
          if (data.type === 'risk_update') {
            riskUpdates++;
            console.log(`Risk update ${riskUpdates}: ${data.risk_score}`);
          }
        });
      });
      
      // Wait for risk calculation to complete
      await expect(page.locator('[data-testid="real-time-risk-score"]')).toBeVisible({ timeout: 30000 });
      
      // Verify we received real-time updates
      expect(riskUpdates).toBeGreaterThan(0);
      
      await page.screenshot({ path: 'test-results/enhanced-08-realtime-risk.png' });
    });
  });

  test('Large Dataset Performance Testing', async ({ page }) => {
    console.log('🚀 Testing Large Dataset Performance');
    
    await test.step('Process large dataset with streaming', async () => {
      // Generate larger test dataset
      let largeDataset = 'name,email,phone,ssn\n';
      for (let i = 0; i < 1000; i++) {
        largeDataset += `User${i},user${i}@test.com,555-000-${i.toString().padStart(4, '0')},${i.toString().padStart(3, '0')}-${i.toString().padStart(2, '0')}-${i.toString().padStart(4, '0')}\n`;
      }
      
      // Upload large file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeDataset)
      });
      
      // Monitor processing progress
      await expect(page.locator('[data-testid="processing-progress"]')).toBeVisible({ timeout: 5000 });
      
      // Verify streaming processing
      const progressBar = page.locator('[data-testid="progress-bar"]');
      let lastProgress = 0;
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(2000);
        const currentProgress = await progressBar.getAttribute('value');
        if (currentProgress && parseFloat(currentProgress) > lastProgress) {
          lastProgress = parseFloat(currentProgress);
          console.log(`Processing progress: ${lastProgress}%`);
        }
      }
      
      // Wait for completion
      await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({ timeout: 60000 });
      
      await page.screenshot({ path: 'test-results/enhanced-09-large-dataset.png' });
    });
  });

  test('Custom Pattern Creation and Testing', async ({ page }) => {
    console.log('🛠️ Testing Custom Pattern Creation');
    
    await test.step('Create and test custom PII pattern', async () => {
      // Navigate to custom pattern builder
      await page.click('[data-testid="custom-patterns"]');
      
      // Create new pattern
      await page.click('[data-testid="add-custom-pattern"]');
      
      // Fill pattern details
      await page.fill('[data-testid="pattern-name"]', 'Employee ID');
      await page.fill('[data-testid="pattern-regex"]', '\\bEMP[0-9]{6}\\b');
      await page.selectOption('[data-testid="pattern-risk-level"]', 'medium');
      await page.selectOption('[data-testid="pattern-compliance"]', 'GENERAL');
      
      // Test pattern
      await page.fill('[data-testid="pattern-test-text"]', 'Employee EMP123456 has access to the system');
      await page.click('[data-testid="test-pattern"]');
      
      // Verify pattern match
      await expect(page.locator('[data-testid="pattern-match-found"]')).toBeVisible();
      
      // Save pattern
      await page.click('[data-testid="save-pattern"]');
      await expect(page.locator('[data-testid="pattern-saved"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/enhanced-10-custom-pattern.png' });
    });
  });

  test('Integration Testing - Backend API Endpoints', async ({ page }) => {
    console.log('🔌 Testing Backend API Integration');
    
    await test.step('Test enhanced API endpoints', async () => {
      // Test compliance frameworks endpoint
      const response1 = await page.request.get('/api/v1/compliance/frameworks');
      expect(response1.status()).toBe(200);
      const frameworks = await response1.json();
      expect(frameworks).toContain('HIPAA');
      
      // Test risk assessment endpoint
      const riskData = {
        texts: ['John Doe SSN: 123-45-6789'],
        complianceFramework: 'HIPAA'
      };
      
      const response2 = await page.request.post('/api/v1/risk-assessment/analyze', {
        data: riskData
      });
      expect(response2.status()).toBe(200);
      const riskResult = await response2.json();
      expect(riskResult.risk_score).toBeGreaterThan(0);
      
      // Test performance analytics
      const response3 = await page.request.get('/api/v1/analytics/performance');
      expect(response3.status()).toBe(200);
      
      await page.screenshot({ path: 'test-results/enhanced-11-api-integration.png' });
    });
  });

  test('Accessibility and Mobile Responsiveness', async ({ page }) => {
    console.log('♿ Testing Accessibility and Mobile Support');
    
    await test.step('Verify accessibility compliance', async () => {
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Verify focus indicators
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Test screen reader support
      const ariaLabels = await page.locator('[aria-label]').count();
      expect(ariaLabels).toBeGreaterThan(0);
      
      await page.screenshot({ path: 'test-results/enhanced-12-accessibility.png' });
    });
    
    await test.step('Test mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Verify responsive design
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test touch interactions
      await page.tap('[data-testid="compliance-selector"]');
      await expect(page.locator('[data-testid="framework-options"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/enhanced-13-mobile-responsive.png' });
    });
  });

  test('Error Handling and Recovery', async ({ page }) => {
    console.log('🚨 Testing Error Handling');
    
    await test.step('Test API error handling', async () => {
      // Simulate network error
      await page.route('/api/v1/risk-assessment/analyze', route => {
        route.abort('failed');
      });
      
      // Attempt operation that should fail
      await page.click('[data-testid="analyze-risk"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Test retry functionality
      await page.unroute('/api/v1/risk-assessment/analyze');
      await page.click('[data-testid="retry-button"]');
      
      await page.screenshot({ path: 'test-results/enhanced-14-error-handling.png' });
    });
  });
});

test.describe('Performance Benchmarks', () => {
  
  test('Measure key performance metrics', async ({ page }) => {
    console.log('⏱️ Testing Performance Benchmarks');
    
    // Start performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = {
        loadTime: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0
      };
    });
    
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    
    // Wait for app to be ready
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Test file upload performance
    const uploadStart = Date.now();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'performance-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(TEST_DATA.csvWithPII)
    });
    
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    const uploadTime = Date.now() - uploadStart;
    
    console.log(`File upload time: ${uploadTime}ms`);
    expect(uploadTime).toBeLessThan(10000); // Should upload within 10 seconds
    
    await page.screenshot({ path: 'test-results/enhanced-15-performance.png' });
  });
});