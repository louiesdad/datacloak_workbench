// DataCloak Integration Service for PII-aware sentiment analysis
import { OpenAIService } from './openai.service';
import { SecurityService, PIIDetectionResult } from './security.service';
import { dataCloak } from './datacloak.service';
import { AppError } from '../middleware/error.middleware';

export interface DataCloakSentimentRequest {
  text: string;
  model: string;
  includeConfidence?: boolean;
  preserveOriginal?: boolean;
}

export interface DataCloakSentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  originalText: string;
  deobfuscatedText: string;
  piiDetected: boolean;
  piiItemsFound: number;
  processingTimeMs: number;
  tokensUsed: number;
  model: string;
}

export class DataCloakIntegrationService {
  private openaiService?: OpenAIService;
  private securityService: SecurityService;

  constructor(openaiService?: OpenAIService) {
    this.openaiService = openaiService;
    this.securityService = new SecurityService();
  }

  setOpenAIService(openaiService: OpenAIService | undefined): void {
    this.openaiService = openaiService;
  }

  isConfigured(): boolean {
    return !!this.openaiService;
  }

  async analyzeSentiment(request: DataCloakSentimentRequest): Promise<DataCloakSentimentResult> {
    const startTime = Date.now();

    if (!this.openaiService) {
      throw new AppError('OpenAI service not configured', 500, 'OPENAI_NOT_CONFIGURED');
    }

    try {
      // Initialize DataCloak
      await dataCloak.initialize();
      
      // Step 1: Detect PII using DataCloak's ML-powered detection
      const piiResults = await dataCloak.detectPII(request.text);
      
      // Step 2: Mask PII to protect sensitive data
      const maskingResult = await dataCloak.maskText(request.text);
      
      // Step 3: Perform sentiment analysis on masked text using OpenAI
      const sentimentResponse = await this.openaiService.analyzeSentiment({
        text: maskingResult.maskedText,
        model: request.model,
        includeConfidence: request.includeConfidence
      });

      // Step 4: Return complete analysis with PII protection info
      return {
        sentiment: sentimentResponse.sentiment,
        score: sentimentResponse.score,
        confidence: sentimentResponse.confidence || 0.8,
        originalText: request.text,
        deobfuscatedText: request.preserveOriginal ? request.text : maskingResult.maskedText,
        piiDetected: piiResults.length > 0,
        piiItemsFound: piiResults.length,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: sentimentResponse.tokensUsed || Math.floor(request.text.length / 4),
        model: request.model
      };
    } catch (error) {
      console.error('DataCloak sentiment analysis error:', error);
      throw new AppError('DataCloak sentiment analysis failed', 500, 'DATACLOAK_ERROR');
    }
  }

  async batchAnalyzeSentiment(texts: string[], model: string): Promise<DataCloakSentimentResult[]> {
    const results: DataCloakSentimentResult[] = [];

    // Process in batches with rate limiting (3 requests/second as per DataCloak spec)
    const batchSize = 3;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(text => 
        this.analyzeSentiment({
          text,
          model,
          includeConfidence: true,
          preserveOriginal: true
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Rate limiting: wait 1 second between batches (3 req/sec)
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async testDataCloakFlow(): Promise<any> {
    try {
      await dataCloak.initialize();
      const stats = await dataCloak.getStats();
      
      return {
        success: true,
        message: 'DataCloak flow test successful',
        timestamp: new Date().toISOString(),
        dataCloakVersion: stats.version,
        dataCloakAvailable: stats.available
      };
    } catch (error) {
      return {
        success: false,
        message: 'DataCloak flow test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getProcessingStats(): Promise<any> {
    try {
      const stats = await dataCloak.getStats();
      
      return {
        totalRequests: 'N/A', // Would need to be tracked separately
        totalTokensUsed: 'N/A', // Would need to be tracked separately  
        averageProcessingTime: 'N/A', // Would need to be tracked separately
        piiDetectionRate: 'N/A', // Would need to be tracked separately
        dataCloakVersion: stats.version,
        dataCloakAvailable: stats.available,
        dataCloakInitialized: stats.initialized
      };
    } catch (error) {
      return {
        error: 'Failed to get DataCloak stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}