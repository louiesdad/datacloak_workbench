import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wifi, WifiOff, Activity, Clock, Database, Server } from 'lucide-react';

interface ConnectionStatus {
  isConnected: boolean;
  lastConnected: string | null;
  lastDisconnected: string | null;
  connectionCount: number;
  uptime: number;
  latency: number | null;
  serverStatus: 'healthy' | 'degraded' | 'down';
  services: {
    database: 'connected' | 'disconnected' | 'error';
    websocket: 'connected' | 'disconnected' | 'error';
    analytics: 'running' | 'stopped' | 'error';
    sentiment: 'running' | 'stopped' | 'error';
  };
  errors: string[];
}

interface ConnectionStatusIndicatorProps {
  wsUrl?: string;
  refreshInterval?: number;
  compact?: boolean;
  className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  wsUrl = 'ws://localhost:3001/ws',
  refreshInterval = 10000,
  compact = false,
  className = ''
}) => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string; latency: number }>>([]);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          // Subscribe to connection status updates
          ws?.send(JSON.stringify({
            type: 'subscribe',
            topic: 'connection_status'
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'connection_status') {
              setStatus(message.data);
              
              // Update latency history if available
              if (message.data.latency !== null) {
                setLatencyHistory(prev => {
                  const newEntry = {
                    time: new Date().toLocaleTimeString(),
                    latency: message.data.latency
                  };
                  return [...prev.slice(-19), newEntry]; // Keep last 20 entries
                });
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };

      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [wsUrl]);

  // Fallback to polling if WebSocket fails
  useEffect(() => {
    if (wsConnected) return;

    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/v1/connection/status');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setStatus(result.data);
            
            if (result.data.latency !== null) {
              setLatencyHistory(prev => {
                const newEntry = {
                  time: new Date().toLocaleTimeString(),
                  latency: result.data.latency
                };
                return [...prev.slice(-19), newEntry];
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch connection status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [wsConnected, refreshInterval]);

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'database': return <Database className="service-icon" />;
      case 'websocket': return <Wifi className="service-icon" />;
      case 'analytics': return <Activity className="service-icon" />;
      case 'sentiment': return <Server className="service-icon" />;
      default: return <Activity className="service-icon" />;
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'running': return '#10b981';
      case 'disconnected':
      case 'stopped': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (!status) {
    return (
      <div className={`connection-status-indicator loading ${className}`}>
        <div className="status-header">
          <WifiOff className="status-icon" />
          <span>Connecting...</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`connection-status-indicator compact ${className}`}>
        <div className={`status-dot ${status.serverStatus}`} title={`Server Status: ${status.serverStatus}`} />
        <span className="latency-text">
          {status.latency !== null ? `${status.latency}ms` : 'N/A'}
        </span>
        {wsConnected ? (
          <Wifi className="connection-icon connected" title="WebSocket Connected" />
        ) : (
          <WifiOff className="connection-icon disconnected" title="WebSocket Disconnected" />
        )}
      </div>
    );
  }

  return (
    <div className={`connection-status-indicator full ${className}`}>
      <div className="status-header">
        <div className="connection-info">
          {wsConnected ? (
            <Wifi className="status-icon connected" />
          ) : (
            <WifiOff className="status-icon disconnected" />
          )}
          <div className="status-text">
            <div className="status-title">
              Connection Status: {status.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="status-subtitle">
              Server: {status.serverStatus} | 
              Uptime: {formatUptime(status.uptime)} | 
              Latency: {status.latency !== null ? `${status.latency}ms` : 'N/A'}
            </div>
          </div>
        </div>
        
        <div className="connection-stats">
          <div className="stat-item">
            <Clock className="stat-icon" />
            <span>Connections: {status.connectionCount}</span>
          </div>
        </div>
      </div>

      <div className="services-grid">
        {Object.entries(status.services).map(([service, serviceStatus]) => (
          <div key={service} className="service-item">
            <div className="service-header">
              {getServiceIcon(service)}
              <span className="service-name">{service}</span>
            </div>
            <div 
              className="service-status"
              style={{ color: getServiceStatusColor(serviceStatus) }}
            >
              <div 
                className="service-indicator"
                style={{ backgroundColor: getServiceStatusColor(serviceStatus) }}
              />
              {serviceStatus}
            </div>
          </div>
        ))}
      </div>

      {latencyHistory.length > 5 && (
        <div className="latency-chart">
          <h4>Latency Trend</h4>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={latencyHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`${value}ms`, 'Latency']} />
              <Line 
                type="monotone" 
                dataKey="latency" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 1, r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {status.errors.length > 0 && (
        <div className="error-list">
          <h4>Recent Errors</h4>
          <div className="errors">
            {status.errors.slice(-5).map((error, index) => (
              <div key={index} className="error-item">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};