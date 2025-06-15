import { test, expect } from '@playwright/test';
import { 
  launchElectronApp, 
  mockElectronDialogs,
  getAppMetrics,
  testPlatformBridge,
  checkUIResponsiveness,
  cleanupElectronApp,
  ElectronAppInfo
} from '../helpers/electron-helpers';

// Skip these tests in regular browser mode
test.describe.skip(() => !process.env.ELECTRON_PATH, 'Electron-specific features', () => {
  let electronApp: ElectronAppInfo;
  
  test.beforeEach(async () => {
    electronApp = await launchElectronApp(process.env.ELECTRON_PATH);
    await mockElectronDialogs(electronApp.app);
  });
  
  test.afterEach(async () => {
    if (electronApp) {
      await cleanupElectronApp(electronApp);
    }
  });
  
  test('file dialog returns correct path', async () => {
    const { app, mainWindow } = electronApp;
    
    // Mock dialog to return specific path
    await app.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: ['/test/fixtures/test-file.csv']
      });
    });
    
    // Trigger file selection
    await mainWindow.click('button:has-text("Select File")');
    
    // Verify file path was received
    const selectedFile = await mainWindow.evaluate(() => {
      return (window as any).lastSelectedFile;
    });
    
    expect(selectedFile).toBe('/test/fixtures/test-file.csv');
  });
  
  test('verify IPC communication', async () => {
    const { app, mainWindow } = electronApp;
    
    // Set up IPC handler
    await app.evaluate(async ({ ipcMain }) => {
      ipcMain.handle('test-channel', async (event, arg) => {
        return `Received: ${arg}`;
      });
    });
    
    // Send IPC message from renderer
    const result = await mainWindow.evaluate(async () => {
      if (window.electronAPI?.invoke) {
        return await window.electronAPI.invoke('test-channel', 'Hello IPC');
      }
      return null;
    });
    
    expect(result).toBe('Received: Hello IPC');
  });
  
  test('check file streaming through main process', async () => {
    const { app } = electronApp;
    
    // Test streaming a small file
    const canStream = await app.evaluate(async ({ fs }) => {
      const testData = 'id,name,value\n1,test,100\n2,test2,200';
      const tempFile = require('path').join(require('os').tmpdir(), 'test-stream.csv');
      
      // Write test file
      fs.writeFileSync(tempFile, testData);
      
      // Test streaming
      return new Promise((resolve) => {
        const stream = fs.createReadStream(tempFile);
        let data = '';
        
        stream.on('data', (chunk: any) => {
          data += chunk;
        });
        
        stream.on('end', () => {
          fs.unlinkSync(tempFile);
          resolve(data === testData);
        });
        
        stream.on('error', () => resolve(false));
      });
    });
    
    expect(canStream).toBe(true);
  });
  
  test('large file does not block UI', async () => {
    const { mainWindow } = electronApp;
    
    // Upload a large file and check UI responsiveness
    const responseTimes = await checkUIResponsiveness(
      mainWindow,
      async () => {
        // Simulate large file processing
        await mainWindow.click('button:has-text("Upload")');
        await mainWindow.setInputFiles('input[type="file"]', './fixtures/medium-test.csv');
        await mainWindow.waitForTimeout(5000);
      },
      100 // Check every 100ms
    );
    
    // Filter out any failed checks
    const validResponseTimes = responseTimes.filter(t => t > 0);
    const avgResponseTime = validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length;
    
    console.log(`Average UI response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // UI should remain responsive (under 200ms average)
    expect(avgResponseTime).toBeLessThan(200);
  });
  
  test('platform bridge APIs available', async () => {
    const { mainWindow } = electronApp;
    
    const hasPlatformBridge = await testPlatformBridge(mainWindow);
    expect(hasPlatformBridge).toBe(true);
    
    // Test specific APIs
    const apis = await mainWindow.evaluate(() => {
      const api = window.electronAPI;
      return {
        hasSelectFile: typeof api?.selectFile === 'function',
        hasSaveFile: typeof api?.saveFile === 'function',
        hasReadFile: typeof api?.readFile === 'function',
        hasWriteFile: typeof api?.writeFile === 'function',
        hasGetAppInfo: typeof api?.getAppInfo === 'function'
      };
    });
    
    expect(apis.hasSelectFile).toBe(true);
    expect(apis.hasSaveFile).toBe(true);
  });
  
  test('memory usage within limits', async () => {
    const { app, mainWindow } = electronApp;
    
    // Get initial memory
    const initialMetrics = await getAppMetrics(app);
    console.log('Initial memory:', initialMetrics.memory);
    
    // Perform some operations
    await mainWindow.click('button:has-text("Upload")');
    await mainWindow.setInputFiles('input[type="file"]', './fixtures/small-test.csv');
    await mainWindow.waitForTimeout(3000);
    
    // Get final memory
    const finalMetrics = await getAppMetrics(app);
    console.log('Final memory:', finalMetrics.memory);
    
    // Memory increase should be reasonable
    const memoryIncrease = finalMetrics.memory.heapUsed - initialMetrics.memory.heapUsed;
    const increaseMB = memoryIncrease / 1024 / 1024;
    
    console.log(`Memory increased by: ${increaseMB.toFixed(2)}MB`);
    
    // Should not increase by more than 100MB for small file
    expect(increaseMB).toBeLessThan(100);
  });
  
  test('window management', async () => {
    const { app, mainWindow } = electronApp;
    
    // Get window state
    const bounds = await mainWindow.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    });
    
    expect(bounds.width).toBeGreaterThan(800);
    expect(bounds.height).toBeGreaterThan(600);
    
    // Test fullscreen toggle if available
    const canFullscreen = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.isFullScreenable();
    });
    
    if (canFullscreen) {
      await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setFullScreen(true);
      });
      
      await mainWindow.waitForTimeout(500);
      
      const isFullscreen = await app.evaluate(async ({ BrowserWindow }) => {
        const win = BrowserWindow.getAllWindows()[0];
        return win.isFullScreen();
      });
      
      expect(isFullscreen).toBe(true);
    }
  });
});