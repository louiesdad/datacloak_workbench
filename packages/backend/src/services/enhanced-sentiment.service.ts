import { getSQLiteConnection } from '../database/sqlite-refactored';
import { runDuckDB } from '../database/duckdb-pool';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import { SecurityService } from './security.service';
import { OpenAIService } from './openai.service';
import { DataCloakIntegrationService, DataCloakSentimentRequest } from './datacloak-integration.service';
import { ConfigService } from './config.service';
import { eventEmitter, EventTypes } from './event.service';
import { getCacheService, ICacheService } from './cache.service';
import { getOpenAIServiceInstance } from './openai-service-manager';
import { analysisDecisionTracker, AnalysisDecisionTracker } from './analysis-decision-tracker.service';
import { dualLogger } from '../config/dual-logger';
import * as crypto from 'crypto';

export interface SentimentAnalysisResult {
  id?: number;
  text: string;
  originalText?: string; // Store original before PII masking
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  piiDetected?: boolean;
  piiItemsFound?: number;
  processingTimeMs?: number;
  model?: string;
  batchId?: string;
  createdAt?: string;
  traceId?: string; // Added for decision tracking
}

export interface SentimentStatistics {
  totalAnalyses: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageConfidence: number;
  averageScore: number;
  piiDetectionRate: number;
  dailyTrends?: { date: string; count: number; avgScore: number }[];
}

export interface ResultsFilter {
  sentiment?: 'positive' | 'negative' | 'neutral';
  dateFrom?: string;
  dateTo?: string;
  minConfidence?: number;
  maxConfidence?: number;
  minScore?: number;
  maxScore?: number;
  piiDetected?: boolean;
}

export interface EnhancedSentimentAnalysisOptions {
  enablePIIMasking?: boolean;
  model?: string;
  batchId?: string;
  userId?: string;
  sessionId?: string;
  datasetId?: string;
  enableDecisionTracking?: boolean;
  correlationId?: string;
}

export class EnhancedSentimentService {
  private securityService: SecurityService;
  private openAIService: OpenAIService;
  private dataCloakService: DataCloakIntegrationService;
  private configService: ConfigService;
  private cacheService: ICacheService;
  private decisionTracker: AnalysisDecisionTracker;

  constructor() {
    this.securityService = new SecurityService();
    this.openAIService = getOpenAIServiceInstance();
    this.dataCloakService = DataCloakIntegrationService.getInstance();
    this.configService = ConfigService.getInstance();
    this.cacheService = getCacheService();
    this.decisionTracker = analysisDecisionTracker;

    // Subscribe to configuration changes to invalidate caches
    this.configService.subscribe('openai', () => {
      this.invalidateConfigRelatedCaches();
    });

    dualLogger.info('Enhanced Sentiment Service initialized with decision tracking', {
      component: 'sentiment-service'
    });
  }

