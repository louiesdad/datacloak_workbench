import request from 'supertest';
import express from 'express';

// Mock the stream controller
const mockStreamController = {
  getStreamConfig: jest.fn(),
  streamProcess: jest.fn(),
  getMemoryStats: jest.fn(),
  processChunk: jest.fn(),
};

// Mock async handler middleware
const mockAsyncHandler = jest.fn((fn) => fn);

jest.mock('../../controllers/stream.controller', () => ({
  StreamController: jest.fn().mockImplementation(() => mockStreamController)
}));

jest.mock('../../middleware/async.middleware', () => ({
  asyncHandler: mockAsyncHandler
}));

import { router as streamRoutes } from '../stream.routes';

describe('Stream Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/stream', streamRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /stream/config/:filename', () => {
    it('should get streaming configuration for a file', async () => {
      const mockConfig = {
        filename: 'large-dataset.csv',
        fileSize: 104857600, // 100MB
        recommendedChunkSize: 1048576, // 1MB
        estimatedChunks: 100,
        streamingSupported: true,
        memoryRequirement: 2097152, // 2MB
        processingOptions: {
          parallelize: true,
          maxConcurrency: 4,
          bufferSize: 524288 // 512KB
        }
      };

      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        expect(req.params.filename).toBe('large-dataset.csv');
        res.json({ success: true, data: mockConfig });
      });

      const response = await request(app)
        .get('/stream/config/large-dataset.csv')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockConfig
      });
      expect(mockStreamController.getStreamConfig).toHaveBeenCalled();
      expect(mockAsyncHandler).toHaveBeenCalled();
    });

    it('should handle file not found', async () => {
      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        res.status(404).json({
          success: false,
          error: 'File not found'
        });
      });

      const response = await request(app)
        .get('/stream/config/nonexistent.csv')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File not found');
    });

    it('should handle files that do not support streaming', async () => {
      const mockConfig = {
        filename: 'small-file.txt',
        fileSize: 1024,
        streamingSupported: false,
        reason: 'File too small for streaming benefits'
      };

      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        res.json({ success: true, data: mockConfig });
      });

      const response = await request(app)
        .get('/stream/config/small-file.txt')
        .expect(200);

      expect(response.body.data.streamingSupported).toBe(false);
      expect(response.body.data.reason).toBeDefined();
    });

    it('should handle special characters in filename', async () => {
      const filename = 'file with spaces & special chars (1).csv';
      const encodedFilename = encodeURIComponent(filename);

      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: { filename: req.params.filename }
        });
      });

      const response = await request(app)
        .get(`/stream/config/${encodedFilename}`)
        .expect(200);

      expect(mockStreamController.getStreamConfig).toHaveBeenCalled();
    });
  });

  describe('POST /stream/process/:filename', () => {
    it('should start streaming process with SSE', async () => {
      const filename = 'dataset.csv';

      mockStreamController.streamProcess.mockImplementation((req, res) => {
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Send processing events
        res.write('event: started\ndata: {"message":"Processing started","filename":"dataset.csv"}\n\n');
        res.write('event: progress\ndata: {"processed":25,"total":100,"percentage":25}\n\n');
        res.write('event: progress\ndata: {"processed":50,"total":100,"percentage":50}\n\n');
        res.write('event: progress\ndata: {"processed":75,"total":100,"percentage":75}\n\n');
        res.write('event: completed\ndata: {"message":"Processing completed","totalRecords":1000}\n\n');
        res.end();
      });

      const response = await request(app)
        .post(`/stream/process/${filename}`)
        .send({
          options: {
            chunkSize: 1000,
            delimiter: ',',
            skipHeaders: false
          }
        });

      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.text).toContain('event: started');
      expect(response.text).toContain('event: progress');
      expect(response.text).toContain('event: completed');
      expect(mockStreamController.streamProcess).toHaveBeenCalled();
    });

    it('should handle streaming process with custom options', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        expect(req.body.options).toEqual({
          chunkSize: 5000,
          delimiter: '|',
          skipHeaders: true,
          encoding: 'utf-8'
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: configured\ndata: {"chunkSize":5000,"delimiter":"|"}\n\n');
        res.end();
      });

      const response = await request(app)
        .post('/stream/process/custom-data.psv')
        .send({
          options: {
            chunkSize: 5000,
            delimiter: '|',
            skipHeaders: true,
            encoding: 'utf-8'
          }
        });

      expect(response.text).toContain('event: configured');
    });

    it('should handle streaming errors', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: started\ndata: {"message":"Processing started"}\n\n');
        res.write('event: error\ndata: {"error":"File corrupted at line 150","code":"PARSE_ERROR"}\n\n');
        res.end();
      });

      const response = await request(app)
        .post('/stream/process/corrupted-file.csv')
        .send({});

      expect(response.text).toContain('event: error');
      expect(response.text).toContain('File corrupted');
    });

    it('should handle client disconnect during streaming', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: started\ndata: {}\n\n');

        // Simulate client disconnect
        req.on('close', () => {
          res.write('event: disconnected\ndata: {"message":"Client disconnected"}\n\n');
          res.end();
        });

        // Force disconnect after delay
        setTimeout(() => {
          req.emit('close');
        }, 10);
      });

      const response = await request(app)
        .post('/stream/process/test-file.csv')
        .send({});

      expect(mockStreamController.streamProcess).toHaveBeenCalled();
    });

    it('should validate filename parameter', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        if (!req.params.filename) {
          return res.status(400).json({
            success: false,
            error: 'Filename is required'
          });
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.end();
      });

      // This should work with the router
      const response = await request(app)
        .post('/stream/process/')
        .send({})
        .expect(404); // Express returns 404 for missing route params
    });
  });

  describe('GET /stream/memory', () => {
    it('should get current memory usage statistics', async () => {
      const mockMemoryStats = {
        system: {
          totalMemory: 8589934592, // 8GB
          freeMemory: 2147483648,  // 2GB
          usedMemory: 6442450944   // 6GB
        },
        process: {
          rss: 134217728,     // 128MB
          heapTotal: 67108864, // 64MB
          heapUsed: 33554432,  // 32MB
          external: 8388608,   // 8MB
          arrayBuffers: 4194304 // 4MB
        },
        streaming: {
          activeStreams: 3,
          totalBufferSize: 16777216, // 16MB
          averageChunkSize: 1048576,  // 1MB
          peakMemoryUsage: 268435456  // 256MB
        },
        recommendations: {
          maxConcurrentStreams: 5,
          recommendedChunkSize: 2097152, // 2MB
          memoryPressure: 'medium'
        }
      };

      mockStreamController.getMemoryStats.mockImplementation((req, res) => {
        res.json({ success: true, data: mockMemoryStats });
      });

      const response = await request(app)
        .get('/stream/memory')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockMemoryStats
      });
      expect(mockStreamController.getMemoryStats).toHaveBeenCalled();
    });

    it('should handle memory stats collection errors', async () => {
      mockStreamController.getMemoryStats.mockImplementation((req, res) => {
        res.status(500).json({
          success: false,
          error: 'Unable to collect memory statistics'
        });
      });

      const response = await request(app)
        .get('/stream/memory')
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should include memory usage trends when requested', async () => {
      mockStreamController.getMemoryStats.mockImplementation((req, res) => {
        const includeHistory = req.query.history === 'true';
        const stats = {
          current: { rss: 134217728 },
          ...(includeHistory && {
            history: [
              { timestamp: '2024-01-01T00:00:00Z', rss: 100000000 },
              { timestamp: '2024-01-01T00:01:00Z', rss: 120000000 },
              { timestamp: '2024-01-01T00:02:00Z', rss: 134217728 }
            ]
          })
        };
        res.json({ success: true, data: stats });
      });

      const response = await request(app)
        .get('/stream/memory?history=true')
        .expect(200);

      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);
    });
  });

  describe('POST /stream/chunk/:filename', () => {
    it('should process a specific chunk', async () => {
      const mockChunkResult = {
        chunkIndex: 5,
        recordsProcessed: 1000,
        processingTime: 1250,
        errors: [],
        memoryUsage: 8388608, // 8MB
        nextChunkIndex: 6,
        isComplete: false
      };

      mockStreamController.processChunk.mockImplementation((req, res) => {
        expect(req.params.filename).toBe('dataset.csv');
        expect(req.body.chunkIndex).toBe(5);
        res.json({ success: true, data: mockChunkResult });
      });

      const response = await request(app)
        .post('/stream/chunk/dataset.csv')
        .send({
          chunkIndex: 5,
          chunkSize: 1000,
          startOffset: 5000
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockChunkResult
      });
      expect(mockStreamController.processChunk).toHaveBeenCalled();
    });

    it('should handle final chunk processing', async () => {
      const mockFinalChunkResult = {
        chunkIndex: 10,
        recordsProcessed: 500,
        processingTime: 800,
        errors: [],
        memoryUsage: 4194304,
        nextChunkIndex: null,
        isComplete: true,
        summary: {
          totalRecords: 10500,
          totalProcessingTime: 15000,
          averageChunkTime: 1500
        }
      };

      mockStreamController.processChunk.mockImplementation((req, res) => {
        res.json({ success: true, data: mockFinalChunkResult });
      });

      const response = await request(app)
        .post('/stream/chunk/dataset.csv')
        .send({
          chunkIndex: 10,
          chunkSize: 500,
          startOffset: 10000
        })
        .expect(200);

      expect(response.body.data.isComplete).toBe(true);
      expect(response.body.data.summary).toBeDefined();
    });

    it('should handle chunk processing errors', async () => {
      mockStreamController.processChunk.mockImplementation((req, res) => {
        res.status(400).json({
          success: false,
          error: 'Invalid chunk parameters',
          details: {
            chunkIndex: 'Must be a positive integer',
            startOffset: 'Must be within file bounds'
          }
        });
      });

      const response = await request(app)
        .post('/stream/chunk/dataset.csv')
        .send({
          chunkIndex: -1,
          startOffset: 999999999
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });

    it('should handle chunk with data validation errors', async () => {
      const mockChunkWithErrors = {
        chunkIndex: 3,
        recordsProcessed: 800,
        errors: [
          { line: 2150, error: 'Missing required field: email' },
          { line: 2175, error: 'Invalid date format' },
          { line: 2200, error: 'Value exceeds maximum length' }
        ],
        processingTime: 1500,
        isComplete: false
      };

      mockStreamController.processChunk.mockImplementation((req, res) => {
        res.json({ success: true, data: mockChunkWithErrors });
      });

      const response = await request(app)
        .post('/stream/chunk/dataset.csv')
        .send({
          chunkIndex: 3,
          validation: {
            strict: true,
            skipInvalid: false
          }
        })
        .expect(200);

      expect(response.body.data.errors).toHaveLength(3);
      expect(response.body.data.recordsProcessed).toBe(800);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle controller errors gracefully', async () => {
      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        throw new Error('Controller error');
      });

      const response = await request(app)
        .get('/stream/config/test.csv')
        .expect(500);
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/stream/process/test.csv')
        .type('json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle very large filenames', async () => {
      const longFilename = 'a'.repeat(255) + '.csv';
      
      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        if (req.params.filename.length > 100) {
          return res.status(400).json({
            success: false,
            error: 'Filename too long'
          });
        }
        res.json({ success: true, data: {} });
      });

      const response = await request(app)
        .get(`/stream/config/${longFilename}`)
        .expect(400);
    });

    it('should handle concurrent chunk processing', async () => {
      let chunkCounter = 0;
      
      mockStreamController.processChunk.mockImplementation((req, res) => {
        chunkCounter++;
        const chunkIndex = req.body.chunkIndex || chunkCounter;
        
        setTimeout(() => {
          res.json({
            success: true,
            data: {
              chunkIndex,
              recordsProcessed: 100,
              processingTime: 50
            }
          });
        }, 10);
      });

      const requests = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/stream/chunk/dataset.csv')
          .send({ chunkIndex: index })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      expect(mockStreamController.processChunk).toHaveBeenCalledTimes(5);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle memory pressure scenarios', async () => {
      const highMemoryStats = {
        system: {
          usedMemory: 7516192768, // ~7GB of 8GB used
          memoryPressure: 'high'
        },
        recommendations: {
          maxConcurrentStreams: 2,
          recommendedChunkSize: 524288, // Reduce to 512KB
          suggestedAction: 'reduce_load'
        }
      };

      mockStreamController.getMemoryStats.mockImplementation((req, res) => {
        res.json({ success: true, data: highMemoryStats });
      });

      const response = await request(app)
        .get('/stream/memory')
        .expect(200);

      expect(response.body.data.system.memoryPressure).toBe('high');
      expect(response.body.data.recommendations.recommendedChunkSize).toBeLessThan(1048576);
    });

    it('should handle large file streaming configuration', async () => {
      const largeFileConfig = {
        filename: 'massive-dataset.csv',
        fileSize: 10737418240, // 10GB
        estimatedChunks: 10240,
        recommendedChunkSize: 1048576,
        warnings: [
          'Large file processing may take significant time',
          'Consider processing during off-peak hours'
        ],
        streamingSupported: true
      };

      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        res.json({ success: true, data: largeFileConfig });
      });

      const response = await request(app)
        .get('/stream/config/massive-dataset.csv')
        .expect(200);

      expect(response.body.data.fileSize).toBeGreaterThan(1073741824); // > 1GB
      expect(response.body.data.warnings).toBeDefined();
    });

    it('should handle streaming with resource limits', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: started\ndata: {"message":"Processing started"}\n\n');
        res.write('event: resource_limit\ndata: {"message":"Approaching memory limit","action":"pausing"}\n\n');
        res.write('event: resumed\ndata: {"message":"Processing resumed","delay_ms":2000}\n\n');
        res.write('event: completed\ndata: {"message":"Processing completed"}\n\n');
        res.end();
      });

      const response = await request(app)
        .post('/stream/process/large-file.csv')
        .send({
          options: {
            respectResourceLimits: true,
            maxMemoryUsage: 536870912 // 512MB
          }
        });

      expect(response.text).toContain('event: resource_limit');
      expect(response.text).toContain('event: resumed');
    });
  });

  describe('Security and Validation', () => {
    it('should sanitize filename parameters', async () => {
      const maliciousFilename = '../../../etc/passwd';
      
      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        // Should validate and reject dangerous paths
        if (req.params.filename.includes('..')) {
          return res.status(400).json({
            success: false,
            error: 'Invalid filename'
          });
        }
        res.json({ success: true, data: {} });
      });

      const response = await request(app)
        .get(`/stream/config/${encodeURIComponent(maliciousFilename)}`)
        .expect(400);

      expect(response.body.error).toBe('Invalid filename');
    });

    it('should validate streaming options', async () => {
      mockStreamController.streamProcess.mockImplementation((req, res) => {
        const { chunkSize } = req.body.options || {};
        
        if (chunkSize && (chunkSize < 1024 || chunkSize > 10485760)) {
          return res.status(400).json({
            success: false,
            error: 'Chunk size must be between 1KB and 10MB'
          });
        }
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('event: validated\ndata: {}\n\n');
        res.end();
      });

      const response = await request(app)
        .post('/stream/process/test.csv')
        .send({
          options: {
            chunkSize: 20971520 // 20MB - too large
          }
        })
        .expect(400);

      expect(response.body.error).toContain('Chunk size must be between');
    });

    it('should handle file access permissions', async () => {
      mockStreamController.getStreamConfig.mockImplementation((req, res) => {
        res.status(403).json({
          success: false,
          error: 'Access denied to file'
        });
      });

      const response = await request(app)
        .get('/stream/config/restricted-file.csv')
        .expect(403);

      expect(response.body.error).toBe('Access denied to file');
    });
  });
});