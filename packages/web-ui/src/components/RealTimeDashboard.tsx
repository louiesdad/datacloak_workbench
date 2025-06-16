import React, { useState, useCallback } from 'react';
import { MemoryMonitor } from './MemoryMonitor';
import { SSEProgressIndicator } from './SSEProgressIndicator';
import { WebSocketStatus } from './WebSocketStatus';
import { RealTimeSentimentFeed } from './RealTimeSentimentFeed';
import { useNotifications } from './NotificationToast';
import './RealTimeDashboard.css';

interface RealTimeDashboardProps {
  sseEndpoint?: string;
  websocketUrl?: string;
  showMemoryMonitor?: boolean;
  showSSEProgress?: boolean;
  showWebSocketStatus?: boolean;
  showSentimentFeed?: boolean;
  autoStart?: boolean;
  position?: 'floating' | 'inline';
  className?: string;
}

interface DashboardState {
  isCollapsed: boolean;
  activePanel: 'memory' | 'sse' | 'websocket' | 'sentiment' | 'all';
  sseData: any;
  wsData: any;
  memoryAlerts: number;
}

export const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({
  sseEndpoint = '/api/v1/sse/progress',
  websocketUrl = 'ws://localhost:8000/ws',
  showMemoryMonitor = true,
  showSSEProgress = true,
  showWebSocketStatus = true,
  showSentimentFeed = true,
  autoStart = false,
  position = 'floating',
  className = ''
}) => {
  const [state, setState] = useState<DashboardState>({
    isCollapsed: false,
    activePanel: 'all',
    sseData: null,
    wsData: null,
    memoryAlerts: 0
  });
  
  const { addNotification } = useNotifications();

  const updateState = useCallback((updates: Partial<DashboardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSSEProgress = useCallback((data: any) => {
    updateState({ sseData: data });
    
    if (data.type === 'error') {
      addNotification({
        type: 'error',
        message: `SSE Error: ${data.message}`,
        duration: 5000
      });
    } else if (data.type === 'complete') {
      addNotification({
        type: 'success',
        message: 'Real-time operation completed successfully',
        duration: 4000
      });
    }
  }, [updateState, addNotification]);

  const handleSSEComplete = useCallback((result: any) => {
    addNotification({
      type: 'success',
      message: 'Background operation completed',
      duration: 4000
    });
  }, [addNotification]);

  const handleSSEError = useCallback((error: any) => {
    addNotification({
      type: 'error',
      message: 'Real-time connection error',
      duration: 5000
    });
  }, [addNotification]);

  const handleWebSocketMessage = useCallback((data: any) => {
    updateState({ wsData: data });
    
    // Handle specific message types
    if (data.type === 'notification') {
      addNotification({
        type: data.level || 'info',
        message: data.message,
        duration: data.duration || 4000
      });
    }
  }, [updateState, addNotification]);

  const handleWebSocketConnect = useCallback(() => {
    addNotification({
      type: 'success',
      message: 'Real-time connection established',
      duration: 3000
    });
  }, [addNotification]);

  const handleWebSocketDisconnect = useCallback(() => {
    addNotification({
      type: 'warning',
      message: 'Real-time connection lost',
      duration: 4000
    });
  }, [addNotification]);

  const getActiveComponents = () => {
    const components = [];
    
    if (showMemoryMonitor) components.push('memory');
    if (showSSEProgress) components.push('sse');
    if (showWebSocketStatus) components.push('websocket');
    if (showSentimentFeed) components.push('sentiment');
    
    return components;
  };

  const renderPanel = () => {
    const activeComponents = getActiveComponents();
    
    if (activeComponents.length === 0) {
      return (
        <div className="empty-dashboard" data-testid="empty-dashboard">
          <div className="empty-icon">📊</div>
          <h3>Real-time Dashboard</h3>
          <p>No real-time components enabled</p>
        </div>
      );
    }

    return (
      <div className="dashboard-content" data-testid="dashboard-content">
        {state.activePanel === 'all' && (
          <div className="dashboard-grid">
            {showMemoryMonitor && (
              <div className="dashboard-section memory-section">
                <h4>Memory Monitoring</h4>
                <MemoryMonitor
                  compact={true}
                  showHistory={true}
                  showRecommendations={true}
                  position="inline"
                />
              </div>
            )}
            
            {showSSEProgress && (
              <div className="dashboard-section sse-section">
                <h4>Progress Monitoring</h4>
                <SSEProgressIndicator
                  endpoint={sseEndpoint}
                  onProgress={handleSSEProgress}
                  onComplete={handleSSEComplete}
                  onError={handleSSEError}
                  autoStart={autoStart}
                  reconnectAttempts={3}
                />
              </div>
            )}
            
            {showWebSocketStatus && (
              <div className="dashboard-section websocket-section">
                <h4>Connection Status</h4>
                <WebSocketStatus
                  url={websocketUrl}
                  onMessage={handleWebSocketMessage}
                  onConnect={handleWebSocketConnect}
                  onDisconnect={handleWebSocketDisconnect}
                  autoConnect={autoStart}
                  position="inline"
                  compact={false}
                />
              </div>
            )}
            
            {showSentimentFeed && (
              <div className="dashboard-section sentiment-section">
                <h4>Live Sentiment Analysis</h4>
                <RealTimeSentimentFeed
                  maxItems={25}
                  autoScroll={true}
                  showDetails={true}
                />
              </div>
            )}
          </div>
        )}
        
        {state.activePanel === 'memory' && showMemoryMonitor && (
          <div className="single-panel">
            <MemoryMonitor
              compact={false}
              showHistory={true}
              showRecommendations={true}
              position="inline"
            />
          </div>
        )}
        
        {state.activePanel === 'sse' && showSSEProgress && (
          <div className="single-panel">
            <SSEProgressIndicator
              endpoint={sseEndpoint}
              onProgress={handleSSEProgress}
              onComplete={handleSSEComplete}
              onError={handleSSEError}
              autoStart={autoStart}
              reconnectAttempts={5}
            />
          </div>
        )}
        
        {state.activePanel === 'websocket' && showWebSocketStatus && (
          <div className="single-panel">
            <WebSocketStatus
              url={websocketUrl}
              onMessage={handleWebSocketMessage}
              onConnect={handleWebSocketConnect}
              onDisconnect={handleWebSocketDisconnect}
              autoConnect={autoStart}
              position="inline"
              compact={false}
            />
          </div>
        )}
        
        {state.activePanel === 'sentiment' && showSentimentFeed && (
          <div className="single-panel">
            <RealTimeSentimentFeed
              maxItems={50}
              autoScroll={true}
              showDetails={true}
            />
          </div>
        )}
      </div>
    );
  };

  const getStatusSummary = () => {
    const activeComponents = getActiveComponents();
    let connectedCount = 0;
    let totalCount = activeComponents.length;
    
    // This would be determined by actual component states
    // For now, we'll use placeholder logic
    if (showWebSocketStatus) connectedCount++;
    if (showSSEProgress) connectedCount++;
    
    return { connectedCount, totalCount };
  };

  const statusSummary = getStatusSummary();

  return (
    <div 
      className={`realtime-dashboard ${position} ${state.isCollapsed ? 'collapsed' : ''} ${className}`}
      data-testid="realtime-dashboard"
    >
      <div className="dashboard-header" data-testid="dashboard-header">
        <div className="header-left">
          <div className="dashboard-title">
            <span className="title-icon">📡</span>
            <h3>Real-time Dashboard</h3>
          </div>
          
          <div className="status-summary" data-testid="status-summary">
            <span className="connection-status">
              {statusSummary.connectedCount}/{statusSummary.totalCount} connected
            </span>
            {state.memoryAlerts > 0 && (
              <span className="alert-count">
                ⚠️ {state.memoryAlerts} alerts
              </span>
            )}
          </div>
        </div>
        
        <div className="header-actions">
          {getActiveComponents().length > 1 && (
            <div className="panel-selector" data-testid="panel-selector">
              <button
                className={`panel-button ${state.activePanel === 'all' ? 'active' : ''}`}
                onClick={() => updateState({ activePanel: 'all' })}
                data-testid="panel-all"
              >
                All
              </button>
              {showMemoryMonitor && (
                <button
                  className={`panel-button ${state.activePanel === 'memory' ? 'active' : ''}`}
                  onClick={() => updateState({ activePanel: 'memory' })}
                  data-testid="panel-memory"
                >
                  Memory
                </button>
              )}
              {showSSEProgress && (
                <button
                  className={`panel-button ${state.activePanel === 'sse' ? 'active' : ''}`}
                  onClick={() => updateState({ activePanel: 'sse' })}
                  data-testid="panel-sse"
                >
                  Progress
                </button>
              )}
              {showWebSocketStatus && (
                <button
                  className={`panel-button ${state.activePanel === 'websocket' ? 'active' : ''}`}
                  onClick={() => updateState({ activePanel: 'websocket' })}
                  data-testid="panel-websocket"
                >
                  Connection
                </button>
              )}
              {showSentimentFeed && (
                <button
                  className={`panel-button ${state.activePanel === 'sentiment' ? 'active' : ''}`}
                  onClick={() => updateState({ activePanel: 'sentiment' })}
                  data-testid="panel-sentiment"
                >
                  Sentiment
                </button>
              )}
            </div>
          )}
          
          <button
            className="collapse-button"
            onClick={() => updateState({ isCollapsed: !state.isCollapsed })}
            title={state.isCollapsed ? 'Expand dashboard' : 'Collapse dashboard'}
            data-testid="toggle-dashboard"
          >
            {state.isCollapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>
      
      {!state.isCollapsed && renderPanel()}
    </div>
  );
};

export default RealTimeDashboard;