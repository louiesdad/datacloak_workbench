import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProgressIndicator } from './ProgressIndicator';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useNotifications } from './NotificationToast';
import './SSEProgressIndicator.css';

interface SSEProgressIndicatorProps {
  endpoint: string;
  onProgress?: (data: SSEProgressData) => void;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
  autoStart?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  className?: string;
}

interface SSEProgressData {
  type: 'progress' | 'status' | 'complete' | 'error';
  stage: string;
  percentage: number;
  message: string;
  details?: any;
  timestamp: number;
}

interface SSEConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'closed';
  lastConnected?: number;
  reconnectAttempts: number;
  error?: string;
}

export const SSEProgressIndicator: React.FC<SSEProgressIndicatorProps> = ({
  endpoint,
  onProgress,
  onComplete,
  onError,
  autoStart = false,
  reconnectAttempts = 3,
  reconnectInterval = 5000,
  className = ''
}) => {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  });
  const [progressData, setProgressData] = useState<SSEProgressData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [eventHistory, setEventHistory] = useState<SSEProgressData[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { addNotification } = useNotifications();

  const updateConnectionState = useCallback((updates: Partial<SSEConnectionState>) => {
    setConnectionState(prev => ({ ...prev, ...updates }));
  }, []);

  const addToHistory = useCallback((data: SSEProgressData) => {
    setEventHistory(prev => [...prev.slice(-49), data]); // Keep last 50 events
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleReconnect = useCallback(() => {
    if (connectionState.reconnectAttempts >= reconnectAttempts) {
      updateConnectionState({ status: 'error', error: 'Max reconnection attempts reached' });
      return;
    }

    updateConnectionState({ 
      status: 'connecting',
      reconnectAttempts: connectionState.reconnectAttempts + 1
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      // Use a ref to avoid circular dependency
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      connect();
    }, reconnectInterval);
  }, [connectionState.reconnectAttempts, reconnectAttempts, reconnectInterval, updateConnectionState]);

  const connect = useCallback(() => {
    cleanup();
    
    updateConnectionState({ status: 'connecting' });
    
    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        updateConnectionState({ 
          status: 'connected',
          lastConnected: Date.now(),
          reconnectAttempts: 0,
          error: undefined
        });
        
        addNotification({
          type: 'success',
          message: 'Real-time connection established',
          duration: 3000
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEProgressData = JSON.parse(event.data);
          setProgressData(data);
          addToHistory(data);
          
          if (onProgress) {
            onProgress(data);
          }

          if (data.type === 'complete') {
            if (onComplete) {
              onComplete(data.details);
            }
            setIsActive(false);
            cleanup();
            updateConnectionState({ status: 'closed' });
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        updateConnectionState({ status: 'error', error: 'Connection failed' });
        
        // Use state to check reconnect attempts instead of callback dependency
        setConnectionState(prevState => {
          if (prevState.reconnectAttempts < reconnectAttempts) {
            addNotification({
              type: 'warning',
              message: `Connection lost. Retrying... (${prevState.reconnectAttempts + 1}/${reconnectAttempts})`,
              duration: 3000
            });
            
            // Schedule reconnection without circular dependency
            setTimeout(() => {
              handleReconnect();
            }, reconnectInterval);
          } else {
            addNotification({
              type: 'error',
              message: 'Real-time connection failed permanently',
              duration: 5000
            });
            
            if (onError) {
              onError(new Error('SSE connection failed'));
            }
          }
          return prevState;
        });
      };

      // Custom event listeners for different progress types
      eventSource.addEventListener('progress', (event) => {
        try {
          const data: SSEProgressData = JSON.parse(event.data);
          setProgressData(data);
          addToHistory(data);
          if (onProgress) onProgress(data);
        } catch (error) {
          console.error('Failed to parse progress event:', error);
        }
      });

      eventSource.addEventListener('status', (event) => {
        try {
          const data: SSEProgressData = JSON.parse(event.data);
          addToHistory(data);
          if (onProgress) onProgress(data);
        } catch (error) {
          console.error('Failed to parse status event:', error);
        }
      });

    } catch (error) {
      updateConnectionState({ status: 'error', error: 'Failed to create connection' });
      if (onError) {
        onError(error);
      }
    }
  }, [endpoint, onProgress, onComplete, onError, reconnectAttempts, reconnectInterval, addNotification, cleanup, addToHistory, updateConnectionState]);

  const startMonitoring = useCallback(() => {
    setIsActive(true);
    setProgressData(null);
    setEventHistory([]);
    connect();
  }, [connect]);

  const stopMonitoring = useCallback(() => {
    setIsActive(false);
    cleanup();
    updateConnectionState({ status: 'disconnected', reconnectAttempts: 0 });
  }, [cleanup, updateConnectionState]);

  useEffect(() => {
    if (autoStart) {
      startMonitoring();
    }

    return cleanup;
  }, [autoStart]);

  const getConnectionStatusColor = () => {
    switch (connectionState.status) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'closed': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionState.status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      case 'closed': return '⚫';
      default: return '⚪';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className={`sse-progress-indicator ${className}`} data-testid="sse-progress-indicator">
      <div className="sse-header">
        <div className="header-left">
          <h4>Real-time Progress Monitor</h4>
          <div className="connection-status" data-testid="connection-status">
            <span 
              className="status-indicator"
              style={{ color: getConnectionStatusColor() }}
            >
              {getConnectionStatusIcon()} {connectionState.status.toUpperCase()}
            </span>
            {connectionState.lastConnected && (
              <span className="last-connected">
                Connected: {formatTimestamp(connectionState.lastConnected)}
              </span>
            )}
          </div>
        </div>
        
        <div className="header-actions">
          <button
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
            data-testid="toggle-sse-details"
          >
            {showDetails ? '▼' : '▶'} Details
          </button>
          
          {!isActive ? (
            <button
              className="start-button"
              onClick={startMonitoring}
              data-testid="start-sse-monitoring"
            >
              Start Monitoring
            </button>
          ) : (
            <button
              className="stop-button"
              onClick={stopMonitoring}
              data-testid="stop-sse-monitoring"
            >
              Stop Monitoring
            </button>
          )}
        </div>
      </div>

      {progressData && (
        <div className="current-progress" data-testid="current-progress">
          <ProgressIndicator
            value={progressData.percentage}
            label={progressData.message}
            showPercentage
            size="large"
            className={`progress-${progressData.type}`}
            testId="sse-progress-bar"
          />
          
          <div className="progress-info">
            <div className="progress-stage" data-testid="progress-stage">
              Stage: {progressData.stage}
            </div>
            <div className="progress-timestamp">
              {formatTimestamp(progressData.timestamp)}
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <div className="sse-details" data-testid="sse-details">
          <div className="details-header">
            <h5>Connection Details</h5>
            <div className="connection-info">
              <div>Endpoint: {endpoint}</div>
              <div>Reconnect Attempts: {connectionState.reconnectAttempts}/{reconnectAttempts}</div>
              {connectionState.error && (
                <div className="error-info">Error: {connectionState.error}</div>
              )}
            </div>
          </div>

          {eventHistory.length > 0 && (
            <div className="event-history" data-testid="event-history">
              <h6>Event History ({eventHistory.length} events):</h6>
              <div className="history-list">
                {eventHistory.slice(-10).reverse().map((event, index) => (
                  <div key={index} className={`history-item ${event.type}`}>
                    <div className="event-time">{formatTimestamp(event.timestamp)}</div>
                    <div className="event-content">
                      <div className="event-type">{event.type.toUpperCase()}</div>
                      <div className="event-stage">{event.stage}</div>
                      <div className="event-message">{event.message}</div>
                      {event.percentage > 0 && (
                        <div className="event-percentage">{event.percentage.toFixed(1)}%</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isActive && connectionState.status === 'error' && (
            <div className="reconnection-controls" data-testid="reconnection-controls">
              <button
                className="retry-button"
                onClick={connect}
                disabled={connectionState.status === 'connecting'}
                data-testid="retry-connection"
              >
                {connectionState.status === 'connecting' ? 'Connecting...' : 'Retry Connection'}
              </button>
            </div>
          )}
        </div>
      )}

      {connectionState.status === 'error' && connectionState.error && (
        <ApiErrorDisplay
          error={new Error(connectionState.error)}
          context="SSE Connection"
          onRetry={connect}
          onDismiss={() => updateConnectionState({ error: undefined })}
          showDetails={false}
        />
      )}
    </div>
  );
};

export default SSEProgressIndicator;