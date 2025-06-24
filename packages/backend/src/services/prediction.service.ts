import { getSQLiteConnection } from '../database/sqlite-refactored';
import { TrendCalculator, SentimentDataPoint, BatchProcessingItem } from './trend-calculator.service';
import { AppError } from '../middleware/error.middleware';
import { v4 as uuidv4 } from 'uuid';

export interface CustomerSentimentHistory {
  date: string;
  sentiment: number;
  confidence: number;
}

export interface PredictionPoint {
  daysAhead: number;
  predictedSentiment: number;
  confidenceLower: number;
  confidenceUpper: number;
  predictedDate: string;
}

export interface CustomerPrediction {
  customerId: string;
  predictions: PredictionPoint[];
  trajectory?: any;
  trend?: any;
  error?: string;
  generatedAt?: string;
}

export interface HighRiskCustomer {
  customerId: string;
  currentSentiment: number;
  daysUntilThreshold: number;
  riskLevel: 'high' | 'critical';
  lastAnalysisDate: string;
}

export interface RiskAssessmentResult {
  highRiskCustomers: HighRiskCustomer[];
  totalAssessed: number;
  assessedAt: string;
}

export interface BatchProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  errors?: string[];
}

export class PredictionService {
  private trendCalculator: TrendCalculator;

  constructor() {
    this.trendCalculator = new TrendCalculator();
  }

