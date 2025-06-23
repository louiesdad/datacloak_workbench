"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const util_1 = require("util");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const stat = (0, util_1.promisify)(fs.stat);
let mainWindow = null;
let tray = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    // In development, load from Vite dev server
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        // In production, load the built web-ui
        mainWindow.loadFile(path.join(__dirname, '../../web-ui/dist/index.html'));
    }
    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!electron_1.app.isQuitting && process.platform !== 'darwin') {
            event.preventDefault();
            mainWindow?.hide();
            // Show notification on first minimize
            if (!global.hasShownTrayNotification) {
                new electron_1.Notification({
                    title: 'DataCloak Sentiment Workbench',
                    body: 'Application minimized to system tray'
                }).show();
                global.hasShownTrayNotification = true;
            }
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Setup IPC handlers
function setupIpcHandlers() {
    // File system operations
    electron_1.ipcMain.handle('fs:readFile', async (event, filePath) => {
        try {
            const content = await readFile(filePath, 'utf8');
            return { success: true, content };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
        try {
            await writeFile(filePath, content, 'utf8');
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:selectDirectory', async () => {
        try {
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory']
            });
            if (result.canceled) {
                return { success: false, error: 'User cancelled directory selection' };
            }
            return { success: true, path: result.filePaths[0] };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:selectFile', async (event, filters) => {
        try {
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: filters || [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
                ]
            });
            if (result.canceled) {
                return { success: false, error: 'User cancelled file selection' };
            }
            return { success: true, path: result.filePaths[0] };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:selectFiles', async (event, filters) => {
        try {
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openFile', 'multiSelections'],
                filters: filters || [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'CSV Files', extensions: ['csv'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
                ]
            });
            if (result.canceled) {
                return { success: false, error: 'User cancelled file selection' };
            }
            return { success: true, paths: result.filePaths };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:getFileInfo', async (event, filePath) => {
        try {
            const stats = await stat(filePath);
            const fileInfo = {
                size: stats.size,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                created: stats.birthtime.toISOString(),
                modified: stats.mtime.toISOString(),
                name: path.basename(filePath),
                extension: path.extname(filePath),
                directory: path.dirname(filePath)
            };
            return { success: true, info: fileInfo };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:createReadStream', async (event, filePath, options) => {
        try {
            // For security, we'll read the file in chunks rather than creating an actual stream
            const streamId = Date.now().toString();
            return { success: true, streamId, chunkSize: 64 * 1024 }; // 64KB chunks
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:readStreamChunk', async (event, filePath, start, end) => {
        try {
            const buffer = Buffer.alloc(end - start);
            const fd = fs.openSync(filePath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, end - start, start);
            fs.closeSync(fd);
            return {
                success: true,
                chunk: buffer.subarray(0, bytesRead).toString('utf8'),
                bytesRead,
                isEnd: bytesRead < (end - start)
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('fs:validateFile', async (event, filePath, maxSize, allowedExtensions) => {
        try {
            const stats = await stat(filePath);
            const extension = path.extname(filePath).toLowerCase();
            const validation = {
                exists: true,
                size: stats.size,
                extension,
                isValid: true,
                errors: []
            };
            if (maxSize && stats.size > maxSize) {
                validation.isValid = false;
                validation.errors.push(`File size ${stats.size} exceeds maximum allowed size ${maxSize}`);
            }
            if (allowedExtensions && !allowedExtensions.includes(extension)) {
                validation.isValid = false;
                validation.errors.push(`File extension ${extension} is not allowed`);
            }
            return { success: true, validation };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Window operations
    electron_1.ipcMain.handle('window:minimizeToTray', async () => {
        try {
            if (!tray) {
                // Create tray icon if it doesn't exist
                const icon = electron_1.nativeImage.createFromPath(path.join(__dirname, '../assets/tray-icon.png'));
                tray = new electron_1.Tray(icon);
                tray.setToolTip('DataCloak Sentiment Workbench');
                tray.on('click', () => {
                    if (mainWindow) {
                        mainWindow.show();
                    }
                });
            }
            if (mainWindow) {
                mainWindow.hide();
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('window:show', async () => {
        try {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Application operations
    electron_1.ipcMain.handle('app:quit', async () => {
        electron_1.app.quit();
        return { success: true };
    });
    // Notification operations
    electron_1.ipcMain.handle('notification:show', async (event, options) => {
        try {
            if (electron_1.Notification.isSupported()) {
                const notification = new electron_1.Notification({
                    title: options.title,
                    body: options.body,
                    icon: options.icon
                });
                notification.show();
                return { success: true };
            }
            else {
                return { success: false, error: 'Notifications not supported on this platform' };
            }
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // Transform operations (these would integrate with your backend services)
    electron_1.ipcMain.handle('transform:execute', async (event, transformConfig) => {
        try {
            // This would integrate with your backend transform service
            // For now, return a placeholder response
            return {
                success: true,
                result: {
                    message: 'Transform executed successfully',
                    config: transformConfig,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('transform:validate', async (event, pipeline) => {
        try {
            // Validate transform pipeline
            const validation = {
                isValid: true,
                errors: [],
                warnings: []
            };
            if (!pipeline || !pipeline.steps || !Array.isArray(pipeline.steps)) {
                validation.isValid = false;
                validation.errors.push('Pipeline must have a steps array');
            }
            return { success: true, validation };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('transform:getTableSchema', async (event, tableName) => {
        try {
            // This would integrate with your database service
            // For now, return a placeholder schema
            const schema = {
                tableName,
                columns: [
                    { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
                    { name: 'text', type: 'TEXT', nullable: false },
                    { name: 'sentiment', type: 'TEXT', nullable: true },
                    { name: 'score', type: 'REAL', nullable: true },
                    { name: 'confidence', type: 'REAL', nullable: true },
                    { name: 'created_at', type: 'DATETIME', nullable: false }
                ]
            };
            return { success: true, schema };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
}
// Create system tray
function createTray() {
    // Create tray icon
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    const icon = electron_1.nativeImage.createFromPath(iconPath);
    // If icon doesn't exist, create a simple one
    if (icon.isEmpty()) {
        // Create a simple 16x16 icon programmatically
        const size = { width: 16, height: 16 };
        tray = new electron_1.Tray(electron_1.nativeImage.createEmpty());
    }
    else {
        tray = new electron_1.Tray(icon);
    }
    tray.setToolTip('DataCloak Sentiment Workbench');
    // Create context menu
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Show Application',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
                else {
                    createWindow();
                }
            }
        },
        {
            label: 'Quick Analysis',
            submenu: [
                {
                    label: 'Analyze Clipboard',
                    click: async () => {
                        const { clipboard } = require('electron');
                        const text = clipboard.readText();
                        if (text && mainWindow) {
                            mainWindow.webContents.send('quick-analyze', { text });
                            mainWindow.show();
                        }
                    }
                },
                {
                    label: 'Analyze File...',
                    click: async () => {
                        const result = await electron_1.dialog.showOpenDialog({
                            properties: ['openFile'],
                            filters: [
                                { name: 'Text Files', extensions: ['txt', 'csv', 'json'] },
                                { name: 'All Files', extensions: ['*'] }
                            ]
                        });
                        if (!result.canceled && result.filePaths[0] && mainWindow) {
                            mainWindow.webContents.send('quick-analyze-file', { path: result.filePaths[0] });
                            mainWindow.show();
                        }
                    }
                }
            ]
        },
        { type: 'separator' },
        {
            label: 'Status',
            submenu: [
                {
                    label: 'Check Services',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('check-services');
                        }
                    }
                },
                {
                    label: 'View Logs',
                    click: () => {
                        const logsPath = electron_1.app.getPath('logs');
                        electron_1.shell.openPath(logsPath);
                    }
                }
            ]
        },
        { type: 'separator' },
        {
            label: 'Updates',
            submenu: [
                {
                    label: 'Check for Updates...',
                    click: () => {
                        electron_1.autoUpdater.checkForUpdates();
                    }
                },
                {
                    label: `Version ${electron_1.app.getVersion()}`,
                    enabled: false
                }
            ]
        },
        { type: 'separator' },
        {
            label: 'Settings',
            click: () => {
                if (mainWindow) {
                    mainWindow.webContents.send('open-settings');
                    mainWindow.show();
                }
            }
        },
        {
            label: 'About',
            click: () => {
                electron_1.dialog.showMessageBox({
                    type: 'info',
                    title: 'About DataCloak Sentiment Workbench',
                    message: 'DataCloak Sentiment Workbench',
                    detail: 'Version 1.0.0\n\nPrivacy-preserving sentiment analysis with advanced PII detection and compliance features.',
                    buttons: ['OK']
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                electron_1.app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
    // Handle tray click
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            }
            else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
        else {
            createWindow();
        }
    });
    // Update tray based on app state
    electron_1.ipcMain.on('update-tray-status', (event, status) => {
        if (tray) {
            tray.setToolTip(`DataCloak Sentiment Workbench - ${status}`);
        }
    });
}
// Setup auto-updater
function setupAutoUpdater() {
    // Configure update server URL
    const server = 'https://update.datacloak.io';
    const feed = `${server}/update/${process.platform}/${electron_1.app.getVersion()}`;
    try {
        electron_1.autoUpdater.setFeedURL({ url: feed });
        // Check for updates every 4 hours
        setInterval(() => {
            electron_1.autoUpdater.checkForUpdates();
        }, 4 * 60 * 60 * 1000);
        // Check on startup
        electron_1.autoUpdater.checkForUpdates();
    }
    catch (error) {
        console.error('Failed to setup auto-updater:', error);
    }
    // Auto-updater events
    electron_1.autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'checking' });
        }
    });
    electron_1.autoUpdater.on('update-available', () => {
        console.log('Update available');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'available' });
        }
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: 'A new version of DataCloak Sentiment Workbench is available.',
            detail: 'The update will be downloaded in the background. You will be notified when it is ready to install.',
            buttons: ['OK']
        });
    });
    electron_1.autoUpdater.on('update-not-available', () => {
        console.log('No updates available');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'up-to-date' });
        }
    });
    electron_1.autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'error', error: error.message });
        }
    });
    electron_1.autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
        console.log(logMessage);
        if (mainWindow) {
            mainWindow.webContents.send('update-progress', {
                bytesPerSecond: progressObj.bytesPerSecond,
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total
            });
        }
    });
    electron_1.autoUpdater.on('update-downloaded', () => {
        console.log('Update downloaded');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'downloaded' });
        }
        electron_1.dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'A new version has been downloaded.',
            detail: 'The application will restart to apply the update.',
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                electron_1.autoUpdater.quitAndInstall();
            }
        });
    });
    // IPC handlers for manual update checks
    electron_1.ipcMain.handle('update:check', async () => {
        try {
            electron_1.autoUpdater.checkForUpdates();
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('update:downloadUpdate', async () => {
        try {
            electron_1.autoUpdater.downloadUpdate();
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('update:quitAndInstall', async () => {
        electron_1.autoUpdater.quitAndInstall();
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    setupIpcHandlers();
    createTray();
    // Only setup auto-updater in production
    if (process.env.NODE_ENV !== 'development') {
        setupAutoUpdater();
    }
});
electron_1.app.on('window-all-closed', () => {
    // Don't quit on window close - keep running in tray
    if (process.platform === 'darwin') {
        // On macOS, keep app running even when all windows are closed
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// Handle app termination
electron_1.app.on('before-quit', () => {
    electron_1.app.isQuitting = true;
    if (tray) {
        tray.destroy();
        tray = null;
    }
});
// Initialize global variable
global.hasShownTrayNotification = false;
