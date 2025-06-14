import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createWebPlatformBridge, 
  createElectronPlatformBridge,
  type PlatformBridge,
  type FileInfo,
  type FileSelectOptions
} from '../platform-bridge';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock file input for web platform
const mockFileInput = {
  click: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  files: [],
  type: 'file',
  multiple: false,
  accept: ''
};

// Mock document.createElement
const originalCreateElement = document.createElement;

describe('Platform Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Web Platform Bridge', () => {
    let webBridge: PlatformBridge;

    beforeEach(() => {
      // Mock createElement to return our mock file input
      document.createElement = vi.fn((tagName) => {
        if (tagName === 'input') {
          return mockFileInput as any;
        }
        return originalCreateElement.call(document, tagName);
      });

      webBridge = createWebPlatformBridge();
    });

    afterEach(() => {
      document.createElement = originalCreateElement;
    });

    it('should create web platform bridge with correct properties', () => {
      expect(webBridge.platform.name).toBe('web');
      expect(webBridge.platform.version).toBeDefined();
      expect(webBridge.platform.capabilities.largeFileSupport).toBe(false);
      expect(webBridge.platform.capabilities.nativeFileDialogs).toBe(false);
    });

    it('should handle file selection', async () => {
      const options: FileSelectOptions = {
        multiple: true,
        accept: ['.csv', '.xlsx']
      };

      // Mock file selection
      const mockFiles = [
        new File(['content1'], 'test1.csv', { type: 'text/csv' }),
        new File(['content2'], 'test2.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      ];

      mockFileInput.files = mockFiles;

      const selectionPromise = webBridge.selectFiles(options);

      // Simulate file input change event
      const changeCallback = mockFileInput.addEventListener.mock.calls
        .find(call => call[0] === 'change')?.[1];
      
      if (changeCallback) {
        changeCallback({ target: { files: mockFiles } });
      }

      const result = await selectionPromise;

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1.csv');
      expect(result[1].name).toBe('test2.xlsx');
    });

    it('should handle file upload', async () => {
      const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          datasetId: 'dataset-123',
          message: 'File uploaded successfully'
        })
      });

      const result = await webBridge.uploadFile(mockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );

      expect(result.success).toBe(true);
      expect(result.datasetId).toBe('dataset-123');
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid file format')
      });

      await expect(webBridge.uploadFile(mockFile)).rejects.toThrow('Upload failed: HTTP 400');
    });

    describe('Backend API', () => {
      it('should get health status', async () => {
        const mockHealthResponse = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            storage: 'available'
          }
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHealthResponse)
        });

        const result = await webBridge.backend.getHealthStatus();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/health'),
          expect.objectContaining({
            method: 'GET'
          })
        );

        expect(result.status).toBe('healthy');
      });

      it('should analyze sentiment', async () => {
        const sentimentRequest = {
          datasetId: 'dataset-123',
          textColumn: 'review_text',
          model: 'gpt-4',
          batchSize: 10
        };

        const mockSentimentResponse = {
          success: true,
          runId: 'run-456',
          results: [
            {
              id: '1',
              text: 'Great product!',
              sentiment: 'positive',
              score: 0.85,
              confidence: 0.92
            }
          ]
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSentimentResponse)
        });

        const result = await webBridge.backend.analyzeSentiment(sentimentRequest);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/sentiment/analyze'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sentimentRequest)
          })
        );

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
      });

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Server error')
        });

        await expect(webBridge.backend.getHealthStatus()).rejects.toThrow('API request failed: HTTP 500');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(webBridge.backend.getHealthStatus()).rejects.toThrow('Network error');
      });
    });

    it('should handle file selection cancellation', async () => {
      const selectionPromise = webBridge.selectFiles({ multiple: false });

      // Simulate cancel (no files selected)
      const changeCallback = mockFileInput.addEventListener.mock.calls
        .find(call => call[0] === 'change')?.[1];
      
      if (changeCallback) {
        changeCallback({ target: { files: [] } });
      }

      const result = await selectionPromise;
      expect(result).toHaveLength(0);
    });

    it('should apply file selection options', async () => {
      const options: FileSelectOptions = {
        multiple: true,
        accept: ['.csv', '.json']
      };

      await webBridge.selectFiles(options);

      expect(mockFileInput.multiple).toBe(true);
      expect(mockFileInput.accept).toBe('.csv,.json');
    });
  });

  describe('Electron Platform Bridge', () => {
    let electronBridge: PlatformBridge;
    const mockElectronAPI = {
      selectFiles: vi.fn(),
      uploadFile: vi.fn(),
      apiRequest: vi.fn()
    };

    beforeEach(() => {
      // Mock window.electronAPI
      (global as any).window = {
        electronAPI: mockElectronAPI
      };

      electronBridge = createElectronPlatformBridge();
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it('should create electron platform bridge with correct properties', () => {
      expect(electronBridge.platform.name).toBe('electron');
      expect(electronBridge.platform.capabilities.largeFileSupport).toBe(true);
      expect(electronBridge.platform.capabilities.nativeFileDialogs).toBe(true);
    });

    it('should handle file selection through Electron API', async () => {
      const mockFiles: FileInfo[] = [
        {
          name: 'test.csv',
          size: 1000,
          type: 'text/csv',
          path: '/path/to/test.csv',
          lastModified: Date.now()
        }
      ];

      mockElectronAPI.selectFiles.mockResolvedValueOnce(mockFiles);

      const options: FileSelectOptions = {
        multiple: true,
        accept: ['.csv']
      };

      const result = await electronBridge.selectFiles(options);

      expect(mockElectronAPI.selectFiles).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockFiles);
    });

    it('should handle file upload through Electron API', async () => {
      const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });
      const mockResponse = {
        success: true,
        datasetId: 'dataset-123'
      };

      mockElectronAPI.uploadFile.mockResolvedValueOnce(mockResponse);

      const result = await electronBridge.uploadFile(mockFile);

      expect(mockElectronAPI.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockResponse);
    });

    it('should handle backend API calls through Electron', async () => {
      const mockHealthResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };

      mockElectronAPI.apiRequest.mockResolvedValueOnce(mockHealthResponse);

      const result = await electronBridge.backend.getHealthStatus();

      expect(mockElectronAPI.apiRequest).toHaveBeenCalledWith('/api/health', {
        method: 'GET'
      });
      expect(result).toEqual(mockHealthResponse);
    });

    it('should handle Electron API errors', async () => {
      mockElectronAPI.selectFiles.mockRejectedValueOnce(new Error('Electron error'));

      await expect(electronBridge.selectFiles({})).rejects.toThrow('Electron error');
    });

    it('should handle missing Electron API gracefully', () => {
      delete (global as any).window.electronAPI;

      expect(() => {
        createElectronPlatformBridge();
      }).toThrow('Electron API not available');
    });
  });

  describe('Platform Detection', () => {
    it('should detect web platform', () => {
      const bridge = createWebPlatformBridge();
      expect(bridge.platform.name).toBe('web');
    });

    it('should detect electron platform', () => {
      (global as any).window = {
        electronAPI: {
          selectFiles: vi.fn(),
          uploadFile: vi.fn(),
          apiRequest: vi.fn()
        }
      };

      const bridge = createElectronPlatformBridge();
      expect(bridge.platform.name).toBe('electron');

      delete (global as any).window;
    });
  });

  describe('File Validation', () => {
    let webBridge: PlatformBridge;

    beforeEach(() => {
      document.createElement = vi.fn(() => mockFileInput as any);
      webBridge = createWebPlatformBridge();
    });

    it('should validate file types', async () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      mockFileInput.files = [invalidFile];

      const selectionPromise = webBridge.selectFiles({
        accept: ['.csv', '.xlsx']
      });

      const changeCallback = mockFileInput.addEventListener.mock.calls
        .find(call => call[0] === 'change')?.[1];
      
      if (changeCallback) {
        changeCallback({ target: { files: [invalidFile] } });
      }

      // Should filter out invalid files
      const result = await selectionPromise;
      expect(result).toHaveLength(0);
    });

    it('should validate file sizes', async () => {
      const options: FileSelectOptions = {
        maxSizeGB: 1
      };

      // Create a mock large file (2GB)
      const largeFile = new File(['content'], 'large.csv', { type: 'text/csv' });
      Object.defineProperty(largeFile, 'size', { value: 2 * 1024 * 1024 * 1024 });

      mockFileInput.files = [largeFile];

      const selectionPromise = webBridge.selectFiles(options);

      const changeCallback = mockFileInput.addEventListener.mock.calls
        .find(call => call[0] === 'change')?.[1];
      
      if (changeCallback) {
        changeCallback({ target: { files: [largeFile] } });
      }

      // Should filter out files that are too large
      const result = await selectionPromise;
      expect(result).toHaveLength(0);
    });
  });
});