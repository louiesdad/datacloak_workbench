import { SecurityService } from './security.service';
import { OpenAIService, OpenAISentimentRequest, OpenAISentimentResponse } from './openai.service';
import { AppError } from '../middleware/error.middleware';

export interface DataCloakSentimentRequest {
  text: string;
  model?: string;
  includeConfidence?: boolean;
  preserveOriginal?: boolean;
}

export interface DataCloakSentimentResponse {
  originalText: string;
  obfuscatedText: string;
  deobfuscatedText: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  reasoning?: string;
  tokensUsed: number;
  model: string;
  piiDetected: boolean;
  piiItemsFound: number;
  processingTimeMs: number;
  obfuscationMap: ObfuscationMapping[];
}

export interface ObfuscationMapping {
  original: string;
  obfuscated: string;
  piiType: string;
  fieldName: string;
  confidence: number;
}

/**
 * DataCloak Integration Service
 * Integrates with the Rust-based DataCloak library for secure data obfuscation
 * Flow: Original Text → DataCloak Obfuscation → OpenAI → De-obfuscation → Final Result
 * 
 * DataCloak is a high-performance Rust library that:
 * - Automatically detects PII using machine learning
 * - Obfuscates sensitive data before sending to LLMs
 * - Maintains mappings for accurate de-obfuscation
 * - Supports batch processing with rate limiting
 */
export class DataCloakIntegrationService {
  private securityService: SecurityService;
  private openaiService?: OpenAIService;

  constructor(openaiService?: OpenAIService) {
    this.securityService = new SecurityService();
    this.openaiService = openaiService;
  }

