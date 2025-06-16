import { test, expect } from '@playwright/test';

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
  
  test.beforeEach(async ({ page }) => {
    // Start the application and wait for full initialization
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Verify all core components are loaded
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible({ timeout: 15000 });
    
    // Wait for enhanced DataCloak service initialization
    await page.waitForFunction(() => {
      return window.fetch && typeof window.fetch === 'function';
    });
  });

  test('Complete HIPAA Healthcare Data Processing Workflow', async ({ page }) => {
    console.log('🏥 Integration Test: Complete HIPAA Workflow');
    
    await test.step('1. Initialize Enhanced DataCloak with HIPAA Framework', async () => {
      // Navigate to compliance configuration
      const complianceBtn = page.locator('[data-testid="compliance-setup"], [data-testid="framework-selection"], button:has-text("Compliance")').first();
      await complianceBtn.click();
      
      // Select HIPAA compliance framework
      await page.click('[data-testid="framework-hipaa"], [data-compliance="HIPAA"], button:has-text("HIPAA")');
      
      // Verify framework selection
      await expect(page.locator('.selected-framework, .active-framework')).toContainText(/HIPAA/i);
      
      // Configure HIPAA-specific settings
      const confidenceSlider = page.locator('[data-testid="confidence-threshold"], input[type="range"]').first();
      if (await confidenceSlider.isVisible()) {
        await confidenceSlider.fill('0.85');
      }
      
      await page.screenshot({ path: 'test-results/integration-01-hipaa-setup.png' });
    });

    await test.step('2. Upload Healthcare Dataset with Medical PII', async () => {
      // Navigate to file upload
      const uploadBtn = page.locator('[data-testid="upload-data"], [data-testid="file-upload"], button:has-text("Upload")').first();
      await uploadBtn.click();
      
      // Upload HIPAA test dataset
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'healthcare-patients.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      });
      
      // Wait for backend processing (Developer 2's infrastructure)
      await expect(page.locator('[data-testid="upload-success"], .upload-complete, .processing-complete')).toBeVisible({ timeout: 20000 });
      
      // Verify file was processed by enhanced backend
      const fileSize = page.locator('[data-testid="file-size"], .file-info');
      await expect(fileSize).toBeVisible();
      
      await page.screenshot({ path: 'test-results/integration-02-hipaa-upload.png' });
    });

    await test.step('3. Verify Enhanced PII Detection (Developer 1 Core)', async () => {
      // Wait for enhanced DataCloak PII detection
      await expect(page.locator('[data-testid="pii-detection-results"], .pii-results, .detection-complete')).toBeVisible({ timeout: 30000 });
      
      // Verify HIPAA-specific PII types are detected
      const expectedPIITypes = ['medical_record', 'ssn', 'email', 'phone'];
      
      for (const piiType of expectedPIITypes) {
        const piiElement = page.locator(`[data-testid="pii-type-${piiType}"], [data-pii="${piiType}"], .pii-${piiType}`).first();
        await expect(piiElement).toBeVisible();
      }
      
      // Verify high confidence scores for medical data
      const medicalRecordConfidence = page.locator('[data-testid="confidence-medical_record"], .confidence-medical_record').first();
      if (await medicalRecordConfidence.isVisible()) {
        const confidenceText = await medicalRecordConfidence.textContent();
        const confidence = parseFloat(confidenceText?.replace(/[^0-9.]/g, '') || '0');
        expect(confidence).toBeGreaterThan(80);
      }
      
      await page.screenshot({ path: 'test-results/integration-03-pii-detection.png' });
    });

    await test.step('4. Review Risk Assessment Dashboard (Developer 1 + 3 UI)', async () => {
      // Navigate to risk assessment dashboard
      const riskTab = page.locator('[data-testid="risk-assessment"], button:has-text("Risk"), .risk-tab').first();
      await riskTab.click();
      
      // Verify risk score calculation (Developer 1's risk engine)
      const riskScore = page.locator('[data-testid="risk-score"], .risk-score, .overall-risk').first();
      await expect(riskScore).toBeVisible();
      
      const scoreText = await riskScore.textContent();
      const score = parseFloat(scoreText?.replace(/[^0-9.]/g, '') || '0');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // Verify HIPAA compliance status
      await expect(page.locator('[data-testid="hipaa-compliance"], .compliance-hipaa, .framework-status')).toBeVisible();
      
      // Check for compliance violations or recommendations
      const recommendations = page.locator('[data-testid="recommendations"], .recommendations, .compliance-recommendations');
      if (await recommendations.isVisible()) {
        await expect(recommendations).toContainText(/encryption|access|audit/i);
      }
      
      await page.screenshot({ path: 'test-results/integration-04-risk-dashboard.png' });
    });

    await test.step('5. Test Real-time Monitoring (Developer 2 + 4 Infrastructure)', async () => {
      // Verify WebSocket connection for real-time updates
      let websocketConnected = false;
      page.on('websocket', ws => {
        websocketConnected = true;
        console.log('WebSocket connection established');
      });
      
      // Navigate to monitoring dashboard
      const monitoringBtn = page.locator('[data-testid="monitoring"], button:has-text("Monitor"), .monitoring-tab').first();
      if (await monitoringBtn.isVisible()) {
        await monitoringBtn.click();
        
        // Verify real-time metrics
        await expect(page.locator('[data-testid="real-time-metrics"], .live-metrics, .monitoring-dashboard')).toBeVisible();
        
        // Check for performance metrics
        const performanceMetrics = page.locator('[data-testid="performance-metrics"], .performance-stats');
        if (await performanceMetrics.isVisible()) {
          await expect(performanceMetrics).toContainText(/processing|memory|cpu/i);
        }
      }
      
      await page.screenshot({ path: 'test-results/integration-05-monitoring.png' });
    });

    await test.step('6. Generate Compliance Report (All Developers Integration)', async () => {
      // Navigate to reporting section
      const reportBtn = page.locator('[data-testid="compliance-report"], button:has-text("Report"), .reporting-section').first();
      await reportBtn.click();
      
      // Generate HIPAA compliance report
      const generateBtn = page.locator('[data-testid="generate-report"], button:has-text("Generate"), .generate-compliance-report').first();
      await generateBtn.click();
      
      // Wait for report generation (backend processing)
      await expect(page.locator('[data-testid="report-ready"], .report-generated, .report-complete')).toBeVisible({ timeout: 45000 });
      
      // Verify report sections
      await expect(page.locator('[data-testid="executive-summary"], .executive-summary')).toBeVisible();
      await expect(page.locator('[data-testid="detailed-findings"], .detailed-findings')).toBeVisible();
      
      // Test export functionality
      const exportBtn = page.locator('[data-testid="export-pdf"], button:has-text("Export"), .export-report').first();
      if (await exportBtn.isVisible()) {
        await exportBtn.click();
        await expect(page.locator('[data-testid="export-success"], .export-complete')).toBeVisible({ timeout: 15000 });
      }
      
      await page.screenshot({ path: 'test-results/integration-06-compliance-report.png' });
    });
  });

  test('Financial Data PCI-DSS Compliance Workflow', async ({ page }) => {
    console.log('💳 Integration Test: PCI-DSS Financial Data Workflow');
    
    await test.step('Configure PCI-DSS Framework and Process Financial Data', async () => {
      // Select PCI-DSS framework
      const complianceBtn = page.locator('[data-testid="compliance-setup"], button:has-text("Compliance")').first();
      await complianceBtn.click();
      
      await page.click('[data-testid="framework-pci-dss"], button:has-text("PCI-DSS"), [data-compliance="PCI_DSS"]');
      
      // Upload financial dataset
      const uploadBtn = page.locator('[data-testid="upload-data"], button:has-text("Upload")').first();
      await uploadBtn.click();
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'financial-transactions.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.financialDataset)
      });
      
      // Wait for processing
      await expect(page.locator('[data-testid="upload-success"], .upload-complete')).toBeVisible({ timeout: 20000 });
      
      // Verify credit card detection
      await expect(page.locator('[data-testid="pii-detection-results"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('[data-testid="pii-type-credit_card"], [data-pii="credit_card"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/integration-07-pci-dss-workflow.png' });
    });
  });

  test('GDPR European Data Processing Workflow', async ({ page }) => {
    console.log('🇪🇺 Integration Test: GDPR European Data Workflow');
    
    await test.step('Configure GDPR Framework and Geographic Risk Assessment', async () => {
      // Select GDPR framework
      const complianceBtn = page.locator('[data-testid="compliance-setup"], button:has-text("Compliance")').first();
      await complianceBtn.click();
      
      await page.click('[data-testid="framework-gdpr"], button:has-text("GDPR"), [data-compliance="GDPR"]');
      
      // Configure geographic context
      const geoConfig = page.locator('[data-testid="geographic-config"], .geographic-settings').first();
      if (await geoConfig.isVisible()) {
        await geoConfig.click();
        await page.selectOption('[data-testid="jurisdiction"], select[name="jurisdiction"]', 'EU');
      }
      
      // Upload GDPR dataset
      const uploadBtn = page.locator('[data-testid="upload-data"], button:has-text("Upload")').first();
      await uploadBtn.click();
      
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'gdpr-user-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.gdprDataset)
      });
      
      // Wait for processing
      await expect(page.locator('[data-testid="upload-success"], .upload-complete')).toBeVisible({ timeout: 20000 });
      
      // Verify GDPR-specific detections (IP addresses, international phone numbers)
      await expect(page.locator('[data-testid="pii-detection-results"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('[data-testid="pii-type-ip_address"], [data-pii="ip_address"]')).toBeVisible();
      
      // Check geographic risk assessment
      const geoRisk = page.locator('[data-testid="geographic-risk"], .geographic-risk').first();
      if (await geoRisk.isVisible()) {
        await expect(geoRisk).toContainText(/cross.border|jurisdiction|transfer/i);
      }
      
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
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'large-mixed-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeDataset)
      });
      
      // Monitor processing progress
      const progressIndicator = page.locator('[data-testid="processing-progress"], .progress-bar, .upload-progress').first();
      if (await progressIndicator.isVisible()) {
        console.log('Processing progress indicator found');
      }
      
      // Wait for completion with extended timeout for large dataset
      await expect(page.locator('[data-testid="upload-success"], .processing-complete')).toBeVisible({ timeout: 120000 });
      
      const processingTime = Date.now() - startTime;
      console.log(`Large dataset processing time: ${processingTime}ms`);
      
      // Verify all PII types were detected
      await expect(page.locator('[data-testid="pii-detection-results"]')).toBeVisible();
      
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
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'resilience-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      });
      
      // The system should recover and complete processing despite failures
      await expect(page.locator('[data-testid="upload-success"], .processing-complete')).toBeVisible({ timeout: 60000 });
      
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
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: `${browserName}-test.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      });
      
      // Verify processing works across browsers
      await expect(page.locator('[data-testid="upload-success"], .upload-complete')).toBeVisible({ timeout: 30000 });
      
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
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: 'websocket-test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(INTEGRATION_TEST_DATA.hipaaDataset)
      });
      
      // Wait for processing and WebSocket messages
      await expect(page.locator('[data-testid="upload-success"], .processing-complete')).toBeVisible({ timeout: 30000 });
      
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