  /**
   * Analyze sentiment with comprehensive decision tracking and logging
   */
  async analyzeSentiment(
    text: string, 
    options: EnhancedSentimentAnalysisOptions = {}
  ): Promise<SentimentAnalysisResult> {
    // Start trace for this analysis
    const traceId = this.decisionTracker.startTrace({
      userId: options.userId,
      sessionId: options.sessionId,
      datasetId: options.datasetId,
      correlationId: options.correlationId
    });

    const startTime = Date.now();
    let logger = dualLogger.withTraceId(traceId);

    try {
      logger.info('Starting sentiment analysis', {
        component: 'sentiment-service',
        textLength: text.length,
        options: {
          enablePIIMasking: options.enablePIIMasking,
          model: options.model,
          batchId: options.batchId
        }
      });

      // Step 1: Text preprocessing and validation
      const preprocessResult = await this.preprocessText(text, traceId);
      
      // Step 2: PII detection and masking (if enabled)
      let processedText = preprocessResult.text;
      let piiDetected = false;
      let piiItemsFound = 0;

      if (options.enablePIIMasking) {
        const piiResult = await this.handlePIIMasking(text, traceId);
        processedText = piiResult.maskedText;
        piiDetected = piiResult.piiDetected;
        piiItemsFound = piiResult.piiItemsFound;
      }

      // Step 3: Cache check
      const cacheKey = this.generateCacheKey(processedText, options.enablePIIMasking || false, options.model || 'default');
      const cachedResult = await this.checkCache(cacheKey, traceId);
      
      if (cachedResult) {
        // Log cache hit decision
        this.decisionTracker.logSentimentDecision(traceId, 'cache_hit', {
          text: processedText,
          result: {
            sentiment: cachedResult.sentiment,
            confidence: cachedResult.confidence,
            scores: { [cachedResult.sentiment]: cachedResult.score }
          },
          algorithm: 'cache_retrieval',
          factors: {
            cacheKey,
            textLength: processedText.length,
            enablePIIMasking: options.enablePIIMasking || false
          },
          performance: { duration: Date.now() - startTime }
        });

        const result: SentimentAnalysisResult = {
          ...cachedResult,
          originalText: text,
          piiDetected,
          piiItemsFound,
          processingTimeMs: Date.now() - startTime,
          batchId: options.batchId,
          traceId
        };

        this.decisionTracker.endTrace(traceId);
        return result;
      }

      // Step 4: Sentiment analysis
      const sentimentResult = await this.performSentimentAnalysisWithLogging(
        processedText, 
        traceId, 
        options
      );

      // Step 5: Cache the result
      await this.cacheResult(cacheKey, sentimentResult, traceId);

      // Step 6: Store in database
      const finalResult = await this.storeResult({
        ...sentimentResult,
        originalText: text,
        text: processedText,
        piiDetected,
        piiItemsFound,
        processingTimeMs: Date.now() - startTime,
        batchId: options.batchId,
        traceId
      }, traceId);

      // End trace
      this.decisionTracker.endTrace(traceId);

      logger.performance('Sentiment analysis completed', startTime, {
        component: 'sentiment-service',
        sentiment: finalResult.sentiment,
        confidence: finalResult.confidence,
        piiDetected,
        piiItemsFound
      });

      return finalResult;

    } catch (error) {
      this.decisionTracker.endTrace(traceId);
      
      logger.error('Sentiment analysis failed', {
        component: 'sentiment-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length
      });

      throw error instanceof AppError ? error : 
        new AppError('Failed to analyze sentiment', 500, 'SENTIMENT_ANALYSIS_ERROR');
    }
  }

  /**
   * Preprocess text with decision logging
   */
  private async preprocessText(text: string, traceId: string): Promise<{ text: string; modifications: string[] }> {
    const startTime = Date.now();
    const modifications: string[] = [];
    let processedText = text;

    // Basic preprocessing steps
    if (!text || text.trim().length === 0) {
      throw new AppError('Text cannot be empty', 400, 'EMPTY_TEXT');
    }

    // Trim whitespace
    const trimmed = text.trim();
    if (trimmed !== text) {
      modifications.push('trimmed_whitespace');
      processedText = trimmed;
    }

    // Check length limits
    if (processedText.length > 10000) {
      modifications.push('truncated_to_limit');
      processedText = processedText.substring(0, 10000);
    }

    // Log preprocessing decision
    this.decisionTracker.logDataQualityDecision(traceId, 'text_preprocessing', {
      fieldName: 'input_text',
      qualityMetrics: {
        completeness: processedText.length > 0 ? 100 : 0,
        uniqueness: 100, // Each text is unique
        validity: this.validateTextQuality(processedText),
        consistency: 100 // Single text, always consistent
      },
      issues: modifications.length > 0 ? modifications : [],
      recommendations: this.getTextRecommendations(processedText),
      algorithm: 'basic_text_preprocessing',
      confidence: 0.95,
      performance: { duration: Date.now() - startTime }
    });

    return { text: processedText, modifications };
  }

