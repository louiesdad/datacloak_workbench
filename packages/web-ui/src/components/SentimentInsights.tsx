import React, { useState, useMemo } from 'react';
import type { SentimentResult } from '../../../../shared/contracts/api';
import { VirtualTable, PerformantList } from './VirtualScrollList';
import { ApiErrorDisplay } from './ApiErrorDisplay';
import { useApiErrorHandler, type ApiError } from '../hooks/useApiErrorHandler';
import { 
  SentimentDistributionChart, 
  KeywordFrequencyChart, 
  ConfidenceScoreChart 
} from './charts';
import './SentimentInsights.css';

interface SentimentInsightsProps {
  results: SentimentResult[];
  onExportInsights?: (insights: InsightData) => Promise<void>;
  className?: string;
}

interface InsightData {
  summary: SentimentSummary;
  trends: TrendAnalysis;
  keywords: KeywordAnalysis;
  emotions: EmotionAnalysis;
  patterns: PatternAnalysis;
  recommendations: string[];
}

interface SentimentSummary {
  totalCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  averageScore: number;
  averageConfidence: number;
  scoreDistribution: { range: string; count: number; percentage: number }[];
}

interface TrendAnalysis {
  timeBasedTrends: { period: string; positive: number; negative: number; neutral: number }[];
  scoreProgression: { period: string; averageScore: number }[];
  volumeAnalysis: { period: string; count: number }[];
}

interface KeywordAnalysis {
  topPositiveKeywords: { keyword: string; frequency: number; averageScore: number }[];
  topNegativeKeywords: { keyword: string; frequency: number; averageScore: number }[];
  emergingKeywords: { keyword: string; frequency: number; trend: 'rising' | 'falling' }[];
  keywordSentimentMap: { keyword: string; positiveCount: number; negativeCount: number; neutralCount: number }[];
}

interface EmotionAnalysis {
  dominantEmotions: { emotion: string; averageIntensity: number; frequency: number }[];
  emotionCorrelations: { emotion1: string; emotion2: string; correlation: number }[];
  emotionTrends: { emotion: string; trend: 'increasing' | 'decreasing' | 'stable' }[];
}

interface PatternAnalysis {
  textLengthCorrelation: { range: string; averageScore: number; count: number }[];
  sentimentClusters: { cluster: string; characteristics: string[]; count: number }[];
  anomalies: { type: string; description: string; examples: string[] }[];
}

