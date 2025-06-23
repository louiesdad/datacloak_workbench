import request from 'supertest';
import express from 'express';
import { sentimentRoutes } from '../sentiment.routes';

const app = express();
app.use(express.json());
app.use('/api/sentiment', sentimentRoutes);

// Mock the sentiment controller
jest.mock('../../controllers/sentiment.controller', () => ({
  SentimentController: jest.fn().mockImplementation(() => ({
    analyzeSentiment: jest.fn(async (req, res) => {
      const { text } = req.body;
      if (text === 'error') {
        return res.status(500).json({ error: 'Analysis failed' });
      }
      res.status(200).json({
        data: {
          id: 'analysis-123',
          text,
          sentiment: text.includes('happy') ? 'positive' : text.includes('sad') ? 'negative' : 'neutral',
          confidence: 0.85,
          model: 'gpt-3.5-turbo',
          timestamp: Date.now()
        }
      });
    }),
    batchAnalyzeSentiment: jest.fn(async (req, res) => {
      const { texts } = req.body;
      if (texts.includes('error')) {
        return res.status(500).json({ error: 'Batch analysis failed' });
      }
      res.status(200).json({
        data: texts.map((text, index) => ({
          id: `analysis-${index}`,
          text,
          sentiment: 'neutral',
          confidence: 0.8,
          model: 'gpt-3.5-turbo'
        })),
        message: `Analyzed ${texts.length} texts`
      });
    }),
    getAnalysisHistory: jest.fn(async (req, res) => {
      const { page = 1, pageSize = 10 } = req.query;
      res.status(200).json({
        data: [
          { id: 'analysis-1', text: 'Happy text', sentiment: 'positive', timestamp: Date.now() },
          { id: 'analysis-2', text: 'Sad text', sentiment: 'negative', timestamp: Date.now() - 1000 }
        ],
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total: 50,
          totalPages: 5
        }
      });
    }),
    getStatistics: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          total: 1000,
          positive: 400,
          negative: 300,
          neutral: 300,
          averageConfidence: 0.82
        }
      });
    }),
    getAnalysisById: jest.fn(async (req, res) => {
      const { id } = req.params;
      if (id === 'nonexistent') {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      res.status(200).json({
        data: {
          id,
          text: 'Sample text for analysis',
          sentiment: 'positive',
          confidence: 0.9,
          model: 'gpt-3.5-turbo',
          timestamp: Date.now()
        }
      });
    }),
    deleteAnalysisResults: jest.fn(async (req, res) => {
      const { ids } = req.body;
      if (ids && ids.includes('error')) {
        return res.status(500).json({ error: 'Delete failed' });
      }
      res.status(200).json({
        message: `Deleted ${ids ? ids.length : 'all'} analysis results`,
        deleted: ids ? ids.length : 100
      });
    }),
    exportAnalysisResults: jest.fn(async (req, res) => {
      const { format = 'csv' } = req.query;
      if (format === 'invalid') {
        return res.status(400).json({ error: 'Invalid format' });
      }
      res.status(200).json({
        data: {
          exportId: 'export-123',
          format,
          downloadUrl: `/api/sentiment/download/export-123.${format}`,
          expiresAt: Date.now() + 3600000
        }
      });
    }),
    getAnalysisInsights: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          trends: {
            daily: [{ date: '2024-01-15', positive: 60, negative: 25, neutral: 15 }],
            weekly: [{ week: '2024-W03', positive: 55, negative: 30, neutral: 15 }]
          },
          keywords: [
            { word: 'happy', sentiment: 'positive', frequency: 25 },
            { word: 'sad', sentiment: 'negative', frequency: 15 }
          ],
          summary: {
            mostPositiveDay: '2024-01-15',
            averageConfidence: 0.85,
            totalAnalyzed: 1000
          }
        }
      });
    }),
    estimateCost: jest.fn(async (req, res) => {
      const { textCount = 1, avgLength = 100 } = req.body;
      res.status(200).json({
        data: {
          estimatedCost: textCount * avgLength * 0.001,
          currency: 'USD',
          breakdown: {
            tokenCost: textCount * avgLength * 0.0008,
            processingCost: textCount * 0.0002
          },
          textCount,
          avgLength
        }
      });
    }),
    compareCosts: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          models: [
            { name: 'gpt-3.5-turbo', costPer1k: 0.002, speed: 'fast' },
            { name: 'gpt-4', costPer1k: 0.03, speed: 'medium' }
          ],
          recommendation: 'gpt-3.5-turbo',
          savings: '93% cheaper for basic sentiment analysis'
        }
      });
    }),
    testOpenAIConnection: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          connected: true,
          model: 'gpt-3.5-turbo',
          responseTime: 245,
          version: 'v1'
        }
      });
    }),
    getOpenAIStatus: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          configured: true,
          model: 'gpt-3.5-turbo',
          rateLimit: {
            requests: 1000,
            tokens: 150000,
            remaining: 850
          },
          lastChecked: Date.now()
        }
      });
    }),
    updateOpenAIConfig: jest.fn(async (req, res) => {
      const { model, maxTokens } = req.body;
      res.status(200).json({
        data: { model, maxTokens },
        message: 'OpenAI configuration updated successfully'
      });
    }),
    getAvailableModels: jest.fn(async (req, res) => {
      res.status(200).json({
        data: [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', costPer1k: 0.002 },
          { id: 'gpt-4', name: 'GPT-4', costPer1k: 0.03 }
        ]
      });
    }),
    testDataCloakFlow: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          connected: true,
          version: '1.2.0',
          features: ['pii_detection', 'masking'],
          responseTime: 150
        }
      });
    }),
    getDataCloakStats: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          totalProcessed: 5000,
          piiDetected: 1250,
          averageProcessingTime: 120,
          successRate: 0.995
        }
      });
    })
  }))
}));

