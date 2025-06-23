import request from 'supertest';
import express from 'express';

// Mock the transform controller
const mockTransformController = {
  validateTransforms: jest.fn(),
  validateSingleTransform: jest.fn(),
  getSupportedOperations: jest.fn(),
  getValidationRules: jest.fn(),
  saveTransform: jest.fn(),
  listTransforms: jest.fn(),
  getTransform: jest.fn(),
  updateTransform: jest.fn(),
  deleteTransform: jest.fn(),
  getTransformHistory: jest.fn(),
  getTemplates: jest.fn(),
  exportTransform: jest.fn(),
  importTransform: jest.fn(),
};

// Mock async handler middleware
const mockAsyncHandler = jest.fn((fn) => fn);

jest.mock('../../controllers/transform.controller', () => ({
  TransformController: jest.fn().mockImplementation(() => mockTransformController)
}));

jest.mock('../../middleware/validation.middleware', () => ({
  asyncHandler: mockAsyncHandler
}));

import { transformRoutes } from '../transform.routes';

describe('Transform Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/transform', transformRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transform validation endpoints', () => {
    describe('POST /transform/validate', () => {
      it('should validate multiple transforms', async () => {
        const mockValidationResult = {
          valid: true,
          transforms: [
            {
              id: 'transform-1',
              operation: 'anonymize',
              field: 'email',
              valid: true,
              warnings: []
            },
            {
              id: 'transform-2',
              operation: 'mask',
              field: 'ssn',
              valid: true,
              warnings: ['Performance impact with large datasets']
            }
          ],
          errors: [],
          warnings: 1
        };

        mockTransformController.validateTransforms.mockImplementation((req, res) => {
          res.json({ success: true, data: mockValidationResult });
        });

        const response = await request(app)
          .post('/transform/validate')
          .send({
            transforms: [
              { id: 'transform-1', operation: 'anonymize', field: 'email' },
              { id: 'transform-2', operation: 'mask', field: 'ssn' }
            ]
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: mockValidationResult
        });
        expect(mockTransformController.validateTransforms).toHaveBeenCalled();
      });

      it('should handle validation errors', async () => {
        const mockValidationResult = {
          valid: false,
          transforms: [
            {
              id: 'transform-1',
              operation: 'invalid_operation',
              field: 'email',
              valid: false,
              errors: ['Unknown operation: invalid_operation']
            }
          ],
          errors: ['One or more transforms are invalid'],
          warnings: 0
        };

        mockTransformController.validateTransforms.mockImplementation((req, res) => {
          res.json({ success: true, data: mockValidationResult });
        });

        const response = await request(app)
          .post('/transform/validate')
          .send({
            transforms: [
              { id: 'transform-1', operation: 'invalid_operation', field: 'email' }
            ]
          })
          .expect(200);

        expect(response.body.data.valid).toBe(false);
        expect(response.body.data.errors).toHaveLength(1);
      });

      it('should handle empty transforms array', async () => {
        mockTransformController.validateTransforms.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            error: 'Transforms array cannot be empty'
          });
        });

        const response = await request(app)
          .post('/transform/validate')
          .send({ transforms: [] })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /transform/validate-single', () => {
      it('should validate a single transform', async () => {
        const mockSingleValidation = {
          valid: true,
          operation: 'pseudonymize',
          field: 'customer_id',
          configuration: {
            algorithm: 'hmac-sha256',
            salt: 'auto-generated'
          },
          estimatedPerformance: {
            recordsPerSecond: 10000,
            memoryUsage: '2MB'
          },
          warnings: [],
          errors: []
        };

        mockTransformController.validateSingleTransform.mockImplementation((req, res) => {
          res.json({ success: true, data: mockSingleValidation });
        });

        const response = await request(app)
          .post('/transform/validate-single')
          .send({
            operation: 'pseudonymize',
            field: 'customer_id',
            options: {
              algorithm: 'hmac-sha256'
            }
          })
          .expect(200);

        expect(response.body.data.valid).toBe(true);
        expect(response.body.data.operation).toBe('pseudonymize');
        expect(mockTransformController.validateSingleTransform).toHaveBeenCalled();
      });

      it('should handle single transform validation errors', async () => {
        const mockSingleValidation = {
          valid: false,
          operation: 'encrypt',
          field: 'credit_card',
          errors: [
            'Encryption key not provided',
            'Field type not suitable for encryption'
          ],
          warnings: []
        };

        mockTransformController.validateSingleTransform.mockImplementation((req, res) => {
          res.json({ success: true, data: mockSingleValidation });
        });

        const response = await request(app)
          .post('/transform/validate-single')
          .send({
            operation: 'encrypt',
            field: 'credit_card'
          })
          .expect(200);

        expect(response.body.data.valid).toBe(false);
        expect(response.body.data.errors).toHaveLength(2);
      });
    });
  });

  describe('Transform information endpoints', () => {
    describe('GET /transform/operations', () => {
      it('should get supported operations', async () => {
        const mockOperations = {
          anonymization: [
            {
              name: 'anonymize',
              description: 'Remove identifying information',
              supportedTypes: ['string', 'email', 'phone'],
              parameters: {
                method: { type: 'string', required: true, options: ['hash', 'random'] }
              }
            },
            {
              name: 'pseudonymize',
              description: 'Replace with consistent pseudonym',
              supportedTypes: ['string', 'number'],
              parameters: {
                algorithm: { type: 'string', required: false, default: 'hmac-sha256' }
              }
            }
          ],
          masking: [
            {
              name: 'mask',
              description: 'Partially hide data',
              supportedTypes: ['string', 'number'],
              parameters: {
                pattern: { type: 'string', required: true },
                maskChar: { type: 'string', required: false, default: '*' }
              }
            }
          ],
          encryption: [
            {
              name: 'encrypt',
              description: 'Encrypt sensitive data',
              supportedTypes: ['string', 'binary'],
              parameters: {
                algorithm: { type: 'string', required: true, options: ['aes-256', 'rsa-2048'] },
                key: { type: 'string', required: true }
              }
            }
          ]
        };

        mockTransformController.getSupportedOperations.mockImplementation((req, res) => {
          res.json({ success: true, data: mockOperations });
        });

        const response = await request(app)
          .get('/transform/operations')
          .expect(200);

        expect(response.body.data).toHaveProperty('anonymization');
        expect(response.body.data).toHaveProperty('masking');
        expect(response.body.data).toHaveProperty('encryption');
        expect(mockTransformController.getSupportedOperations).toHaveBeenCalled();
      });

      it('should filter operations by category', async () => {
        mockTransformController.getSupportedOperations.mockImplementation((req, res) => {
          const category = req.query.category;
          if (category === 'anonymization') {
            res.json({
              success: true,
              data: {
                anonymization: [
                  { name: 'anonymize', description: 'Remove identifying information' }
                ]
              }
            });
          } else {
            res.json({ success: true, data: {} });
          }
        });

        const response = await request(app)
          .get('/transform/operations?category=anonymization')
          .expect(200);

        expect(response.body.data).toHaveProperty('anonymization');
      });
    });

    describe('GET /transform/rules/:operationType', () => {
      it('should get validation rules for operation type', async () => {
        const mockRules = {
          operationType: 'mask',
          rules: {
            field: {
              required: true,
              type: 'string',
              minLength: 1
            },
            pattern: {
              required: true,
              type: 'string',
              regex: '^[*#X\\.]+$'
            },
            maskChar: {
              required: false,
              type: 'string',
              maxLength: 1,
              default: '*'
            }
          },
          examples: [
            {
              valid: true,
              transform: { field: 'ssn', pattern: 'XXX-XX-****', maskChar: 'X' }
            },
            {
              valid: false,
              transform: { field: '', pattern: 'invalid' },
              errors: ['Field is required', 'Invalid pattern format']
            }
          ]
        };

        mockTransformController.getValidationRules.mockImplementation((req, res) => {
          expect(req.params.operationType).toBe('mask');
          res.json({ success: true, data: mockRules });
        });

        const response = await request(app)
          .get('/transform/rules/mask')
          .expect(200);

        expect(response.body.data.operationType).toBe('mask');
        expect(response.body.data.rules).toBeDefined();
        expect(response.body.data.examples).toHaveLength(2);
      });

      it('should handle unknown operation type', async () => {
        mockTransformController.getValidationRules.mockImplementation((req, res) => {
          res.status(404).json({
            success: false,
            error: 'Operation type not found'
          });
        });

        const response = await request(app)
          .get('/transform/rules/unknown-operation')
          .expect(404);

        expect(response.body.error).toBe('Operation type not found');
      });
    });
  });

  describe('Transform persistence endpoints', () => {
    describe('POST /transform/save', () => {
      it('should save a transform configuration', async () => {
        const mockSavedTransform = {
          id: 'transform-123',
          name: 'Customer Data Anonymization',
          description: 'Anonymize customer PII for analytics',
          transforms: [
            { operation: 'anonymize', field: 'email', method: 'hash' },
            { operation: 'mask', field: 'phone', pattern: 'XXX-XXX-****' }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          createdBy: 'user-456',
          version: 1
        };

        mockTransformController.saveTransform.mockImplementation((req, res) => {
          res.status(201).json({ success: true, data: mockSavedTransform });
        });

        const response = await request(app)
          .post('/transform/save')
          .send({
            name: 'Customer Data Anonymization',
            description: 'Anonymize customer PII for analytics',
            transforms: [
              { operation: 'anonymize', field: 'email', method: 'hash' },
              { operation: 'mask', field: 'phone', pattern: 'XXX-XXX-****' }
            ]
          })
          .expect(201);

        expect(response.body.data.id).toBe('transform-123');
        expect(response.body.data.version).toBe(1);
      });

      it('should validate required fields when saving', async () => {
        mockTransformController.saveTransform.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            error: 'Name and transforms are required'
          });
        });

        const response = await request(app)
          .post('/transform/save')
          .send({})
          .expect(400);

        expect(response.body.error).toBe('Name and transforms are required');
      });
    });

    describe('GET /transform/saved', () => {
      it('should list saved transforms', async () => {
        const mockTransformList = {
          transforms: [
            {
              id: 'transform-1',
              name: 'Basic Anonymization',
              description: 'Basic PII anonymization',
              createdAt: '2024-01-01T00:00:00Z',
              version: 1
            },
            {
              id: 'transform-2',
              name: 'Advanced Masking',
              description: 'Complex masking rules',
              createdAt: '2024-01-02T00:00:00Z',
              version: 2
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 25,
            totalPages: 3
          }
        };

        mockTransformController.listTransforms.mockImplementation((req, res) => {
          res.json({ success: true, data: mockTransformList });
        });

        const response = await request(app)
          .get('/transform/saved')
          .expect(200);

        expect(response.body.data.transforms).toHaveLength(2);
        expect(response.body.data.pagination).toBeDefined();
      });

      it('should support filtering and pagination', async () => {
        mockTransformController.listTransforms.mockImplementation((req, res) => {
          expect(req.query.search).toBe('anonymization');
          expect(req.query.page).toBe('2');
          expect(req.query.pageSize).toBe('5');
          
          res.json({
            success: true,
            data: { transforms: [], pagination: { page: 2, pageSize: 5 } }
          });
        });

        const response = await request(app)
          .get('/transform/saved?search=anonymization&page=2&pageSize=5')
          .expect(200);
      });
    });

    describe('GET /transform/saved/:id', () => {
      it('should get specific transform', async () => {
        const mockTransform = {
          id: 'transform-123',
          name: 'Customer Anonymization',
          description: 'Full customer data anonymization',
          transforms: [
            { operation: 'anonymize', field: 'email' },
            { operation: 'mask', field: 'phone' }
          ],
          metadata: {
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
            version: 2,
            createdBy: 'user-123'
          }
        };

        mockTransformController.getTransform.mockImplementation((req, res) => {
          expect(req.params.id).toBe('transform-123');
          res.json({ success: true, data: mockTransform });
        });

        const response = await request(app)
          .get('/transform/saved/transform-123')
          .expect(200);

        expect(response.body.data.id).toBe('transform-123');
        expect(response.body.data.metadata.version).toBe(2);
      });

      it('should handle transform not found', async () => {
        mockTransformController.getTransform.mockImplementation((req, res) => {
          res.status(404).json({
            success: false,
            error: 'Transform not found'
          });
        });

        const response = await request(app)
          .get('/transform/saved/nonexistent')
          .expect(404);

        expect(response.body.error).toBe('Transform not found');
      });
    });

    describe('PUT /transform/saved/:id', () => {
      it('should update transform', async () => {
        const mockUpdatedTransform = {
          id: 'transform-123',
          name: 'Updated Anonymization',
          version: 3,
          updatedAt: '2024-01-03T00:00:00Z'
        };

        mockTransformController.updateTransform.mockImplementation((req, res) => {
          res.json({ success: true, data: mockUpdatedTransform });
        });

        const response = await request(app)
          .put('/transform/saved/transform-123')
          .send({
            name: 'Updated Anonymization',
            transforms: [
              { operation: 'anonymize', field: 'email', method: 'advanced-hash' }
            ]
          })
          .expect(200);

        expect(response.body.data.version).toBe(3);
      });
    });

    describe('DELETE /transform/saved/:id', () => {
      it('should delete transform', async () => {
        mockTransformController.deleteTransform.mockImplementation((req, res) => {
          res.json({
            success: true,
            message: 'Transform deleted successfully'
          });
        });

        const response = await request(app)
          .delete('/transform/saved/transform-123')
          .expect(200);

        expect(response.body.message).toBe('Transform deleted successfully');
      });
    });

    describe('GET /transform/saved/:id/history', () => {
      it('should get transform history', async () => {
        const mockHistory = {
          transformId: 'transform-123',
          versions: [
            {
              version: 1,
              createdAt: '2024-01-01T00:00:00Z',
              createdBy: 'user-123',
              changes: 'Initial creation'
            },
            {
              version: 2,
              createdAt: '2024-01-02T00:00:00Z',
              createdBy: 'user-456',
              changes: 'Updated masking pattern for phone field'
            },
            {
              version: 3,
              createdAt: '2024-01-03T00:00:00Z',
              createdBy: 'user-123',
              changes: 'Added encryption for sensitive fields'
            }
          ]
        };

        mockTransformController.getTransformHistory.mockImplementation((req, res) => {
          res.json({ success: true, data: mockHistory });
        });

        const response = await request(app)
          .get('/transform/saved/transform-123/history')
          .expect(200);

        expect(response.body.data.versions).toHaveLength(3);
        expect(response.body.data.transformId).toBe('transform-123');
      });
    });
  });

  describe('Transform templates endpoints', () => {
    describe('GET /transform/templates', () => {
      it('should get transform templates', async () => {
        const mockTemplates = [
          {
            id: 'template-pii',
            name: 'PII Anonymization',
            description: 'Standard PII anonymization template',
            category: 'privacy',
            transforms: [
              { operation: 'anonymize', field: 'email' },
              { operation: 'mask', field: 'ssn', pattern: 'XXX-XX-****' },
              { operation: 'pseudonymize', field: 'name' }
            ],
            usage: 156,
            rating: 4.7
          },
          {
            id: 'template-financial',
            name: 'Financial Data Masking',
            description: 'Template for financial data protection',
            category: 'financial',
            transforms: [
              { operation: 'mask', field: 'credit_card', pattern: 'XXXX-XXXX-XXXX-****' },
              { operation: 'encrypt', field: 'account_number' },
              { operation: 'anonymize', field: 'bank_routing' }
            ],
            usage: 89,
            rating: 4.5
          }
        ];

        mockTransformController.getTemplates.mockImplementation((req, res) => {
          res.json({ success: true, data: mockTemplates });
        });

        const response = await request(app)
          .get('/transform/templates')
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].category).toBe('privacy');
        expect(response.body.data[1].category).toBe('financial');
      });

      it('should filter templates by category', async () => {
        mockTransformController.getTemplates.mockImplementation((req, res) => {
          const category = req.query.category;
          if (category === 'privacy') {
            res.json({
              success: true,
              data: [
                { id: 'template-pii', name: 'PII Anonymization', category: 'privacy' }
              ]
            });
          } else {
            res.json({ success: true, data: [] });
          }
        });

        const response = await request(app)
          .get('/transform/templates?category=privacy')
          .expect(200);

        expect(response.body.data).toHaveLength(1);
      });
    });
  });

  describe('Transform import/export endpoints', () => {
    describe('GET /transform/saved/:id/export', () => {
      it('should export transform configuration', async () => {
        const mockExportData = {
          format: 'json',
          version: '1.0',
          exportedAt: '2024-01-01T00:00:00Z',
          transform: {
            id: 'transform-123',
            name: 'Customer Anonymization',
            transforms: [
              { operation: 'anonymize', field: 'email' }
            ]
          }
        };

        mockTransformController.exportTransform.mockImplementation((req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="transform-123.json"');
          res.json(mockExportData);
        });

        const response = await request(app)
          .get('/transform/saved/transform-123/export')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.body.transform.id).toBe('transform-123');
      });

      it('should support different export formats', async () => {
        mockTransformController.exportTransform.mockImplementation((req, res) => {
          const format = req.query.format || 'json';
          if (format === 'yaml') {
            res.setHeader('Content-Type', 'application/yaml');
            res.send('transform:\n  id: transform-123\n  name: "Customer Anonymization"');
          } else {
            res.json({ format, transform: {} });
          }
        });

        const response = await request(app)
          .get('/transform/saved/transform-123/export?format=yaml')
          .expect(200);

        expect(response.headers['content-type']).toContain('application/yaml');
      });
    });

    describe('POST /transform/import', () => {
      it('should import transform configuration', async () => {
        const mockImportResult = {
          imported: true,
          transformId: 'transform-456',
          conflicts: [],
          warnings: []
        };

        mockTransformController.importTransform.mockImplementation((req, res) => {
          res.status(201).json({ success: true, data: mockImportResult });
        });

        const importData = {
          format: 'json',
          transform: {
            name: 'Imported Transform',
            transforms: [
              { operation: 'mask', field: 'phone' }
            ]
          }
        };

        const response = await request(app)
          .post('/transform/import')
          .send(importData)
          .expect(201);

        expect(response.body.data.imported).toBe(true);
        expect(response.body.data.transformId).toBe('transform-456');
      });

      it('should handle import conflicts', async () => {
        const mockImportResult = {
          imported: false,
          conflicts: [
            {
              type: 'name_collision',
              message: 'Transform with same name already exists',
              suggestedAction: 'rename_or_overwrite'
            }
          ],
          warnings: []
        };

        mockTransformController.importTransform.mockImplementation((req, res) => {
          res.status(409).json({ success: false, data: mockImportResult });
        });

        const response = await request(app)
          .post('/transform/import')
          .send({ transform: { name: 'Existing Transform' } })
          .expect(409);

        expect(response.body.data.conflicts).toHaveLength(1);
      });

      it('should validate import format', async () => {
        mockTransformController.importTransform.mockImplementation((req, res) => {
          res.status(400).json({
            success: false,
            error: 'Invalid import format'
          });
        });

        const response = await request(app)
          .post('/transform/import')
          .send({ invalid: 'data' })
          .expect(400);

        expect(response.body.error).toBe('Invalid import format');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle controller errors gracefully', async () => {
      mockTransformController.getSupportedOperations.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      const response = await request(app)
        .get('/transform/operations')
        .expect(500);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/transform/validate')
        .type('json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle large transform configurations', async () => {
      const largeTransformSet = {
        transforms: Array(1000).fill(null).map((_, index) => ({
          operation: 'mask',
          field: `field_${index}`,
          pattern: 'XXX-****'
        }))
      };

      mockTransformController.validateTransforms.mockImplementation((req, res) => {
        if (req.body.transforms.length > 100) {
          return res.status(413).json({
            success: false,
            error: 'Transform set too large'
          });
        }
        res.json({ success: true, data: { valid: true } });
      });

      const response = await request(app)
        .post('/transform/validate')
        .send(largeTransformSet)
        .expect(413);

      expect(response.body.error).toBe('Transform set too large');
    });

    it('should handle concurrent requests', async () => {
      let requestCount = 0;
      
      mockTransformController.listTransforms.mockImplementation((req, res) => {
        requestCount++;
        setTimeout(() => {
          res.json({
            success: true,
            data: { transforms: [], requestId: requestCount }
          });
        }, 10);
      });

      const requests = Array(5).fill(null).map(() =>
        request(app).get('/transform/saved')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockTransformController.listTransforms).toHaveBeenCalledTimes(5);
    });
  });

  describe('Security and Validation', () => {
    it('should validate transform parameters', async () => {
      mockTransformController.validateSingleTransform.mockImplementation((req, res) => {
        const { operation, field } = req.body;
        
        if (!operation || !field) {
          return res.status(400).json({
            success: false,
            error: 'Operation and field are required'
          });
        }
        
        res.json({ success: true, data: { valid: true } });
      });

      const response = await request(app)
        .post('/transform/validate-single')
        .send({ operation: 'mask' }) // Missing field
        .expect(400);

      expect(response.body.error).toBe('Operation and field are required');
    });

    it('should sanitize input data', async () => {
      mockTransformController.saveTransform.mockImplementation((req, res) => {
        const { name } = req.body;
        
        // Should reject potentially dangerous content
        if (name && name.includes('<script>')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid characters in name'
          });
        }
        
        res.status(201).json({ success: true, data: { id: 'safe-transform' } });
      });

      const response = await request(app)
        .post('/transform/save')
        .send({
          name: 'Safe Transform<script>alert("xss")</script>',
          transforms: []
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid characters in name');
    });

    it('should handle file upload limits for import', async () => {
      // This test documents that import endpoints should validate file size
      // The actual size limit enforcement would be handled by middleware
      
      mockTransformController.importTransform.mockImplementation((req, res) => {
        res.status(413).json({
          success: false,
          error: 'Import file too large'
        });
      });

      const response = await request(app)
        .post('/transform/import')
        .send({ transform: { name: 'Test' } })
        .expect(413);

      expect(response.body.error).toBe('Import file too large');
    });
  });
});