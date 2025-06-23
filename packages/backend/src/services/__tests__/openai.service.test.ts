import { OpenAIService } from '../openai.service';
import { AppError } from '../../middleware/error.middleware';
import { RateLimiterService, createOpenAIRateLimiter } from '../rate-limiter.service';
import { TextOptimizer, OpenAILogger, CostTracker, OpenAIStreamProcessor } from '../openai-enhancements';
import { CircuitBreaker, circuitBreakerManager, CircuitState } from '../circuit-breaker.service';

// Mock dependencies
jest.mock('../rate-limiter.service');
jest.mock('../openai-enhancements');
jest.mock('../circuit-breaker.service');

// Mock fetch
global.fetch = jest.fn();

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockRateLimiter: jest.Mocked<RateLimiterService>;
  let mockLogger: jest.Mocked<OpenAILogger>;
  let mockCostTracker: jest.Mocked<CostTracker>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock rate limiter
    mockRateLimiter = {
      checkLimit: jest.fn().mockResolvedValue({ allowed: true, tokensRemaining: 3, resetsAt: new Date() }),
      waitForLimit: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue({
        tokensRemaining: 3,
        maxTokens: 3,
        refillRate: 3,
        nextRefillIn: 60000
      })
    } as any;
    (createOpenAIRateLimiter as jest.Mock).mockReturnValue(mockRateLimiter);

    // Mock logger
    mockLogger = {
      logRequest: jest.fn(),
      logResponse: jest.fn(),
      logError: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0
      }),
      getLogs: jest.fn().mockReturnValue([]),
      clear: jest.fn()
    } as any;
    (OpenAILogger as jest.Mock).mockImplementation(() => mockLogger);

    // Mock cost tracker
    mockCostTracker = {
      track: jest.fn(),
      getDailyCost: jest.fn().mockReturnValue({
        total: { tokens: 0, cost: 0 },
        byModel: {}
      }),
      getMonthlyCost: jest.fn().mockReturnValue({
        total: { tokens: 0, cost: 0 },
        byModel: {}
      })
    } as any;
    (CostTracker as jest.Mock).mockImplementation(() => mockCostTracker);

    // Mock TextOptimizer
    (TextOptimizer.compress as jest.Mock).mockImplementation(text => text);
    (TextOptimizer.estimateTokens as jest.Mock).mockImplementation(text => text.split(' ').length);
    (TextOptimizer.smartTruncate as jest.Mock).mockImplementation((text, maxTokens) => text);

    // Mock OpenAIStreamProcessor
    (OpenAIStreamProcessor.splitIntoChunks as jest.Mock).mockImplementation((text, chunkSize) => {
      const chunks = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      return chunks.length > 0 ? chunks : [text];
    });

    // Mock Circuit Breaker
    mockCircuitBreaker = {
      execute: jest.fn().mockImplementation(async (fn) => {
        // Default behavior: just execute the function
        return await fn();
      }),
      getMetrics: jest.fn().mockReturnValue({
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 10,
        totalRequests: 10,
        errorPercentage: 0
      }),
      reset: jest.fn(),
      forceOpen: jest.fn(),
      forceClose: jest.fn()
    } as any;

    (circuitBreakerManager.getBreaker as jest.Mock).mockReturnValue(mockCircuitBreaker);

    service = new OpenAIService({
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 150,
      temperature: 0.1,
      timeout: 30000
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with provided config', () => {
      expect(service).toBeDefined();
      expect(createOpenAIRateLimiter).toHaveBeenCalled();
      expect(OpenAILogger).toHaveBeenCalled();
      expect(CostTracker).toHaveBeenCalled();
      expect(circuitBreakerManager.getBreaker).toHaveBeenCalledWith('openai-api', expect.any(Object));
    });

    it('should throw error if API key is missing', () => {
      expect(() => new OpenAIService({
        apiKey: '',
        model: 'gpt-3.5-turbo'
      })).toThrow(new AppError('OpenAI API key is required', 500, 'OPENAI_CONFIG_ERROR'));
    });

    it('should use default values for optional config', () => {
      const minimalService = new OpenAIService({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo'
      });

      expect(minimalService).toBeDefined();
    });
  });

  describe('analyzeSentiment', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.85,
                confidence: 0.92,
                reasoning: 'The text expresses satisfaction'
              })
            }
          }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 30,
            total_tokens: 80
          }
        })
      });
    });

    it('should analyze sentiment successfully', async () => {
      const result = await service.analyzeSentiment({
        text: 'This product is excellent!',
        includeConfidence: true
      });

      expect(result).toEqual({
        sentiment: 'positive',
        score: 0.85,
        confidence: 0.92,
        reasoning: 'The text expresses satisfaction',
        tokensUsed: 80,
        model: 'gpt-3.5-turbo'
      });

      expect(mockRateLimiter.waitForLimit).toHaveBeenCalledWith('openai-requests');
      expect(mockLogger.logRequest).toHaveBeenCalled();
      expect(mockLogger.logResponse).toHaveBeenCalled();
      expect(mockCostTracker.track).toHaveBeenCalled();
    });

    it('should handle empty text', async () => {
      await expect(service.analyzeSentiment({
        text: '',
        includeConfidence: true
      })).rejects.toThrow(new AppError('Text is required for sentiment analysis', 400, 'INVALID_INPUT'));
    });

    it('should truncate long text', async () => {
      const longText = 'word '.repeat(1000);
      (TextOptimizer.estimateTokens as jest.Mock)
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(450);

      await service.analyzeSentiment({
        text: longText,
        includeConfidence: true
      });

      expect(TextOptimizer.smartTruncate).toHaveBeenCalledWith(longText, 450);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '1' }),
        json: jest.fn().mockResolvedValue({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error'
          }
        })
      });

      await expect(service.analyzeSentiment({
        text: 'test text'
      })).rejects.toThrow(AppError);

      expect(mockLogger.logError).toHaveBeenCalled();
    }, 10000);

    it('should parse different response formats', async () => {
      // Test with plain text response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Sentiment: positive\nScore: 0.8\nConfidence: 0.9'
            }
          }],
          usage: { total_tokens: 50 }
        })
      });

      const result = await service.analyzeSentiment({
        text: 'Great product!'
      });

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBe(0.8);
      expect(result.confidence).toBe(0.9);
    });

    it('should use custom model', async () => {
      await service.analyzeSentiment({
        text: 'test',
        model: 'gpt-4'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4"')
        })
      );
    });
  });

  describe('batchAnalyzeSentiment', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify([
                { sentiment: 'positive', score: 0.8, confidence: 0.9 },
                { sentiment: 'negative', score: -0.6, confidence: 0.85 }
              ])
            }
          }],
          usage: { total_tokens: 150 }
        })
      });
    });

    it('should analyze batch of texts', async () => {
      const texts = ['Great product!', 'Terrible service'];
      const results = await service.batchAnalyzeSentiment(texts);

      expect(results).toHaveLength(2);
      expect(results[0].sentiment).toBe('positive');
      expect(results[1].sentiment).toBe('negative');
    });

    it('should handle empty batch', async () => {
      await expect(service.batchAnalyzeSentiment([]))
        .rejects.toThrow(new AppError('Texts array is required', 400, 'INVALID_INPUT'));
    });

    it('should limit batch size', async () => {
      const largeBatch = new Array(101).fill('text');

      await expect(service.batchAnalyzeSentiment(largeBatch))
        .rejects.toThrow(new AppError('Batch size cannot exceed 100 texts', 400, 'BATCH_TOO_LARGE'));
    });

    it('should handle partial failures in batch', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Invalid response format'
            }
          }],
          usage: { total_tokens: 50 }
        })
      });

      await expect(service.batchAnalyzeSentiment(['text1', 'text2']))
        .rejects.toThrow();
    });
  });

  describe('streamAnalyzeSentiment', () => {
    it('should handle streaming responses', async () => {
      const mockStream = {
        getReader: jest.fn().mockReturnValue({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"positive"}}]}\n\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":", score: 0.8"}}]}\n\n')
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: [DONE]\n\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream
      });

      const mockProcessor = {
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      };

      (OpenAIStreamProcessor as jest.Mock).mockImplementation(() => mockProcessor);

      await service.streamAnalyzeSentiment({
        text: 'test',
        onChunk: mockProcessor.onChunk,
        onComplete: mockProcessor.onComplete,
        onError: mockProcessor.onError
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"stream":true')
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [{ id: 'gpt-3.5-turbo' }]
        })
      });

      const result = await service.testConnection();

      expect(result).toEqual({
        connected: true,
        model: 'gpt-3.5-turbo',
        available: true
      });
    });

    it('should handle connection failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.testConnection();

      expect(result).toEqual({
        connected: false,
        model: 'gpt-3.5-turbo',
        error: 'Network error'
      });
    });

    it('should detect invalid API key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue({
          error: { message: 'Invalid API key' }
        })
      });

      const result = await service.testConnection();

      expect(result).toEqual({
        connected: false,
        model: 'gpt-3.5-turbo',
        error: 'API returned 401: Unauthorized'
      });
    });
  });

  describe('getAPIStatus', () => {
    it('should return API status', async () => {
      mockLogger.getStats.mockReturnValue({
        totalRequests: 100,
        totalErrors: 5,
        averageResponseTime: 250
      });

      mockCostTracker.getDailyCost.mockReturnValue({
        total: { tokens: 50000, cost: 1.5 },
        byModel: {
          'gpt-3.5-turbo': { tokens: 50000, cost: 1.5 }
        }
      });

      const status = await service.getAPIStatus();

      expect(status).toEqual({
        operational: true,
        metrics: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          averageResponseTime: 250
        },
        usage: {
          totalTokens: 50000,
          totalCost: 1.5,
          breakdown: {
            'gpt-3.5-turbo': { tokens: 50000, cost: 1.5 }
          }
        },
        rateLimitStatus: {
          available: true,
          limit: 3,
          remaining: 3,
          resetAt: expect.any(Date)
        }
      });
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit errors', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Headers({ 'retry-after': '1' }),
            json: jest.fn().mockResolvedValue({
              error: { type: 'rate_limit_error' }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  sentiment: 'positive',
                  score: 0.8,
                  confidence: 0.9
                })
              }
            }],
            usage: { total_tokens: 50 }
          })
        });
      });

      const result = await service.analyzeSentiment({ text: 'test' });

      expect(result.sentiment).toBe('positive');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          error: { message: 'Server error' }
        })
      });

      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: { message: 'Invalid request' }
        })
      });

      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      // Create a service with short timeout for testing
      const timeoutService = new OpenAIService({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
        timeout: 100
      });

      (global.fetch as jest.Mock).mockImplementation((url, options) => 
        new Promise((resolve, reject) => {
          // Listen for abort signal
          const signal = options?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
          
          // Simulate a slow response
          setTimeout(() => {
            resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({
                choices: [{ message: { content: '{"sentiment":"positive","score":0.8}' } }],
                usage: { total_tokens: 50 }
              })
            });
          }, 1000); // Much longer than 100ms timeout
        })
      );

      await expect(timeoutService.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow();
    }, 2000);

    it('should handle malformed API responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          // Missing expected fields
          invalid: 'response'
        })
      });

      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow(new AppError('No response from OpenAI', 500, 'OPENAI_PARSE_ERROR'));
    });

    it('should handle JSON parsing errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow();
    });
  });

  describe('configuration', () => {
    it('should get current config', () => {
      const config = service.getConfig();

      expect(config).toEqual({
        model: 'gpt-3.5-turbo',
        maxTokens: 150,
        temperature: 0.1,
        timeout: 30000,
        enableCache: false,
        cacheTTL: 3600
      });
    });

    it('should update config', () => {
      service.updateConfig({
        model: 'gpt-4',
        maxTokens: 200,
        temperature: 0.2
      });

      const config = service.getConfig();

      expect(config.model).toBe('gpt-4');
      expect(config.maxTokens).toBe(200);
      expect(config.temperature).toBe(0.2);
    });

    it('should validate temperature range', () => {
      expect(() => service.updateConfig({ temperature: -0.5 }))
        .toThrow(new AppError('Temperature must be between 0 and 2', 400, 'INVALID_CONFIG'));

      expect(() => service.updateConfig({ temperature: 2.5 }))
        .toThrow(new AppError('Temperature must be between 0 and 2', 400, 'INVALID_CONFIG'));
    });

    it('should validate max tokens', () => {
      expect(() => service.updateConfig({ maxTokens: 0 }))
        .toThrow(new AppError('Max tokens must be greater than 0', 400, 'INVALID_CONFIG'));
    });
  });

  describe('cost tracking', () => {
    it('should track token usage and costs', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9
              })
            }
          }],
          usage: {
            prompt_tokens: 50,
            completion_tokens: 30,
            total_tokens: 80
          }
        })
      });

      await service.analyzeSentiment({ text: 'test' });

      expect(mockCostTracker.track).toHaveBeenCalledWith('gpt-3.5-turbo', {
        prompt_tokens: 50,
        completion_tokens: 30,
        total_tokens: 80
      });
    });

    it('should get current usage', () => {
      mockCostTracker.getDailyCost.mockReturnValue({
        total: { tokens: 10000, cost: 0.25 },
        byModel: {
          'gpt-3.5-turbo': { tokens: 10000, cost: 0.25 }
        }
      });

      const usage = service.getCurrentUsage();

      expect(usage).toEqual({
        totalTokens: 10000,
        totalCost: 0.25,
        breakdown: {
          'gpt-3.5-turbo': { tokens: 10000, cost: 0.25 }
        }
      });
    });
  });

  describe('abort functionality', () => {
    it('should support request cancellation', async () => {
      const abortController = new AbortController();
      
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => {
            if (abortController.signal.aborted) {
              const error = new Error('AbortError');
              error.name = 'AbortError';
              reject(error);
            } else {
              resolve({
                ok: true,
                json: jest.fn().mockResolvedValue({
                  choices: [{ message: { content: '{"sentiment":"positive","score":0.8}' } }],
                  usage: { total_tokens: 50 }
                })
              });
            }
          }, 100);
        })
      );

      const promise = service.analyzeSentiment({
        text: 'test',
        signal: abortController.signal
      });

      // Abort immediately
      setTimeout(() => abortController.abort(), 10);

      await expect(promise).rejects.toThrow();
    }, 2000);
  });

  describe('circuit breaker integration', () => {
    it('should execute requests through circuit breaker', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.85,
                confidence: 0.92
              })
            }
          }],
          usage: { total_tokens: 80 }
        })
      });

      await service.analyzeSentiment({ text: 'test text' });

      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should handle circuit breaker open state', async () => {
      // Mock circuit breaker to throw service unavailable error
      mockCircuitBreaker.execute.mockRejectedValue(
        new AppError(
          'OpenAI service is temporarily unavailable. Circuit breaker is open.',
          503,
          'OPENAI_SERVICE_UNAVAILABLE'
        )
      );

      await expect(service.analyzeSentiment({ text: 'test text' }))
        .rejects.toThrow('OpenAI service is temporarily unavailable');
      
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should get circuit breaker status', () => {
      const status = service.getCircuitBreakerStatus();

      expect(status).toEqual({
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 10,
        totalRequests: 10,
        errorPercentage: 0
      });
      expect(mockCircuitBreaker.getMetrics).toHaveBeenCalled();
    });

    it('should reset circuit breaker', () => {
      service.resetCircuitBreaker();
      expect(mockCircuitBreaker.reset).toHaveBeenCalled();
    });

    it('should handle circuit breaker failure and recovery', async () => {
      let callCount = 0;
      
      // Mock circuit breaker to fail first call, then succeed
      mockCircuitBreaker.execute.mockImplementation(async (fn) => {
        callCount++;
        if (callCount === 1) {
          // First call: simulate failure that opens circuit
          throw new AppError('Service failure', 500, 'SERVICE_ERROR');
        } else {
          // Subsequent calls: circuit breaker allows through
          return await fn();
        }
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9
              })
            }
          }],
          usage: { total_tokens: 50 }
        })
      });

      // First call should fail
      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow('Service failure');

      // Reset the mock to allow through
      mockCircuitBreaker.execute.mockImplementation(async (fn) => await fn());

      // Second call should succeed
      const result = await service.analyzeSentiment({ text: 'test' });
      expect(result.sentiment).toBe('positive');
    });

    it('should track circuit breaker metrics separately from API status', async () => {
      mockCircuitBreaker.getMetrics.mockReturnValue({
        state: CircuitState.HALF_OPEN,
        failures: 3,
        successes: 1,
        totalRequests: 4,
        errorPercentage: 75
      });

      const status = await service.getAPIStatus();
      const circuitBreakerStatus = service.getCircuitBreakerStatus();

      expect(status.operational).toBe(true);
      expect(circuitBreakerStatus).toEqual({
        state: CircuitState.HALF_OPEN,
        failures: 3,
        successes: 1,
        totalRequests: 4,
        errorPercentage: 75
      });
      expect(mockCircuitBreaker.getMetrics).toHaveBeenCalled();
    });
  });

  describe('analyzeSentimentStream', () => {
    it('should process text in chunks', async () => {
      const longText = 'word '.repeat(2000); // Long text that needs chunking
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9
              })
            }
          }],
          usage: { total_tokens: 50 }
        })
      });

      const results: any[] = [];
      const progress: number[] = [];

      for await (const result of service.analyzeSentimentStream(longText, {
        chunkSize: 1000,
        onProgress: (processed, total) => {
          progress.push(processed);
        }
      })) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(1); // Should have multiple chunks
      expect(progress.length).toBeGreaterThan(0); // Progress should be tracked
      expect(progress[progress.length - 1]).toBe(results.length); // Last progress should equal total chunks
    });

    it('should use default chunk size', async () => {
      const text = 'test text';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'neutral',
                score: 0,
                confidence: 0.8
              })
            }
          }],
          usage: { total_tokens: 20 }
        })
      });

      const results: any[] = [];
      for await (const result of service.analyzeSentimentStream(text)) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0].sentiment).toBe('neutral');
    });

    it('should use custom model for chunks', async () => {
      const text = 'test';
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.7,
                confidence: 0.85
              })
            }
          }],
          usage: { total_tokens: 15 }
        })
      });

      const results: any[] = [];
      for await (const result of service.analyzeSentimentStream(text, { model: 'gpt-4-turbo' })) {
        results.push(result);
      }

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4-turbo"')
        })
      );
    });
  });

  describe('getUsageStats', () => {
    it('should return comprehensive usage statistics', () => {
      mockLogger.getStats.mockReturnValue({
        totalRequests: 50,
        totalErrors: 2,
        totalTokens: 5000,
        totalCost: 2.5,
        averageResponseTime: 200
      });

      mockCostTracker.getDailyCost.mockReturnValue({
        total: { tokens: 1000, cost: 0.5 },
        byModel: {
          'gpt-3.5-turbo': { tokens: 800, cost: 0.4 },
          'gpt-4': { tokens: 200, cost: 0.1 }
        }
      });

      mockCostTracker.getMonthlyCost.mockReturnValue({
        total: { tokens: 30000, cost: 15 },
        byModel: {
          'gpt-3.5-turbo': { tokens: 25000, cost: 12.5 },
          'gpt-4': { tokens: 5000, cost: 2.5 }
        }
      });

      const stats = service.getUsageStats();

      expect(stats).toEqual({
        logs: {
          totalRequests: 50,
          totalErrors: 2,
          totalTokens: 5000,
          totalCost: 2.5,
          averageResponseTime: 200
        },
        costs: {
          daily: {
            total: { tokens: 1000, cost: 0.5 },
            byModel: {
              'gpt-3.5-turbo': { tokens: 800, cost: 0.4 },
              'gpt-4': { tokens: 200, cost: 0.1 }
            }
          },
          monthly: {
            total: { tokens: 30000, cost: 15 },
            byModel: {
              'gpt-3.5-turbo': { tokens: 25000, cost: 12.5 },
              'gpt-4': { tokens: 5000, cost: 2.5 }
            }
          }
        },
        rateLimit: {
          tokensRemaining: 3,
          maxTokens: 3,
          refillRate: 3,
          nextRefillIn: 60000
        }
      });
    });
  });

  describe('getLogs', () => {
    it('should get logs with filters', () => {
      const mockLogs = [
        { type: 'request', model: 'gpt-3.5-turbo', timestamp: new Date() },
        { type: 'response', model: 'gpt-4', timestamp: new Date() },
        { type: 'error', model: 'gpt-3.5-turbo', timestamp: new Date() }
      ];

      mockLogger.getLogs.mockReturnValue(mockLogs);

      const logs = service.getLogs({ type: 'error', limit: 10 });

      expect(logs).toEqual(mockLogs);
      expect(mockLogger.getLogs).toHaveBeenCalledWith({ type: 'error', limit: 10 });
    });

    it('should get all logs without filters', () => {
      const mockLogs = [
        { type: 'request', model: 'gpt-3.5-turbo', timestamp: new Date() }
      ];

      mockLogger.getLogs.mockReturnValue(mockLogs);

      const logs = service.getLogs();

      expect(logs).toEqual(mockLogs);
      expect(mockLogger.getLogs).toHaveBeenCalledWith(undefined);
    });
  });

  describe('clearStats', () => {
    it('should clear all statistics', () => {
      service.clearStats();

      expect(mockLogger.clear).toHaveBeenCalled();
    });
  });

  describe('analyzeSentimentBatch', () => {
    it('should process texts in optimized batches', async () => {
      const texts = Array(15).fill('test text'); // 15 texts
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9
              })
            }
          }],
          usage: { total_tokens: 30 }
        })
      });

      const progress: number[] = [];
      const results = await service.analyzeSentimentBatch(texts, {
        batchSize: 5,
        onProgress: (completed, total) => {
          progress.push(completed);
        }
      });

      expect(results).toHaveLength(15);
      expect(progress).toEqual([5, 10, 15]); // Progress after each batch
      // With batch size 5, should make 15 API calls (one per text)
      expect(global.fetch).toHaveBeenCalledTimes(15);
    });

    it('should use default batch size', async () => {
      const texts = ['text1', 'text2', 'text3'];
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'neutral',
                score: 0,
                confidence: 0.95
              })
            }
          }],
          usage: { total_tokens: 25 }
        })
      });

      const results = await service.analyzeSentimentBatch(texts);

      expect(results).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should use custom model for batch', async () => {
      const texts = ['text1', 'text2'];
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.9,
                confidence: 0.95
              })
            }
          }],
          usage: { total_tokens: 40 }
        })
      });

      await service.analyzeSentimentBatch(texts, { model: 'gpt-4' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"model":"gpt-4"')
        })
      );
    });
  });

  describe('response parsing edge cases', () => {
    it('should handle response parsing errors with detailed logging', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'invalid json response'
            }
          }],
          usage: { total_tokens: 20 }
        })
      });

      await expect(service.analyzeSentiment({ text: 'test' }))
        .rejects.toThrow(new AppError('Failed to parse sentiment analysis response', 500, 'OPENAI_PARSE_ERROR'));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse OpenAI response:', 'invalid json response');
      
      consoleSpy.mockRestore();
    });

  });

  describe('streaming error handling', () => {
    it('should handle stream processing errors', async () => {
      const mockStream = {
        getReader: jest.fn().mockReturnValue({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: invalid json\n\n')
            })
            .mockResolvedValueOnce({ done: true })
        })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        body: mockStream
      });

      const mockProcessor = {
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      };

      (OpenAIStreamProcessor as jest.Mock).mockImplementation(() => mockProcessor);

      await service.streamAnalyzeSentiment({
        text: 'test',
        onChunk: mockProcessor.onChunk,
        onComplete: mockProcessor.onComplete,
        onError: mockProcessor.onError
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"stream":true')
        })
      );
    });
  });

  describe('caching functionality', () => {
    let mockCacheService: any;
    let serviceWithCache: OpenAIService;

    beforeEach(() => {
      mockCacheService = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        keys: jest.fn()
      };

      serviceWithCache = new OpenAIService({
        apiKey: 'test-api-key',
        model: 'gpt-3.5-turbo',
        enableCache: true,
        cacheService: mockCacheService,
        cacheTTL: 1800 // 30 minutes
      });
    });

    it('should return cached result when available', async () => {
      const text = 'This is a test text';
      const cachedResult = {
        sentiment: 'positive' as const,
        score: 0.8,
        confidence: 0.9,
        tokensUsed: 25,
        model: 'gpt-3.5-turbo'
      };

      mockCacheService.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await serviceWithCache.analyzeSentiment({ text });

      expect(result).toEqual({
        ...cachedResult,
        fromCache: true
      });
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled(); // Should not make API call
    });

    it('should cache new results', async () => {
      const text = 'This is a test text';
      mockCacheService.get.mockResolvedValue(null); // No cached result

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.8,
                confidence: 0.9
              })
            }
          }],
          usage: { total_tokens: 25 }
        })
      });

      const result = await serviceWithCache.analyzeSentiment({ text });

      expect(result.fromCache).toBeUndefined();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^openai:sentiment:/),
        expect.stringMatching(/\{.*sentiment.*\}/),
        { ttl: 1800 }
      );
    });

    it('should generate consistent cache keys', () => {
      const text = 'Same text';
      const model = 'gpt-3.5-turbo';
      const includeConfidence = true;

      const key1 = serviceWithCache['generateCacheKey'](text, model, includeConfidence);
      const key2 = serviceWithCache['generateCacheKey'](text, model, includeConfidence);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^openai:sentiment:gpt-3\.5-turbo:true:/);
    });

    it('should generate different cache keys for different inputs', () => {
      const key1 = serviceWithCache['generateCacheKey']('text1', 'gpt-3.5-turbo', true);
      const key2 = serviceWithCache['generateCacheKey']('text2', 'gpt-3.5-turbo', true);
      const key3 = serviceWithCache['generateCacheKey']('text1', 'gpt-4', true);
      const key4 = serviceWithCache['generateCacheKey']('text1', 'gpt-3.5-turbo', false);

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
    });

    it('should handle cache errors gracefully', async () => {
      const text = 'Test text';
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));
      mockCacheService.set.mockRejectedValue(new Error('Cache error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'neutral',
                score: 0,
                confidence: 0.8
              })
            }
          }],
          usage: { total_tokens: 20 }
        })
      });

      const result = await serviceWithCache.analyzeSentiment({ text });

      expect(result.sentiment).toBe('neutral');
      expect(consoleSpy).toHaveBeenCalledWith('Cache retrieval error:', expect.any(Error));
      expect(consoleSpy).toHaveBeenCalledWith('Cache storage error:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should clear cache', async () => {
      mockCacheService.keys.mockResolvedValue(['openai:sentiment:key1', 'openai:sentiment:key2']);

      await serviceWithCache.clearCache();

      expect(mockCacheService.keys).toHaveBeenCalledWith('openai:*');
      expect(mockCacheService.del).toHaveBeenCalledWith('openai:sentiment:key1');
      expect(mockCacheService.del).toHaveBeenCalledWith('openai:sentiment:key2');
    });

    it('should get cache statistics', async () => {
      mockCacheService.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      const stats = await serviceWithCache.getCacheStats();

      expect(stats).toEqual({
        enabled: true,
        keys: 3
      });
    });

    it('should return disabled stats when cache is not enabled', async () => {
      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        enabled: false,
        keys: 0
      });
    });

    it('should not cache when caching is disabled', async () => {
      const text = 'Test text';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                sentiment: 'positive',
                score: 0.7,
                confidence: 0.85
              })
            }
          }],
          usage: { total_tokens: 30 }
        })
      });

      const result = await service.analyzeSentiment({ text });

      expect(result.fromCache).toBeUndefined();
      expect(global.fetch).toHaveBeenCalled();
      // Cache methods should not be called since caching is disabled
    });
  });
});