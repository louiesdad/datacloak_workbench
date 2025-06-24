/**
 * Sentiment Factory
 * 
 * Generates test sentiment analysis data for testing sentiment processing,
 * analysis workflows, and sentiment-related features.
 */

import { AbstractFactory, TestDataUtils, testRandom } from './base.factory';

export interface TestSentiment {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  scores: {
    positive: number;
    negative: number;
    neutral: number;
    mixed?: number;
  };
  metadata: {
    source: string;
    timestamp: Date;
    userId?: string;
    category?: string;
    language: string;
    wordCount: number;
  };
  entities?: Array<{
    type: 'person' | 'organization' | 'location' | 'product';
    text: string;
    confidence: number;
  }>;
  keywords?: Array<{
    text: string;
    relevance: number;
    sentiment: 'positive' | 'negative' | 'neutral';
  }>;
}

export interface TestSentimentAnalysisResult {
  requestId: string;
  originalText: string;
  processedAt: Date;
  analysis: TestSentiment;
  processingTime: number;
  success: boolean;
  error?: string;
}

export class SentimentFactory extends AbstractFactory<TestSentiment> {
  build(overrides?: Partial<TestSentiment>): TestSentiment {
    const sentiment = testRandom.choice(['positive', 'negative', 'neutral', 'mixed'] as const);
    const text = TestDataUtils.generateText(sentiment, testRandom.integer(50, 300));
    const confidence = this.generateConfidenceForSentiment(sentiment);
    const scores = this.generateScoresForSentiment(sentiment, confidence);

    const base: TestSentiment = {
      id: this.generateUuid(),
      text,
      sentiment,
      confidence,
      scores,
      metadata: {
        source: 'test_factory',
        timestamp: this.generateTimestamp(),
        category: testRandom.choice(['review', 'feedback', 'support', 'social', 'survey']),
        language: 'en',
        wordCount: text.split(' ').length
      },
      entities: this.generateEntities(),
      keywords: this.generateKeywords(sentiment)
    };

    return this.merge(base, overrides);
  }

  /**
   * Generate confidence score based on sentiment
   */
  private generateConfidenceForSentiment(sentiment: string): number {
    switch (sentiment) {
      case 'positive':
      case 'negative':
        return testRandom.float(0.7, 0.95); // Clear sentiments have higher confidence
      case 'neutral':
        return testRandom.float(0.6, 0.85);
      case 'mixed':
        return testRandom.float(0.5, 0.8); // Mixed sentiments are harder to classify
      default:
        return testRandom.float(0.5, 0.9);
    }
  }

  /**
   * Generate sentiment scores that add up to 1.0
   */
  private generateScoresForSentiment(sentiment: string, confidence: number): TestSentiment['scores'] {
    let positive: number, negative: number, neutral: number, mixed: number = 0;

    switch (sentiment) {
      case 'positive':
        positive = confidence;
        negative = testRandom.float(0, (1 - confidence) * 0.5);
        neutral = 1 - positive - negative;
        break;
      case 'negative':
        negative = confidence;
        positive = testRandom.float(0, (1 - confidence) * 0.5);
        neutral = 1 - positive - negative;
        break;
      case 'neutral':
        neutral = confidence;
        positive = testRandom.float(0, (1 - confidence) * 0.6);
        negative = 1 - positive - neutral;
        break;
      case 'mixed':
        mixed = confidence;
        positive = testRandom.float(0.2, 0.4);
        negative = testRandom.float(0.2, 0.4);
        neutral = 1 - positive - negative - mixed;
        break;
      default:
        positive = negative = neutral = 1/3;
    }

    const scores: TestSentiment['scores'] = {
      positive: Math.max(0, Math.min(1, positive)),
      negative: Math.max(0, Math.min(1, negative)),
      neutral: Math.max(0, Math.min(1, neutral))
    };

    if (sentiment === 'mixed') {
      scores.mixed = Math.max(0, Math.min(1, mixed));
    }

    return scores;
  }

  /**
   * Generate entity mentions
   */
  private generateEntities(): TestSentiment['entities'] {
    if (!testRandom.boolean(0.6)) return undefined; // 60% chance of having entities

    const entities: TestSentiment['entities'] = [];
    const entityCount = testRandom.integer(1, 3);

    for (let i = 0; i < entityCount; i++) {
      const type = testRandom.choice(['person', 'organization', 'location', 'product'] as const);
      const entityText = this.generateEntityText(type);
      
      entities.push({
        type,
        text: entityText,
        confidence: testRandom.float(0.6, 0.95)
      });
    }

    return entities;
  }

  /**
   * Generate entity text based on type
   */
  private generateEntityText(type: string): string {
    switch (type) {
      case 'person':
        return testRandom.choice(['John Smith', 'Sarah Johnson', 'Mike Davis', 'Lisa Wilson']);
      case 'organization':
        return testRandom.choice(['Acme Corp', 'TechStart Inc', 'Global Solutions', 'DataTech Ltd']);
      case 'location':
        return testRandom.choice(['New York', 'San Francisco', 'London', 'Tokyo']);
      case 'product':
        return testRandom.choice(['Product X', 'Service Pro', 'Platform 2.0', 'Tool Suite']);
      default:
        return 'Unknown Entity';
    }
  }

