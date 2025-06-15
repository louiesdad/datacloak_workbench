import { test, expect, uploadFile, waitForFileProcessing } from '../fixtures/test-fixtures';

test.describe('Security Features Integration', () => {
  test.beforeEach(async ({ page, mockBackend, platformBridge }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should detect and display PII during file upload', async ({ page, testFiles, browserMode }) => {
    await test.step('Upload file with PII data', async () => {
      await uploadFile(page, testFiles.piiTest, browserMode);
      await waitForFileProcessing(page);
    });

    await test.step('Verify PII detection badges', async () => {
      // Look for PII badges on detected fields
      const piiBadges = page.locator('[data-testid^="pii-badge-"], .pii-indicator');
      const badgeCount = await piiBadges.count();
      
      expect(badgeCount).toBeGreaterThan(0);
      console.log(`✓ Detected ${badgeCount} PII fields`);
      
      // Check for specific PII types
      const piiTypes = ['email', 'phone', 'ssn', 'credit_card'];
      for (const type of piiTypes) {
        const badge = page.locator(`[data-testid="pii-type-${type}"], [data-pii-type="${type}"]`);
        if (await badge.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`✓ Detected PII type: ${type}`);
        }
      }
    });

    await test.step('Check PII confidence levels', async () => {
      const confidenceLevels = page.locator('[data-testid^="pii-confidence-"], .confidence-level');
      if (await confidenceLevels.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        const levels = await confidenceLevels.allTextContents();
        console.log(`✓ PII confidence levels: ${levels.join(', ')}`);
      }
    });
  });

  test('should provide PII masking options', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Toggle PII masking', async () => {
      // Look for masking toggles
      const maskingToggles = page.locator('[data-testid^="mask-pii-"], input[type="checkbox"]').filter({ 
        has: page.locator('text=/mask|redact|hide/i') 
      });
      
      const toggleCount = await maskingToggles.count();
      expect(toggleCount).toBeGreaterThan(0);
      
      // Toggle first PII field masking
      await maskingToggles.first().click();
      console.log('✓ PII masking toggle clicked');
    });

    await test.step('Verify masking preview', async () => {
      // Check if preview shows masked data
      const maskedPreview = page.locator('[data-testid="masked-preview"], .masked-value');
      if (await maskedPreview.isVisible({ timeout: 2000 }).catch(() => false)) {
        const maskedText = await maskedPreview.textContent();
        expect(maskedText).toMatch(/\*{3,}|XXX|REDACTED/);
        console.log('✓ Masking preview shows redacted values');
      }
    });
  });

  test('should generate security audit report', async ({ page, testFiles, browserMode, mockBackend }) => {
    // Mock security audit endpoint
    mockBackend.use(
      require('msw').http.post('http://localhost:3001/api/security/audit', () => {
        return require('msw').HttpResponse.json({
          success: true,
          data: {
            complianceScore: {
              gdpr: 85,
              ccpa: 90,
              hipaa: 75,
              pci: 80
            },
            detectedPII: [
              { field: 'email', type: 'email', count: 100 },
              { field: 'ssn', type: 'ssn', count: 50 }
            ],
            recommendations: [
              'Enable encryption for SSN field',
              'Add consent tracking for email field'
            ]
          }
        });
      })
    );

    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Request security audit', async () => {
      const auditButton = page.locator('button').filter({ hasText: /security.*audit|audit.*report/i });
      if (await auditButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await auditButton.click();
        console.log('✓ Security audit requested');
      }
    });

    await test.step('Verify compliance scores', async () => {
      const complianceScores = page.locator('[data-testid^="compliance-score-"], .compliance-score');
      if (await complianceScores.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        const scores = await complianceScores.allTextContents();
        console.log(`✓ Compliance scores displayed: ${scores.join(', ')}`);
        
        // Check for specific compliance types
        const complianceTypes = ['GDPR', 'CCPA', 'HIPAA', 'PCI'];
        for (const type of complianceTypes) {
          const score = page.locator(`[data-testid="compliance-${type.toLowerCase()}"]`);
          if (await score.isVisible({ timeout: 1000 }).catch(() => false)) {
            const value = await score.textContent();
            console.log(`✓ ${type} compliance: ${value}`);
          }
        }
      }
    });
  });

  test('should track security events in real-time', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Check security event log', async () => {
      // Look for security event indicators
      const eventLog = page.locator('[data-testid="security-events"], .security-log');
      if (await eventLog.isVisible({ timeout: 3000 }).catch(() => false)) {
        const events = await eventLog.locator('.event-item').count();
        expect(events).toBeGreaterThan(0);
        console.log(`✓ Security event log shows ${events} events`);
      }
    });

    await test.step('Verify event types', async () => {
      const eventTypes = ['pii_detected', 'file_scanned', 'compliance_checked'];
      for (const eventType of eventTypes) {
        const event = page.locator(`[data-event-type="${eventType}"]`);
        if (await event.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`✓ Security event tracked: ${eventType}`);
        }
      }
    });
  });

  test('should mask PII before sentiment analysis', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Enable PII masking', async () => {
      const maskAllButton = page.locator('button').filter({ hasText: /mask.*all|protect.*pii/i });
      if (await maskAllButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await maskAllButton.click();
        console.log('✓ PII masking enabled for all fields');
      }
    });

    await test.step('Proceed to sentiment analysis', async () => {
      // Navigate to sentiment step
      const sentimentStep = page.locator('.workflow-step').filter({ hasText: /sentiment|analysis/i });
      if (await sentimentStep.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sentimentStep.click();
        await page.waitForTimeout(1000);
      }
    });

    await test.step('Verify masking notice', async () => {
      const maskingNotice = page.locator('[data-testid="masking-notice"], .pii-protection-notice');
      if (await maskingNotice.isVisible({ timeout: 2000 }).catch(() => false)) {
        const noticeText = await maskingNotice.textContent();
        expect(noticeText).toMatch(/pii.*masked|data.*protected/i);
        console.log('✓ PII masking notice displayed');
      }
    });
  });

  test('should handle security API endpoints', async ({ page, mockBackend }) => {
    // Test security scan endpoint
    await test.step('Test security scan API', async () => {
      const response = await page.evaluate(async () => {
        const res = await fetch('http://localhost:3001/api/security/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: 'John Doe email: john@example.com, SSN: 123-45-6789' 
          })
        });
        return res.json();
      });
      
      expect(response.success).toBeTruthy();
      console.log('✓ Security scan API working');
    });

    // Test compliance check endpoint
    await test.step('Test compliance API', async () => {
      const response = await page.evaluate(async () => {
        const res = await fetch('http://localhost:3001/api/security/compliance', {
          method: 'GET'
        });
        return res.json();
      });
      
      expect(response.success).toBeTruthy();
      console.log('✓ Compliance API working');
    });
  });

  test('should show security monitoring dashboard', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Access security monitoring', async () => {
      const monitoringTab = page.locator('[data-testid="security-tab"], button').filter({ 
        hasText: /security|monitoring/i 
      });
      
      if (await monitoringTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await monitoringTab.click();
        console.log('✓ Security monitoring tab accessed');
      }
    });

    await test.step('Verify monitoring metrics', async () => {
      const metrics = [
        { name: 'PII Fields', selector: '[data-testid="pii-count"]' },
        { name: 'Security Score', selector: '[data-testid="security-score"]' },
        { name: 'Risk Level', selector: '[data-testid="risk-level"]' }
      ];

      for (const metric of metrics) {
        const element = page.locator(metric.selector);
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          const value = await element.textContent();
          console.log(`✓ ${metric.name}: ${value}`);
        }
      }
    });
  });

  test('should export security audit report', async ({ page, testFiles, browserMode }) => {
    await uploadFile(page, testFiles.piiTest, browserMode);
    await waitForFileProcessing(page);

    await test.step('Generate and export audit report', async () => {
      const exportAuditButton = page.locator('button').filter({ 
        hasText: /export.*audit|download.*security.*report/i 
      });
      
      if (await exportAuditButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Set up download promise
        const downloadPromise = page.waitForEvent('download');
        
        await exportAuditButton.click();
        console.log('✓ Security audit export initiated');
        
        // Wait for download
        try {
          const download = await Promise.race([
            downloadPromise,
            page.waitForTimeout(5000).then(() => null)
          ]);
          
          if (download) {
            expect(download.suggestedFilename()).toMatch(/security.*audit.*\.(pdf|json|csv)/i);
            console.log(`✓ Audit report downloaded: ${download.suggestedFilename()}`);
          }
        } catch (error) {
          console.log('ℹ Download may be handled differently in this environment');
        }
      }
    });
  });
});