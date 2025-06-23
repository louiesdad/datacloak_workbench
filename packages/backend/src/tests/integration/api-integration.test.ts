import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { dataRoutes } from '../../routes/data.routes';
import authRoutes from '../../routes/auth.routes';
import { healthRoutes } from '../../routes/health.routes';
import { ConfigService } from '../../services/config.service';
import { DataService } from '../../services/data.service';
import { getDatabaseStatus } from '../../database';

// Mock dependencies before importing routes
jest.mock('../../services/config.service');
jest.mock('../../services/data.service');
jest.mock('../../database');

// Create mock instances
const mockConfigService = {
  getInstance: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

const mockDataService = {
  uploadDataset: jest.fn(),
  getDatasets: jest.fn(),
  getDatasetById: jest.fn(),
  deleteDataset: jest.fn(),
  exportData: jest.fn(),
};

const mockGetDatabaseStatus = jest.fn();

// Apply mocks by overriding the module exports
jest.doMock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: () => mockConfigService
  }
}));

jest.doMock('../../services/data.service', () => ({
  DataService: jest.fn().mockImplementation(() => mockDataService)
}));

jest.doMock('../../database', () => ({
  getDatabaseStatus: mockGetDatabaseStatus,
  closeDatabase: jest.fn()
}));

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: Server;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Add routes
    app.use('/api/auth', authRoutes);
    app.use('/api/data', dataRoutes);
    app.use('/api/health', healthRoutes);

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
      });
    });

    // Start server
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup config service mock
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return 'test-password';
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });

    // Mock database status
    mockGetDatabaseStatus.mockResolvedValue({
      sqlite: 'connected',
      duckdb: 'connected'
    });
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication workflow', async () => {
      // 1. Check health first
      const healthResponse = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // 2. Login with valid credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'test-password'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.token).toBeDefined();

      const token = loginResponse.body.token;

      // 3. Verify the token
      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({ token })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.valid).toBe(true);
      expect(verifyResponse.body.username).toBe('admin');
    });

    it('should handle invalid login and prevent unauthorized access', async () => {
      // 1. Try invalid login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password'
        })
        .expect(401);

      expect(loginResponse.body.success).toBe(false);

      // 2. Try with invalid token
      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(verifyResponse.body.valid).toBe(false);
    });
  });

  describe('Data Upload and Management Flow', () => {
    it('should handle complete data lifecycle', async () => {
      // Mock responses
      const mockUploadResult = {
        id: 'dataset-123',
        name: 'test-data.csv',
        rowCount: 100,
        status: 'completed'
      };

      const mockDatasets = {
        data: [mockUploadResult],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1
        }
      };

      const mockExportResult = {
        exportId: 'export-456',
        downloadUrl: '/downloads/export-456.csv',
        format: 'csv'
      };

      mockDataService.uploadDataset.mockResolvedValue(mockUploadResult);
      mockDataService.getDatasets.mockResolvedValue(mockDatasets);
      mockDataService.getDatasetById.mockResolvedValue(mockUploadResult);
      mockDataService.exportData.mockResolvedValue(mockExportResult);

      // 1. Upload file
      const csvContent = 'name,email,sentiment\nJohn,john@example.com,positive\nJane,jane@example.com,neutral';
      
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), {
          filename: 'test-data.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      expect(uploadResponse.body.data).toEqual(mockUploadResult);
      expect(mockDataService.uploadDataset).toHaveBeenCalled();

      // 2. List datasets
      const listResponse = await request(app)
        .get('/api/data/datasets?page=1&pageSize=10')
        .expect(200);

      expect(listResponse.body).toEqual(mockDatasets);
      expect(mockDataService.getDatasets).toHaveBeenCalledWith(1, 10);

      // 3. Get specific dataset
      const getResponse = await request(app)
        .get('/api/data/datasets/dataset-123')
        .expect(200);

      expect(getResponse.body.data).toEqual(mockUploadResult);
      expect(mockDataService.getDatasetById).toHaveBeenCalledWith('dataset-123');

      // 4. Export data
      const exportResponse = await request(app)
        .post('/api/data/export')
        .send({
          format: 'csv',
          datasetId: 'dataset-123'
        })
        .expect(200);

      expect(exportResponse.body.data).toEqual(mockExportResult);
      expect(mockDataService.exportData).toHaveBeenCalled();

      // 5. Delete dataset
      mockDataService.deleteDataset.mockResolvedValue({ success: true });

      const deleteResponse = await request(app)
        .delete('/api/data/datasets/dataset-123')
        .expect(200);

      expect(deleteResponse.body.data.id).toBe('dataset-123');
      expect(mockDataService.deleteDataset).toHaveBeenCalledWith('dataset-123');
    });

    it('should handle file upload validation errors', async () => {
      // Test invalid file type
      const response = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test content'), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should handle service errors gracefully', async () => {
      mockDataService.uploadDataset.mockRejectedValue(new Error('Database connection failed'));

      const csvContent = 'name,email\nJohn,john@example.com';
      
      const response = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database connection failed');
    });
  });

  describe('API Validation and Error Handling', () => {
    it('should validate request parameters', async () => {
      // Test missing required parameters
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' }) // Missing password
        .expect(400);

      expect(response1.body.error).toBe('Username and password are required');

      // Test invalid dataset ID format
      mockDataService.getDatasetById.mockRejectedValue(new Error('Invalid ID format'));

      const response2 = await request(app)
        .get('/api/data/datasets/invalid-uuid')
        .expect(500);

      expect(response2.body.success).toBe(false);
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);

      // Express should handle malformed JSON
    });

    it('should handle oversized requests', async () => {
      const largeData = 'x'.repeat(60 * 1024 * 1024); // 60MB

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: largeData })
        .expect(413);

      // Should reject requests exceeding 50MB limit
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      // Create 10 concurrent requests
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/data/datasets')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
      });

      expect(mockDataService.getDatasets).toHaveBeenCalledTimes(10);
    });

    it('should handle mixed concurrent operations', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      // Mix of different API calls
      const requests = [
        request(app).get('/api/health/status'),
        request(app).get('/api/data/datasets'),
        request(app).post('/api/auth/verify').send({ token: 'invalid' }),
        request(app).get('/api/health/ready'),
        request(app).get('/api/data/datasets?page=2')
      ];

      const responses = await Promise.all(requests);

      expect(responses[0].status).toBe(200); // health
      expect(responses[1].status).toBe(200); // datasets
      expect(responses[2].status).toBe(401); // invalid token
      expect(responses[3].status).toBe(200); // ready
      expect(responses[4].status).toBe(200); // datasets page 2
    });
  });

  describe('Database Integration', () => {
    it('should handle database connectivity issues', async () => {
      // Mock database connection failure
      (getDatabaseStatus as jest.Mock).mockResolvedValue({
        sqlite: 'disconnected',
        duckdb: 'connected'
      });

      const response = await request(app)
        .get('/api/health/ready')
        .expect(503);

      expect(response.body.ready).toBe(false);
    });

    it('should handle database timeout scenarios', async () => {
      // Mock database timeout
      (getDatabaseStatus as jest.Mock).mockImplementation(() =>
        new Promise(resolve => 
          setTimeout(() => resolve({
            sqlite: 'timeout',
            duckdb: 'connected'
          }), 100)
        )
      );

      const response = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(response.body.services.database.sqlite).toBe('timeout');
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent response formats', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      // Test successful responses
      const healthResponse = await request(app).get('/api/health/status');
      const dataResponse = await request(app).get('/api/data/datasets');
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test-password' });

      // All should have proper structure
      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body).toHaveProperty('timestamp');
      
      expect(dataResponse.body).toHaveProperty('data');
      expect(dataResponse.body).toHaveProperty('pagination');
      
      expect(loginResponse.body).toHaveProperty('success');
      expect(loginResponse.body).toHaveProperty('token');

      // Test error responses
      const errorResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });

      expect(errorResponse.body).toHaveProperty('success', false);
      expect(errorResponse.body).toHaveProperty('error');
    });

    it('should include proper HTTP status codes', async () => {
      mockDataService.uploadDataset.mockResolvedValue({ id: 'test' } as any);

      // Success cases
      await request(app).get('/api/health/status').expect(200);
      await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test,data\n1,2'), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(201);

      // Client error cases
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' })
        .expect(400);

      await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(401);

      // Not found case (with mocked error)
      mockDataService.getDatasetById.mockRejectedValue(new Error('Dataset not found'));
      await request(app)
        .get('/api/data/datasets/non-existent')
        .expect(500); // Converted to 500 by error handler
    });
  });

  describe('Performance and Load', () => {
    it('should handle rapid successive requests', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      const startTime = Date.now();
      
      // Make 50 rapid requests
      const promises = Array(50).fill(null).map(() =>
        request(app).get('/api/data/datasets')
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably fast
      expect(duration).toBeLessThan(5000); // 5 seconds max for 50 requests
    });

    it('should handle large response payloads', async () => {
      // Mock large dataset response
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        id: `dataset-${i}`,
        name: `Dataset ${i}`,
        createdAt: new Date().toISOString(),
        rowCount: Math.floor(Math.random() * 10000)
      }));

      mockDataService.getDatasets.mockResolvedValue({
        data: largeDataset,
        pagination: { page: 1, pageSize: 1000, total: 1000, totalPages: 1 }
      });

      const response = await request(app)
        .get('/api/data/datasets?pageSize=1000')
        .expect(200);

      expect(response.body.data).toHaveLength(1000);
      expect(JSON.stringify(response.body).length).toBeGreaterThan(50000);
    });
  });
});