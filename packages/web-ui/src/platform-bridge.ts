// Platform Bridge Interface
// This provides a unified API for the web app to interact with different platforms
// (Electron, browser extension, web app, etc.)

import type {
  ApiResponse,
  Dataset,
  UploadDataResponse,
  GetDatasetsResponse,
  SentimentAnalysisRequest,
  SentimentAnalysisResponse,
  BatchSentimentRequest,
  BatchSentimentResponse,
  CostEstimationRequest,
  CostEstimationResponse,
  FieldInferenceRequest,
  FieldInferenceResponse,
  SecurityAuditRequest,
  SecurityAuditResponse,
  ExportDataRequest,
  ExportDataResponse
} from '../../../shared/contracts/api';
import { config } from './config';
import { FileSystemAccessAPI, isFileSystemAccessSupported } from './file-system-access';

export interface PlatformCapabilities {
  hasFileSystemAccess: boolean;
  hasNotifications: boolean;
  hasSystemTray: boolean;
  hasMenuBar: boolean;
  canMinimizeToTray: boolean;
  platform: 'electron' | 'browser' | 'extension';
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface FileSystemAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  selectFile: (filters?: FileFilter[]) => Promise<string | null>;
  selectFiles: (filters?: FileFilter[]) => Promise<string[]>;
  getFileInfo: (path: string) => Promise<FileInfo>;
  readFileStream: (path: string, chunkSize?: number) => AsyncIterableIterator<Uint8Array>;
  validateFile: (path: string, maxSizeGB?: number) => Promise<{ valid: boolean; error?: string }>;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface FileSelectOptions {
  multiple?: boolean;
  accept?: string[];
}

export interface NotificationAPI {
  show: (title: string, body: string, options?: NotificationOptions) => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export interface NotificationOptions {
  icon?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}

export interface TransformAPI {
  executeTransform: (request: TransformExecutionRequest) => Promise<TransformExecutionResponse>;
  validateTransform: (pipeline: TransformPipeline) => Promise<TransformValidation>;
  getTableSchema: (tableName: string) => Promise<TableSchema>;
}

export interface TransformExecutionRequest {
  pipeline: any; // TransformPipeline type from transforms.ts
  previewOnly: boolean;
  maxRows?: number;
}

export interface TransformExecutionResponse {
  success: boolean;
  preview?: any; // TransformPreview type from transforms.ts
  validation?: any; // TransformValidation type from transforms.ts
  error?: string;
}

export interface TransformPipeline {
  id: string;
  name: string;
  operations: any[];
  sourceTable: string;
  created: Date;
  modified: Date;
}

export interface TransformValidation {
  valid: boolean;
  errors: Array<{
    operationId: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

export interface TableSchema {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    nullable: boolean;
    samples: any[];
  }>;
  rowCount: number;
}

export interface BackendAPI {
  // Health endpoints
  getHealthStatus: () => Promise<ApiResponse>;
  getReadinessStatus: () => Promise<ApiResponse>;
  
  // Data management
  uploadData: (file: File) => Promise<UploadDataResponse>;
  getDatasets: (page?: number, limit?: number) => Promise<GetDatasetsResponse>;
  getDataset: (id: string) => Promise<ApiResponse<Dataset>>;
  deleteDataset: (id: string) => Promise<ApiResponse>;
  exportData: (request: ExportDataRequest) => Promise<ExportDataResponse>;
  exportEnhanced: (request: any) => Promise<any>; // Enhanced export with additional features
  
  // Sentiment analysis
  analyzeSentiment: (request: SentimentAnalysisRequest) => Promise<SentimentAnalysisResponse>;
  batchAnalyzeSentiment: (request: BatchSentimentRequest) => Promise<BatchSentimentResponse>;
  getSentimentHistory: (page?: number, limit?: number) => Promise<ApiResponse>;
  getSentimentStatistics: () => Promise<ApiResponse>;
  
  // Field inference
  inferFields: (request: FieldInferenceRequest) => Promise<FieldInferenceResponse>;
  
