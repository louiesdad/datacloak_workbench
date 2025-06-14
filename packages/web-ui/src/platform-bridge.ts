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
    };
    platformBridge: PlatformBridge;
  }
}

// Backend API client implementation
class BackendAPIClient implements BackendAPI {
  private baseURL: string;

  constructor(baseURL = 'http://localhost:3001') {
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

// Browser implementation
class BrowserPlatformBridge extends EventEmitter implements PlatformBridge {
  capabilities: PlatformCapabilities = {
    hasFileSystemAccess: false,
    hasNotifications: 'Notification' in window,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser'
  };

  backend: BackendAPI = new BackendAPIClient();

  fileSystem: FileSystemAPI = {
    readFile: async () => { throw new Error('File system access not available in browser'); },
    writeFile: async () => { throw new Error('File system access not available in browser'); },
    selectDirectory: async () => { throw new Error('Directory selection not available in browser'); },
    selectFile: async () => { throw new Error('File selection not available in browser'); },
    selectFiles: async () => { throw new Error('File selection not available in browser'); },
    getFileInfo: async () => { throw new Error('File info not available in browser'); },
    readFileStream: async function* () { throw new Error('File streaming not available in browser'); },
    validateFile: async () => ({ valid: false, error: 'File validation not available in browser' })
  };

  transforms: TransformAPI = {
    executeTransform: async () => { throw new Error('Transform execution not available in browser'); },
    validateTransform: async () => { throw new Error('Transform validation not available in browser'); },
    getTableSchema: async () => { throw new Error('Table schema access not available in browser'); }
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

  backend: BackendAPI = new BackendAPIClient();

  fileSystem: FileSystemAPI = {
    readFile: async (path: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('fs:readFile', { path });
        window.electronAPI!.receive('fs:readFile:response', (data: { error?: string; content?: string }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.content!);
          }
        });
      });
    },
    writeFile: async (path: string, content: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('fs:writeFile', { path, content });
        window.electronAPI!.receive('fs:writeFile:response', (data: { error?: string }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve();
          }
        });
      });
    },
    selectDirectory: async () => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:selectDirectory', {});
        window.electronAPI!.receive('fs:selectDirectory:response', (data: { path?: string }) => {
          resolve(data.path || null);
        });
      });
    },
    selectFile: async (filters?: FileFilter[]) => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:selectFile', { filters });
        window.electronAPI!.receive('fs:selectFile:response', (data: { path?: string }) => {
          resolve(data.path || null);
        });
      });
    },
    selectFiles: async (filters?: FileFilter[]) => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:selectFiles', { filters });
        window.electronAPI!.receive('fs:selectFiles:response', (data: { paths?: string[] }) => {
          resolve(data.paths || []);
        });
      });
    },
    getFileInfo: async (path: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('fs:getFileInfo', { path });
        window.electronAPI!.receive('fs:getFileInfo:response', (data: { error?: string; fileInfo?: FileInfo }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.fileInfo!);
          }
        });
      });
    },
    readFileStream: async function* (path: string, chunkSize = 1024 * 1024) {
      return new Promise<AsyncIterableIterator<Uint8Array>>((resolve, reject) => {
        window.electronAPI!.send('fs:createReadStream', { path, chunkSize });
        window.electronAPI!.receive('fs:createReadStream:response', (data: { error?: string; streamId?: string }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(createAsyncIterator(data.streamId!));
          }
        });
      });
    },
    validateFile: async (path: string, maxSizeGB = 50) => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:validateFile', { path, maxSizeGB });
        window.electronAPI!.receive('fs:validateFile:response', (data: { valid: boolean; error?: string }) => {
          resolve(data);
        });
      });
    }
  };

  transforms: TransformAPI = {
    executeTransform: async (request: TransformExecutionRequest) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('transform:execute', request);
        window.electronAPI!.receive('transform:execute:response', (data: { error?: string; result?: TransformExecutionResponse }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.result!);
          }
        });
      });
    },
    validateTransform: async (pipeline: TransformPipeline) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('transform:validate', { pipeline });
        window.electronAPI!.receive('transform:validate:response', (data: { error?: string; validation?: TransformValidation }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.validation!);
          }
        });
      });
    },
    getTableSchema: async (tableName: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('transform:getTableSchema', { tableName });
        window.electronAPI!.receive('transform:getTableSchema:response', (data: { error?: string; schema?: TableSchema }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.schema!);
          }
        });
      });
    }
  };

  notifications: NotificationAPI = {
    show: async (title: string, body: string, options?: NotificationOptions) => {
      window.electronAPI!.send('notification:show', { title, body, options });
    },
    requestPermission: async () => {
      return true; // Electron doesn't need permission
    }
  };

  minimizeToTray = () => {
    window.electronAPI!.send('window:minimizeToTray', {});
  };

  showWindow = () => {
    window.electronAPI!.send('window:show', {});
  };

  quit = () => {
    window.electronAPI!.send('app:quit', {});
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

// Initialize the bridge on import
if (typeof window !== 'undefined') {
  window.platformBridge = initializePlatformBridge();
}