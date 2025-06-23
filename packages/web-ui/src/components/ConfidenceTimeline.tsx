import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfidenceTimelineProps {
  decisions: Array<{
    id: string;
    timestamp: string;
    component: string;
    confidence: number;
    reasoning?: string;
  }>;
  thresholds?: {
    high: number;
    medium: number;
    low: number;
  };
  onPointClick?: (decision: any) => void;
}

export const ConfidenceTimeline: React.FC<ConfidenceTimelineProps> = ({
  decisions,
  thresholds = {
    high: 0.9,
    medium: 0.7,
    low: 0.5
  },
  onPointClick
}) => {
  // Process data for the chart
  const chartData = useMemo(() => {
    // Sort decisions by timestamp
    const sorted = [...decisions].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group by time intervals (e.g., every 5 minutes)
    const grouped = sorted.reduce((acc, decision) => {
      const time = new Date(decision.timestamp);
      const key = format(time, 'HH:mm');
      
      if (!acc[key]) {
        acc[key] = {
          time: key,
          timestamp: time,
          field_detection: [],
          pii_masking: [],
          sentiment_analysis: [],
          confidence_tracking: [],
          overall: []
        };
      }
      
      acc[key][decision.component].push(decision.confidence);
      acc[key].overall.push(decision.confidence);
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages for each time interval
    return Object.values(grouped).map((group: any) => ({
      time: group.time,
      timestamp: group.timestamp,
      field_detection: group.field_detection.length > 0
        ? group.field_detection.reduce((a: number, b: number) => a + b, 0) / group.field_detection.length
        : null,
      pii_masking: group.pii_masking.length > 0
        ? group.pii_masking.reduce((a: number, b: number) => a + b, 0) / group.pii_masking.length
        : null,
      sentiment_analysis: group.sentiment_analysis.length > 0
        ? group.sentiment_analysis.reduce((a: number, b: number) => a + b, 0) / group.sentiment_analysis.length
        : null,
      confidence_tracking: group.confidence_tracking.length > 0
        ? group.confidence_tracking.reduce((a: number, b: number) => a + b, 0) / group.confidence_tracking.length
        : null,
      overall: group.overall.reduce((a: number, b: number) => a + b, 0) / group.overall.length
    }));
  }, [decisions]);

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: 'stable', percentage: 0 };
    
    const firstOverall = chartData[0].overall;
    const lastOverall = chartData[chartData.length - 1].overall;
    const change = lastOverall - firstOverall;
    const percentage = (change / firstOverall) * 100;
    
    return {
      direction: change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'stable',
      percentage: Math.abs(percentage)
    };
  }, [chartData]);

  // Calculate statistics
  const stats = useMemo(() => {
    const confidences = decisions.map(d => d.confidence);
    const average = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);
    
    const belowThreshold = confidences.filter(c => c < thresholds.medium).length;
    const aboveHighThreshold = confidences.filter(c => c >= thresholds.high).length;
    
    return { average, min, max, belowThreshold, aboveHighThreshold };
  }, [decisions, thresholds]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="capitalize">{entry.name.replace('_', ' ')}:</span>
              <span className="font-medium">{(entry.value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Average</p>
                <p className={clsx(
                  'text-2xl font-bold',
                  stats.average >= thresholds.high ? 'text-green-600' :
                  stats.average >= thresholds.medium ? 'text-yellow-600' : 'text-red-600'
                )}>
                  {(stats.average * 100).toFixed(1)}%
                </p>
              </div>
              {trend.direction === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : trend.direction === 'down' ? (
                <TrendingDown className="w-5 h-5 text-red-500" />
              ) : (
                <Minus className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">High Confidence</p>
            <p className="text-2xl font-bold text-green-600">{stats.aboveHighThreshold}</p>
            <p className="text-xs text-gray-500 mt-1">≥ {(thresholds.high * 100)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Low Confidence</p>
            <p className="text-2xl font-bold text-red-600">{stats.belowThreshold}</p>
            <p className="text-xs text-gray-500 mt-1">&lt; {(thresholds.medium * 100)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Range</p>
            <p className="text-xl font-bold">
              {(stats.min * 100).toFixed(0)}-{(stats.max * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Min-Max</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Confidence Over Time</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {decisions.length} decisions
              </Badge>
              {trend.direction !== 'stable' && (
                <Badge 
                  variant={trend.direction === 'up' ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {trend.direction === 'up' ? '+' : '-'}{trend.percentage.toFixed(1)}%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={chartData} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                onClick={(data) => data && onPointClick?.(data)}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis 
                  domain={[0, 1]}
                  ticks={[0, 0.25, 0.5, 0.75, 1]}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
                
                {/* Confidence threshold areas */}
                <Area
                  type="monotone"
                  dataKey={() => thresholds.high}
                  stroke="none"
                  fill="#10b981"
                  fillOpacity={0.1}
                  name="High confidence zone"
                />
                
                {/* Reference lines for thresholds */}
                <ReferenceLine 
                  y={thresholds.high} 
                  stroke="#10b981" 
                  strokeDasharray="5 5"
                  label={{ value: "High", position: "left", style: { fontSize: 10 } }}
                />
                <ReferenceLine 
                  y={thresholds.medium} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5"
                  label={{ value: "Medium", position: "left", style: { fontSize: 10 } }}
                />
                <ReferenceLine 
                  y={thresholds.low} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5"
                  label={{ value: "Low", position: "left", style: { fontSize: 10 } }}
                />
                
                {/* Data lines */}
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  name="Overall"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="field_detection" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Field Detection"
                  connectNulls
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="pii_masking" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  name="PII Masking"
                  connectNulls
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="sentiment_analysis" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Sentiment Analysis"
                  connectNulls
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="confidence_tracking" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Confidence Tracking"
                  connectNulls
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend Info */}
          <div className="mt-4 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Info className="w-4 h-4 mt-0.5" />
            <p>
              Click on any point in the chart to view detailed information about decisions at that time.
              Dashed lines represent individual components, while the solid line shows overall confidence.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};