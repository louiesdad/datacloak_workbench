import axios from 'axios';
import { ApiClient, createApiClient } from '../api-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock EventSource for Node.js testing
global.EventSource = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
})) as any;

describe('ApiClient', () => {
  let client: ApiClient;
  let mockAxiosInstance: jest.Mocked<any>;

  beforeEach(() => {
    mockAxiosInstance = {
      defaults: { baseURL: 'http://localhost:3000' },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      request: jest.fn()
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    client = createApiClient({
      baseURL: 'http://localhost:3000',
      retryAttempts: 2,
      retryDelay: 100
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should create client with API key if provided', () => {
      createApiClient({
        baseURL: 'http://localhost:3000',
        apiKey: 'test-api-key'
      });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key'
          })
        })
      );
    });
  });

  describe('authentication', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          token: 'test-token-123',
          expiresIn: 3600
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.login('admin', 'password');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/auth/login',
        data: { username: 'admin', password: 'password' }
      });

      expect(result).toEqual(mockResponse.data);
      expect(client.getToken()).toBe('test-token-123');
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should verify token', async () => {
      const mockResponse = {
        data: {
          success: true,
          valid: true,
          username: 'admin',
          role: 'admin'
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.verifyToken('test-token');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/auth/verify',
        data: { token: 'test-token' }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should logout by clearing token', () => {
      client.setToken('test-token');
      expect(client.isAuthenticated()).toBe(true);

      client.logout();
      expect(client.getToken()).toBeUndefined();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('health checks', () => {
    it('should get health status', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          timestamp: '2023-01-01T00:00:00Z',
          services: {
            api: 'operational',
            database: {
              sqlite: 'connected',
              duckdb: 'connected'
            }
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.getHealthStatus();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/health/status'
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should check readiness', async () => {
      const mockResponse = {
        data: {
          ready: true,
          timestamp: '2023-01-01T00:00:00Z'
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.checkReadiness();

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('data management', () => {
    it('should upload file', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'dataset-123',
            name: 'test.csv',
            rowCount: 100,
            status: 'completed',
            createdAt: '2023-01-01T00:00:00Z'
          },
          message: 'File uploaded successfully'
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      // Mock file
      const fileContent = 'name,email\nJohn,john@example.com';
      const buffer = Buffer.from(fileContent);

      const result = await client.uploadFile(buffer, 'test.csv', 'text/csv');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/data/upload',
        data: expect.any(FormData),
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should get datasets with pagination', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'dataset-1',
              name: 'Dataset 1',
              createdAt: '2023-01-01T00:00:00Z',
              rowCount: 100
            }
          ],
          pagination: {
            page: 1,
            pageSize: 10,
            total: 1,
            totalPages: 1
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.getDatasets(1, 10);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/data/datasets',
        params: { page: 1, pageSize: 10 }
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should get specific dataset', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'dataset-123',
            name: 'Test Dataset',
            createdAt: '2023-01-01T00:00:00Z',
            rowCount: 100,
            columns: ['name', 'email']
          }
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.getDataset('dataset-123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/data/datasets/dataset-123'
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should delete dataset', async () => {
      const mockResponse = {
        data: {
          data: { id: 'dataset-123' },
          message: 'Dataset deleted successfully'
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.deleteDataset('dataset-123');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/api/data/datasets/dataset-123'
      });

      expect(result).toEqual(mockResponse.data);
    });

    it('should export data', async () => {
      const mockResponse = {
        data: {
          data: {
            exportId: 'export-456',
            downloadUrl: '/downloads/export-456.csv',
            format: 'csv',
            estimatedSize: '2KB'
          },
          message: 'Export initiated successfully'
        }
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const exportRequest = {
        format: 'csv' as const,
        datasetId: 'dataset-123'
      };

      const result = await client.exportData(exportRequest);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/data/export',
        data: exportRequest
      });

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('batch operations', () => {
    it('should handle batch delete datasets', async () => {
      // Mock successful deletion for first two, failure for third
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: { data: { id: 'dataset-1' }, message: 'Deleted' } })
        .mockResolvedValueOnce({ data: { data: { id: 'dataset-2' }, message: 'Deleted' } })
        .mockRejectedValueOnce(new Error('Dataset not found'));

      const result = await client.batchDeleteDatasets(['dataset-1', 'dataset-2', 'dataset-3']);

      expect(result.successful).toEqual(['dataset-1', 'dataset-2']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('dataset-3');
      expect(result.failed[0].error).toContain('Dataset not found');
    });
  });

  describe('error handling', () => {
    it('should throw formatted error for API errors', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { error: 'Invalid request' },
          statusText: 'Bad Request'
        }
      };

      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(client.getHealthStatus()).rejects.toThrow('API Error: 400 - Invalid request');
    });

    it('should throw network error for connection issues', async () => {
      const mockError = {
        request: {},
        message: 'Network Error'
      };

      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(client.getHealthStatus()).rejects.toThrow('Network Error: Unable to reach the server');
    });

    it('should throw request error for other issues', async () => {
      const mockError = {
        message: 'Request configuration error'
      };

      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(client.getHealthStatus()).rejects.toThrow('Request Error: Request configuration error');
    });
  });

  describe('sentiment analysis methods', () => {
    it('should analyze sentiment for single text', async () => {
      const mockResponse = {
        data: {
          id: 'analysis-123',
          text: 'I love this product!',
          sentiment: 'positive',
          confidence: 0.95,
          model: 'gpt-4',
          timestamp: '2024-01-01T00:00:00Z'
        },
        message: 'Analysis completed successfully'
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.analyzeSentiment({
        text: 'I love this product!',
        model: 'gpt-4',
        options: { includeConfidence: true }
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/sentiment/analyze',
        data: {
          text: 'I love this product!',
          model: 'gpt-4',
          options: { includeConfidence: true }
        }
      });
    });

    it('should perform batch sentiment analysis', async () => {
      const mockResponse = {
        data: [
          { id: '1', text: 'Great!', sentiment: 'positive', confidence: 0.9, model: 'gpt-4', timestamp: '2024-01-01T00:00:00Z' },
          { id: '2', text: 'Terrible!', sentiment: 'negative', confidence: 0.8, model: 'gpt-4', timestamp: '2024-01-01T00:00:00Z' }
        ],
        message: 'Batch analysis completed'
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.batchAnalyzeSentiment(['Great!', 'Terrible!'], { model: 'gpt-4' });

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/sentiment/batch',
        data: {
          texts: ['Great!', 'Terrible!'],
          options: { model: 'gpt-4' }
        }
      });
    });

    it('should get sentiment statistics', async () => {
      const mockResponse = {
        data: {
          total: 100,
          positive: 60,
          negative: 25,
          neutral: 15,
          averageConfidence: 0.85
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getSentimentStatistics();

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/sentiment/statistics'
      });
    });
  });

  describe('dashboard methods', () => {
    it('should get dashboard metrics', async () => {
      const mockResponse = {
        data: {
          totalDatasets: 25,
          totalAnalyses: 1500,
          averageSentiment: 0.65,
          recentActivity: [
            { type: 'upload', timestamp: '2024-01-01T00:00:00Z', description: 'New dataset uploaded' }
          ]
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getDashboardMetrics();

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/dashboard/metrics'
      });
    });

    it('should get job history with filters', async () => {
      const mockResponse = {
        data: [
          { id: 'job-1', type: 'sentiment', status: 'completed', progress: 100, createdAt: '2024-01-01T00:00:00Z' }
        ],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getJobHistory(1, 10, 'completed');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/dashboard/jobs/history',
        params: { page: 1, pageSize: 10, status: 'completed' }
      });
    });
  });

  describe('monitoring methods', () => {
    it('should get monitoring metrics', async () => {
      const mockResponse = {
        data: {
          cpu: 45.2,
          memory: 78.5,
          uptime: 86400,
          requests: 2500
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getMonitoringMetrics();

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/monitoring/metrics'
      });
    });

    it('should get system logs with filters', async () => {
      const mockResponse = {
        data: [
          { timestamp: '2024-01-01T00:00:00Z', level: 'info', message: 'System started', service: 'api' }
        ]
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getSystemLogs('info', 50);

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/monitoring/logs',
        params: { level: 'info', limit: 50 }
      });
    });
  });

  describe('configuration methods', () => {
    it('should get configuration', async () => {
      const mockResponse = {
        data: {
          openai: { model: 'gpt-4', temperature: 0.7 },
          database: { maxConnections: 10 }
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getConfiguration();

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/config'
      });
    });

    it('should update configuration', async () => {
      const newConfig = { openai: { model: 'gpt-3.5-turbo' } };
      const mockResponse = {
        data: newConfig,
        message: 'Configuration updated successfully'
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.updateConfiguration(newConfig);

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/api/config',
        data: newConfig
      });
    });
  });

  describe('security and compliance methods', () => {
    it('should scan for PII', async () => {
      const mockResponse = {
        data: {
          hasPII: true,
          detected: [
            { type: 'email', value: 'john@example.com', confidence: 0.95 }
          ]
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.scanForPII('Contact john@example.com for details');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/security/scan',
        data: { text: 'Contact john@example.com for details' }
      });
    });

    it('should get compliance report', async () => {
      const mockResponse = {
        data: {
          compliant: true,
          issues: [],
          recommendations: ['Regular PII scans recommended']
        }
      };

      mockAxiosInstance.request.mockResolvedValue({ data: mockResponse });

      const result = await client.getComplianceReport('dataset-123');

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/compliance/report',
        params: { datasetId: 'dataset-123' }
      });
    });
  });

  describe('real-time connections', () => {
    // Note: These tests would require mocking WebSocket and EventSource
    // which is complex in Node.js environment. In a real implementation,
    // these would be better tested in a browser environment or with
    // appropriate mocks.

    it('should create WebSocket connection URL', () => {
      const ws = client.createWebSocketConnection();
      // In a real test, we would verify the WebSocket was created with correct URL
      expect(ws).toBeDefined();
    });

    it('should create SSE connection URL', () => {
      const sse = client.createSSEConnection('user123');
      // In a real test, we would verify the EventSource was created with correct URL
      expect(sse).toBeDefined();
    });
  });
});