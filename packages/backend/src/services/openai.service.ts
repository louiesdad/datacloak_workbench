import { AppError } from '../middleware/error.middleware';
import { RateLimiterService, createOpenAIRateLimiter } from './rate-limiter.service';
import { 
  TextOptimizer, 
  OpenAILogger, 
  CostTracker, 
  calculateTokenCost,
  OpenAIStreamProcessor,
  TokenUsage
} from './openai-enhancements';
import { CircuitBreaker, circuitBreakerManager } from './circuit-breaker.service';
import { ICacheService } from './cache.service';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  enableCache?: boolean;
  cacheService?: ICacheService;
  cacheTTL?: number; // Cache TTL in seconds
}

export interface OpenAIError {
  code: string;
  message: string;
  type: 'rate_limit' | 'api_error' | 'authentication' | 'invalid_request' | 'server_error' | 'timeout' | 'network_error';
  retryAfter?: number;
}

export interface OpenAISentimentRequest {
  text: string;
  model?: string;
  includeConfidence?: boolean;
  signal?: AbortSignal;
}

export interface OpenAISentimentResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  reasoning?: string;
  tokensUsed: number;
  model: string;
  fromCache?: boolean;
}

export class OpenAIService {
  private config: OpenAIConfig;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in ms
  private rateLimiter: RateLimiterService;
  private logger: OpenAILogger;
  private costTracker: CostTracker;
  private circuitBreaker: CircuitBreaker;
  private cacheService?: ICacheService;

  constructor(config: OpenAIConfig) {
    this.config = {
      maxTokens: 150,
      temperature: 0.1,
      timeout: 30000,
      enableCache: false,
      cacheTTL: 3600, // 1 hour default
      ...config,
      model: config.model || 'gpt-3.5-turbo'
    };

    if (!this.config.apiKey) {
      throw new AppError('OpenAI API key is required', 500, 'OPENAI_CONFIG_ERROR');
    }

    // Initialize rate limiter (3 requests per second)
    this.rateLimiter = createOpenAIRateLimiter();
    
    // Initialize logger and cost tracker
    this.logger = new OpenAILogger();
    this.costTracker = new CostTracker();

    // Initialize circuit breaker with OpenAI-specific settings
    this.circuitBreaker = circuitBreakerManager.getBreaker('openai-api', {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: this.config.timeout || 30000,
      resetTimeout: 60000, // 1 minute
      volumeThreshold: 10,
      errorThresholdPercentage: 50,
      fallbackFunction: async () => {
        throw new AppError(
          'OpenAI service is temporarily unavailable. Circuit breaker is open.',
          503,
          'OPENAI_SERVICE_UNAVAILABLE'
        );
      }
    });

    // Initialize cache service if provided
    if (this.config.enableCache && this.config.cacheService) {
      this.cacheService = this.config.cacheService;
    }
  }

  /**
   * Analyze sentiment using OpenAI API
   */
  async analyzeSentiment(request: OpenAISentimentRequest): Promise<OpenAISentimentResponse> {
    const { text, model = this.config.model, includeConfidence = true, signal } = request;

    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for sentiment analysis', 400, 'INVALID_INPUT');
    }

