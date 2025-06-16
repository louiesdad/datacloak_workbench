import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import './RealTimeSentimentFeed.css';

interface SentimentEvent {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  timestamp: Date;
  piiDetected?: boolean;
  model?: string;
}

interface RealTimeSentimentFeedProps {
  maxItems?: number;
  autoScroll?: boolean;
  showDetails?: boolean;
  filterSentiment?: 'all' | 'positive' | 'negative' | 'neutral';
  onItemClick?: (item: SentimentEvent) => void;
}

export const RealTimeSentimentFeed: React.FC<RealTimeSentimentFeedProps> = ({
  maxItems = 50,
  autoScroll = true,
  showDetails = true,
  filterSentiment = 'all',
  onItemClick
}) => {
  const [items, setItems] = useState<SentimentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    positive: 0,
    negative: 0,
    neutral: 0,
    total: 0,
    avgConfidence: 0,
    piiDetected: 0
  });
  const feedRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      case 'neutral': return '#6b7280';
      default: return '#9ca3af';
    }
  };

  const getSentimentEmoji = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'neutral': return '😐';
      default: return '❓';
    }
  };

  const updateStats = useCallback((newItems: SentimentEvent[]) => {
    const counts = newItems.reduce((acc, item) => {
      acc[item.sentiment]++;
      acc.total++;
      acc.totalConfidence += item.confidence;
      if (item.piiDetected) acc.piiDetected++;
      return acc;
    }, {
      positive: 0,
      negative: 0,
      neutral: 0,
      total: 0,
      totalConfidence: 0,
      piiDetected: 0
    });

    setStats({
      positive: counts.positive,
      negative: counts.negative,
      neutral: counts.neutral,
      total: counts.total,
      avgConfidence: counts.total > 0 ? counts.totalConfidence / counts.total : 0,
      piiDetected: counts.piiDetected
    });
  }, []);

  const addSentimentEvent = useCallback((event: any) => {
    const newEvent: SentimentEvent = {
      id: event.id || `${Date.now()}-${Math.random()}`,
      text: event.text,
      sentiment: event.sentiment,
      score: event.score,
      confidence: event.confidence,
      timestamp: new Date(event.timestamp || Date.now()),
      piiDetected: event.piiDetected,
      model: event.model
    };

    setItems(prevItems => {
      const updatedItems = [newEvent, ...prevItems];
      const filteredItems = filterSentiment === 'all' 
        ? updatedItems 
        : updatedItems.filter(item => item.sentiment === filterSentiment);
      
      const trimmedItems = filteredItems.slice(0, maxItems);
      updateStats(trimmedItems);
      
      if (autoScroll && feedRef.current) {
        setTimeout(() => {
          feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }
      
      return trimmedItems;
    });
  }, [filterSentiment, maxItems, autoScroll, updateStats]);

  useEffect(() => {
    // Subscribe to WebSocket events through the existing WebSocketStatus component
    const handleWebSocketMessage = (event: CustomEvent) => {
      const data = event.detail;
      
      if (data.type === 'sentiment_complete' || data.type === 'sentiment_progress') {
        if (data.data && data.data.result) {
          addSentimentEvent(data.data.result);
        }
      }
    };

    window.addEventListener('websocket:message', handleWebSocketMessage as EventListener);

    return () => {
      window.removeEventListener('websocket:message', handleWebSocketMessage as EventListener);
    };
  }, [addSentimentEvent]);

  const formatScore = (score: number): string => {
    return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
  };

  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(0)}%`;
  };

  const renderStatsBar = () => {
    const total = stats.total || 1; // Prevent division by zero
    const positivePercent = (stats.positive / total) * 100;
    const negativePercent = (stats.negative / total) * 100;
    const neutralPercent = (stats.neutral / total) * 100;

    return (
      <div className="sentiment-stats">
        <div className="stats-bar">
          <div 
            className="stats-segment positive" 
            style={{ width: `${positivePercent}%` }}
            title={`Positive: ${stats.positive} (${positivePercent.toFixed(1)}%)`}
          />
          <div 
            className="stats-segment neutral" 
            style={{ width: `${neutralPercent}%` }}
            title={`Neutral: ${stats.neutral} (${neutralPercent.toFixed(1)}%)`}
          />
          <div 
            className="stats-segment negative" 
            style={{ width: `${negativePercent}%` }}
            title={`Negative: ${stats.negative} (${negativePercent.toFixed(1)}%)`}
          />
        </div>
        
        <div className="stats-details">
          <div className="stat-item">
            <span className="stat-emoji">😊</span>
            <span className="stat-value">{stats.positive}</span>
          </div>
          <div className="stat-item">
            <span className="stat-emoji">😐</span>
            <span className="stat-value">{stats.neutral}</span>
          </div>
          <div className="stat-item">
            <span className="stat-emoji">😞</span>
            <span className="stat-value">{stats.negative}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Conf:</span>
            <span className="stat-value">{formatConfidence(stats.avgConfidence)}</span>
          </div>
          {stats.piiDetected > 0 && (
            <div className="stat-item warning">
              <span className="stat-label">PII:</span>
              <span className="stat-value">{stats.piiDetected}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="realtime-sentiment-feed" data-testid="realtime-sentiment-feed">
      <div className="feed-header">
        <h3>
          <span className="feed-icon">📊</span>
          Real-time Sentiment Analysis
        </h3>
        
        <div className="feed-controls">
          <div className="filter-buttons">
            <button
              className={`filter-button ${filterSentiment === 'all' ? 'active' : ''}`}
              onClick={() => setFilterSentiment('all')}
            >
              All
            </button>
            <button
              className={`filter-button positive ${filterSentiment === 'positive' ? 'active' : ''}`}
              onClick={() => setFilterSentiment('positive')}
            >
              Positive
            </button>
            <button
              className={`filter-button neutral ${filterSentiment === 'neutral' ? 'active' : ''}`}
              onClick={() => setFilterSentiment('neutral')}
            >
              Neutral
            </button>
            <button
              className={`filter-button negative ${filterSentiment === 'negative' ? 'active' : ''}`}
              onClick={() => setFilterSentiment('negative')}
            >
              Negative
            </button>
          </div>
          
          <div className="feed-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {stats.total > 0 && renderStatsBar()}

      <div className="feed-content" ref={feedRef}>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💭</div>
            <p>Waiting for sentiment analysis events...</p>
          </div>
        ) : (
          <div className="sentiment-items">
            {items.map((item) => (
              <div
                key={item.id}
                className={`sentiment-item ${item.sentiment}`}
                onClick={() => onItemClick?.(item)}
                data-testid="sentiment-item"
              >
                <div className="item-header">
                  <span className="sentiment-emoji">
                    {getSentimentEmoji(item.sentiment)}
                  </span>
                  <span 
                    className="sentiment-label"
                    style={{ color: getSentimentColor(item.sentiment) }}
                  >
                    {item.sentiment.toUpperCase()}
                  </span>
                  <span className="timestamp">
                    {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                  </span>
                </div>
                
                <div className="item-text">
                  {item.text.length > 150 
                    ? `${item.text.substring(0, 150)}...` 
                    : item.text}
                </div>
                
                {showDetails && (
                  <div className="item-details">
                    <span className="detail-item">
                      Score: <strong>{formatScore(item.score)}</strong>
                    </span>
                    <span className="detail-item">
                      Confidence: <strong>{formatConfidence(item.confidence)}</strong>
                    </span>
                    {item.model && (
                      <span className="detail-item">
                        Model: <strong>{item.model}</strong>
                      </span>
                    )}
                    {item.piiDetected && (
                      <span className="detail-item warning">
                        ⚠️ PII Detected
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeSentimentFeed;