import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifications } from './NotificationToast';
import './WebSocketStatus.css';

interface WebSocketStatusProps {
  url: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  protocols?: string[];
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  compact?: boolean;
  className?: string;
}

interface ConnectionMetrics {
  connectedAt?: number;
  disconnectedAt?: number;
  messagesSent: number;
  messagesReceived: number;
  lastHeartbeat?: number;
  latency?: number;
  reconnectCount: number;
  totalUptime: number;
}

interface WebSocketState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'closed';
  error?: string;
  reconnectAttempts: number;
  metrics: ConnectionMetrics;
  lastMessage?: any;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoConnect = false,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
  heartbeatInterval = 30000,
  protocols = [],
  position = 'bottom-right',
  compact = false,
  className = ''
}) => {
  const [state, setState] = useState<WebSocketState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    metrics: {
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
      totalUptime: 0
    }
  });
  
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [messageHistory, setMessageHistory] = useState<Array<{
    type: 'sent' | 'received';
    data: any;
    timestamp: number;
  }>>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { addNotification } = useNotifications();

  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateMetrics = useCallback((updates: Partial<ConnectionMetrics>) => {
    setState(prev => ({
      ...prev,
      metrics: { ...prev.metrics, ...updates }
    }));
  }, []);

  const addToMessageHistory = useCallback((type: 'sent' | 'received', data: any) => {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };
    setMessageHistory(prev => [...prev.slice(-99), message]); // Keep last 100 messages
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (uptimeIntervalRef.current) {
      clearInterval(uptimeIntervalRef.current);
      uptimeIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatInterval > 0) {
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const heartbeatStart = Date.now();
          sendMessage({ type: 'heartbeat', timestamp: heartbeatStart });
          updateMetrics({ lastHeartbeat: heartbeatStart });
        }
      }, heartbeatInterval);
    }
  }, [heartbeatInterval, updateMetrics]);

  const startUptimeTracking = useCallback(() => {
    uptimeIntervalRef.current = setInterval(() => {
      if (state.status === 'connected' && state.metrics.connectedAt) {
        const uptime = Date.now() - state.metrics.connectedAt;
        updateMetrics({ totalUptime: uptime });
      }
    }, 1000);
  }, [state.status, state.metrics.connectedAt, updateMetrics]);

  const connect = useCallback(() => {
    cleanup();
    
    updateState({ status: 'connecting', error: undefined });
    
    try {
      const ws = protocols.length > 0 
        ? new WebSocket(url, protocols)
        : new WebSocket(url);
      
      wsRef.current = ws;

      ws.onopen = () => {
        const now = Date.now();
        updateState({ status: 'connected' });
        updateMetrics({ 
          connectedAt: now,
          reconnectCount: state.reconnectAttempts > 0 ? state.metrics.reconnectCount + 1 : 0
        });
        setState(prev => ({ ...prev, reconnectAttempts: 0 }));
        
        addNotification({
          type: 'success',
          message: 'WebSocket connection established',
          duration: 3000
        });

        startHeartbeat();
        startUptimeTracking();
        
        if (onConnect) {
          onConnect();
        }
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          data = event.data;
        }

        // Handle heartbeat response
        if (data.type === 'heartbeat_response' && data.timestamp) {
          const latency = Date.now() - data.timestamp;
          updateMetrics({ latency });
        }

        updateMetrics({ 
          messagesReceived: state.metrics.messagesReceived + 1,
          lastMessage: data
        });
        
        addToMessageHistory('received', data);
        
        // Emit custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('websocket:message', { detail: data }));
        
        if (onMessage) {
          onMessage(data);
        }
      };

      ws.onclose = (event) => {
        const now = Date.now();
        updateState({ status: 'closed' });
        updateMetrics({ disconnectedAt: now });
        
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        if (uptimeIntervalRef.current) {
          clearInterval(uptimeIntervalRef.current);
        }

        if (onDisconnect) {
          onDisconnect();
        }

        // Auto-reconnect if not intentionally closed
        if (event.code !== 1000 && state.reconnectAttempts < reconnectAttempts) {
          addNotification({
            type: 'warning',
            message: `Connection lost. Reconnecting... (${state.reconnectAttempts + 1}/${reconnectAttempts})`,
            duration: 3000
          });
          
          setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (state.reconnectAttempts >= reconnectAttempts) {
          updateState({ status: 'error', error: 'Max reconnection attempts reached' });
          addNotification({
            type: 'error',
            message: 'WebSocket connection failed permanently',
            duration: 5000
          });
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateState({ status: 'error', error: 'Connection error' });
        
        if (onError) {
          onError(error);
        }
      };

    } catch (error) {
      updateState({ status: 'error', error: 'Failed to create WebSocket connection' });
      console.error('WebSocket creation error:', error);
    }
  }, [url, protocols, state.reconnectAttempts, state.metrics, reconnectAttempts, reconnectInterval, addNotification, cleanup, startHeartbeat, startUptimeTracking, onConnect, onMessage, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    cleanup();
    updateState({ status: 'disconnected', reconnectAttempts: 0 });
    updateMetrics({ disconnectedAt: Date.now() });
  }, [cleanup, updateState, updateMetrics]);

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
      updateMetrics({ messagesSent: state.metrics.messagesSent + 1 });
      addToMessageHistory('sent', data);
      return true;
    }
    return false;
  }, [state.metrics.messagesSent, updateMetrics, addToMessageHistory]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [autoConnect, connect, cleanup]);

  const getStatusColor = () => {
    switch (state.status) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'closed': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getStatusIcon = () => {
    switch (state.status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      case 'closed': return '⚫';
      default: return '⚪';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const renderCompactView = () => (
    <div 
      className="websocket-status-compact"
      onClick={() => setIsExpanded(true)}
      style={{ borderColor: getStatusColor() }}
      data-testid="websocket-status-compact"
    >
      <div className="status-icon">
        {getStatusIcon()}
      </div>
      <div className="status-text">
        WS {state.status.toUpperCase()}
      </div>
    </div>
  );

  const renderFullView = () => (
    <div className="websocket-status-panel" data-testid="websocket-status-panel">
      <div className="status-header">
        <div className="header-left">
          <h4>WebSocket Connection</h4>
          <div className="connection-info" data-testid="websocket-connection-info">
            <span 
              className="status-indicator"
              style={{ color: getStatusColor() }}
            >
              {getStatusIcon()} {state.status.toUpperCase()}
            </span>
            {state.metrics.connectedAt && state.status === 'connected' && (
              <span className="uptime">
                Uptime: {formatDuration(state.metrics.totalUptime)}
              </span>
            )}
          </div>
        </div>
        
        <div className="header-actions">
          {compact && (
            <button
              className="collapse-button"
              onClick={() => setIsExpanded(false)}
              data-testid="collapse-websocket-status"
            >
              ➖
            </button>
          )}
          
          {state.status !== 'connected' ? (
            <button
              className="connect-button"
              onClick={connect}
              disabled={state.status === 'connecting'}
              data-testid="connect-websocket"
            >
              {state.status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              className="disconnect-button"
              onClick={disconnect}
              data-testid="disconnect-websocket"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="connection-metrics" data-testid="connection-metrics">
        <div className="metrics-grid">
          <div className="metric-item">
            <span className="metric-label">Messages Sent:</span>
            <span className="metric-value">{state.metrics.messagesSent}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Messages Received:</span>
            <span className="metric-value">{state.metrics.messagesReceived}</span>
          </div>
          {state.metrics.latency !== undefined && (
            <div className="metric-item">
              <span className="metric-label">Latency:</span>
              <span className="metric-value">{state.metrics.latency}ms</span>
            </div>
          )}
          <div className="metric-item">
            <span className="metric-label">Reconnects:</span>
            <span className="metric-value">{state.metrics.reconnectCount}</span>
          </div>
        </div>
      </div>

      {state.error && (
        <div className="error-display" data-testid="websocket-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{state.error}</span>
          {state.reconnectAttempts < reconnectAttempts && (
            <span className="retry-info">
              Retry {state.reconnectAttempts}/{reconnectAttempts}
            </span>
          )}
        </div>
      )}

      {messageHistory.length > 0 && (
        <div className="message-history" data-testid="message-history">
          <h5>Recent Messages ({messageHistory.length}):</h5>
          <div className="history-list">
            {messageHistory.slice(-5).reverse().map((msg, index) => (
              <div key={index} className={`message-item ${msg.type}`}>
                <div className="message-type">
                  {msg.type === 'sent' ? '📤' : '📥'}
                </div>
                <div className="message-content">
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="message-data">
                    {typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div 
      className={`websocket-status ${position} ${className}`}
      data-testid="websocket-status"
    >
      {isExpanded ? renderFullView() : renderCompactView()}
    </div>
  );
};

export default WebSocketStatus;