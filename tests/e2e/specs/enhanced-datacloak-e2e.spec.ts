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

// Setup function for security and compliance API mocking
async function setupSecurityAndComplianceMocks(page) {
  // Mock compliance frameworks endpoint
  await page.route('**/api/v1/compliance/frameworks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['HIPAA', 'PCI_DSS', 'GDPR', 'GENERAL', 'CUSTOM'])
    });
  });

  // Mock risk assessment endpoint
  await page.route('**/api/v1/risk-assessment/analyze', async (route) => {
    const requestData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          risk_score: 75,
          overall_risk: 'medium',
          pii_detected: [
            {
              type: 'SSN',
              count: 1,
              confidence: 0.95,
              risk_level: 'high',
              samples: ['***-**-6789'],
              compliance_impact: ['HIPAA', 'PCI_DSS'],
              field_distribution: { ssn: 1 }
            },
            {
              type: 'EMAIL',
              count: 1,
              confidence: 0.92,
              risk_level: 'medium',
              samples: ['john.doe@***'],
              compliance_impact: ['GDPR'],
              field_distribution: { email: 1 }
            }
          ],
          compliance_status: [
            {
              framework: requestData?.complianceFramework || 'HIPAA',
              compliant: false,
              violations: ['Missing encryption at rest', 'Insufficient access controls'],
              recommendations: ['Enable encryption', 'Implement role-based access'],
              risk_factors: ['PII exposure', 'Regulatory compliance gap']
            }
          ],
          data_sensitivity: {
            total_records: 100,
            sensitive_records: 25,
            sensitivity_percentage: 25.0,
            sensitivity_by_field: { ssn: 100, email: 80, name: 60 }
          },
          geographic_risk: {
            jurisdiction: ['US', 'EU'],
            cross_border_transfer: true,
            gdpr_applicable: true,
            additional_regulations: ['CCPA']
          },
          recommendations: {
            immediate: ['Encrypt PII fields', 'Implement access logging'],
            short_term: ['Data minimization review', 'Consent management'],
            long_term: ['Compliance automation', 'Risk monitoring']
          }
        }
      })
    });
  });

  // Mock file upload endpoint with PII detection
  await page.route('**/api/v1/data/upload', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataset: {
              datasetId: `ds_${Date.now()}`,
              originalFilename: 'medical-records.csv',
              recordCount: 3,
              size: 2048,
              uploadedAt: new Date().toISOString(),
              status: 'ready'
            },
            fieldInfo: [
              { name: 'name', type: 'text', piiDetected: true, piiType: 'NAME', confidence: 0.95 },
              { name: 'email', type: 'email', piiDetected: true, piiType: 'EMAIL', confidence: 0.92 },
              { name: 'phone', type: 'phone', piiDetected: true, piiType: 'PHONE', confidence: 0.88 },
              { name: 'ssn', type: 'text', piiDetected: true, piiType: 'SSN', confidence: 0.95 },
              { name: 'credit_card', type: 'text', piiDetected: true, piiType: 'CREDIT_CARD', confidence: 0.97 },
              { name: 'medical_id', type: 'text', piiDetected: true, piiType: 'MEDICAL_RECORD_NUMBER', confidence: 0.89 }
            ],
            previewData: [
              { 
                name: 'John Doe', 
                email: 'john.doe@email.com', 
                phone: '555-123-4567', 
                ssn: '***-**-6789', 
                credit_card: '****-****-****-0366', 
                medical_id: 'MRN123456' 
              }
            ],
            securityScan: {
              piiItemsDetected: 6,
              complianceScore: 65,
              riskLevel: 'high',
              frameworksAffected: ['HIPAA', 'PCI_DSS', 'GDPR'],
              recommendedActions: ['Enable format-preserving encryption', 'Implement access controls']
            }
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock performance analytics endpoint
  await page.route('**/api/v1/analytics/performance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          processing_time: {
            avg_file_processing: 2.5,
            avg_pii_detection: 1.2,
            avg_risk_assessment: 0.8
          },
          throughput: {
            files_per_hour: 120,
            records_per_second: 850
          },
          accuracy_metrics: {
            pii_detection_accuracy: 0.94,
            false_positive_rate: 0.03,
            false_negative_rate: 0.06
          }
        }
      })
    });
  });

  // Mock custom patterns endpoint
  await page.route('**/api/v1/patterns/custom', async (route) => {
    if (route.request().method() === 'POST') {
      const patternData = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: `pattern_${Date.now()}`,
            name: patternData.name,
            regex: patternData.regex,
            risk_level: patternData.risk_level,
            compliance_frameworks: patternData.compliance_frameworks,
            created_at: new Date().toISOString(),
            status: 'active'
          }
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'pattern_1',
              name: 'Employee ID',
              regex: '\\bEMP[0-9]{6}\\b',
              risk_level: 'medium',
              compliance_frameworks: ['GENERAL'],
              created_at: '2024-01-01T00:00:00Z',
              status: 'active'
            }
          ]
        })
      });
    }
  });

  // Mock pattern testing endpoint
  await page.route('**/api/v1/patterns/test', async (route) => {
    const testData = route.request().postDataJSON();
    const hasMatch = testData.text && testData.text.includes('EMP123456');
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          matches_found: hasMatch,
          match_count: hasMatch ? 1 : 0,
          matches: hasMatch ? [{ text: 'EMP123456', start: testData.text.indexOf('EMP123456'), end: testData.text.indexOf('EMP123456') + 9 }] : [],
          confidence: hasMatch ? 0.95 : 0.0
        }
      })
    });
  });

  // Mock compliance report generation
  await page.route('**/api/v1/compliance/report', async (route) => {
    const reportData = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          report_id: `report_${Date.now()}`,
          framework: reportData?.framework || 'HIPAA',
          executive_summary: {
            overall_score: 78,
            critical_findings: 3,
            recommendations: 8,
            compliance_status: 'Partially Compliant'
          },
          detailed_findings: [
            {
              category: 'Data Encryption',
              status: 'Non-Compliant',
              description: 'PII fields are not encrypted at rest',
              severity: 'Critical',
              remediation: 'Implement field-level encryption'
            },
            {
              category: 'Access Controls',
              status: 'Partially Compliant', 
              description: 'Basic access controls in place but lacking granular permissions',
              severity: 'Medium',
              remediation: 'Implement role-based access control'
            }
          ],
          recommendations: [
            'Enable format-preserving encryption for PII fields',
            'Implement comprehensive audit logging',
            'Establish data retention policies',
            'Conduct regular compliance assessments'
          ],
          generated_at: new Date().toISOString()
        }
      })
    });
  });

  // Mock export endpoints
  await page.route('**/api/v1/compliance/report/export', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('Mock PDF report content'),
      headers: {
        'Content-Disposition': 'attachment; filename="compliance-report.pdf"'
      }
    });
  });

  // Mock WebSocket connections for real-time updates
  await page.route('**/ws', async (route) => {
    // For WebSocket endpoints, we'll simulate the connection
    await route.continue();
  });

  // Mock generic error scenarios (will be overridden by specific tests)
  await page.route('**/api/v1/error-test', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          message: 'Simulated server error',
          code: 'INTERNAL_ERROR'
        }
      })
    });
  });
}

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
    // Set up comprehensive API mocking for security and compliance features
    await setupSecurityAndComplianceMocks(page);
    
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
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
    
    // Set up API mocking for performance tests
    await setupSecurityAndComplianceMocks(page);
    
    // Start performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = {
        loadTime: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0
      };
    });
    
    const startTime = Date.now();
    await page.goto('/');
    
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