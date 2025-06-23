import axios from 'axios';
import { ApiClient, createApiClient } from '../api-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Setup comprehensive test environment
const setupTestEnvironment = () => {
  // Mock FormData
  const mockFormData = {
    append: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  };
  
  // Mock Blob
  const mockBlob = jest.fn((parts, options) => ({
    size: parts?.[0]?.length || 0,
    type: options?.type || 'application/octet-stream'
  }));
  
  // Mock WebSocket with all required methods
  const mockWebSocket = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
  
  // Mock EventSource
  const mockEventSource = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
  };
  
  // Set up global mocks
  global.FormData = jest.fn(() => mockFormData) as any;
  global.Blob = mockBlob as any;
  global.WebSocket = jest.fn(() => mockWebSocket) as any;
  global.EventSource = jest.fn(() => mockEventSource) as any;
  
  return {
    mockFormData,
    mockBlob,
    mockWebSocket,
    mockEventSource
  };
};

describe('API Client Infrastructure Tests', () => {
  let client: ApiClient;
  let mockAxiosInstance: jest.Mocked<any>;
  let testMocks: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    // Setup test environment
    testMocks = setupTestEnvironment();
    
    // Create mock axios instance
    mockAxiosInstance = {
      defaults: { 
        baseURL: 'http://localhost:3000',
        headers: {}
      },
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

  describe('Core API Client Functionality', () => {
    it('should create client with proper configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle successful API requests', async () => {
      const mockResponse = { data: { success: true } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.getHealthStatus();

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/health/status'
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors properly', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { error: 'Not found' },
          statusText: 'Not Found'
        }
      };
      mockAxiosInstance.request.mockRejectedValue(mockError);

      await expect(client.getHealthStatus()).rejects.toThrow('API Error: 404 - Not found');
    });
  });

  describe('Authentication Management', () => {
    it('should handle login and token management', async () => {
      const loginResponse = {
        success: true,
        token: 'jwt-token-123',
        expiresIn: 3600
      };
      mockAxiosInstance.request.mockResolvedValue({ data: loginResponse });

      // Initial state
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getToken()).toBeUndefined();

      // Login
      const result = await client.login('admin', 'password');
      expect(result.token).toBe('jwt-token-123');
      expect(client.isAuthenticated()).toBe(true);
      expect(client.getToken()).toBe('jwt-token-123');

      // Logout
      client.logout();
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getToken()).toBeUndefined();
    });

    it('should verify tokens', async () => {
      const verifyResponse = {
        success: true,
        valid: true,
        username: 'admin',
        role: 'admin'
      };
      mockAxiosInstance.request.mockResolvedValue({ data: verifyResponse });

      const result = await client.verifyToken('test-token');
      expect(result).toEqual(verifyResponse);
    });
  });

  describe('Data Management', () => {
    it('should upload files with FormData', async () => {
      const uploadResponse = {
        id: 'dataset-123',
        name: 'test.csv',
        status: 'uploaded'
      };
      mockAxiosInstance.request.mockResolvedValue({ 
        data: { data: uploadResponse, message: 'Upload successful' }
      });

      const buffer = Buffer.from('test,data\n1,2');
      const result = await client.uploadFile(buffer, 'test.csv', 'text/csv');

      expect(testMocks.mockFormData.append).toHaveBeenCalled();
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/data/upload',
        data: testMocks.mockFormData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      expect(result.data).toEqual(uploadResponse);
    });

    it('should handle dataset operations', async () => {
      const datasetsResponse = {
        data: [{ id: 'dataset-1', name: 'Test Dataset' }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
      };
      mockAxiosInstance.request.mockResolvedValue({ data: datasetsResponse });

      const result = await client.getDatasets();
      expect(result).toEqual(datasetsResponse);
    });

    it('should handle dataset deletion', async () => {
      const deleteResponse = { success: true, message: 'Dataset deleted' };
      mockAxiosInstance.request.mockResolvedValue({ data: deleteResponse });

      const result = await client.deleteDataset('dataset-123');
      expect(result).toEqual(deleteResponse);
    });
  });

  describe('Advanced Features', () => {
    it('should estimate costs', async () => {
      const costResponse = {
        estimatedCost: 0.05,
        currency: 'USD',
        breakdown: { processing: 0.03, storage: 0.02 }
      };
      mockAxiosInstance.request.mockResolvedValue({ data: costResponse });

      const result = await client.estimateCost({
        operation: 'sentiment_analysis',
        dataSize: 1000,
        complexity: 'medium'
      });

      expect(result).toEqual(costResponse);
    });

    it('should handle job progress tracking', async () => {
      const progressResponse = {
        progress: 75,
        status: 'running',
        message: 'Processing...'
      };
      mockAxiosInstance.request.mockResolvedValue({ data: progressResponse });

      const result = await client.getJobProgress('job-123');
      expect(result).toEqual(progressResponse);
    });

    it('should wait for job completion', async () => {
      const responses = [
        { data: { status: 'running', progress: 50 } },
        { data: { status: 'completed', progress: 100, result: 'success' } }
      ];

      mockAxiosInstance.request
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1]);

      const result = await client.waitForJob('job-123', 5000);
      expect(result).toEqual(responses[1].data);
    });

    it('should timeout on long-running jobs', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { status: 'running', progress: 50 }
      });

      await expect(client.waitForJob('job-123', 1000)).rejects.toThrow(
        'Job job-123 did not complete within 1000ms'
      );
    });
  });

  describe('Security Features', () => {
    it('should mask sensitive data', async () => {
      const maskResponse = {
        maskedText: 'My SSN is ***-**-1234',
        detectedTypes: ['ssn']
      };
      mockAxiosInstance.request.mockResolvedValue({ data: maskResponse });

      const result = await client.maskSensitiveData('My SSN is 123-45-1234', {
        maskType: 'asterisk'
      });

      expect(result).toEqual(maskResponse);
    });

    it('should perform security audits', async () => {
      const auditResponse = {
        securityScore: 85,
        vulnerabilities: [],
        recommendations: ['Use stronger encryption']
      };
      mockAxiosInstance.request.mockResolvedValue({ data: auditResponse });

      const result = await client.auditSecurity('/path/to/file.csv');
      expect(result).toEqual(auditResponse);
    });
  });

  describe('Real-time Communication', () => {
    it('should create WebSocket connections', () => {
      const ws = client.createWebSocketConnection(['protocol1']);
      
      expect(global.WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3000/ws',
        ['protocol1']
      );
      expect(ws).toEqual(testMocks.mockWebSocket);
    });

    it('should create EventSource connections', () => {
      const sse = client.createSSEConnection('user123');
      
      expect(global.EventSource).toHaveBeenCalledWith(
        'http://localhost:3000/api/events?userId=user123'
      );
      expect(sse).toEqual(testMocks.mockEventSource);
    });

    it('should handle WebSocket authentication', () => {
      client.setToken('test-token');
      client.createWebSocketConnection();

      // Verify addEventListener was called
      expect(testMocks.mockWebSocket.addEventListener).toHaveBeenCalledWith(
        'open',
        expect.any(Function)
      );
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch dataset deletions', async () => {
      // Mock successful and failed deletions
      mockAxiosInstance.request
        .mockResolvedValueOnce({ data: { success: true } }) // dataset-1 succeeds
        .mockRejectedValueOnce(new Error('Dataset not found')) // dataset-2 fails
        .mockResolvedValueOnce({ data: { success: true } }); // dataset-3 succeeds

      const result = await client.batchDeleteDatasets([
        'dataset-1',
        'dataset-2', 
        'dataset-3'
      ]);

      expect(result.successful).toEqual(['dataset-1', 'dataset-3']);
      expect(result.failed).toEqual([
        { id: 'dataset-2', error: 'Request Error: Dataset not found' }
      ]);
    });
  });

  describe('Monitoring and Analytics', () => {
    it('should get memory metrics', async () => {
      const memoryResponse = {
        used: 512,
        total: 1024,
        free: 512,
        heap: { used: 256, total: 512 }
      };
      mockAxiosInstance.request.mockResolvedValue({ data: memoryResponse });

      const result = await client.getMemoryMetrics();
      expect(result).toEqual(memoryResponse);
    });

    it('should test connection with latency', async () => {
      const pingResponse = { data: { data: { version: '1.0.0' } } };
      mockAxiosInstance.request.mockResolvedValue(pingResponse);

      const result = await client.testConnection();

      expect(result.data.connected).toBe(true);
      expect(typeof result.data.latency).toBe('number');
      expect(result.data.version).toBe('1.0.0');
    });

    it('should get analytics data', async () => {
      const analyticsResponse = {
        insights: [{ type: 'trend', value: 'increasing' }],
        trends: [{ period: 'monthly', change: 5.2 }],
        summary: { totalEvents: 1000, averageScore: 7.5 }
      };
      mockAxiosInstance.request.mockResolvedValue({ data: analyticsResponse });

      const result = await client.getAnalytics({
        start: '2024-01-01',
        end: '2024-01-31'
      });

      expect(result).toEqual(analyticsResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = { request: {} };
      mockAxiosInstance.request.mockRejectedValue(networkError);

      await expect(client.getHealthStatus()).rejects.toThrow(
        'Network Error: Unable to reach the server'
      );
    });

    it('should handle generic request errors', async () => {
      const genericError = { message: 'Something went wrong' };
      mockAxiosInstance.request.mockRejectedValue(genericError);

      await expect(client.getHealthStatus()).rejects.toThrow(
        'Request Error: Something went wrong'
      );
    });
  });

  describe('Configuration Management', () => {
    it('should get configuration', async () => {
      const configResponse = { setting1: 'value1', setting2: 'value2' };
      mockAxiosInstance.request.mockResolvedValue({ data: configResponse });

      const result = await client.getConfiguration();
      expect(result).toEqual(configResponse);
    });

    it('should update configuration', async () => {
      const updateResponse = { success: true, message: 'Config updated' };
      const newConfig = { setting1: 'newValue' };
      
      mockAxiosInstance.request.mockResolvedValue({ data: updateResponse });

      const result = await client.updateConfiguration(newConfig);
      expect(result).toEqual(updateResponse);
    });
  });
});