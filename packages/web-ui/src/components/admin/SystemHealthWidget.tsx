import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';

interface SystemHealthWidgetProps {
  className?: string;
  compact?: boolean;
  websocket?: WebSocket | null;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  queueDepth: number;
  activeJobs: number;
  failedJobs: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({ 
  className = '', 
  compact = false,
  websocket 
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    disk: 0,
    queueDepth: 0,
    activeJobs: 0,
    failedJobs: 0,
    status: 'healthy',
    timestamp: new Date()
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch system health metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/system/health');
      if (!response.ok) {
        throw new Error('Failed to fetch system health');
      }
      
      const data = await response.json();
      
      // Calculate overall health status
      const status = calculateHealthStatus(data);
      
      setMetrics({
        cpu: data.cpu || 0,
        memory: data.memory || 0,
        disk: data.disk || 0,
        queueDepth: data.queue?.depth || 0,
        activeJobs: data.queue?.processing || 0,
        failedJobs: data.queue?.failed || 0,
        status,
        timestamp: new Date()
      });
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch system health:', err);
      setError('Failed to load system health');
      setLoading(false);
    }
  };

  // Calculate overall health status based on metrics
  const calculateHealthStatus = (data: any): 'healthy' | 'warning' | 'critical' => {
    const { cpu = 0, memory = 0, disk = 0, queue = {} } = data;
    const { failed = 0, depth = 0 } = queue;
    
    // Critical thresholds
    if (cpu > 90 || memory > 90 || disk > 95 || failed > 10) {
      return 'critical';
    }
    
    // Warning thresholds
    if (cpu > 75 || memory > 75 || disk > 85 || failed > 5 || depth > 50) {
      return 'warning';
    }
    
    return 'healthy';
  };

  // WebSocket message handler
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'system:health' || message.type === 'system:metrics') {
          const data = message.data;
          const status = calculateHealthStatus(data);
          
          setMetrics({
            cpu: data.cpu || 0,
            memory: data.memory || 0,
            disk: data.disk || 0,
            queueDepth: data.queue?.depth || 0,
            activeJobs: data.queue?.processing || 0,
            failedJobs: data.queue?.failed || 0,
            status,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    websocket.addEventListener('message', handleMessage);
    return () => websocket.removeEventListener('message', handleMessage);
  }, [websocket]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Get status color and icon
  const getStatusDisplay = () => {
    switch (metrics.status) {
      case 'critical':
        return {
          color: 'text-red-600 bg-red-100',
          icon: <AlertTriangle className="h-4 w-4" />,
          text: 'Critical'
        };
      case 'warning':
        return {
          color: 'text-yellow-600 bg-yellow-100',
          icon: <AlertTriangle className="h-4 w-4" />,
          text: 'Warning'
        };
      default:
        return {
          color: 'text-green-600 bg-green-100',
          icon: <CheckCircle className="h-4 w-4" />,
          text: 'Healthy'
        };
    }
  };

  // Get metric color based on value
  const getMetricColor = (value: number, warningThreshold: number, criticalThreshold: number): string => {
    if (value >= criticalThreshold) return 'bg-red-500';
    if (value >= warningThreshold) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusDisplay = getStatusDisplay();

  if (compact) {
    // Compact view for embedding in dashboards
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <span>System Health</span>
            </span>
            <Badge variant="secondary" className={`${statusDisplay.color} flex items-center space-x-1`}>
              {statusDisplay.icon}
              <span>{statusDisplay.text}</span>
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">CPU</span>
              <span className="font-medium">{metrics.cpu.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.cpu} 
              className="h-2"
              indicatorClassName={getMetricColor(metrics.cpu, 75, 90)}
            />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Memory</span>
              <span className="font-medium">{metrics.memory.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.memory} 
              className="h-2"
              indicatorClassName={getMetricColor(metrics.memory, 75, 90)}
            />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Queue</span>
              <span className="font-medium">{metrics.queueDepth} jobs</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-500">{metrics.activeJobs} active</span>
              {metrics.failedJobs > 0 && (
                <span className="text-red-600">• {metrics.failedJobs} failed</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-gray-500" />
            <span>System Health</span>
          </span>
          <Badge variant="secondary" className={`${statusDisplay.color} flex items-center space-x-1`}>
            {statusDisplay.icon}
            <span>{statusDisplay.text}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CPU Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">CPU Usage</span>
              </div>
              <span className="text-sm font-bold">{metrics.cpu.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.cpu} 
              className="h-2"
              indicatorClassName={getMetricColor(metrics.cpu, 75, 90)}
            />
          </div>

          {/* Memory Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Memory Usage</span>
              </div>
              <span className="text-sm font-bold">{metrics.memory.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.memory} 
              className="h-2"
              indicatorClassName={getMetricColor(metrics.memory, 75, 90)}
            />
          </div>

          {/* Disk Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Disk Usage</span>
              </div>
              <span className="text-sm font-bold">{metrics.disk.toFixed(1)}%</span>
            </div>
            <Progress 
              value={metrics.disk} 
              className="h-2"
              indicatorClassName={getMetricColor(metrics.disk, 85, 95)}
            />
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{metrics.queueDepth}</div>
              <div className="text-xs text-gray-500">Queue Depth</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{metrics.activeJobs}</div>
              <div className="text-xs text-gray-500">Active Jobs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{metrics.failedJobs}</div>
              <div className="text-xs text-gray-500">Failed Jobs</div>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-4 text-xs text-gray-500 text-right">
          Last updated: {metrics.timestamp.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};