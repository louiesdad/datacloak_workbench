import { withSQLiteConnection } from '../database/sqlite-refactored';
import { runDuckDB } from '../database/duckdb-pool';
import { AppError } from '../middleware/error.middleware';

export interface SentimentTrend {
  timestamp: string;
  score: number;
  volume: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface KeywordAnalysis {
  word: string;
  frequency: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  contexts: string[];
}

export interface TimeSeriesData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    trend: 'up' | 'down' | 'stable';
    change: number;
  }[];
}

export interface AnalyticsOverview {
  totalAnalyses: number;
  sentimentDistribution: {
    positive: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
  };
  averageScore: number;
  averageConfidence: number;
  topKeywords: KeywordAnalysis[];
  trends: TimeSeriesData;
  insights: string[];
}

export interface TextAnalytics {
  wordFrequency: { word: string; count: number }[];
  sentimentByLength: { range: string; avgScore: number; count: number }[];
  languagePatterns: { pattern: string; frequency: number; sentiment: number }[];
  emotionalIntensity: { hour: number; intensity: number }[];
}

export class AnalyticsService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure database tables exist for analytics
      await this.setupAnalyticsTables();
      this.initialized = true;
      console.log('Analytics service initialized');
    } catch (error) {
      throw new AppError('Failed to initialize analytics service', 500, 'ANALYTICS_INIT_ERROR');
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  private async setupAnalyticsTables(): Promise<void> {
    await withSQLiteConnection(async (db) => {
      // Create analytics summary table
      db.exec(`
      CREATE TABLE IF NOT EXISTS analytics_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_analyses INTEGER DEFAULT 0,
        positive_count INTEGER DEFAULT 0,
        negative_count INTEGER DEFAULT 0,
        neutral_count INTEGER DEFAULT 0,
        avg_score REAL DEFAULT 0,
        avg_confidence REAL DEFAULT 0,
        top_keywords TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date)
      )
    `);

    // Create keyword analytics table
    db.exec(`
      CREATE TABLE IF NOT EXISTS keyword_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        frequency INTEGER DEFAULT 1,
        sentiment_sum REAL DEFAULT 0,
        avg_sentiment REAL DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word)
      )
    `);
    });
  }

  async generateSentimentTrends(
    timeRange: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit: number = 50
  ): Promise<SentimentTrend[]> {
    return await withSQLiteConnection(async (db) => {
      let timeFormat: string;
      let timeFilter: string;

      switch (timeRange) {
        case 'hour':
          timeFormat = '%Y-%m-%d %H:00:00';
          timeFilter = '-24 hours';
          break;
        case 'day':
          timeFormat = '%Y-%m-%d';
          timeFilter = '-30 days';
          break;
        case 'week':
          timeFormat = '%Y-%W';
          timeFilter = '-12 weeks';
          break;
        case 'month':
          timeFormat = '%Y-%m';
          timeFilter = '-12 months';
          break;
      }

      const trends = db.prepare(`
        SELECT 
          strftime('${timeFormat}', created_at) as timestamp,
          AVG(score) as score,
          COUNT(*) as volume,
          sentiment
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '${timeFilter}')
        GROUP BY strftime('${timeFormat}', created_at), sentiment
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit) as any[];

      return trends.map(trend => ({
        timestamp: trend.timestamp,
        score: Number(trend.score.toFixed(3)),
        volume: trend.volume,
        sentiment: trend.sentiment
      }));
    });
  }

  async extractKeywords(limit: number = 100): Promise<KeywordAnalysis[]> {
    return await withSQLiteConnection(async (db) => {
      // Get recent sentiment analyses for keyword extraction
      const texts = db.prepare(`
        SELECT text, sentiment, score
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-7 days')
        ORDER BY created_at DESC
        LIMIT 1000
      `).all() as any[];

      const keywordMap = new Map<string, {
        frequency: number;
        sentimentSum: number;
        sentiments: string[];
        contexts: string[];
      }>();

      // Process texts to extract keywords
      for (const row of texts) {
        const words = this.extractMeaningfulWords(row.text);
        
        for (const word of words) {
          if (!keywordMap.has(word)) {
            keywordMap.set(word, {
              frequency: 0,
              sentimentSum: 0,
              sentiments: [],
              contexts: []
            });
          }

          const data = keywordMap.get(word)!;
          data.frequency++;
          data.sentimentSum += row.score;
          data.sentiments.push(row.sentiment);
          
          // Add context (sentence containing the word)
          const sentences = row.text.split(/[.!?]+/);
          const contextSentence = sentences.find((s: string) => 
            s.toLowerCase().includes(word.toLowerCase())
          );
          if (contextSentence && data.contexts.length < 3) {
            data.contexts.push(contextSentence.trim());
          }
        }
      }

      // Convert to KeywordAnalysis array
      const keywords: KeywordAnalysis[] = [];
      
      keywordMap.forEach((data, word) => {
        const avgScore = data.sentimentSum / data.frequency;
        const sentiment = avgScore > 0.1 ? 'positive' : 
                         avgScore < -0.1 ? 'negative' : 'neutral';

        keywords.push({
          word,
          frequency: data.frequency,
          sentiment,
          score: Number(avgScore.toFixed(3)),
          contexts: data.contexts
        });
      });

      // Sort by frequency and return top results
      return keywords
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit);
    });
  }

  private extractMeaningfulWords(text: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'this', 'have', 'had', 'what', 'when',
      'where', 'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just',
      'should', 'now', 'i', 'you', 'he', 'she', 'we', 'they', 'them', 'him', 'her'
    ]);

    return text
      .toLowerCase()
      .match(/\b[a-zA-Z]{3,}\b/g) // Words with 3+ characters
      ?.filter(word => !stopWords.has(word))
      ?.filter(word => word.length <= 20) // Reasonable max length
      || [];
  }

  async generateTimeSeriesData(
    metrics: string[] = ['volume', 'avgScore', 'avgConfidence'],
    timeRange: 'day' | 'week' | 'month' = 'day'
  ): Promise<TimeSeriesData> {
    return await withSQLiteConnection(async (db) => {
      let timeFormat: string;
      let timeFilter: string;
      let limit: number;

      switch (timeRange) {
        case 'day':
          timeFormat = '%Y-%m-%d %H:00:00';
          timeFilter = '-7 days';
          limit = 168; // 24 hours * 7 days
          break;
        case 'week':
          timeFormat = '%Y-%m-%d';
          timeFilter = '-8 weeks';
          limit = 56; // 7 days * 8 weeks
          break;
        case 'month':
          timeFormat = '%Y-%m-%d';
          timeFilter = '-12 months';
          limit = 365; // Daily data for a year
          break;
      }

      const data = db.prepare(`
        SELECT 
          strftime('${timeFormat}', created_at) as timestamp,
          COUNT(*) as volume,
          AVG(score) as avgScore,
          AVG(confidence) as avgConfidence
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '${timeFilter}')
        GROUP BY strftime('${timeFormat}', created_at)
        ORDER BY timestamp
        LIMIT ?
      `).all(limit) as any[];

      const labels = data.map(row => row.timestamp);
      const datasets: Array<{
        label: string;
        data: number[];
        trend: 'up' | 'down' | 'stable';
        change: number;
      }> = [];

      for (const metric of metrics) {
        const values = data.map(row => Number((row[metric] || 0).toFixed(3)));
        
        // Calculate trend
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        
        const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
        const trend = Math.abs(change) < 5 ? 'stable' : change > 0 ? 'up' : 'down';

        datasets.push({
          label: metric,
          data: values,
          trend,
          change: Number(change.toFixed(1))
        });
      }

      return { labels, datasets };
    });
  }

  async generateAnalyticsOverview(): Promise<AnalyticsOverview> {
    return await withSQLiteConnection(async (db) => {
      // Get total analyses
      const totalResult = db.prepare('SELECT COUNT(*) as total FROM sentiment_analyses').get() as { total: number };

      // Get sentiment distribution
      const distributionResult = db.prepare(`
        SELECT sentiment, COUNT(*) as count
        FROM sentiment_analyses
        GROUP BY sentiment
      `).all() as { sentiment: string; count: number }[];

      const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
      distributionResult.forEach(row => {
        if (row.sentiment in sentimentCounts) {
          sentimentCounts[row.sentiment as keyof typeof sentimentCounts] = row.count;
        }
      });

      const total = totalResult.total;
      const sentimentDistribution = {
        positive: { 
          count: sentimentCounts.positive, 
          percentage: total > 0 ? Number(((sentimentCounts.positive / total) * 100).toFixed(1)) : 0 
        },
        negative: { 
          count: sentimentCounts.negative, 
          percentage: total > 0 ? Number(((sentimentCounts.negative / total) * 100).toFixed(1)) : 0 
        },
        neutral: { 
          count: sentimentCounts.neutral, 
          percentage: total > 0 ? Number(((sentimentCounts.neutral / total) * 100).toFixed(1)) : 0 
        }
      };

      // Get averages
      const avgResult = db.prepare(`
        SELECT AVG(score) as avgScore, AVG(confidence) as avgConfidence
        FROM sentiment_analyses
      `).get() as { avgScore: number; avgConfidence: number };

      // Get top keywords
      const topKeywords = await this.extractKeywords(10);

      // Get trends
      const trends = await this.generateTimeSeriesData(['volume', 'avgScore'], 'day');

      // Generate insights
      const insights = await this.generateInsights();

      return {
        totalAnalyses: total,
        sentimentDistribution,
        averageScore: Number((avgResult.avgScore || 0).toFixed(3)),
        averageConfidence: Number((avgResult.avgConfidence || 0).toFixed(3)),
        topKeywords,
        trends,
        insights
      };
    });
  }

  async generateTextAnalytics(): Promise<TextAnalytics> {
    return await withSQLiteConnection(async (db) => {
      // Word frequency analysis
      const keywords = await this.extractKeywords(50);
      const wordFrequency = keywords.map(k => ({ word: k.word, count: k.frequency }));

      // Sentiment by text length
      const lengthAnalysis = db.prepare(`
        SELECT 
          CASE 
            WHEN LENGTH(text) < 50 THEN 'Short (0-50)'
            WHEN LENGTH(text) < 100 THEN 'Medium (50-100)'
            WHEN LENGTH(text) < 200 THEN 'Long (100-200)'
            ELSE 'Very Long (200+)'
          END as range,
          AVG(score) as avgScore,
          COUNT(*) as count
        FROM sentiment_analyses
        GROUP BY 
          CASE 
            WHEN LENGTH(text) < 50 THEN 'Short (0-50)'
            WHEN LENGTH(text) < 100 THEN 'Medium (50-100)'
            WHEN LENGTH(text) < 200 THEN 'Long (100-200)'
            ELSE 'Very Long (200+)'
          END
        ORDER BY count DESC
      `).all() as any[];

      const sentimentByLength = lengthAnalysis.map(row => ({
        range: row.range,
        avgScore: Number(row.avgScore.toFixed(3)),
        count: row.count
      }));

      // Language patterns (simple patterns for demo)
      const languagePatterns = [
        { pattern: 'Exclamation marks (!)', frequency: 0, sentiment: 0 },
        { pattern: 'Question marks (?)', frequency: 0, sentiment: 0 },
        { pattern: 'All caps words', frequency: 0, sentiment: 0 },
        { pattern: 'Multiple punctuation', frequency: 0, sentiment: 0 }
      ];

      // Emotional intensity by hour
      const hourlyIntensity = db.prepare(`
        SELECT 
          CAST(strftime('%H', created_at) as INTEGER) as hour,
          AVG(ABS(score)) as intensity
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `).all() as any[];

      const emotionalIntensity = hourlyIntensity.map(row => ({
        hour: row.hour,
        intensity: Number(row.intensity.toFixed(3))
      }));

      return {
        wordFrequency,
        sentimentByLength,
        languagePatterns,
        emotionalIntensity
      };
    });
  }

  private async generateInsights(): Promise<string[]> {
    return await withSQLiteConnection(async (db) => {
      const insights: string[] = [];

      try {
        // Recent activity insight
        const recentCount = db.prepare(`
          SELECT COUNT(*) as count 
          FROM sentiment_analyses 
          WHERE created_at >= datetime('now', '-24 hours')
        `).get() as { count: number };

        if (recentCount.count > 0) {
          insights.push(`Analyzed ${recentCount.count} texts in the last 24 hours`);
        }

        // Sentiment trend insight
        const trendData = db.prepare(`
          SELECT AVG(score) as avgScore
          FROM sentiment_analyses
          WHERE created_at >= datetime('now', '-7 days')
        `).get() as { avgScore: number };

        if (trendData.avgScore > 0.2) {
          insights.push('Overall sentiment has been trending positive this week');
        } else if (trendData.avgScore < -0.2) {
          insights.push('Overall sentiment has been trending negative this week');
        }

        // Peak activity insight
        const peakHour = db.prepare(`
          SELECT strftime('%H', created_at) as hour, COUNT(*) as count
          FROM sentiment_analyses
          WHERE created_at >= datetime('now', '-7 days')
          GROUP BY strftime('%H', created_at)
          ORDER BY count DESC
          LIMIT 1
        `).get() as { hour: string; count: number };

        if (peakHour) {
          insights.push(`Peak activity occurs around ${peakHour.hour}:00`);
        }

        // Confidence insight
        const avgConfidence = db.prepare(`
          SELECT AVG(confidence) as avgConfidence
          FROM sentiment_analyses
          WHERE created_at >= datetime('now', '-7 days')
        `).get() as { avgConfidence: number };

        if (avgConfidence.avgConfidence > 0.8) {
          insights.push('High confidence in sentiment predictions (>80%)');
        } else if (avgConfidence.avgConfidence < 0.6) {
          insights.push('Lower confidence scores suggest more nuanced text content');
        }

      } catch (error) {
        console.error('Error generating insights:', error);
      }

      return insights;
    });
  }

  async updateKeywordAnalytics(): Promise<void> {
    const keywords = await this.extractKeywords(1000);
    
    await withSQLiteConnection(async (db) => {
      const updateStmt = db.prepare(`
        INSERT OR REPLACE INTO keyword_analytics 
        (word, frequency, sentiment_sum, avg_sentiment, last_seen)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);

      db.transaction(() => {
        keywords.forEach(keyword => {
          updateStmt.run(
            keyword.word,
            keyword.frequency,
            keyword.score * keyword.frequency,
            keyword.score
          );
        });
      })();
    });
  }
}

export const analyticsService = new AnalyticsService();