export const SentimentInsights: React.FC<SentimentInsightsProps> = ({
  results,
  onExportInsights,
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'overview' | 'trends' | 'keywords' | 'emotions' | 'patterns'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const { handleApiError } = useApiErrorHandler();

  // Generate comprehensive insights
  const insights = useMemo((): InsightData => {
    if (results.length === 0) {
      return {
        summary: {
          totalCount: 0,
          positiveCount: 0,
          negativeCount: 0,
          neutralCount: 0,
          averageScore: 0,
          averageConfidence: 0,
          scoreDistribution: []
        },
        trends: { timeBasedTrends: [], scoreProgression: [], volumeAnalysis: [] },
        keywords: { topPositiveKeywords: [], topNegativeKeywords: [], emergingKeywords: [], keywordSentimentMap: [] },
        emotions: { dominantEmotions: [], emotionCorrelations: [], emotionTrends: [] },
        patterns: { textLengthCorrelation: [], sentimentClusters: [], anomalies: [] },
        recommendations: []
      };
    }

    // Summary Analysis
    const positiveCount = results.filter(r => r.sentiment === 'positive').length;
    const negativeCount = results.filter(r => r.sentiment === 'negative').length;
    const neutralCount = results.filter(r => r.sentiment === 'neutral').length;
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Score Distribution
    const scoreRanges = [
      { min: -1, max: -0.6, label: 'Very Negative' },
      { min: -0.6, max: -0.2, label: 'Negative' },
      { min: -0.2, max: 0.2, label: 'Neutral' },
      { min: 0.2, max: 0.6, label: 'Positive' },
      { min: 0.6, max: 1, label: 'Very Positive' }
    ];

    const scoreDistribution = scoreRanges.map(range => {
      const count = results.filter(r => r.score >= range.min && r.score < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / results.length) * 100
      };
    });

    // Keyword Analysis
    const keywordFreq: Record<string, { count: number; scores: number[]; sentiments: string[] }> = {};
    results.forEach(result => {
      if (result.keywords) {
        result.keywords.forEach(keyword => {
          if (!keywordFreq[keyword]) {
            keywordFreq[keyword] = { count: 0, scores: [], sentiments: [] };
          }
          keywordFreq[keyword].count++;
          keywordFreq[keyword].scores.push(result.score);
          keywordFreq[keyword].sentiments.push(result.sentiment);
        });
      }
    });

    const keywordAnalysis = Object.entries(keywordFreq)
      .map(([keyword, data]) => ({
        keyword,
        frequency: data.count,
        averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
        positiveCount: data.sentiments.filter(s => s === 'positive').length,
        negativeCount: data.sentiments.filter(s => s === 'negative').length,
        neutralCount: data.sentiments.filter(s => s === 'neutral').length
      }))
      .sort((a, b) => b.frequency - a.frequency);

    const topPositiveKeywords = keywordAnalysis
      .filter(k => k.averageScore > 0.2)
      .slice(0, 10);

    const topNegativeKeywords = keywordAnalysis
      .filter(k => k.averageScore < -0.2)
      .slice(0, 10);

    // Emotion Analysis (if available)
    const emotionData: Record<string, number[]> = {};
    results.forEach(result => {
      if (result.emotions) {
        Object.entries(result.emotions).forEach(([emotion, intensity]) => {
          if (!emotionData[emotion]) emotionData[emotion] = [];
          emotionData[emotion].push(intensity);
        });
      }
    });

    const dominantEmotions = Object.entries(emotionData)
      .map(([emotion, intensities]) => ({
        emotion,
        averageIntensity: intensities.reduce((sum, i) => sum + i, 0) / intensities.length,
        frequency: intensities.length
      }))
      .sort((a, b) => b.averageIntensity - a.averageIntensity)
      .slice(0, 8);

    // Pattern Analysis
    const textLengthRanges = [
      { min: 0, max: 50, label: 'Short (0-50)' },
      { min: 50, max: 150, label: 'Medium (50-150)' },
      { min: 150, max: 300, label: 'Long (150-300)' },
      { min: 300, max: Infinity, label: 'Very Long (300+)' }
    ];

    const textLengthCorrelation = textLengthRanges.map(range => {
      const inRange = results.filter(r => r.text.length >= range.min && r.text.length < range.max);
      return {
        range: range.label,
        averageScore: inRange.length > 0 ? inRange.reduce((sum, r) => sum + r.score, 0) / inRange.length : 0,
        count: inRange.length
      };
    });

    // Generate Recommendations
    const recommendations: string[] = [];
    
    if (positiveCount > negativeCount) {
      recommendations.push('📈 Overall sentiment is positive - leverage successful strategies');
    } else if (negativeCount > positiveCount) {
      recommendations.push('📉 Address negative sentiment drivers identified in keyword analysis');
    }

    if (averageConfidence < 0.7) {
      recommendations.push('🎯 Low confidence scores detected - consider reviewing ambiguous text for clarity');
    }

    if (topNegativeKeywords.length > 0) {
      recommendations.push(`⚠️ Monitor negative keywords: ${topNegativeKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`);
    }

    if (dominantEmotions.length > 0) {
      const topEmotion = dominantEmotions[0];
      recommendations.push(`💭 Primary emotion detected: ${topEmotion.emotion} - consider emotional response strategies`);
    }

    return {
      summary: {
        totalCount: results.length,
        positiveCount,
        negativeCount,
        neutralCount,
        averageScore,
        averageConfidence,
        scoreDistribution
      },
      trends: {
        timeBasedTrends: [], // Would require timestamp analysis
        scoreProgression: [],
        volumeAnalysis: []
      },
      keywords: {
        topPositiveKeywords,
        topNegativeKeywords,
        emergingKeywords: [], // Would require historical data
        keywordSentimentMap: keywordAnalysis.slice(0, 20)
      },
      emotions: {
        dominantEmotions,
        emotionCorrelations: [], // Would require correlation analysis
        emotionTrends: []
      },
      patterns: {
        textLengthCorrelation,
        sentimentClusters: [], // Would require clustering analysis
        anomalies: []
      },
      recommendations
    };
  }, [results]);

  const handleExportInsights = async () => {
    if (!onExportInsights) return;

    setIsExporting(true);
    setApiError(null);
    try {
      await onExportInsights(insights);
    } catch (error) {
      const apiError = handleApiError(error, {
        operation: 'export insights',
        component: 'SentimentInsights',
        userMessage: 'Failed to export insights'
      });
      setApiError(apiError);
    } finally {
      setIsExporting(false);
    }
  };

  const renderChart = (data: Array<{ label: string; value: number; color?: string }>, type: 'pie' | 'bar' = 'bar') => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className={`simple-chart ${type}`}>
        {data.map((item, index) => (
          <div key={index} className="chart-item">
            <div className="chart-label">{item.label}</div>
            <div className="chart-bar-container">
              <div 
                className="chart-bar" 
                style={{ 
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`
                }}
              />
              <span className="chart-value">{typeof item.value === 'number' ? item.value.toFixed(1) : item.value}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderInsightContent = () => {
    switch (activeView) {
      case 'overview':
        return (
          <div className="insights-overview" data-testid="insights-overview">
            <div className="summary-cards" data-testid="summary-cards">
              <div className="summary-card">
                <div className="card-icon">📊</div>
                <div className="card-content">
                  <div className="card-title">Total Analyzed</div>
                  <div className="card-value">{insights.summary.totalCount.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="summary-card positive">
                <div className="card-icon">😊</div>
                <div className="card-content">
                  <div className="card-title">Positive</div>
                  <div className="card-value">
                    {insights.summary.positiveCount} ({((insights.summary.positiveCount / insights.summary.totalCount) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
              
              <div className="summary-card negative">
                <div className="card-icon">😔</div>
                <div className="card-content">
                  <div className="card-title">Negative</div>
                  <div className="card-value">
                    {insights.summary.negativeCount} ({((insights.summary.negativeCount / insights.summary.totalCount) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
              
              <div className="summary-card neutral">
                <div className="card-icon">😐</div>
                <div className="card-content">
                  <div className="card-title">Neutral</div>
                  <div className="card-value">
                    {insights.summary.neutralCount} ({((insights.summary.neutralCount / insights.summary.totalCount) * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>

            <div className="insights-grid">
              <div className="insight-section">
                <h4>Score Distribution</h4>
                <SentimentDistributionChart
                  data={insights.summary.scoreDistribution.map(d => ({
                    sentiment: d.range,
                    count: d.count,
                    percentage: d.percentage
                  }))}
                  height={250}
                />
              </div>

              <div className="insight-section">
                <h4>Key Metrics</h4>
                <div className="metrics-list">
                  <div className="metric-item">
                    <span className="metric-label">Average Score:</span>
                    <span className="metric-value">{insights.summary.averageScore.toFixed(3)}</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Average Confidence:</span>
                    <span className="metric-value">{(insights.summary.averageConfidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Sentiment Ratio:</span>
                    <span className="metric-value">
                      {(insights.summary.positiveCount / Math.max(insights.summary.negativeCount, 1)).toFixed(2)}:1
                    </span>
                  </div>
                </div>
              </div>

              {insights.recommendations.length > 0 && (
                <div className="insight-section recommendations">
                  <h4>💡 Recommendations</h4>
                  <ul className="recommendations-list">
                    {insights.recommendations.map((rec, index) => (
                      <li key={index} className="recommendation-item">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        );

      case 'keywords':
        return (
          <div className="keywords-analysis">
            <div className="keywords-grid">
              <div className="keyword-section">
                <h4>🔥 Top Positive Keywords</h4>
                <PerformantList
                  items={insights.keywords.topPositiveKeywords}
                  height={300}
                  estimatedItemHeight={40}
                  threshold={10}
                  renderItem={(keyword) => (
                    <div className="keyword-item positive">
                      <span className="keyword-text">{keyword.keyword}</span>
                      <div className="keyword-stats">
                        <span className="frequency">{keyword.frequency} times</span>
                        <span className="score">Score: {keyword.averageScore.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                />
              </div>

              <div className="keyword-section">
                <h4>⚠️ Top Negative Keywords</h4>
                <PerformantList
                  items={insights.keywords.topNegativeKeywords}
                  height={300}
                  estimatedItemHeight={40}
                  threshold={10}
                  renderItem={(keyword) => (
                    <div className="keyword-item negative">
                      <span className="keyword-text">{keyword.keyword}</span>
                      <div className="keyword-stats">
                        <span className="frequency">{keyword.frequency} times</span>
                        <span className="score">Score: {keyword.averageScore.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="keyword-sentiment-map">
              <h4>📈 Keyword Sentiment Breakdown</h4>
              <VirtualTable
                data={insights.keywords.keywordSentimentMap}
                height={400}
                columns={[
                  { key: 'keyword', header: 'Keyword' },
                  { key: 'frequency', header: 'Total Uses' },
                  { 
                    key: 'positiveCount', 
                    header: 'Positive',
                    render: (value, item) => (
                      <span className="sentiment-count positive">
                        {value} ({((value / item.frequency) * 100).toFixed(1)}%)
                      </span>
                    )
                  },
                  { 
                    key: 'negativeCount', 
                    header: 'Negative',
                    render: (value, item) => (
                      <span className="sentiment-count negative">
                        {value} ({((value / item.frequency) * 100).toFixed(1)}%)
                      </span>
                    )
                  },
                  { 
                    key: 'neutralCount', 
                    header: 'Neutral',
                    render: (value, item) => (
                      <span className="sentiment-count neutral">
                        {value} ({((value / item.frequency) * 100).toFixed(1)}%)
                      </span>
                    )
                  }
                ]}
              />
            </div>
          </div>
        );

      case 'emotions':
        if (insights.emotions.dominantEmotions.length === 0) {
          return (
            <div className="no-emotions">
              <div className="no-data-icon">😶</div>
              <h3>No Emotion Data Available</h3>
              <p>Emotion analysis was not included in this sentiment analysis run.</p>
            </div>
          );
        }

        return (
          <div className="emotions-analysis">
            <div className="emotion-overview">
              <h4>🎭 Dominant Emotions</h4>
              <KeywordFrequencyChart
                data={insights.emotions.dominantEmotions.map(e => ({
                  keyword: e.emotion,
                  frequency: e.frequency,
                  averageScore: e.averageIntensity
                }))}
                height={300}
                maxItems={8}
              />
            </div>

            <div className="emotion-details">
              <h4>📊 Emotion Breakdown</h4>
              <div className="emotion-list">
                {insights.emotions.dominantEmotions.map((emotion, index) => (
                  <div key={index} className="emotion-item">
                    <div className="emotion-header">
                      <span className="emotion-name">{emotion.emotion}</span>
                      <span className="emotion-intensity">{(emotion.averageIntensity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="emotion-bar">
                      <div 
                        className="emotion-fill"
                        style={{ width: `${emotion.averageIntensity * 100}%` }}
                      />
                    </div>
                    <span className="emotion-frequency">{emotion.frequency} occurrences</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'patterns':
        return (
          <div className="patterns-analysis">
            <div className="pattern-section">
              <h4>📏 Text Length vs Sentiment</h4>
              {renderChart(
                insights.patterns.textLengthCorrelation.map(p => ({
                  label: p.range,
                  value: p.averageScore,
                  color: p.averageScore > 0 ? '#10b981' : p.averageScore < 0 ? '#ef4444' : '#6b7280'
                }))
              )}
              <div className="pattern-insights">
                <p>Shows how text length correlates with sentiment scores. Longer texts may provide more context for accurate sentiment detection.</p>
              </div>
            </div>

            <div className="pattern-section">
              <h4>🔍 Analysis Patterns</h4>
              <div className="pattern-grid">
                <div className="pattern-card">
                  <h5>High Confidence Patterns</h5>
                  <p>Results with confidence &gt; 80%: {results.filter(r => r.confidence > 0.8).length}</p>
                  <p>Average score: {(results.filter(r => r.confidence > 0.8).reduce((sum, r) => sum + r.score, 0) / Math.max(results.filter(r => r.confidence > 0.8).length, 1)).toFixed(3)}</p>
                </div>
                
                <div className="pattern-card">
                  <h5>Low Confidence Patterns</h5>
                  <p>Results with confidence &lt; 60%: {results.filter(r => r.confidence < 0.6).length}</p>
                  <p>These may need manual review for accuracy</p>
                </div>
                
                <div className="pattern-card">
                  <h5>Extreme Scores</h5>
                  <p>Very positive (&gt; 0.8): {results.filter(r => r.score > 0.8).length}</p>
                  <p>Very negative (&lt; -0.8): {results.filter(r => r.score < -0.8).length}</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Select a view to see insights</div>;
    }
  };

  return (
    <div className={`sentiment-insights ${className}`} data-testid="sentiment-insights">
      <div className="insights-header">
        <div className="header-left">
          <h2>📈 Sentiment Analysis Insights</h2>
          <p>{insights.summary.totalCount.toLocaleString()} results analyzed</p>
        </div>
        
        {onExportInsights && (
          <button
            className="export-insights-button"
            onClick={handleExportInsights}
            disabled={isExporting}
            data-testid="export-insights-button"
          >
            {isExporting ? '📤 Exporting...' : '📤 Export Insights'}
          </button>
        )}
      </div>

      <div className="insights-navigation" data-testid="insights-navigation">
        {(['overview', 'keywords', 'emotions', 'patterns'] as const).map(view => (
          <button
            key={view}
            className={`nav-button ${activeView === view ? 'active' : ''}`}
            onClick={() => setActiveView(view)}
            data-testid={`insights-nav-${view}`}
          >
            {view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      <div className="insights-content" data-testid="insights-content">
        {renderInsightContent()}
      </div>

      <ApiErrorDisplay
        error={apiError}
        context="Sentiment Insights"
        onRetry={handleExportInsights}
        onDismiss={() => setApiError(null)}
      />
    </div>
  );
};