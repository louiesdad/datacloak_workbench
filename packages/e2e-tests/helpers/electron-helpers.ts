import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as path from 'path';

export interface ElectronAppInfo {
  app: ElectronApplication;
  mainWindow: Page;
}

/**
 * Launch Electron application for testing
 */
export async function launchElectronApp(
  executablePath?: string
): Promise<ElectronAppInfo> {
  const electronPath = executablePath || require('electron');
  const appPath = path.join(__dirname, '../../../electron-shell/dist/main.js');
  
  // Launch app
  const app = await electron.launch({
    args: [appPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  });
  
  // Wait for the first window
  const mainWindow = await app.firstWindow();
  
  // Wait for app to be ready
  await mainWindow.waitForLoadState('networkidle');
  
  return { app, mainWindow };
}

/**
 * Mock Electron dialog methods
 */
export async function mockElectronDialogs(app: ElectronApplication) {
  await app.evaluate(async ({ dialog }) => {
    // Mock showOpenDialog
    dialog.showOpenDialog = async (options: any) => {
      return {
        canceled: false,
        filePaths: ['/test/path/to/file.csv']
      };
    };
    
    // Mock showSaveDialog
    dialog.showSaveDialog = async (options: any) => {
      return {
        canceled: false,
        filePath: '/test/path/to/save.csv'
      };
    };
    
    // Mock showMessageBox
    dialog.showMessageBox = async (options: any) => {
      return {
        response: 0, // First button clicked
        checkboxChecked: false
      };
    };
  });
}

/**
 * Get Electron app metrics
 */
export async function getAppMetrics(app: ElectronApplication) {
  return await app.evaluate(async ({ app }) => {
    const metrics = app.getAppMetrics();
    const memory = process.memoryUsage();
    
    return {
      metrics,
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss
      },
      cpuUsage: process.cpuUsage()
    };
  });
}

/**
 * Mock IPC communication
 */
export async function mockIPCHandlers(app: ElectronApplication, handlers: Record<string, any>) {
  await app.evaluate(async ({ ipcMain }, handlers) => {
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcMain.removeAllListeners(channel);
      ipcMain.handle(channel, handler);
    });
  }, handlers);
}

/**
 * Test file streaming through main process
 */
export async function testFileStreaming(
  app: ElectronApplication, 
  filePath: string
): Promise<boolean> {
  return await app.evaluate(async ({ fs }, filePath) => {
    return new Promise((resolve) => {
      const stream = fs.createReadStream(filePath);
      let chunks = 0;
      
      stream.on('data', () => chunks++);
      stream.on('end', () => resolve(chunks > 0));
      stream.on('error', () => resolve(false));
    });
  }, filePath);
}

/**
 * Check if UI is responsive during operation
 */
export async function checkUIResponsiveness(
  page: Page,
  operation: () => Promise<void>,
  checkInterval: number = 100
): Promise<number[]> {
  const responseTimes: number[] = [];
  let checking = true;
  
  // Start the operation
  const operationPromise = operation().finally(() => {
    checking = false;
  });
  
  // Check responsiveness
  while (checking) {
    const start = Date.now();
    
    try {
      // Try a simple DOM operation
      await page.evaluate(() => {
        document.body.style.cursor = 'wait';
        document.body.style.cursor = '';
      });
      
      const responseTime = Date.now() - start;
      responseTimes.push(responseTime);
    } catch (e) {
      // Page unresponsive
      responseTimes.push(-1);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  await operationPromise;
  return responseTimes;
}

/**
 * Get platform-specific paths
 */
export async function getPlatformPaths(app: ElectronApplication) {
  return await app.evaluate(async ({ app }) => {
    return {
      userData: app.getPath('userData'),
      temp: app.getPath('temp'),
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'),
      appData: app.getPath('appData')
    };
  });
}

/**
 * Test platform bridge functionality
 */
export async function testPlatformBridge(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return typeof window.electronAPI !== 'undefined' &&
           typeof window.electronAPI.selectFile === 'function' &&
           typeof window.electronAPI.saveFile === 'function';
  });
}

/**
 * Clean up after Electron tests
 */
export async function cleanupElectronApp(appInfo: ElectronAppInfo) {
  // Close all windows
  const windows = appInfo.app.windows();
  for (const window of windows) {
    await window.close();
  }
  
  // Quit the app
  await appInfo.app.close();
}