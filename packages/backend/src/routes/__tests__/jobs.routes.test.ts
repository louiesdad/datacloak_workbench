import request from 'supertest';
import express from 'express';
import jobsRoutes from '../jobs.routes';

const app = express();
app.use(express.json());
app.use('/api/jobs', jobsRoutes);

// Mock the job controller
jest.mock('../../controllers/job.controller', () => ({
  JobController: jest.fn().mockImplementation(() => ({
    createJob: jest.fn(async (req, res) => {
      const { type, data } = req.body;
      if (type === 'invalid') {
        return res.status(400).json({ error: 'Invalid job type' });
      }
      res.status(201).json({
        data: {
          jobId: 'job-123',
          type,
          status: 'queued',
          priority: 'normal',
          createdAt: Date.now(),
          estimatedDuration: 30000
        }
      });
    }),
    getJob: jest.fn(async (req, res) => {
      const { jobId } = req.params;
      if (jobId === 'nonexistent') {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.status(200).json({
        data: {
          jobId,
          type: 'sentiment_analysis',
          status: 'completed',
          progress: 100,
          result: { sentiment: 'positive', confidence: 0.9 },
          createdAt: Date.now() - 60000,
          completedAt: Date.now()
        }
      });
    }),
    getJobProgress: jest.fn(async (req, res) => {
      const { jobId } = req.params;
      if (jobId === 'nonexistent') {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.status(200).json({
        data: {
          jobId,
          progress: 75,
          status: 'running',
          currentStep: 'Processing batch 3/4',
          processedItems: 750,
          totalItems: 1000,
          estimatedTimeRemaining: 15000
        }
      });
    }),
    getJobEvents: jest.fn(async (req, res) => {
      const { jobId } = req.params;
      if (jobId === 'nonexistent') {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.status(200).json({
        data: {
          jobId,
          events: [
            { timestamp: Date.now() - 60000, event: 'job_created', message: 'Job queued for processing' },
            { timestamp: Date.now() - 45000, event: 'job_started', message: 'Processing started' },
            { timestamp: Date.now() - 30000, event: 'progress_update', message: 'Processed 500/1000 items' },
            { timestamp: Date.now(), event: 'progress_update', message: 'Processed 750/1000 items' }
          ]
        }
      });
    }),
    getJobs: jest.fn(async (req, res) => {
      const { status, type, limit = 10, offset = 0 } = req.query;
      const allJobs = [
        { jobId: 'job-1', type: 'sentiment_analysis', status: 'completed', createdAt: Date.now() - 120000 },
        { jobId: 'job-2', type: 'pii_detection', status: 'running', createdAt: Date.now() - 60000 },
        { jobId: 'job-3', type: 'data_export', status: 'queued', createdAt: Date.now() - 30000 }
      ];
      
      let filteredJobs = allJobs;
      if (status) filteredJobs = filteredJobs.filter(job => job.status === status);
      if (type) filteredJobs = filteredJobs.filter(job => job.type === type);
      
      const paginatedJobs = filteredJobs.slice(Number(offset), Number(offset) + Number(limit));
      
      res.status(200).json({
        data: paginatedJobs,
        pagination: {
          total: filteredJobs.length,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < filteredJobs.length
        }
      });
    }),
    cancelJob: jest.fn(async (req, res) => {
      const { jobId } = req.params;
      if (jobId === 'nonexistent') {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (jobId === 'completed') {
        return res.status(400).json({ error: 'Cannot cancel completed job' });
      }
      res.status(200).json({
        message: 'Job cancelled successfully',
        jobId
      });
    }),
    getStats: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          total: 1500,
          queued: 25,
          running: 10,
          completed: 1400,
          failed: 65,
          averageWaitTime: 5000,
          averageProcessingTime: 30000,
          throughput: {
            hourly: 50,
            daily: 1200
          }
        }
      });
    }),
    waitForJob: jest.fn(async (req, res) => {
      const { jobId } = req.params;
      const { timeout = 30000 } = req.body;
      
      if (jobId === 'nonexistent') {
        return res.status(404).json({ error: 'Job not found' });
      }
      if (jobId === 'timeout') {
        return res.status(408).json({ error: 'Job wait timeout' });
      }
      
      res.status(200).json({
        data: {
          jobId,
          status: 'completed',
          result: { sentiment: 'positive', confidence: 0.9 },
          waitTime: 15000,
          timeout
        }
      });
    })
  }))
}));

// Mock validation middleware
jest.mock('../../middleware/validation.middleware', () => ({
  validateBody: jest.fn(() => (req, res, next) => next()),
  validateParams: jest.fn(() => (req, res, next) => next()),
  validateQuery: jest.fn(() => (req, res, next) => next())
}));

// Mock job schemas
jest.mock('../../validation/job.schemas', () => ({
  createJob: { body: {} },
  getJob: { params: {} },
  getJobs: { query: {} },
  cancelJob: { params: {} },
  waitForJob: { params: {}, body: {} }
}));

