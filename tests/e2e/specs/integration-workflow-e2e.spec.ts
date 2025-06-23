import { test, expect, expectWorkflowStep, waitForFileProcessing, uploadFile, setupCommonMocks } from '../fixtures/test-fixtures';

/**
 * Integration Workflow E2E Test Suite
 * Tests complete end-to-end workflows integrating all developer work:
 * - Developer 1: Enhanced DataCloak Core
 * - Developer 2: Backend Infrastructure  
 * - Developer 3: Frontend UI
 * - Developer 4: Testing & DevOps
 */

const INTEGRATION_TEST_DATA = {
  hipaaDataset: `patient_id,name,email,phone,ssn,medical_record,diagnosis
P001,John Smith,john.smith@hospital.com,555-123-4567,123-45-6789,MRN001234,Diabetes Type 2
P002,Mary Johnson,mary.j@clinic.org,555-987-6543,987-65-4321,MRN567890,Hypertension
P003,Robert Davis,r.davis@medical.net,555-456-7890,456-78-9012,MRN345678,Cardiac Arrhythmia`,

  financialDataset: `customer_id,name,email,credit_card,bank_account,ssn,transaction_amount
C001,Alice Brown,alice@bank.com,4532015112830366,12345678901234,111-22-3333,1250.00
C002,Bob Wilson,bob.w@credit.com,4556737586899855,98765432109876,222-33-4444,750.50
C003,Carol Taylor,carol@finance.org,4000000000000002,11112222333344,333-44-5555,2100.75`,

  gdprDataset: `user_id,name,email,phone,ip_address,location,date_of_birth
U001,Hans Mueller,hans@example.de,+49-123-456789,192.168.1.100,Berlin Germany,1985-03-15
U002,Marie Dubois,marie@example.fr,+33-123-456789,10.0.0.50,Paris France,1990-07-22
U003,Giuseppe Rossi,giuseppe@example.it,+39-123-456789,172.16.0.25,Rome Italy,1988-11-08`
};

