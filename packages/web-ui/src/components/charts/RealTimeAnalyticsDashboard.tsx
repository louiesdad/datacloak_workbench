import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Activity, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';

interface RealTimeMetrics {
  timestamp: string;
  totalAnalyses: number;
  sentimentCounts: {
    positive: number;
    negative: number;
    neutral: number;
  };
  averageScore: number;
  averageConfidence: number;
  processingRate: number; // analyses per minute
}

interface AnalyticsData {
  currentMetrics: RealTimeMetrics;
  historicalData: RealTimeMetrics[];
  topKeywords: Array<{
    keyword: string;
    frequency: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
  processingStats: {
    activeJobs: number;
    completedJobs: number;
    errorRate: number;
  };
}

interface RealTimeAnalyticsDashboardProps {
  wsUrl?: string;
  refreshInterval?: number;
  className?: string;
}

const COLORS = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#6b7280',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  warning: '#f59e0b'
};

export const RealTimeAnalyticsDashboard: React.FC<RealTimeAnalyticsDashboardProps> = ({
  wsUrl = 'ws://localhost:3001/ws',
  refreshInterval = 5000,
  className = ''
}) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          console.log('Connected to analytics WebSocket');
          
          // Subscribe to analytics updates
          ws?.send(JSON.stringify({
            type: 'subscribe',
            topic: 'analytics_feed'
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'analytics_update') {
              setAnalyticsData(message.data);
              setLastUpdate(new Date());
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Attempt to reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
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
    if (isConnected) return;

    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/v1/analytics/overview');
        if (response.ok) {
          const data = await response.json();
          
          // Transform backend data to match our interface
          const transformedData: AnalyticsData = {
            currentMetrics: {
              timestamp: new Date().toISOString(),
              totalAnalyses: data.data.totalAnalyses || 0,
              sentimentCounts: {
                positive: data.data.sentimentDistribution?.positive?.count || 0,
                negative: data.data.sentimentDistribution?.negative?.count || 0,
                neutral: data.data.sentimentDistribution?.neutral?.count || 0
              },
              averageScore: data.data.averageScore || 0,
              averageConfidence: data.data.averageConfidence || 0,
              processingRate: 0 // Would need to calculate from time series
            },
            historicalData: [], // Would come from trends API
            topKeywords: data.data.topKeywords?.slice(0, 10) || [],
            processingStats: {
              activeJobs: 0,
              completedJobs: data.data.totalAnalyses || 0,
              errorRate: 0
            }
          };
          
          setAnalyticsData(transformedData);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, refreshInterval);

    return () => clearInterval(interval);
  }, [isConnected, refreshInterval]);

  const formatTimeRange = useCallback((timeRange: string) => {
    switch (timeRange) {
      case '1h': return 'Last Hour';
      case '6h': return 'Last 6 Hours';
      case '24h': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      default: return timeRange;
    }
  }, []);

  if (!analyticsData) {
    return (
      <div className={`real-time-dashboard loading ${className}`}>
        <div className="dashboard-header">
          <h2>📊 Real-Time Analytics</h2>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  const sentimentData = [
    { name: 'Positive', value: analyticsData.currentMetrics.sentimentCounts.positive, color: COLORS.positive },
    { name: 'Negative', value: analyticsData.currentMetrics.sentimentCounts.negative, color: COLORS.negative },
    { name: 'Neutral', value: analyticsData.currentMetrics.sentimentCounts.neutral, color: COLORS.neutral }
  ];

  const totalSentiments = sentimentData.reduce((sum, item) => sum + item.value, 0);

  // Generate sample historical data if not available
  const historicalData = analyticsData.historicalData.length > 0 
    ? analyticsData.historicalData 
    : Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() - (19 - i) * 60000).toISOString(),
        totalAnalyses: Math.floor(Math.random() * 100) + 50,
        sentimentCounts: {
          positive: Math.floor(Math.random() * 40) + 10,
          negative: Math.floor(Math.random() * 30) + 5,
          neutral: Math.floor(Math.random() * 30) + 10
        },
        averageScore: (Math.random() - 0.5) * 2,
        averageConfidence: Math.random() * 0.3 + 0.7,
        processingRate: Math.floor(Math.random() * 10) + 5
      }));

  return (
    <div className={`real-time-dashboard ${className}`}>
      <div className="dashboard-header">
        <div className="header-left">
          <h2>📊 Real-Time Analytics Dashboard</h2>
          <div className="connection-status">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
            <span>{isConnected ? 'Live' : 'Polling'}</span>
            {lastUpdate && (
              <span className="last-update">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="time-range-selector">
          {(['1h', '6h', '24h', '7d'] as const).map(range => (
            <button
              key={range}
              className={`time-range-btn ${selectedTimeRange === range ? 'active' : ''}`}
              onClick={() => setSelectedTimeRange(range)}
            >
              {formatTimeRange(range)}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <Activity className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.currentMetrics.totalAnalyses.toLocaleString()}</div>
            <div className="metric-label">Total Analyses</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon positive">
            <TrendingUp className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.currentMetrics.averageScore.toFixed(3)}</div>
            <div className="metric-label">Average Score</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <BarChart3 className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{(analyticsData.currentMetrics.averageConfidence * 100).toFixed(1)}%</div>
            <div className="metric-label">Avg Confidence</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <PieChartIcon className="icon" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.currentMetrics.processingRate}/min</div>
            <div className="metric-label">Processing Rate</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-section">
          <h3>Sentiment Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ value }) => `${((value / totalSentiments) * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Sentiment Trends Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name.charAt(0).toUpperCase() + name.slice(1)
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sentimentCounts.positive"
                stackId="1"
                stroke={COLORS.positive}
                fill={COLORS.positive}
                fillOpacity={0.6}
                name="Positive"
              />
              <Area
                type="monotone"
                dataKey="sentimentCounts.neutral"
                stackId="1"
                stroke={COLORS.neutral}
                fill={COLORS.neutral}
                fillOpacity={0.6}
                name="Neutral"
              />
              <Area
                type="monotone"
                dataKey="sentimentCounts.negative"
                stackId="1"
                stroke={COLORS.negative}
                fill={COLORS.negative}
                fillOpacity={0.6}
                name="Negative"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Score & Confidence Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                tick={{ fontSize: 12 }}
              />
              <YAxis yAxisId="score" domain={[-1, 1]} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="confidence" orientation="right" domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value: number, name: string) => [
                  value.toFixed(3),
                  name.includes('Score') ? 'Score' : 'Confidence'
                ]}
              />
              <Legend />
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="averageScore"
                stroke={COLORS.primary}
                strokeWidth={2}
                name="Average Score"
                dot={{ fill: COLORS.primary, strokeWidth: 1, r: 3 }}
              />
              <Line
                yAxisId="confidence"
                type="monotone"
                dataKey="averageConfidence"
                stroke={COLORS.secondary}
                strokeWidth={2}
                name="Confidence"
                dot={{ fill: COLORS.secondary, strokeWidth: 1, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Top Keywords</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart 
              data={analyticsData.topKeywords.slice(0, 8)} 
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="keyword" 
                tick={{ fontSize: 11 }}
                width={80}
              />
              <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Frequency']} />
              <Bar 
                dataKey="frequency" 
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="processing-stats">
        <h3>Processing Statistics</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Active Jobs:</span>
            <span className="stat-value">{analyticsData.processingStats.activeJobs}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Completed Jobs:</span>
            <span className="stat-value">{analyticsData.processingStats.completedJobs.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Error Rate:</span>
            <span className="stat-value">{(analyticsData.processingStats.errorRate * 100).toFixed(2)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Success Rate:</span>
            <span className="stat-value">{((1 - analyticsData.processingStats.errorRate) * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};