describe('Jobs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Job Creation', () => {
    test('POST /api/jobs should create a new job', async () => {
      const jobData = {
        type: 'sentiment_analysis',
        data: { text: 'Happy text to analyze' },
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .expect(201);

      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          type: 'sentiment_analysis',
          status: 'queued',
          priority: 'normal'
        }
      });
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('estimatedDuration');
    });

    test('POST /api/jobs should handle invalid job type', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({ type: 'invalid', data: {} })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid job type'
      });
    });
  });

  describe('Job Retrieval', () => {
    test('GET /api/jobs/:jobId should return specific job', async () => {
      const response = await request(app)
        .get('/api/jobs/job-123')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          type: 'sentiment_analysis',
          status: 'completed',
          progress: 100,
          result: expect.any(Object)
        }
      });
      expect(response.body.data).toHaveProperty('createdAt');
      expect(response.body.data).toHaveProperty('completedAt');
    });

    test('GET /api/jobs/:jobId should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Job not found'
      });
    });

    test('GET /api/jobs should return all jobs with pagination', async () => {
      const response = await request(app)
        .get('/api/jobs?limit=2&offset=0')
        .expect(200);

      expect(response.body).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            jobId: expect.any(String),
            type: expect.any(String),
            status: expect.any(String)
          })
        ]),
        pagination: {
          total: expect.any(Number),
          limit: 2,
          offset: 0,
          hasMore: expect.any(Boolean)
        }
      });
    });

    test('GET /api/jobs should filter by status', async () => {
      const response = await request(app)
        .get('/api/jobs?status=completed')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('completed');
    });

    test('GET /api/jobs should filter by type', async () => {
      const response = await request(app)
        .get('/api/jobs?type=sentiment_analysis')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('sentiment_analysis');
    });
  });

  describe('Job Progress and Events', () => {
    test('GET /api/jobs/:jobId/progress should return job progress', async () => {
      const response = await request(app)
        .get('/api/jobs/job-123/progress')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          progress: 75,
          status: 'running',
          currentStep: 'Processing batch 3/4',
          processedItems: 750,
          totalItems: 1000
        }
      });
      expect(response.body.data).toHaveProperty('estimatedTimeRemaining');
    });

    test('GET /api/jobs/:jobId/events should return job event timeline', async () => {
      const response = await request(app)
        .get('/api/jobs/job-123/events')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          events: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(Number),
              event: expect.any(String),
              message: expect.any(String)
            })
          ])
        }
      });
    });
  });

  describe('Job Cancellation', () => {
    test('DELETE /api/jobs/:jobId should cancel job', async () => {
      const response = await request(app)
        .delete('/api/jobs/job-123')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Job cancelled successfully',
        jobId: 'job-123'
      });
    });

    test('DELETE /api/jobs/:jobId should handle non-existent job', async () => {
      const response = await request(app)
        .delete('/api/jobs/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Job not found'
      });
    });

    test('DELETE /api/jobs/:jobId should handle completed job cancellation', async () => {
      const response = await request(app)
        .delete('/api/jobs/completed')
        .expect(400);

      expect(response.body).toEqual({
        error: 'Cannot cancel completed job'
      });
    });
  });

  describe('Job Statistics', () => {
    test('GET /api/jobs/stats/summary should return queue statistics', async () => {
      const response = await request(app)
        .get('/api/jobs/stats/summary')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          total: 1500,
          queued: 25,
          running: 10,
          completed: 1400,
          failed: 65,
          averageWaitTime: 5000,
          averageProcessingTime: 30000,
          throughput: {
            hourly: 50,
            daily: 1200
          }
        }
      });
    });
  });

  describe('Job Waiting', () => {
    test('POST /api/jobs/:jobId/wait should wait for job completion', async () => {
      const waitData = { timeout: 30000 };

      const response = await request(app)
        .post('/api/jobs/job-123/wait')
        .send(waitData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          jobId: 'job-123',
          status: 'completed',
          result: expect.any(Object),
          waitTime: 15000,
          timeout: 30000
        }
      });
    });

    test('POST /api/jobs/:jobId/wait should handle timeout', async () => {
      const response = await request(app)
        .post('/api/jobs/timeout/wait')
        .send({ timeout: 5000 })
        .expect(408);

      expect(response.body).toEqual({
        error: 'Job wait timeout'
      });
    });
  });

  describe('Validation and Middleware', () => {
    test('should use validation middleware for all endpoints', async () => {
      const { validateBody, validateParams, validateQuery } = require('../../middleware/validation.middleware');
      
      await request(app).post('/api/jobs').send({ type: 'test', data: {} });
      await request(app).get('/api/jobs/job-123');
      await request(app).get('/api/jobs');
      await request(app).delete('/api/jobs/job-123');
      await request(app).post('/api/jobs/job-123/wait').send({});

      expect(validateBody).toHaveBeenCalled();
      expect(validateParams).toHaveBeenCalled();
      expect(validateQuery).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle jobs with complex data', async () => {
      const complexJobData = {
        type: 'batch_analysis',
        data: {
          texts: Array(1000).fill('sample text'),
          options: { model: 'gpt-4', confidence: 0.9 }
        },
        priority: 'high'
      };

      await request(app)
        .post('/api/jobs')
        .send(complexJobData)
        .expect(201);
    });

    test('should handle pagination edge cases', async () => {
      await request(app)
        .get('/api/jobs?limit=0&offset=1000')
        .expect(200);
    });

    test('should handle multiple filters', async () => {
      await request(app)
        .get('/api/jobs?status=running&type=sentiment_analysis&limit=5')
        .expect(200);
    });

    test('should handle wait with default timeout', async () => {
      await request(app)
        .post('/api/jobs/job-123/wait')
        .send({})
        .expect(200);
    });
  });
});