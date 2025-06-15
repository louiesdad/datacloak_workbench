import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ElectronFeatureMonitor } from '../ElectronFeatureMonitor';
import { NotificationProvider } from '../NotificationToast';

// Mock window.platformBridge
const mockPlatformBridge = {
  capabilities: {
    platform: 'electron',
    os: 'darwin',
    version: '1.0.0'
  },
  autoUpdater: {
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn()
  },
  fileSystem: {},
  notifications: {},
  shortcuts: {}
};

describe('ElectronFeatureMonitor', () => {
  const originalPlatformBridge = window.platformBridge;
  const originalNavigator = { ...navigator };

  beforeEach(() => {
    window.platformBridge = mockPlatformBridge;
    jest.clearAllMocks();
  });

  afterEach(() => {
    window.platformBridge = originalPlatformBridge;
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <NotificationProvider>
        <ElectronFeatureMonitor {...props} />
      </NotificationProvider>
    );
  };

  it('should not render in non-Electron environment', () => {
    window.platformBridge = undefined;
    const { container } = renderComponent();
    expect(container.firstChild).toBeNull();
  });

  it('should render in Electron environment', () => {
    renderComponent();
    expect(screen.getByTitle('Toggle Electron features monitor')).toBeInTheDocument();
  });

  it('should render in test mode even without Electron', () => {
    window.platformBridge = undefined;
    renderComponent({ testMode: true });
    expect(screen.getByTitle('Toggle Electron features monitor')).toBeInTheDocument();
  });

  it('should toggle monitor panel visibility', () => {
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    expect(screen.queryByText('Electron Features')).not.toBeInTheDocument();
    
    fireEvent.click(toggleButton);
    expect(screen.getByText('Electron Features')).toBeInTheDocument();
    
    fireEvent.click(toggleButton);
    expect(screen.queryByText('Electron Features')).not.toBeInTheDocument();
  });

  it('should display platform information', () => {
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Platform:')).toBeInTheDocument();
    expect(screen.getByText('darwin')).toBeInTheDocument();
    expect(screen.getByText('Version:')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('should show feature availability', () => {
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Auto Updater')).toBeInTheDocument();
    expect(screen.getByText('File Access')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('should check for updates on mount', async () => {
    mockPlatformBridge.autoUpdater.checkForUpdates.mockResolvedValue({
      updateAvailable: false
    });
    
    renderComponent();
    
    await waitFor(() => {
      expect(mockPlatformBridge.autoUpdater.checkForUpdates).toHaveBeenCalled();
    });
  });

  it('should handle update available', async () => {
    mockPlatformBridge.autoUpdater.checkForUpdates.mockResolvedValue({
      updateAvailable: true,
      version: '2.0.0'
    });
    
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('🎉 Update available!')).toBeInTheDocument();
      expect(screen.getByText('Download Update')).toBeInTheDocument();
    });
  });

  it('should handle update download', async () => {
    mockPlatformBridge.autoUpdater.checkForUpdates.mockResolvedValue({
      updateAvailable: true,
      version: '2.0.0'
    });
    mockPlatformBridge.autoUpdater.downloadUpdate.mockResolvedValue(true);
    
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Download Update')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Download Update'));
    
    await waitFor(() => {
      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
    });
  });

  it('should show offline indicator when offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true
    });
    
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    expect(screen.getByText('🔴')).toBeInTheDocument();
    
    fireEvent.click(toggleButton);
    expect(screen.getByText('⚠️ Offline Mode')).toBeInTheDocument();
  });

  it('should handle online/offline events', () => {
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    // Trigger offline event
    fireEvent(window, new Event('offline'));
    expect(screen.getByText('🔴 Offline')).toBeInTheDocument();
    
    // Trigger online event
    fireEvent(window, new Event('online'));
    expect(screen.getByText('🟢 Online')).toBeInTheDocument();
  });

  it('should close panel when close button is clicked', () => {
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Electron Features')).toBeInTheDocument();
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Electron Features')).not.toBeInTheDocument();
  });

  it('should show test mode indicator in test mode', () => {
    renderComponent({ testMode: true });
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('🧪 Test Mode Active')).toBeInTheDocument();
  });

  it('should handle update installation', async () => {
    mockPlatformBridge.autoUpdater.checkForUpdates.mockResolvedValue({
      updateAvailable: true,
      version: '2.0.0'
    });
    mockPlatformBridge.autoUpdater.quitAndInstall.mockResolvedValue(true);
    
    renderComponent();
    
    const toggleButton = screen.getByTitle('Toggle Electron features monitor');
    fireEvent.click(toggleButton);
    
    // Wait for update check
    await waitFor(() => {
      expect(screen.getByText('Download Update')).toBeInTheDocument();
    });
    
    // Download update
    fireEvent.click(screen.getByText('Download Update'));
    
    // Wait for download to complete (simulated)
    await waitFor(() => {
      expect(screen.getByText('Restart and Install')).toBeInTheDocument();
    }, { timeout: 10000 });
    
    // Install update
    fireEvent.click(screen.getByText('Restart and Install'));
    
    expect(mockPlatformBridge.autoUpdater.quitAndInstall).toHaveBeenCalled();
  });
});