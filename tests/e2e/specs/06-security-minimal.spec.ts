import { test, expect } from '@playwright/test';

/**
 * Minimal Security Features Test
 * Tests that security API mocking works correctly
 */

test.describe('Security Features - Minimal', () => {
  
  test('should successfully mock security-related API endpoints', async ({ page }) => {
    console.log('🔒 Testing Security API Mocking');
    
    // Set up security API mocks
    let uploadCalled = false;
    let securityScanCalled = false;
    
    await page.route('**/api/v1/data/upload', async (route) => {
      uploadCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataset: { datasetId: 'test-123', status: 'ready' },
            securityScan: {
              piiItemsDetected: 2,
              securityScore: 85,
              riskLevel: 'medium'
            }
          }
        })
      });
    });

    await page.route('**/api/v1/security/scan', async (route) => {
      securityScanCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            vulnerabilities: ['unencrypted_pii'],
            recommendations: ['Enable encryption']
          }
        })
      });
    });

    // Navigate to application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify the page loads
    await expect(page.locator('body')).toBeVisible();
    
    // Test that our mocks would respond correctly by making requests from the page context
    const uploadResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/data/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });
      return { status: response.status, data: await response.json() };
    });
    expect(uploadResult.status).toBe(200);
    
    const securityResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/security/scan');
      return { status: response.status, data: await response.json() };
    });
    expect(securityResult.status).toBe(200);
    
    await page.screenshot({ path: 'test-results/security-minimal-01-mocking-works.png' });
    
    console.log('✅ Security API mocking is working correctly');
  });

  test('should demonstrate PII detection API mock', async ({ page }) => {
    console.log('🔍 Testing PII Detection API Mock');
    
    await page.route('**/api/v1/pii/detect', async (route) => {
      const requestData = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            pii_detected: [
              {
                type: 'EMAIL',
                confidence: 0.95,
                matches: ['john@example.com'],
                risk_level: 'medium'
              }
            ],
            overall_risk_score: 75
          }
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test PII detection API
    const piiResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/pii/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Contact john@example.com for support' })
      });
      return { status: response.status, data: await response.json() };
    });
    
    expect(piiResult.status).toBe(200);
    expect(piiResult.data.success).toBe(true);
    expect(piiResult.data.data.pii_detected).toHaveLength(1);
    
    await page.screenshot({ path: 'test-results/security-minimal-02-pii-mock.png' });
    
    console.log('✅ PII detection API mock is working correctly');
  });

  test('should demonstrate compliance framework API mock', async ({ page }) => {
    console.log('⚖️ Testing Compliance Framework API Mock');
    
    await page.route('**/api/v1/compliance/frameworks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['HIPAA', 'PCI_DSS', 'GDPR', 'CCPA'])
      });
    });

    await page.route('**/api/v1/risk-assessment/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            risk_score: 78,
            compliance_status: [
              {
                framework: 'HIPAA',
                compliant: false,
                violations: ['Missing encryption'],
                recommendations: ['Enable field-level encryption']
              }
            ]
          }
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test compliance frameworks API
    const frameworksResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/compliance/frameworks');
      return { status: response.status, data: await response.json() };
    });
    expect(frameworksResult.status).toBe(200);
    expect(frameworksResult.data).toContain('HIPAA');
    expect(frameworksResult.data).toContain('GDPR');

    // Test risk assessment API
    const riskResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/risk-assessment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['Sample text with PII'], complianceFramework: 'HIPAA' })
      });
      return { status: response.status, data: await response.json() };
    });
    
    expect(riskResult.status).toBe(200);
    expect(riskResult.data.success).toBe(true);
    expect(riskResult.data.data.risk_score).toBe(78);
    
    await page.screenshot({ path: 'test-results/security-minimal-03-compliance-mock.png' });
    
    console.log('✅ Compliance framework API mocks are working correctly');
  });

  test('should test error handling in security APIs', async ({ page }) => {
    console.log('🚨 Testing Security API Error Handling');
    
    await page.route('**/api/v1/security/scan', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Security service temporarily unavailable',
            code: 'SERVICE_UNAVAILABLE'
          }
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test error response
    const errorResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/security/scan');
      return { status: response.status, data: await response.json() };
    });
    expect(errorResult.status).toBe(503);
    expect(errorResult.data.error.code).toBe('SERVICE_UNAVAILABLE');
    
    await page.screenshot({ path: 'test-results/security-minimal-04-error-handling.png' });
    
    console.log('✅ Security API error handling is working correctly');
  });

  test('should validate complete security workflow mock', async ({ page }) => {
    console.log('🔄 Testing Complete Security Workflow');
    
    // Set up comprehensive mock for a complete security workflow
    await page.route('**/api/v1/data/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            dataset: {
              datasetId: 'workflow-test-123',
              status: 'ready',
              recordCount: 100
            },
            fieldInfo: [
              { name: 'id', type: 'integer', piiDetected: false },
              { name: 'email', type: 'email', piiDetected: true, piiType: 'EMAIL' },
              { name: 'comment', type: 'text', piiDetected: false }
            ],
            securityScan: {
              piiItemsDetected: 1,
              securityScore: 85,
              riskLevel: 'medium',
              recommendations: ['Consider data masking for email field']
            }
          }
        })
      });
    });

    await page.route('**/api/v1/compliance/report', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            report_id: 'report-123',
            framework: 'GDPR',
            overall_score: 82,
            compliance_status: 'Partially Compliant',
            recommendations: [
              'Implement data subject access rights',
              'Enable consent management',
              'Add data retention policies'
            ]
          }
        })
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test the workflow APIs in sequence
    const uploadResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/data/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'test.csv' })
      });
      return { status: response.status, data: await response.json() };
    });
    expect(uploadResult.status).toBe(200);
    
    const reportResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/compliance/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ framework: 'GDPR' })
      });
      return { status: response.status, data: await response.json() };
    });
    expect(reportResult.status).toBe(200);
    expect(reportResult.data.data.overall_score).toBe(82);
    expect(reportResult.data.data.recommendations).toHaveLength(3);
    
    await page.screenshot({ path: 'test-results/security-minimal-05-workflow-complete.png' });
    
    console.log('✅ Complete security workflow mock is working correctly');
  });
});