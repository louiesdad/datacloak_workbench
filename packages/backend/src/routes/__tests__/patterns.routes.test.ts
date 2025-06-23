import request from 'supertest';
import express from 'express';

// Mock the patterns controller
const mockPatternsController = {
  getCustomPatterns: jest.fn(),
  createCustomPattern: jest.fn(),
  getCustomPattern: jest.fn(),
  updateCustomPattern: jest.fn(),
  deleteCustomPattern: jest.fn(),
  validatePattern: jest.fn(),
  testPattern: jest.fn(),
  batchTestPatterns: jest.fn(),
  getPatternCategories: jest.fn(),
  getIndustryPatternSets: jest.fn(),
  getIndustryPatterns: jest.fn(),
  getPatternPerformance: jest.fn(),
  benchmarkPatterns: jest.fn(),
  getPerformanceRecommendations: jest.fn(),
  getPatternPriorities: jest.fn(),
  updatePatternPriorities: jest.fn(),
  optimizePriorities: jest.fn(),
};

jest.mock('../../controllers/patterns.controller', () => ({
  patternsController: mockPatternsController
}));

import patternsRoutes from '../patterns.routes';

describe('Patterns Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/patterns', patternsRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Custom Pattern CRUD endpoints', () => {
    describe('GET /patterns/custom', () => {
      it('should get all custom patterns', async () => {
        const mockPatterns = [
          { id: '1', name: 'SSN Pattern', regex: '\\d{3}-\\d{2}-\\d{4}', category: 'PII' },
          { id: '2', name: 'Email Pattern', regex: '[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}', category: 'Contact' }
        ];

        mockPatternsController.getCustomPatterns.mockImplementation((req, res) => {
          res.json({ success: true, data: mockPatterns });
        });

        const response = await request(app)
          .get('/patterns/custom')
          .expect(200);

        expect(mockPatternsController.getCustomPatterns).toHaveBeenCalled();
      });

      it('should handle errors when getting custom patterns', async () => {
        mockPatternsController.getCustomPatterns.mockImplementation((req, res) => {
          res.status(500).json({ success: false, error: 'Database error' });
        });

        const response = await request(app)
          .get('/patterns/custom')
          .expect(500);

        expect(mockPatternsController.getCustomPatterns).toHaveBeenCalled();
      });
    });

    describe('POST /patterns/custom', () => {
      it('should create a new custom pattern', async () => {
        const newPattern = {
          name: 'Credit Card Pattern',
          regex: '\\d{4}-\\d{4}-\\d{4}-\\d{4}',
          category: 'Financial'
        };

        const createdPattern = { id: '3', ...newPattern };

        mockPatternsController.createCustomPattern.mockImplementation((req, res) => {
          res.status(201).json({ success: true, data: createdPattern });
        });

        const response = await request(app)
          .post('/patterns/custom')
          .send(newPattern)
          .expect(201);

        expect(mockPatternsController.createCustomPattern).toHaveBeenCalled();
      });

      it('should handle validation errors when creating patterns', async () => {
        mockPatternsController.createCustomPattern.mockImplementation((req, res) => {
          res.status(400).json({ success: false, error: 'Invalid pattern format' });
        });

        const response = await request(app)
          .post('/patterns/custom')
          .send({ name: '', regex: '' })
          .expect(400);

        expect(mockPatternsController.createCustomPattern).toHaveBeenCalled();
      });
    });

    describe('GET /patterns/custom/:id', () => {
      it('should get a specific custom pattern', async () => {
        const mockPattern = { id: '1', name: 'SSN Pattern', regex: '\\d{3}-\\d{2}-\\d{4}' };

        mockPatternsController.getCustomPattern.mockImplementation((req, res) => {
          res.json({ success: true, data: mockPattern });
        });

        const response = await request(app)
          .get('/patterns/custom/1')
          .expect(200);

        expect(mockPatternsController.getCustomPattern).toHaveBeenCalled();
      });

      it('should handle pattern not found', async () => {
        mockPatternsController.getCustomPattern.mockImplementation((req, res) => {
          res.status(404).json({ success: false, error: 'Pattern not found' });
        });

        const response = await request(app)
          .get('/patterns/custom/999')
          .expect(404);

        expect(mockPatternsController.getCustomPattern).toHaveBeenCalled();
      });
    });

    describe('PUT /patterns/custom/:id', () => {
      it('should update a custom pattern', async () => {
        const updatedPattern = {
          id: '1',
          name: 'Updated SSN Pattern',
          regex: '\\d{3}-\\d{2}-\\d{4}',
          category: 'PII'
        };

        mockPatternsController.updateCustomPattern.mockImplementation((req, res) => {
          res.json({ success: true, data: updatedPattern });
        });

        const response = await request(app)
          .put('/patterns/custom/1')
          .send({ name: 'Updated SSN Pattern' })
          .expect(200);

        expect(mockPatternsController.updateCustomPattern).toHaveBeenCalled();
      });

      it('should handle update errors', async () => {
        mockPatternsController.updateCustomPattern.mockImplementation((req, res) => {
          res.status(400).json({ success: false, error: 'Invalid update data' });
        });

        const response = await request(app)
          .put('/patterns/custom/1')
          .send({ regex: '[invalid' })
          .expect(400);

        expect(mockPatternsController.updateCustomPattern).toHaveBeenCalled();
      });
    });

    describe('DELETE /patterns/custom/:id', () => {
      it('should delete a custom pattern', async () => {
        mockPatternsController.deleteCustomPattern.mockImplementation((req, res) => {
          res.json({ success: true, message: 'Pattern deleted successfully' });
        });

        const response = await request(app)
          .delete('/patterns/custom/1')
          .expect(200);

        expect(mockPatternsController.deleteCustomPattern).toHaveBeenCalled();
      });

      it('should handle delete errors', async () => {
        mockPatternsController.deleteCustomPattern.mockImplementation((req, res) => {
          res.status(404).json({ success: false, error: 'Pattern not found' });
        });

        const response = await request(app)
          .delete('/patterns/custom/999')
          .expect(404);

        expect(mockPatternsController.deleteCustomPattern).toHaveBeenCalled();
      });
    });
  });

  describe('Pattern validation and testing', () => {
    describe('POST /patterns/custom/validate', () => {
      it('should validate a pattern', async () => {
        const validationResult = {
          valid: true,
          message: 'Pattern is valid',
          warnings: []
        };

        mockPatternsController.validatePattern.mockImplementation((req, res) => {
          res.json({ success: true, data: validationResult });
        });

        const response = await request(app)
          .post('/patterns/custom/validate')
          .send({ regex: '\\d{3}-\\d{2}-\\d{4}', flags: 'g' })
          .expect(200);

        expect(mockPatternsController.validatePattern).toHaveBeenCalled();
      });

      it('should return validation errors for invalid patterns', async () => {
        const validationResult = {
          valid: false,
          message: 'Invalid regular expression',
          errors: ['Unclosed bracket']
        };

        mockPatternsController.validatePattern.mockImplementation((req, res) => {
          res.json({ success: true, data: validationResult });
        });

        const response = await request(app)
          .post('/patterns/custom/validate')
          .send({ regex: '[invalid' })
          .expect(200);

        expect(mockPatternsController.validatePattern).toHaveBeenCalled();
      });
    });

    describe('POST /patterns/custom/test', () => {
      it('should test a pattern against sample text', async () => {
        const testResult = {
          matches: [
            { text: '123-45-6789', start: 0, end: 11 },
            { text: '987-65-4321', start: 20, end: 31 }
          ],
          matchCount: 2
        };

        mockPatternsController.testPattern.mockImplementation((req, res) => {
          res.json({ success: true, data: testResult });
        });

        const response = await request(app)
          .post('/patterns/custom/test')
          .send({
            regex: '\\d{3}-\\d{2}-\\d{4}',
            testText: '123-45-6789 and 987-65-4321'
          })
          .expect(200);

        expect(mockPatternsController.testPattern).toHaveBeenCalled();
      });

      it('should handle test errors', async () => {
        mockPatternsController.testPattern.mockImplementation((req, res) => {
          res.status(400).json({ success: false, error: 'Test parameters missing' });
        });

        const response = await request(app)
          .post('/patterns/custom/test')
          .send({})
          .expect(400);

        expect(mockPatternsController.testPattern).toHaveBeenCalled();
      });
    });

    describe('POST /patterns/custom/batch-test', () => {
      it('should test multiple patterns in batch', async () => {
        const batchTestResult = {
          results: [
            { patternId: '1', matches: 5, executionTime: 12 },
            { patternId: '2', matches: 3, executionTime: 8 }
          ],
          totalExecutionTime: 20
        };

        mockPatternsController.batchTestPatterns.mockImplementation((req, res) => {
          res.json({ success: true, data: batchTestResult });
        });

        const response = await request(app)
          .post('/patterns/custom/batch-test')
          .send({
            patterns: ['1', '2'],
            testText: 'Sample text with various patterns'
          })
          .expect(200);

        expect(mockPatternsController.batchTestPatterns).toHaveBeenCalled();
      });
    });
  });

  describe('Pattern categories and industry sets', () => {
    describe('GET /patterns/categories', () => {
      it('should get pattern categories', async () => {
        const categories = [
          { id: 'pii', name: 'Personal Information', count: 15 },
          { id: 'financial', name: 'Financial Data', count: 8 },
          { id: 'healthcare', name: 'Healthcare', count: 12 }
        ];

        mockPatternsController.getPatternCategories.mockImplementation((req, res) => {
          res.json({ success: true, data: categories });
        });

        const response = await request(app)
          .get('/patterns/categories')
          .expect(200);

        expect(mockPatternsController.getPatternCategories).toHaveBeenCalled();
      });
    });

    describe('GET /patterns/industry-sets', () => {
      it('should get industry pattern sets', async () => {
        const industrySets = [
          { id: 'healthcare', name: 'Healthcare', patternCount: 25 },
          { id: 'finance', name: 'Financial Services', patternCount: 18 },
          { id: 'retail', name: 'Retail', patternCount: 12 }
        ];

        mockPatternsController.getIndustryPatternSets.mockImplementation((req, res) => {
          res.json({ success: true, data: industrySets });
        });

        const response = await request(app)
          .get('/patterns/industry-sets')
          .expect(200);

        expect(mockPatternsController.getIndustryPatternSets).toHaveBeenCalled();
      });
    });

    describe('GET /patterns/industry-sets/:industry', () => {
      it('should get patterns for specific industry', async () => {
        const industryPatterns = [
          { id: '1', name: 'HIPAA Identifier', regex: 'pattern1' },
          { id: '2', name: 'Medical Record Number', regex: 'pattern2' }
        ];

        mockPatternsController.getIndustryPatterns.mockImplementation((req, res) => {
          res.json({ success: true, data: industryPatterns });
        });

        const response = await request(app)
          .get('/patterns/industry-sets/healthcare')
          .expect(200);

        expect(mockPatternsController.getIndustryPatterns).toHaveBeenCalled();
      });

      it('should handle invalid industry', async () => {
        mockPatternsController.getIndustryPatterns.mockImplementation((req, res) => {
          res.status(404).json({ success: false, error: 'Industry not found' });
        });

        const response = await request(app)
          .get('/patterns/industry-sets/invalid')
          .expect(404);

        expect(mockPatternsController.getIndustryPatterns).toHaveBeenCalled();
      });
    });
  });

  describe('Pattern performance and optimization', () => {
    describe('GET /patterns/performance', () => {
      it('should get pattern performance metrics', async () => {
        const performanceMetrics = {
          totalPatterns: 50,
          averageExecutionTime: 15.2,
          slowestPatterns: [
            { id: '1', name: 'Complex Pattern', executionTime: 45.5 }
          ],
          fastestPatterns: [
            { id: '2', name: 'Simple Pattern', executionTime: 2.1 }
          ]
        };

        mockPatternsController.getPatternPerformance.mockImplementation((req, res) => {
          res.json({ success: true, data: performanceMetrics });
        });

        const response = await request(app)
          .get('/patterns/performance')
          .expect(200);

        expect(mockPatternsController.getPatternPerformance).toHaveBeenCalled();
      });
    });

    describe('POST /patterns/performance/benchmark', () => {
      it('should run pattern benchmarks', async () => {
        const benchmarkResults = {
          benchmarkId: 'bench-123',
          timestamp: '2024-01-01T00:00:00Z',
          results: [
            { patternId: '1', avgTime: 12.5, minTime: 8.2, maxTime: 18.7 }
          ]
        };

        mockPatternsController.benchmarkPatterns.mockImplementation((req, res) => {
          res.json({ success: true, data: benchmarkResults });
        });

        const response = await request(app)
          .post('/patterns/performance/benchmark')
          .send({ patternIds: ['1', '2'], iterations: 1000 })
          .expect(200);

        expect(mockPatternsController.benchmarkPatterns).toHaveBeenCalled();
      });
    });

    describe('GET /patterns/performance/recommendations', () => {
      it('should get performance recommendations', async () => {
        const recommendations = [
          {
            type: 'optimization',
            pattern: 'pattern-1',
            recommendation: 'Consider simplifying regex',
            impact: 'high'
          }
        ];

        mockPatternsController.getPerformanceRecommendations.mockImplementation((req, res) => {
          res.json({ success: true, data: recommendations });
        });

        const response = await request(app)
          .get('/patterns/performance/recommendations')
          .expect(200);

        expect(mockPatternsController.getPerformanceRecommendations).toHaveBeenCalled();
      });
    });
  });

  describe('Pattern priority management', () => {
    describe('GET /patterns/priorities', () => {
      it('should get pattern priorities', async () => {
        const priorities = [
          { patternId: '1', priority: 1, name: 'SSN Pattern' },
          { patternId: '2', priority: 2, name: 'Credit Card Pattern' }
        ];

        mockPatternsController.getPatternPriorities.mockImplementation((req, res) => {
          res.json({ success: true, data: priorities });
        });

        const response = await request(app)
          .get('/patterns/priorities')
          .expect(200);

        expect(mockPatternsController.getPatternPriorities).toHaveBeenCalled();
      });
    });

    describe('PUT /patterns/priorities', () => {
      it('should update pattern priorities', async () => {
        const updatedPriorities = [
          { patternId: '1', priority: 2 },
          { patternId: '2', priority: 1 }
        ];

        mockPatternsController.updatePatternPriorities.mockImplementation((req, res) => {
          res.json({ success: true, message: 'Priorities updated successfully' });
        });

        const response = await request(app)
          .put('/patterns/priorities')
          .send({ priorities: updatedPriorities })
          .expect(200);

        expect(mockPatternsController.updatePatternPriorities).toHaveBeenCalled();
      });

      it('should handle invalid priority data', async () => {
        mockPatternsController.updatePatternPriorities.mockImplementation((req, res) => {
          res.status(400).json({ success: false, error: 'Invalid priority data' });
        });

        const response = await request(app)
          .put('/patterns/priorities')
          .send({ priorities: [] })
          .expect(400);

        expect(mockPatternsController.updatePatternPriorities).toHaveBeenCalled();
      });
    });

    describe('POST /patterns/priorities/optimize', () => {
      it('should optimize pattern priorities', async () => {
        const optimizationResult = {
          optimizedPriorities: [
            { patternId: '1', oldPriority: 3, newPriority: 1, reason: 'High frequency' }
          ],
          estimatedImprovement: '15% faster processing'
        };

        mockPatternsController.optimizePriorities.mockImplementation((req, res) => {
          res.json({ success: true, data: optimizationResult });
        });

        const response = await request(app)
          .post('/patterns/priorities/optimize')
          .send({ criteria: 'frequency' })
          .expect(200);

        expect(mockPatternsController.optimizePriorities).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle controller method not implemented', async () => {
      mockPatternsController.getCustomPatterns.mockImplementation((req, res) => {
        throw new Error('Method not implemented');
      });

      const response = await request(app)
        .get('/patterns/custom')
        .expect(500);
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/patterns/custom')
        .type('json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required parameters', async () => {
      mockPatternsController.createCustomPattern.mockImplementation((req, res) => {
        res.status(400).json({ success: false, error: 'Missing required fields' });
      });

      const response = await request(app)
        .post('/patterns/custom')
        .send({})
        .expect(400);

      expect(mockPatternsController.createCustomPattern).toHaveBeenCalled();
    });
  });

  describe('Route Security', () => {
    it('should handle all routes without authentication for now', async () => {
      // Since no auth middleware is applied, all routes should be accessible
      // This test documents the current state and can be updated when auth is added
      
      const publicRoutes = [
        '/patterns/custom',
        '/patterns/categories',
        '/patterns/industry-sets',
        '/patterns/performance'
      ];

      for (const route of publicRoutes) {
        mockPatternsController.getCustomPatterns.mockImplementation((req, res) => {
          res.json({ success: true, data: [] });
        });
        mockPatternsController.getPatternCategories.mockImplementation((req, res) => {
          res.json({ success: true, data: [] });
        });
        mockPatternsController.getIndustryPatternSets.mockImplementation((req, res) => {
          res.json({ success: true, data: [] });
        });
        mockPatternsController.getPatternPerformance.mockImplementation((req, res) => {
          res.json({ success: true, data: {} });
        });

        const response = await request(app)
          .get(route)
          .expect(200);
      }
    });
  });
});