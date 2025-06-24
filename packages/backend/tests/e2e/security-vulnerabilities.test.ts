import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { getDatabaseConnection } from '../../src/database/sqlite';
import * as jwt from 'jsonwebtoken';

describe('E2E: Security Vulnerabilities', () => {
  let app: Express;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    
    // Generate valid tokens for testing
    validToken = jwt.sign(
      { userId: 'test-user', role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    adminToken = jwt.sign(
      { userId: 'test-admin', role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in sentiment analysis', async () => {
      const maliciousInputs = [
        "'; DROP TABLE sentiment_analyses; --",
        "1' OR '1'='1",
        "admin'--",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --"
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/sentiment/analyze')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ text: input, model: 'basic' })
          .expect(200);

        // Should process as normal text, not execute SQL
        expect(response.body.data).toBeDefined();
        expect(response.body.data.text).toBe(input);
      }

      // Verify tables still exist
      const db = getDatabaseConnection();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      expect(tables.map(t => t.name)).toContain('sentiment_analyses');
    });

    it('should prevent SQL injection in search parameters', async () => {
      const response = await request(app)
        .get('/api/v1/sentiment/history')
        .set('Authorization', `Bearer ${validToken}`)
        .query({
          search: "'; DROP TABLE datasets; --",
          customerId: "test' OR 1=1 --"
        })
        .expect(200);

      expect(response.body.data).toBeDefined();
      
      // Verify table still exists
      const db = getDatabaseConnection();
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      expect(tables.map(t => t.name)).toContain('datasets');
    });
  });

  describe('XSS (Cross-Site Scripting) Prevention', () => {
    it('should sanitize HTML in input text', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<svg onload=alert("XSS")>',
        'javascript:alert("XSS")',
        '<body onload=alert("XSS")>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/sentiment/analyze')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ text: payload })
          .expect(200);

        // Should not contain executable scripts in response
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('onerror=');
        expect(responseText).not.toContain('javascript:');
      }
    });

    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '', // Empty token
        'Bearer ', // Just Bearer prefix
        jwt.sign({ userId: 'test' }, 'wrong-secret') // Wrong secret
      ];

      for (const token of invalidTokens) {
        await request(app)
          .get('/api/v1/sentiment/history')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });

    it('should prevent JWT algorithm confusion', async () => {
      // Try to use 'none' algorithm
      const maliciousToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.';
      
      const response = await request(app)
        .get('/api/v1/admin/config')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });

    it('should enforce role-based access control', async () => {
      // User trying to access admin endpoint
      await request(app)
        .get('/api/v1/admin/config')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      // Admin should have access
      await request(app)
        .get('/api/v1/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should prevent privilege escalation', async () => {
      // Try to modify user role
      const response = await request(app)
        .put('/api/v1/user/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Test User',
          role: 'admin' // Trying to escalate privileges
        })
        .expect(200);

      // Role should not be changed
      const profile = await request(app)
        .get('/api/v1/user/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(profile.body.data.role).toBe('user');
    });
  });

  describe('CSRF Protection', () => {
    it('should validate CSRF tokens for state-changing operations', async () => {
      // Get CSRF token
      const csrfResponse = await request(app)
        .get('/api/v1/csrf-token')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const csrfToken = csrfResponse.body.token;

      // Should reject without CSRF token
      await request(app)
        .post('/api/v1/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('test data'), 'test.csv')
        .expect(403);

      // Should accept with valid CSRF token
      await request(app)
        .post('/api/v1/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .attach('file', Buffer.from('test data'), 'test.csv')
        .expect(200);
    });
  });

  describe('Rate Limiting & Brute Force Protection', () => {
    it('should rate limit authentication attempts', async () => {
      const attempts = 10;
      const responses = [];

      // Make multiple login attempts
      for (let i = 0; i < attempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'admin',
            password: `wrong-password-${i}`
          });
        
        responses.push(response.status);
      }

      // Should start blocking after threshold
      const blockedResponses = responses.filter(status => status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
    });

    it('should implement exponential backoff for repeated failures', async () => {
      let delayMs = 0;
      
      // First failure
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401);

      // Check retry-after header increases
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'wrong' });
        
        if (response.status === 429) {
          const newDelay = parseInt(response.headers['retry-after'] || '0');
          expect(newDelay).toBeGreaterThan(delayMs);
          delayMs = newDelay;
        }
      }
    });
  });

  describe('Session Security', () => {
    it('should invalidate tokens on logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' })
        .expect(200);

      const token = loginResponse.body.token;

      // Use token successfully
      await request(app)
        .get('/api/v1/sentiment/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Token should be invalidated
      await request(app)
        .get('/api/v1/sentiment/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should prevent session fixation', async () => {
      // Get session before login
      const preLoginResponse = await request(app)
        .get('/api/auth/session')
        .expect(200);

      const oldSessionId = preLoginResponse.body.sessionId;

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' })
        .expect(200);

      // Session ID should change after login
      expect(loginResponse.body.sessionId).not.toBe(oldSessionId);
    });
  });

  describe('File Upload Security', () => {
    it('should reject malicious file types', async () => {
      const maliciousFiles = [
        { name: 'exploit.exe', content: 'MZ executable content' },
        { name: 'script.js', content: 'malicious javascript' },
        { name: 'shell.sh', content: '#!/bin/bash\nrm -rf /' },
        { name: 'payload.php', content: '<?php system($_GET["cmd"]); ?>' }
      ];

      for (const file of maliciousFiles) {
        await request(app)
          .post('/api/v1/data/upload')
          .set('Authorization', `Bearer ${validToken}`)
          .attach('file', Buffer.from(file.content), file.name)
          .expect(400);
      }
    });

    it('should prevent path traversal in file operations', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'uploads/../../../config.json',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const path of pathTraversalAttempts) {
        await request(app)
          .get(`/api/v1/data/download/${encodeURIComponent(path)}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(400);
      }
    });

    it('should limit file upload size', async () => {
      // Create large file (10MB)
      const largeFile = Buffer.alloc(10 * 1024 * 1024, 'x');
      
      const response = await request(app)
        .post('/api/v1/data/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', largeFile, 'large.csv')
        .expect(413);

      expect(response.body.error).toContain('File too large');
    });
  });

  describe('API Key Security', () => {
    it('should never expose API keys in responses', async () => {
      const endpoints = [
        '/api/v1/config/current',
        '/api/v1/admin/config',
        '/api/v1/health/status',
        '/api/v1/monitoring/diagnostics'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const responseText = JSON.stringify(response.body);
        
        // Should not contain full API keys
        expect(responseText).not.toMatch(/sk-[a-zA-Z0-9]{48,}/);
        expect(responseText).not.toContain(process.env.OPENAI_API_KEY);
      }
    });

    it('should validate API key format on configuration', async () => {
      const invalidKeys = [
        'not-an-api-key',
        'sk_live_invalid', // Wrong prefix
        'sk-', // Too short
        'sk-' + 'a'.repeat(100) // Too long
      ];

      for (const key of invalidKeys) {
        await request(app)
          .put('/api/v1/admin/config')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ openaiApiKey: key })
          .expect(400);
      }
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not leak sensitive information in errors', async () => {
      // Trigger various errors
      const errorResponses = await Promise.all([
        request(app).get('/api/v1/nonexistent').set('Authorization', `Bearer ${validToken}`),
        request(app).post('/api/v1/sentiment/analyze').send({}), // Missing auth
        request(app).get('/api/v1/data/datasets/../../etc/passwd').set('Authorization', `Bearer ${validToken}`)
      ]);

      for (const response of errorResponses) {
        const errorText = JSON.stringify(response.body);
        
        // Should not contain sensitive info
        expect(errorText).not.toContain('stack');
        expect(errorText).not.toContain('database');
        expect(errorText).not.toContain('password');
        expect(errorText).not.toContain('/Users/');
        expect(errorText).not.toContain('\\Users\\');
      }
    });
  });
});