import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  RefreshCw, 
  Calendar,
  Clock,
  Zap,
  BarChart3
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import './OpenAIUsageTracker.css';

interface UsageData {
  timestamp: string;
  tokens: number;
  cost: number;
  requests: number;
}

interface UsageStats {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  averageTokensPerRequest: number;
  costPerToken: number;
  averageResponseTime?: number;
  successRate?: number;
  dailyUsage: UsageData[];
  weeklyUsage: UsageData[];
  monthlyUsage: UsageData[];
}

interface RateLimitInfo {
  requestsPerMinute: number;
  tokensPerMinute: number;
  currentRequestRate: number;
  currentTokenRate: number;
  requestLimit: number;
  tokenLimit: number;
}

interface BudgetInfo {
  dailyBudget: number;
  weeklyBudget: number;
  monthlyBudget: number;
  dailySpent: number;
  weeklySpent: number;
  monthlySpent: number;
}

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface OpenAIUsageTrackerProps {
  websocket?: WebSocket;
  className?: string;
}

export const OpenAIUsageTracker: React.FC<OpenAIUsageTrackerProps> = ({ websocket, className }) => {
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    averageTokensPerRequest: 0,
    costPerToken: 0,
    dailyUsage: [],
    weeklyUsage: [],
    monthlyUsage: []
  });
  
  const [rateLimits, setRateLimits] = useState<RateLimitInfo>({
    requestsPerMinute: 0,
    tokensPerMinute: 0,
    currentRequestRate: 0,
    currentTokenRate: 0,
    requestLimit: 3000,
    tokenLimit: 250000
  });
  
  const [budget, setBudget] = useState<BudgetInfo>({
    dailyBudget: 50,
    weeklyBudget: 300,
    monthlyBudget: 1000,
    dailySpent: 0,
    weeklySpent: 0,
    monthlySpent: 0
  });
  
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch usage data from API
  const fetchUsageData = async () => {
    try {
      setIsLoading(true);
      
      const [statsResponse, rateLimitsResponse, budgetResponse] = await Promise.all([
        fetch('http://localhost:3001/api/v1/openai/logs'),
        fetch('http://localhost:3001/api/v1/openai/stats'),
        fetch('http://localhost:3001/api/v1/openai/stats')
      ]);
      
      if (statsResponse.ok) {
        const logsResponse = await statsResponse.json();
        // Check if we have the data array
        const logsData = logsResponse.data || logsResponse || [];
        const logsArray = Array.isArray(logsData) ? logsData : [];
        
        // Convert logs data to usage stats format
        const totalRequests = logsArray.length;
        const totalTokens = logsArray.reduce((sum: number, log: any) => sum + (log.tokensUsed || 0), 0);
        const totalCost = logsArray.reduce((sum: number, log: any) => sum + (log.cost || 0), 0);
        
        setUsageStats({
          totalRequests,
          totalTokens,
          totalCost,
          averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
          costPerToken: totalTokens > 0 ? totalCost / totalTokens : 0,
          averageResponseTime: logsArray.length > 0 
            ? logsArray.reduce((sum: number, log: any) => sum + (log.responseTime || 0), 0) / logsArray.length 
            : 0,
          successRate: 100,
          dailyUsage: [],
          weeklyUsage: [],
          monthlyUsage: []
        });
      }
      
      if (rateLimitsResponse.ok) {
        const statsData = await rateLimitsResponse.json();
        if (statsData.success && statsData.data) {
          setRateLimits(statsData.data.rateLimit);
          // Also update usage stats from this endpoint
          if (statsData.data.logs) {
            const requests = statsData.data.logs.totalRequests || 0;
            const tokens = statsData.data.logs.totalTokens || 0;
            const cost = statsData.data.logs.totalCost || 0;
            
            setUsageStats(prev => ({
              ...prev,
              totalRequests: requests,
              totalTokens: tokens,
              totalCost: cost,
              averageTokensPerRequest: requests > 0 ? tokens / requests : 0,
              costPerToken: tokens > 0 ? cost / tokens : 0,
              averageResponseTime: statsData.data.logs.averageResponseTime || 0
            }));
          }
        }
      }
      
      if (budgetResponse.ok) {
        const budgetStats = await budgetResponse.json();
        if (budgetStats.success && budgetStats.data && budgetStats.data.costs) {
          setBudget({
            daily: budgetStats.data.costs.daily.total.cost || 0,
            monthly: budgetStats.data.costs.monthly.total.cost || 0,
            limit: 100, // Default budget limit
            remaining: 100 - (budgetStats.data.costs.monthly.total.cost || 0)
          });
        }
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch OpenAI usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchUsageData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchUsageData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!websocket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'openai:usage_update') {
          fetchUsageData();
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

  // Get current usage data based on selected time range
  const getCurrentUsageData = () => {
    switch (selectedTimeRange) {
      case 'daily': return usageStats.dailyUsage;
      case 'weekly': return usageStats.weeklyUsage;
      case 'monthly': return usageStats.monthlyUsage;
      default: return usageStats.dailyUsage;
    }
  };

  // Calculate budget usage percentages
  const getBudgetPercentages = () => {
    return {
      daily: (budget.dailySpent / budget.dailyBudget) * 100,
      weekly: (budget.weeklySpent / budget.weeklyBudget) * 100,
      monthly: (budget.monthlySpent / budget.monthlyBudget) * 100
    };
  };

  // Calculate rate limit percentages
  const getRateLimitPercentages = () => {
    return {
      requests: (rateLimits.currentRequestRate / rateLimits.requestLimit) * 100,
      tokens: (rateLimits.currentTokenRate / rateLimits.tokenLimit) * 100
    };
  };

  // Get budget alert status
  const getBudgetAlertStatus = (percentage: number) => {
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    return 'normal';
  };

  // Get rate limit alert status
  const getRateLimitAlertStatus = (percentage: number) => {
    if (percentage >= 80) return 'critical';
    if (percentage >= 60) return 'warning';
    return 'normal';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  // Format large numbers
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const budgetPercentages = getBudgetPercentages();
  const rateLimitPercentages = getRateLimitPercentages();
  const usageData = getCurrentUsageData();

  return (
    <div className={`openai-usage-tracker ${className || ''}`}>
      {/* Header */}
      <div className="usage-tracker-header">
        <div className="header-left">
          <h2 className="text-2xl font-bold">OpenAI Usage Tracker</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm:ss')}
          </p>
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
            onClick={fetchUsageData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Tokens Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value">
              <span className="text-2xl font-bold">{formatNumber(usageStats.totalTokens)}</span>
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Avg: {formatNumber(usageStats.averageTokensPerRequest)} per request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value">
              <span className="text-2xl font-bold">{formatCurrency(usageStats.totalCost)}</span>
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatCurrency(usageStats.costPerToken)} per token
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value">
              <span className="text-2xl font-bold">{formatNumber(usageStats.totalRequests)}</span>
              <BarChart3 className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              API calls made
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Budget Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="budget-grid">
            <div className="budget-item">
              <div className="budget-header">
                <span className="budget-label">Daily Budget</span>
                <Badge variant={getBudgetAlertStatus(budgetPercentages.daily) === 'critical' ? 'destructive' : getBudgetAlertStatus(budgetPercentages.daily) === 'warning' ? 'outline' : 'success'}>
                  {budgetPercentages.daily.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={budgetPercentages.daily} variant={budgetPercentages.daily >= 90 ? 'danger' : budgetPercentages.daily >= 75 ? 'warning' : 'success'} />
              <div className="budget-amounts">
                <span>{formatCurrency(budget.dailySpent)}</span>
                <span className="text-gray-500">/ {formatCurrency(budget.dailyBudget)}</span>
              </div>
            </div>

            <div className="budget-item">
              <div className="budget-header">
                <span className="budget-label">Weekly Budget</span>
                <Badge variant={getBudgetAlertStatus(budgetPercentages.weekly) === 'critical' ? 'destructive' : getBudgetAlertStatus(budgetPercentages.weekly) === 'warning' ? 'outline' : 'success'}>
                  {budgetPercentages.weekly.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={budgetPercentages.weekly} variant={budgetPercentages.weekly >= 90 ? 'danger' : budgetPercentages.weekly >= 75 ? 'warning' : 'success'} />
              <div className="budget-amounts">
                <span>{formatCurrency(budget.weeklySpent)}</span>
                <span className="text-gray-500">/ {formatCurrency(budget.weeklyBudget)}</span>
              </div>
            </div>

            <div className="budget-item">
              <div className="budget-header">
                <span className="budget-label">Monthly Budget</span>
                <Badge variant={getBudgetAlertStatus(budgetPercentages.monthly) === 'critical' ? 'destructive' : getBudgetAlertStatus(budgetPercentages.monthly) === 'warning' ? 'outline' : 'success'}>
                  {budgetPercentages.monthly.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={budgetPercentages.monthly} variant={budgetPercentages.monthly >= 90 ? 'danger' : budgetPercentages.monthly >= 75 ? 'warning' : 'success'} />
              <div className="budget-amounts">
                <span>{formatCurrency(budget.monthlySpent)}</span>
                <span className="text-gray-500">/ {formatCurrency(budget.monthlyBudget)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Rate Limits</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rate-limits-grid">
            <div className="rate-limit-item">
              <div className="rate-limit-header">
                <span className="rate-limit-label">Requests per Minute</span>
                <Badge variant={getRateLimitAlertStatus(rateLimitPercentages.requests) === 'critical' ? 'destructive' : getRateLimitAlertStatus(rateLimitPercentages.requests) === 'warning' ? 'outline' : 'success'}>
                  {rateLimitPercentages.requests.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={rateLimitPercentages.requests} variant={rateLimitPercentages.requests >= 80 ? 'danger' : rateLimitPercentages.requests >= 60 ? 'warning' : 'success'} />
              <div className="rate-limit-amounts">
                <span>{rateLimits.currentRequestRate}</span>
                <span className="text-gray-500">/ {rateLimits.requestLimit}</span>
              </div>
            </div>

            <div className="rate-limit-item">
              <div className="rate-limit-header">
                <span className="rate-limit-label">Tokens per Minute</span>
                <Badge variant={getRateLimitAlertStatus(rateLimitPercentages.tokens) === 'critical' ? 'destructive' : getRateLimitAlertStatus(rateLimitPercentages.tokens) === 'warning' ? 'outline' : 'success'}>
                  {rateLimitPercentages.tokens.toFixed(1)}%
                </Badge>
              </div>
              <Progress value={rateLimitPercentages.tokens} variant={rateLimitPercentages.tokens >= 80 ? 'danger' : rateLimitPercentages.tokens >= 60 ? 'warning' : 'success'} />
              <div className="rate-limit-amounts">
                <span>{formatNumber(rateLimits.currentTokenRate)}</span>
                <span className="text-gray-500">/ {formatNumber(rateLimits.tokenLimit)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Charts */}
      <Card>
        <CardHeader>
          <div className="chart-header">
            <CardTitle>Usage Trends</CardTitle>
            <div className="time-range-selector">
              <Button
                variant={selectedTimeRange === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeRange('daily')}
              >
                Daily
              </Button>
              <Button
                variant={selectedTimeRange === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeRange('weekly')}
              >
                Weekly
              </Button>
              <Button
                variant={selectedTimeRange === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeRange('monthly')}
              >
                Monthly
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usageData.length > 0 ? (
            <div className="charts-container">
              {/* Cost Chart */}
              <div className="chart-item">
                <h4 className="chart-title">Cost Over Time</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), selectedTimeRange === 'daily' ? 'HH:mm' : selectedTimeRange === 'weekly' ? 'MMM dd' : 'MMM')}
                    />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={(value: number) => [formatCurrency(value), 'Cost']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Token Usage Chart */}
              <div className="chart-item">
                <h4 className="chart-title">Token Usage</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), selectedTimeRange === 'daily' ? 'HH:mm' : selectedTimeRange === 'weekly' ? 'MMM dd' : 'MMM')}
                    />
                    <YAxis tickFormatter={formatNumber} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={(value: number) => [formatNumber(value), 'Tokens']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="tokens" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Request Count Chart */}
              <div className="chart-item">
                <h4 className="chart-title">Request Volume</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), selectedTimeRange === 'daily' ? 'HH:mm' : selectedTimeRange === 'weekly' ? 'MMM dd' : 'MMM')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy HH:mm')}
                      formatter={(value: number) => [value, 'Requests']}
                    />
                    <Bar 
                      dataKey="requests" 
                      fill="#8b5cf6" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>No usage data available for the selected time range.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};