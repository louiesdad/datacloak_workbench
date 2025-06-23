import request from 'supertest';
import express from 'express';
import complianceRoutes from '../compliance.routes';

const app = express();
app.use(express.json());
app.use('/api/compliance', complianceRoutes);

// Mock the compliance controller
jest.mock('../../controllers/compliance.controller', () => ({
  complianceController: {
    getDashboard: jest.fn((req, res) => res.status(200).json({
      data: {
        overallScore: 85,
        frameworks: ['GDPR', 'CCPA', 'SOX'],
        issues: 3,
        lastAudit: '2024-01-15T10:30:00Z'
      }
    })),
    getComplianceHealth: jest.fn((req, res) => res.status(200).json({
      status: 'compliant',
      score: 85,
      timestamp: Date.now()
    })),
    performAudit: jest.fn((req, res) => res.status(200).json({
      auditId: 'audit-123',
      status: 'in_progress',
      startedAt: Date.now()
    })),
    generateAuditReport: jest.fn((req, res) => res.status(200).json({
      reportId: 'report-456',
      format: 'pdf',
      url: '/downloads/audit-report-456.pdf'
    })),
    downloadAuditReport: jest.fn((req, res) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.pdf');
      res.status(200).end('PDF content');
    }),
    getFrameworkDetails: jest.fn((req, res) => {
      const { framework } = req.params;
      if (framework === 'unknown') {
        return res.status(404).json({ error: 'Framework not found' });
      }
      res.status(200).json({
        data: {
          name: framework.toUpperCase(),
          version: '1.0',
          requirements: ['data protection', 'privacy'],
          compliance: 90
        }
      });
    }),
    getComplianceRules: jest.fn((req, res) => res.status(200).json({
      data: {
        rules: [
          { id: 1, name: 'Data Encryption', required: true },
          { id: 2, name: 'Access Control', required: true }
        ]
      }
    })),
    getFrameworks: jest.fn((req, res) => res.status(200).json({
      data: [
        { id: 1, name: 'GDPR', status: 'active' },
        { id: 2, name: 'CCPA', status: 'active' }
      ]
    })),
    createFramework: jest.fn((req, res) => res.status(201).json({
      data: { id: 3, name: req.body.name, status: 'active' },
      message: 'Framework created successfully'
    })),
    updateFramework: jest.fn((req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ error: 'Framework not found' });
      }
      res.status(200).json({
        data: { id: parseInt(id), ...req.body },
        message: 'Framework updated successfully'
      });
    }),
    deleteFramework: jest.fn((req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ error: 'Framework not found' });
      }
      res.status(200).json({
        message: 'Framework deleted successfully'
      });
    }),
    getFrameworkConfig: jest.fn((req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ error: 'Framework not found' });
      }
      res.status(200).json({
        data: {
          id: parseInt(id),
          config: { strictMode: true, notifications: true }
        }
      });
    }),
    updateFrameworkConfig: jest.fn((req, res) => {
      const { id } = req.params;
      if (id === '999') {
        return res.status(404).json({ error: 'Framework not found' });
      }
      res.status(200).json({
        data: { id: parseInt(id), config: req.body },
        message: 'Framework config updated successfully'
      });
    }),
    generateComplianceReport: jest.fn((req, res) => res.status(200).json({
      reportId: 'comp-report-789',
      status: 'generated',
      downloadUrl: '/api/compliance/reports/comp-report-789'
    })),
    getReports: jest.fn((req, res) => res.status(200).json({
      data: [
        { id: 'report-1', type: 'audit', createdAt: '2024-01-15T10:30:00Z' },
        { id: 'report-2', type: 'compliance', createdAt: '2024-01-14T15:45:00Z' }
      ]
    })),
    getReport: jest.fn((req, res) => {
      const { id } = req.params;
      if (id === 'nonexistent') {
        return res.status(404).json({ error: 'Report not found' });
      }
      res.status(200).json({
        data: {
          id,
          type: 'compliance',
          content: { score: 85, findings: [] },
          createdAt: '2024-01-15T10:30:00Z'
        }
      });
    })
  }
}));

