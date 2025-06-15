import React, { useState, useEffect, useMemo } from 'react';
import type { 
  SentimentResult,
  SentimentStatistics,
  ExportDataRequest 
} from '../../../../shared/contracts/api';
import { VirtualTable, PerformantList } from './VirtualScrollList';
import { ProgressIndicator } from './ProgressIndicator';
import { SentimentInsights } from './SentimentInsights';
import { ExportErrorHandler } from './ExportErrorHandler';
import { useDebounce } from '../hooks/useDebounce';
import './ResultExplorer.css';

interface ResultExplorerProps {
  results: SentimentResult[];
  onExport?: (format: 'csv' | 'excel' | 'json') => void;
  onClose?: () => void;
}

interface ChartData {
  labels: string[];
  values: number[];
  colors: string[];
}

interface FilterOptions {
  sentiment: 'all' | 'positive' | 'negative' | 'neutral';
  dateRange: 'all' | 'today' | 'week' | 'month';
  confidenceMin: number;
  searchTerm: string;
}

export const ResultExplorer: React.FC<ResultExplorerProps> = ({
  results,
  onExport,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'insights' | 'charts' | 'export'>('overview');
  const [filters, setFilters] = useState<FilterOptions>({
    sentiment: 'all',
    dateRange: 'all',
    confidenceMin: 0,
    searchTerm: ''
  });
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<SentimentStatistics | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'score'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'text', 'sentiment', 'score', 'confidence', 'keywords', 'createdAt'
  ]);
  
  // Debounce search term for better performance
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300);

  // Filter and sort results
  const filteredResults = useMemo(() => {
    let filtered = results.filter(result => {
      // Sentiment filter
      if (filters.sentiment !== 'all' && result.sentiment !== filters.sentiment) {
        return false;
      }

      // Confidence filter
      if (result.confidence < filters.confidenceMin) {
        return false;
      }

      // Search filter (using debounced value)
      if (debouncedSearchTerm && !result.text.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) {
        return false;
      }

      // Date range filter
      const resultDate = new Date(result.createdAt);
      const now = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          return resultDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return resultDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return resultDate >= monthAgo;
        default:
          return true;
      }
    });

    // Sort results
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [results, filters.sentiment, filters.dateRange, filters.confidenceMin, debouncedSearchTerm, sortBy, sortDirection]);

  // Calculate statistics
  const calculatedStats = useMemo(() => {
    if (filteredResults.length === 0) return null;

    const positive = filteredResults.filter(r => r.sentiment === 'positive').length;
    const negative = filteredResults.filter(r => r.sentiment === 'negative').length;
    const neutral = filteredResults.filter(r => r.sentiment === 'neutral').length;
    
    const averageScore = filteredResults.reduce((sum, r) => sum + r.score, 0) / filteredResults.length;
    const averageConfidence = filteredResults.reduce((sum, r) => sum + r.confidence, 0) / filteredResults.length;

    // Extract top keywords
    const keywordFreq: Record<string, number> = {};
    filteredResults.forEach(result => {
      if (result.keywords) {
        result.keywords.forEach(keyword => {
          keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
        });
      }
    });

    const topKeywords = Object.entries(keywordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, frequency]) => ({ keyword, frequency, averageScore: 0 }));

    return {
      totalAnalyses: filteredResults.length,
      averageScore,
      distribution: {
        positive: (positive / filteredResults.length) * 100,
        negative: (negative / filteredResults.length) * 100,
        neutral: (neutral / filteredResults.length) * 100
      },
      averageConfidence,
      topKeywords
    };
  }, [filteredResults]);

  // Chart data for sentiment distribution
  const sentimentChartData: ChartData = useMemo(() => {
    if (!calculatedStats) return { labels: [], values: [], colors: [] };

    return {
      labels: ['Positive', 'Negative', 'Neutral'],
      values: [
        calculatedStats.distribution.positive,
        calculatedStats.distribution.negative,
        calculatedStats.distribution.neutral
      ],
      colors: ['#10b981', '#ef4444', '#6b7280']
    };
  }, [calculatedStats]);

  // Chart data for score distribution
  const scoreChartData: ChartData = useMemo(() => {
    const buckets = Array(10).fill(0);
    filteredResults.forEach(result => {
      const bucketIndex = Math.min(Math.floor((result.score + 1) * 5), 9);
      buckets[bucketIndex]++;
    });

    return {
      labels: buckets.map((_, i) => `${(i * 0.2 - 1).toFixed(1)} to ${((i + 1) * 0.2 - 1).toFixed(1)}`),
      values: buckets,
      colors: buckets.map((_, i) => {
        const intensity = i / 9;
        return `hsl(${intensity * 120}, 70%, 50%)`; // Green to red gradient
      })
    };
  }, [filteredResults]);

  const handleExport = async (format: 'csv' | 'excel' | 'json') => {
    // This is now handled by ExportErrorHandler
    if (onExport) {
      await onExport(format);
    }
  };

  const toggleResultSelection = (resultId: string) => {
    setSelectedResults(prev => 
      prev.includes(resultId)
        ? prev.filter(id => id !== resultId)
        : [...prev, resultId]
    );
  };

  const selectAllResults = () => {
    if (selectedResults.length === filteredResults.length) {
      setSelectedResults([]);
    } else {
      setSelectedResults(filteredResults.map(r => r.id));
    }
  };

  const renderSimpleChart = (data: ChartData, type: 'pie' | 'bar' = 'pie') => {
    if (data.values.length === 0) return null;

    const maxValue = Math.max(...data.values);

    if (type === 'pie') {
      const total = data.values.reduce((sum, val) => sum + val, 0);
      let cumulativePercentage = 0;

      return (
        <div className="simple-pie-chart">
          <svg viewBox="0 0 200 200" className="pie-svg">
            {data.values.map((value, index) => {
              const percentage = (value / total) * 100;
              const startAngle = cumulativePercentage * 3.6; // Convert to degrees
              const endAngle = (cumulativePercentage + percentage) * 3.6;
              
              cumulativePercentage += percentage;
              
              const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
              const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
              const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
              const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
              
              const largeArcFlag = percentage > 50 ? 1 : 0;
              
              return (
                <path
                  key={index}
                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                  fill={data.colors[index]}
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          <div className="chart-legend">
            {data.labels.map((label, index) => (
              <div key={index} className="legend-item">
                <div 
                  className="legend-color" 
                  style={{ backgroundColor: data.colors[index] }}
                ></div>
                <span>{label}: {data.values[index].toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Bar chart
    return (
      <div className="simple-bar-chart">
        {data.labels.map((label, index) => (
          <div key={index} className="bar-item">
            <div className="bar-label">{label}</div>
            <div className="bar-container">
              <div 
                className="bar-fill" 
                style={{ 
                  width: `${(data.values[index] / maxValue) * 100}%`,
                  backgroundColor: data.colors[index]
                }}
              ></div>
            </div>
            <div className="bar-value">{data.values[index]}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Results</h3>
                <div className="stat-value">{filteredResults.length.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <h3>Average Score</h3>
                <div className="stat-value">
                  {calculatedStats?.averageScore.toFixed(3) || '0.000'}
                </div>
              </div>
              <div className="stat-card">
                <h3>Average Confidence</h3>
                <div className="stat-value">
                  {calculatedStats ? (calculatedStats.averageConfidence * 100).toFixed(1) : '0.0'}%
                </div>
              </div>
              <div className="stat-card">
                <h3>Most Positive</h3>
                <div className="stat-value">
                  {calculatedStats?.distribution.positive.toFixed(1) || '0.0'}%
                </div>
              </div>
            </div>

            <div className="overview-charts">
              <div className="chart-section">
                <h4>Sentiment Distribution</h4>
                {renderSimpleChart(sentimentChartData, 'pie')}
              </div>
              
              <div className="keywords-section">
                <h4>Top Keywords</h4>
                <div className="keywords-list">
                  {calculatedStats?.topKeywords.slice(0, 8).map(({ keyword, frequency }) => (
                    <div key={keyword} className="keyword-item">
                      <span className="keyword">{keyword}</span>
                      <span className="frequency">{frequency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Quick export buttons */}
            <div className="quick-export-section">
              <h4>Quick Export</h4>
              <div className="quick-export-buttons">
                <button
                  className="export-quick-button"
                  onClick={() => {
                    const exportData = selectedResults.length > 0 
                      ? filteredResults.filter(r => selectedResults.includes(r.id))
                      : filteredResults;
                    exportHandler.exportData(exportData, 'csv', 'sentiment-results', { selectedColumns });
                  }}
                  disabled={exportHandler.isExporting}
                  data-testid="quick-export-csv"
                  title="Export all results as CSV"
                >
                  📊 CSV
                </button>
                <button
                  className="export-quick-button"
                  onClick={() => {
                    const exportData = selectedResults.length > 0 
                      ? filteredResults.filter(r => selectedResults.includes(r.id))
                      : filteredResults;
                    exportHandler.exportData(exportData, 'excel', 'sentiment-results', { selectedColumns });
                  }}
                  disabled={exportHandler.isExporting}
                  data-testid="quick-export-excel"
                  title="Export all results as Excel"
                >
                  📋 Excel
                </button>
                <button
                  className="export-quick-button"
                  onClick={() => {
                    const exportData = selectedResults.length > 0 
                      ? filteredResults.filter(r => selectedResults.includes(r.id))
                      : filteredResults;
                    exportHandler.exportData(exportData, 'json', 'sentiment-results', { selectedColumns });
                  }}
                  disabled={exportHandler.isExporting}
                  data-testid="quick-export-json"
                  title="Export all results as JSON"
                >
                  📄 JSON
                </button>
              </div>
            </div>
          </div>
        );

      case 'details':
        return (
          <div className="details-tab">
            <div className="results-header">
              <div className="results-count">
                {filteredResults.length} results 
                {selectedResults.length > 0 && ` (${selectedResults.length} selected)`}
              </div>
              <div className="results-actions">
                <button 
                  className="select-all-button"
                  onClick={selectAllResults}
                >
                  {selectedResults.length === filteredResults.length ? 'Deselect All' : 'Select All'}
                </button>
                <select
                  value={`${sortBy}-${sortDirection}`}
                  onChange={(e) => {
                    const [newSortBy, newDirection] = e.target.value.split('-');
                    setSortBy(newSortBy as any);
                    setSortDirection(newDirection as any);
                  }}
                >
                  <option value="date-desc">Date (Newest)</option>
                  <option value="date-asc">Date (Oldest)</option>
                  <option value="score-desc">Score (Highest)</option>
                  <option value="score-asc">Score (Lowest)</option>
                  <option value="confidence-desc">Confidence (Highest)</option>
                  <option value="confidence-asc">Confidence (Lowest)</option>
                </select>
              </div>
            </div>

            <PerformantList
              items={filteredResults}
              height={600}
              estimatedItemHeight={120}
              threshold={50}
              className="results-list"
              testId="results-list"
              renderItem={(result, index) => (
                <div 
                  className={`result-item ${selectedResults.includes(result.id) ? 'selected' : ''}`}
                >
                  <div className="result-header">
                    <label className="result-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedResults.includes(result.id)}
                        onChange={() => toggleResultSelection(result.id)}
                      />
                    </label>
                    <div className={`sentiment-badge ${result.sentiment}`}>
                      {result.sentiment}
                    </div>
                    <div className="result-scores">
                      <span className="score">Score: {result.score.toFixed(3)}</span>
                      <span className="confidence">Confidence: {(result.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="result-date">
                      {new Date(result.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="result-text">
                    {result.text}
                  </div>
                  
                  {result.keywords && result.keywords.length > 0 && (
                    <div className="result-keywords">
                      {result.keywords.map(keyword => (
                        <span key={keyword} className="keyword-tag">{keyword}</span>
                      ))}
                    </div>
                  )}
                  
                  {result.emotions && (
                    <div className="result-emotions">
                      <h5>Emotions:</h5>
                      <div className="emotions-grid">
                        {Object.entries(result.emotions).map(([emotion, score]) => (
                          <div key={emotion} className="emotion-item">
                            <span className="emotion-name">{emotion}</span>
                            <div className="emotion-bar">
                              <div 
                                className="emotion-fill" 
                                style={{ width: `${score * 100}%` }}
                              ></div>
                            </div>
                            <span className="emotion-score">{(score * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            />
          </div>
        );

      case 'insights':
        return (
          <div className="insights-tab">
            <SentimentInsights
              results={filteredResults}
              onExportInsights={async (insights) => {
                // Could export insights as JSON or PDF
                const blob = new Blob([JSON.stringify(insights, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sentiment-insights.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            />
          </div>
        );

      case 'charts':
        return (
          <div className="charts-tab">
            <div className="charts-grid">
              <div className="chart-container">
                <h4>Sentiment Distribution</h4>
                {renderSimpleChart(sentimentChartData, 'pie')}
              </div>
              
              <div className="chart-container">
                <h4>Score Distribution</h4>
                {renderSimpleChart(scoreChartData, 'bar')}
              </div>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="export-tab">
            <div className="export-options">
              <h4>Export Sentiment Analysis Results</h4>
              <p className="export-description">
                Export {selectedResults.length > 0 ? selectedResults.length : filteredResults.length} results
                {selectedResults.length > 0 ? ' (selected items)' : ' (all filtered items)'}
              </p>

              <div className="export-formats">
                <div className="format-option">
                  <button
                    className="export-button csv"
                    onClick={() => {
                      const exportData = selectedResults.length > 0 
                        ? filteredResults.filter(r => selectedResults.includes(r.id))
                        : filteredResults;
                      exportHandler.exportData(exportData, 'csv', 'sentiment-results', { selectedColumns });
                    }}
                    disabled={exportHandler.isExporting}
                    data-testid="export-csv"
                    aria-label="Export as CSV"
                  >
                    <span className="export-icon">📊</span>
                    <div className="export-details">
                      <span className="format-name">CSV Format</span>
                      <span className="format-description">Comma-separated values, compatible with Excel and Google Sheets</span>
                    </div>
                  </button>
                </div>
                
                <div className="format-option">
                  <button
                    className="export-button excel"
                    onClick={() => {
                      const exportData = selectedResults.length > 0 
                        ? filteredResults.filter(r => selectedResults.includes(r.id))
                        : filteredResults;
                      exportHandler.exportData(exportData, 'excel', 'sentiment-results', { selectedColumns });
                    }}
                    disabled={exportHandler.isExporting}
                    data-testid="export-excel"
                    aria-label="Export as Excel"
                  >
                    <span className="export-icon">📋</span>
                    <div className="export-details">
                      <span className="format-name">Excel Format</span>
                      <span className="format-description">Tab-separated format optimized for Microsoft Excel</span>
                    </div>
                  </button>
                </div>
                
                <div className="format-option">
                  <button
                    className="export-button json"
                    onClick={() => {
                      const exportData = selectedResults.length > 0 
                        ? filteredResults.filter(r => selectedResults.includes(r.id))
                        : filteredResults;
                      exportHandler.exportData(exportData, 'json', 'sentiment-results', { selectedColumns });
                    }}
                    disabled={exportHandler.isExporting}
                    data-testid="export-json"
                    aria-label="Export as JSON"
                  >
                    <span className="export-icon">📄</span>
                    <div className="export-details">
                      <span className="format-name">JSON Format</span>
                      <span className="format-description">Structured data format for developers and APIs</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="export-columns">
                <h5>Select columns to export:</h5>
                <div className="column-selection">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('text')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('text') 
                            ? prev.filter(c => c !== 'text')
                            : [...prev, 'text']
                        );
                      }}
                    />
                    Text content
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('sentiment')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('sentiment') 
                            ? prev.filter(c => c !== 'sentiment')
                            : [...prev, 'sentiment']
                        );
                      }}
                    />
                    Sentiment classification
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('score')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('score') 
                            ? prev.filter(c => c !== 'score')
                            : [...prev, 'score']
                        );
                      }}
                    />
                    Sentiment score
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('confidence')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('confidence') 
                            ? prev.filter(c => c !== 'confidence')
                            : [...prev, 'confidence']
                        );
                      }}
                    />
                    Confidence score
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('keywords')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('keywords') 
                            ? prev.filter(c => c !== 'keywords')
                            : [...prev, 'keywords']
                        );
                      }}
                    />
                    Extracted keywords
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes('createdAt')}
                      onChange={() => {
                        setSelectedColumns(prev => 
                          prev.includes('createdAt') 
                            ? prev.filter(c => c !== 'createdAt')
                            : [...prev, 'createdAt']
                        );
                      }}
                    />
                    Creation timestamp
                  </label>
                  {results.some(r => r.emotions) && (
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes('emotions')}
                        onChange={() => {
                          setSelectedColumns(prev => 
                            prev.includes('emotions') 
                              ? prev.filter(c => c !== 'emotions')
                              : [...prev, 'emotions']
                          );
                        }}
                      />
                      Emotion analysis
                    </label>
                  )}
                </div>
              </div>

              {exportHandler.isExporting && (
                <div className="export-progress">
                  <ProgressIndicator
                    value={exportHandler.progress}
                    label={exportHandler.currentOperation}
                    size="medium"
                    showPercentage
                    testId="export-progress"
                  />
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ExportErrorHandler
      fallbackFormats={['csv', 'json', 'txt']}
      maxRetries={3}
      chunkSize={10000}
    >
      {(exportHandler) => (
        <div className="result-explorer">
          <div className="explorer-header">
            <div className="header-left">
              <h2>Sentiment Analysis Results</h2>
              <p>{results.length} total results</p>
            </div>
            <div className="header-actions">
              {onClose && (
                <button className="close-button" onClick={onClose}>×</button>
              )}
            </div>
          </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Sentiment:</label>
          <select
            value={filters.sentiment}
            onChange={(e) => setFilters(prev => ({ ...prev, sentiment: e.target.value as any }))}
          >
            <option value="all">All</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Date Range:</label>
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Min Confidence:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={filters.confidenceMin}
            onChange={(e) => setFilters(prev => ({ ...prev, confidenceMin: parseFloat(e.target.value) }))}
          />
          <span>{(filters.confidenceMin * 100).toFixed(0)}%</span>
        </div>

        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search in text..."
            value={filters.searchTerm}
            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
          />
        </div>
      </div>

      <div className="explorer-tabs">
        {(['overview', 'details', 'insights', 'charts', 'export'] as const).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

          <div className="tab-content">
            {renderTabContent()}
          </div>
        </div>
      )}
    </ExportErrorHandler>
  );
};