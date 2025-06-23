// DataCloak Integration Service for PII-aware sentiment analysis
import { OpenAIService } from './openai.service';
import { SecurityService, PIIDetectionResult } from './security.service';
import { getDataCloakInstance } from './datacloak-wrapper';
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
  private dataCloak: any;

  constructor(openaiService?: OpenAIService) {
    this.openaiService = openaiService;
    this.securityService = new SecurityService();
    this.initializeDataCloak();
  }

  private async initializeDataCloak() {
    this.dataCloak = await getDataCloakInstance();
  }

  setOpenAIService(openaiService: OpenAIService | undefined): void {
    this.openaiService = openaiService;
  }

  isConfigured(): boolean {
    return !!this.openaiService;
  }

  async analyzeSentiment(request: DataCloakSentimentRequest): Promise<DataCloakSentimentResult> {
    const startTime = Date.now();
    let dataCloak: any = null;
    let cleanupRequired = false;

    if (!this.openaiService) {
      throw new AppError('OpenAI service not configured', 500, 'OPENAI_NOT_CONFIGURED');
    }

    try {
      // Initialize DataCloak with proper error recovery
      if (!this.dataCloak) {
        try {
          this.dataCloak = await getDataCloakInstance();
          cleanupRequired = true;
        } catch (initError) {
          console.error('DataCloak initialization failed, falling back to basic sentiment analysis:', initError);
          // Fallback: perform sentiment analysis without PII masking
          const sentimentResponse = await this.openaiService.analyzeSentiment({
            text: request.text,
            model: request.model,
            includeConfidence: request.includeConfidence
          });
          
          return {
            sentiment: sentimentResponse.sentiment,
            score: sentimentResponse.score,
            confidence: sentimentResponse.confidence || 0.8,
            originalText: request.text,
            deobfuscatedText: request.text,
            piiDetected: false,
            piiItemsFound: 0,
            processingTimeMs: Date.now() - startTime,
            tokensUsed: sentimentResponse.tokensUsed || Math.floor(request.text.length / 4),
            model: request.model
          };
        }
      }
      
      dataCloak = this.dataCloak;
      if (!dataCloak) {
        throw new Error('DataCloak not initialized');
      }
      await dataCloak.initialize({});
      
      // Step 1: Detect PII using DataCloak's ML-powered detection with timeout
      let piiTimeoutId: NodeJS.Timeout | undefined;
      const piiResults = await Promise.race([
        dataCloak.detectPII(request.text),
        new Promise((_, reject) => {
          piiTimeoutId = setTimeout(() => reject(new Error('PII detection timeout')), 5000);
        })
      ]) as any[];
      
      // Clear timeout if main promise resolved first
      if (piiTimeoutId) clearTimeout(piiTimeoutId);
      
      // Step 2: Mask PII to protect sensitive data with timeout
      let maskingTimeoutId: NodeJS.Timeout | undefined;
      const maskingResult = await Promise.race([
        dataCloak.maskText(request.text),
        new Promise((_, reject) => {
          maskingTimeoutId = setTimeout(() => reject(new Error('Text masking timeout')), 5000);
        })
      ]) as any;
      
      // Clear timeout if main promise resolved first
      if (maskingTimeoutId) clearTimeout(maskingTimeoutId);
      
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
      
      // Cleanup DataCloak instance on failure if we initialized it
      if (cleanupRequired && this.dataCloak) {
        try {
          await this.dataCloak.cleanup?.();
        } catch (cleanupError) {
          console.error('DataCloak cleanup failed:', cleanupError);
        }
        this.dataCloak = null;
      }
      
      throw new AppError(`DataCloak sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500, 'DATACLOAK_ERROR');
    }
  }

  async batchAnalyzeSentiment(texts: string[], model: string): Promise<DataCloakSentimentResult[]> {
    const results: DataCloakSentimentResult[] = [];
    const errors: Array<{ index: number; error: Error; text: string }> = [];
    let retryCount = 0;
    const maxRetries = 2;

    // Process in batches with proper error isolation and concurrency control
    const batchSize = 3;
    const concurrencyLimit = 2; // Limit concurrent batches
    
    for (let i = 0; i < texts.length; i += batchSize * concurrencyLimit) {
      const batchGroups: string[][] = [];
      
      // Create batch groups with concurrency limit
      for (let j = 0; j < concurrencyLimit && i + j * batchSize < texts.length; j++) {
        const batch = texts.slice(i + j * batchSize, i + (j + 1) * batchSize);
        if (batch.length > 0) {
          batchGroups.push(batch);
        }
      }
      
      // Process batch groups with error isolation
      const batchGroupPromises = batchGroups.map(async (batch, groupIndex) => {
        const batchResults: DataCloakSentimentResult[] = [];
        
        // Process each item in batch with individual error handling
        for (const [textIndex, text] of batch.entries()) {
          const globalIndex = i + groupIndex * batchSize + textIndex;
          
          try {
            const result = await this.analyzeSentiment({
              text,
              model,
              includeConfidence: true,
              preserveOriginal: true
            });
            batchResults.push(result);
          } catch (error) {
            console.error(`Batch analysis failed for text ${globalIndex}:`, error);
            errors.push({ 
              index: globalIndex, 
              error: error instanceof Error ? error : new Error('Unknown error'), 
              text 
            });
            
            // Add fallback result to maintain array consistency
            batchResults.push({
              sentiment: 'neutral',
              score: 0,
              confidence: 0,
              originalText: text,
              deobfuscatedText: text,
              piiDetected: false,
              piiItemsFound: 0,
              processingTimeMs: 0,
              tokensUsed: Math.floor(text.length / 4),
              model
            });
          }
        }
        
        return batchResults;
      });
      
      try {
        const batchGroupResults = await Promise.allSettled(batchGroupPromises);
        
        // Collect successful results and handle failed batch groups
        for (const batchResult of batchGroupResults) {
          if (batchResult.status === 'fulfilled') {
            results.push(...batchResult.value);
          } else {
            console.error('Batch group failed:', batchResult.reason);
          }
        }
      } catch (error) {
        console.error('Critical batch processing error:', error);
        
        // If entire batch group fails, retry with exponential backoff
        if (retryCount < maxRetries) {
          retryCount++;
          const backoffDelay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying batch processing in ${backoffDelay}ms (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          i -= batchSize * concurrencyLimit; // Retry this batch group
          continue;
        }
      }
      
      // Rate limiting: wait between batch groups
      if (i + batchSize * concurrencyLimit < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Log error summary if any errors occurred
    if (errors.length > 0) {
      console.warn(`Batch analysis completed with ${errors.length} errors out of ${texts.length} texts`);
      console.warn('Error summary:', errors.map(e => `Index ${e.index}: ${e.error.message}`).join(', '));
    }

    return results;
  }

  async testDataCloakFlow(): Promise<any> {
    try {
      if (!this.dataCloak) {
        this.dataCloak = await getDataCloakInstance();
      }
      await this.dataCloak.initialize({});
      const stats = await this.dataCloak.getStats();
      
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
      if (!this.dataCloak) {
        this.dataCloak = await getDataCloakInstance();
      }
      const stats = await this.dataCloak.getStats();
      
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