  /**
   * Get customer sentiment history from database
   */
  async getCustomerSentimentHistory(customerId: string): Promise<CustomerSentimentHistory[]> {
    const db = await getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        AVG(score) as sentiment,
        AVG(confidence) as confidence
      FROM sentiment_analyses
      WHERE customer_id = ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      LIMIT 365
    `);

    const results = stmt.all(customerId) as CustomerSentimentHistory[];
    return results;
  }

  /**
   * Generate predictions for a specific customer
   */
  async generatePredictions(customerId: string): Promise<CustomerPrediction> {
    const history = await this.getCustomerSentimentHistory(customerId);

    if (history.length < 3) {
      return {
        customerId,
        predictions: [],
        error: 'Insufficient data for predictions',
      };
    }

    // Convert to format expected by TrendCalculator
    const sentimentData: SentimentDataPoint[] = history.map(h => ({
      date: new Date(h.date),
      sentiment: h.sentiment * 100, // Convert to percentage
      customerId,
    }));

    const trend = this.trendCalculator.calculateLinearTrend(sentimentData);
    const trajectory = this.trendCalculator.classifyTrajectory(sentimentData);

    const predictions: PredictionPoint[] = [];
    const today = new Date();

    // Generate predictions for 30, 60, and 90 days
    for (const daysAhead of [30, 60, 90]) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);

      const prediction = this.trendCalculator.predictWithConfidence(sentimentData, targetDate);
      
      if (prediction) {
        predictions.push({
          daysAhead,
          predictedSentiment: Math.max(0, Math.min(100, prediction.predicted)),
          confidenceLower: Math.max(0, prediction.confidence.lower),
          confidenceUpper: Math.min(100, prediction.confidence.upper),
          predictedDate: targetDate.toISOString().split('T')[0],
        });
      }
    }

    return {
      customerId,
      predictions,
      trajectory,
      trend,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Identify high-risk customers based on sentiment trends
   */
  async identifyHighRiskCustomers(threshold: number = 40): Promise<RiskAssessmentResult> {
    const db = await getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Get all customers with recent activity
    const customerStmt = db.prepare(`
      SELECT DISTINCT customer_id
      FROM sentiment_analyses
      WHERE created_at >= date('now', '-90 days')
      GROUP BY customer_id
      HAVING COUNT(*) >= 3
    `);

    const customers = customerStmt.all() as { customer_id: string }[];
    const highRiskCustomers: HighRiskCustomer[] = [];

    for (const { customer_id } of customers) {
      const history = await this.getCustomerSentimentHistory(customer_id);
      
      if (history.length >= 3) {
        const sentimentData: SentimentDataPoint[] = history.map(h => ({
          date: new Date(h.date),
          sentiment: h.sentiment * 100,
          customerId: customer_id,
        }));

        const riskAssessment = this.trendCalculator.assessRisk(sentimentData, threshold);

        if (riskAssessment.isHighRisk) {
          highRiskCustomers.push({
            customerId: customer_id,
            currentSentiment: riskAssessment.currentSentiment,
            daysUntilThreshold: riskAssessment.daysUntilThreshold,
            riskLevel: riskAssessment.daysUntilThreshold < 14 ? 'critical' : 'high',
            lastAnalysisDate: history[history.length - 1].date,
          });
        }
      }
    }

    // Sort by risk urgency
    highRiskCustomers.sort((a, b) => a.daysUntilThreshold - b.daysUntilThreshold);

    return {
      highRiskCustomers,
      totalAssessed: customers.length,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Process batch predictions for all customers
   */
  async processBatchPredictions(): Promise<BatchProcessingResult> {
    const db = await getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Get all customers with sufficient data
    const customerStmt = db.prepare(`
      SELECT 
        customer_id,
        COUNT(*) as data_points
      FROM sentiment_analyses
      WHERE created_at >= date('now', '-180 days')
      GROUP BY customer_id
      HAVING COUNT(*) >= 3
    `);

    const customers = customerStmt.all() as { customer_id: string; data_points: number }[];
    const batchData: BatchProcessingItem[] = [];

    // Prepare batch data
    for (const { customer_id } of customers) {
      const history = await this.getCustomerSentimentHistory(customer_id);
      
      if (history.length >= 3) {
        batchData.push({
          customerId: customer_id,
          history: history.map(h => ({
            date: new Date(h.date),
            sentiment: h.sentiment * 100,
            customerId: customer_id,
          })),
        });
      }
    }

    // Process in batch
    const results = await this.trendCalculator.processBatch(batchData);

    // Save results
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const result of results) {
      try {
        await this.savePrediction({
          customerId: result.customerId,
          predictions: [], // Generate predictions separately if needed
          trajectory: result.trajectory,
          trend: result.trend,
        });
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to save prediction for ${result.customerId}: ${error}`);
      }
    }

    return {
      processed: results.length,
      successful,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Save prediction to database
   */
  async savePrediction(prediction: CustomerPrediction): Promise<void> {
    const db = await getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const transaction = db.transaction(() => {
      // Create predictions table if it doesn't exist
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sentiment_predictions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prediction_id TEXT UNIQUE,
          customer_id TEXT NOT NULL,
          predicted_date TEXT NOT NULL,
          predicted_sentiment REAL,
          confidence_lower REAL,
          confidence_upper REAL,
          trajectory_classification TEXT,
          trajectory_severity TEXT,
          trend_slope REAL,
          trend_r_squared REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // Save each prediction point with unique ID
      for (const pred of prediction.predictions) {
        const predictionId = uuidv4();
        db.prepare(`
          INSERT INTO sentiment_predictions (
            prediction_id,
            customer_id,
            predicted_date,
            predicted_sentiment,
            confidence_lower,
            confidence_upper,
            trajectory_classification,
            trajectory_severity,
            trend_slope,
            trend_r_squared
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          predictionId,
          prediction.customerId,
          pred.predictedDate,
          pred.predictedSentiment,
          pred.confidenceLower,
          pred.confidenceUpper,
          prediction.trajectory?.classification,
          prediction.trajectory?.severity,
          prediction.trend?.slope,
          prediction.trend?.rSquared
        );
      }
    });

    transaction();
  }

  /**
   * Get saved predictions for a customer
   */
  async getSavedPredictions(customerId: string): Promise<any[]> {
    const db = await getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      SELECT 
        id,
        customer_id,
        predicted_date,
        predicted_sentiment,
        confidence_lower,
        confidence_upper,
        trajectory_classification,
        created_at
      FROM sentiment_predictions
      WHERE customer_id = ?
      ORDER BY predicted_date ASC
    `);

    const results = stmt.all(customerId);
    
    return results.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      predictedDate: r.predicted_date,
      predictedSentiment: r.predicted_sentiment,
      confidenceLower: r.confidence_lower,
      confidenceUpper: r.confidence_upper,
      trajectoryClassification: r.trajectory_classification,
      createdAt: r.created_at,
    }));
  }
}