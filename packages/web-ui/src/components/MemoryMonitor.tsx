import React, { useState, useEffect } from 'react';
import { useMemoryMonitor, type MemoryStats } from '../hooks/useMemoryMonitor';
import { ProgressIndicator } from './ProgressIndicator';
import './MemoryMonitor.css';

interface MemoryMonitorProps {
  compact?: boolean;
  showHistory?: boolean;
  showRecommendations?: boolean;
  autoHide?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  className?: string;
}

export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({
  compact = false,
  showHistory = false,
  showRecommendations = true,
  autoHide = false,
  position = 'bottom-right',
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isVisible, setIsVisible] = useState(true);
  
  const {
    isSupported,
    currentStats,
    alertLevel,
    history,
    memoryPressure,
    recommendations,
    trend,
    formatMemorySize,
    clearHistory,
    forceCleanup,
    triggerGarbageCollection
  } = useMemoryMonitor({
    enabled: true,
    interval: 3000, // Update every 3 seconds
    autoCleanup: true,
    thresholds: {
      warning: 70,
      critical: 85,
      emergency: 95
    }
  });

  // Auto-hide logic
  useEffect(() => {
    if (autoHide && memoryPressure === 'low') {
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, memoryPressure]);

  // Auto-expand on high memory usage
  useEffect(() => {
    if (memoryPressure === 'high' || memoryPressure === 'critical') {
      setIsExpanded(true);
    }
  }, [memoryPressure]);

  if (!isSupported) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const getPressureColor = (pressure: string): string => {
    switch (pressure) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      default: return '#10b981';
    }
  };

  const getPressureIcon = (pressure: string): string => {
    switch (pressure) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      default: return '✅';
    }
  };

  const getTrendIcon = (direction: string): string => {
    switch (direction) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const renderCompactView = () => (
    <div 
      className="memory-indicator-compact"
      onClick={() => setIsExpanded(true)}
      style={{ borderColor: getPressureColor(memoryPressure) }}
      data-testid="memory-indicator-compact"
    >
      <div className="memory-icon">
        {getPressureIcon(memoryPressure)}
      </div>
      <div className="memory-percentage" data-testid="memory-percentage">
        {currentStats ? `${currentStats.percentage.toFixed(0)}%` : '--'}
      </div>
    </div>
  );

  const renderFullView = () => (
    <div className="memory-monitor-panel" data-testid="memory-monitor-panel">
      <div className="monitor-header">
        <div className="header-left">
          <span className="monitor-title">Memory Usage</span>
          <span className="pressure-indicator" style={{ color: getPressureColor(memoryPressure) }} data-testid="pressure-indicator">
            {getPressureIcon(memoryPressure)} {memoryPressure.toUpperCase()}
          </span>
        </div>
        <div className="header-actions">
          {compact && (
            <button
              className="collapse-button"
              onClick={() => setIsExpanded(false)}
              title="Collapse"
              data-testid="collapse-memory-monitor"
            >
              ➖
            </button>
          )}
          <button
            className="close-button"
            onClick={() => setIsVisible(false)}
            title="Hide"
            data-testid="close-memory-monitor"
          >
            ✕
          </button>
        </div>
      </div>

      {currentStats && (
        <div className="memory-stats">
          <div className="main-stats">
            <div className="memory-progress">
              <ProgressIndicator
                value={currentStats.percentage}
                size="large"
                showPercentage
                label={`${formatMemorySize(currentStats.used)} / ${formatMemorySize(currentStats.limit)}`}
                className={`memory-bar pressure-${memoryPressure}`}
              />
            </div>
            
            <div className="trend-indicator">
              <span className="trend-icon">{getTrendIcon(trend.direction)}</span>
              <span className="trend-text">
                {trend.direction === 'stable' ? 'Stable' : 
                 `${trend.direction === 'up' ? 'Increasing' : 'Decreasing'} at ${formatMemorySize(trend.rate)}/s`}
              </span>
            </div>
          </div>

          <div className="detailed-stats">
            <div className="stat-row">
              <span className="stat-label">Used:</span>
              <span className="stat-value">{formatMemorySize(currentStats.used)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Available:</span>
              <span className="stat-value">{formatMemorySize(currentStats.available)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Heap:</span>
              <span className="stat-value">{formatMemorySize(currentStats.total)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Heap Limit:</span>
              <span className="stat-value">{formatMemorySize(currentStats.limit)}</span>
            </div>
          </div>

          {showRecommendations && recommendations.length > 0 && (
            <div className="recommendations">
              <h5>Recommendations:</h5>
              <ul>
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="monitor-actions" data-testid="memory-actions">
            <button
              className="action-button cleanup-button"
              onClick={triggerGarbageCollection}
              title="Trigger garbage collection"
              data-testid="memory-cleanup-button"
            >
              🗑️ Cleanup
            </button>
            
            {(memoryPressure === 'high' || memoryPressure === 'critical') && (
              <button
                className="action-button emergency-button"
                onClick={forceCleanup}
                title="Force emergency cleanup"
                data-testid="emergency-cleanup-button"
              >
                🚨 Emergency Cleanup
              </button>
            )}
            
            {showHistory && history.length > 0 && (
              <button
                className="action-button clear-button"
                onClick={clearHistory}
                title="Clear history"
                data-testid="clear-history-button"
              >
                📊 Clear History
              </button>
            )}
          </div>

          {showHistory && history.length > 0 && (
            <div className="memory-history" data-testid="memory-history">
              <h5>Memory History (Last {history.length} readings):</h5>
              <div className="history-chart" data-testid="memory-history-chart">
                {history.slice(-20).map((entry, index) => {
                  const height = (entry.stats.percentage / 100) * 40;
                  return (
                    <div
                      key={index}
                      className="history-bar"
                      style={{
                        height: `${height}px`,
                        backgroundColor: getPressureColor(
                          entry.stats.percentage >= 95 ? 'critical' :
                          entry.stats.percentage >= 85 ? 'high' :
                          entry.stats.percentage >= 70 ? 'medium' : 'low'
                        )
                      }}
                      title={`${entry.stats.percentage.toFixed(1)}% at ${new Date(entry.timestamp).toLocaleTimeString()}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div 
      className={`memory-monitor ${position} ${alertLevel} ${className}`}
      data-testid="memory-monitor"
    >
      {isExpanded ? renderFullView() : renderCompactView()}
    </div>
  );
};

export const MemoryAlert: React.FC<{ stats: MemoryStats; onDismiss: () => void }> = ({
  stats,
  onDismiss
}) => {
  const { formatMemorySize } = useMemoryMonitor({ enabled: false });
  const pressure = stats.percentage >= 95 ? 'critical' : 
                  stats.percentage >= 85 ? 'high' : 'medium';

  return (
    <div className={`memory-alert alert-${pressure}`}>
      <div className="alert-content">
        <div className="alert-icon">
          {pressure === 'critical' ? '🚨' : pressure === 'high' ? '⚠️' : '⚡'}
        </div>
        <div className="alert-message">
          <strong>Memory Usage {pressure === 'critical' ? 'Critical' : 'High'}</strong>
          <p>
            Using {stats.percentage.toFixed(1)}% ({formatMemorySize(stats.used)}) of available memory.
            {pressure === 'critical' && ' Browser may become unresponsive.'}
          </p>
        </div>
        <button className="alert-dismiss" onClick={onDismiss}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default MemoryMonitor;