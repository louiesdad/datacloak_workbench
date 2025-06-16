import { getSQLiteConnection } from '../database/sqlite';
import { AppError } from '../middleware/error.middleware';
import { analyticsService } from './analytics.service';

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  timestamp: string;
  data?: any;
  actionable: boolean;
  actions?: string[];
}

export interface InsightCategory {
  category: string;
  insights: Insight[];
  summary: string;
  count: number;
}

export interface BusinessInsight {
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  interpretation: string;
  recommendation: string;
}

export class InsightsService {
  private initialized = false;
  private insightGenerators: Map<string, () => Promise<Insight[]>> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.setupInsightGenerators();
    this.initialized = true;
    console.log('Insights service initialized');
  }

  private async setupInsightGenerators(): Promise<void> {
    // Register different types of insight generators
    this.insightGenerators.set('sentiment_trends', this.generateSentimentTrendInsights.bind(this));
    this.insightGenerators.set('volume_patterns', this.generateVolumePatternInsights.bind(this));
    this.insightGenerators.set('keyword_anomalies', this.generateKeywordAnomalyInsights.bind(this));
    this.insightGenerators.set('performance_insights', this.generatePerformanceInsights.bind(this));
    this.insightGenerators.set('business_recommendations', this.generateBusinessRecommendations.bind(this));
  }

  async generateAllInsights(): Promise<InsightCategory[]> {
    const categories: InsightCategory[] = [];

    for (const [category, generator] of this.insightGenerators) {
      try {
        const insights = await generator();
        
        if (insights.length > 0) {
          categories.push({
            category: this.formatCategoryName(category),
            insights,
            summary: this.generateCategorySummary(insights),
            count: insights.length
          });
        }
      } catch (error) {
        console.error(`Error generating insights for category ${category}:`, error);
      }
    }

    return categories;
  }

  private formatCategoryName(category: string): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateCategorySummary(insights: Insight[]): string {
    const highSeverity = insights.filter(i => i.severity === 'high').length;
    const actionable = insights.filter(i => i.actionable).length;

    if (highSeverity > 0) {
      return `${highSeverity} high-priority insights requiring attention`;
    } else if (actionable > 0) {
      return `${actionable} actionable recommendations available`;
    } else {
      return `${insights.length} insights for monitoring and analysis`;
    }
  }

  private async generateSentimentTrendInsights(): Promise<Insight[]> {
    const db = getSQLiteConnection();
    if (!db) return [];

    const insights: Insight[] = [];

    try {
      // Analyze recent sentiment trends
      const recentTrend = db.prepare(`
        SELECT 
          AVG(score) as avgScore,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM sentiment_analyses
        WHERE created_at >= date('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all() as any[];

      if (recentTrend.length >= 3) {
        const scores = recentTrend.map((r: any) => r.avgScore);
        const trend = this.calculateTrend(scores);

        if (trend.direction === 'declining' && trend.confidence > 0.7) {
          insights.push({
            id: 'sentiment_decline',
            type: 'trend',
            title: 'Declining Sentiment Trend Detected',
            description: `Average sentiment score has decreased by ${Math.abs(trend.change).toFixed(1)}% over the past week`,
            severity: trend.change < -20 ? 'high' : 'medium',
            confidence: trend.confidence,
            timestamp: new Date().toISOString(),
            data: { scores, trend },
            actionable: true,
            actions: [
              'Review recent content or feedback sources',
              'Investigate potential issues or complaints',
              'Consider implementing improvement strategies'
            ]
          });
        } else if (trend.direction === 'improving' && trend.confidence > 0.7) {
          insights.push({
            id: 'sentiment_improvement',
            type: 'trend',
            title: 'Positive Sentiment Trend',
            description: `Average sentiment score has improved by ${trend.change.toFixed(1)}% over the past week`,
            severity: 'low',
            confidence: trend.confidence,
            timestamp: new Date().toISOString(),
            data: { scores, trend },
            actionable: true,
            actions: [
              'Identify successful strategies to replicate',
              'Document best practices',
              'Continue monitoring to maintain trend'
            ]
          });
        }
      }

      // Check for sudden spikes or drops
      const hourlyData = db.prepare(`
        SELECT 
          AVG(score) as avgScore,
          COUNT(*) as count,
          strftime('%Y-%m-%d %H:00', created_at) as hour
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY strftime('%Y-%m-%d %H:00', created_at)
        ORDER BY hour
      `).all() as any[];

      const anomalies = this.detectAnomalies(hourlyData.map((h: any) => h.avgScore));
      
      if (anomalies.length > 0) {
        insights.push({
          id: 'sentiment_anomaly',
          type: 'anomaly',
          title: 'Sentiment Anomalies Detected',
          description: `Found ${anomalies.length} unusual sentiment patterns in the last 24 hours`,
          severity: 'medium',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          data: { anomalies, hourlyData },
          actionable: true,
          actions: [
            'Investigate anomalous time periods',
            'Check for external events or changes',
            'Review data quality during anomaly periods'
          ]
        });
      }

    } catch (error) {
      console.error('Error generating sentiment trend insights:', error);
    }

    return insights;
  }

  private async generateVolumePatternInsights(): Promise<Insight[]> {
    const db = getSQLiteConnection();
    if (!db) return [];

    const insights: Insight[] = [];

    try {
      // Analyze volume patterns
      const hourlyVolume = db.prepare(`
        SELECT 
          CAST(strftime('%H', created_at) as INTEGER) as hour,
          COUNT(*) as count
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-7 days')
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `).all() as any[];

      if (hourlyVolume.length > 0) {
        const maxVolume = Math.max(...hourlyVolume.map((h: any) => h.count));
        const peakHours = hourlyVolume.filter((h: any) => h.count > maxVolume * 0.8);

        if (peakHours.length <= 3) {
          insights.push({
            id: 'volume_peak_pattern',
            type: 'pattern',
            title: 'Clear Peak Activity Hours Identified',
            description: `Activity peaks between ${Math.min(...peakHours.map((h: any) => h.hour))}:00 and ${Math.max(...peakHours.map((h: any) => h.hour))}:00`,
            severity: 'low',
            confidence: 0.9,
            timestamp: new Date().toISOString(),
            data: { peakHours, hourlyVolume },
            actionable: true,
            actions: [
              'Schedule content or campaigns during peak hours',
              'Ensure adequate system resources during peaks',
              'Consider time-sensitive analysis during active periods'
            ]
          });
        }
      }

      // Check for unusual volume changes
      const dailyVolume = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM sentiment_analyses
        WHERE created_at >= date('now', '-14 days')
        GROUP BY DATE(created_at)
        ORDER BY date
      `).all() as any[];

      if (dailyVolume.length >= 7) {
        const volumes = dailyVolume.map((d: any) => d.count);
        const recentAvg = volumes.slice(-3).reduce((sum: number, v: number) => sum + v, 0) / 3;
        const previousAvg = volumes.slice(-10, -3).reduce((sum: number, v: number) => sum + v, 0) / 7;
        
        const change = ((recentAvg - previousAvg) / previousAvg) * 100;

        if (Math.abs(change) > 50) {
          insights.push({
            id: 'volume_change',
            type: 'anomaly',
            title: change > 0 ? 'Significant Volume Increase' : 'Significant Volume Decrease',
            description: `Analysis volume has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to the previous week`,
            severity: Math.abs(change) > 100 ? 'high' : 'medium',
            confidence: 0.85,
            timestamp: new Date().toISOString(),
            data: { change, recentAvg, previousAvg, dailyVolume },
            actionable: true,
            actions: change > 0 ? [
              'Investigate source of increased activity',
              'Ensure system capacity can handle increased load',
              'Consider scaling analysis resources'
            ] : [
              'Investigate cause of decreased activity',
              'Check for technical issues or data pipeline problems',
              'Review user engagement or data sources'
            ]
          });
        }
      }

    } catch (error) {
      console.error('Error generating volume pattern insights:', error);
    }

    return insights;
  }

  private async generateKeywordAnomalyInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      const keywords = await analyticsService.extractKeywords(50);
      
      // Find keywords with unusual frequency spikes
      const topKeywords = keywords.slice(0, 10);
      const emergingKeywords = keywords.filter(k => k.frequency > 5 && k.frequency < 20);

      if (emergingKeywords.length > 0) {
        insights.push({
          id: 'emerging_keywords',
          type: 'pattern',
          title: 'Emerging Keywords Detected',
          description: `${emergingKeywords.length} new keywords are gaining traction`,
          severity: 'low',
          confidence: 0.7,
          timestamp: new Date().toISOString(),
          data: { emergingKeywords: emergingKeywords.slice(0, 5) },
          actionable: true,
          actions: [
            'Monitor these keywords for trend development',
            'Investigate context and relevance',
            'Consider incorporating into content strategy'
          ]
        });
      }

      // Find highly negative keywords
      const negativeKeywords = keywords.filter(k => k.sentiment === 'negative' && k.frequency > 3);
      
      if (negativeKeywords.length > 0) {
        insights.push({
          id: 'negative_keywords',
          type: 'recommendation',
          title: 'Negative Keywords Requiring Attention',
          description: `${negativeKeywords.length} keywords are consistently associated with negative sentiment`,
          severity: 'medium',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          data: { negativeKeywords: negativeKeywords.slice(0, 5) },
          actionable: true,
          actions: [
            'Review contexts where these keywords appear',
            'Develop strategies to address underlying issues',
            'Monitor sentiment changes for these terms'
          ]
        });
      }

    } catch (error) {
      console.error('Error generating keyword anomaly insights:', error);
    }

    return insights;
  }

  private async generatePerformanceInsights(): Promise<Insight[]> {
    const db = getSQLiteConnection();
    if (!db) return [];

    const insights: Insight[] = [];

    try {
      // Check confidence levels
      const confidenceStats = db.prepare(`
        SELECT 
          AVG(confidence) as avgConfidence,
          MIN(confidence) as minConfidence,
          MAX(confidence) as maxConfidence,
          COUNT(CASE WHEN confidence < 0.5 THEN 1 END) as lowConfidenceCount,
          COUNT(*) as totalCount
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-7 days')
      `).get() as any;

      if (confidenceStats.avgConfidence < 0.7) {
        insights.push({
          id: 'low_confidence',
          type: 'recommendation',
          title: 'Low Analysis Confidence Detected',
          description: `Average confidence is ${(confidenceStats.avgConfidence * 100).toFixed(1)}%, suggesting complex or ambiguous text content`,
          severity: 'medium',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          data: confidenceStats,
          actionable: true,
          actions: [
            'Review text preprocessing and cleaning',
            'Consider using more advanced models',
            'Implement human validation for low-confidence results'
          ]
        });
      }

      // Check processing patterns
      const processingStats = db.prepare(`
        SELECT 
          AVG(LENGTH(text)) as avgTextLength,
          COUNT(CASE WHEN LENGTH(text) > 500 THEN 1 END) as longTextCount,
          COUNT(*) as totalCount
        FROM sentiment_analyses
        WHERE created_at >= datetime('now', '-7 days')
      `).get() as any;

      if (processingStats.longTextCount / processingStats.totalCount > 0.3) {
        insights.push({
          id: 'long_text_pattern',
          type: 'pattern',
          title: 'High Volume of Long Text Analysis',
          description: `${((processingStats.longTextCount / processingStats.totalCount) * 100).toFixed(1)}% of analyzed texts are longer than 500 characters`,
          severity: 'low',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          data: processingStats,
          actionable: true,
          actions: [
            'Consider text summarization for very long inputs',
            'Implement chunking for better processing',
            'Monitor processing performance for long texts'
          ]
        });
      }

    } catch (error) {
      console.error('Error generating performance insights:', error);
    }

    return insights;
  }

  private async generateBusinessRecommendations(): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      const overview = await analyticsService.generateAnalyticsOverview();

      // Recommendation based on sentiment distribution
      if (overview.sentimentDistribution.negative.percentage > 40) {
        insights.push({
          id: 'high_negative_sentiment',
          type: 'recommendation',
          title: 'High Negative Sentiment Requires Action',
          description: `${overview.sentimentDistribution.negative.percentage}% of recent sentiment is negative`,
          severity: 'high',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          data: { distribution: overview.sentimentDistribution },
          actionable: true,
          actions: [
            'Conduct root cause analysis of negative feedback',
            'Implement customer satisfaction improvement initiatives',
            'Increase monitoring frequency for negative trends'
          ]
        });
      }

      // Recommendation based on volume trends
      if (overview.totalAnalyses > 1000) {
        insights.push({
          id: 'high_volume_success',
          type: 'recommendation',
          title: 'High Analysis Volume - Scale Considerations',
          description: `Processing ${overview.totalAnalyses} analyses indicates strong usage`,
          severity: 'low',
          confidence: 0.8,
          timestamp: new Date().toISOString(),
          data: { totalAnalyses: overview.totalAnalyses },
          actionable: true,
          actions: [
            'Consider implementing caching for frequent queries',
            'Evaluate system performance and scaling needs',
            'Implement advanced analytics for high-volume insights'
          ]
        });
      }

      // Keyword-based recommendations
      const topNegativeKeywords = overview.topKeywords.filter(k => k.sentiment === 'negative');
      if (topNegativeKeywords.length > 2) {
        insights.push({
          id: 'negative_keyword_focus',
          type: 'recommendation',
          title: 'Focus on Recurring Negative Themes',
          description: `Multiple negative keywords suggest specific issue areas`,
          severity: 'medium',
          confidence: 0.75,
          timestamp: new Date().toISOString(),
          data: { negativeKeywords: topNegativeKeywords },
          actionable: true,
          actions: [
            'Create targeted improvement plans for each negative theme',
            'Implement tracking for these specific issues',
            'Develop messaging strategies to address concerns'
          ]
        });
      }

    } catch (error) {
      console.error('Error generating business recommendations:', error);
    }

    return insights;
  }

  private calculateTrend(values: number[]): { direction: 'improving' | 'declining' | 'stable', confidence: number, change: number } {
    if (values.length < 3) {
      return { direction: 'stable', confidence: 0, change: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const predictions = x.map(xi => slope * xi + intercept);
    const ssRes = values.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);
    const ssTot = values.reduce((sum, val) => sum + Math.pow(val - sumY / n, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    const change = ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100;

    let direction: 'improving' | 'declining' | 'stable';
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'improving' : 'declining';
    }

    return {
      direction,
      confidence: Math.max(0, rSquared),
      change
    };
  }

  private detectAnomalies(values: number[]): number[] {
    if (values.length < 5) return [];

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    const threshold = 2 * stdDev;
    
    return values
      .map((val, index) => ({ value: val, index }))
      .filter(item => Math.abs(item.value - mean) > threshold)
      .map(item => item.index);
  }

  async getBusinessInsights(): Promise<BusinessInsight[]> {
    const db = getSQLiteConnection();
    if (!db) return [];

    const insights: BusinessInsight[] = [];

    try {
      // Volume insight
      const volumeData = db.prepare(`
        SELECT 
          COUNT(CASE WHEN created_at >= date('now', '-7 days') THEN 1 END) as current,
          COUNT(CASE WHEN created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days') THEN 1 END) as previous
        FROM sentiment_analyses
      `).get() as any;

      const volumeChange = volumeData.previous > 0 ? 
        ((volumeData.current - volumeData.previous) / volumeData.previous) * 100 : 0;

      insights.push({
        metric: 'Analysis Volume',
        current: volumeData.current,
        previous: volumeData.previous,
        change: Number(volumeChange.toFixed(1)),
        trend: Math.abs(volumeChange) < 5 ? 'stable' : volumeChange > 0 ? 'up' : 'down',
        interpretation: volumeChange > 10 ? 'Strong increase in analysis activity' :
                       volumeChange < -10 ? 'Significant decrease in analysis activity' :
                       'Stable analysis volume',
        recommendation: volumeChange > 20 ? 'Monitor system capacity and performance' :
                       volumeChange < -20 ? 'Investigate potential issues with data sources' :
                       'Continue monitoring for trends'
      });

      // Sentiment score insight
      const sentimentData = db.prepare(`
        SELECT 
          AVG(CASE WHEN created_at >= date('now', '-7 days') THEN score END) as current,
          AVG(CASE WHEN created_at >= date('now', '-14 days') AND created_at < date('now', '-7 days') THEN score END) as previous
        FROM sentiment_analyses
      `).get() as any;

      const sentimentChange = sentimentData.previous ? 
        ((sentimentData.current - sentimentData.previous) / Math.abs(sentimentData.previous)) * 100 : 0;

      insights.push({
        metric: 'Average Sentiment Score',
        current: Number((sentimentData.current || 0).toFixed(3)),
        previous: Number((sentimentData.previous || 0).toFixed(3)),
        change: Number(sentimentChange.toFixed(1)),
        trend: Math.abs(sentimentChange) < 5 ? 'stable' : sentimentChange > 0 ? 'up' : 'down',
        interpretation: sentimentChange > 10 ? 'Sentiment is improving significantly' :
                       sentimentChange < -10 ? 'Sentiment is declining significantly' :
                       'Sentiment remains relatively stable',
        recommendation: sentimentChange < -10 ? 'Investigate causes of negative sentiment and implement improvements' :
                       sentimentChange > 10 ? 'Identify successful strategies to maintain positive trend' :
                       'Continue monitoring sentiment patterns'
      });

    } catch (error) {
      console.error('Error generating business insights:', error);
    }

    return insights;
  }
}

export const insightsService = new InsightsService();