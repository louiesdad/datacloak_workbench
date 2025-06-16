import { websocketService } from './websocket.service';
import { eventEmitter } from './event.service';
import { getSQLiteConnection } from '../database/sqlite';
import { SentimentAnalysisResult } from './sentiment.service';

export interface SentimentFeedItem {
  id: number;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  timestamp: string;
  processingTimeMs?: number;
  piiDetected?: boolean;
}

export interface SentimentMetrics {
  totalAnalyses: number;
  recentAnalyses: number; // Last hour
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  averageScore: number;
  averageConfidence: number;
  trendsData: {
    timestamps: string[];
    scores: number[];
    volumes: number[];
  };
}

export class RealTimeSentimentFeedService {
  private isInitialized = false;
  private metricsInterval?: NodeJS.Timer;
  private feedUpdateInterval?: NodeJS.Timer;

  initialize(): void {
    if (this.isInitialized) return;

    this.setupEventListeners();
    this.startMetricsUpdates();
    this.startFeedUpdates();
    
    this.isInitialized = true;
    console.log('Real-time sentiment feed service initialized');
  }

  private setupEventListeners(): void {
    // Listen for new sentiment analysis results
    eventEmitter.on('sentiment:analyzed', (result: SentimentAnalysisResult) => {
      this.broadcastNewSentiment(result);
    });

    // Listen for batch sentiment completion
    eventEmitter.on('sentiment:batch_complete', (results: SentimentAnalysisResult[]) => {
      this.broadcastBatchUpdate(results);
    });

    // Listen for sentiment processing progress
    eventEmitter.on('sentiment:processing', (data: any) => {
      this.broadcastProcessingUpdate(data);
    });
  }

  private broadcastNewSentiment(result: SentimentAnalysisResult): void {
    const feedItem: SentimentFeedItem = {
      id: result.id || 0,
      text: result.text.length > 100 ? result.text.substring(0, 100) + '...' : result.text,
      sentiment: result.sentiment,
      score: result.score,
      confidence: result.confidence,
      timestamp: result.createdAt || new Date().toISOString(),
      processingTimeMs: result.processingTimeMs,
      piiDetected: result.piiDetected
    };

    websocketService.broadcast({
      type: 'sentiment_new',
      data: feedItem
    }, { topic: 'sentiment_feed' });
  }

  private broadcastBatchUpdate(results: SentimentAnalysisResult[]): void {
    const summary = {
      count: results.length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      distribution: {
        positive: results.filter(r => r.sentiment === 'positive').length,
        negative: results.filter(r => r.sentiment === 'negative').length,
        neutral: results.filter(r => r.sentiment === 'neutral').length,
      }
    };

    websocketService.broadcast({
      type: 'sentiment_batch_complete',
      data: summary
    }, { topic: 'sentiment_feed' });
  }

  private broadcastProcessingUpdate(data: any): void {
    websocketService.broadcast({
      type: 'sentiment_processing',
      data
    }, { topic: 'sentiment_feed' });
  }

  private startMetricsUpdates(): void {
    // Update metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.generateMetrics();
        websocketService.broadcast({
          type: 'sentiment_metrics',
          data: metrics
        }, { topic: 'sentiment_metrics' });
      } catch (error) {
        console.error('Error generating sentiment metrics:', error);
      }
    }, 30000);
  }

  private startFeedUpdates(): void {
    // Send recent sentiment updates every 10 seconds
    this.feedUpdateInterval = setInterval(async () => {
      try {
        const recentSentiments = await this.getRecentSentiments(20);
        websocketService.broadcast({
          type: 'sentiment_feed_update',
          data: { items: recentSentiments }
        }, { topic: 'sentiment_feed' });
      } catch (error) {
        console.error('Error getting recent sentiments:', error);
      }
    }, 10000);
  }

  async generateMetrics(): Promise<SentimentMetrics> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Get total analyses count
    const totalResult = db.prepare('SELECT COUNT(*) as total FROM sentiment_analyses').get() as { total: number };
    
    // Get recent analyses (last hour)
    const recentResult = db.prepare(`
      SELECT COUNT(*) as recent 
      FROM sentiment_analyses 
      WHERE created_at >= datetime('now', '-1 hour')
    `).get() as { recent: number };

    // Get sentiment distribution
    const distributionResult = db.prepare(`
      SELECT sentiment, COUNT(*) as count
      FROM sentiment_analyses
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY sentiment
    `).all() as { sentiment: string; count: number }[];

    const distribution = {
      positive: 0,
      negative: 0,
      neutral: 0
    };

    distributionResult.forEach(row => {
      if (row.sentiment in distribution) {
        distribution[row.sentiment as keyof typeof distribution] = row.count;
      }
    });

    // Get average score and confidence
    const avgResult = db.prepare(`
      SELECT AVG(score) as avgScore, AVG(confidence) as avgConfidence
      FROM sentiment_analyses
      WHERE created_at >= datetime('now', '-24 hours')
    `).get() as { avgScore: number; avgConfidence: number };

    // Get trends data (last 24 hours, hourly buckets)
    const trendsResult = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as hour,
        AVG(score) as avgScore,
        COUNT(*) as volume
      FROM sentiment_analyses
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY strftime('%Y-%m-%d %H:00:00', created_at)
      ORDER BY hour
    `).all() as { hour: string; avgScore: number; volume: number }[];

    return {
      totalAnalyses: totalResult.total,
      recentAnalyses: recentResult.recent,
      sentimentDistribution: distribution,
      averageScore: Number((avgResult.avgScore || 0).toFixed(3)),
      averageConfidence: Number((avgResult.avgConfidence || 0).toFixed(3)),
      trendsData: {
        timestamps: trendsResult.map(row => row.hour),
        scores: trendsResult.map(row => Number(row.avgScore.toFixed(3))),
        volumes: trendsResult.map(row => row.volume)
      }
    };
  }

  async getRecentSentiments(limit: number = 20): Promise<SentimentFeedItem[]> {
    const db = getSQLiteConnection();
    if (!db) {
      return [];
    }

    const results = db.prepare(`
      SELECT id, text, sentiment, score, confidence, created_at
      FROM sentiment_analyses
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return results.map(row => ({
      id: row.id,
      text: row.text.length > 100 ? row.text.substring(0, 100) + '...' : row.text,
      sentiment: row.sentiment,
      score: row.score,
      confidence: row.confidence,
      timestamp: row.created_at
    }));
  }

  async getLiveSentimentStats(): Promise<{
    current: SentimentMetrics;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  }> {
    const currentMetrics = await this.generateMetrics();
    
    // Calculate trend by comparing last hour vs previous hour
    const db = getSQLiteConnection();
    if (!db) {
      return {
        current: currentMetrics,
        trend: 'stable',
        changePercent: 0
      };
    }

    const previousHourResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM sentiment_analyses
      WHERE created_at >= datetime('now', '-2 hours')
      AND created_at < datetime('now', '-1 hour')
    `).get() as { count: number };

    const changePercent = previousHourResult.count > 0 
      ? ((currentMetrics.recentAnalyses - previousHourResult.count) / previousHourResult.count) * 100
      : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (Math.abs(changePercent) > 10) {
      trend = changePercent > 0 ? 'up' : 'down';
    }

    return {
      current: currentMetrics,
      trend,
      changePercent: Number(changePercent.toFixed(1))
    };
  }

  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.feedUpdateInterval) {
      clearInterval(this.feedUpdateInterval);
    }
    this.isInitialized = false;
    console.log('Real-time sentiment feed service shut down');
  }
}

export const realTimeSentimentFeedService = new RealTimeSentimentFeedService();