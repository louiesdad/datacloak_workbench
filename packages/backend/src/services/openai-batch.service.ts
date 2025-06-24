import { OpenAIService, OpenAISentimentRequest, OpenAISentimentResponse } from './openai.service';
import { AppError } from '../middleware/error.middleware';
import pLimit from 'p-limit';

export interface BatchOpenAIOptions {
  concurrency?: number; // Max parallel requests (default: 5)
  retryAttempts?: number; // Retry failed requests (default: 2)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
  timeout?: number; // Request timeout per item (default: 30000)
  rateLimit?: {
    maxRequests: number; // Max requests per window
    windowMs: number; // Time window in ms
  };
}

export interface BatchResult {
  results: OpenAISentimentResponse[];
  errors: Array<{
    index: number;
    text: string;
    error: string;
  }>;
  stats: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
    avgProcessingTime: number;
    totalTokens: number;
  };
}

export class OpenAIBatchService {
  private openaiService: OpenAIService;
  private requestCount = 0;
  private requestTimestamps: number[] = [];

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
  }

  /**
   * Analyze sentiment for multiple texts in parallel
   */
  async analyzeBatch(
    texts: string[],
    options: BatchOpenAIOptions = {}
  ): Promise<BatchResult> {
    const {
      concurrency = 5,
      retryAttempts = 2,
      retryDelay = 1000,
      timeout = 30000,
      rateLimit = { maxRequests: 50, windowMs: 60000 }
    } = options;

    const startTime = Date.now();
    const results: OpenAISentimentResponse[] = [];
    const errors: BatchResult['errors'] = [];
    let totalTokens = 0;

    // Create concurrency limiter
    const limit = pLimit(concurrency);

    // Process each text with rate limiting and retries
    const promises = texts.map((text, index) =>
      limit(async () => {
        // Rate limiting check
        await this.checkRateLimit(rateLimit);

        for (let attempt = 0; attempt <= retryAttempts; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const request: OpenAISentimentRequest = {
              text,
              includeConfidence: true,
              signal: controller.signal
            };

            const result = await this.openaiService.analyzeSentiment(request);
            clearTimeout(timeoutId);

            results[index] = result;
            totalTokens += result.tokensUsed || 0;
            
            return result;
          } catch (error) {
            const isLastAttempt = attempt === retryAttempts;
            
            if (isLastAttempt) {
              console.error(`Failed to analyze text ${index} after ${retryAttempts + 1} attempts:`, error);
              errors.push({
                index,
                text,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              
              // Return a fallback result to maintain array positions
              const fallbackResult: OpenAISentimentResponse = {
                sentiment: 'neutral',
                score: 0,
                confidence: 0,
                reasoning: 'Analysis failed',
                tokensUsed: 0,
                model: 'gpt-3.5-turbo',
                fromCache: false
              };
              results[index] = fallbackResult;
              return fallbackResult;
            } else {
              // Exponential backoff for retries
              const delay = retryDelay * Math.pow(2, attempt);
              console.log(`Retrying text ${index} after ${delay}ms (attempt ${attempt + 1}/${retryAttempts})`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // This should never be reached, but TypeScript needs a return
        throw new Error('Unexpected code path in batch processing');
      })
    );

    // Wait for all promises to complete
    await Promise.all(promises);

    const totalProcessingTime = Date.now() - startTime;
    const successful = results.filter(r => r.confidence > 0).length;

    return {
      results,
      errors,
      stats: {
        total: texts.length,
        successful,
        failed: errors.length,
        totalProcessingTime,
        avgProcessingTime: totalProcessingTime / texts.length,
        totalTokens
      }
    };
  }

  /**
   * Check rate limiting before making a request
   */
  private async checkRateLimit(rateLimit: { maxRequests: number; windowMs: number }): Promise<void> {
    const now = Date.now();
    
    // Remove timestamps outside the current window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < rateLimit.windowMs
    );

    // If we've hit the rate limit, wait
    if (this.requestTimestamps.length >= rateLimit.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = rateLimit.windowMs - (now - oldestTimestamp) + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${waitTime}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Recursively check again after waiting
        return this.checkRateLimit(rateLimit);
      }
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  /**
   * Process very large batches in chunks
   */
  async analyzeLargeBatch(
    texts: string[],
    options: BatchOpenAIOptions & { chunkSize?: number } = {}
  ): Promise<BatchResult> {
    const { chunkSize = 50, ...batchOptions } = options;
    
    const allResults: OpenAISentimentResponse[] = [];
    const allErrors: BatchResult['errors'] = [];
    let totalStats = {
      total: 0,
      successful: 0,
      failed: 0,
      totalProcessingTime: 0,
      totalTokens: 0
    };

    // Process in chunks
    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(texts.length / chunkSize)} (${chunk.length} texts)`);
      
      const chunkResult = await this.analyzeBatch(chunk, batchOptions);
      
      // Merge results
      allResults.push(...chunkResult.results);
      
      // Adjust error indices to global position
      allErrors.push(...chunkResult.errors.map(e => ({
        ...e,
        index: e.index + i
      })));
      
      // Update stats
      totalStats.total += chunkResult.stats.total;
      totalStats.successful += chunkResult.stats.successful;
      totalStats.failed += chunkResult.stats.failed;
      totalStats.totalProcessingTime += chunkResult.stats.totalProcessingTime;
      totalStats.totalTokens += chunkResult.stats.totalTokens;
      
      // Brief pause between chunks to avoid overwhelming the API
      if (i + chunkSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      results: allResults,
      errors: allErrors,
      stats: {
        ...totalStats,
        avgProcessingTime: totalStats.totalProcessingTime / totalStats.total
      }
    };
  }
}