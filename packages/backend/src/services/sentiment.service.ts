import { getSQLiteConnection } from '../database/sqlite';
import { runDuckDB } from '../database/duckdb';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';

export interface SentimentAnalysisResult {
  id?: number;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  createdAt?: string;
}

export interface SentimentStatistics {
  totalAnalyses: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageConfidence: number;
}

export class SentimentService {
  private performSentimentAnalysis(text: string): SentimentAnalysisResult {
    // Mock sentiment analysis - replace with actual ML model or API
    const words = text.toLowerCase().split(/\s+/);
    
    // Simple keyword-based sentiment analysis for demo
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'wonderful', 'fantastic', 'awesome', 'happy', 'pleased', 'satisfied'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting', 'angry', 'frustrated', 'disappointed', 'sad'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveScore++;
      if (negativeWords.includes(word)) negativeScore++;
    });
    
    const totalWords = words.length;
    const positiveRatio = positiveScore / totalWords;
    const negativeRatio = negativeScore / totalWords;
    
    let sentiment: 'positive' | 'negative' | 'neutral';
    let score: number;
    let confidence: number;
    
    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      score = Math.min(0.9, 0.3 + positiveRatio * 2);
      confidence = Math.min(0.95, 0.6 + (positiveScore - negativeScore) / totalWords);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      score = Math.max(-0.9, -0.3 - negativeRatio * 2);
      confidence = Math.min(0.95, 0.6 + (negativeScore - positiveScore) / totalWords);
    } else {
      sentiment = 'neutral';
      score = Math.random() * 0.4 - 0.2; // Small random variance around 0
      confidence = 0.5 + Math.random() * 0.3;
    }
    
    return {
      text,
      sentiment,
      score: Number(score.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
    };
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for sentiment analysis', 400, 'INVALID_TEXT');
    }

    const result = this.performSentimentAnalysis(text.trim());
    
    // Store in SQLite
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      INSERT INTO sentiment_analyses (text, sentiment, score, confidence)
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(result.text, result.sentiment, result.score, result.confidence);
    result.id = info.lastInsertRowid as number;

    // Also store in DuckDB for analytics (only if not in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await runDuckDB(`
          INSERT INTO text_analytics (text, sentiment, score, confidence, word_count, char_count)
          VALUES ('${result.text.replace(/'/g, "''")}', '${result.sentiment}', ${result.score}, ${result.confidence}, ${result.text.split(/\s+/).length}, ${result.text.length})
        `);
      } catch (error) {
        // Log error but don't fail the operation
        console.warn('Failed to store analytics in DuckDB:', error);
      }
    }

    return result;
  }

  async batchAnalyzeSentiment(texts: string[]): Promise<SentimentAnalysisResult[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new AppError('Texts array is required for batch analysis', 400, 'INVALID_TEXTS');
    }

    if (texts.length > 1000) {
      throw new AppError('Batch size cannot exceed 1000 texts', 400, 'BATCH_TOO_LARGE');
    }

    const results: SentimentAnalysisResult[] = [];
    const db = getSQLiteConnection();
    
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      INSERT INTO sentiment_analyses (text, sentiment, score, confidence)
      VALUES (?, ?, ?, ?)
    `);

    const batchId = uuidv4();
    
    try {
      db.transaction(() => {
        for (const text of texts) {
          if (text && text.trim().length > 0) {
            const result = this.performSentimentAnalysis(text.trim());
            const info = stmt.run(result.text, result.sentiment, result.score, result.confidence);
            result.id = info.lastInsertRowid as number;
            results.push(result);
          }
        }
      })();

      // Store analytics in DuckDB (only if not in test environment)
      if (process.env.NODE_ENV !== 'test') {
        try {
          for (const result of results) {
            await runDuckDB(`
              INSERT INTO text_analytics (text, sentiment, score, confidence, word_count, char_count, batch_id)
              VALUES ('${result.text.replace(/'/g, "''")}', '${result.sentiment}', ${result.score}, ${result.confidence}, ${result.text.split(/\s+/).length}, ${result.text.length}, '${batchId}')
            `);
          }
        } catch (error) {
          console.warn('Failed to store batch analytics in DuckDB:', error);
        }
      }

      return results;
    } catch (error) {
      throw new AppError('Failed to process batch sentiment analysis', 500, 'BATCH_ANALYSIS_ERROR');
    }
  }

  async getAnalysisHistory(page: number = 1, pageSize: number = 10): Promise<{
    data: SentimentAnalysisResult[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM sentiment_analyses');
    const { total } = countStmt.get() as { total: number };
    
    // Get paginated results
    const dataStmt = db.prepare(`
      SELECT id, text, sentiment, score, confidence, created_at as createdAt
      FROM sentiment_analyses
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const data = dataStmt.all(pageSize, offset) as SentimentAnalysisResult[];
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getStatistics(): Promise<SentimentStatistics> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Get total count
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM sentiment_analyses');
    const { total } = totalStmt.get() as { total: number };

    // Get sentiment distribution
    const distStmt = db.prepare(`
      SELECT sentiment, COUNT(*) as count
      FROM sentiment_analyses
      GROUP BY sentiment
    `);
    const distribution = distStmt.all() as { sentiment: string; count: number }[];

    // Get average confidence
    const avgStmt = db.prepare('SELECT AVG(confidence) as avgConfidence FROM sentiment_analyses');
    const { avgConfidence } = avgStmt.get() as { avgConfidence: number };

    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    distribution.forEach(({ sentiment, count }) => {
      if (sentiment in sentimentDistribution) {
        sentimentDistribution[sentiment as keyof typeof sentimentDistribution] = count;
      }
    });

    return {
      totalAnalyses: total,
      sentimentDistribution,
      averageConfidence: Number((avgConfidence || 0).toFixed(3)),
    };
  }
}