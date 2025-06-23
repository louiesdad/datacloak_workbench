import { test, expect } from '@playwright/test';

/**
 * PII Detection E2E Test Suite
 * Tests PII detection functionality including:
 * - Automatic PII pattern recognition
 * - Custom pattern creation and testing
 * - PII confidence scoring
 * - Multi-framework PII classification
 * - False positive/negative handling
 */

// Setup function for PII detection API mocking
async function setupPIIDetectionMocks(page) {
  // Mock PII detection endpoint
  await page.route('**/api/v1/pii/detect', async (route) => {
    const requestData = route.request().postDataJSON();
    const text = requestData?.text || '';
    
    // Simulate PII detection based on content
    const piiResults = [];
    
    // Email detection
    if (text.includes('@')) {
      piiResults.push({
        type: 'EMAIL',
        pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        confidence: 0.95,
        matches: [text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)?.[0]].filter(Boolean),
        risk_level: 'medium',
        compliance_frameworks: ['GDPR', 'CCPA']
      });
    }
    
    // SSN detection
    if (text.match(/\d{3}-?\d{2}-?\d{4}/)) {
      piiResults.push({
        type: 'SSN',
        pattern: '\\d{3}-?\\d{2}-?\\d{4}',
        confidence: 0.92,
        matches: text.match(/\d{3}-?\d{2}-?\d{4}/g) || [],
        risk_level: 'high',
        compliance_frameworks: ['HIPAA', 'PCI_DSS']
      });
    }
    
    // Credit Card detection
    if (text.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/)) {
      piiResults.push({
        type: 'CREDIT_CARD',
        pattern: '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}',
        confidence: 0.89,
        matches: text.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g) || [],
        risk_level: 'high',
        compliance_frameworks: ['PCI_DSS']
      });
    }
    
    // Phone number detection
    if (text.match(/\d{3}-?\d{3}-?\d{4}/)) {
      piiResults.push({
        type: 'PHONE',
        pattern: '\\d{3}-?\\d{3}-?\\d{4}',
        confidence: 0.85,
        matches: text.match(/\d{3}-?\d{3}-?\d{4}/g) || [],
        risk_level: 'medium',
        compliance_frameworks: ['GDPR']
      });
    }
    
    // Medical Record Number detection
    if (text.match(/MRN\d+/i)) {
      piiResults.push({
        type: 'MEDICAL_RECORD_NUMBER',
        pattern: 'MRN\\d+',
        confidence: 0.88,
        matches: text.match(/MRN\d+/gi) || [],
        risk_level: 'high',
        compliance_frameworks: ['HIPAA']
      });
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          pii_detected: piiResults,
          overall_risk_score: piiResults.length > 0 ? Math.min(100, piiResults.length * 25) : 0,
          processing_time_ms: 150,
          confidence_threshold: 0.8,
          frameworks_applicable: [...new Set(piiResults.flatMap(p => p.compliance_frameworks))]
        }
      })
    });
  });

  // Mock PII patterns endpoint
  await page.route('**/api/v1/pii/patterns', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            builtin_patterns: [
              {
                id: 'email',
                name: 'Email Address',
                pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
                description: 'Standard email address format',
                risk_level: 'medium',
                enabled: true
              },
              {
                id: 'ssn',
                name: 'Social Security Number',
                pattern: '\\d{3}-?\\d{2}-?\\d{4}',
                description: 'US Social Security Number',
                risk_level: 'high',
                enabled: true
              },
              {
                id: 'credit_card',
                name: 'Credit Card Number',
                pattern: '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}',
                description: 'Credit card number format',
                risk_level: 'high',
                enabled: true
              }
            ],
            custom_patterns: [
              {
                id: 'custom_1',
                name: 'Employee ID',
                pattern: '\\bEMP[0-9]{6}\\b',
                description: 'Company employee identifier',
                risk_level: 'medium',
                enabled: true,
                created_by: 'admin@example.com',
                created_at: '2024-01-01T00:00:00Z'
              }
            ]
          }
        })
      });
    } else if (route.request().method() === 'POST') {
      // Create new custom pattern
      const patternData = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: `custom_${Date.now()}`,
            name: patternData.name,
            pattern: patternData.pattern,
            description: patternData.description,
            risk_level: patternData.risk_level,
            enabled: true,
            created_by: 'admin@example.com',
            created_at: new Date().toISOString()
          }
        })
      });
    }
  });

  // Mock pattern testing endpoint
  await page.route('**/api/v1/pii/patterns/test', async (route) => {
    const testData = route.request().postDataJSON();
    const pattern = testData.pattern;
    const testText = testData.test_text;
    
    let matches = [];
    let hasMatches = false;
    
    try {
      const regex = new RegExp(pattern, 'gi');
      const found = testText.match(regex);
      if (found) {
        hasMatches = true;
        matches = found.map(match => ({
          text: match,
          start: testText.indexOf(match),
          end: testText.indexOf(match) + match.length
        }));
      }
    } catch (error) {
      // Invalid regex pattern
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          pattern_valid: true,
          matches_found: hasMatches,
          match_count: matches.length,
          matches: matches,
          test_passed: hasMatches,
          performance_ms: 5
        }
      })
    });
  });

  // Mock file upload with PII detection
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
              originalFilename: 'pii-test-data.csv',
              recordCount: 250,
              size: 5120,
              uploadedAt: new Date().toISOString(),
              status: 'ready'
            },
            fieldInfo: [
              { 
                name: 'id', 
                type: 'integer', 
                piiDetected: false,
                piiConfidence: 0,
                sampleValues: ['1', '2', '3']
              },
              { 
                name: 'full_name', 
                type: 'text', 
                piiDetected: true, 
                piiType: 'NAME',
                piiConfidence: 0.94,
                sampleValues: ['John Doe', 'Jane Smith', 'Bob Johnson']
              },
              { 
                name: 'email_address', 
                type: 'email', 
                piiDetected: true, 
                piiType: 'EMAIL',
                piiConfidence: 0.98,
                sampleValues: ['john@example.com', 'jane@company.org', 'bob@test.net']
              },
              { 
                name: 'phone_number', 
                type: 'phone', 
                piiDetected: true, 
                piiType: 'PHONE',
                piiConfidence: 0.87,
                sampleValues: ['555-123-4567', '555-987-6543', '555-555-5555']
              },
              { 
                name: 'social_security', 
                type: 'text', 
                piiDetected: true, 
                piiType: 'SSN',
                piiConfidence: 0.96,
                sampleValues: ['***-**-6789', '***-**-4321', '***-**-1234']
              },
              { 
                name: 'comments', 
                type: 'text', 
                piiDetected: false,
                piiConfidence: 0.05,
                sampleValues: ['Great service!', 'Could be better', 'Excellent quality']
              }
            ],
            piiAnalysis: {
              totalFields: 6,
              piiFields: 4,
              piiPercentage: 66.7,
              highRiskFields: 1,
              mediumRiskFields: 3,
              lowRiskFields: 0,
              overallRiskScore: 75,
              complianceFrameworks: ['GDPR', 'HIPAA', 'CCPA'],
              recommendedActions: [
                'Enable encryption for SSN field',
                'Apply data masking for phone numbers',
                'Configure access controls for email addresses',
                'Implement audit logging for PII access'
              ]
            }
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  // Mock PII statistics endpoint
  await page.route('**/api/v1/pii/statistics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          detection_accuracy: {
            overall: 0.94,
            by_type: {
              EMAIL: 0.98,
              SSN: 0.96,
              PHONE: 0.87,
              CREDIT_CARD: 0.91,
              NAME: 0.89
            }
          },
          performance_metrics: {
            avg_processing_time_ms: 125,
            files_processed: 1250,
            pii_items_detected: 15780,
            false_positive_rate: 0.03,
            false_negative_rate: 0.06
          },
          compliance_impact: {
            GDPR: { fields_affected: 8500, risk_level: 'medium' },
            HIPAA: { fields_affected: 3200, risk_level: 'high' },
            CCPA: { fields_affected: 5100, risk_level: 'medium' },
            PCI_DSS: { fields_affected: 980, risk_level: 'high' }
          }
        }
      })
    });
  });
}