  // Cost estimation
  estimateCost: (request: CostEstimationRequest) => Promise<CostEstimationResponse>;
  
  // Security audit
  auditSecurity: (request: SecurityAuditRequest) => Promise<SecurityAuditResponse>;
}

export interface PlatformBridge {
  capabilities: PlatformCapabilities;
  fileSystem?: FileSystemAPI;
  notifications?: NotificationAPI;
  transforms?: TransformAPI;
  backend: BackendAPI;
  
  // Platform-specific methods
  minimizeToTray?: () => void;
  showWindow?: () => void;
  quit?: () => void;
  
  // Event listeners
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  emit: (event: string, ...args: any[]) => void;
}

// Type declaration for the global electronAPI if running in Electron
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      versions: any;
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: Function) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      fs: {
        readFile: (filePath: string) => Promise<any>;
        writeFile: (filePath: string, content: string) => Promise<any>;
        selectDirectory: () => Promise<any>;
        selectFile: (filters?: Array<{name: string, extensions: string[]}>) => Promise<any>;
        selectFiles: (filters?: Array<{name: string, extensions: string[]}>) => Promise<any>;
        getFileInfo: (filePath: string) => Promise<any>;
        createReadStream: (filePath: string, options?: { start?: number, end?: number }) => Promise<any>;
        readStreamChunk: (filePath: string, start: number, end: number) => Promise<any>;
        validateFile: (filePath: string, maxSize?: number, allowedExtensions?: string[]) => Promise<any>;
      };
      window: {
        minimizeToTray: () => Promise<any>;
        show: () => Promise<any>;
      };
      app: {
        quit: () => Promise<any>;
      };
      notification: {
        show: (options: { title: string, body: string, icon?: string }) => Promise<any>;
      };
      transform: {
        execute: (transformConfig: any) => Promise<any>;
        validate: (pipeline: any) => Promise<any>;
        getTableSchema: (tableName: string) => Promise<any>;
      };
    };
    platformBridge: PlatformBridge;
  }
}

// Backend API client implementation
class BackendAPIClient implements BackendAPI {
  private baseURL: string;

  constructor(baseURL = config.api.baseURL) {
    this.baseURL = baseURL;
  }

  private async fetchAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getHealthStatus(): Promise<ApiResponse> {
    return this.fetchAPI('/api/v1/health/status');
  }

  async getReadinessStatus(): Promise<ApiResponse> {
    return this.fetchAPI('/api/v1/health/ready');
  }

  async uploadData(file: File): Promise<UploadDataResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/api/v1/data/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDatasets(page = 1, limit = 20): Promise<GetDatasetsResponse> {
    return this.fetchAPI(`/api/v1/data/datasets?page=${page}&limit=${limit}`);
  }

  async getDataset(id: string): Promise<ApiResponse<Dataset>> {
    return this.fetchAPI(`/api/v1/data/datasets/${id}`);
  }

  async deleteDataset(id: string): Promise<ApiResponse> {
    return this.fetchAPI(`/api/v1/data/datasets/${id}`, { method: 'DELETE' });
  }

