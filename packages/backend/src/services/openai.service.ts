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

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
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
}

export interface OpenAISentimentResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  reasoning?: string;
  tokensUsed: number;
  model: string;
}

export class OpenAIService {
  private config: OpenAIConfig;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in ms
  private rateLimiter: RateLimiterService;
  private logger: OpenAILogger;
  private costTracker: CostTracker;

  constructor(config: OpenAIConfig) {
    this.config = {
      maxTokens: 150,
      temperature: 0.1,
      timeout: 30000,
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
  }

  /**
   * Analyze sentiment using OpenAI API
   */
  async analyzeSentiment(request: OpenAISentimentRequest): Promise<OpenAISentimentResponse> {
    const { text, model = this.config.model, includeConfidence = true } = request;

    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for sentiment analysis', 400, 'INVALID_INPUT');
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
      });

      return this.parseSentimentResponse(response, model);
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
  private async makeOpenAIRequest(payload: any, attempt = 1): Promise<any> {
    // Apply rate limiting
    await this.rateLimiter.waitForLimit();

    const startTime = Date.now();
    this.logger.logRequest(payload.model, payload);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DataCloak-Sentiment-Workbench/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const shouldRetry = await this.handleAPIError(response, attempt);
        if (shouldRetry && attempt < this.retryAttempts) {
          // Retry the request
          return this.makeOpenAIRequest(payload, attempt + 1);
        }
      }

      const data = await response.json();
      
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
    if (!response.choices || response.choices.length === 0) {
      throw new AppError('No response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
    }

    const choice = response.choices[0];
    const content = choice.message?.content;
    
    if (!content) {
      throw new AppError('Empty response from OpenAI', 500, 'OPENAI_PARSE_ERROR');
    }

    try {
      const parsed = JSON.parse(content.trim());
      
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
  async testConnection(): Promise<{ connected: boolean; model: string; error?: string }> {
    try {
      await this.makeOpenAIRequest({
        model: this.config.model,
        messages: [
          { role: 'user', content: 'Test connection. Reply with just "OK".' }
        ],
        max_tokens: 5,
        temperature: 0
      });

      return {
        connected: true,
        model: this.config.model
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
    rateLimit: {
      requestsRemaining: number;
      tokensRemaining: number;
      resetTime: Date;
    };
    usage: {
      requestsToday: number;
      tokensToday: number;
    };
  }> {
    const rateLimitStatus = this.rateLimiter.getStatus();
    
    return {
      rateLimit: {
        requestsRemaining: rateLimitStatus.tokensRemaining,
        tokensRemaining: 50000, // This would need to be tracked separately
        resetTime: new Date(Date.now() + rateLimitStatus.nextRefillIn)
      },
      usage: {
        requestsToday: rateLimitStatus.maxTokens - rateLimitStatus.tokensRemaining,
        tokensToday: 8500 // This would need to be tracked separately
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
}