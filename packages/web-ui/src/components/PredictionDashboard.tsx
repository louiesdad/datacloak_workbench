import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import * as api from '../services/predictionService';
import './PredictionDashboard.css';

interface PredictionDashboardProps {
  customerId: string;
}

export const PredictionDashboard: React.FC<PredictionDashboardProps> = ({ customerId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<api.CustomerPrediction | null>(null);
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCustomerPredictions(customerId);
      setPredictions(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Error loading predictions');
      console.error('Failed to fetch predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, [customerId]);

  if (loading) {
    return (
      <div className="prediction-dashboard-loading">
        <div className="spinner" />
        <p>Loading predictions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prediction-dashboard-error">
        <p>{error}</p>
        <Button onClick={fetchPredictions}>Retry</Button>
      </div>
    );
  }

  if (!predictions) {
    return <div>No predictions available</div>;
  }

  // Prepare chart data
  const chartData = predictions.predictions.map(pred => ({
    date: new Date(pred.predictedDate).toLocaleDateString(),
    sentiment: pred.predictedSentiment,
    lower: pred.confidenceLower,
    upper: pred.confidenceUpper,
    daysAhead: pred.daysAhead,
  }));

  // Add current sentiment if available
  if (predictions.riskAssessment) {
    chartData.unshift({
      date: 'Today',
      sentiment: predictions.riskAssessment.currentSentiment,
      lower: predictions.riskAssessment.currentSentiment,
      upper: predictions.riskAssessment.currentSentiment,
      daysAhead: 0,
    });
  }

  const getRiskColor = (classification: string, severity: string) => {
    if (severity === 'high') return 'danger';
    if (severity === 'medium') return 'warning';
    if (severity === 'positive') return 'success';
    return 'default';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="prediction-dashboard">
      <div className="dashboard-header">
        <h2>Sentiment Predictions</h2>
        <div className="header-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showConfidenceIntervals}
              onChange={(e) => setShowConfidenceIntervals(e.target.checked)}
              aria-label="Show confidence intervals"
            />
            Show Confidence Intervals
          </label>
          <Button onClick={fetchPredictions} variant="secondary">
            Refresh Predictions
          </Button>
        </div>
      </div>

      {predictions.riskAssessment?.isHighRisk && (
        <div className="risk-alert" role="alert">
          <h3>⚠️ Urgent Attention Required</h3>
          <p>
            Customer sentiment expected to drop below critical threshold in{' '}
            <strong>{predictions.riskAssessment.daysUntilThreshold} days</strong>
          </p>
        </div>
      )}

      <div className="dashboard-grid">
        <Card className="prediction-chart-card">
          <h3>Sentiment Trajectory</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              
              {showConfidenceIntervals && (
                <>
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.1}
                    strokeWidth={0}
                    name="Upper Bound"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="#8884d8"
                    fill="white"
                    strokeWidth={0}
                    name="Lower Bound"
                  />
                </>
              )}
              
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="#8884d8"
                strokeWidth={3}
                dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
                name="Predicted Sentiment"
              />
            </AreaChart>
          </ResponsiveContainer>
          {showConfidenceIntervals && (
            <p className="chart-note">Shaded area represents confidence interval</p>
          )}
        </Card>

        <Card className="prediction-details-card">
          <h3>Prediction Analysis</h3>
          
          {predictions.trajectory && (
            <div className="trajectory-info">
              <h4>Trajectory</h4>
              <Badge variant={getRiskColor(predictions.trajectory.classification, predictions.trajectory.severity)}>
                {predictions.trajectory.classification}
              </Badge>
              {predictions.trajectory.severity === 'high' && (
                <span className="risk-label">High Risk</span>
              )}
            </div>
          )}

          {predictions.trend && (
            <div className="trend-info">
              <h4>Trend Analysis</h4>
              <p>
                Sentiment declining {Math.abs(predictions.trend.slope).toFixed(1)}% per week
              </p>
              <p>{(predictions.trend.rSquared * 100).toFixed(0)}% correlation</p>
            </div>
          )}

          {predictions.historicalAccuracy && (
            <div className="accuracy-info">
              <h4>Model Performance</h4>
              <p>Historical Accuracy: {predictions.historicalAccuracy.accuracy.toFixed(1)}%</p>
            </div>
          )}

          {lastUpdated && (
            <div className="update-info">
              <p>Last updated: {formatDate(lastUpdated)}</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="prediction-table-card">
        <h3>Detailed Predictions</h3>
        <table className="predictions-table">
          <thead>
            <tr>
              <th>Time Period</th>
              <th>Predicted Date</th>
              <th>Sentiment Score</th>
              <th>Confidence Range</th>
            </tr>
          </thead>
          <tbody>
            {predictions.predictions.map((pred, index) => (
              <tr key={index}>
                <td>{pred.daysAhead} days</td>
                <td>{new Date(pred.predictedDate).toLocaleDateString()}</td>
                <td className="sentiment-score">{pred.predictedSentiment.toFixed(1)}%</td>
                <td className="confidence-range">
                  {pred.confidenceLower.toFixed(1)}% - {pred.confidenceUpper.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="export-section">
        <Button
          onClick={async () => {
            try {
              const result = await api.exportPredictions(customerId, 'csv');
              const link = document.createElement('a');
              link.href = result.url;
              link.download = `predictions-${customerId}.csv`;
              link.click();
            } catch (err) {
              console.error('Export failed:', err);
            }
          }}
        >
          Export Predictions
        </Button>
      </div>
    </div>
  );
};