  /**
   * Handle PII masking with decision logging
   */
  private async handlePIIMasking(text: string, traceId: string): Promise<{
    maskedText: string;
    piiDetected: boolean;
    piiItemsFound: number;
  }> {
    const startTime = Date.now();

    try {
      await this.securityService.initialize();
      const scanResult = await this.securityService.scanText(text);
      
      if (scanResult.piiDetected && scanResult.piiDetected.length > 0) {
        const maskingResult = await this.securityService.maskPII(text);
        
        // Log each PII masking decision
        for (const piiItem of scanResult.piiDetected) {
          this.decisionTracker.logPIIMaskingDecision(traceId, 'pii_masking', {
            fieldName: 'input_text',
            originalValue: piiItem.value,
            maskedValue: this.getMaskedValue(piiItem, maskingResult.maskedText),
            piiType: piiItem.piiType,
            confidence: piiItem.confidence,
            algorithm: 'datacloak_pii_detection',
            maskingStrategy: 'replacement',
            factors: {
              position: piiItem.position,
              pattern: piiItem.pattern,
              textLength: text.length
            },
            performance: { duration: Date.now() - startTime }
          });
        }

        return {
          maskedText: maskingResult.maskedText,
          piiDetected: true,
          piiItemsFound: scanResult.piiDetected.length
        };
      }

      // Log no PII detected decision
      this.decisionTracker.logSecurityScanDecision(traceId, 'pii_scan', {
        scanType: 'pii_detection',
        findings: [],
        riskScore: 0,
        algorithm: 'datacloak_pii_detection',
        confidence: 0.9,
        performance: { duration: Date.now() - startTime }
      });

      return {
        maskedText: text,
        piiDetected: false,
        piiItemsFound: 0
      };

    } catch (error) {
      dualLogger.warn('PII masking failed, proceeding without masking', {
        component: 'sentiment-service',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        maskedText: text,
        piiDetected: false,
        piiItemsFound: 0
      };
    }
  }

  /**
   * Perform sentiment analysis with comprehensive decision logging
   */
  private async performSentimentAnalysisWithLogging(
    text: string, 
    traceId: string, 
    options: EnhancedSentimentAnalysisOptions
  ): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();
    const model = options.model || 'gpt-3.5-turbo';
    
    try {
      // Try OpenAI analysis first
      const openAIResult = await this.analyzeWithOpenAI(text, model, traceId);
      
      // Log successful OpenAI decision
      this.decisionTracker.logSentimentDecision(traceId, 'openai_analysis', {
        text,
        result: {
          sentiment: openAIResult.sentiment,
          confidence: openAIResult.confidence,
          scores: this.extractScoresFromResult(openAIResult)
        },
        algorithm: `openai_${model}`,
        factors: {
          textLength: text.length,
          model,
          apiResponseTime: openAIResult.processingTimeMs || 0,
          hasEmojis: /[\u{1F600}-\u{1F64F}]/u.test(text),
          wordCount: text.split(' ').length
        },
        alternatives: await this.getAlternativeAnalyses(text, traceId),
        performance: { 
          duration: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed
        }
      });

      return openAIResult;

    } catch (openAIError) {
      dualLogger.warn('OpenAI analysis failed, falling back to local analysis', {
        component: 'sentiment-service',
        traceId,
        error: openAIError instanceof Error ? openAIError.message : 'Unknown error'
      });

      // Fallback to local analysis
      const localResult = this.performLocalSentimentAnalysis(text);
      
      // Log fallback decision
      this.decisionTracker.logSentimentDecision(traceId, 'local_fallback_analysis', {
        text,
        result: {
          sentiment: localResult.sentiment,
          confidence: localResult.confidence,
          scores: { [localResult.sentiment]: localResult.score }
        },
        algorithm: 'local_rule_based',
        factors: {
          textLength: text.length,
          fallbackReason: 'openai_api_failure',
          wordCount: text.split(' ').length,
          positiveWords: this.countPositiveWords(text),
          negativeWords: this.countNegativeWords(text)
        },
        performance: { duration: Date.now() - startTime }
      });

      return localResult;
    }
  }

