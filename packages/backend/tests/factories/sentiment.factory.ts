import { v4 as uuidv4 } from 'uuid';
import { Factory, TestDataOptions } from './types';

export interface TestSentimentAnalysis {
  id: string;
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  keywords?: string[];
  language: string;
  wordCount: number;
  charCount: number;
  datasetId?: string;
  batchId?: string;
  createdAt: string;
}

export interface TestSentimentStatistics {
  id: string;
  dateBucket: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  count: number;
  avgScore: number;
  avgConfidence: number;
  datasetId?: string;
  createdAt: string;
}

class SentimentAnalysisFactory implements Factory<TestSentimentAnalysis> {
  create(options: TestDataOptions = {}): TestSentimentAnalysis {
    const id = uuidv4();
    const texts = [
      'This is a fantastic product!',
      'I love using this service.',
      'Terrible experience, would not recommend.',
      'The quality is okay, nothing special.',
      'Amazing customer support!',
      'This is the worst thing ever.',
      'Pretty good overall experience.',
      'Not bad, could be better.',
      'Excellent work and great value.',
      'Disappointing results unfortunately.'
    ];
    
    const text = options.overrides?.text || texts[Math.floor(Math.random() * texts.length)];
    const sentiment = options.overrides?.sentiment || this.inferSentiment(text);
    const score = options.overrides?.score ?? this.generateScore(sentiment);
    
    return {
      id,
      text,
      sentiment,
      score,
      confidence: options.overrides?.confidence ?? Math.random() * 0.3 + 0.7, // 0.7-1.0
      keywords: options.overrides?.keywords || this.extractKeywords(text),
      language: options.overrides?.language || 'en',
      wordCount: text.split(' ').length,
      charCount: text.length,
      datasetId: options.overrides?.datasetId,
      batchId: options.overrides?.batchId,
      createdAt: new Date().toISOString(),
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestSentimentAnalysis[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestSentimentAnalysis> = {}): TestSentimentAnalysis {
    return this.create({ overrides });
  }

  createPositive(): TestSentimentAnalysis {
    return this.create({
      overrides: {
        text: 'This is absolutely amazing and wonderful!',
        sentiment: 'positive' as const,
        score: 0.8 + Math.random() * 0.2, // 0.8-1.0
        confidence: 0.9 + Math.random() * 0.1 // 0.9-1.0
      }
    });
  }

  createNegative(): TestSentimentAnalysis {
    return this.create({
      overrides: {
        text: 'This is terrible and disappointing.',
        sentiment: 'negative' as const,
        score: -0.8 - Math.random() * 0.2, // -1.0 to -0.8
        confidence: 0.9 + Math.random() * 0.1
      }
    });
  }

  createNeutral(): TestSentimentAnalysis {
    return this.create({
      overrides: {
        text: 'This is an average product with standard features.',
        sentiment: 'neutral' as const,
        score: -0.2 + Math.random() * 0.4, // -0.2 to 0.2
        confidence: 0.6 + Math.random() * 0.2
      }
    });
  }

  private inferSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['amazing', 'fantastic', 'love', 'excellent', 'great'];
    const negativeWords = ['terrible', 'worst', 'disappointing', 'bad'];
    
    const hasPositive = positiveWords.some(word => text.toLowerCase().includes(word));
    const hasNegative = negativeWords.some(word => text.toLowerCase().includes(word));
    
    if (hasPositive && !hasNegative) return 'positive';
    if (hasNegative && !hasPositive) return 'negative';
    return 'neutral';
  }

  private generateScore(sentiment: 'positive' | 'negative' | 'neutral'): number {
    switch (sentiment) {
      case 'positive':
        return 0.3 + Math.random() * 0.7; // 0.3 to 1.0
      case 'negative':
        return -1.0 + Math.random() * 0.7; // -1.0 to -0.3
      case 'neutral':
        return -0.3 + Math.random() * 0.6; // -0.3 to 0.3
    }
  }

  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'would'].includes(word))
      .slice(0, 3);
  }
}

class SentimentStatisticsFactory implements Factory<TestSentimentStatistics> {
  create(options: TestDataOptions = {}): TestSentimentStatistics {
    const id = uuidv4();
    const sentiment = options.overrides?.sentiment || 
      (['positive', 'negative', 'neutral'] as const)[Math.floor(Math.random() * 3)];
    
    return {
      id,
      dateBucket: options.overrides?.dateBucket || new Date().toISOString().split('T')[0],
      sentiment,
      count: options.overrides?.count || Math.floor(Math.random() * 100) + 1,
      avgScore: options.overrides?.avgScore ?? this.generateAvgScore(sentiment),
      avgConfidence: options.overrides?.avgConfidence ?? Math.random() * 0.3 + 0.7,
      datasetId: options.overrides?.datasetId,
      createdAt: new Date().toISOString(),
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestSentimentStatistics[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestSentimentStatistics> = {}): TestSentimentStatistics {
    return this.create({ overrides });
  }

  private generateAvgScore(sentiment: 'positive' | 'negative' | 'neutral'): number {
    switch (sentiment) {
      case 'positive':
        return 0.5 + Math.random() * 0.5;
      case 'negative':
        return -0.5 - Math.random() * 0.5;
      case 'neutral':
        return -0.2 + Math.random() * 0.4;
    }
  }
}

// Export factory instances
export const sentimentAnalysisFactory = new SentimentAnalysisFactory();
export const sentimentStatisticsFactory = new SentimentStatisticsFactory();