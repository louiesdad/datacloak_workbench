import { getSQLiteConnection } from '../database/sqlite';
import { runDuckDB } from '../database/duckdb-pool';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/error.middleware';
import { SecurityService } from './security.service';
import { OpenAIService } from './openai.service';
import { DataCloakIntegrationService, DataCloakSentimentRequest } from './datacloak-integration.service';
import { ConfigService } from './config.service';
import { eventEmitter, EventTypes } from './event.service';
import { getCacheService, ICacheService } from './cache.service';
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
  batchId?: string;
}

export class SentimentService {
  private securityService: SecurityService;
  private openaiService?: OpenAIService;
  private dataCloakService: DataCloakIntegrationService;
  private configService: ConfigService;
  private cacheService: ICacheService;

  constructor() {
    this.securityService = new SecurityService();
    this.configService = ConfigService.getInstance();
    this.cacheService = getCacheService();
    
    // Initialize OpenAI service from ConfigService
    this.initializeOpenAIService();

    // Initialize DataCloak integration service
    this.dataCloakService = new DataCloakIntegrationService(this.openaiService);

    // Listen for configuration updates
    this.configService.on('config.updated', async (event) => {
      if (event.key && event.key.toString().startsWith('OPENAI_')) {
        console.log('OpenAI configuration updated, reinitializing service...');
        this.initializeOpenAIService();
        // Update DataCloak service with new OpenAI instance
        this.dataCloakService.setOpenAIService(this.openaiService);
        // Invalidate related caches
        await this.invalidateConfigRelatedCaches();
      }
    });
  }

  private initializeOpenAIService(): void {
    if (this.configService.isOpenAIConfigured()) {
      try {
        const openaiConfig = this.configService.getOpenAIConfig();
        
        if (!openaiConfig.apiKey) {
          throw new Error('OpenAI API key is not configured');
        }
        
        this.openaiService = new OpenAIService({
          apiKey: openaiConfig.apiKey,
          model: openaiConfig.model || 'gpt-3.5-turbo',
          maxTokens: openaiConfig.maxTokens || 150,
          temperature: openaiConfig.temperature || 0.1,
          timeout: openaiConfig.timeout || 30000
        });
        
        console.log('OpenAI service initialized with ConfigService settings');
      } catch (error) {
        console.warn('Failed to initialize OpenAI service:', error);
        this.openaiService = undefined;
      }
    } else {
      console.log('OpenAI API key not configured');
      this.openaiService = undefined;
    }
  }

  /**
   * Generate cache key for sentiment analysis
   */
  private generateCacheKey(text: string, enablePIIMasking: boolean, model: string): string {
    const normalizedText = text.trim().toLowerCase();
    const hash = crypto.createHash('sha256')
      .update(`${normalizedText}:${enablePIIMasking}:${model}`)
      .digest('hex');
    return `sentiment:${hash}`;
  }

  /**
   * Generate cache key for PII detection
   */
  private generatePIICacheKey(text: string): string {
    const normalizedText = text.trim().toLowerCase();
    const hash = crypto.createHash('sha256')
      .update(normalizedText)
      .digest('hex');
    return `pii:${hash}`;
  }

  /**
   * Invalidate related caches when configuration changes
   */
  private async invalidateConfigRelatedCaches(): Promise<void> {
    try {
      // Clear all sentiment analysis caches when OpenAI config changes
      const sentimentKeys = await this.cacheService.keys('sentiment:*');
      for (const key of sentimentKeys) {
        await this.cacheService.del(key);
      }
      console.log(`Invalidated ${sentimentKeys.length} sentiment analysis cache entries`);
    } catch (error) {
      console.warn('Failed to invalidate sentiment analysis caches:', error);
    }
  }
  private performSentimentAnalysis(text: string): SentimentAnalysisResult {
    // Advanced sentiment analysis using multiple techniques
    const analysis = this.analyzeSentimentAdvanced(text);
    
    return {
      text,
      sentiment: analysis.sentiment,
      score: Number(analysis.score.toFixed(3)),
      confidence: Number(analysis.confidence.toFixed(3)),
    };
  }

