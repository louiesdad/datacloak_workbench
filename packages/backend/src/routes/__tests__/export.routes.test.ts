import request from 'supertest';
import express from 'express';
import exportRoutes from '../export.routes';

const app = express();
app.use(express.json());
app.use('/api/export', exportRoutes);

// Mock the export controller
jest.mock('../../controllers/export.controller', () => ({
  ExportController: jest.fn().mockImplementation(() => ({
    exportDataset: jest.fn(async (req, res) => {
      const { tableName, format } = req.body;
      if (tableName === 'nonexistent') {
        return res.status(404).json({ error: 'Table not found' });
      }
      if (tableName === 'error') {
        return res.status(500).json({ error: 'Export failed' });
      }
      res.status(200).json({
        data: {
          exportId: 'export-123',
          format,
          status: 'in_progress',
          estimatedCompletion: Date.now() + 30000
        }
      });
    }),
    streamExport: jest.fn(async (req, res) => {
      const { tableName, format } = req.query;
      if (tableName === 'error') {
        return res.status(500).json({ error: 'Stream failed' });
      }
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=export.${format}`);
      res.status(200).send(format === 'csv' ? 'id,name\n1,test' : '{"data":[{"id":1,"name":"test"}]}');
    }),
    getExportProgress: jest.fn(async (req, res) => {
      const { exportId } = req.params;
      if (exportId === 'nonexistent') {
        return res.status(404).json({ error: 'Export not found' });
      }
      res.status(200).json({
        data: {
          exportId,
          status: 'in_progress',
          progress: 65,
          processedRows: 650,
          totalRows: 1000,
          estimatedTimeRemaining: 15000
        }
      });
    }),
    cancelExport: jest.fn(async (req, res) => {
      const { exportId } = req.params;
      if (exportId === 'nonexistent') {
        return res.status(404).json({ error: 'Export not found' });
      }
      res.status(200).json({
        message: 'Export cancelled successfully',
        exportId
      });
    }),
    getErrorStatistics: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          totalExports: 1000,
          successfulExports: 950,
          failedExports: 50,
          errorTypes: {
            'timeout': 20,
            'out_of_memory': 15,
            'disk_full': 10,
            'permission_denied': 5
          },
          averageExportTime: 45000
        }
      });
    }),
    cleanupExports: jest.fn(async (req, res) => {
      const { maxAgeHours = 24 } = req.body;
      res.status(200).json({
        message: 'Cleanup completed',
        deletedFiles: 15,
        freedSpace: '2.5GB',
        maxAgeHours
      });
    }),
    exportEnhanced: jest.fn(async (req, res) => {
      const { tableName, format, encryption = false } = req.body;
      if (tableName === 'error') {
        return res.status(500).json({ error: 'Enhanced export failed' });
      }
      res.status(200).json({
        data: {
          exportId: 'enhanced-export-456',
          format,
          encryption,
          status: 'queued',
          features: ['compression', 'resumable'],
          estimatedSize: '15MB'
        }
      });
    }),
    createFormatTransform: jest.fn(async (req, res) => {
      const { fromFormat, toFormat, tableName } = req.query;
      res.status(200).json({
        data: {
          transformId: 'transform-789',
          fromFormat,
          toFormat,
          tableName,
          status: 'transforming',
          progress: 0
        }
      });
    }),
    resumeExport: jest.fn(async (req, res) => {
      const { exportId } = req.params;
      if (exportId === 'nonexistent') {
        return res.status(404).json({ error: 'Export not found' });
      }
      res.status(200).json({
        message: 'Export resumed successfully',
        exportId,
        resumePoint: 650,
        estimatedCompletion: Date.now() + 20000
      });
    }),
    streamEnhancedExport: jest.fn(async (req, res) => {
      const { format = 'csv', compression } = req.query;
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      if (compression === 'gzip') {
        res.setHeader('Content-Encoding', 'gzip');
      }
      res.status(200).send('enhanced stream data');
    }),
    getMemoryStats: jest.fn(async (req, res) => {
      res.status(200).json({
        data: {
          used: '256MB',
          total: '1GB',
          free: '768MB',
          heapUsed: '180MB',
          heapTotal: '512MB',
          external: '15MB'
        }
      });
    }),
    forceGarbageCollection: jest.fn(async (req, res) => {
      res.status(200).json({
        message: 'Garbage collection completed',
        memoryFreed: '45MB',
        newMemoryUsage: '211MB'
      });
    })
  }))
}));

// Mock async middleware
jest.mock('../../middleware/async.middleware', () => ({
  asyncHandler: jest.fn((fn) => fn),
  validate: jest.fn(() => (req, res, next) => next())
}));

describe('Export Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dataset Export', () => {
    test('POST /api/export/dataset should export dataset', async () => {
      const exportData = {
        tableName: 'users',
        format: 'csv',
        columns: ['id', 'name', 'email'],
        maxRows: 1000
      };

      const response = await request(app)
        .post('/api/export/dataset')
        .send(exportData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          exportId: 'export-123',
          format: 'csv',
          status: 'in_progress'
        }
      });
      expect(response.body.data).toHaveProperty('estimatedCompletion');
    });

    test('POST /api/export/dataset should handle non-existent table', async () => {
      const response = await request(app)
        .post('/api/export/dataset')
        .send({ tableName: 'nonexistent', format: 'csv' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'Table not found'
      });
    });

    test('POST /api/export/dataset should handle export errors', async () => {
      const response = await request(app)
        .post('/api/export/dataset')
        .send({ tableName: 'error', format: 'csv' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Export failed'
      });
    });
  });

  describe('Stream Export', () => {
    test('GET /api/export/stream should stream CSV export', async () => {
      const response = await request(app)
        .get('/api/export/stream?tableName=users&format=csv')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toBe('attachment; filename=export.csv');
      expect(response.text).toBe('id,name\n1,test');
    });

    test('GET /api/export/stream should stream JSON export', async () => {
      const response = await request(app)
        .get('/api/export/stream?tableName=users&format=json')
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json');
      expect(response.text).toBe('{"data":[{"id":1,"name":"test"}]}');
    });

    test('GET /api/export/stream should handle stream errors', async () => {
      const response = await request(app)
        .get('/api/export/stream?tableName=error&format=csv')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Stream failed'
      });
    });
  });

  describe('Export Progress and Management', () => {
    test('GET /api/export/progress/:exportId should return export progress', async () => {
      const response = await request(app)
        .get('/api/export/progress/export-123')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          exportId: 'export-123',
          status: 'in_progress',
          progress: 65,
          processedRows: 650,
          totalRows: 1000
        }
      });
      expect(response.body.data).toHaveProperty('estimatedTimeRemaining');
    });

    test('GET /api/export/progress/:exportId should handle non-existent export', async () => {
      const response = await request(app)
        .get('/api/export/progress/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Export not found'
      });
    });

    test('POST /api/export/cancel/:exportId should cancel export', async () => {
      const response = await request(app)
        .post('/api/export/cancel/export-123')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Export cancelled successfully',
        exportId: 'export-123'
      });
    });

    test('POST /api/export/cancel/:exportId should handle non-existent export', async () => {
      const response = await request(app)
        .post('/api/export/cancel/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        error: 'Export not found'
      });
    });
  });

  describe('Export Statistics and Cleanup', () => {
    test('GET /api/export/errors/statistics should return error statistics', async () => {
      const response = await request(app)
        .get('/api/export/errors/statistics')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          totalExports: 1000,
          successfulExports: 950,
          failedExports: 50,
          errorTypes: expect.any(Object),
          averageExportTime: 45000
        }
      });
    });

    test('POST /api/export/cleanup should cleanup old exports', async () => {
      const response = await request(app)
        .post('/api/export/cleanup')
        .send({ maxAgeHours: 48 })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Cleanup completed',
        deletedFiles: 15,
        freedSpace: '2.5GB',
        maxAgeHours: 48
      });
    });

    test('POST /api/export/cleanup should use default maxAgeHours', async () => {
      const response = await request(app)
        .post('/api/export/cleanup')
        .send({})
        .expect(200);

      expect(response.body.maxAgeHours).toBe(24);
    });
  });

  describe('Enhanced Export Features', () => {
    test('POST /api/export/enhanced should create enhanced export', async () => {
      const enhancedData = {
        tableName: 'users',
        format: 'parquet',
        encryption: true,
        compression: 'gzip',
        resumable: true
      };

      const response = await request(app)
        .post('/api/export/enhanced')
        .send(enhancedData)
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          exportId: 'enhanced-export-456',
          format: 'parquet',
          encryption: true,
          status: 'queued',
          features: ['compression', 'resumable']
        }
      });
    });

    test('GET /api/export/transform should create format transform', async () => {
      const response = await request(app)
        .get('/api/export/transform?fromFormat=csv&toFormat=parquet&tableName=users')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          transformId: 'transform-789',
          fromFormat: 'csv',
          toFormat: 'parquet',
          tableName: 'users',
          status: 'transforming'
        }
      });
    });

    test('POST /api/export/resume/:exportId should resume export', async () => {
      const resumeData = {
        options: { chunkSize: 1000, compression: true }
      };

      const response = await request(app)
        .post('/api/export/resume/export-123')
        .send(resumeData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Export resumed successfully',
        exportId: 'export-123',
        resumePoint: 650
      });
    });

    test('GET /api/export/stream-enhanced should stream enhanced export', async () => {
      const response = await request(app)
        .get('/api/export/stream-enhanced?tableName=users&format=csv&compression=gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.text).toBe('enhanced stream data');
    });
  });

  describe('Memory Management', () => {
    test('GET /api/export/memory/stats should return memory statistics', async () => {
      const response = await request(app)
        .get('/api/export/memory/stats')
        .expect(200);

      expect(response.body).toMatchObject({
        data: {
          used: '256MB',
          total: '1GB',
          free: '768MB',
          heapUsed: '180MB',
          heapTotal: '512MB',
          external: '15MB'
        }
      });
    });

    test('POST /api/export/memory/gc should force garbage collection', async () => {
      const response = await request(app)
        .post('/api/export/memory/gc')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Garbage collection completed',
        memoryFreed: '45MB',
        newMemoryUsage: '211MB'
      });
    });
  });

  describe('Validation and Middleware', () => {
    test('should use validation middleware for POST endpoints', async () => {
      const { validate } = require('../../middleware/async.middleware');
      
      await request(app).post('/api/export/dataset').send({ tableName: 'test', format: 'csv' });
      await request(app).post('/api/export/enhanced').send({ tableName: 'test', format: 'csv' });
      await request(app).post('/api/export/cleanup').send({});

      expect(validate).toHaveBeenCalled();
    });

    test('should use asyncHandler for all endpoints', async () => {
      const { asyncHandler } = require('../../middleware/async.middleware');
      
      expect(asyncHandler).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing query parameters gracefully', async () => {
      // This would normally be caught by validation, but testing route structure
      await request(app)
        .get('/api/export/stream')
        .expect(200);
    });

    test('should handle large export requests', async () => {
      await request(app)
        .post('/api/export/dataset')
        .send({ 
          tableName: 'large_table', 
          format: 'csv', 
          maxRows: 1000000,
          chunkSize: 10000
        })
        .expect(200);
    });

    test('should handle multiple export formats', async () => {
      const formats = ['csv', 'json', 'excel', 'parquet'];
      
      for (const format of formats) {
        await request(app)
          .post('/api/export/dataset')
          .send({ tableName: 'test', format })
          .expect(200);
      }
    });

    test('should handle export with all optional parameters', async () => {
      await request(app)
        .post('/api/export/enhanced')
        .send({
          tableName: 'complete_test',
          format: 'parquet',
          columns: ['id', 'name'],
          filters: { active: true },
          chunkSize: 5000,
          maxRows: 50000,
          encryption: true,
          compression: 'gzip',
          resumable: true,
          notificationWebhook: 'https://example.com/webhook'
        })
        .expect(200);
    });
  });
});