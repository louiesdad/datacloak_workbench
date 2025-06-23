import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Network, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wifi,
  Database
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import './SystemHealthMonitor.css';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    free: number;
    cached: number;
  };
  disk: {
    used: number;
    total: number;
    free: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  database: {
    connections: number;
    maxConnections: number;
    queryTime: number;
    slowQueries: number;
  };
  queue: {
    depth: number;
    processing: number;
    failed: number;
    throughput: number;
  };
  uptime: number;
  timestamp: string;
}

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  cpu: 'healthy' | 'warning' | 'critical';
  memory: 'healthy' | 'warning' | 'critical';
  disk: 'healthy' | 'warning' | 'critical';
  database: 'healthy' | 'warning' | 'critical';
  queue: 'healthy' | 'warning' | 'critical';
}

interface SystemHealthMonitorProps {
  websocket?: WebSocket;
  className?: string;
}

export const SystemHealthMonitor: React.FC<SystemHealthMonitorProps> = ({ websocket, className }) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, cores: 1, loadAverage: [0, 0, 0] },
    memory: { used: 0, total: 1, free: 1, cached: 0 },
    disk: { used: 0, total: 1, free: 1 },
    network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
    database: { connections: 0, maxConnections: 100, queryTime: 0, slowQueries: 0 },
    queue: { depth: 0, processing: 0, failed: 0, throughput: 0 },
    uptime: 0,
    timestamp: new Date().toISOString()
  });
  
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    overall: 'healthy',
    cpu: 'healthy',
    memory: 'healthy',
    disk: 'healthy',
    database: 'healthy',
    queue: 'healthy'
  });
  
  const [historicalData, setHistoricalData] = useState<SystemMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Fetch system metrics from API
  const fetchSystemMetrics = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/admin/system/health');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setHealthStatus(data.status);
        
        // Update historical data (keep last 50 data points)
        setHistoricalData(prev => {
          const newData = [...prev, data.metrics].slice(-50);
          return newData;
        });
        
        // Check for alerts
        checkForAlerts(data.metrics, data.status);
      }
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for system alerts
  const checkForAlerts = (currentMetrics: SystemMetrics, status: HealthStatus) => {
    const newAlerts: string[] = [];
    
    if (status.cpu === 'critical') {
      newAlerts.push(`High CPU usage: ${currentMetrics.cpu.usage.toFixed(1)}%`);
    }
    
    if (status.memory === 'critical') {
      const memoryUsage = ((currentMetrics.memory.used / currentMetrics.memory.total) * 100).toFixed(1);
      newAlerts.push(`High memory usage: ${memoryUsage}%`);
    }
    
    if (status.disk === 'critical') {
      const diskUsage = ((currentMetrics.disk.used / currentMetrics.disk.total) * 100).toFixed(1);
      newAlerts.push(`High disk usage: ${diskUsage}%`);
    }
    
    if (status.database === 'critical') {
      newAlerts.push(`Database issues detected`);
    }
    
    if (status.queue === 'critical') {
      newAlerts.push(`High queue depth: ${currentMetrics.queue.depth} jobs`);
    }
    
    setAlerts(newAlerts);
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchSystemMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSystemMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'system:metrics_update') {
          setMetrics(message.data.metrics);
          setHealthStatus(message.data.status);
          
          // Update historical data
          setHistoricalData(prev => {
            const newData = [...prev, message.data.metrics].slice(-50);
            return newData;
          });
          
          checkForAlerts(message.data.metrics, message.data.status);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    websocket.addEventListener('message', handleMessage);
    
    return () => {
      websocket.removeEventListener('message', handleMessage);
    };
  }, [websocket]);

  // Calculate percentages
  const getPercentages = () => {
    return {
      cpu: metrics.cpu.usage,
      memory: (metrics.memory.used / metrics.memory.total) * 100,
      disk: (metrics.disk.used / metrics.disk.total) * 100,
      database: (metrics.database.connections / metrics.database.maxConnections) * 100
    };
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'outline';
      case 'critical': return 'destructive';
      default: return 'secondary';
    }
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const percentages = getPercentages();

  return (
    <div className={`system-health-monitor ${className || ''}`}>
      {/* Header */}
      <div className="health-monitor-header">
        <div className="header-left">
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Activity className="h-6 w-6" />
            <span>System Health</span>
            {getStatusIcon(healthStatus.overall)}
          </h2>
          <div className="uptime-info">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Uptime: {formatUptime(metrics.uptime)}
            </span>
          </div>
        </div>
        
        <div className="header-controls">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'text-green-600' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystemMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-800 dark:text-red-200 flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>System Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {alerts.map((alert, index) => (
                  <li key={index} className="text-red-700 dark:text-red-300 text-sm">
                    • {alert}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* System Overview Cards */}
      <div className="overview-grid">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <Cpu className="h-4 w-4" />
              <span>CPU Usage</span>
              {getStatusIcon(healthStatus.cpu)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-display">
              <span className="text-2xl font-bold">{percentages.cpu.toFixed(1)}%</span>
              <Badge variant={getStatusBadgeVariant(healthStatus.cpu)}>
                {healthStatus.cpu}
              </Badge>
            </div>
            <Progress 
              value={percentages.cpu} 
              variant={percentages.cpu >= 80 ? 'danger' : percentages.cpu >= 60 ? 'warning' : 'success'} 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {metrics.cpu.cores} cores • Load: {metrics.cpu.loadAverage[0]?.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>Memory Usage</span>
              {getStatusIcon(healthStatus.memory)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-display">
              <span className="text-2xl font-bold">{percentages.memory.toFixed(1)}%</span>
              <Badge variant={getStatusBadgeVariant(healthStatus.memory)}>
                {healthStatus.memory}
              </Badge>
            </div>
            <Progress 
              value={percentages.memory} 
              variant={percentages.memory >= 80 ? 'danger' : percentages.memory >= 60 ? 'warning' : 'success'} 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <HardDrive className="h-4 w-4" />
              <span>Disk Usage</span>
              {getStatusIcon(healthStatus.disk)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-display">
              <span className="text-2xl font-bold">{percentages.disk.toFixed(1)}%</span>
              <Badge variant={getStatusBadgeVariant(healthStatus.disk)}>
                {healthStatus.disk}
              </Badge>
            </div>
            <Progress 
              value={percentages.disk} 
              variant={percentages.disk >= 80 ? 'danger' : percentages.disk >= 60 ? 'warning' : 'success'} 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Database</span>
              {getStatusIcon(healthStatus.database)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-display">
              <span className="text-2xl font-bold">{metrics.database.connections}</span>
              <Badge variant={getStatusBadgeVariant(healthStatus.database)}>
                {healthStatus.database}
              </Badge>
            </div>
            <Progress 
              value={percentages.database} 
              variant={percentages.database >= 80 ? 'danger' : percentages.database >= 60 ? 'warning' : 'success'} 
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Connections • {metrics.database.queryTime.toFixed(2)}ms avg query
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Network className="h-5 w-5" />
            <span>Queue Status</span>
            {getStatusIcon(healthStatus.queue)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="queue-metrics">
            <div className="queue-metric">
              <span className="metric-label">Queue Depth</span>
              <span className="metric-value">{metrics.queue.depth}</span>
            </div>
            <div className="queue-metric">
              <span className="metric-label">Processing</span>
              <span className="metric-value">{metrics.queue.processing}</span>
            </div>
            <div className="queue-metric">
              <span className="metric-label">Failed</span>
              <span className="metric-value text-red-600">{metrics.queue.failed}</span>
            </div>
            <div className="queue-metric">
              <span className="metric-label">Throughput</span>
              <span className="metric-value">{metrics.queue.throughput}/min</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Charts */}
      {historicalData.length > 0 && (
        <div className="charts-section">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="charts-grid">
                {/* CPU and Memory Chart */}
                <div className="chart-item">
                  <h4 className="chart-title">CPU & Memory Usage</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cpu.usage" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name="CPU"
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={(data) => (data.memory.used / data.memory.total) * 100}
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Memory"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Queue Depth Chart */}
                <div className="chart-item">
                  <h4 className="chart-title">Queue Depth</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => format(new Date(value), 'HH:mm:ss')}
                        formatter={(value: number) => [value, 'Queue Depth']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="queue.depth" 
                        stroke="#8b5cf6" 
                        fill="#8b5cf6" 
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};