    // Check cache first if enabled
    const cacheKey = this.generateCacheKey(text, model, includeConfidence);
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      // Add cache hit indicator to the response
      return {
        ...cachedResult,
        fromCache: true
      };
    }

    // Optimize text if needed
    let optimizedText = TextOptimizer.compress(text);
    const estimatedTokens = TextOptimizer.estimateTokens(optimizedText);
    
    // If text is too long, use smart truncation
    const maxTextTokens = (this.config.maxTokens || 150) * 3; // Reserve tokens for response
    if (estimatedTokens > maxTextTokens) {
      optimizedText = TextOptimizer.smartTruncate(optimizedText, maxTextTokens);
      console.log(`Text truncated from ~${estimatedTokens} to ~${TextOptimizer.estimateTokens(optimizedText)} tokens`);
    }

    const prompt = this.buildSentimentPrompt(optimizedText, includeConfidence);
    
    try {
      const response = await this.makeOpenAIRequest({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise sentiment analysis expert. Respond only in the requested JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      }, 1, signal);

      const result = this.parseSentimentResponse(response, model);
      
      // Cache the result for future requests
      await this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'OPENAI_ANALYSIS_ERROR'
      );
    }
  }

  /**
   * Make a request to OpenAI API with retry logic and error handling
   */
  private async makeOpenAIRequest(payload: any, attempt = 1, signal?: AbortSignal): Promise<any> {
    // Apply rate limiting
    await this.rateLimiter.waitForLimit('openai-requests');

    const startTime = Date.now();
    this.logger.logRequest(payload.model, payload);

    // Execute request with circuit breaker protection
    return this.circuitBreaker.execute(async () => {
      try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      // Use provided signal or internal controller
      const effectiveSignal = signal || controller.signal;
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DataCloak-Sentiment-Workbench/1.0'
        },
        body: JSON.stringify(payload),
        signal: effectiveSignal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const shouldRetry = await this.handleAPIError(response, attempt);
        if (shouldRetry && attempt < this.retryAttempts) {
          // Retry the request
          return this.makeOpenAIRequest(payload, attempt + 1, signal);
        }
      }

      const data = await response.json() as any;
      
      // Track costs and log response
      if (data.usage) {
        this.costTracker.track(payload.model, data.usage);
        
        const tokenUsage: TokenUsage = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          estimatedCost: calculateTokenCost(data.usage, payload.model)
        };
        
        this.logger.logResponse(
          payload.model, 
          data, 
          Date.now() - startTime,
          tokenUsage
        );
      }
      
      return data;

    } catch (error) {
      this.logger.logError(payload.model, error, Date.now() - startTime);
      
      if (error instanceof AppError) {
        throw error;
      }

      // Handle different types of errors
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createOpenAIError('timeout', 'Request timed out', 'timeout');
        }
        
        if (error.message.includes('fetch')) {
          throw this.createOpenAIError('network_error', 'Network connection failed', 'network_error');
        }
      }

      throw this.createOpenAIError('api_error', 'Unexpected API error', 'api_error');
      }
    });
  }

  /**
   * Handle OpenAI API errors with appropriate error types and retry logic
   */
  private async handleAPIError(response: Response, attempt: number): Promise<boolean> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // If we can't parse the error response, use status codes
    }

    const errorCode = errorData.error?.code || response.status.toString();
    const errorMessage = errorData.error?.message || response.statusText;
    // const errorType = errorData.error?.type || 'api_error';

    switch (response.status) {
      case 401:
        throw this.createOpenAIError(
          'authentication_error',
          'Invalid API key or authentication failed',
          'authentication'
        );

      case 429:
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        
        if (attempt < this.retryAttempts) {
          console.log(`Rate limited. Retrying after ${retryAfter} seconds (attempt ${attempt}/${this.retryAttempts})`);
          await this.sleep(retryAfter * 1000);
          return true; // Signal retry
        }
        
        throw this.createOpenAIError(
          'rate_limit_exceeded',
          'Rate limit exceeded. Please try again later.',
          'rate_limit',
          retryAfter
        );

      case 400:
        throw this.createOpenAIError(
          errorCode,
          `Invalid request: ${errorMessage}`,
          'invalid_request'
        );

      case 500:
      case 502:
      case 503:
      case 504:
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Server error ${response.status}. Retrying in ${delay}ms (attempt ${attempt}/${this.retryAttempts})`);
          await this.sleep(delay);
          return true; // Signal retry
        }
        
        throw this.createOpenAIError(
          'server_error',
          `OpenAI server error: ${errorMessage}`,
          'server_error'
        );

      default:
        throw this.createOpenAIError(
          errorCode,
          `API error: ${errorMessage}`,
          'api_error'
        );
    }
  }

  /**
   * Create standardized OpenAI error
   */
  private createOpenAIError(
    code: string, 
    message: string, 
    type: OpenAIError['type'], 
    retryAfter?: number
  ): AppError {
    const error = new AppError(message, 500, 'OPENAI_API_ERROR');
    (error as any).openaiError = {
      code,
      message,
      type,
      retryAfter
    } as OpenAIError;
    return error;
  }

  /**
   * Build sentiment analysis prompt
   */
  private buildSentimentPrompt(text: string, includeConfidence: boolean): string {
    const basePrompt = `Analyze the sentiment of the following text and respond with ONLY a JSON object in this exact format:

{
  "sentiment": "positive" | "negative" | "neutral",
  "score": <number between -1 and 1>,
  ${includeConfidence ? '"confidence": <number between 0 and 1>,' : ''}
  "reasoning": "<brief explanation>"
}

Text to analyze: "${text.replace(/"/g, '\\"')}"`;

    return basePrompt;
  }

  /**
   * Parse OpenAI response for sentiment analysis
   */
  private parseSentimentResponse(response: any, model: string): OpenAISentimentResponse {
    if (!response || typeof response !== 'object') {
      throw new AppError('Invalid response from OpenAI API', 500, 'OPENAI_RESPONSE_ERROR');
    }
    
    if (!response.choices || response.choices.length === 0) {
      throw new AppError('No response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
    }

    const choice = response.choices[0];
    const content = choice.message?.content;
    
    if (!content) {
      throw new AppError('Empty response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
    }

    try {
      // Try parsing JSON first
      let parsed: any;
      try {
        parsed = JSON.parse(content.trim());
      } catch {
        // If JSON parsing fails, try parsing plain text format
        const sentimentMatch = content.match(/Sentiment:\s*(positive|negative|neutral)/i);
        const scoreMatch = content.match(/Score:\s*([-\d.]+)/);
        const confidenceMatch = content.match(/Confidence:\s*([\d.]+)/);
        
        if (sentimentMatch && scoreMatch) {
          parsed = {
            sentiment: sentimentMatch[1].toLowerCase(),
            score: parseFloat(scoreMatch[1]),
            confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8
          };
        } else {
          throw new Error('Unable to parse response format');
        }
      }
      
      // Validate required fields
      if (!parsed.sentiment || !['positive', 'negative', 'neutral'].includes(parsed.sentiment)) {
        throw new Error('Invalid sentiment value');
      }
      
      if (typeof parsed.score !== 'number' || parsed.score < -1 || parsed.score > 1) {
        throw new Error('Invalid score value');
      }

      return {
        sentiment: parsed.sentiment,
        score: Number(parsed.score.toFixed(3)),
        confidence: parsed.confidence ? Number(parsed.confidence.toFixed(3)) : 0.8,
        reasoning: parsed.reasoning || '',
        tokensUsed: response.usage?.total_tokens || 0,
        model
      };
      
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new AppError(
        'Failed to parse sentiment analysis response',
        500,
        'OPENAI_PARSE_ERROR'
      );
    }
  }

  /**
   * Test OpenAI API connection and authentication
   */
  async testConnection(): Promise<{ connected: boolean; model: string; available?: boolean; error?: string }> {
    try {
      // Test with models endpoint instead of chat completions for connection test
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const modelAvailable = data.data?.some((model: any) => model.id === this.config.model);

      return {
        connected: true,
        model: this.config.model,
        available: modelAvailable
      };

    } catch (error) {
      return {
        connected: false,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Get API usage and rate limit information
   */
  async getAPIStatus(): Promise<{
    operational: boolean;
    metrics: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
    };
    usage: {
      totalTokens: number;
      totalCost: number;
      breakdown: Record<string, { tokens: number; cost: number }>;
    };
    rateLimitStatus: {
      available: boolean;
      limit: number;
      remaining: number;
      resetAt: Date;
    };
  }> {
    const rateLimitStatus = this.rateLimiter.getStatus();
    const logStats = this.logger.getStats();
    const dailyCost = this.costTracker.getDailyCost();
    
    return {
      operational: true,
      metrics: {
        totalRequests: logStats.totalRequests || 0,
        successfulRequests: (logStats.totalRequests || 0) - (logStats.totalErrors || 0),
        failedRequests: logStats.totalErrors || 0,
        averageResponseTime: logStats.averageResponseTime || 0
      },
      usage: {
        totalTokens: dailyCost.total.tokens,
        totalCost: dailyCost.total.cost,
        breakdown: dailyCost.byModel
      },
      rateLimitStatus: {
        available: rateLimitStatus.tokensRemaining > 0,
        limit: rateLimitStatus.maxTokens || 3,
        remaining: rateLimitStatus.tokensRemaining || 3,
        resetAt: new Date(Date.now() + (rateLimitStatus.nextRefillIn || 60000))
      }
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OpenAIConfig>): void {
    // Validate temperature range
    if (newConfig.temperature !== undefined) {
      if (newConfig.temperature < 0 || newConfig.temperature > 2) {
        throw new AppError('Temperature must be between 0 and 2', 400, 'INVALID_CONFIG');
      }
    }
    
    // Validate max tokens
    if (newConfig.maxTokens !== undefined) {
      if (newConfig.maxTokens <= 0) {
        throw new AppError('Max tokens must be greater than 0', 400, 'INVALID_CONFIG');
      }
    }
    
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration (without API key)
   */
  getConfig(): Omit<OpenAIConfig, 'apiKey'> {
    const { apiKey, ...config } = this.config;
    return config;
  }

  /**
   * Analyze sentiment for large text using streaming
   */
  async *analyzeSentimentStream(
    text: string,
    options?: {
      chunkSize?: number;
      model?: string;
      onProgress?: (processed: number, total: number) => void;
    }
  ): AsyncGenerator<OpenAISentimentResponse> {
    const chunkSize = options?.chunkSize || 4000; // ~1000 tokens per chunk
    const model = options?.model || this.config.model;
    
    const chunks = OpenAIStreamProcessor.splitIntoChunks(text, chunkSize);
    const total = chunks.length;
    let processed = 0;
    
    for (const chunk of chunks) {
      const result = await this.analyzeSentiment({
        text: chunk,
        model,
        includeConfidence: true
      });
      
      processed++;
      if (options?.onProgress) {
        options.onProgress(processed, total);
      }
      
      yield result;
    }
  }

  /**
   * Get usage statistics and logs
   */
  getUsageStats() {
    return {
      logs: this.logger.getStats(),
      costs: {
        daily: this.costTracker.getDailyCost(),
        monthly: this.costTracker.getMonthlyCost()
      },
      rateLimit: this.rateLimiter.getStatus()
    };
  }

  /**
   * Get recent logs for debugging
   */
  getLogs(options?: { type?: string; model?: string; limit?: number }) {
    return this.logger.getLogs(options);
  }

  /**
   * Clear logs and reset counters
   */
  clearStats(): void {
    this.logger.clear();
  }

  /**
   * Batch sentiment analysis with optimized token usage
   */
  async analyzeSentimentBatch(
    texts: string[],
    options?: {
      model?: string;
      batchSize?: number;
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<OpenAISentimentResponse[]> {
    const batchSize = options?.batchSize || 5;
    const results: OpenAISentimentResponse[] = [];
    
    // Process in batches to optimize API calls
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(text => this.analyzeSentiment({
          text,
          model: options?.model,
          includeConfidence: true
        }))
      );
      
      results.push(...batchResults);
      
      if (options?.onProgress) {
        options.onProgress(Math.min(i + batchSize, texts.length), texts.length);
      }
    }
    
    return results;
  }

  /**
   * Batch sentiment analysis (alias for analyzeSentimentBatch for test compatibility)
   */
  async batchAnalyzeSentiment(texts: string[]): Promise<OpenAISentimentResponse[]> {
    if (!texts || texts.length === 0) {
      throw new AppError('Texts array is required', 400, 'INVALID_INPUT');
    }
    
    if (texts.length > 100) {
      throw new AppError('Batch size cannot exceed 100 texts', 400, 'BATCH_TOO_LARGE');
    }
    
    // For the test compatibility, process in batch with OpenAI API
    try {
      const response = await this.makeOpenAIRequest({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise sentiment analysis expert. Analyze each text and respond with a JSON array of sentiment objects.'
          },
          {
            role: 'user',
            content: `Analyze the sentiment of these texts and respond with a JSON array where each element has format {"sentiment": "positive|negative|neutral", "score": number, "confidence": number}:\n\n${texts.map((text, i) => `${i + 1}. ${text}`).join('\n')}`
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });

      if (!response.choices || response.choices.length === 0) {
        throw new AppError('No response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
      }

      const content = response.choices[0].message?.content;
      if (!content) {
        throw new AppError('Empty response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
      }

      const parsed = JSON.parse(content.trim());
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array response');
      }

      return parsed.map((item: any, index: number) => ({
        sentiment: item.sentiment,
        score: Number(item.score.toFixed(3)),
        confidence: item.confidence ? Number(item.confidence.toFixed(3)) : 0.8,
        reasoning: item.reasoning || '',
        tokensUsed: Math.floor((response.usage?.total_tokens || 0) / texts.length),
        model: this.config.model
      }));

    } catch (error) {
      throw new AppError(
        `Batch sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'OPENAI_ANALYSIS_ERROR'
      );
    }
  }

  /**
   * Stream sentiment analysis with callback-based approach (for test compatibility)
   */
  async streamAnalyzeSentiment(options: {
    text: string;
    model?: string;
    onChunk?: (chunk: any) => void;
    onComplete?: (result: any) => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    try {
      const payload = {
        model: options.model || this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise sentiment analysis expert. Respond only in the requested JSON format.'
          },
          {
            role: 'user',
            content: this.buildSentimentPrompt(options.text, true)
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Stream request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (options.onComplete) {
                options.onComplete({ finished: true });
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (options.onChunk) {
                options.onChunk(parsed);
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Stream error'));
      }
      throw error;
    }
  }

  /**
   * Get current usage statistics (for test compatibility)
   */
  getCurrentUsage(): {
    totalTokens: number;
    totalCost: number;
    breakdown: Record<string, { tokens: number; cost: number }>;
  } {
    const dailyCost = this.costTracker.getDailyCost();
    return {
      totalTokens: dailyCost.total.tokens,
      totalCost: dailyCost.total.cost,
      breakdown: dailyCost.byModel
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Reset circuit breaker (for manual intervention)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * Generate cache key for sentiment analysis
   */
  private generateCacheKey(text: string, model: string, includeConfidence: boolean): string {
    const contentHash = Buffer.from(text).toString('base64').slice(0, 32);
    return `openai:sentiment:${model}:${includeConfidence}:${contentHash}`;
  }

  /**
   * Get cached sentiment result
   */
  private async getCachedResult(cacheKey: string): Promise<OpenAISentimentResponse | null> {
    if (!this.cacheService) return null;

    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache errors shouldn't break the service
      console.warn('Cache retrieval error:', error);
    }
    return null;
  }

  /**
   * Cache sentiment result
   */
  private async setCachedResult(cacheKey: string, result: OpenAISentimentResponse): Promise<void> {
    if (!this.cacheService) return;

    try {
      await this.cacheService.set(
        cacheKey, 
        JSON.stringify(result), 
        { ttl: this.config.cacheTTL }
      );
    } catch (error) {
      // Cache errors shouldn't break the service
      console.warn('Cache storage error:', error);
    }
  }

  /**
   * Clear OpenAI cache (for testing/maintenance)
   */
  async clearCache(): Promise<void> {
    if (!this.cacheService) return;

    try {
      const keys = await this.cacheService.keys('openai:*');
      for (const key of keys) {
        await this.cacheService.del(key);
      }
    } catch (error) {
      console.warn('Cache clearing error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ enabled: boolean; keys: number; }> {
    if (!this.cacheService) {
      return { enabled: false, keys: 0 };
    }

    try {
      const keys = await this.cacheService.keys('openai:*');
      return { enabled: true, keys: keys.length };
    } catch (error) {
      return { enabled: true, keys: -1 };
    }
  }
}