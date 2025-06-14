import React, { useEffect } from 'react';
import './App.css';
import { AppProvider, useAppContext, useAppActions } from './context/AppContext';
import { Navigation } from './components/Navigation';
import { WorkflowManager } from './components/WorkflowManager';
import { NotificationToast } from './components/NotificationToast';
import { ErrorBoundary } from './components/ErrorBoundary';

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
  const { setDatasets, addNotification } = useAppActions();

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check platform capabilities
      const bridge = window.platformBridge;
      if (!bridge) {
        addNotification({
          type: 'warning',
          title: 'Platform Bridge Not Available',
          message: 'Some features may be limited in browser mode. For full functionality, use the desktop application.'
        });
        return;
      }

      // Check backend connectivity
      try {
        await bridge.backend.getHealthStatus();
        addNotification({
          type: 'success',
          title: 'Connected',
          message: 'Successfully connected to backend services.'
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Backend Connection Failed',
          message: 'Could not connect to backend services. Please ensure the backend is running.'
        });
      }

      // Load existing datasets
      try {
        const response = await bridge.backend.getDatasets();
        if (response.success && response.data) {
          setDatasets(response.data);
        }
      } catch (error) {
        console.warn('Could not load existing datasets:', error);
      }

    } catch (error) {
      console.error('App initialization failed:', error);
      addNotification({
        type: 'error',
        title: 'Initialization Failed',
        message: 'There was an error starting the application. Please refresh the page.'
      });
    }
  };

  return (
    <div className="app">
      {/* Global loading overlay */}
      {state.loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Processing...</p>
        </div>
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

      {/* Global error display */}
      {state.error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{state.error}</span>
            <button 
              className="error-dismiss"
              onClick={() => useAppActions().setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