describe('Compliance Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard and Overview', () => {
    test('GET /api/compliance/dashboard should return compliance dashboard', async () => {
      const response = await request(app)
        .get('/api/compliance/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          overallScore: 85,
          frameworks: ['GDPR', 'CCPA', 'SOX'],
          issues: 3,
          lastAudit: '2024-01-15T10:30:00Z'
        }
      });
    });

    test('GET /api/compliance/health should return compliance health', async () => {
      const response = await request(app)
        .get('/api/compliance/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'compliant',
        score: 85
      });
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Compliance Audits', () => {
    test('POST /api/compliance/audit should start compliance audit', async () => {
      const auditRequest = {
        frameworks: ['GDPR', 'CCPA'],
        scope: 'full'
      };

      const response = await request(app)
        .post('/api/compliance/audit')
        .send(auditRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        auditId: 'audit-123',
        status: 'in_progress'
      });
      expect(response.body).toHaveProperty('startedAt');
    });

    test('GET /api/compliance/audit/report should generate audit report', async () => {
      const response = await request(app)
        .get('/api/compliance/audit/report')
        .expect(200);

      expect(response.body).toEqual({
        reportId: 'report-456',
        format: 'pdf',
        url: '/downloads/audit-report-456.pdf'
      });
    });

    test('GET /api/compliance/audit/download should download audit report', async () => {
      const response = await request(app)
        .get('/api/compliance/audit/download')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename=audit-report.pdf');
      // For binary content, check the response body
      expect(response.text || response.body.toString()).toBeTruthy();
    });
  });

  describe('Framework Endpoints', () => {
    test('GET /api/compliance/framework/:framework should return framework details', async () => {
      const response = await request(app)
        .get('/api/compliance/framework/gdpr')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          name: 'GDPR',
          version: '1.0',
          requirements: ['data protection', 'privacy'],
          compliance: 90
        }
      });
    });

    test('GET /api/compliance/framework/:framework should return 404 for unknown framework', async () => {
      const response = await request(app)
        .get('/api/compliance/framework/unknown')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Framework not found'
      });
    });

    test('GET /api/compliance/rules should return compliance rules', async () => {
      const response = await request(app)
        .get('/api/compliance/rules')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          rules: [
            { id: 1, name: 'Data Encryption', required: true },
            { id: 2, name: 'Access Control', required: true }
          ]
        }
      });
    });
  });

  describe('Framework Management', () => {
    test('GET /api/compliance/frameworks should return all frameworks', async () => {
      const response = await request(app)
        .get('/api/compliance/frameworks')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          { id: 1, name: 'GDPR', status: 'active' },
          { id: 2, name: 'CCPA', status: 'active' }
        ]
      });
    });

    test('POST /api/compliance/frameworks should create new framework', async () => {
      const newFramework = {
        name: 'HIPAA',
        description: 'Health Insurance Portability and Accountability Act'
      };

      const response = await request(app)
        .post('/api/compliance/frameworks')
        .send(newFramework)
        .expect(201);

      expect(response.body).toEqual({
        data: { id: 3, name: 'HIPAA', status: 'active' },
        message: 'Framework created successfully'
      });
    });

    test('PUT /api/compliance/frameworks/:id should update framework', async () => {
      const updateData = {
        name: 'GDPR Updated',
        description: 'Updated description'
      };

      const response = await request(app)
        .put('/api/compliance/frameworks/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        data: { id: 1, ...updateData },
        message: 'Framework updated successfully'
      });
    });

    test('PUT /api/compliance/frameworks/:id should return 404 for non-existent framework', async () => {
      const response = await request(app)
        .put('/api/compliance/frameworks/999')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Framework not found'
      });
    });

    test('DELETE /api/compliance/frameworks/:id should delete framework', async () => {
      const response = await request(app)
        .delete('/api/compliance/frameworks/1')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Framework deleted successfully'
      });
    });

    test('DELETE /api/compliance/frameworks/:id should return 404 for non-existent framework', async () => {
      const response = await request(app)
        .delete('/api/compliance/frameworks/999')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Framework not found'
      });
    });
  });

  describe('Framework Configuration', () => {
    test('GET /api/compliance/frameworks/:id/config should return framework config', async () => {
      const response = await request(app)
        .get('/api/compliance/frameworks/1/config')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          id: 1,
          config: { strictMode: true, notifications: true }
        }
      });
    });

    test('PUT /api/compliance/frameworks/:id/config should update framework config', async () => {
      const configUpdate = {
        strictMode: false,
        notifications: true,
        alertLevel: 'high'
      };

      const response = await request(app)
        .put('/api/compliance/frameworks/1/config')
        .send(configUpdate)
        .expect(200);

      expect(response.body).toEqual({
        data: { id: 1, config: configUpdate },
        message: 'Framework config updated successfully'
      });
    });
  });

  describe('Report Management', () => {
    test('POST /api/compliance/report should generate compliance report', async () => {
      const reportRequest = {
        frameworks: ['GDPR'],
        format: 'pdf',
        includeRecommendations: true
      };

      const response = await request(app)
        .post('/api/compliance/report')
        .send(reportRequest)
        .expect(200);

      expect(response.body).toEqual({
        reportId: 'comp-report-789',
        status: 'generated',
        downloadUrl: '/api/compliance/reports/comp-report-789'
      });
    });

    test('GET /api/compliance/reports should return all reports', async () => {
      const response = await request(app)
        .get('/api/compliance/reports')
        .expect(200);

      expect(response.body).toEqual({
        data: [
          { id: 'report-1', type: 'audit', createdAt: '2024-01-15T10:30:00Z' },
          { id: 'report-2', type: 'compliance', createdAt: '2024-01-14T15:45:00Z' }
        ]
      });
    });

    test('GET /api/compliance/reports/:id should return specific report', async () => {
      const response = await request(app)
        .get('/api/compliance/reports/report-1')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          id: 'report-1',
          type: 'compliance',
          content: { score: 85, findings: [] },
          createdAt: '2024-01-15T10:30:00Z'
        }
      });
    });

    test('GET /api/compliance/reports/:id should return 404 for non-existent report', async () => {
      const response = await request(app)
        .get('/api/compliance/reports/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Report not found'
      });
    });
  });

  describe('Query Parameters and Filters', () => {
    test('should handle query parameters in reports endpoint', async () => {
      await request(app)
        .get('/api/compliance/reports?type=audit&limit=10&offset=0')
        .expect(200);
    });

    test('should handle query parameters in audit report endpoint', async () => {
      await request(app)
        .get('/api/compliance/audit/report?format=json&include=details')
        .expect(200);
    });
  });

  describe('Edge Cases', () => {
    test('should handle framework names with special characters', async () => {
      await request(app)
        .get('/api/compliance/framework/iso-27001')
        .expect(200);
    });

    test('should handle numeric framework IDs', async () => {
      await request(app)
        .get('/api/compliance/frameworks/123/config')
        .expect(200);
    });

    test('should handle empty request bodies gracefully', async () => {
      await request(app)
        .post('/api/compliance/audit')
        .send({})
        .expect(200);
    });
  });
});