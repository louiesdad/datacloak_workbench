import React, { useEffect } from 'react';
import './App.css';
import { AppProvider, useAppContext, useAppActions } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { WorkflowManager } from './components/WorkflowManager';
import { NotificationToast } from './components/NotificationToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProgressIndicator } from './components/ProgressIndicator';
import { RealTimeDashboard } from './components/RealTimeDashboard';
import { AdminDashboard } from './components/admin';

// Main App component wrapped with providers
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  );
}

// App shell component that uses context
const AppShell: React.FC = () => {
  const { state } = useAppContext();
  const { setDatasets, addNotification, setError } = useAppActions();
  const [initialized, setInitialized] = React.useState(false);
  const [backendStatus, setBackendStatus] = React.useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [showAdvancedFeatures, setShowAdvancedFeatures] = React.useState(false);
  const [showAdminPanel, setShowAdminPanel] = React.useState(false);

  // Initialize app on mount with proper cleanup
  useEffect(() => {
    let mounted = true;
    let hasShownConnectionError = false;

    const initializeApp = async () => {
      // Skip if already initialized or component unmounted
      if (!mounted || initialized) return;

      try {
        // Check platform capabilities
        const bridge = window.platformBridge;
        if (!bridge) {
          // Only show warning in production or if not already shown
          if (!hasShownConnectionError) {
            addNotification({
              type: 'warning',
              title: 'Platform Bridge Not Available',
              message: 'Some features may be limited in browser mode. For full functionality, use the desktop application.'
            });
            hasShownConnectionError = true;
          }
          setBackendStatus('disconnected');
          setInitialized(true);
          return;
        }

        // Check backend connectivity - but don't show duplicate errors
        if (bridge.backend?.getHealthStatus) {
          try {
            await bridge.backend.getHealthStatus();
            if (mounted) {
              setBackendStatus('connected');
              // Only show success message once
              if (!initialized) {
                console.log('Backend connected successfully');
              }
            }
          } catch (error) {
            if (mounted) {
              setBackendStatus('error');
              // Only show error once and in a more subtle way
              if (!hasShownConnectionError) {
                console.warn('Backend connection failed:', error);
                // For development, just log instead of showing error
                console.log('Using mock data mode.');
                hasShownConnectionError = true;
              }
            }
          }
        } else {
          // No backend available - set status silently
          setBackendStatus('disconnected');
        }

        // Load existing datasets (if backend is available)
        if (backendStatus === 'connected') {
          try {
            const response = await bridge.backend.getDatasets();
            if (mounted && response.success && response.data) {
              setDatasets(response.data);
            }
          } catch (error) {
            console.warn('Could not load existing datasets:', error);
          }
        }

        if (mounted) {
          setInitialized(true);
        }

      } catch (error) {
        console.error('App initialization failed:', error);
        if (mounted && !hasShownConnectionError) {
          setError('Application initialization failed. Some features may be limited.');
          hasShownConnectionError = true;
        }
      }
    };

    // Small delay to prevent React StrictMode double-initialization issues
    const timeoutId = setTimeout(initializeApp, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array - only run once

  // Clear error after a delay
  useEffect(() => {
    if (state.error && backendStatus === 'error') {
      const timer = setTimeout(() => {
        setError(null);
      }, 10000); // Clear after 10 seconds
      return () => clearTimeout(timer);
    }
  }, [state.error, backendStatus]);

  // Listen for advanced features toggle event
  useEffect(() => {
    const handleShowAdvancedFeatures = () => {
      setShowAdvancedFeatures(true);
    };

    window.addEventListener('show-advanced-features', handleShowAdvancedFeatures);

    return () => {
      window.removeEventListener('show-advanced-features', handleShowAdvancedFeatures);
    };
  }, []);

  // Listen for admin panel toggle event
  useEffect(() => {
    const handleShowAdminPanel = () => {
      setShowAdminPanel(true);
    };

    window.addEventListener('show-admin-panel', handleShowAdminPanel);

    return () => {
      window.removeEventListener('show-admin-panel', handleShowAdminPanel);
    };
  }, []);

  return (
    <div className="app">
      {/* Global loading overlay */}
      {state.loading && (
        <ProgressIndicator
          variant="overlay"
          indeterminate
          message="Processing..."
          testId="global-loading"
        />
      )}

      {/* Navigation sidebar */}
      <aside className="app-sidebar">
        <Navigation />
      </aside>

      {/* Main content area */}
      <main className="app-main">
        <WorkflowManager />
      </main>

      {/* Notification toasts */}
      <NotificationToast />

      {/* Global error display - only show user-facing errors, not backend connection */}
      {state.error && backendStatus !== 'error' && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{state.error}</span>
            <button 
              className="error-dismiss"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Advanced Features Dashboard - Modal overlay */}
      {showAdvancedFeatures && (
        <div className="advanced-features-modal" data-testid="advanced-features-modal">
          <div className="modal-backdrop" onClick={() => setShowAdvancedFeatures(false)} />
          <div className="modal-content">
            <button 
              className="modal-close"
              onClick={() => setShowAdvancedFeatures(false)}
              data-testid="close-advanced-features"
              aria-label="Close advanced features"
            >
              ×
            </button>
            <RealTimeDashboard />
          </div>
        </div>
      )}

      {/* Admin Panel - Modal overlay */}
      {showAdminPanel && (
        <div className="admin-panel-modal" data-testid="admin-panel-modal">
          <div className="modal-backdrop" onClick={() => setShowAdminPanel(false)} />
          <div className="modal-content admin-modal">
            <button 
              className="modal-close"
              onClick={() => setShowAdminPanel(false)}
              data-testid="close-admin-panel"
              aria-label="Close admin panel"
            >
              ×
            </button>
            <AdminDashboard />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