  async exportData(request: ExportDataRequest): Promise<ExportDataResponse> {
    return this.fetchAPI('/api/v1/data/export', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async analyzeSentiment(request: SentimentAnalysisRequest): Promise<SentimentAnalysisResponse> {
    return this.fetchAPI('/api/v1/sentiment/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async batchAnalyzeSentiment(request: BatchSentimentRequest): Promise<BatchSentimentResponse> {
    return this.fetchAPI('/api/v1/sentiment/batch', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSentimentHistory(page = 1, limit = 20): Promise<ApiResponse> {
    return this.fetchAPI(`/api/v1/sentiment/history?page=${page}&limit=${limit}`);
  }

  async getSentimentStatistics(): Promise<ApiResponse> {
    return this.fetchAPI('/api/v1/sentiment/statistics');
  }

  async inferFields(request: FieldInferenceRequest): Promise<FieldInferenceResponse> {
    return this.fetchAPI('/api/v1/data/infer-fields', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async estimateCost(request: CostEstimationRequest): Promise<CostEstimationResponse> {
    return this.fetchAPI('/api/v1/cost/estimate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async auditSecurity(request: SecurityAuditRequest): Promise<SecurityAuditResponse> {
    return this.fetchAPI('/api/v1/security/audit', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async exportEnhanced(request: any): Promise<any> {
    return this.fetchAPI('/api/v1/export/enhanced', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

// Event emitter implementation
class EventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, handler: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}

// Browser implementation with File System Access API support
class BrowserPlatformBridge extends EventEmitter implements PlatformBridge {
  capabilities: PlatformCapabilities = {
    hasFileSystemAccess: isFileSystemAccessSupported(),
    hasNotifications: 'Notification' in window,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser'
  };

  platform = {
    name: 'web' as const,
    version: '1.0.0',
    capabilities: {
      largeFileSupport: false,
      nativeFileDialogs: false
    }
  };

  backend: BackendAPI = new BackendAPIClient();

  // Use the new File System Access API implementation
  fileSystem: FileSystemAPI = new FileSystemAccessAPI();

  transforms: TransformAPI = {
    executeTransform: async () => {
      console.warn('Transform execution not available in browser mode. Returning mock success.');
      return {
        success: true,
        data: {
          transformId: `mock_transform_${Date.now()}`,
          status: 'completed',
          message: 'Transform executed successfully (browser mock)',
          resultCount: 0
        }
      };
    },
    validateTransform: async () => {
      console.warn('Transform validation not available in browser mode. Returning mock validation.');
      return {
        success: true,
        data: {
          valid: true,
          message: 'Transform is valid (browser mock)',
          warnings: ['Validation performed in browser mock mode']
        }
      };
    },
    getTableSchema: async () => {
      console.warn('Table schema access not available in browser mode. Returning mock schema.');
      return {
        success: true,
        data: {
          tableName: 'mock_table',
          columns: [
            { name: 'id', type: 'number', nullable: false },
            { name: 'data', type: 'string', nullable: true }
          ],
          rowCount: 0,
          created: new Date().toISOString()
        }
      };
    }
  };

  notifications: NotificationAPI = {
    show: async (title: string, body: string, options?: NotificationOptions) => {
      if (this.capabilities.hasNotifications && Notification.permission === 'granted') {
        new Notification(title, { body, ...options });
      }
    },
    requestPermission: async () => {
      if (this.capabilities.hasNotifications) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    }
  };

  // Method to handle file selection
  selectFiles = (options?: FileSelectOptions): Promise<FileInfo[]> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple || false;
      
      if (options?.accept) {
        input.accept = options.accept.join(',');
      }

      input.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const files = Array.from(target.files || []);
        
        const fileInfos: FileInfo[] = files.map(file => ({
          name: file.name,
          path: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        }));
        
        resolve(fileInfos);
      });

      input.addEventListener('cancel', () => {
        resolve([]);
      });

      input.click();
    });
  };
}

// Electron implementation
class ElectronPlatformBridge extends EventEmitter implements PlatformBridge {
  capabilities: PlatformCapabilities = {
    hasFileSystemAccess: true,
    hasNotifications: true,
    hasSystemTray: true,
    hasMenuBar: true,
    canMinimizeToTray: true,
    platform: 'electron'
  };

  platform = {
    name: 'electron' as const,
    version: '1.0.0',
    capabilities: {
      largeFileSupport: true,
      nativeFileDialogs: true
    }
  };

  backend: BackendAPI = new BackendAPIClient();

  fileSystem: FileSystemAPI = {
    readFile: async (path: string) => {
      const result = await window.electronAPI!.fs.readFile(path);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.content;
    },
    writeFile: async (path: string, content: string) => {
      const result = await window.electronAPI!.fs.writeFile(path, content);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    selectDirectory: async () => {
      const result = await window.electronAPI!.fs.selectDirectory();
      return result.success ? result.path : null;
    },
    selectFile: async (filters?: FileFilter[]) => {
      const result = await window.electronAPI!.fs.selectFile(filters);
      return result.success ? result.path : null;
    },
    selectFiles: async (filters?: FileFilter[]) => {
      const result = await window.electronAPI!.fs.selectFiles(filters);
      return result.success ? result.paths : [];
    },
    getFileInfo: async (path: string): Promise<FileInfo> => {
      const result = await window.electronAPI!.fs.getFileInfo(path);
      if (!result.success) {
        throw new Error(result.error);
      }
      return {
        name: result.info.name,
        path: path,
        size: result.info.size,
        type: result.info.extension,
        lastModified: new Date(result.info.modified).getTime()
      };
    },
    readFileStream: async function* (path: string, chunkSize = 64 * 1024) {
      const streamResult = await window.electronAPI!.fs.createReadStream(path);
      if (!streamResult.success) {
        throw new Error(streamResult.error);
      }
      
      let position = 0;
      while (true) {
        const chunkResult = await window.electronAPI!.fs.readStreamChunk(path, position, position + chunkSize);
        if (!chunkResult.success) {
          throw new Error(chunkResult.error);
        }
        
        if (chunkResult.bytesRead > 0) {
          yield new TextEncoder().encode(chunkResult.chunk);
          position += chunkResult.bytesRead;
        }
        
        if (chunkResult.isEnd) {
          break;
        }
      }
    },
    validateFile: async (path: string, maxSizeGB = 50) => {
      const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;
      const result = await window.electronAPI!.fs.validateFile(path, maxSizeBytes);
      if (!result.success) {
        return { valid: false, error: result.error };
      }
      return { 
        valid: result.validation.isValid, 
        error: result.validation.errors.length > 0 ? result.validation.errors.join(', ') : undefined 
      };
    }
  };

  transforms: TransformAPI = {
    executeTransform: async (request: TransformExecutionRequest) => {
      const result = await window.electronAPI!.transform.execute(request);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.result;
    },
    validateTransform: async (pipeline: TransformPipeline) => {
      const result = await window.electronAPI!.transform.validate(pipeline);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.validation;
    },
    getTableSchema: async (tableName: string) => {
      const result = await window.electronAPI!.transform.getTableSchema(tableName);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.schema;
    }
  };

  notifications: NotificationAPI = {
    show: async (title: string, body: string, options?: NotificationOptions) => {
      const result = await window.electronAPI!.notification.show({ title, body, icon: options?.icon });
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    requestPermission: async () => {
      return true; // Electron doesn't need permission
    }
  };

  minimizeToTray = async () => {
    const result = await window.electronAPI!.window.minimizeToTray();
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  showWindow = async () => {
    const result = await window.electronAPI!.window.show();
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  quit = async () => {
    const result = await window.electronAPI!.app.quit();
    if (!result.success) {
      throw new Error(result.error);
    }
  };
}

// Platform detection and bridge initialization
export function initializePlatformBridge(): PlatformBridge {
  if (window.electronAPI) {
    return new ElectronPlatformBridge();
  } else {
    return new BrowserPlatformBridge();
  }
}

// Helper function for creating async iterator from Electron stream
function createAsyncIterator(streamId: string): AsyncIterableIterator<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      return new Promise<IteratorResult<Uint8Array>>((resolve) => {
        window.electronAPI!.send('fs:readStreamChunk', { streamId });
        window.electronAPI!.receive('fs:readStreamChunk:response', (data: { chunk?: Uint8Array; done: boolean }) => {
          if (data.done) {
            resolve({ value: undefined, done: true });
          } else {
            resolve({ value: data.chunk!, done: false });
          }
        });
      });
    }
  };
}

// Factory functions for tests
export function createWebPlatformBridge(): PlatformBridge {
  return new BrowserPlatformBridge();
}

export function createElectronPlatformBridge(): PlatformBridge {
  return new ElectronPlatformBridge();
}

// Export additional types for tests
export type { FileSelectOptions };

// Initialize the bridge on import
if (typeof window !== 'undefined') {
  window.platformBridge = initializePlatformBridge();
}