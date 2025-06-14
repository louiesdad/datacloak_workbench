/**
 * Platform Contracts - Platform Bridge Interface
 * 
 * Defines the abstract interface for platform-specific functionality
 * Used by the platform-bridge pattern in the frontend
 */

// =============================================================================
// File System Contracts
// =============================================================================

export interface FileHandle {
  path: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface FileSelectOptions {
  multiple?: boolean;
  accept?: string[];
  startPath?: string;
  title?: string;
}

export interface FileSaveOptions {
  defaultName?: string;
  defaultPath?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  title?: string;
}

export interface FileStreamOptions {
  chunkSize?: number;
  encoding?: string;
  signal?: AbortSignal;
}

// =============================================================================
// Platform Bridge Interface
// =============================================================================

export interface PlatformBridge {
  // File System Operations
  selectFiles(options?: FileSelectOptions): Promise<FileHandle[]>;
  selectFile(options?: FileSelectOptions): Promise<FileHandle | null>;
  selectFolder(options?: { startPath?: string; title?: string }): Promise<string | null>;
  saveFile(data: ArrayBuffer | string, options?: FileSaveOptions): Promise<string | null>;
  
  // Large File Operations
  readFileStream(path: string, options?: FileStreamOptions): AsyncIterable<Uint8Array>;
  writeFileStream(path: string, options?: FileStreamOptions): WritableStream<Uint8Array>;
  getFileInfo(path: string): Promise<FileHandle>;
  
  // System Information
  getPlatformInfo(): Promise<PlatformInfo>;
  getSystemResources(): Promise<SystemResources>;
  
  // Window Management
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
  toggleFullscreen(): void;
  setWindowTitle(title: string): void;
  
  // Clipboard Operations
  writeToClipboard(text: string): Promise<void>;
  readFromClipboard(): Promise<string>;
  
  // Notifications
  showNotification(options: NotificationOptions): Promise<void>;
  showErrorDialog(title: string, message: string): Promise<void>;
  showConfirmDialog(title: string, message: string): Promise<boolean>;
  
  // Application Control
  openExternal(url: string): Promise<void>;
  showInFolder(path: string): Promise<void>;
  quit(): void;
  restart(): void;
  
  // Security & Privacy
  requestPermissions(permissions: Permission[]): Promise<PermissionStatus[]>;
  getSecureStorage(): SecureStorage;
  
  // Development & Debugging
  openDevTools(): void;
  reloadWindow(): void;
  isDevMode(): boolean;
}

// =============================================================================
// Platform Information
// =============================================================================

export interface PlatformInfo {
  platform: 'darwin' | 'win32' | 'linux' | 'web';
  arch: string;
  version: string;
  userAgent?: string;
  isElectron: boolean;
  nodeVersion?: string;
  electronVersion?: string;
}

export interface SystemResources {
  totalMemory: number;
  freeMemory: number;
  cpuUsage: number;
  diskSpace: {
    total: number;
    free: number;
    used: number;
  };
  networkStatus: 'online' | 'offline' | 'limited';
}

// =============================================================================
// Notification System
// =============================================================================

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface NotificationResponse {
  action?: string;
  closed: boolean;
  dismissed: boolean;
}

// =============================================================================
// Permissions System
// =============================================================================

export type Permission = 
  | 'camera'
  | 'microphone'
  | 'geolocation'
  | 'notifications'
  | 'clipboard-read'
  | 'clipboard-write'
  | 'file-system-read'
  | 'file-system-write';

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface PermissionStatus {
  permission: Permission;
  state: PermissionState;
}

// =============================================================================
// Secure Storage
// =============================================================================

export interface SecureStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

// =============================================================================
// Browser Implementation (Fallbacks)
// =============================================================================

export interface BrowserPlatformBridge extends PlatformBridge {
  // Browser-specific implementations
  downloadFile(data: ArrayBuffer | string, filename: string, mimeType?: string): void;
  uploadFile(accept?: string, multiple?: boolean): Promise<File[]>;
}

// =============================================================================
// Electron Implementation
// =============================================================================

export interface ElectronPlatformBridge extends PlatformBridge {
  // Electron-specific implementations
  getAppPath(): Promise<string>;
  getUserDataPath(): Promise<string>;
  getTempPath(): Promise<string>;
  
  // IPC Communication
  sendToMain(channel: string, data?: any): Promise<any>;
  onFromMain(channel: string, handler: (data: any) => void): () => void;
  
  // Menu Operations
  setApplicationMenu(template: MenuTemplate): void;
  showContextMenu(template: ContextMenuTemplate, position?: { x: number; y: number }): void;
  
  // Auto Updater
  checkForUpdates(): Promise<UpdateInfo | null>;
  downloadUpdate(): Promise<void>;
  installUpdate(): void;
}

export interface MenuTemplate {
  label: string;
  role?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  click?: () => void;
  accelerator?: string;
  submenu?: MenuTemplate[];
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
}

export interface ContextMenuTemplate extends MenuTemplate {}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  size: number;
}

// =============================================================================
// Platform Detection Utilities
// =============================================================================

export interface PlatformCapabilities {
  fileSystem: boolean;
  largeFiles: boolean;
  notifications: boolean;
  clipboard: boolean;
  windowManagement: boolean;
  systemInfo: boolean;
  secureStorage: boolean;
  nativeMenus: boolean;
  autoUpdater: boolean;
}

export interface PlatformLimitations {
  maxFileSize: number;
  maxMemoryUsage: number;
  concurrentOperations: number;
  supportedFileTypes: string[];
  securityRestrictions: string[];
}

// =============================================================================
// Error Handling
// =============================================================================

export class PlatformError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform: string,
    public operation: string
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export type PlatformErrorCode = 
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_OPERATION'
  | 'NETWORK_ERROR'
  | 'STORAGE_FULL'
  | 'INVALID_PATH'
  | 'OPERATION_CANCELLED';