test.describe('PII Detection', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up PII detection API mocking
    await setupPIIDetectionMocks(page);
    
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should detect common PII types during file upload', async ({ page }) => {
    console.log('🔍 Testing PII Detection During Upload');
    
    await test.step('Upload file with various PII types', async () => {
      // Create test file with multiple PII types
      const fileContent = `id,name,email,phone,ssn,credit_card,medical_id
1,John Doe,john.doe@email.com,555-123-4567,123-45-6789,4532015112830366,MRN123456
2,Jane Smith,jane.smith@company.com,555-987-6543,987-65-4321,4556737586899855,MRN789012`;
      
      // Upload the file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'pii-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(fileContent)
      });
      
      // Wait for upload and PII detection to complete
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 15000 });
      
      await page.screenshot({ path: 'test-results/pii-01-file-uploaded.png' });
    });

    await test.step('Verify PII detection results', async () => {
      // Check PII detection summary
      await expect(page.locator('[data-testid="pii-detection-summary"]')).toBeVisible();
      
      // Verify specific PII types are detected
      await expect(page.locator('[data-testid="pii-type-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-type-ssn"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-type-phone"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-type-medical_record_number"]')).toBeVisible();
      
      // Check confidence scores
      const emailConfidence = await page.locator('[data-testid="confidence-email"]').textContent();
      expect(parseFloat(emailConfidence || '0')).toBeGreaterThan(0.9);
      
      // Verify risk level indicators
      await expect(page.locator('[data-testid="risk-level-high"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-02-detection-results.png' });
    });
  });

  test('should allow manual PII verification and correction', async ({ page }) => {
    console.log('✏️ Testing Manual PII Verification');
    
    await test.step('Review detected PII items', async () => {
      // Navigate to PII review page
      await page.click('[data-testid="review-pii-detection"]');
      
      // Verify PII review interface
      await expect(page.locator('[data-testid="pii-review-table"]')).toBeVisible();
      
      // Check individual PII items
      await expect(page.locator('[data-testid="pii-item"]')).toHaveCount(4); // email, ssn, phone, medical_id
      
      await page.screenshot({ path: 'test-results/pii-03-review-interface.png' });
    });

    await test.step('Correct false positive detection', async () => {
      // Mark a field as non-PII (false positive)
      await page.click('[data-testid="pii-item"]:first-child [data-testid="mark-non-pii"]');
      
      // Confirm the correction
      await page.click('[data-testid="confirm-correction"]');
      
      // Verify the change
      await expect(page.locator('[data-testid="correction-applied"]')).toBeVisible();
      
      // Check updated PII count
      await expect(page.locator('[data-testid="pii-count"]')).toContainText('3');
      
      await page.screenshot({ path: 'test-results/pii-04-false-positive-corrected.png' });
    });

    await test.step('Manually mark missed PII', async () => {
      // Add a PII annotation to a field that wasn\'t detected
      await page.click('[data-testid="add-pii-annotation"]');
      
      // Select field and PII type
      await page.selectOption('[data-testid="select-field"]', 'comments');
      await page.selectOption('[data-testid="select-pii-type"]', 'CUSTOM');
      
      // Add custom PII type details
      await page.fill('[data-testid="custom-pii-name"]', 'Internal Reference');
      await page.selectOption('[data-testid="risk-level"]', 'low');
      
      // Save the annotation
      await page.click('[data-testid="save-annotation"]');
      
      // Verify annotation was added
      await expect(page.locator('[data-testid="pii-annotation-added"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-05-manual-annotation.png' });
    });
  });

  test('should create and test custom PII patterns', async ({ page }) => {
    console.log('🛠️ Testing Custom PII Pattern Creation');
    
    await test.step('Navigate to pattern management', async () => {
      // Go to PII pattern management
      await page.click('[data-testid="pii-pattern-management"]');
      
      // Verify pattern list is displayed
      await expect(page.locator('[data-testid="pattern-list"]')).toBeVisible();
      
      // Check built-in patterns
      await expect(page.locator('[data-testid="builtin-patterns"]')).toBeVisible();
      await expect(page.locator('[data-testid="custom-patterns"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-06-pattern-management.png' });
    });

    await test.step('Create new custom pattern', async () => {
      // Click add custom pattern
      await page.click('[data-testid="add-custom-pattern"]');
      
      // Fill pattern details
      await page.fill('[data-testid="pattern-name"]', 'Product Code');
      await page.fill('[data-testid="pattern-regex"]', '\\bPROD-[A-Z]{2}-[0-9]{4}\\b');
      await page.fill('[data-testid="pattern-description"]', 'Internal product identification code');
      await page.selectOption('[data-testid="pattern-risk-level"]', 'medium');
      
      // Test the pattern
      await page.fill('[data-testid="test-text"]', 'Product PROD-AB-1234 is available in stock');
      await page.click('[data-testid="test-pattern"]');
      
      // Verify pattern match
      await expect(page.locator('[data-testid="pattern-match-found"]')).toBeVisible();
      await expect(page.locator('[data-testid="match-text"]')).toContainText('PROD-AB-1234');
      
      await page.screenshot({ path: 'test-results/pii-07-pattern-test.png' });
    });

    await test.step('Save and activate custom pattern', async () => {
      // Save the pattern
      await page.click('[data-testid="save-pattern"]');
      
      // Verify pattern was saved
      await expect(page.locator('[data-testid="pattern-saved"]')).toBeVisible();
      
      // Activate the pattern
      await page.click('[data-testid="activate-pattern"]');
      
      // Verify pattern is active
      await expect(page.locator('[data-testid="pattern-active"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-08-pattern-saved.png' });
    });
  });

  test('should show PII confidence scoring and thresholds', async ({ page }) => {
    console.log('📊 Testing PII Confidence Scoring');
    
    await test.step('View confidence scoring interface', async () => {
      // Navigate to confidence settings
      await page.click('[data-testid="pii-confidence-settings"]');
      
      // Verify confidence threshold controls
      await expect(page.locator('[data-testid="confidence-threshold-slider"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-threshold"]')).toBeVisible();
      
      // Check confidence score distribution
      await expect(page.locator('[data-testid="confidence-distribution"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-09-confidence-settings.png' });
    });

    await test.step('Adjust confidence threshold', async () => {
      // Adjust confidence threshold
      await page.fill('[data-testid="confidence-threshold-slider"]', '0.9');
      
      // Apply threshold
      await page.click('[data-testid="apply-threshold"]');
      
      // Verify threshold applied
      await expect(page.locator('[data-testid="threshold-applied"]')).toBeVisible();
      
      // Check impact on detected PII
      const detectedCount = await page.locator('[data-testid="detected-pii-count"]').textContent();
      expect(parseInt(detectedCount || '0')).toBeGreaterThanOrEqual(0);
      
      await page.screenshot({ path: 'test-results/pii-10-threshold-adjusted.png' });
    });

    await test.step('View low-confidence items for review', async () => {
      // Show items below threshold
      await page.click('[data-testid="show-low-confidence"]');
      
      // Verify low-confidence items are displayed
      await expect(page.locator('[data-testid="low-confidence-items"]')).toBeVisible();
      
      // Review individual items
      await page.click('[data-testid="review-item"]:first-child');
      await expect(page.locator('[data-testid="item-details"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-11-low-confidence-review.png' });
    });
  });

  test('should handle different compliance framework requirements', async ({ page }) => {
    console.log('⚖️ Testing Compliance Framework PII Requirements');
    
    await test.step('Select compliance framework', async () => {
      // Navigate to compliance framework selection
      await page.click('[data-testid="compliance-framework-selection"]');
      
      // Select HIPAA framework
      await page.click('[data-testid="framework-hipaa"]');
      
      // Verify framework-specific PII requirements
      await expect(page.locator('[data-testid="hipaa-pii-requirements"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-12-hipaa-requirements.png' });
    });

    await test.step('Compare PII requirements across frameworks', async () => {
      // Enable framework comparison
      await page.click('[data-testid="compare-frameworks"]');
      
      // Select additional frameworks
      await page.check('[data-testid="framework-gdpr"]');
      await page.check('[data-testid="framework-ccpa"]');
      
      // View comparison table
      await expect(page.locator('[data-testid="framework-comparison-table"]')).toBeVisible();
      
      // Verify different PII categorizations
      await expect(page.locator('[data-testid="pii-category-sensitive"]')).toBeVisible();
      await expect(page.locator('[data-testid="pii-category-restricted"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-13-framework-comparison.png' });
    });
  });

  test('should provide PII detection statistics and analytics', async ({ page }) => {
    console.log('📈 Testing PII Detection Analytics');
    
    await test.step('View detection statistics dashboard', async () => {
      // Navigate to PII analytics
      await page.click('[data-testid="pii-analytics"]');
      
      // Verify analytics dashboard
      await expect(page.locator('[data-testid="detection-accuracy-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
      
      // Check accuracy statistics
      const overallAccuracy = await page.locator('[data-testid="overall-accuracy"]').textContent();
      expect(parseFloat(overallAccuracy || '0')).toBeGreaterThan(0.8);
      
      await page.screenshot({ path: 'test-results/pii-14-analytics-dashboard.png' });
    });

    await test.step('Analyze PII distribution by type', async () => {
      // View PII type distribution
      await page.click('[data-testid="pii-type-distribution"]');
      
      // Verify distribution chart
      await expect(page.locator('[data-testid="distribution-chart"]')).toBeVisible();
      
      // Check individual type statistics
      await expect(page.locator('[data-testid="email-stats"]')).toBeVisible();
      await expect(page.locator('[data-testid="ssn-stats"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-15-type-distribution.png' });
    });

    await test.step('Review false positive/negative rates', async () => {
      // Navigate to accuracy metrics
      await page.click('[data-testid="accuracy-metrics"]');
      
      // Check false positive rate
      const fpRate = await page.locator('[data-testid="false-positive-rate"]').textContent();
      expect(parseFloat(fpRate || '0')).toBeLessThan(0.1);
      
      // Check false negative rate
      const fnRate = await page.locator('[data-testid="false-negative-rate"]').textContent();
      expect(parseFloat(fnRate || '0')).toBeLessThan(0.1);
      
      await page.screenshot({ path: 'test-results/pii-16-accuracy-metrics.png' });
    });
  });

  test('should handle PII detection errors gracefully', async ({ page }) => {
    console.log('🚨 Testing PII Detection Error Handling');
    
    await test.step('Simulate detection service error', async () => {
      // Override PII detection endpoint to return error
      await page.route('**/api/v1/pii/detect', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'PII detection service temporarily unavailable',
              code: 'DETECTION_SERVICE_DOWN'
            }
          })
        });
      });
      
      // Attempt file upload with PII detection
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('id,name,email\n1,John,john@test.com')
      });
      
      // Verify error handling
      await expect(page.locator('[data-testid="pii-detection-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-detection"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-17-detection-error.png' });
    });

    await test.step('Test fallback detection mode', async () => {
      // Enable basic pattern matching fallback
      await page.click('[data-testid="enable-fallback-detection"]');
      
      // Verify fallback mode is active
      await expect(page.locator('[data-testid="fallback-mode-active"]')).toBeVisible();
      
      // Check that basic detection still works
      await expect(page.locator('[data-testid="basic-pii-detected"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-18-fallback-mode.png' });
    });

    await test.step('Restore service and retry detection', async () => {
      // Restore normal PII detection endpoint
      await page.unroute('**/api/v1/pii/detect');
      await setupPIIDetectionMocks(page);
      
      // Retry detection
      await page.click('[data-testid="retry-detection"]');
      
      // Verify full detection service is restored
      await expect(page.locator('[data-testid="full-detection-restored"]')).toBeVisible();
      
      // Check that advanced detection features are working
      await expect(page.locator('[data-testid="confidence-scores"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-19-detection-restored.png' });
    });
  });

  test('should support batch PII detection for large datasets', async ({ page }) => {
    console.log('📦 Testing Batch PII Detection');
    
    await test.step('Upload large dataset for batch processing', async () => {
      // Create larger test dataset
      let largeDataset = 'id,name,email,phone,notes\n';
      for (let i = 1; i <= 500; i++) {
        largeDataset += `${i},User${i},user${i}@example.com,555-000-${i.toString().padStart(4, '0')},Sample note ${i}\n`;
      }
      
      // Upload large file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-dataset.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(largeDataset)
      });
      
      // Wait for upload
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
      
      await page.screenshot({ path: 'test-results/pii-20-large-dataset-upload.png' });
    });

    await test.step('Monitor batch processing progress', async () => {
      // Verify batch processing started
      await expect(page.locator('[data-testid="batch-processing"]')).toBeVisible();
      
      // Monitor progress
      await expect(page.locator('[data-testid="processing-progress"]')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="batch-processing-complete"]')).toBeVisible({ timeout: 60000 });
      
      // Verify results summary
      await expect(page.locator('[data-testid="batch-results-summary"]')).toBeVisible();
      
      await page.screenshot({ path: 'test-results/pii-21-batch-complete.png' });
    });
  });
});