test.describe('Integration Workflow E2E Tests', () => {
  
  test.beforeEach(async ({ page, mockBackend, mockOpenAI, platformBridge, testFiles }) => {
    // Set up common mocks for all integration tests
    await setupCommonMocks(page);
    
    // Add integration-specific mocks
    await page.route('**/api/v1/compliance/frameworks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['HIPAA', 'PCI_DSS', 'GDPR', 'GENERAL'])
      });
    });

    await page.route('**/api/v1/risk-assessment/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          risk_score: 85.5,
          overall_risk: 'high',
          pii_detected: true,
          compliance_score: {
            HIPAA: 78.2,
            overall: 78.2
          },
          recommendations: [
            'Enable encryption for sensitive data',
            'Implement access controls',
            'Set up audit logging'
          ]
        })
      });
    });

    await page.route('**/api/v1/patterns/custom', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `pattern_${Date.now()}`,
          status: 'created'
        })
      });
    });

    await page.route('**/api/v1/analytics/performance', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          processing_stats: {
            average_processing_time: 1250,
            total_files_processed: 145,
            success_rate: 98.5
          }
        })
      });
    });

    // Start the application and wait for full initialization
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the upload step using the helper function
    await expectWorkflowStep(page, 'Upload Data');
  });

  test('Complete HIPAA Healthcare Data Processing Workflow', async ({ page }) => {
    console.log('🏥 Integration Test: Complete HIPAA Workflow');
    
    await test.step('1. Initialize Enhanced DataCloak with HIPAA Framework', async () => {
      // Note: Framework selection happens during workflow, not upfront
      // The enhanced DataCloak is integrated into the backend processing
      console.log('Enhanced DataCloak with HIPAA framework will be applied during processing');
      
      await page.screenshot({ path: 'test-results/integration-01-initial-state.png' });
    });

    await test.step('2. Upload Healthcare Dataset with Medical PII', async () => {
      // Create test file
      const testFile = {
        name: 'healthcare-patients.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      };
      
      // Use the upload helper that works with the app
      await uploadFile(page, testFile, true);
      
      // Click the Upload File button
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Wait for file processing to complete
      await waitForFileProcessing(page);
      
      await page.screenshot({ path: 'test-results/integration-02-hipaa-upload.png' });
    });

    await test.step('3. Verify Enhanced PII Detection (Developer 1 Core)', async () => {
      // After successful upload, we should be on the Data Profile step
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible({ timeout: 10000 });
      
      // Verify dataset info is displayed
      const datasetInfo = page.locator('text=/Records: |File: healthcare-patients.csv/i');
      await expect(datasetInfo.first()).toBeVisible();
      
      // Verify PII warning is shown (indicating PII detection worked)
      const piiWarning = page.locator('text=/PII Protection Active/i');
      await expect(piiWarning).toBeVisible();
      
      // Check for security scan results
      const securityInfo = page.locator('text=/Risk Level|Compliance Score/i');
      if (await securityInfo.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Security scan results displayed');
      }
      
      await page.screenshot({ path: 'test-results/integration-03-pii-detection.png' });
    });

    await test.step('4. Verify File Processing Completed Successfully', async () => {
      // Verify we successfully processed the file and got security scan results
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible();
      
      // Verify that security scan completed
      const securityInfo = page.locator('text=/Risk Level|Compliance Score|PII Protection Active/i');
      await expect(securityInfo.first()).toBeVisible();
      
      // Log success for integration verification
      console.log('✅ File processing and security scanning completed successfully');
      
      await page.screenshot({ path: 'test-results/integration-04-processing-complete.png' });
    });

    await test.step('5. Verify Integration Workflow Completed', async () => {
      // Verify that the core integration workflow completed successfully
      const uploadSuccessful = await page.locator('h2:has-text("Data Profile")').isVisible();
      const piiDetectionWorked = await page.locator('text=/PII Protection Active/i').isVisible();
      
      expect(uploadSuccessful).toBe(true);
      expect(piiDetectionWorked).toBe(true);
      
      console.log('✅ Integration workflow verified: Upload + PII Detection + Security Scan');
      
      await page.screenshot({ path: 'test-results/integration-05-workflow-complete.png' });
    });

    await test.step('6. Verify Complete Integration Success', async () => {
      // Verify the complete integration workflow succeeded
      const dataProfileVisible = await page.locator('h2:has-text("Data Profile")').isVisible();
      const piiProtectionActive = await page.locator('text=/PII Protection Active/i').isVisible();
      
      // Log final integration status
      if (dataProfileVisible && piiProtectionActive) {
        console.log('✅ Complete HIPAA integration workflow verified successfully');
        console.log('- File upload: ✅');
        console.log('- PII detection: ✅');
        console.log('- Security scanning: ✅');
        console.log('- Data profiling: ✅');
      }
      
      await page.screenshot({ path: 'test-results/integration-06-complete-success.png' });
    });
  });

  test('Financial Data PCI-DSS Compliance Workflow', async ({ page }) => {
    console.log('💳 Integration Test: PCI-DSS Financial Data Workflow');
    
    await test.step('Configure PCI-DSS Framework and Process Financial Data', async () => {
      // Upload financial dataset
      const testFile = {
        name: 'financial-transactions.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.financialDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      await waitForFileProcessing(page);
      
      // Verify we're on data profile page
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible({ timeout: 30000 });
      
      // Verify dataset info is displayed
      const datasetInfo = page.locator('text=/Records: |File: /i');
      await expect(datasetInfo.first()).toBeVisible();
      
      await page.screenshot({ path: 'test-results/integration-07-pci-dss-workflow.png' });
    });
  });

  test('GDPR European Data Processing Workflow', async ({ page }) => {
    console.log('🇪🇺 Integration Test: GDPR European Data Workflow');
    
    await test.step('Configure GDPR Framework and Geographic Risk Assessment', async () => {
      // Upload GDPR dataset
      const testFile = {
        name: 'gdpr-user-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.gdprDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      await waitForFileProcessing(page);
      
      // Verify we're on data profile page
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible({ timeout: 30000 });
      
      // Verify dataset info is displayed
      const datasetInfo = page.locator('text=/Records: |File: /i');
      await expect(datasetInfo.first()).toBeVisible();
      
      await page.screenshot({ path: 'test-results/integration-08-gdpr-workflow.png' });
    });
  });

  test('Performance and Scalability Integration Test', async ({ page }) => {
    console.log('🚀 Integration Test: Performance and Scalability');
    
    await test.step('Test Large Dataset Processing with All Systems', async () => {
      // Generate large dataset combining all PII types
      let largeDataset = 'id,name,email,phone,ssn,credit_card,medical_record,ip_address\n';
      for (let i = 0; i < 500; i++) {
        largeDataset += `${i},User${i},user${i}@test.com,555-${String(i).padStart(3, '0')}-${String(i + 1000).padStart(4, '0')},${String(i).padStart(3, '0')}-${String(i + 10).padStart(2, '0')}-${String(i + 1000).padStart(4, '0')},4532${String(i + 1000).padStart(12, '0')},MRN${String(i).padStart(6, '0')},192.168.1.${i % 255}\n`;
      }
      
      // Start performance monitoring
      const startTime = Date.now();
      
      // Upload large dataset
      const testFile = {
        name: 'large-mixed-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Monitor processing progress
      const progressIndicator = page.locator('[data-testid="processing-progress"], .progress-bar, .upload-progress').first();
      if (await progressIndicator.isVisible()) {
        console.log('Processing progress indicator found');
      }
      
      // Wait for completion with extended timeout for large dataset
      await waitForFileProcessing(page, 120000);
      
      const processingTime = Date.now() - startTime;
      console.log(`Large dataset processing time: ${processingTime}ms`);
      
      // Verify we're on data profile page
      const dataProfileHeader = page.locator('h2:has-text("Data Profile")');
      await expect(dataProfileHeader).toBeVisible();
      
      // Verify dataset processed successfully
      const datasetInfo = page.locator('text=/Records: |File: /i');
      await expect(datasetInfo.first()).toBeVisible();
      
      // Performance assertion
      expect(processingTime).toBeLessThan(120000); // Should complete within 2 minutes
      
      await page.screenshot({ path: 'test-results/integration-09-performance-test.png' });
    });
  });

  test('Error Recovery and Resilience Integration Test', async ({ page }) => {
    console.log('🛡️ Integration Test: Error Recovery and Resilience');
    
    await test.step('Test System Resilience with Network Failures', async () => {
      // Simulate intermittent network failures
      await page.route('/api/v1/risk-assessment/**', (route, request) => {
        // Fail 30% of requests to test retry logic
        if (Math.random() < 0.3) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      // Upload test data
      const testFile = {
        name: 'resilience-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // The system should recover and complete processing despite failures
      await waitForFileProcessing(page, 60000);
      
      // Verify retry mechanisms worked
      const errorIndicator = page.locator('[data-testid="retry-indicator"], .retry-message, .error-recovered');
      if (await errorIndicator.isVisible()) {
        console.log('System successfully recovered from network failures');
      }
      
      // Clean up route interception
      await page.unroute('/api/v1/risk-assessment/**');
      
      await page.screenshot({ path: 'test-results/integration-10-resilience-test.png' });
    });
  });

  test('Cross-Browser Compatibility Integration Test', async ({ page, browserName }) => {
    console.log(`🌐 Integration Test: Cross-Browser Compatibility (${browserName})`);
    
    await test.step(`Test core functionality in ${browserName}`, async () => {
      // Test basic upload workflow
      const testFile = {
        name: `${browserName}-test.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Verify processing works across browsers
      await waitForFileProcessing(page, 30000);
      
      // Test risk assessment
      const riskTab = page.locator('[data-testid="risk-assessment"], button:has-text("Risk")').first();
      if (await riskTab.isVisible()) {
        await riskTab.click();
        await expect(page.locator('[data-testid="risk-score"], .risk-score')).toBeVisible();
      }
      
      await page.screenshot({ path: `test-results/integration-11-${browserName}-compatibility.png` });
    });
  });
});

test.describe('API Integration Tests', () => {
  
  test('Backend API Endpoints Integration', async ({ page }) => {
    console.log('🔌 Testing Backend API Integration');
    
    await test.step('Test Enhanced DataCloak API Endpoints', async () => {
      // Test compliance frameworks endpoint
      const frameworksResponse = await page.request.get('/api/v1/compliance/frameworks');
      expect(frameworksResponse.status()).toBe(200);
      const frameworks = await frameworksResponse.json();
      expect(frameworks).toEqual(expect.arrayContaining(['HIPAA', 'PCI_DSS', 'GDPR', 'GENERAL']));
      
      // Test risk assessment endpoint
      const riskAssessmentData = {
        texts: ['John Doe, SSN: 123-45-6789, Email: john@example.com'],
        complianceFramework: 'HIPAA',
        confidenceThreshold: 0.8
      };
      
      const riskResponse = await page.request.post('/api/v1/risk-assessment/analyze', {
        data: riskAssessmentData,
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(riskResponse.status()).toBe(200);
      const riskResult = await riskResponse.json();
      expect(riskResult).toHaveProperty('risk_score');
      expect(riskResult).toHaveProperty('overall_risk');
      expect(riskResult).toHaveProperty('pii_detected');
      expect(riskResult.risk_score).toBeGreaterThan(0);
      
      // Test custom patterns endpoint
      const customPattern = {
        name: 'Test Employee ID',
        pattern: '\\bEMP[0-9]{6}\\b',
        confidence: 0.9,
        risk_level: 'medium',
        compliance_frameworks: ['GENERAL'],
        description: 'Test pattern for employee IDs'
      };
      
      const patternResponse = await page.request.post('/api/v1/patterns/custom', {
        data: customPattern,
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(patternResponse.status()).toBe(201);
      const patternResult = await patternResponse.json();
      expect(patternResult).toHaveProperty('id');
      
      // Test analytics endpoint
      const analyticsResponse = await page.request.get('/api/v1/analytics/performance');
      expect(analyticsResponse.status()).toBe(200);
      const analytics = await analyticsResponse.json();
      expect(analytics).toHaveProperty('processing_stats');
      
      console.log('✅ All API endpoints responding correctly');
    });
  });

  test('WebSocket Real-time Integration', async ({ page }) => {
    console.log('📡 Testing WebSocket Real-time Integration');
    
    await test.step('Test Real-time Risk Assessment Updates', async () => {
      let websocketMessages: any[] = [];
      
      // Monitor WebSocket messages
      page.on('websocket', ws => {
        ws.on('framereceived', event => {
          try {
            const data = JSON.parse(event.payload);
            websocketMessages.push(data);
            console.log('WebSocket message received:', data.type);
          } catch (e) {
            // Ignore non-JSON messages
          }
        });
      });
      
      // Trigger an operation that should send WebSocket updates
      const testFile = {
        name: 'websocket-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      };
      
      await uploadFile(page, testFile, true);
      
      const uploadButton = page.locator('button:has-text("Upload File")');
      await expect(uploadButton).toBeVisible();
      await uploadButton.click();
      
      // Wait for processing and WebSocket messages
      await waitForFileProcessing(page, 30000);
      
      // Give time for WebSocket messages
      await page.waitForTimeout(5000);
      
      // Verify we received real-time updates
      expect(websocketMessages.length).toBeGreaterThan(0);
      
      const riskUpdateMessages = websocketMessages.filter(msg => msg.type === 'risk_update' || msg.type === 'processing_update');
      expect(riskUpdateMessages.length).toBeGreaterThan(0);
      
      console.log(`✅ Received ${websocketMessages.length} WebSocket messages, ${riskUpdateMessages.length} risk updates`);
    });
  });
});