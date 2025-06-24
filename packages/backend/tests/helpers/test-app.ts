import express, { Express } from 'express';
import { initializeMiddleware } from '../../src/middleware';
import { initializeRoutes } from '../../src/routes';
import { getDatabaseConnection } from '../../src/database/sqlite';
import { getDuckDBConnection } from '../../src/database/duckdb';
import { OpenAIService } from '../../src/services/openai.service';
import { OpenAIBatchService } from '../../src/services/openai-batch.service';
import { CircuitBreakerService } from '../../src/services/circuit-breaker.service';
import { EventEmitter } from 'events';

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
process.env.JWT_SECRET = 'test-secret';

export async function createTestApp(): Promise<Express> {
  const app = express();
  
  // Initialize middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Initialize services
  const eventEmitter = new EventEmitter();
  const circuitBreaker = new CircuitBreakerService(eventEmitter);
  
  // Mock OpenAI service for testing
  if (process.env.MOCK_OPENAI === 'true') {
    jest.mock('../../src/services/openai.service', () => ({
      OpenAIService: jest.fn().mockImplementation(() => ({
        analyzeSentiment: jest.fn().mockResolvedValue({
          sentiment: 'positive',
          score: 0.8,
          confidence: 0.9,
          model: 'gpt-3.5-turbo'
        })
      }))
    }));
  }
  
  // Set up app context
  app.locals.circuitBreaker = circuitBreaker;
  app.locals.eventEmitter = eventEmitter;
  
  // Initialize routes
  await initializeRoutes(app);
  
  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Test app error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: err.details
    });
  });
  
  return app;
}

export function cleanupTestDatabase() {
  const db = getDatabaseConnection();
  
  // Clean test data
  db.prepare('DELETE FROM sentiment_analyses WHERE customer_id LIKE ?').run('test-%');
  db.prepare('DELETE FROM sentiment_predictions WHERE id LIKE ?').run('test-%');
  db.prepare('DELETE FROM datasets WHERE filename LIKE ?').run('test-%');
  db.prepare('DELETE FROM analysis_batches WHERE id LIKE ?').run('test-%');
}

export function mockCircuitBreakerState(service: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN') {
  const circuitBreaker = new CircuitBreakerService(new EventEmitter());
  
  switch (state) {
    case 'OPEN':
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure(service);
      }
      break;
    case 'HALF_OPEN':
      circuitBreaker.forceHalfOpen(service);
      break;
    default:
      circuitBreaker.reset(service);
  }
  
  return circuitBreaker;
}

export function generateMockSentimentData(count: number) {
  const data = [];
  for (let i = 0; i < count; i++) {
    const sentiment = ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)];
    const score = sentiment === 'positive' ? Math.random() * 0.5 + 0.5 :
                  sentiment === 'negative' ? Math.random() * -0.5 - 0.5 :
                  Math.random() * 0.4 - 0.2;
    
    data.push({
      text: `Test text ${i}`,
      sentiment,
      score,
      confidence: Math.random() * 0.3 + 0.7,
      processingTimeMs: Math.random() * 100 + 50
    });
  }
  return data;
}

// Add circuit breaker force methods for testing
declare module '../../src/services/circuit-breaker.service' {
  interface CircuitBreakerService {
    forceHalfOpen(service: string): void;
  }
}

CircuitBreakerService.prototype.forceHalfOpen = function(service: string) {
  const breaker = this.breakers.get(service);
  if (breaker) {
    breaker.state = 'HALF_OPEN';
    breaker.nextAttempt = Date.now();
  }
};