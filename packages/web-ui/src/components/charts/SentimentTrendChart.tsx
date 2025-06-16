import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface SentimentTrendProps {
  data: Array<{
    timestamp: string;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  }>;
  height?: number;
}

interface SentimentDistributionProps {
  data: Array<{
    sentiment: string;
    count: number;
    percentage: number;
  }>;
  height?: number;
}

interface ScoreDistributionProps {
  data: Array<{
    range: string;
    count: number;
    averageScore: number;
  }>;
  height?: number;
}

const COLORS = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#6b7280',
  primary: '#3b82f6',
  secondary: '#8b5cf6'
};

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const SentimentTrendChart: React.FC<SentimentTrendProps> = ({ 
  data, 
  height = 300 
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="timestamp" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString()}
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
        <Line 
          type="monotone" 
          dataKey="positive" 
          stroke={COLORS.positive} 
          strokeWidth={2}
          dot={{ fill: COLORS.positive, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line 
          type="monotone" 
          dataKey="negative" 
          stroke={COLORS.negative} 
          strokeWidth={2}
          dot={{ fill: COLORS.negative, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line 
          type="monotone" 
          dataKey="neutral" 
          stroke={COLORS.neutral} 
          strokeWidth={2}
          dot={{ fill: COLORS.neutral, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const SentimentDistributionChart: React.FC<SentimentDistributionProps> = ({ 
  data, 
  height = 300 
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ sentiment, percentage }) => `${sentiment}: ${percentage.toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[entry.sentiment as keyof typeof COLORS] || PIE_COLORS[index % PIE_COLORS.length]} 
            />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number, name: string, props) => [
            `${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
            'Count'
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const ScoreDistributionChart: React.FC<ScoreDistributionProps> = ({ 
  data, 
  height = 300 
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          formatter={(value: number, name: string) => [
            value.toLocaleString(),
            name === 'count' ? 'Count' : 'Average Score'
          ]}
        />
        <Legend />
        <Bar 
          dataKey="count" 
          fill={COLORS.primary}
          name="Count"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface KeywordFrequencyProps {
  data: Array<{
    keyword: string;
    frequency: number;
    averageScore: number;
  }>;
  height?: number;
  maxItems?: number;
}

export const KeywordFrequencyChart: React.FC<KeywordFrequencyProps> = ({ 
  data, 
  height = 300,
  maxItems = 10 
}) => {
  const chartData = data.slice(0, maxItems).reverse(); // Reverse for better display

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart 
        data={chartData} 
        layout="horizontal"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis 
          type="category" 
          dataKey="keyword" 
          tick={{ fontSize: 11 }}
          width={90}
        />
        <Tooltip 
          formatter={(value: number, name: string, props) => [
            name === 'frequency' ? value.toLocaleString() : value.toFixed(3),
            name === 'frequency' ? 'Frequency' : 'Avg Score'
          ]}
        />
        <Legend />
        <Bar 
          dataKey="frequency" 
          fill={COLORS.primary}
          name="Frequency"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface ProgressChartProps {
  current: number;
  total: number;
  label?: string;
  size?: number;
}

export const ProgressChart: React.FC<ProgressChartProps> = ({
  current,
  total,
  label = 'Progress',
  size = 100
}) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const data = [
    { name: 'Completed', value: current },
    { name: 'Remaining', value: Math.max(0, total - current) }
  ];

  return (
    <div className="progress-chart">
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.25}
            outerRadius={size * 0.4}
            paddingAngle={2}
            dataKey="value"
            startAngle={90}
            endAngle={450}
          >
            <Cell fill={COLORS.positive} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="progress-center">
        <div className="progress-percentage">{percentage.toFixed(1)}%</div>
        <div className="progress-label">{label}</div>
      </div>
    </div>
  );
};

interface ConfidenceScoreProps {
  data: Array<{
    text: string;
    score: number;
    confidence: number;
  }>;
  height?: number;
}

export const ConfidenceScoreChart: React.FC<ConfidenceScoreProps> = ({
  data,
  height = 300
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="score" 
          type="number"
          domain={[-1, 1]}
          tick={{ fontSize: 12 }}
          label={{ value: 'Sentiment Score', position: 'insideBottom', offset: -5 }}
        />
        <YAxis 
          dataKey="confidence"
          type="number"
          domain={[0, 1]}
          tick={{ fontSize: 12 }}
          label={{ value: 'Confidence', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          formatter={(value: number, name: string) => [
            value.toFixed(3),
            name === 'confidence' ? 'Confidence' : 'Score'
          ]}
        />
        <Line 
          type="monotone" 
          dataKey="confidence" 
          stroke={COLORS.secondary} 
          strokeWidth={2}
          dot={{ fill: COLORS.secondary, strokeWidth: 1, r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};