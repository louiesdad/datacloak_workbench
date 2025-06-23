"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: process.versions,
    // For legacy compatibility
    send: (channel, data) => {
        if (validSendChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        if (validReceiveChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`
            electron_1.ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // Modern IPC invoke/handle pattern for all our APIs
    invoke: (channel, ...args) => {
        if (validInvokeChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    },
    // File system operations
    fs: {
        readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
        writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('fs:writeFile', filePath, content),
        selectDirectory: () => electron_1.ipcRenderer.invoke('fs:selectDirectory'),
        selectFile: (filters) => electron_1.ipcRenderer.invoke('fs:selectFile', filters),
        selectFiles: (filters) => electron_1.ipcRenderer.invoke('fs:selectFiles', filters),
        getFileInfo: (filePath) => electron_1.ipcRenderer.invoke('fs:getFileInfo', filePath),
        createReadStream: (filePath, options) => electron_1.ipcRenderer.invoke('fs:createReadStream', filePath, options),
        readStreamChunk: (filePath, start, end) => electron_1.ipcRenderer.invoke('fs:readStreamChunk', filePath, start, end),
        validateFile: (filePath, maxSize, allowedExtensions) => electron_1.ipcRenderer.invoke('fs:validateFile', filePath, maxSize, allowedExtensions)
    },
    // Window operations
    window: {
        minimizeToTray: () => electron_1.ipcRenderer.invoke('window:minimizeToTray'),
        show: () => electron_1.ipcRenderer.invoke('window:show')
    },
    // Application operations
    app: {
        quit: () => electron_1.ipcRenderer.invoke('app:quit')
    },
    // Notification operations
    notification: {
        show: (options) => electron_1.ipcRenderer.invoke('notification:show', options)
    },
    // Transform operations
    transform: {
        execute: (transformConfig) => electron_1.ipcRenderer.invoke('transform:execute', transformConfig),
        validate: (pipeline) => electron_1.ipcRenderer.invoke('transform:validate', pipeline),
        getTableSchema: (tableName) => electron_1.ipcRenderer.invoke('transform:getTableSchema', tableName)
    },
    // System tray operations
    tray: {
        updateStatus: (status) => electron_1.ipcRenderer.send('update-tray-status', status),
        onQuickAnalyze: (callback) => {
            electron_1.ipcRenderer.on('quick-analyze', (event, data) => callback(data));
        },
        onQuickAnalyzeFile: (callback) => {
            electron_1.ipcRenderer.on('quick-analyze-file', (event, data) => callback(data));
        },
        onCheckServices: (callback) => {
            electron_1.ipcRenderer.on('check-services', () => callback());
        },
        onOpenSettings: (callback) => {
            electron_1.ipcRenderer.on('open-settings', () => callback());
        }
    },
    // Auto-updater operations
    updater: {
        check: () => electron_1.ipcRenderer.invoke('update:check'),
        downloadUpdate: () => electron_1.ipcRenderer.invoke('update:downloadUpdate'),
        quitAndInstall: () => electron_1.ipcRenderer.invoke('update:quitAndInstall'),
        onUpdateStatus: (callback) => {
            electron_1.ipcRenderer.on('update-status', (event, data) => callback(data));
        },
        onUpdateProgress: (callback) => {
            electron_1.ipcRenderer.on('update-progress', (event, data) => callback(data));
        }
    }
});
