import { describe, beforeAll, it, expect } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';
import { initializeDatabases } from '../../src/database';

describe('Security API Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SQLITE_DB_PATH = ':memory:';
    
    // Initialize databases
    await initializeDatabases();
    
    // Create app
    app = await createApp();
  });

  describe('PII Detection', () => {
    it('should detect PII in text', async () => {
      const testText = 'My email is john.doe@example.com and my phone is 555-123-4567';
      
      const response = await request(app)
        .post('/api/v1/security/detect')
        .send({ text: testText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('detectedPII');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.detectedPII)).toBe(true);
    });

    it('should validate PII detection input', async () => {
      const response = await request(app)
        .post('/api/v1/security/detect')
        .send({ text: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle no PII found', async () => {
      const testText = 'This is just regular text with no personal information';
      
      const response = await request(app)
        .post('/api/v1/security/detect')
        .send({ text: testText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.detectedPII).toHaveLength(0);
      expect(response.body.data.summary.totalDetections).toBe(0);
    });
  });

  describe('Text Masking', () => {
    it('should mask PII in text', async () => {
      const testText = 'Contact me at john.doe@example.com';
      
      const response = await request(app)
        .post('/api/v1/security/mask')
        .send({ text: testText })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('originalText');
      expect(response.body.data).toHaveProperty('maskedText');
      expect(response.body.data).toHaveProperty('detectedPII');
      expect(response.body.data).toHaveProperty('metadata');
    });

    it('should validate masking input', async () => {
      const response = await request(app)
        .post('/api/v1/security/mask')
        .send({ text: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('File Audit', () => {
    it('should audit a file', async () => {
      const testFilePath = '/tmp/test-file.csv';
      
      const response = await request(app)
        .post('/api/v1/security/audit/file')
        .send({ filePath: testFilePath })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('auditResult');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.auditResult).toHaveProperty('complianceScore');
      expect(response.body.data.auditResult).toHaveProperty('recommendations');
    });

    it('should validate audit input', async () => {
      const response = await request(app)
        .post('/api/v1/security/audit/file')
        .send({ filePath: '' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Security Metrics', () => {
    it('should return security metrics', async () => {
      const response = await request(app)
        .get('/api/v1/security/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.metrics).toHaveProperty('totalScans');
      expect(response.body.data.metrics).toHaveProperty('piiItemsDetected');
      expect(response.body.data.metrics).toHaveProperty('complianceScore');
    });
  });

  describe('Security Status', () => {
    it('should return security status', async () => {
      const response = await request(app)
        .get('/api/v1/security/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('details');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data.details).toHaveProperty('dataCloakAvailable');
      expect(response.body.data.details).toHaveProperty('piiDetectionActive');
    });
  });

  describe('Audit History', () => {
    it('should return audit history with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit/history?page=1&pageSize=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.data)).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('pageSize');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    it('should validate page size limits', async () => {
      const response = await request(app)
        .get('/api/v1/security/audit/history?pageSize=150')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'PAGE_SIZE_TOO_LARGE');
    });
  });
});