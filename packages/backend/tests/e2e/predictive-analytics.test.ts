import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '../helpers/test-app';
import { Database } from 'better-sqlite3';
import { getDatabaseConnection } from '../../src/database/sqlite';
import { PredictionService } from '../../src/services/prediction.service';
import { TrendCalculatorService } from '../../src/services/trend-calculator.service';

describe('E2E: Predictive Analytics', () => {
  let app: Express;
  let db: Database;
  let predictionService: PredictionService;
  let trendCalculator: TrendCalculatorService;

  beforeAll(async () => {
    app = await createTestApp();
    db = getDatabaseConnection();
    trendCalculator = new TrendCalculatorService();
    predictionService = new PredictionService(db, trendCalculator);
  });

  afterEach(async () => {
    // Clean up test data
    db.prepare('DELETE FROM sentiment_analyses WHERE customer_id LIKE ?').run('test-%');
    db.prepare('DELETE FROM sentiment_predictions WHERE id LIKE ?').run('test-%');
  });

  describe('Sentiment Trajectory Prediction', () => {
    it('should predict 30/60/90 day sentiment trajectories', async () => {
      const customerId = 'test-customer-001';
      
      // Create historical sentiment data
      const historicalData = generateHistoricalData(customerId, 90);
      await seedHistoricalData(db, historicalData);

      const response = await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        customerId,
        currentSentiment: expect.any(Number),
        trend: expect.stringMatching(/declining|stable|improving|volatile/),
        predictions: expect.arrayContaining([
          expect.objectContaining({
            days: 30,
            sentiment: expect.any(Number),
            confidence: expect.any(Number),
            range: {
              min: expect.any(Number),
              max: expect.any(Number)
            }
          }),
          expect.objectContaining({
            days: 60,
            sentiment: expect.any(Number),
            confidence: expect.any(Number)
          }),
          expect.objectContaining({
            days: 90,
            sentiment: expect.any(Number),
            confidence: expect.any(Number)
          })
        ])
      });

      // Verify confidence decreases with time
      const predictions = response.body.data.predictions;
      expect(predictions[0].confidence).toBeGreaterThan(predictions[2].confidence);
    });

    it('should handle insufficient data gracefully', async () => {
      const customerId = 'test-customer-002';
      
      // Only 5 data points - not enough for reliable prediction
      const limitedData = generateHistoricalData(customerId, 5);
      await seedHistoricalData(db, limitedData);

      const response = await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);

      expect(response.body.data.predictions).toHaveLength(0);
      expect(response.body.data.message).toContain('Insufficient data');
    });

    it('should classify sentiment trajectories correctly', async () => {
      // Test declining trajectory
      const decliningCustomer = 'test-declining-001';
      await seedDecliningTrajectory(db, decliningCustomer);
      
      const decliningResponse = await request(app)
        .get(`/api/v1/predictions/customer/${decliningCustomer}`)
        .expect(200);
      
      expect(decliningResponse.body.data.trend).toBe('declining');
      expect(decliningResponse.body.data.predictions[0].sentiment).toBeLessThan(
        decliningResponse.body.data.currentSentiment
      );

      // Test improving trajectory
      const improvingCustomer = 'test-improving-001';
      await seedImprovingTrajectory(db, improvingCustomer);
      
      const improvingResponse = await request(app)
        .get(`/api/v1/predictions/customer/${improvingCustomer}`)
        .expect(200);
      
      expect(improvingResponse.body.data.trend).toBe('improving');
      expect(improvingResponse.body.data.predictions[0].sentiment).toBeGreaterThan(
        improvingResponse.body.data.currentSentiment
      );
    });

    it('should detect volatile patterns', async () => {
      const volatileCustomer = 'test-volatile-001';
      await seedVolatileTrajectory(db, volatileCustomer);
      
      const response = await request(app)
        .get(`/api/v1/predictions/customer/${volatileCustomer}`)
        .expect(200);
      
      expect(response.body.data.trend).toBe('volatile');
      expect(response.body.data.volatilityScore).toBeGreaterThan(0.3);
      
      // Confidence should be lower for volatile patterns
      expect(response.body.data.predictions[0].confidence).toBeLessThan(0.7);
    });
  });

  describe('Batch Predictions', () => {
    it('should generate predictions for multiple customers', async () => {
      const customerIds = ['test-batch-001', 'test-batch-002', 'test-batch-003'];
      
      // Seed data for all customers
      for (const customerId of customerIds) {
        await seedHistoricalData(db, generateHistoricalData(customerId, 60));
      }

      const response = await request(app)
        .post('/api/v1/predictions/batch')
        .send({ customerIds })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0]).toMatchObject({
        customerId: customerIds[0],
        predictions: expect.any(Array)
      });
    });

    it('should handle mixed data availability in batch', async () => {
      const customerIds = [
        'test-mixed-001', // Has data
        'test-mixed-002', // No data
        'test-mixed-003'  // Has data
      ];
      
      // Only seed data for some customers
      await seedHistoricalData(db, generateHistoricalData(customerIds[0], 60));
      await seedHistoricalData(db, generateHistoricalData(customerIds[2], 60));

      const response = await request(app)
        .post('/api/v1/predictions/batch')
        .send({ customerIds })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data[0].predictions).not.toHaveLength(0);
      expect(response.body.data[1].predictions).toHaveLength(0);
      expect(response.body.data[2].predictions).not.toHaveLength(0);
    });
  });

  describe('Prediction Accuracy Tracking', () => {
    it('should store predictions for accuracy tracking', async () => {
      const customerId = 'test-accuracy-001';
      await seedHistoricalData(db, generateHistoricalData(customerId, 90));

      // Generate prediction
      await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);

      // Verify predictions were stored
      const storedPredictions = db.prepare(`
        SELECT * FROM sentiment_predictions 
        WHERE customer_id = ? 
        ORDER BY prediction_date
      `).all(customerId);

      expect(storedPredictions).toHaveLength(3); // 30, 60, 90 day predictions
      expect(storedPredictions[0]).toMatchObject({
        customer_id: customerId,
        days_ahead: 30,
        predicted_sentiment: expect.any(Number),
        confidence: expect.any(Number)
      });
    });

    it('should calculate prediction accuracy', async () => {
      const customerId = 'test-accuracy-002';
      const predictionDate = new Date('2024-01-01');
      
      // Store historical prediction
      db.prepare(`
        INSERT INTO sentiment_predictions 
        (id, customer_id, prediction_date, target_date, days_ahead, predicted_sentiment, confidence, actual_sentiment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'test-pred-001',
        customerId,
        predictionDate.toISOString(),
        new Date('2024-01-31').toISOString(),
        30,
        0.6,
        0.8,
        0.65 // Actual sentiment after 30 days
      );

      const response = await request(app)
        .get(`/api/v1/predictions/accuracy/${customerId}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        customerId,
        accuracyMetrics: {
          mae: expect.any(Number), // Mean Absolute Error
          rmse: expect.any(Number), // Root Mean Square Error
          mape: expect.any(Number), // Mean Absolute Percentage Error
          totalPredictions: 1
        }
      });

      // MAE should be |0.6 - 0.65| = 0.05
      expect(response.body.data.accuracyMetrics.mae).toBeCloseTo(0.05, 2);
    });
  });

  describe('Real-time Prediction Updates', () => {
    it('should update predictions when new data arrives', async () => {
      const customerId = 'test-realtime-001';
      await seedHistoricalData(db, generateHistoricalData(customerId, 60));

      // Get initial prediction
      const initialResponse = await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);
      
      const initialPrediction = initialResponse.body.data.predictions[0].sentiment;

      // Add new sentiment data
      await request(app)
        .post('/api/v1/sentiment/analyze')
        .send({
          text: 'This service has gotten much worse recently',
          customerId,
          model: 'basic'
        })
        .expect(200);

      // Get updated prediction
      const updatedResponse = await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);
      
      const updatedPrediction = updatedResponse.body.data.predictions[0].sentiment;

      // Prediction should have changed
      expect(updatedPrediction).not.toBe(initialPrediction);
      expect(updatedPrediction).toBeLessThan(initialPrediction); // More negative
    });
  });

  describe('Confidence Intervals', () => {
    it('should calculate appropriate confidence intervals', async () => {
      const customerId = 'test-confidence-001';
      await seedHistoricalData(db, generateHistoricalData(customerId, 120));

      const response = await request(app)
        .get(`/api/v1/predictions/customer/${customerId}`)
        .expect(200);

      const predictions = response.body.data.predictions;
      
      // Confidence intervals should widen over time
      const range30 = predictions[0].range.max - predictions[0].range.min;
      const range60 = predictions[1].range.max - predictions[1].range.min;
      const range90 = predictions[2].range.max - predictions[2].range.min;
      
      expect(range60).toBeGreaterThan(range30);
      expect(range90).toBeGreaterThan(range60);
      
      // Predicted value should be within range
      predictions.forEach(pred => {
        expect(pred.sentiment).toBeGreaterThanOrEqual(pred.range.min);
        expect(pred.sentiment).toBeLessThanOrEqual(pred.range.max);
      });
    });
  });

  describe('Export Predictions', () => {
    it('should export predictions in multiple formats', async () => {
      const customerIds = ['test-export-001', 'test-export-002'];
      
      // Generate predictions for customers
      for (const customerId of customerIds) {
        await seedHistoricalData(db, generateHistoricalData(customerId, 90));
        await request(app)
          .get(`/api/v1/predictions/customer/${customerId}`)
          .expect(200);
      }

      // Export as CSV
      const csvResponse = await request(app)
        .post('/api/v1/predictions/export')
        .send({
          customerIds,
          format: 'csv',
          includeHistorical: true
        })
        .expect(200);

      expect(csvResponse.headers['content-type']).toContain('text/csv');
      expect(csvResponse.text).toContain('customer_id,prediction_date,days_ahead');

      // Export as JSON
      const jsonResponse = await request(app)
        .post('/api/v1/predictions/export')
        .send({
          customerIds,
          format: 'json'
        })
        .expect(200);

      expect(jsonResponse.body.predictions).toHaveLength(6); // 2 customers × 3 predictions
    });
  });
});