  /**
   * Cache result with logging
   */
  private async cacheResult(
    cacheKey: string, 
    result: SentimentAnalysisResult, 
    traceId: string
  ): Promise<void> {
    try {
      await this.cacheService.set(cacheKey, result, 3600); // Cache for 1 hour
      
      dualLogger.debug('Sentiment result cached', {
        component: 'sentiment-service',
        traceId,
        cacheKey,
        sentiment: result.sentiment
      });
    } catch (error) {
      dualLogger.warn('Failed to cache sentiment result', {
        component: 'sentiment-service',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check cache with logging
   */
  private async checkCache(cacheKey: string, traceId: string): Promise<SentimentAnalysisResult | null> {
    try {
      const cached = await this.cacheService.get(cacheKey);
      
      if (cached) {
        dualLogger.debug('Cache hit for sentiment analysis', {
          component: 'sentiment-service',
          traceId,
          cacheKey
        });
      }
      
      return cached;
    } catch (error) {
      dualLogger.warn('Cache check failed', {
        component: 'sentiment-service',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Store result in database with logging
   */
  private async storeResult(
    result: SentimentAnalysisResult, 
    traceId: string
  ): Promise<SentimentAnalysisResult> {
    try {
      const db = getSQLiteConnection();
      const stmt = db.prepare(`
        INSERT INTO sentiment_analyses 
        (text, original_text, sentiment, score, confidence, pii_detected, pii_items_found, 
         processing_time_ms, model, batch_id, trace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertResult = stmt.run(
        result.text,
        result.originalText || result.text,
        result.sentiment,
        result.score,
        result.confidence,
        result.piiDetected ? 1 : 0,
        result.piiItemsFound || 0,
        result.processingTimeMs,
        result.model || 'unknown',
        result.batchId || null,
        traceId
      );

      const finalResult = {
        ...result,
        id: insertResult.lastInsertRowid as number,
        createdAt: new Date().toISOString()
      };

      dualLogger.database('Sentiment analysis result stored', {
        traceId,
        resultId: finalResult.id,
        sentiment: finalResult.sentiment
      });

      return finalResult;

    } catch (error) {
      dualLogger.error('Failed to store sentiment result', {
        component: 'sentiment-service',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new AppError('Failed to store sentiment analysis result', 500, 'STORAGE_ERROR');
    }
  }

  // Helper methods for decision tracking
  private validateTextQuality(text: string): number {
    let score = 100;
    
    if (text.length < 5) score -= 20;
    if (!/[a-zA-Z]/.test(text)) score -= 30;
    if (text === text.toUpperCase()) score -= 10;
    if (text === text.toLowerCase()) score -= 5;
    
    return Math.max(0, score);
  }

  private getTextRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    
    if (text.length < 10) recommendations.push('Consider providing longer text for better analysis');
    if (!/[.!?]$/.test(text)) recommendations.push('Text may be incomplete - missing punctuation');
    if (text.split(' ').length < 3) recommendations.push('Very short text may reduce analysis accuracy');
    
    return recommendations;
  }

  private getMaskedValue(piiItem: any, maskedText: string): string {
    try {
      const start = piiItem.position.start;
      const end = piiItem.position.end;
      return maskedText.substring(start, end);
    } catch {
      return '[MASKED]';
    }
  }

  private extractScoresFromResult(result: SentimentAnalysisResult): Record<string, number> {
    return {
      [result.sentiment]: result.score,
      confidence: result.confidence
    };
  }

  private async getAlternativeAnalyses(text: string, traceId: string): Promise<Array<{ option: string; score: number; reason: string }>> {
    // For now, return simple alternatives based on local analysis
    const localResult = this.performLocalSentimentAnalysis(text);
    
    return [
      {
        option: `local_${localResult.sentiment}`,
        score: localResult.confidence,
        reason: 'Local rule-based analysis alternative'
      }
    ];
  }

  private performLocalSentimentAnalysis(text: string): SentimentAnalysisResult {
    // Simple rule-based sentiment analysis as fallback
    const positiveWords = this.countPositiveWords(text);
    const negativeWords = this.countNegativeWords(text);
    const totalWords = text.split(' ').length;
    
    const positiveScore = positiveWords / totalWords;
    const negativeScore = negativeWords / totalWords;
    
    let sentiment: 'positive' | 'negative' | 'neutral';
    let score: number;
    let confidence: number;
    
    if (positiveScore > negativeScore && positiveScore > 0.1) {
      sentiment = 'positive';
      score = Math.min(0.9, 0.5 + positiveScore);
      confidence = Math.min(0.8, positiveScore * 2);
    } else if (negativeScore > positiveScore && negativeScore > 0.1) {
      sentiment = 'negative';
      score = Math.max(0.1, 0.5 - negativeScore);
      confidence = Math.min(0.8, negativeScore * 2);
    } else {
      sentiment = 'neutral';
      score = 0.5;
      confidence = 0.6;
    }
    
    return {
      text,
      sentiment,
      score,
      confidence,
      model: 'local_rule_based'
    };
  }

  private countPositiveWords(text: string): number {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome', 'love', 'like', 'happy', 'pleased', 'satisfied'];
    const words = text.toLowerCase().split(/\W+/);
    return words.filter(word => positiveWords.includes(word)).length;
  }

  private countNegativeWords(text: string): number {
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'frustrated', 'disappointed', 'unhappy', 'unsatisfied'];
    const words = text.toLowerCase().split(/\W+/);
    return words.filter(word => negativeWords.includes(word)).length;
  }

  private async analyzeWithOpenAI(text: string, model: string, traceId: string): Promise<SentimentAnalysisResult> {
    const startTime = Date.now();
    
    // This would integrate with your existing OpenAI service
    // For now, returning a mock result
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
    
    return {
      text,
      sentiment: 'positive',
      score: 0.75,
      confidence: 0.85,
      model,
      processingTimeMs: Date.now() - startTime
    };
  }

  private generateCacheKey(text: string, enablePIIMasking: boolean, model: string): string {
    const normalizedText = text.trim().toLowerCase();
    const hash = crypto.createHash('sha256')
      .update(`${normalizedText}:${enablePIIMasking}:${model}`)
      .digest('hex');
    return `sentiment:${hash}`;
  }

  private async invalidateConfigRelatedCaches(): Promise<void> {
    try {
      const sentimentKeys = await this.cacheService.keys('sentiment:*');
      for (const key of sentimentKeys) {
        await this.cacheService.del(key);
      }
      dualLogger.info(`Invalidated ${sentimentKeys.length} sentiment analysis cache entries`, {
        component: 'sentiment-service'
      });
    } catch (error) {
      dualLogger.warn('Failed to invalidate sentiment analysis caches', {
        component: 'sentiment-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sentiment statistics with trace information
   */
  async getStatistics(filters: ResultsFilter = {}): Promise<SentimentStatistics> {
    const traceId = this.decisionTracker.startTrace();
    
    try {
      const db = getSQLiteConnection();
      
      let query = 'SELECT * FROM sentiment_analyses WHERE 1=1';
      const params: any[] = [];
      
      if (filters.sentiment) {
        query += ' AND sentiment = ?';
        params.push(filters.sentiment);
      }
      
      if (filters.dateFrom) {
        query += ' AND created_at >= ?';
        params.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ' AND created_at <= ?';
        params.push(filters.dateTo);
      }
      
      const stmt = db.prepare(query);
      const results = stmt.all(...params) as any[];
      
      const stats = this.calculateStatistics(results);
      
      this.decisionTracker.endTrace(traceId);
      
      return stats;
      
    } catch (error) {
      this.decisionTracker.endTrace(traceId);
      throw error;
    }
  }

  private calculateStatistics(results: any[]): SentimentStatistics {
    const total = results.length;
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let totalConfidence = 0;
    let totalScore = 0;
    let piiDetectedCount = 0;

    for (const result of results) {
      sentimentCounts[result.sentiment as keyof typeof sentimentCounts]++;
      totalConfidence += result.confidence;
      totalScore += result.score;
      if (result.pii_detected) piiDetectedCount++;
    }

    return {
      totalAnalyses: total,
      sentimentDistribution: sentimentCounts,
      averageConfidence: total > 0 ? totalConfidence / total : 0,
      averageScore: total > 0 ? totalScore / total : 0,
      piiDetectionRate: total > 0 ? piiDetectedCount / total : 0
    };
  }
}

// Create singleton instance
export const enhancedSentimentService = new EnhancedSentimentService();

export default EnhancedSentimentService;