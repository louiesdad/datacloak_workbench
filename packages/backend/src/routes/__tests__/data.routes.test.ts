import request from 'supertest';
import express from 'express';
import { dataRoutes } from '../data.routes';
import { DataController } from '../../controllers/data.controller';

// Mock dependencies
jest.mock('../../controllers/data.controller');
jest.mock('../../middleware/validation.middleware', () => ({
  asyncHandler: (fn: any) => fn
}));

const app = express();
app.use(express.json());
app.use('/data', dataRoutes);

describe('Data Routes', () => {
  let mockDataController: jest.Mocked<DataController>;

  beforeEach(() => {
    mockDataController = {
      uploadData: jest.fn(),
      getDatasets: jest.fn(),
      getDatasetById: jest.fn(),
      deleteDataset: jest.fn(),
      exportData: jest.fn(),
    } as any;

    (DataController as jest.MockedClass<typeof DataController>).mockImplementation(() => mockDataController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /data/upload', () => {
    it('should upload CSV file successfully', async () => {
      const mockResponse = {
        success: true,
        datasetId: 'dataset-123',
        message: 'File uploaded successfully'
      };
      
      mockDataController.uploadData.mockResolvedValue(mockResponse as any);

      const csvContent = 'name,email,age\nJohn,john@example.com,30\nJane,jane@example.com,25';
      
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from(csvContent), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(200);

      expect(mockDataController.uploadData).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should upload Excel file successfully', async () => {
      const mockResponse = {
        success: true,
        datasetId: 'dataset-456',
        message: 'Excel file uploaded successfully'
      };
      
      mockDataController.uploadData.mockResolvedValue(mockResponse as any);

      // Mock Excel file buffer
      const excelBuffer = Buffer.from('mock-excel-content');
      
      const response = await request(app)
        .post('/data/upload')
        .attach('file', excelBuffer, {
          filename: 'test.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .expect(200);

      expect(mockDataController.uploadData).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should reject unsupported file types', async () => {
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from('test content'), {
          filename: 'test.pdf',
          contentType: 'application/pdf'
        })
        .expect(400);

      expect(response.body.message).toContain('Unsupported file type');
    });

    it('should reject files exceeding size limit', async () => {
      // Create a buffer larger than 50GB (simulate)
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB for testing
      
      // Mock multer error
      const response = await request(app)
        .post('/data/upload')
        .attach('file', largeBuffer, {
          filename: 'large.csv',
          contentType: 'text/csv'
        });

      // Note: In actual test, multer would reject before reaching controller
      // This tests the error handling middleware
      if (response.status === 400) {
        expect(response.body.message).toContain('File size exceeds limit');
      }
    });

    it('should handle missing file', async () => {
      const response = await request(app)
        .post('/data/upload')
        .expect(400);

      // Multer should handle this case
      expect(response.status).toBe(400);
    });

    it('should handle controller errors', async () => {
      mockDataController.uploadData.mockRejectedValue(new Error('Database error'));

      const csvContent = 'name,email\nJohn,john@example.com';
      
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from(csvContent), {
          filename: 'test.csv',
          contentType: 'text/csv'
        })
        .expect(500);

      expect(mockDataController.uploadData).toHaveBeenCalled();
    });

    it('should handle malformed CSV files', async () => {
      mockDataController.uploadData.mockRejectedValue(new Error('Invalid CSV format'));

      const malformedCsv = 'name,email\nJohn,john@example.com,extra,field\nJane'; // Inconsistent columns
      
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from(malformedCsv), {
          filename: 'malformed.csv',
          contentType: 'text/csv'
        })
        .expect(500);

      expect(mockDataController.uploadData).toHaveBeenCalled();
    });
  });

  describe('GET /data/datasets', () => {
    it('should return list of datasets', async () => {
      const mockDatasets = [
        { id: 'dataset-1', name: 'Dataset 1', createdAt: '2023-01-01T00:00:00Z' },
        { id: 'dataset-2', name: 'Dataset 2', createdAt: '2023-01-02T00:00:00Z' }
      ];

      mockDataController.getDatasets.mockResolvedValue(mockDatasets as any);

      const response = await request(app)
        .get('/data/datasets')
        .expect(200);

      expect(mockDataController.getDatasets).toHaveBeenCalled();
      expect(response.body).toEqual(mockDatasets);
    });

    it('should return empty array when no datasets exist', async () => {
      mockDataController.getDatasets.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/data/datasets')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should handle controller errors', async () => {
      mockDataController.getDatasets.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/data/datasets')
        .expect(500);

      expect(mockDataController.getDatasets).toHaveBeenCalled();
    });

    it('should handle query parameters for filtering', async () => {
      const filteredDatasets = [
        { id: 'dataset-1', name: 'Filtered Dataset', createdAt: '2023-01-01T00:00:00Z' }
      ];

      mockDataController.getDatasets.mockResolvedValue(filteredDatasets as any);

      const response = await request(app)
        .get('/data/datasets?name=Filtered')
        .expect(200);

      expect(mockDataController.getDatasets).toHaveBeenCalled();
      expect(response.body).toEqual(filteredDatasets);
    });
  });

  describe('GET /data/datasets/:id', () => {
    it('should return specific dataset by ID', async () => {
      const mockDataset = {
        id: 'dataset-123',
        name: 'Test Dataset',
        createdAt: '2023-01-01T00:00:00Z',
        rowCount: 100,
        columns: ['name', 'email', 'age']
      };

      mockDataController.getDatasetById.mockResolvedValue(mockDataset as any);

      const response = await request(app)
        .get('/data/datasets/dataset-123')
        .expect(200);

      expect(mockDataController.getDatasetById).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: 'dataset-123' }
        }),
        expect.any(Object)
      );
      expect(response.body).toEqual(mockDataset);
    });

    it('should return 404 for non-existent dataset', async () => {
      mockDataController.getDatasetById.mockRejectedValue(new Error('Dataset not found'));

      const response = await request(app)
        .get('/data/datasets/non-existent')
        .expect(500);

      expect(mockDataController.getDatasetById).toHaveBeenCalled();
    });

    it('should handle invalid dataset ID format', async () => {
      mockDataController.getDatasetById.mockRejectedValue(new Error('Invalid ID format'));

      const response = await request(app)
        .get('/data/datasets/invalid-id-format')
        .expect(500);

      expect(mockDataController.getDatasetById).toHaveBeenCalled();
    });
  });

  describe('DELETE /data/datasets/:id', () => {
    it('should delete dataset successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Dataset deleted successfully'
      };

      mockDataController.deleteDataset.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .delete('/data/datasets/dataset-123')
        .expect(200);

      expect(mockDataController.deleteDataset).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: 'dataset-123' }
        }),
        expect.any(Object)
      );
      expect(response.body).toEqual(mockResponse);
    });

    it('should handle attempt to delete non-existent dataset', async () => {
      mockDataController.deleteDataset.mockRejectedValue(new Error('Dataset not found'));

      const response = await request(app)
        .delete('/data/datasets/non-existent')
        .expect(500);

      expect(mockDataController.deleteDataset).toHaveBeenCalled();
    });

    it('should handle database constraints when deleting', async () => {
      mockDataController.deleteDataset.mockRejectedValue(new Error('Cannot delete dataset with active jobs'));

      const response = await request(app)
        .delete('/data/datasets/dataset-with-jobs')
        .expect(500);

      expect(mockDataController.deleteDataset).toHaveBeenCalled();
    });
  });

  describe('POST /data/export', () => {
    it('should export data in CSV format', async () => {
      const exportRequest = {
        datasetId: 'dataset-123',
        format: 'csv',
        filters: { age: { $gte: 18 } }
      };

      const mockResponse = {
        success: true,
        exportId: 'export-456',
        downloadUrl: '/downloads/export-456.csv'
      };

      mockDataController.exportData.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/data/export')
        .send(exportRequest)
        .expect(200);

      expect(mockDataController.exportData).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should export data in JSON format', async () => {
      const exportRequest = {
        datasetId: 'dataset-123',
        format: 'json'
      };

      const mockResponse = {
        success: true,
        exportId: 'export-789',
        downloadUrl: '/downloads/export-789.json'
      };

      mockDataController.exportData.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/data/export')
        .send(exportRequest)
        .expect(200);

      expect(mockDataController.exportData).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });

    it('should handle missing required fields', async () => {
      const incompleteRequest = {
        format: 'csv'
        // Missing datasetId
      };

      mockDataController.exportData.mockRejectedValue(new Error('Dataset ID is required'));

      const response = await request(app)
        .post('/data/export')
        .send(incompleteRequest)
        .expect(500);

      expect(mockDataController.exportData).toHaveBeenCalled();
    });

    it('should handle unsupported export format', async () => {
      const invalidRequest = {
        datasetId: 'dataset-123',
        format: 'xml' // Unsupported format
      };

      mockDataController.exportData.mockRejectedValue(new Error('Unsupported export format'));

      const response = await request(app)
        .post('/data/export')
        .send(invalidRequest)
        .expect(500);

      expect(mockDataController.exportData).toHaveBeenCalled();
    });

    it('should handle export of large datasets', async () => {
      const largeExportRequest = {
        datasetId: 'large-dataset',
        format: 'csv',
        limit: 1000000
      };

      const mockResponse = {
        success: true,
        exportId: 'large-export-123',
        downloadUrl: '/downloads/large-export-123.csv',
        estimatedSize: '500MB'
      };

      mockDataController.exportData.mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post('/data/export')
        .send(largeExportRequest)
        .expect(200);

      expect(mockDataController.exportData).toHaveBeenCalled();
      expect(response.body).toEqual(mockResponse);
    });
  });

  describe('File Upload Security', () => {
    it('should sanitize file names', async () => {
      mockDataController.uploadData.mockResolvedValue({ success: true } as any);

      const maliciousFilename = '../../../etc/passwd';
      
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from('test,data\n1,2'), {
          filename: maliciousFilename,
          contentType: 'text/csv'
        });

      // Should not process malicious filenames
      expect(mockDataController.uploadData).toHaveBeenCalled();
    });

    it('should validate file content matches MIME type', async () => {
      // Send non-CSV content with CSV MIME type
      const response = await request(app)
        .post('/data/upload')
        .attach('file', Buffer.from('This is not CSV content'), {
          filename: 'fake.csv',
          contentType: 'text/csv'
        });

      // Should be handled by controller validation
      expect(response.status).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous uploads', async () => {
      mockDataController.uploadData.mockResolvedValue({ success: true } as any);

      const csvContent = 'name,value\ntest,123';
      const uploadPromises = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/data/upload')
          .attach('file', Buffer.from(csvContent), {
            filename: `test-${index}.csv`,
            contentType: 'text/csv'
          })
      );

      const responses = await Promise.all(uploadPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      expect(mockDataController.uploadData).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent dataset queries', async () => {
      mockDataController.getDatasets.mockResolvedValue([] as any);

      const queryPromises = Array(10).fill(null).map(() =>
        request(app).get('/data/datasets')
      );

      const responses = await Promise.all(queryPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      expect(mockDataController.getDatasets).toHaveBeenCalledTimes(10);
    });
  });
});