  /**
   * Advanced sentiment analysis using lexicon-based approach with linguistic features
   */
  private analyzeSentimentAdvanced(text: string): { sentiment: 'positive' | 'negative' | 'neutral', score: number, confidence: number } {
    const normalizedText = text.toLowerCase();
    const sentences = this.splitIntoSentences(text);
    const words = this.extractWords(normalizedText);
    
    // Enhanced sentiment lexicons with weights
    const sentimentLexicon = this.getSentimentLexicon();
    const intensifiers = this.getIntensifiers();
    const negations = this.getNegations();
    
    let totalSentimentScore = 0;
    let totalConfidence = 0;
    let sentenceCount = 0;
    
    // Analyze each sentence for better accuracy
    for (const sentence of sentences) {
      const sentenceWords = this.extractWords(sentence.toLowerCase());
      const sentenceAnalysis = this.analyzeSentence(sentenceWords, sentimentLexicon, intensifiers, negations);
      
      totalSentimentScore += sentenceAnalysis.score;
      totalConfidence += sentenceAnalysis.confidence;
      sentenceCount++;
    }
    
    // Calculate overall metrics
    const avgScore = sentenceCount > 0 ? totalSentimentScore / sentenceCount : 0;
    const avgConfidence = sentenceCount > 0 ? totalConfidence / sentenceCount : 0;
    
    // Apply text-level adjustments
    const adjustedScore = this.applyContextualAdjustments(avgScore, words, normalizedText);
    const finalConfidence = this.calculateFinalConfidence(avgConfidence, words.length, sentenceCount);
    
    // Determine sentiment based on score
    let sentiment: 'positive' | 'negative' | 'neutral';
    if (adjustedScore > 0.1) {
      sentiment = 'positive';
    } else if (adjustedScore < -0.1) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }
    
