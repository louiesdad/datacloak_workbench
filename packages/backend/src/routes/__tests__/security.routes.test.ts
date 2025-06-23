import request from 'supertest';
import express from 'express';
import securityRoutes from '../security.routes';

const app = express();
app.use(express.json());
app.use('/api/security', securityRoutes);

// Mock the security controller
jest.mock('../../controllers/security.controller', () => ({
  SecurityController: jest.fn().mockImplementation(() => ({
    detectPII: jest.fn((req, res) => {
      const { text } = req.body;
      if (text.includes('error')) {
        return res.status(500).json({ error: 'Detection failed' });
      }
      res.status(200).json({
        data: {
          hasPII: text.includes('john@example.com'),
          detected: text.includes('john@example.com') ? [
            { type: 'email', value: 'john@example.com', confidence: 0.95 }
          ] : [],
          riskLevel: 'medium'
        }
      });
    }),
    maskText: jest.fn((req, res) => {
      const { text, maskType = 'asterisk' } = req.body;
      if (text.includes('error')) {
        return res.status(500).json({ error: 'Masking failed' });
      }
      const masked = text.replace(/john@example\.com/g, maskType === 'asterisk' ? '****@***.com' : '[EMAIL]');
      res.status(200).json({
        data: {
          originalText: text,
          maskedText: masked,
          maskType,
          detectedTypes: ['email']
        }
      });
    }),
    auditFile: jest.fn((req, res) => {
      const { filePath } = req.body;
      if (filePath.includes('nonexistent')) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (filePath.includes('error')) {
        return res.status(500).json({ error: 'Audit failed' });
      }
      res.status(200).json({
        data: {
          filePath,
          auditId: 'audit-123',
          findings: [
            { type: 'email', count: 2, riskLevel: 'medium' }
          ],
          overallRisk: 'medium',
          timestamp: Date.now()
        }
      });
    }),
    scanDataset: jest.fn((req, res) => {
      const { datasetId } = req.body;
      if (datasetId === 'nonexistent') {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      if (datasetId === 'error') {
        return res.status(500).json({ error: 'Scan failed' });
      }
      res.status(200).json({
        data: {
          datasetId,
          scanId: 'scan-456',
          status: 'in_progress',
          estimatedCompletion: Date.now() + 30000
        }
      });
    }),
    getMetrics: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          totalScans: 150,
          piiDetected: 45,
          riskDistribution: {
            low: 80,
            medium: 50,
            high: 20
          },
          avgProcessingTime: 2.5
        }
      });
    }),
    getAuditHistory: jest.fn((req, res) => {
      const { limit = 10, offset = 0 } = req.query;
      res.status(200).json({
        data: {
          audits: [
            { id: 'audit-1', type: 'file', timestamp: Date.now(), riskLevel: 'medium' },
            { id: 'audit-2', type: 'dataset', timestamp: Date.now() - 3600000, riskLevel: 'low' }
          ].slice(Number(offset), Number(offset) + Number(limit)),
          total: 25,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < 25
          }
        }
      });
    }),
    getSecurityStatus: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          status: 'healthy',
          services: {
            piiDetection: 'operational',
            masking: 'operational',
            auditing: 'operational'
          },
          lastHealthCheck: Date.now(),
          version: '1.0.0'
        }
      });
    })
  }))
}));

// Mock validation middleware
jest.mock('../../middleware/validation.middleware', () => ({
  validateBody: jest.fn(() => (req, res, next) => next())
}));

// Mock validation schemas
jest.mock('../../validation/schemas', () => ({
  securitySchemas: {
    detectPII: {},
    maskText: {},
    auditFile: {},
    scanDataset: {}
  }
}));

