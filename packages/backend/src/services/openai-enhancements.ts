import { Readable } from 'stream';
import { AppError } from '../middleware/error.middleware';

/**
 * Token usage tracking and cost calculation
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface ModelPricing {
  inputCostPer1k: number;
  outputCostPer1k: number;
}

// OpenAI pricing as of 2024
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-3.5-turbo': {
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015
  },
  'gpt-4': {
    inputCostPer1k: 0.03,
    outputCostPer1k: 0.06
  },
  'gpt-4-turbo': {
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03
  }
};

/**
 * Calculate cost for token usage
 */
export function calculateTokenCost(
  usage: { prompt_tokens: number; completion_tokens: number },
  model: string
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo'];
  
  const inputCost = (usage.prompt_tokens / 1000) * pricing.inputCostPer1k;
  const outputCost = (usage.completion_tokens / 1000) * pricing.outputCostPer1k;
  
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Text optimization utilities for token reduction
 */
export class TextOptimizer {
  /**
   * Truncate text to approximate token limit
   * Rough estimate: 1 token ≈ 4 characters
   */
  static truncateToTokens(text: string, maxTokens: number): string {
    const approxMaxChars = maxTokens * 4;
    
    if (text.length <= approxMaxChars) {
      return text;
    }
    
    // Truncate and add ellipsis
    return text.substring(0, approxMaxChars - 3) + '...';
  }

  /**
   * Compress text by removing redundant whitespace and formatting
   */
  static compress(text: string): string {
    return text
      .replace(/[ \t]+/g, ' ')        // Multiple spaces/tabs to single space
      .replace(/\n{2,}/g, '\n')       // Multiple newlines (2 or more) to single
      .replace(/^ +| +$/gm, '')       // Trim spaces at line start/end
      .trim();
  }

  /**
   * Smart truncation that tries to preserve sentence boundaries
   */
  static smartTruncate(text: string, maxTokens: number): string {
    const approxMaxChars = maxTokens * 4;
    
    if (text.length <= approxMaxChars) {
      return text;
    }
    
    // Find last sentence boundary before limit
    const truncated = text.substring(0, approxMaxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > approxMaxChars * 0.8) {
      return text.substring(0, lastSentenceEnd + 1);
    }
    
    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > approxMaxChars * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokens(text: string): number {
    // More accurate estimation based on OpenAI's tokenizer patterns
    // Average English text: ~1 token per 4 characters
    // Account for punctuation and special characters
    const baseCount = text.length / 4;
    const punctuationCount = (text.match(/[.,!?;:'"]/g) || []).length;
    const numberCount = (text.match(/\d+/g) || []).length;
    
    return Math.ceil(baseCount + punctuationCount * 0.5 + numberCount * 0.3);
  }
}

/**
 * Request/Response logger for debugging
 */
export class OpenAILogger {
  private logs: Array<{
    timestamp: Date;
    type: 'request' | 'response' | 'error';
    model: string;
    data: any;
    tokenUsage?: TokenUsage;
    duration?: number;
  }> = [];
  
  private maxLogs = 100;

  logRequest(model: string, payload: any): void {
    this.addLog('request', model, payload);
  }

  logResponse(model: string, response: any, duration: number, tokenUsage?: TokenUsage): void {
    this.addLog('response', model, response, tokenUsage, duration);
  }

  logError(model: string, error: any, duration?: number): void {
    this.addLog('error', model, error, undefined, duration);
  }

  private addLog(
    type: 'request' | 'response' | 'error',
    model: string,
    data: any,
    tokenUsage?: TokenUsage,
    duration?: number
  ): void {
    this.logs.push({
      timestamp: new Date(),
      type,
      model,
      data: this.sanitizeData(data),
      tokenUsage,
      duration
    });
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      return data.length > 500 ? data.substring(0, 500) + '...' : data;
    }
    
    if (data && typeof data === 'object') {
      const sanitized = { ...data };
      
      // Remove sensitive data
      if (sanitized.apiKey) {
        sanitized.apiKey = '***';
      }
      
      // Truncate long messages
      if (sanitized.messages && Array.isArray(sanitized.messages)) {
        sanitized.messages = sanitized.messages.map((msg: any) => ({
          ...msg,
          content: msg.content?.length > 200 
            ? msg.content.substring(0, 200) + '...' 
            : msg.content
        }));
      }
      
      return sanitized;
    }
    
    return data;
  }

  getLogs(filter?: { type?: string; model?: string; limit?: number }) {
    let filtered = this.logs;
    
    if (filter?.type) {
      filtered = filtered.filter(log => log.type === filter.type);
    }
    
    if (filter?.model) {
      filtered = filtered.filter(log => log.model === filter.model);
    }
    
    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }
    
    return filtered;
  }

  getStats() {
    const stats = {
      totalRequests: 0,
      totalErrors: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      byModel: {} as Record<string, {
        requests: number;
        errors: number;
        tokens: number;
        cost: number;
        avgResponseTime: number;
      }>
    };
    
    const responseTimes: number[] = [];
    
    this.logs.forEach(log => {
      if (log.type === 'request') {
        stats.totalRequests++;
      } else if (log.type === 'error') {
        stats.totalErrors++;
      }
      
      if (log.tokenUsage) {
        stats.totalTokens += log.tokenUsage.totalTokens;
        stats.totalCost += log.tokenUsage.estimatedCost;
      }
      
      if (log.duration) {
        responseTimes.push(log.duration);
      }
      
      // By model stats
      if (!stats.byModel[log.model]) {
        stats.byModel[log.model] = {
          requests: 0,
          errors: 0,
          tokens: 0,
          cost: 0,
          avgResponseTime: 0
        };
      }
      
      const modelStats = stats.byModel[log.model];
      if (log.type === 'request') modelStats.requests++;
      if (log.type === 'error') modelStats.errors++;
      if (log.tokenUsage) {
        modelStats.tokens += log.tokenUsage.totalTokens;
        modelStats.cost += log.tokenUsage.estimatedCost;
      }
    });
    
    // Calculate average response time
    if (responseTimes.length > 0) {
      stats.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
    
    return stats;
  }

  clear(): void {
    this.logs = [];
  }
}

/**
 * Streaming support for large text processing
 */
export class OpenAIStreamProcessor {
  /**
   * Process text in chunks with streaming
   */
  static async *processInChunks(
    text: string,
    chunkSize: number,
    processor: (chunk: string) => Promise<any>
  ): AsyncGenerator<any> {
    const chunks = this.splitIntoChunks(text, chunkSize);
    
    for (const chunk of chunks) {
      const result = await processor(chunk);
      yield result;
    }
  }

  /**
   * Split text into chunks preserving sentence boundaries
   */
  static splitIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    
    // Split by sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkSize) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        
        // Handle very long sentences
        if (sentence.length > maxChunkSize) {
          const subChunks = this.splitLongText(sentence, maxChunkSize);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Split long text at word boundaries
   */
  private static splitLongText(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    let currentChunk = '';
    
    for (const word of words) {
      if ((currentChunk + ' ' + word).length <= maxSize) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = word;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Create a readable stream from async generator
   */
  static createStream(generator: AsyncGenerator<any>): Readable {
    return Readable.from(generator);
  }
}

/**
 * Cost tracking service
 */
export class CostTracker {
  private dailyCosts: Map<string, { tokens: number; cost: number }> = new Map();
  private monthlyCosts: Map<string, { tokens: number; cost: number }> = new Map();

  track(model: string, usage: { prompt_tokens: number; completion_tokens: number }): void {
    const cost = calculateTokenCost(usage, model);
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    
    // Track daily
    const dailyKey = `${today}:${model}`;
    const daily = this.dailyCosts.get(dailyKey) || { tokens: 0, cost: 0 };
    daily.tokens += usage.prompt_tokens + usage.completion_tokens;
    daily.cost += cost;
    this.dailyCosts.set(dailyKey, daily);
    
    // Track monthly
    const monthlyKey = `${month}:${model}`;
    const monthly = this.monthlyCosts.get(monthlyKey) || { tokens: 0, cost: 0 };
    monthly.tokens += usage.prompt_tokens + usage.completion_tokens;
    monthly.cost += cost;
    this.monthlyCosts.set(monthlyKey, monthly);
    
    // Clean up old data
    this.cleanup();
  }

  getDailyCost(date?: string): { byModel: Record<string, { tokens: number; cost: number }>; total: { tokens: number; cost: number } } {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const byModel: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;
    
    this.dailyCosts.forEach((value, key) => {
      if (key.startsWith(targetDate)) {
        const model = key.split(':')[1];
        byModel[model] = value;
        totalTokens += value.tokens;
        totalCost += value.cost;
      }
    });
    
    return {
      byModel,
      total: { tokens: totalTokens, cost: totalCost }
    };
  }

  getMonthlyCost(month?: string): { byModel: Record<string, { tokens: number; cost: number }>; total: { tokens: number; cost: number } } {
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const byModel: Record<string, { tokens: number; cost: number }> = {};
    let totalTokens = 0;
    let totalCost = 0;
    
    this.monthlyCosts.forEach((value, key) => {
      if (key.startsWith(targetMonth)) {
        const model = key.split(':')[1];
        byModel[model] = value;
        totalTokens += value.tokens;
        totalCost += value.cost;
      }
    });
    
    return {
      byModel,
      total: { tokens: totalTokens, cost: totalCost }
    };
  }

  private cleanup(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Remove daily costs older than 30 days
    this.dailyCosts.forEach((_, key) => {
      const date = key.split(':')[0];
      if (date < cutoffDate) {
        this.dailyCosts.delete(key);
      }
    });
    
    // Keep monthly costs for 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoffMonth = twelveMonthsAgo.toISOString().substring(0, 7);
    
    this.monthlyCosts.forEach((_, key) => {
      const month = key.split(':')[0];
      if (month < cutoffMonth) {
        this.monthlyCosts.delete(key);
      }
    });
  }
}