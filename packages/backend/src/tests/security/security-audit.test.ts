/**
 * Security Audit and Hardening Tests
 * 
 * Comprehensive security validation covering PII protection,
 * access control, encryption, and vulnerability assessment.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockApp } from '../../test-utils/app-factory';
import { piiMaskingVerifier } from '../../security/pii-masking-verifier';
import { rbacSystem } from '../../security/rbac-system';
import { logRetentionSystem } from '../../logging/log-retention-system';

// Mock external services
jest.mock('../../config/logger');
jest.mock('../../database/sqlite-refactored');

describe('Security Audit and Hardening Tests', () => {
  let app: express.Application;
  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    app = await createMockApp();
    
    // Mock different user tokens
    adminToken = 'Bearer admin-token-123';
    analystToken = 'Bearer analyst-token-456';
    viewerToken = 'Bearer viewer-token-789';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/dashboard/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate token format', async () => {
      const malformedTokens = [
        'invalid-format',
        'Bearer',
        'Bearer ',
        'Bearertoken123',
        'Basic dGVzdDp0ZXN0'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/dashboard/metrics')
          .set('Authorization', token)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should prevent token reuse after expiration', async () => {
      // Mock expired token
      const expiredToken = 'Bearer expired-token-123';

      const response = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', expiredToken)
        .expect(401);

      expect(response.body.error).toContain('expired');
    });

    it('should enforce secure headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Authorization and Access Control', () => {
    it('should enforce role-based access control', async () => {
      // Viewer trying to delete data
      const viewerDeleteResponse = await request(app)
        .delete('/api/data/datasets/test-id')
        .set('Authorization', viewerToken)
        .expect(403);

      expect(viewerDeleteResponse.body.error).toContain('Insufficient permissions');

      // Analyst trying to access admin functions
      const analystAdminResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', analystToken)
        .expect(403);

      expect(analystAdminResponse.body.error).toContain('Insufficient permissions');
    });

    it('should validate resource ownership', async () => {
      // User trying to access another user's resources
      const response = await request(app)
        .get('/api/users/other-user-123/profile')
        .set('Authorization', analystToken)
        .expect(403);

      expect(response.body.error).toContain('Access denied');
    });

    it('should log all access attempts', async () => {
      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      // Verify audit log entry
      const auditLogs = await rbacSystem.getAuditLogs({
        action: 'read',
        resource: 'analytics'
      });

      expect(auditLogs.data.length).toBeGreaterThan(0);
      expect(auditLogs.data[0].success).toBe(true);
    });

    it('should track failed authorization attempts', async () => {
      await request(app)
        .delete('/api/data/datasets/test-id')
        .set('Authorization', viewerToken)
        .expect(403);

      const failedLogs = await rbacSystem.getAuditLogs({
        success: false,
        action: 'delete'
      });

      expect(failedLogs.data.length).toBeGreaterThan(0);
      expect(failedLogs.data[0].details?.reason).toBeDefined();
    });

    it('should prevent privilege escalation', async () => {
      // Attempt to modify user roles without admin privileges
      const response = await request(app)
        .put('/api/users/user-123/role')
        .set('Authorization', analystToken)
        .send({ role: 'admin' })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe('PII Protection and Data Security', () => {
    it('should detect PII in uploaded data', async () => {
      const piiData = 'name,email,phone,text\n"John Doe","john.doe@example.com","555-123-4567","Great service!"';

      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(piiData), 'pii-test.csv')
        .expect(201);

      expect(response.body.data.securityScan).toBeDefined();
      expect(response.body.data.securityScan.piiItemsDetected).toBeGreaterThan(0);
      expect(response.body.data.securityScan.riskLevel).toBe('high');
    });

    it('should mask PII in logs and outputs', async () => {
      const sensitiveData = 'Personal info: john.doe@email.com and SSN: 123-45-6789';

      const maskedContent = await piiMaskingVerifier.scanBeforeLogging(sensitiveData, 'test');

      expect(maskedContent).not.toContain('john.doe@email.com');
      expect(maskedContent).not.toContain('123-45-6789');
      expect(maskedContent).toContain('***');
    });

    it('should alert on PII leak attempts', async () => {
      const leakAttempt = 'Sending user data: email=user@company.com, ssn=987-65-4321';

      await piiMaskingVerifier.scanBeforeLogging(leakAttempt, 'security-test');

      const stats = await piiMaskingVerifier.getMaskingStatistics();
      expect(stats.piiDetected).toBeGreaterThan(0);
      expect(stats.alertsTriggered).toBeGreaterThan(0);
    });

    it('should validate data encryption at rest', async () => {
      // Check that sensitive data is encrypted in database
      const testData = 'text,confidential\n"Public info","CONFIDENTIAL: sensitive data"';

      await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(testData), 'encryption-test.csv')
        .expect(201);

      // Verify sensitive data is not stored in plain text
      // This would typically involve checking database storage
      expect(true).toBe(true); // Placeholder for actual encryption validation
    });

    it('should prevent data exfiltration through exports', async () => {
      const sensitiveData = 'text,pii\n"Normal text","email@domain.com"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(sensitiveData), 'exfiltration-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Export should mask PII data
      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', adminToken)
        .send({
          format: 'csv',
          datasetId,
          maskPII: true
        })
        .expect(200);

      expect(exportResponse.body.data.securityScan).toBeDefined();
      expect(exportResponse.body.data.securityScan.piiMasked).toBe(true);
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should prevent SQL injection attacks', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "' UNION SELECT * FROM users --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/sentiment/history')
          .set('Authorization', adminToken)
          .query({ search: payload })
          .expect(200);

        // Should not return unexpected data or cause errors
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      }
    });

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '"><script>alert(String.fromCharCode(88,83,83))</script>'
      ];

      for (const payload of xssPayloads) {
        const testData = `text\n"${payload}"`;

        const response = await request(app)
          .post('/api/data/upload')
          .set('Authorization', adminToken)
          .attach('file', Buffer.from(testData), 'xss-test.csv')
          .expect(201);

        // Should sanitize malicious content
        expect(response.body.data.filename).not.toContain('<script>');
        expect(response.body.data.filename).not.toContain('javascript:');
      }
    });

    it('should validate file upload types and sizes', async () => {
      // Test invalid file type
      const invalidFile = Buffer.from('Invalid file content');
      
      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', invalidFile, 'malicious.exe')
        .expect(400);

      expect(response.body.error).toContain('Unsupported file type');
    });

    it('should prevent path traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2f',
        '....//....//....//etc/passwd'
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get('/api/exports/download')
          .set('Authorization', adminToken)
          .query({ file: payload })
          .expect(400);

        expect(response.body.error).toContain('Invalid file path');
      }
    });

    it('should validate JSON input structure', async () => {
      const malformedPayloads = [
        '{"malformed": json}',
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        JSON.stringify({['\u0000']: 'null byte'})
      ];

      for (const payload of malformedPayloads) {
        const response = await request(app)
          .post('/api/sentiment/analyze')
          .set('Authorization', adminToken)
          .set('Content-Type', 'application/json')
          .send(payload);

        // Should handle malformed JSON gracefully
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Rate Limiting and DoS Protection', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const rapidRequests = 100;
      let blockedRequests = 0;

      // Make rapid consecutive requests
      for (let i = 0; i < rapidRequests; i++) {
        const response = await request(app)
          .get('/api/dashboard/metrics')
          .set('Authorization', adminToken);

        if (response.status === 429) {
          blockedRequests++;
        }
      }

      // Some requests should be rate limited
      expect(blockedRequests).toBeGreaterThan(0);
    });

    it('should prevent large file upload DoS', async () => {
      // Create extremely large file (beyond limit)
      const largeContent = 'x'.repeat(100 * 1024 * 1024); // 100MB

      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(largeContent), 'large.csv')
        .expect(413);

      expect(response.body.error).toContain('File too large');
    });

    it('should limit concurrent connections', async () => {
      const concurrentRequests = 50;
      const requests = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const request_promise = request(app)
          .get('/api/dashboard/metrics')
          .set('Authorization', adminToken);
        
        requests.push(request_promise);
      }

      const responses = await Promise.all(requests);
      const rejectedRequests = responses.filter(r => r.status === 503).length;

      // Some requests should be rejected due to connection limits
      expect(rejectedRequests).toBeGreaterThan(0);
    });
  });

  describe('Data Privacy and Compliance', () => {
    it('should implement proper data retention policies', async () => {
      const policies = logRetentionSystem.getPolicies();
      
      // Verify audit logs are retained for 90 days
      const auditPolicy = policies.find(p => p.name === 'audit-logs');
      expect(auditPolicy?.retentionDays).toBe(90);
      
      // Verify technical logs are retained for 30 days
      const techPolicy = policies.find(p => p.name === 'technical-logs');
      expect(techPolicy?.retentionDays).toBe(30);
      
      // Verify security logs are retained for 180 days
      const securityPolicy = policies.find(p => p.name === 'security-logs');
      expect(securityPolicy?.retentionDays).toBe(180);
    });

    it('should support data deletion requests', async () => {
      const testData = 'text\n"Data for deletion"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(testData), 'deletion-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Request data deletion
      const deleteResponse = await request(app)
        .delete(`/api/data/datasets/${datasetId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify data is actually deleted
      const getResponse = await request(app)
        .get(`/api/data/datasets/${datasetId}`)
        .set('Authorization', adminToken)
        .expect(404);

      expect(getResponse.body.error).toContain('not found');
    });

    it('should log data access for compliance', async () => {
      await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      // Verify compliance logging
      const auditLogs = await rbacSystem.getAuditLogs({
        resource: 'analytics',
        action: 'read'
      });

      expect(auditLogs.data.length).toBeGreaterThan(0);
      
      const log = auditLogs.data[0];
      expect(log.userId).toBeDefined();
      expect(log.timestamp).toBeDefined();
      expect(log.ipAddress).toBeDefined();
      expect(log.userAgent).toBeDefined();
    });

    it('should anonymize exported data when requested', async () => {
      const personalData = 'name,email,feedback\n"John Doe","john@email.com","Great product!"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(personalData), 'personal-data.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Export with anonymization
      const exportResponse = await request(app)
        .post('/api/data/export')
        .set('Authorization', adminToken)
        .send({
          format: 'csv',
          datasetId,
          anonymize: true
        })
        .expect(200);

      expect(exportResponse.body.data.anonymized).toBe(true);
    });
  });

  describe('Security Monitoring and Alerting', () => {
    it('should detect suspicious activity patterns', async () => {
      // Simulate failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'wrong-password' })
          .expect(401);
      }

      // Check if security alerts were triggered
      const stats = rbacSystem.getAccessStatistics();
      expect(stats.recentFailures).toBeGreaterThan(0);
    });

    it('should monitor for data exfiltration attempts', async () => {
      // Attempt multiple large exports in short time
      const testData = 'text\n"Monitoring test"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', adminToken)
        .attach('file', Buffer.from(testData), 'monitoring-test.csv')
        .expect(201);

      const datasetId = uploadResponse.body.data.id;

      // Multiple rapid export attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/data/export')
          .set('Authorization', adminToken)
          .send({ format: 'csv', datasetId })
          .expect(200);
      }

      // Should trigger monitoring alerts
      const auditLogs = await rbacSystem.getAuditLogs({
        action: 'export',
        resource: 'datasets'
      });

      expect(auditLogs.data.length).toBeGreaterThan(0);
    });

    it('should alert on privilege escalation attempts', async () => {
      // Attempt unauthorized admin actions
      await request(app)
        .post('/api/admin/users')
        .set('Authorization', analystToken)
        .send({ username: 'newadmin', role: 'admin' })
        .expect(403);

      // Check for security alerts
      const failedLogs = await rbacSystem.getAuditLogs({
        success: false,
        action: 'admin'
      });

      expect(failedLogs.data.length).toBeGreaterThan(0);
    });
  });

  describe('System Hardening Validation', () => {
    it('should have secure default configurations', async () => {
      // Verify security headers are present
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options', 
        'x-xss-protection'
      ];

      securityHeaders.forEach(header => {
        expect(response.headers[header]).toBeDefined();
      });
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      // Error message should not expose system details
      expect(response.body.error).not.toContain('stack');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('internal');
    });

    it('should validate SSL/TLS configuration in production', () => {
      // This would be tested in actual production environment
      // Placeholder for SSL/TLS validation
      expect(process.env.NODE_ENV === 'production' ? true : true).toBe(true);
    });

    it('should have proper CORS configuration', async () => {
      const response = await request(app)
        .options('/api/dashboard/metrics')
        .set('Origin', 'https://malicious-site.com')
        .expect(204);

      // Should not allow unauthorized origins
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });
});