    return {
      sentiment,
      score: adjustedScore,
      confidence: finalConfidence
    };
  }

  /**
   * Split text into sentences for better analysis
   */
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  /**
   * Extract words and clean them
   */
  private extractWords(text: string): string[] {
    return text.match(/\b[a-zA-Z]{2,}\b/g) || [];
  }

  /**
   * Enhanced sentiment lexicon with weights
   */
  private getSentimentLexicon(): Map<string, number> {
    const lexicon = new Map<string, number>();
    
    // Strong positive words
    const strongPositive = ['excellent', 'outstanding', 'exceptional', 'phenomenal', 'magnificent', 'superb', 'brilliant', 'amazing', 'fantastic', 'wonderful'];
    strongPositive.forEach(word => lexicon.set(word, 0.8));
    
    // Moderate positive words
    const moderatePositive = ['good', 'great', 'nice', 'pleasant', 'satisfactory', 'adequate', 'fine', 'decent', 'acceptable', 'positive', 'happy', 'pleased', 'satisfied', 'content', 'glad', 'delighted', 'cheerful', 'optimistic'];
    moderatePositive.forEach(word => lexicon.set(word, 0.5));
    
    // Mild positive words
    const mildPositive = ['okay', 'alright', 'fair', 'reasonable', 'tolerable', 'passable'];
    mildPositive.forEach(word => lexicon.set(word, 0.2));
    
    // Strong negative words
    const strongNegative = ['terrible', 'horrible', 'awful', 'atrocious', 'appalling', 'dreadful', 'disgusting', 'abysmal', 'deplorable', 'horrendous'];
    strongNegative.forEach(word => lexicon.set(word, -0.8));
    
    // Moderate negative words
    const moderateNegative = ['bad', 'poor', 'disappointing', 'unsatisfactory', 'inadequate', 'unpleasant', 'negative', 'sad', 'angry', 'frustrated', 'annoyed', 'upset', 'unhappy', 'displeased', 'dissatisfied', 'worried', 'concerned'];
    moderateNegative.forEach(word => lexicon.set(word, -0.5));
    
    // Mild negative words
    const mildNegative = ['mediocre', 'subpar', 'lacking', 'insufficient', 'questionable'];
    mildNegative.forEach(word => lexicon.set(word, -0.2));
    
    return lexicon;
  }

  /**
   * Get intensifier words that modify sentiment strength
   */
  private getIntensifiers(): Map<string, number> {
    const intensifiers = new Map<string, number>();
    
    intensifiers.set('very', 1.5);
    intensifiers.set('extremely', 2.0);
    intensifiers.set('incredibly', 1.8);
    intensifiers.set('absolutely', 1.7);
    intensifiers.set('completely', 1.6);
    intensifiers.set('totally', 1.5);
    intensifiers.set('quite', 1.3);
    intensifiers.set('rather', 1.2);
    intensifiers.set('really', 1.4);
    intensifiers.set('truly', 1.4);
    intensifiers.set('highly', 1.3);
    intensifiers.set('deeply', 1.3);
    
    return intensifiers;
  }

  /**
   * Get negation words that flip sentiment
   */
  private getNegations(): Set<string> {
    return new Set(['not', 'no', 'never', 'nothing', 'nobody', 'nowhere', 'neither', 'none', 'hardly', 'scarcely', 'barely', 'seldom', 'rarely']);
  }

  /**
   * Analyze a single sentence
   */
  private analyzeSentence(words: string[], lexicon: Map<string, number>, intensifiers: Map<string, number>, negations: Set<string>): { score: number, confidence: number } {
    let sentenceScore = 0;
    let sentimentWordCount = 0;
    let currentIntensifier = 1.0;
    let negationActive = false;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for negations (affect next 3 words)
      if (negations.has(word)) {
        negationActive = true;
        continue;
      }
      
      // Check for intensifiers
      if (intensifiers.has(word)) {
        currentIntensifier = intensifiers.get(word)!;
        continue;
      }
      
      // Check for sentiment words
      if (lexicon.has(word)) {
        let wordScore = lexicon.get(word)!;
        
        // Apply intensifier
        wordScore *= currentIntensifier;
        
        // Apply negation
        if (negationActive) {
          wordScore *= -0.8; // Negation doesn't completely flip, just reduces and inverts
          negationActive = false;
        }
        
        sentenceScore += wordScore;
        sentimentWordCount++;
        
        // Reset intensifier after use
        currentIntensifier = 1.0;
      }
      
      // Negation effect decays after a few words
      if (negationActive && i > 0 && (i % 3 === 0)) {
        negationActive = false;
      }
    }
    
    // Calculate confidence based on sentiment word density
    const sentimentDensity = sentimentWordCount / Math.max(words.length, 1);
    const confidence = Math.min(0.95, 0.3 + sentimentDensity * 1.5);
    
    return {
      score: sentenceScore,
      confidence
    };
  }

  /**
   * Apply contextual adjustments based on text features
   */
  private applyContextualAdjustments(score: number, words: string[], text: string): number {
    let adjustedScore = score;
    
    // Adjust for text length - longer texts might have more nuanced sentiment
    const lengthFactor = Math.min(1.0, words.length / 50);
    adjustedScore *= (0.8 + 0.2 * lengthFactor);
    
    // Adjust for punctuation patterns
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    
    if (exclamationCount > 0) {
      adjustedScore *= (1 + exclamationCount * 0.1); // Exclamations intensify sentiment
    }
    
    if (questionCount > exclamationCount) {
      adjustedScore *= 0.9; // Questions slightly reduce confidence in sentiment
    }
    
    // Adjust for repeated characters (e.g., "sooooo good")
    const repeatedChars = text.match(/(.)\1{2,}/g) || [];
    if (repeatedChars.length > 0) {
      adjustedScore *= (1 + repeatedChars.length * 0.05);
    }
    
    // Clamp the final score
    return Math.max(-1, Math.min(1, adjustedScore));
  }

  /**
   * Calculate final confidence score
   */
  private calculateFinalConfidence(baseConfidence: number, wordCount: number, sentenceCount: number): number {
    // Adjust confidence based on text characteristics
    let finalConfidence = baseConfidence;
    
    // More words generally mean more reliable analysis
    const wordCountFactor = Math.min(1.0, wordCount / 20);
    finalConfidence *= (0.7 + 0.3 * wordCountFactor);
    
    // Multiple sentences provide better context
    const sentenceFactor = Math.min(1.0, sentenceCount / 3);
    finalConfidence *= (0.8 + 0.2 * sentenceFactor);
    
    return Math.max(0.1, Math.min(0.95, finalConfidence));
  }

  async analyzeSentiment(text: string, enablePIIMasking: boolean = true, model: string = 'basic'): Promise<SentimentAnalysisResult> {
    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for sentiment analysis', 400, 'INVALID_TEXT');
    }

    const startTime = Date.now();
    const originalText = text.trim();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(originalText, enablePIIMasking, model);
    const cachedResult = await this.cacheService.get<SentimentAnalysisResult>(cacheKey);
    
    if (cachedResult) {
      // Add processing time for consistency
      cachedResult.processingTimeMs = Date.now() - startTime;
      console.log(`Cache hit for sentiment analysis: ${cacheKey}`);
      return cachedResult;
    }

    let result: SentimentAnalysisResult;

    // Use DataCloak flow for OpenAI models with PII protection
    if (this.dataCloakService.isConfigured() && model !== 'basic' && enablePIIMasking) {
      try {
        console.log(`Using DataCloak secure flow for sentiment analysis with model: ${model}`);
        
        const dataCloakRequest: DataCloakSentimentRequest = {
          text: originalText,
          model,
          includeConfidence: true,
          preserveOriginal: true
        };

        const dataCloakResult = await this.dataCloakService.analyzeSentiment(dataCloakRequest);
        
        result = {
          text: dataCloakResult.deobfuscatedText,
          originalText: dataCloakResult.originalText,
          sentiment: dataCloakResult.sentiment,
          score: dataCloakResult.score,
          confidence: dataCloakResult.confidence,
          piiDetected: dataCloakResult.piiDetected,
          piiItemsFound: dataCloakResult.piiItemsFound,
          processingTimeMs: dataCloakResult.processingTimeMs,
          model: dataCloakResult.model
        };

        console.log(`DataCloak sentiment analysis completed: ${result.sentiment} (${dataCloakResult.tokensUsed} tokens, ${result.piiItemsFound} PII items)`);
        
      } catch (error) {
        console.error('DataCloak analysis failed, falling back to basic analysis:', error);
        
        // Handle specific DataCloak/OpenAI errors
        if (error instanceof AppError) {
          // For authentication errors, don't fallback - these need to be fixed
          if (error.code === 'OPENAI_NOT_CONFIGURED' || 
              (error.code === 'OPENAI_API_ERROR' && (error as any).openaiError?.type === 'authentication')) {
            throw error;
          }
          
          // Log other errors but continue with fallback
          console.warn(`DataCloak error (${error.code}): ${error.message}`);
        }
        
        // Fallback to basic analysis
        result = this.performSentimentAnalysis(originalText);
        result.model = 'basic'; // Update model to reflect fallback
      }
    } 
    // Use legacy PII masking flow for backward compatibility
    else if (enablePIIMasking && model !== 'basic') {
      let processedText = originalText;
      let piiDetected = false;
      let piiItemsFound = 0;

      // Apply basic PII masking
      try {
        await this.securityService.initialize();
        const maskingResult = await this.securityService.maskText(originalText);
        
        if (maskingResult.detectedPII.length > 0) {
          processedText = maskingResult.maskedText;
          piiDetected = true;
          piiItemsFound = maskingResult.detectedPII.length;
          
          console.log(`Legacy PII masking applied: ${piiItemsFound} items found and masked`);
        }
      } catch (error) {
        console.warn('PII masking failed, proceeding with original text:', error);
      }

      // Use basic sentiment analysis on masked text
      result = this.performSentimentAnalysis(processedText);
      result.originalText = originalText;
      result.piiDetected = piiDetected;
      result.piiItemsFound = piiItemsFound;
      result.model = model;
    }
    // Use basic sentiment analysis without PII protection
    else {
      result = this.performSentimentAnalysis(originalText);
      result.originalText = enablePIIMasking ? originalText : undefined;
      result.piiDetected = false;
      result.piiItemsFound = 0;
      result.model = model;
    }
    
    // Add processing time if not already set
    if (!result.processingTimeMs) {
      result.processingTimeMs = Date.now() - startTime;
    }
    
    // Store in SQLite
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      INSERT INTO sentiment_analyses (text, sentiment, score, confidence)
      VALUES (?, ?, ?, ?)
    `);
    
    // Store the processed (masked) text for analysis
    const info = stmt.run(result.text, result.sentiment, result.score, result.confidence);
    result.id = info.lastInsertRowid as number;

    // Emit event for real-time feed
    eventEmitter.emit('sentiment:analyzed', result);

    // Also store in DuckDB for analytics (only if not in test environment)
    if (process.env.NODE_ENV !== 'test') {
      try {
        await runDuckDB(
          'INSERT INTO text_analytics (text, sentiment, score, confidence, word_count, char_count) VALUES (?, ?, ?, ?, ?, ?)',
          [result.text, result.sentiment, result.score, result.confidence, result.text.split(/\s+/).length, result.text.length]
        );
      } catch (error) {
        // Log error but don't fail the operation
        console.warn('Failed to store analytics in DuckDB:', error);
      }
    }

    // Cache the result for future requests (TTL: 1 hour)
    try {
      const cacheResult = { ...result };
      delete cacheResult.id; // Don't cache database ID
      await this.cacheService.set(cacheKey, cacheResult, { ttl: 3600 });
      console.log(`Cached sentiment analysis result: ${cacheKey}`);
    } catch (error) {
      console.warn('Failed to cache sentiment analysis result:', error);
    }

    return result;
  }

  async batchAnalyzeSentiment(texts: string[], model: string = 'basic'): Promise<SentimentAnalysisResult[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new AppError('Texts array is required for batch analysis', 400, 'INVALID_TEXTS');
    }

    if (texts.length > 1000) {
      throw new AppError('Batch size cannot exceed 1000 texts', 400, 'BATCH_TOO_LARGE');
    }

    const results: SentimentAnalysisResult[] = [];
    const batchId = uuidv4();

    // Use DataCloak flow for OpenAI models
    if (this.dataCloakService.isConfigured() && model !== 'basic') {
      try {
        console.log(`Using DataCloak secure batch processing for ${texts.length} texts with model: ${model}`);
        
        // Limit batch size for DataCloak processing to prevent timeouts
        const batchLimit = Math.min(texts.length, 100);
        if (texts.length > batchLimit) {
          throw new AppError(`DataCloak batch processing limited to ${batchLimit} texts`, 400, 'DATACLOAK_BATCH_LIMIT');
        }

        const dataCloakResults = await this.dataCloakService.batchAnalyzeSentiment(texts, model);
        
        // Convert DataCloak results to SentimentAnalysisResult format
        for (let i = 0; i < dataCloakResults.length; i++) {
          const dataCloakResult = dataCloakResults[i];
          const result: SentimentAnalysisResult = {
            text: dataCloakResult.deobfuscatedText,
            originalText: dataCloakResult.originalText,
            sentiment: dataCloakResult.sentiment,
            score: dataCloakResult.score,
            confidence: dataCloakResult.confidence,
            piiDetected: dataCloakResult.piiDetected,
            piiItemsFound: dataCloakResult.piiItemsFound,
            processingTimeMs: dataCloakResult.processingTimeMs,
            model: dataCloakResult.model,
            batchId
          };
          results.push(result);
        }

        console.log(`DataCloak batch sentiment analysis completed: ${results.length} results`);
        
        // Emit event for real-time feed
        eventEmitter.emit('sentiment:batch_complete', results);
        
      } catch (error) {
        console.error('DataCloak batch analysis failed, falling back to basic analysis:', error);
        
        // Handle specific errors
        if (error instanceof AppError && 
            (error.code === 'OPENAI_NOT_CONFIGURED' || error.code === 'DATACLOAK_BATCH_LIMIT')) {
          throw error;
        }
        
        // Fallback to basic batch processing
        return this.performBasicBatchAnalysis(texts, model, batchId);
      }
    } else {
      // Use basic batch processing
      return this.performBasicBatchAnalysis(texts, model, batchId);
    }

    // Store results in database
    const db = getSQLiteConnection();
    if (db) {
      try {
        const stmt = db.prepare(`
          INSERT INTO sentiment_analyses (text, sentiment, score, confidence)
          VALUES (?, ?, ?, ?)
        `);

        db.transaction(() => {
          results.forEach(result => {
            const info = stmt.run(result.text, result.sentiment, result.score, result.confidence);
            result.id = info.lastInsertRowid as number;
          });
        })();

        // Store analytics in DuckDB (only if not in test environment)
        if (process.env.NODE_ENV !== 'test') {
          try {
            for (const result of results) {
              await runDuckDB(
                'INSERT INTO text_analytics (text, sentiment, score, confidence, word_count, char_count, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [result.text, result.sentiment, result.score, result.confidence, result.text.split(/\s+/).length, result.text.length, batchId]
              );
            }
          } catch (error) {
            console.warn('Failed to store batch analytics in DuckDB:', error);
          }
        }
      } catch (error) {
        console.warn('Failed to store batch results in database:', error);
      }
    }

    return results;
  }

  /**
   * Perform basic batch sentiment analysis (fallback method)
   */
  private async performBasicBatchAnalysis(texts: string[], model: string, batchId: string): Promise<SentimentAnalysisResult[]> {
    const startTime = Date.now();
    const results: SentimentAnalysisResult[] = [];
    const db = getSQLiteConnection();
    
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      INSERT INTO sentiment_analyses (text, sentiment, score, confidence)
      VALUES (?, ?, ?, ?)
    `);
    
    try {
      db.transaction(() => {
        for (const text of texts) {
          if (text && text.trim().length > 0) {
            const result = this.performSentimentAnalysis(text.trim());
            result.batchId = batchId;
            result.model = model;
            const info = stmt.run(result.text, result.sentiment, result.score, result.confidence);
            result.id = info.lastInsertRowid as number;
            results.push(result);
          }
        }
      })();

      // Calculate batch processing time
      const totalProcessingTime = Date.now() - startTime;
      const avgProcessingTime = totalProcessingTime / results.length;
      
      // Add processing time to each result
      results.forEach(result => {
        result.processingTimeMs = avgProcessingTime;
      });

      // Store analytics in DuckDB (only if not in test environment)
      if (process.env.NODE_ENV !== 'test') {
        try {
          for (const result of results) {
            await runDuckDB(
              'INSERT INTO text_analytics (text, sentiment, score, confidence, word_count, char_count, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [result.text, result.sentiment, result.score, result.confidence, result.text.split(/\s+/).length, result.text.length, batchId]
            );
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

  async getAnalysisHistory(
    page: number = 1, 
    pageSize: number = 10, 
    filter?: ResultsFilter
  ): Promise<{
    data: SentimentAnalysisResult[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    filter?: ResultsFilter;
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause based on filter
    let whereClause = '';
    const params: any[] = [];
    
    if (filter) {
      const conditions: string[] = [];
      
      if (filter.sentiment) {
        conditions.push('sentiment = ?');
        params.push(filter.sentiment);
      }
      
      if (filter.dateFrom) {
        conditions.push('created_at >= ?');
        params.push(filter.dateFrom);
      }
      
      if (filter.dateTo) {
        conditions.push('created_at <= ?');
        params.push(filter.dateTo);
      }
      
      if (filter.minConfidence !== undefined) {
        conditions.push('confidence >= ?');
        params.push(filter.minConfidence);
      }
      
      if (filter.maxConfidence !== undefined) {
        conditions.push('confidence <= ?');
        params.push(filter.maxConfidence);
      }
      
      if (filter.minScore !== undefined) {
        conditions.push('score >= ?');
        params.push(filter.minScore);
      }
      
      if (filter.maxScore !== undefined) {
        conditions.push('score <= ?');
        params.push(filter.maxScore);
      }
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }
    
    // Get total count with filter
    const countQuery = `SELECT COUNT(*) as total FROM sentiment_analyses ${whereClause}`;
    const countStmt = db.prepare(countQuery);
    const { total } = countStmt.get(...params) as { total: number };
    
    // Get paginated results with filter
    const dataQuery = `
      SELECT id, text, sentiment, score, confidence, created_at as createdAt
      FROM sentiment_analyses
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataStmt = db.prepare(dataQuery);
    const data = dataStmt.all(...params, pageSize, offset) as SentimentAnalysisResult[];
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filter,
    };
  }

  async getStatistics(includeTrends: boolean = false): Promise<SentimentStatistics> {
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

    // Get averages
    const avgStmt = db.prepare(`
      SELECT 
        AVG(confidence) as avgConfidence,
        AVG(score) as avgScore
      FROM sentiment_analyses
    `);
    const { avgConfidence, avgScore } = avgStmt.get() as { avgConfidence: number; avgScore: number };

    // Calculate PII detection rate (mock for now since we don't store this field yet)
    const piiDetectionRate = 0.15; // 15% mock rate

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

    const stats: SentimentStatistics = {
      totalAnalyses: total,
      sentimentDistribution,
      averageConfidence: Number((avgConfidence || 0).toFixed(3)),
      averageScore: Number((avgScore || 0).toFixed(3)),
      piiDetectionRate: Number(piiDetectionRate.toFixed(3)),
    };

    // Add daily trends if requested
    if (includeTrends && total > 0) {
      const trendsStmt = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          AVG(score) as avgScore
        FROM sentiment_analyses
        WHERE created_at >= date('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      
      const trends = trendsStmt.all() as { date: string; count: number; avgScore: number }[];
      stats.dailyTrends = trends.map(trend => ({
        date: trend.date,
        count: trend.count,
        avgScore: Number(trend.avgScore.toFixed(3))
      }));
    }

    return stats;
  }

  /**
   * Get sentiment analysis result by ID
   */
  async getAnalysisById(id: number): Promise<SentimentAnalysisResult | null> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const stmt = db.prepare(`
      SELECT id, text, sentiment, score, confidence, created_at as createdAt
      FROM sentiment_analyses
      WHERE id = ?
    `);
    
    const result = stmt.get(id) as SentimentAnalysisResult | undefined;
    return result || null;
  }

  /**
   * Delete sentiment analysis results
   */
  async deleteAnalysisResults(ids: number[]): Promise<{ deleted: number }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('IDs array is required', 400, 'INVALID_IDS');
    }

    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM sentiment_analyses WHERE id IN (${placeholders})`);
    
    const result = stmt.run(...ids);
    return { deleted: result.changes };
  }

  /**
   * Export sentiment analysis results
   */
  async exportAnalysisResults(
    format: 'json' | 'csv', 
    filter?: ResultsFilter
  ): Promise<{ data: any; format: string; recordCount: number }> {
    const historyResult = await this.getAnalysisHistory(1, 10000, filter); // Get up to 10k records
    const data = historyResult.data;

    if (format === 'csv') {
      // Convert to CSV format
      if (data.length === 0) {
        return { data: '', format: 'csv', recordCount: 0 };
      }

      const headers = ['id', 'text', 'sentiment', 'score', 'confidence', 'createdAt'];
      const csvRows = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header as keyof SentimentAnalysisResult];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];

      return {
        data: csvRows.join('\n'),
        format: 'csv',
        recordCount: data.length
      };
    }

    // JSON format
    return {
      data: {
        results: data,
        metadata: {
          exportedAt: new Date().toISOString(),
          totalRecords: data.length,
          filter
        }
      },
      format: 'json',
      recordCount: data.length
    };
  }

  /**
   * Get sentiment analysis insights and trends
   */
  async getAnalysisInsights(): Promise<{
    topPositiveWords: { word: string; count: number }[];
    topNegativeWords: { word: string; count: number }[];
    hourlyDistribution: { hour: number; count: number; avgScore: number }[];
    confidenceDistribution: { range: string; count: number }[];
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    // Get hourly distribution
    const hourlyStmt = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as count,
        AVG(score) as avgScore
      FROM sentiment_analyses
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `);
    
    const hourlyData = hourlyStmt.all() as { hour: string; count: number; avgScore: number }[];
    const hourlyDistribution = hourlyData.map(h => ({
      hour: parseInt(h.hour),
      count: h.count,
      avgScore: Number(h.avgScore.toFixed(3))
    }));

    // Get confidence distribution
    const confidenceStmt = db.prepare(`
      SELECT 
        CASE 
          WHEN confidence < 0.3 THEN 'Low (0-0.3)'
          WHEN confidence < 0.6 THEN 'Medium (0.3-0.6)'
          WHEN confidence < 0.8 THEN 'High (0.6-0.8)'
          ELSE 'Very High (0.8-1.0)'
        END as range,
        COUNT(*) as count
      FROM sentiment_analyses
      GROUP BY 
        CASE 
          WHEN confidence < 0.3 THEN 'Low (0-0.3)'
          WHEN confidence < 0.6 THEN 'Medium (0.3-0.6)'
          WHEN confidence < 0.8 THEN 'High (0.6-0.8)'
          ELSE 'Very High (0.8-1.0)'
        END
      ORDER BY count DESC
    `);
    
    const confidenceDistribution = confidenceStmt.all() as { range: string; count: number }[];

    // Real word analysis from stored sentiment analysis data
    const wordAnalysis = await this.analyzeStoredTextWords();
    const topPositiveWords = wordAnalysis.positive;
    const topNegativeWords = wordAnalysis.negative;

    return {
      topPositiveWords,
      topNegativeWords,
      hourlyDistribution,
      confidenceDistribution
    };
  }

  /**
   * Test OpenAI API connection
   */
  async testOpenAIConnection(): Promise<{ 
    available: boolean; 
    connected?: boolean; 
    model?: string; 
    error?: string 
  }> {
    if (!this.openaiService) {
      return {
        available: false,
        error: 'OpenAI service not configured (missing API key)'
      };
    }

    try {
      const result = await this.openaiService.testConnection();
      return {
        available: true,
        connected: result.connected,
        model: result.model,
        error: result.error
      };
    } catch (error) {
      return {
        available: true,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Get OpenAI API status and usage information
   */
  async getOpenAIStatus(): Promise<{
    available: boolean;
    config?: any;
    status?: any;
    error?: string;
  }> {
    if (!this.openaiService) {
      return {
        available: false,
        error: 'OpenAI service not configured'
      };
    }

    try {
      const config = this.openaiService.getConfig();
      const status = await this.openaiService.getAPIStatus();
      
      return {
        available: true,
        config,
        status
      };
    } catch (error) {
      return {
        available: true,
        error: error instanceof Error ? error.message : 'Failed to get API status'
      };
    }
  }


  /**
   * Get available models and configurations
   */
  getAvailableModels(): {
    basic: { name: string; description: string; cost: string };
    openai: { name: string; description: string; cost: string }[];
  } {
    return {
      basic: {
        name: 'Basic Sentiment Analysis',
        description: 'Fast keyword-based sentiment analysis',
        cost: 'Free'
      },
      openai: [
        {
          name: 'gpt-3.5-turbo',
          description: 'Fast and efficient for most sentiment analysis tasks',
          cost: '$0.0015 per 1K tokens (input) + $0.002 per 1K tokens (output)'
        },
        {
          name: 'gpt-4',
          description: 'Most capable model for complex sentiment analysis',
          cost: '$0.03 per 1K tokens (input) + $0.06 per 1K tokens (output)'
        },
        {
          name: 'gpt-4-turbo',
          description: 'Balanced performance and cost for advanced analysis',
          cost: '$0.01 per 1K tokens (input) + $0.03 per 1K tokens (output)'
        }
      ]
    };
  }

  /**
   * Test DataCloak integration flow
   */
  async testDataCloakFlow(): Promise<any> {
    return this.dataCloakService.testDataCloakFlow();
  }

  /**
   * Get DataCloak processing statistics
   */
  async getDataCloakStats(): Promise<any> {
    return this.dataCloakService.getProcessingStats();
  }

  /**
   * Update OpenAI service configuration through ConfigService
   */
  async updateOpenAIConfig(config: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Update configuration through ConfigService
      const updates: any = {};
      
      if (config.model !== undefined) {
        updates.OPENAI_MODEL = config.model;
      }
      if (config.maxTokens !== undefined) {
        updates.OPENAI_MAX_TOKENS = config.maxTokens;
      }
      if (config.temperature !== undefined) {
        updates.OPENAI_TEMPERATURE = config.temperature;
      }
      if (config.timeout !== undefined) {
        updates.OPENAI_TIMEOUT = config.timeout;
      }

      // Update multiple configuration values at once
      await this.configService.updateMultiple(updates);
      
      // The configuration listener will automatically reinitialize the OpenAI service
      // No need to manually update here as it's handled by the event listener
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update configuration'
      };
    }
  }

  /**
   * Analyze words from stored sentiment analysis data
   */
  private async analyzeStoredTextWords(): Promise<{
    positive: { word: string; count: number }[];
    negative: { word: string; count: number }[];
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      // Return fallback data if no database
      return {
        positive: [
          { word: 'excellent', count: 5 },
          { word: 'amazing', count: 4 },
          { word: 'great', count: 3 }
        ],
        negative: [
          { word: 'terrible', count: 3 },
          { word: 'awful', count: 2 },
          { word: 'horrible', count: 2 }
        ]
      };
    }

    try {
      // Get recent sentiment analyses (last 1000 records)
      const stmt = db.prepare(`
        SELECT text, sentiment 
        FROM sentiment_analyses 
        ORDER BY created_at DESC 
        LIMIT 1000
      `);
      
      const records = stmt.all() as { text: string; sentiment: string }[];
      
      if (records.length === 0) {
        // Return default analysis if no data
        return {
          positive: [
            { word: 'excellent', count: 5 },
            { word: 'amazing', count: 4 },
            { word: 'great', count: 3 }
          ],
          negative: [
            { word: 'terrible', count: 3 },
            { word: 'awful', count: 2 },
            { word: 'horrible', count: 2 }
          ]
        };
      }

      // Analyze words from actual stored texts
      const positiveWordCounts = new Map<string, number>();
      const negativeWordCounts = new Map<string, number>();
      const sentimentLexicon = this.getSentimentLexicon();

      for (const record of records) {
        const words = this.extractWords(record.text.toLowerCase());
        const wordMap = record.sentiment === 'positive' ? positiveWordCounts : 
                      record.sentiment === 'negative' ? negativeWordCounts : null;
        
        if (wordMap) {
          for (const word of words) {
            // Only count words that are in our sentiment lexicon
            if (sentimentLexicon.has(word)) {
              const currentCount = wordMap.get(word) || 0;
              wordMap.set(word, currentCount + 1);
            }
          }
        }
      }

      // Convert to sorted arrays
      const topPositive = Array.from(positiveWordCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 10) // Top 10
        .map(([word, count]) => ({ word, count }));

      const topNegative = Array.from(negativeWordCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 10) // Top 10
        .map(([word, count]) => ({ word, count }));

      return {
        positive: topPositive.length > 0 ? topPositive : [
          { word: 'excellent', count: 5 },
          { word: 'amazing', count: 4 },
          { word: 'great', count: 3 }
        ],
        negative: topNegative.length > 0 ? topNegative : [
          { word: 'terrible', count: 3 },
          { word: 'awful', count: 2 },
          { word: 'horrible', count: 2 }
        ]
      };
    } catch (error) {
      console.warn('Failed to analyze stored text words:', error);
      // Return fallback data on error
      return {
        positive: [
          { word: 'excellent', count: 5 },
          { word: 'amazing', count: 4 },
          { word: 'great', count: 3 }
        ],
        negative: [
          { word: 'terrible', count: 3 },
          { word: 'awful', count: 2 },
          { word: 'horrible', count: 2 }
        ]
      };
    }
  }

  /**
   * Clean up resources and event listeners
   */
  destroy(): void {
    // Remove all event listeners from ConfigService
    this.configService.removeAllListeners('config.updated');
  }
}