  /**
   * Generate keywords based on sentiment
   */
  private generateKeywords(sentiment: string): TestSentiment['keywords'] {
    if (!testRandom.boolean(0.7)) return undefined; // 70% chance of having keywords

    const positiveKeywords = ['excellent', 'great', 'amazing', 'love', 'perfect', 'outstanding'];
    const negativeKeywords = ['terrible', 'awful', 'hate', 'worst', 'disappointing', 'useless'];
    const neutralKeywords = ['okay', 'standard', 'average', 'basic', 'normal', 'typical'];

    let keywordPool: string[];
    switch (sentiment) {
      case 'positive':
        keywordPool = positiveKeywords;
        break;
      case 'negative':
        keywordPool = negativeKeywords;
        break;
      case 'mixed':
        keywordPool = [...positiveKeywords, ...negativeKeywords];
        break;
      default:
        keywordPool = neutralKeywords;
    }

    const keywordCount = testRandom.integer(1, 4);
    const keywords: TestSentiment['keywords'] = [];

    for (let i = 0; i < keywordCount; i++) {
      const keyword = testRandom.choice(keywordPool);
      const keywordSentiment = positiveKeywords.includes(keyword) ? 'positive' :
                              negativeKeywords.includes(keyword) ? 'negative' : 'neutral';
      
      keywords.push({
        text: keyword,
        relevance: testRandom.float(0.5, 0.9),
        sentiment: keywordSentiment
      });
    }

    return keywords;
  }

  /**
   * Create strongly positive sentiment
   */
  createPositive(overrides?: Partial<TestSentiment>): TestSentiment {
    return this.create({
      sentiment: 'positive',
      confidence: testRandom.float(0.85, 0.95),
      text: TestDataUtils.generateText('positive', testRandom.integer(50, 200)),
      ...overrides
    });
  }

  /**
   * Create strongly negative sentiment
   */
  createNegative(overrides?: Partial<TestSentiment>): TestSentiment {
    return this.create({
      sentiment: 'negative',
      confidence: testRandom.float(0.85, 0.95),
      text: TestDataUtils.generateText('negative', testRandom.integer(50, 200)),
      ...overrides
    });
  }

  /**
   * Create neutral sentiment
   */
  createNeutral(overrides?: Partial<TestSentiment>): TestSentiment {
    return this.create({
      sentiment: 'neutral',
      confidence: testRandom.float(0.7, 0.9),
      text: TestDataUtils.generateText('neutral', testRandom.integer(50, 200)),
      ...overrides
    });
  }

  /**
   * Create mixed sentiment
   */
  createMixed(overrides?: Partial<TestSentiment>): TestSentiment {
    return this.create({
      sentiment: 'mixed',
      confidence: testRandom.float(0.6, 0.8),
      text: TestDataUtils.generateText('mixed', testRandom.integer(100, 300)),
      ...overrides
    });
  }

  /**
   * Create low-confidence sentiment (ambiguous)
   */
  createLowConfidence(overrides?: Partial<TestSentiment>): TestSentiment {
    return this.create({
      confidence: testRandom.float(0.3, 0.6),
      ...overrides
    });
  }

  /**
   * Create sentiment analysis result
   */
  createAnalysisResult(sentiment?: TestSentiment, overrides?: Partial<TestSentimentAnalysisResult>): TestSentimentAnalysisResult {
    const analysis = sentiment || this.create();
    
    const base: TestSentimentAnalysisResult = {
      requestId: this.generateUuid(),
      originalText: analysis.text,
      processedAt: new Date(),
      analysis,
      processingTime: testRandom.integer(50, 500), // milliseconds
      success: true
    };

    return this.merge(base, overrides);
  }

  /**
   * Create failed analysis result
   */
  createFailedAnalysis(text?: string, overrides?: Partial<TestSentimentAnalysisResult>): TestSentimentAnalysisResult {
    const base: TestSentimentAnalysisResult = {
      requestId: this.generateUuid(),
      originalText: text || 'Failed to process this text',
      processedAt: new Date(),
      analysis: this.create({ text: text || 'Failed to process this text' }),
      processingTime: testRandom.integer(100, 1000),
      success: false,
      error: testRandom.choice([
        'Text too short for analysis',
        'Language not supported',
        'Processing timeout',
        'Internal server error'
      ])
    };

    return this.merge(base, overrides);
  }

  /**
   * Create a balanced dataset for testing
   */
  createBalancedDataset(size: number): TestSentiment[] {
    const perSentiment = Math.floor(size / 4);
    const remainder = size % 4;
    
    const dataset: TestSentiment[] = [];
    
    // Create equal amounts of each sentiment type
    dataset.push(...this.createMany(perSentiment, { sentiment: 'positive' }));
    dataset.push(...this.createMany(perSentiment, { sentiment: 'negative' }));
    dataset.push(...this.createMany(perSentiment, { sentiment: 'neutral' }));
    dataset.push(...this.createMany(perSentiment, { sentiment: 'mixed' }));
    
    // Add remainder as random sentiments
    for (let i = 0; i < remainder; i++) {
      dataset.push(this.create());
    }
    
    // Shuffle the array
    for (let i = dataset.length - 1; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
    }
    
    return dataset;
  }
}

// Export factory instance
export const sentimentFactory = new SentimentFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('sentiment', sentimentFactory);