// Mock async handler middleware
jest.mock('../../middleware/validation.middleware', () => ({
  asyncHandler: jest.fn((fn) => fn)
}));

describe('Sentiment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Sentiment Analysis Endpoints', () => {
    test('POST /api/sentiment/analyze should analyze single text', async () => {
      const testData = {
        text: 'I am very happy today!'
      };

      const response = await request(app)
        .post('/api/sentiment/analyze')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          id: 'analysis-123',
          text: testData.text,
          sentiment: 'positive',
          confidence: 0.85,
          model: 'gpt-3.5-turbo'
        }
      });
      expect(response.body.data).toHaveProperty('timestamp');
    });

    test('POST /api/sentiment/analyze should handle analysis errors', async () => {
      const response = await request(app)
        .post('/api/sentiment/analyze')
        .send({ text: 'error' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Analysis failed'
      });
    });

    test('POST /api/sentiment/batch should analyze multiple texts', async () => {
      const testData = {
        texts: ['Happy text', 'Neutral text', 'Another text']
      };

      const response = await request(app)
        .post('/api/sentiment/batch')
        .send(testData)
        .expect(200);

      expect(response.body).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            text: 'Happy text',
            sentiment: 'neutral',
            confidence: 0.8
          })
        ]),
        message: 'Analyzed 3 texts'
      });
    });

    test('POST /api/sentiment/batch should handle batch errors', async () => {
      const response = await request(app)
        .post('/api/sentiment/batch')
        .send({ texts: ['error'] })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Batch analysis failed'
      });
    });

    test('GET /api/sentiment/history should return analysis history', async () => {
      const response = await request(app)
        .get('/api/sentiment/history?page=1&pageSize=10')
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            sentiment: expect.any(String),
            text: expect.any(String)
          })
        ]),
        pagination: {
          page: 1,
          pageSize: 10,
          total: 50,
          totalPages: 5
        }
      });
    });

    test('GET /api/sentiment/statistics should return sentiment statistics', async () => {
      const response = await request(app)
        .get('/api/sentiment/statistics')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          total: 1000,
          positive: 400,
          negative: 300,
          neutral: 300,
          averageConfidence: 0.82
        }
      });
    });
  });

  describe('Result Management Endpoints', () => {
    test('GET /api/sentiment/results/:id should return specific analysis', async () => {
      const response = await request(app)
        .get('/api/sentiment/results/analysis-123')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          id: 'analysis-123',
          sentiment: 'positive',
          confidence: 0.9
        }
      });
    });

    test('GET /api/sentiment/results/:id should return 404 for non-existent analysis', async () => {
      const response = await request(app)
        .get('/api/sentiment/results/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Analysis not found'
      });
    });

    test('DELETE /api/sentiment/results should delete analysis results', async () => {
      const response = await request(app)
        .delete('/api/sentiment/results')
        .send({ ids: ['analysis-1', 'analysis-2'] })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Deleted 2 analysis results',
        deleted: 2
      });
    });

    test('DELETE /api/sentiment/results should handle delete errors', async () => {
      const response = await request(app)
        .delete('/api/sentiment/results')
        .send({ ids: ['error'] })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Delete failed'
      });
    });

    test('GET /api/sentiment/export should export analysis results', async () => {
      const response = await request(app)
        .get('/api/sentiment/export?format=csv')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          exportId: 'export-123',
          format: 'csv',
          downloadUrl: '/api/sentiment/download/export-123.csv'
        }
      });
      expect(response.body.data).toHaveProperty('expiresAt');
    });

    test('GET /api/sentiment/export should handle invalid format', async () => {
      const response = await request(app)
        .get('/api/sentiment/export?format=invalid')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid format'
      });
    });

    test('GET /api/sentiment/insights should return analysis insights', async () => {
      const response = await request(app)
        .get('/api/sentiment/insights')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          trends: {
            daily: expect.any(Array),
            weekly: expect.any(Array)
          },
          keywords: expect.arrayContaining([
            expect.objectContaining({
              word: expect.any(String),
              sentiment: expect.any(String)
            })
          ]),
          summary: {
            totalAnalyzed: 1000,
            averageConfidence: 0.85
          }
        }
      });
    });
  });

  describe('Cost Estimation Endpoints', () => {
    test('POST /api/sentiment/estimate-cost should estimate analysis cost', async () => {
      const testData = {
        textCount: 100,
        avgLength: 50
      };

      const response = await request(app)
        .post('/api/sentiment/estimate-cost')
        .send(testData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          estimatedCost: 5,
          currency: 'USD',
          breakdown: {
            tokenCost: expect.any(Number),
            processingCost: expect.any(Number)
          },
          textCount: 100,
          avgLength: 50
        }
      });
    });

    test('GET /api/sentiment/compare-costs should compare model costs', async () => {
      const response = await request(app)
        .get('/api/sentiment/compare-costs')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          models: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              costPer1k: expect.any(Number)
            })
          ]),
          recommendation: 'gpt-3.5-turbo',
          savings: expect.any(String)
        }
      });
    });
  });

  describe('OpenAI Management Endpoints', () => {
    test('GET /api/sentiment/openai/test should test OpenAI connection', async () => {
      const response = await request(app)
        .get('/api/sentiment/openai/test')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          connected: true,
          model: 'gpt-3.5-turbo',
          responseTime: 245,
          version: 'v1'
        }
      });
    });

    test('GET /api/sentiment/openai/status should return OpenAI status', async () => {
      const response = await request(app)
        .get('/api/sentiment/openai/status')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          configured: true,
          model: 'gpt-3.5-turbo',
          rateLimit: {
            requests: 1000,
            tokens: 150000,
            remaining: 850
          }
        }
      });
      expect(response.body.data).toHaveProperty('lastChecked');
    });

    test('PUT /api/sentiment/openai/config should update OpenAI config', async () => {
      const configData = {
        model: 'gpt-4',
        maxTokens: 2000
      };

      const response = await request(app)
        .put('/api/sentiment/openai/config')
        .send(configData)
        .expect(200);

      expect(response.body).toEqual({
        data: configData,
        message: 'OpenAI configuration updated successfully'
      });
    });

    test('GET /api/sentiment/models should return available models', async () => {
      const response = await request(app)
        .get('/api/sentiment/models')
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            costPer1k: expect.any(Number)
          })
        ])
      });
    });
  });

  describe('DataCloak Integration Endpoints', () => {
    test('GET /api/sentiment/datacloak/test should test DataCloak flow', async () => {
      const response = await request(app)
        .get('/api/sentiment/datacloak/test')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          connected: true,
          version: '1.2.0',
          features: ['pii_detection', 'masking'],
          responseTime: 150
        }
      });
    });

    test('GET /api/sentiment/datacloak/stats should return DataCloak statistics', async () => {
      const response = await request(app)
        .get('/api/sentiment/datacloak/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          totalProcessed: 5000,
          piiDetected: 1250,
          averageProcessingTime: 120,
          successRate: 0.995
        }
      });
    });
  });

  describe('Middleware and Validation', () => {
    test('should use asyncHandler middleware for all endpoints', async () => {
      const { asyncHandler } = require('../../middleware/validation.middleware');
      
      expect(asyncHandler).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text analysis', async () => {
      await request(app)
        .post('/api/sentiment/analyze')
        .send({ text: '' })
        .expect(200);
    });

    test('should handle large batch analysis', async () => {
      const largeTexts = Array(100).fill('test text');
      await request(app)
        .post('/api/sentiment/batch')
        .send({ texts: largeTexts })
        .expect(200);
    });

    test('should handle pagination edge cases', async () => {
      await request(app)
        .get('/api/sentiment/history?page=0&pageSize=1000')
        .expect(200);
    });

    test('should handle delete all results', async () => {
      await request(app)
        .delete('/api/sentiment/results')
        .send({})
        .expect(200);
    });
  });
});