import React, { useState, useEffect, useRef } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { useNotifications } from './NotificationToast';
import './ElectronFeatureMonitor.css';

interface ElectronFeatureMonitorProps {
  className?: string;
  testMode?: boolean;
}

interface ElectronStatus {
  isElectron: boolean;
  platform: string;
  version: string;
  features: {
    autoUpdater: boolean;
    offlineMode: boolean;
    fileAccess: boolean;
    notifications: boolean;
    globalShortcuts: boolean;
  };
  updateStatus: 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'idle';
  updateProgress: number;
  offlineStatus: boolean;
}

export const ElectronFeatureMonitor: React.FC<ElectronFeatureMonitorProps> = ({
  className = '',
  testMode = false
}) => {
  const [electronStatus, setElectronStatus] = useState<ElectronStatus>({
    isElectron: false,
    platform: 'unknown',
    version: 'unknown',
    features: {
      autoUpdater: false,
      offlineMode: false,
      fileAccess: false,
      notifications: false,
      globalShortcuts: false
    },
    updateStatus: 'idle',
    updateProgress: 0,
    offlineStatus: navigator.onLine
  });
  
  const [showMonitor, setShowMonitor] = useState(false);
  const { addNotification } = useNotifications();

  // Detect Electron environment
  useEffect(() => {
    const isElectronEnv = !!(window as any).electron || 
                         !!(window as any).require || 
                         window.platformBridge?.capabilities?.platform === 'electron';
    
    if (isElectronEnv || testMode) {
      setElectronStatus(prev => ({
        ...prev,
        isElectron: true,
        platform: window.platformBridge?.capabilities?.os || 'unknown',
        version: window.platformBridge?.capabilities?.version || 'unknown',
        features: {
          autoUpdater: !!window.platformBridge?.autoUpdater,
          offlineMode: true,
          fileAccess: !!window.platformBridge?.fileSystem,
          notifications: !!window.platformBridge?.notifications,
          globalShortcuts: !!window.platformBridge?.shortcuts
        }
      }));
    }
  }, [testMode]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setElectronStatus(prev => ({ ...prev, offlineStatus: true }));
      addNotification({
        type: 'success',
        message: 'Connection restored',
        duration: 3000
      });
    };

    const handleOffline = () => {
      setElectronStatus(prev => ({ ...prev, offlineStatus: false }));
      addNotification({
        type: 'warning',
        message: 'Working offline - Some features may be limited',
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  // Auto-updater monitoring
  useEffect(() => {
    // Capture initial state to avoid dependency on changing electronStatus
    const isElectronEnv = !!(window as any).electron || 
                          !!(window as any).require || 
                          window.platformBridge?.capabilities?.platform === 'electron' ||
                          testMode;
    
    if (!isElectronEnv || !window.platformBridge?.autoUpdater) return;

    const checkForUpdates = async () => {
      try {
        setElectronStatus(prev => ({ ...prev, updateStatus: 'checking' }));
        
        // In real implementation, this would call the auto-updater API
        if (window.platformBridge.autoUpdater.checkForUpdates) {
          const result = await window.platformBridge.autoUpdater.checkForUpdates();
          
          if (result.updateAvailable) {
            setElectronStatus(prev => ({ ...prev, updateStatus: 'available' }));
            addNotification({
              type: 'info',
              message: `Update available: v${result.version}`,
              duration: 5000
            });
          } else {
            setElectronStatus(prev => ({ ...prev, updateStatus: 'idle' }));
          }
        }
      } catch (error) {
        setElectronStatus(prev => ({ ...prev, updateStatus: 'error' }));
        console.error('Update check failed:', error);
      }
    };

    // Check for updates on mount and periodically
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000); // Every 30 minutes

    return () => clearInterval(interval);
  }, [addNotification, testMode]);

  // Handle update download
  const downloadUpdate = async () => {
    if (!window.platformBridge?.autoUpdater?.downloadUpdate) {
      console.warn('Update download not available');
      return;
    }

    try {
      setElectronStatus(prev => ({ ...prev, updateStatus: 'downloading', updateProgress: 0 }));
      
      // Simulate download progress
      const progressInterval = setInterval(() => {
        setElectronStatus(prev => {
          const newProgress = Math.min(prev.updateProgress + 10, 100);
          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return { ...prev, updateProgress: 100, updateStatus: 'ready' };
          }
          return { ...prev, updateProgress: newProgress };
        });
      }, 500);

      await window.platformBridge.autoUpdater.downloadUpdate();
      
      addNotification({
        type: 'success',
        message: 'Update downloaded. Restart to apply.',
        duration: 10000
      });
    } catch (error) {
      setElectronStatus(prev => ({ ...prev, updateStatus: 'error', updateProgress: 0 }));
      addNotification({
        type: 'error',
        message: 'Update download failed',
        duration: 5000
      });
    }
  };

  const installUpdate = async () => {
    if (!window.platformBridge?.autoUpdater?.quitAndInstall) {
      console.warn('Update installation not available');
      return;
    }

    try {
      await window.platformBridge.autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('Update installation failed:', error);
      addNotification({
        type: 'error',
        message: 'Failed to install update',
        duration: 5000
      });
    }
  };

  if (!electronStatus.isElectron && !testMode) {
    return null;
  }

  return (
    <div className={`electron-feature-monitor ${className}`}>
      <button
        className="monitor-toggle"
        onClick={() => setShowMonitor(!showMonitor)}
        title="Toggle Electron features monitor"
      >
        <span className="electron-icon">⚡</span>
        {!electronStatus.offlineStatus && <span className="offline-indicator">🔴</span>}
      </button>

      {showMonitor && (
        <div className="monitor-panel">
          <div className="monitor-header">
            <h3>Electron Features</h3>
            <button
              className="close-button"
              onClick={() => setShowMonitor(false)}
            >
              ✕
            </button>
          </div>

          <div className="monitor-content">
            {/* Platform Info */}
            <div className="feature-section">
              <h4>Platform Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Platform:</span>
                  <span className="info-value">{electronStatus.platform}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Version:</span>
                  <span className="info-value">{electronStatus.version}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className={`info-value ${electronStatus.offlineStatus ? 'online' : 'offline'}`}>
                    {electronStatus.offlineStatus ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Status */}
            <div className="feature-section">
              <h4>Available Features</h4>
              <div className="feature-list">
                {Object.entries(electronStatus.features).map(([feature, enabled]) => (
                  <div key={feature} className="feature-item">
                    <span className={`feature-indicator ${enabled ? 'enabled' : 'disabled'}`}>
                      {enabled ? '✅' : '❌'}
                    </span>
                    <span className="feature-name">
                      {feature.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-updater */}
            {electronStatus.features.autoUpdater && (
              <div className="feature-section">
                <h4>Auto Updater</h4>
                <div className="update-status">
                  {electronStatus.updateStatus === 'checking' && (
                    <div className="update-message">
                      <ProgressIndicator
                        indeterminate
                        size="small"
                        label="Checking for updates..."
                      />
                    </div>
                  )}
                  
                  {electronStatus.updateStatus === 'available' && (
                    <div className="update-available">
                      <p>🎉 Update available!</p>
                      <button
                        className="update-button primary"
                        onClick={downloadUpdate}
                      >
                        Download Update
                      </button>
                    </div>
                  )}
                  
                  {electronStatus.updateStatus === 'downloading' && (
                    <div className="update-downloading">
                      <ProgressIndicator
                        value={electronStatus.updateProgress}
                        showPercentage
                        label="Downloading update..."
                        size="medium"
                      />
                    </div>
                  )}
                  
                  {electronStatus.updateStatus === 'ready' && (
                    <div className="update-ready">
                      <p>✅ Update ready to install</p>
                      <button
                        className="update-button primary"
                        onClick={installUpdate}
                      >
                        Restart and Install
                      </button>
                    </div>
                  )}
                  
                  {electronStatus.updateStatus === 'idle' && (
                    <p className="update-message">✓ You're up to date!</p>
                  )}
                  
                  {electronStatus.updateStatus === 'error' && (
                    <p className="update-error">❌ Update check failed</p>
                  )}
                </div>
              </div>
            )}

            {/* Offline Mode Indicator */}
            {!electronStatus.offlineStatus && (
              <div className="offline-warning">
                <h4>⚠️ Offline Mode</h4>
                <p>You're currently offline. Some features requiring internet connection may not work:</p>
                <ul>
                  <li>Sentiment analysis API calls</li>
                  <li>Auto-update checks</li>
                  <li>Cloud synchronization</li>
                </ul>
                <p>Local features like file processing and data transformation will continue to work.</p>
              </div>
            )}

            {/* Test Mode Indicator */}
            {testMode && (
              <div className="test-mode-indicator">
                <p>🧪 Test Mode Active</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectronFeatureMonitor;