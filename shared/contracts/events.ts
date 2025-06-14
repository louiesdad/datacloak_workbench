/**
 * Event Contracts - IPC Communication
 * 
 * Defines event types for communication between Electron main and renderer processes
 */

// =============================================================================
// Base Event Types
// =============================================================================

export interface IPCEvent<T = any> {
  type: string;
  payload?: T;
  timestamp: string;
  requestId?: string;
}

export interface IPCResponse<T = any> extends IPCEvent<T> {
  success: boolean;
  error?: string;
}

// =============================================================================
// File System Events
// =============================================================================

export interface FileSelectEvent extends IPCEvent {
  type: 'file:select';
  payload: {
    filters?: Array<{
      name: string;
      extensions: string[];
    }>;
    multiple?: boolean;
    properties?: string[];
  };
}

export interface FileSelectResponse extends IPCResponse {
  type: 'file:select:response';
  payload: {
    files: Array<{
      path: string;
      name: string;
      size: number;
      type: string;
    }>;
  };
}

export interface FileUploadEvent extends IPCEvent {
  type: 'file:upload';
  payload: {
    filePath: string;
    destination?: string;
    chunkSize?: number;
  };
}

export interface FileUploadProgressEvent extends IPCEvent {
  type: 'file:upload:progress';
  payload: {
    progress: number;
    bytesUploaded: number;
    totalBytes: number;
    eta?: number;
  };
}

export interface FileSaveEvent extends IPCEvent {
  type: 'file:save';
  payload: {
    data: any;
    defaultPath?: string;
    filters?: Array<{
      name: string;
      extensions: string[];
    }>;
  };
}

// =============================================================================
// Data Processing Events
// =============================================================================

export interface DataProcessingStartEvent extends IPCEvent {
  type: 'data:processing:start';
  payload: {
    operation: 'upload' | 'analysis' | 'inference' | 'export';
    datasetId?: string;
    parameters?: Record<string, any>;
  };
}

export interface DataProcessingProgressEvent extends IPCEvent {
  type: 'data:processing:progress';
  payload: {
    operation: string;
    progress: number;
    stage: string;
    eta?: number;
    details?: string;
  };
}

export interface DataProcessingCompleteEvent extends IPCEvent {
  type: 'data:processing:complete';
  payload: {
    operation: string;
    result: any;
    duration: number;
  };
}

export interface DataProcessingErrorEvent extends IPCEvent {
  type: 'data:processing:error';
  payload: {
    operation: string;
    error: string;
    details?: any;
  };
}

// =============================================================================
// Security Events
// =============================================================================

export interface SecurityScanEvent extends IPCEvent {
  type: 'security:scan';
  payload: {
    datasetId: string;
    level: 'basic' | 'thorough' | 'comprehensive';
  };
}

export interface SecurityAlertEvent extends IPCEvent {
  type: 'security:alert';
  payload: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: any;
    actionRequired?: boolean;
  };
}

export interface DataMaskingEvent extends IPCEvent {
  type: 'security:mask';
  payload: {
    datasetId: string;
    fields: string[];
    method: 'encrypt' | 'hash' | 'replace' | 'remove';
  };
}

// =============================================================================
// Application Events
// =============================================================================

export interface AppStateChangeEvent extends IPCEvent {
  type: 'app:state:change';
  payload: {
    state: 'ready' | 'busy' | 'error' | 'offline';
    details?: string;
  };
}

export interface AppConfigUpdateEvent extends IPCEvent {
  type: 'app:config:update';
  payload: {
    config: Record<string, any>;
    changed: string[];
  };
}

export interface AppUpdateEvent extends IPCEvent {
  type: 'app:update';
  payload: {
    version: string;
    available: boolean;
    required: boolean;
    releaseNotes?: string;
  };
}

// =============================================================================
// Window Management Events
// =============================================================================

export interface WindowControlEvent extends IPCEvent {
  type: 'window:control';
  payload: {
    action: 'minimize' | 'maximize' | 'close' | 'toggle-fullscreen';
    windowId?: string;
  };
}

export interface WindowStateEvent extends IPCEvent {
  type: 'window:state';
  payload: {
    isMaximized: boolean;
    isMinimized: boolean;
    isFullscreen: boolean;
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

// =============================================================================
// Developer Events (for debugging and development)
// =============================================================================

export interface DevToolsEvent extends IPCEvent {
  type: 'dev:tools';
  payload: {
    action: 'open' | 'close' | 'toggle';
  };
}

export interface LogEvent extends IPCEvent {
  type: 'dev:log';
  payload: {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    data?: any;
    timestamp: string;
  };
}

export interface PerformanceEvent extends IPCEvent {
  type: 'dev:performance';
  payload: {
    metric: string;
    value: number;
    unit: string;
    context?: string;
  };
}

// =============================================================================
// Event Union Types
// =============================================================================

export type AllEvents = 
  | FileSelectEvent
  | FileUploadEvent
  | FileSaveEvent
  | DataProcessingStartEvent
  | DataProcessingProgressEvent
  | DataProcessingCompleteEvent
  | DataProcessingErrorEvent
  | SecurityScanEvent
  | SecurityAlertEvent
  | DataMaskingEvent
  | AppStateChangeEvent
  | AppConfigUpdateEvent
  | AppUpdateEvent
  | WindowControlEvent
  | WindowStateEvent
  | DevToolsEvent
  | LogEvent
  | PerformanceEvent;

export type AllResponses =
  | FileSelectResponse
  | IPCResponse;

// =============================================================================
// Event Handler Types
// =============================================================================

export type EventHandler<T extends IPCEvent = IPCEvent> = (event: T) => Promise<void> | void;
export type ResponseHandler<T extends IPCResponse = IPCResponse> = (response: T) => Promise<void> | void;

export interface EventEmitter {
  on<T extends AllEvents>(eventType: T['type'], handler: EventHandler<T>): void;
  emit<T extends AllEvents>(event: T): void;
  off<T extends AllEvents>(eventType: T['type'], handler?: EventHandler<T>): void;
}

// =============================================================================
// Utility Types for Event Handling
// =============================================================================

export type EventType = AllEvents['type'];
export type EventPayload<T extends EventType> = Extract<AllEvents, { type: T }>['payload'];

export interface EventSubscription {
  id: string;
  eventType: EventType;
  handler: EventHandler;
  once?: boolean;
}

export interface EventChannel {
  subscribe<T extends AllEvents>(eventType: T['type'], handler: EventHandler<T>): string;
  unsubscribe(subscriptionId: string): void;
  emit<T extends AllEvents>(event: T): void;
  clear(): void;
}