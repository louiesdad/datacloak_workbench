import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Create mocks before imports
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

// Mock modules
jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: () => mockConfigService
  }
}));

jest.mock('../../services/data.service', () => ({
  DataService: jest.fn().mockImplementation(() => mockDataService)
}));

jest.mock('../../database', () => ({
  getDatabaseStatus: mockGetDatabaseStatus,
  closeDatabase: jest.fn()
}));

// Import routes after mocking
import { dataRoutes } from '../../routes/data.routes';
import authRoutes from '../../routes/auth.routes';
import { healthRoutes } from '../../routes/health.routes';

describe('E2E Workflow Tests (Fixed)', () => {
  let app: express.Application;
  let server: Server;
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-test-'));

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
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
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

  describe('Complete User Workflow', () => {
    it('should complete full data processing pipeline', async () => {
      // Step 1: Check system health
      const healthResponse = await request(app)
        .get('/api/health/status')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');

      // Step 2: Authenticate user
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

      // Step 3: Upload CSV data
      const mockUploadResult = {
        id: 'dataset-123',
        name: 'customer_feedback.csv',
        rowCount: 1000,
        status: 'completed',
        columns: ['customer_id', 'feedback', 'rating', 'sentiment']
      };

      mockDataService.uploadDataset.mockResolvedValue(mockUploadResult);

      const csvContent = `customer_id,feedback,rating,sentiment
1,"Great product, love it!",5,positive
2,"Could be better",3,neutral
3,"Terrible experience",1,negative
4,"Amazing service",5,positive
5,"Not satisfied",2,negative`;

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), 'customer_feedback.csv')
        .expect(201);

      expect(uploadResponse.body.data).toEqual(mockUploadResult);

      // Step 4: Verify data was stored
      const mockDatasets = {
        data: [mockUploadResult],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1
        }
      };

      mockDataService.getDatasets.mockResolvedValue(mockDatasets);

      const listResponse = await request(app)
        .get('/api/data/datasets')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe('dataset-123');

      // Step 5: Retrieve specific dataset
      const extendedDataset = {
        ...mockUploadResult,
        preview: [
          { customer_id: 1, feedback: "Great product, love it!", rating: 5, sentiment: "positive" },
          { customer_id: 2, feedback: "Could be better", rating: 3, sentiment: "neutral" }
        ]
      };
      
      mockDataService.getDatasetById.mockResolvedValue(extendedDataset);

      const getResponse = await request(app)
        .get('/api/data/datasets/dataset-123')
        .expect(200);

      expect(getResponse.body.data.id).toBe('dataset-123');
      expect(getResponse.body.data.preview).toBeDefined();

      // Step 6: Export processed data
      const mockExportResult = {
        exportId: 'export-456',
        downloadUrl: '/downloads/export-456.csv',
        format: 'csv',
        status: 'completed'
      };

      mockDataService.exportData.mockResolvedValue(mockExportResult);

      const exportResponse = await request(app)
        .post('/api/data/export')
        .send({
          format: 'csv',
          datasetId: 'dataset-123',
          includeAnalytics: true
        })
        .expect(200);

      expect(exportResponse.body.data.exportId).toBe('export-456');
      expect(exportResponse.body.data.downloadUrl).toBeDefined();

      // Step 7: Cleanup - delete dataset
      mockDataService.deleteDataset.mockResolvedValue({ success: true });

      const deleteResponse = await request(app)
        .delete('/api/data/datasets/dataset-123')
        .expect(200);

      expect(deleteResponse.body.data.id).toBe('dataset-123');
    });

    it('should handle error scenarios gracefully', async () => {
      // Test authentication failure
      const invalidLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrong-password'
        })
        .expect(401);

      expect(invalidLoginResponse.body.success).toBe(false);

      // Test database connection failure
      mockGetDatabaseStatus.mockResolvedValue({
        sqlite: 'disconnected',
        duckdb: 'connected'
      });

      const unhealthyResponse = await request(app)
        .get('/api/health/ready')
        .expect(503);

      expect(unhealthyResponse.body.ready).toBe(false);

      // Test upload failure
      mockDataService.uploadDataset.mockRejectedValue(new Error('Database connection failed'));

      const csvContent = 'name,email\nJohn,john@example.com';
      
      const failedUploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(500);

      expect(failedUploadResponse.body.success).toBe(false);
      expect(failedUploadResponse.body.error).toContain('Database connection failed');
    });

    it('should handle concurrent operations correctly', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      // Simulate multiple concurrent requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(request(app).get('/api/data/datasets'));
        requests.push(request(app).get('/api/health/status'));
      }

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThan(400);
      });

      // Data service should have been called multiple times
      expect(mockDataService.getDatasets).toHaveBeenCalledTimes(5);
    });

    it('should validate input data properly', async () => {
      // Test missing required fields
      const invalidResponse1 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' }) // Missing password
        .expect(400);

      expect(invalidResponse1.body.error).toBe('Username and password are required');

      // Test invalid file type
      const invalidFileResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from('test content'), { filename: 'test.pdf', contentType: 'application/pdf' })
        .expect(400);

      expect(invalidFileResponse.body.error).toContain('Unsupported file type');
    });

    it('should maintain data consistency across operations', async () => {
      // Mock consistent dataset data
      const datasetId = 'consistent-dataset-789';
      const consistentDataset = {
        id: datasetId,
        name: 'consistency-test.csv',
        rowCount: 500,
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Upload
      mockDataService.uploadDataset.mockResolvedValue(consistentDataset);
      
      const csvContent = 'id,value\n1,test\n2,data';
      await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), 'consistency-test.csv')
        .expect(201);

      // Retrieve - should return same data
      mockDataService.getDatasetById.mockResolvedValue(consistentDataset);
      
      const getResponse = await request(app)
        .get(`/api/data/datasets/${datasetId}`)
        .expect(200);

      expect(getResponse.body.data.id).toBe(datasetId);
      expect(getResponse.body.data.rowCount).toBe(500);

      // List - should include our dataset
      mockDataService.getDatasets.mockResolvedValue({
        data: [consistentDataset],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      });

      const listResponse = await request(app)
        .get('/api/data/datasets')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe(datasetId);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid successive requests', async () => {
      mockDataService.getDatasets.mockResolvedValue({
        data: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 }
      });

      const startTime = Date.now();
      
      // Make 20 rapid requests
      const promises = Array(20).fill(null).map(() =>
        request(app).get('/api/data/datasets')
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete reasonably fast
      expect(duration).toBeLessThan(3000); // 3 seconds max for 20 requests
    });

    it('should handle large file uploads gracefully', async () => {
      // Mock successful upload for large file
      mockDataService.uploadDataset.mockResolvedValue({
        id: 'large-dataset-999',
        name: 'large-file.csv',
        rowCount: 10000,
        status: 'completed'
      });

      // Create larger CSV content
      let largeContent = 'id,name,email,feedback\n';
      for (let i = 1; i <= 1000; i++) {
        largeContent += `${i},User${i},user${i}@example.com,Feedback ${i}\n`;
      }

      const response = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(largeContent), 'large-file.csv')
        .expect(201);

      expect(response.body.data.rowCount).toBe(10000);
    });
  });
});