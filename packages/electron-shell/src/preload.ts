import { contextBridge, ipcRenderer } from 'electron';

// Define valid IPC channels for security
const validInvokeChannels = [
  // File system operations
  'fs:readFile',
  'fs:writeFile',
  'fs:selectDirectory',
  'fs:selectFile',
  'fs:selectFiles',
  'fs:getFileInfo',
  'fs:createReadStream',
  'fs:readStreamChunk',
  'fs:validateFile',
  // Window operations
  'window:minimizeToTray',
  'window:show',
  // Application operations
  'app:quit',
  // Notification operations
  'notification:show',
  // Transform operations
  'transform:execute',
  'transform:validate',
  'transform:getTableSchema',
  // Update operations
  'update:check',
  'update:downloadUpdate',
  'update:quitAndInstall'
];

const validSendChannels = ['toMain', 'update-tray-status'];
const validReceiveChannels = ['fromMain', 'quick-analyze', 'quick-analyze-file', 'check-services', 'open-settings', 'update-status', 'update-progress'];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  
  // For legacy compatibility
  send: (channel: string, data: any) => {
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  receive: (channel: string, func: Function) => {
    if (validReceiveChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Modern IPC invoke/handle pattern for all our APIs
  invoke: (channel: string, ...args: any[]) => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  // File system operations
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
    selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
    selectFile: (filters?: Array<{name: string, extensions: string[]}>) => ipcRenderer.invoke('fs:selectFile', filters),
    selectFiles: (filters?: Array<{name: string, extensions: string[]}>) => ipcRenderer.invoke('fs:selectFiles', filters),
    getFileInfo: (filePath: string) => ipcRenderer.invoke('fs:getFileInfo', filePath),
    createReadStream: (filePath: string, options?: { start?: number, end?: number }) => 
      ipcRenderer.invoke('fs:createReadStream', filePath, options),
    readStreamChunk: (filePath: string, start: number, end: number) => 
      ipcRenderer.invoke('fs:readStreamChunk', filePath, start, end),
    validateFile: (filePath: string, maxSize?: number, allowedExtensions?: string[]) => 
      ipcRenderer.invoke('fs:validateFile', filePath, maxSize, allowedExtensions)
  },

  // Window operations
  window: {
    minimizeToTray: () => ipcRenderer.invoke('window:minimizeToTray'),
    show: () => ipcRenderer.invoke('window:show')
  },

  // Application operations
  app: {
    quit: () => ipcRenderer.invoke('app:quit')
  },

  // Notification operations
  notification: {
    show: (options: { title: string, body: string, icon?: string }) => 
      ipcRenderer.invoke('notification:show', options)
  },

  // Transform operations
  transform: {
    execute: (transformConfig: any) => ipcRenderer.invoke('transform:execute', transformConfig),
    validate: (pipeline: any) => ipcRenderer.invoke('transform:validate', pipeline),
    getTableSchema: (tableName: string) => ipcRenderer.invoke('transform:getTableSchema', tableName)
  },
  
  // System tray operations
  tray: {
    updateStatus: (status: string) => ipcRenderer.send('update-tray-status', status),
    onQuickAnalyze: (callback: (data: { text: string }) => void) => {
      ipcRenderer.on('quick-analyze', (event, data) => callback(data));
    },
    onQuickAnalyzeFile: (callback: (data: { path: string }) => void) => {
      ipcRenderer.on('quick-analyze-file', (event, data) => callback(data));
    },
    onCheckServices: (callback: () => void) => {
      ipcRenderer.on('check-services', () => callback());
    },
    onOpenSettings: (callback: () => void) => {
      ipcRenderer.on('open-settings', () => callback());
    }
  },
  
  // Auto-updater operations
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:downloadUpdate'),
    quitAndInstall: () => ipcRenderer.invoke('update:quitAndInstall'),
    onUpdateStatus: (callback: (data: { status: string, error?: string }) => void) => {
      ipcRenderer.on('update-status', (event, data) => callback(data));
    },
    onUpdateProgress: (callback: (data: { 
      bytesPerSecond: number, 
      percent: number, 
      transferred: number, 
      total: number 
    }) => void) => {
      ipcRenderer.on('update-progress', (event, data) => callback(data));
    }
  }
});