// Helper functions
function generateHistoricalData(customerId: string, days: number) {
  const data = [];
  const now = new Date();
  
  for (let i = days; i > 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Generate realistic sentiment progression
    const baseScore = 0.5 + (Math.random() * 0.3 - 0.15);
    const trend = (days - i) * 0.001; // Slight positive trend
    const noise = Math.random() * 0.2 - 0.1;
    const score = Math.max(-1, Math.min(1, baseScore + trend + noise));
    
    data.push({
      customerId,
      date: date.toISOString(),
      text: `Customer feedback on day ${i}`,
      sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      score,
      confidence: 0.8 + Math.random() * 0.2
    });
  }
  
  return data;
}

async function seedHistoricalData(db: Database, data: any[]) {
  const stmt = db.prepare(`
    INSERT INTO sentiment_analyses 
    (customer_id, text, sentiment, score, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    stmt.run(
      item.customerId,
      item.text,
      item.sentiment,
      item.score,
      item.confidence,
      item.date
    );
  }
}

async function seedDecliningTrajectory(db: Database, customerId: string) {
  const data = [];
  for (let i = 90; i > 0; i--) {
    const score = 0.8 - (90 - i) * 0.01; // Declining from 0.8 to -0.1
    data.push({
      customerId,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      text: `Declining feedback ${i}`,
      sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      score,
      confidence: 0.85
    });
  }
  await seedHistoricalData(db, data);
}

async function seedImprovingTrajectory(db: Database, customerId: string) {
  const data = [];
  for (let i = 90; i > 0; i--) {
    const score = -0.5 + (90 - i) * 0.015; // Improving from -0.5 to 0.85
    data.push({
      customerId,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      text: `Improving feedback ${i}`,
      sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      score,
      confidence: 0.85
    });
  }
  await seedHistoricalData(db, data);
}

async function seedVolatileTrajectory(db: Database, customerId: string) {
  const data = [];
  for (let i = 90; i > 0; i--) {
    // Alternating between positive and negative
    const score = i % 4 < 2 ? 0.7 : -0.6;
    const noise = Math.random() * 0.3 - 0.15;
    data.push({
      customerId,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      text: `Volatile feedback ${i}`,
      sentiment: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      score: score + noise,
      confidence: 0.75
    });
  }
  await seedHistoricalData(db, data);
}