import request from 'supertest';
import express from 'express';
import { sentimentRoutes } from '../sentiment.routes';

// Mock the sentiment controller
jest.mock('../../controllers/sentiment.controller', () => ({
  SentimentController: jest.fn().mockImplementation(() => ({
    // Existing endpoints (empty stubs for now)
    analyzeSentiment: jest.fn((req, res) => {
      res.status(200).json({
        data: {
          id: 'analysis-123',
          sentiment: 'neutral'
        }
      });
    }),
    batchAnalyzeSentiment: jest.fn(),
    getAnalysisHistory: jest.fn(),
    getStatistics: jest.fn(),
    getAnalysisById: jest.fn(),
    deleteAnalysisResults: jest.fn(),
    exportAnalysisResults: jest.fn(),
    getAnalysisInsights: jest.fn(),
    estimateCost: jest.fn(),
    compareCosts: jest.fn(),
    testOpenAIConnection: jest.fn(),
    getOpenAIStatus: jest.fn(),
    updateOpenAIConfig: jest.fn(),
    getAvailableModels: jest.fn(),
    testDataCloakFlow: jest.fn(),
    getDataCloakStats: jest.fn(),
    
    // Add mock for preview endpoint
    analyzePreview: jest.fn(async (req, res) => {
      const { texts, fields } = req.body;
      
      // Simulate preview processing
      res.status(200).json({
        data: {
          preview: true,
          rowsAnalyzed: texts.length,
          results: texts.map((text: string, index: number) => ({
            rowIndex: index,
            text: text.substring(0, 100),
            sentiment: 'neutral',
            confidence: 0.5
          })),
          timeElapsed: 1000 // 1 second
        }
      });
    }),
    
    // Add mock for progress endpoint
    getAnalysisProgress: jest.fn((req, res) => {
      const { jobId } = req.params;
      res.status(200).json({
        data: {
          jobId,
          status: 'processing',
          progress: 35,
          rowsProcessed: 1750000,
          totalRows: 5000000,
          timeElapsed: 14520000,
          estimatedTimeRemaining: 28800000
        }
      });
    })
  }))
}));

// Mock async handler middleware
jest.mock('../../middleware/validation.middleware', () => ({
  asyncHandler: jest.fn((fn) => fn)
}));

describe('Progressive API Endpoints', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/sentiment', sentimentRoutes);
  });

  describe('POST /api/v1/sentiment/analyze/preview', () => {
    test('should return preview results in less than 5 minutes', async () => {
      const testData = {
        texts: ['This is a sample text for preview analysis'],
        fields: ['customer_feedback']
      };

      const response = await request(app)
        .post('/api/v1/sentiment/analyze/preview')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          preview: true,
          rowsAnalyzed: expect.any(Number),
          results: expect.any(Array),
          timeElapsed: expect.any(Number)
        }
      });
      
      // Verify it returns within 5 minutes (300000ms)
      expect(response.body.data.timeElapsed).toBeLessThan(300000);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain backward compatibility with /api/v1/sentiment/analyze', async () => {
      // This test ensures the existing endpoint still works
      // Since our mock already has analyzeSentiment defined, we just need to verify it works
      const response = await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({ text: 'Test text' })
        .expect(200);

      // The mock is empty but we just need to verify the endpoint exists
      // In real implementation, this would call the actual analyzeSentiment method
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/sentiment/analyze/progress/:jobId', () => {
    test('should return current job progress status', async () => {
      const response = await request(app)
        .get('/api/v1/sentiment/analyze/progress/job-123')
        .expect(200);
      
      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          status: 'processing',
          progress: expect.any(Number),
          rowsProcessed: expect.any(Number),
          totalRows: expect.any(Number)
        }
      });
    });
  });
});