  /**
   * Perform sentiment analysis using DataCloak secure flow
   */
  async analyzeSentiment(request: DataCloakSentimentRequest): Promise<DataCloakSentimentResponse> {
    const startTime = Date.now();
    
    if (!request.text || request.text.trim().length === 0) {
      throw new AppError('Text is required for sentiment analysis', 400, 'INVALID_TEXT');
    }

    if (!this.openaiService) {
      throw new AppError('OpenAI service not configured', 500, 'OPENAI_NOT_CONFIGURED');
    }

    // Step 1: Initialize security service
    await this.securityService.initialize();

    // Step 2: Obfuscate the text using DataCloak
    console.log('Step 1: Obfuscating sensitive data with DataCloak...');
    const maskingResult = await this.securityService.maskText(request.text);
    
    const obfuscationMap: ObfuscationMapping[] = maskingResult.detectedPII.map(pii => ({
      original: pii.sample,
      obfuscated: pii.masked,
      piiType: pii.piiType,
      fieldName: pii.fieldName,
      confidence: pii.confidence
    }));

    console.log(`DataCloak obfuscation complete: ${maskingResult.detectedPII.length} PII items masked`);

    // Step 3: Send obfuscated text to OpenAI for sentiment analysis
    console.log('Step 2: Sending obfuscated text to OpenAI for sentiment analysis...');
    const openaiRequest: OpenAISentimentRequest = {
      text: maskingResult.maskedText,
      model: request.model,
      includeConfidence: request.includeConfidence
    };

    let openaiResponse: OpenAISentimentResponse;
    try {
      openaiResponse = await this.openaiService.analyzeSentiment(openaiRequest);
      console.log(`OpenAI analysis complete: ${openaiResponse.sentiment} (${openaiResponse.tokensUsed} tokens)`);
    } catch (error) {
      console.error('OpenAI sentiment analysis failed:', error);
      throw new AppError(
        `Failed to analyze sentiment with OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'OPENAI_ANALYSIS_FAILED'
      );
    }

    // Step 4: De-obfuscate the response (if needed)
    // Note: For sentiment analysis, the result doesn't contain the original text,
    // so we mainly need to preserve the mapping for transparency
    console.log('Step 3: De-obfuscating response and preparing final result...');
    
    const deobfuscatedText = await this.deobfuscateText(openaiResponse.reasoning || '', obfuscationMap);

    // Step 5: Prepare the final response with full traceability
    const response: DataCloakSentimentResponse = {
      originalText: request.text,
      obfuscatedText: maskingResult.maskedText,
      deobfuscatedText,
      sentiment: openaiResponse.sentiment,
      score: openaiResponse.score,
      confidence: openaiResponse.confidence,
      reasoning: deobfuscatedText,
      tokensUsed: openaiResponse.tokensUsed,
      model: openaiResponse.model,
      piiDetected: maskingResult.detectedPII.length > 0,
      piiItemsFound: maskingResult.detectedPII.length,
      processingTimeMs: Date.now() - startTime,
      obfuscationMap
    };

    console.log(`DataCloak sentiment analysis complete in ${response.processingTimeMs}ms`);
    return response;
  }

  /**
   * Batch sentiment analysis using DataCloak secure flow
   */
  async batchAnalyzeSentiment(
    texts: string[], 
    model?: string
  ): Promise<DataCloakSentimentResponse[]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new AppError('Texts array is required for batch analysis', 400, 'INVALID_TEXTS');
    }

    if (texts.length > 100) {
      throw new AppError('Batch size cannot exceed 100 texts for DataCloak processing', 400, 'BATCH_TOO_LARGE');
    }

    console.log(`Starting DataCloak batch sentiment analysis for ${texts.length} texts...`);
    
    const results: DataCloakSentimentResponse[] = [];
    const errors: { index: number; error: string }[] = [];

    // Process each text individually to maintain security isolation
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.analyzeSentiment({
          text: texts[i],
          model,
          includeConfidence: true
        });
        results.push(result);
        
        // Log progress for long batches
        if (i % 10 === 0 && i > 0) {
          console.log(`Processed ${i + 1}/${texts.length} texts`);
        }
      } catch (error) {
        console.error(`Failed to process text ${i + 1}:`, error);
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Create a placeholder result to maintain array consistency
        results.push({
          originalText: texts[i],
          obfuscatedText: texts[i],
          deobfuscatedText: texts[i],
          sentiment: 'neutral',
          score: 0,
          confidence: 0,
          reasoning: `Error processing text: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tokensUsed: 0,
          model: model || 'error',
          piiDetected: false,
          piiItemsFound: 0,
          processingTimeMs: 0,
          obfuscationMap: []
        });
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch processing completed with ${errors.length} errors out of ${texts.length} texts`);
    }

    console.log(`DataCloak batch sentiment analysis complete: ${results.length} results`);
    return results;
  }

  /**
   * Test the complete DataCloak → OpenAI → De-obfuscation flow
   */
  async testDataCloakFlow(): Promise<{
    success: boolean;
    steps: {
      obfuscation: { success: boolean; error?: string; piiFound?: number };
      openaiAnalysis: { success: boolean; error?: string; tokensUsed?: number };
      deobfuscation: { success: boolean; error?: string };
    };
    totalTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const testText = "Hello, my name is John Doe and my email is john.doe@example.com. I feel great today!";
    
    const result = {
      success: false,
      steps: {
        obfuscation: { success: false },
        openaiAnalysis: { success: false },
        deobfuscation: { success: false }
      },
      totalTime: 0,
      error: undefined as string | undefined
    };

    try {
      // Test obfuscation
      await this.securityService.initialize();
      const maskingResult = await this.securityService.maskText(testText);
      result.steps.obfuscation = {
        success: true,
        piiFound: maskingResult.detectedPII.length
      };

      // Test OpenAI analysis
      if (this.openaiService) {
        const openaiResponse = await this.openaiService.analyzeSentiment({
          text: maskingResult.maskedText,
          includeConfidence: true
        });
        result.steps.openaiAnalysis = {
          success: true,
          tokensUsed: openaiResponse.tokensUsed
        };

        // Test deobfuscation
        const obfuscationMap: ObfuscationMapping[] = maskingResult.detectedPII.map(pii => ({
          original: pii.sample,
          obfuscated: pii.masked,
          piiType: pii.piiType,
          fieldName: pii.fieldName,
          confidence: pii.confidence
        }));

        await this.deobfuscateText(openaiResponse.reasoning || '', obfuscationMap);
        result.steps.deobfuscation = { success: true };

        result.success = true;
      } else {
        result.steps.openaiAnalysis.error = 'OpenAI service not configured';
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Set specific step errors
      if (!result.steps.obfuscation.success) {
        result.steps.obfuscation.error = result.error;
      } else if (!result.steps.openaiAnalysis.success) {
        result.steps.openaiAnalysis.error = result.error;
      } else {
        result.steps.deobfuscation.error = result.error;
      }
    }

    result.totalTime = Date.now() - startTime;
    return result;
  }

  /**
   * Get DataCloak processing statistics
   */
  async getProcessingStats(): Promise<{
    totalProcessed: number;
    piiItemsFound: number;
    averageProcessingTime: number;
    securityMetrics: any;
  }> {
    try {
      const securityMetrics = await this.securityService.getSecurityMetrics();
      
      return {
        totalProcessed: securityMetrics.totalScans,
        piiItemsFound: securityMetrics.piiItemsDetected,
        averageProcessingTime: 0, // Would need to track this separately
        securityMetrics
      };
    } catch (error) {
      throw new AppError(
        `Failed to get processing stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'STATS_ERROR'
      );
    }
  }

  /**
   * De-obfuscate text by replacing masked values with originals
   */
  private async deobfuscateText(text: string, obfuscationMap: ObfuscationMapping[]): Promise<string> {
    let deobfuscatedText = text;
    
    // Replace obfuscated values with original values
    obfuscationMap.forEach(mapping => {
      // Only de-obfuscate if the user should see the original
      // For sentiment analysis reasoning, we might want to keep some masking for privacy
      const replacement = this.shouldDeobfuscate(mapping.piiType) ? mapping.original : mapping.obfuscated;
      deobfuscatedText = deobfuscatedText.replace(new RegExp(mapping.obfuscated, 'g'), replacement);
    });

    return deobfuscatedText;
  }

  /**
   * Determine if a PII type should be de-obfuscated for the user
   */
  private shouldDeobfuscate(piiType: string): boolean {
    // For demonstration, we'll de-obfuscate names but keep other PII masked
    const safeToDeobfuscate = ['NAME'];
    return safeToDeobfuscate.includes(piiType);
  }

  /**
   * Update OpenAI service instance
   */
  setOpenAIService(openaiService: OpenAIService): void {
    this.openaiService = openaiService;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.openaiService !== undefined;
  }
}