describe('Security Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PII Detection Routes', () => {
    test('POST /api/security/detect should detect PII in text', async () => {
      const testData = {
        text: 'Contact john@example.com for more information'
      };

      const response = await request(app)
        .post('/api/security/detect')
        .send(testData)
        .expect(200);

      expect(response.body).toEqual({
        data: {
          hasPII: true,
          detected: [
            { type: 'email', value: 'john@example.com', confidence: 0.95 }
          ],
          riskLevel: 'medium'
        }
      });
    });

    test('POST /api/security/detect should handle text without PII', async () => {
      const testData = {
        text: 'This is a normal text without sensitive information'
      };

      const response = await request(app)
        .post('/api/security/detect')
        .send(testData)
        .expect(200);

      expect(response.body).toEqual({
        data: {
          hasPII: false,
          detected: [],
          riskLevel: 'medium'
        }
      });
    });

    test('POST /api/security/detect should handle detection errors', async () => {
      const testData = {
        text: 'error trigger text'
      };

      const response = await request(app)
        .post('/api/security/detect')
        .send(testData)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Detection failed'
      });
    });

    test('POST /api/security/mask should mask sensitive text', async () => {
      const testData = {
        text: 'Contact john@example.com for more information',
        maskType: 'asterisk'
      };

      const response = await request(app)
        .post('/api/security/mask')
        .send(testData)
        .expect(200);

      expect(response.body).toEqual({
        data: {
          originalText: testData.text,
          maskedText: 'Contact ****@***.com for more information',
          maskType: 'asterisk',
          detectedTypes: ['email']
        }
      });
    });

    test('POST /api/security/mask should use default mask type', async () => {
      const testData = {
        text: 'Contact john@example.com for more information'
      };

      const response = await request(app)
        .post('/api/security/mask')
        .send(testData)
        .expect(200);

      expect(response.body.data.maskType).toBe('asterisk');
    });

    test('POST /api/security/mask should handle masking errors', async () => {
      const testData = {
        text: 'error trigger text'
      };

      const response = await request(app)
        .post('/api/security/mask')
        .send(testData)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Masking failed'
      });
    });
  });

  describe('File and Dataset Security Routes', () => {
    test('POST /api/security/audit/file should audit file for PII', async () => {
      const testData = {
        filePath: '/uploads/test-file.csv'
      };

      const response = await request(app)
        .post('/api/security/audit/file')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          filePath: testData.filePath,
          auditId: 'audit-123',
          findings: [
            { type: 'email', count: 2, riskLevel: 'medium' }
          ],
          overallRisk: 'medium'
        }
      });
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('POST /api/security/audit/file should handle file not found', async () => {
      const testData = {
        filePath: '/uploads/nonexistent-file.csv'
      };

      const response = await request(app)
        .post('/api/security/audit/file')
        .send(testData)
        .expect(404);

      expect(response.body).toEqual({
        error: 'File not found'
      });
    });

    test('POST /api/security/audit/file should handle audit errors', async () => {
      const testData = {
        filePath: '/uploads/error-file.csv'
      };

      const response = await request(app)
        .post('/api/security/audit/file')
        .send(testData)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Audit failed'
      });
    });

    test('POST /api/security/scan/dataset should scan dataset for PII', async () => {
      const testData = {
        datasetId: 'dataset-123'
      };

      const response = await request(app)
        .post('/api/security/scan/dataset')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          datasetId: testData.datasetId,
          scanId: 'scan-456',
          status: 'in_progress'
        }
      });
      expect(response.body.data).toHaveProperty('estimatedCompletion');
    });

    test('POST /api/security/scan/dataset should handle dataset not found', async () => {
      const testData = {
        datasetId: 'nonexistent'
      };

      const response = await request(app)
        .post('/api/security/scan/dataset')
        .send(testData)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Dataset not found'
      });
    });

    test('POST /api/security/scan/dataset should handle scan errors', async () => {
      const testData = {
        datasetId: 'error'
      };

      const response = await request(app)
        .post('/api/security/scan/dataset')
        .send(testData)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Scan failed'
      });
    });
  });

  describe('Metrics and Monitoring Routes', () => {
    test('GET /api/security/metrics should return security metrics', async () => {
      const response = await request(app)
        .get('/api/security/metrics')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          totalScans: 150,
          piiDetected: 45,
          riskDistribution: {
            low: 80,
            medium: 50,
            high: 20
          },
          avgProcessingTime: 2.5
        }
      });
    });

    test('GET /api/security/audit/history should return audit history', async () => {
      const response = await request(app)
        .get('/api/security/audit/history')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          audits: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              type: expect.any(String),
              riskLevel: expect.any(String)
            })
          ]),
          total: 25,
          pagination: {
            limit: 10,
            offset: 0,
            hasMore: true
          }
        }
      });
    });

    test('GET /api/security/audit/history should handle pagination', async () => {
      const response = await request(app)
        .get('/api/security/audit/history?limit=5&offset=5')
        .expect(200);

      expect(response.body.data.pagination).toEqual({
        limit: 5,
        offset: 5,
        hasMore: true
      });
    });

    test('GET /api/security/status should return security service status', async () => {
      const response = await request(app)
        .get('/api/security/status')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          status: 'healthy',
          services: {
            piiDetection: 'operational',
            masking: 'operational',
            auditing: 'operational'
          },
          version: '1.0.0'
        }
      });
      expect(response.body.data).toHaveProperty('lastHealthCheck');
    });
  });

  describe('Validation and Middleware', () => {
    test('should call validation middleware for all POST endpoints', async () => {
      const { validateBody } = require('../../middleware/validation.middleware');
      
      await request(app).post('/api/security/detect').send({ text: 'test' });
      await request(app).post('/api/security/mask').send({ text: 'test' });
      await request(app).post('/api/security/audit/file').send({ filePath: '/test' });
      await request(app).post('/api/security/scan/dataset').send({ datasetId: 'test' });

      // validateBody is mocked to return a middleware function, so check it was called
      expect(validateBody).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text in PII detection', async () => {
      await request(app)
        .post('/api/security/detect')
        .send({ text: '' })
        .expect(200);
    });

    test('should handle large text inputs', async () => {
      const largeText = 'x'.repeat(10000);
      await request(app)
        .post('/api/security/detect')
        .send({ text: largeText })
        .expect(200);
    });

    test('should handle special characters in file paths', async () => {
      await request(app)
        .post('/api/security/audit/file')
        .send({ filePath: '/uploads/file-with-special-chars_@#$.csv' })
        .expect(200);
    });

    test('should handle different mask types', async () => {
      await request(app)
        .post('/api/security/mask')
        .send({ text: 'test john@example.com', maskType: 'redact' })
        .expect(200);
    });

    test('should handle invalid dataset IDs', async () => {
      await request(app)
        .post('/api/security/scan/dataset')
        .send({ datasetId: '' })
        .expect(200);
    });
  });
});