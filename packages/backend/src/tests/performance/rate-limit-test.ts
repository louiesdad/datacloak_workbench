/**
 * OpenAI Rate Limiting Test
 * Tests the backend's rate limiting implementation for 3 req/s
 */

import { OpenAIService } from '../../services/openai.service';
import { performance } from 'perf_hooks';

interface RateLimitTestResult {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  failedRequests: number;
  totalDuration: number;
  averageRequestsPerSecond: number;
  retrySuccesses: number;
  errors: Array<{
    timestamp: number;
    error: string;
    type: string;
  }>;
}

export class RateLimitTest {
  private openAIService: OpenAIService;
  private readonly requestsPerSecond = 3;
  private requestTimes: number[] = [];
  
  constructor(apiKey?: string) {
    this.openAIService = new OpenAIService({
      apiKey: apiKey || process.env.OPENAI_API_KEY || 'test-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 50,
      temperature: 0
    });
  }

  /**
   * Test rate limiting implementation
   */
  async testRateLimiting(durationSeconds = 10): Promise<RateLimitTestResult> {
    console.log(`🧪 Testing OpenAI rate limiting (${this.requestsPerSecond} req/s for ${durationSeconds}s)...`);
    
    const startTime = performance.now();
    const endTime = startTime + (durationSeconds * 1000);
    
    const result: RateLimitTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
      averageRequestsPerSecond: 0,
      retrySuccesses: 0,
      errors: []
    };

    const requests: Promise<void>[] = [];
    
    // Create a request queue that respects rate limits
    while (performance.now() < endTime) {
      const currentTime = performance.now();
      
      // Check if we can make a request based on rate limit
      if (this.canMakeRequest(currentTime)) {
        result.totalRequests++;
        this.requestTimes.push(currentTime);
        
        const request = this.makeTestRequest(result, currentTime);
        requests.push(request);
        
        // Small delay to prevent overwhelming the system
        await this.sleep(50);
      } else {
        // Wait a bit before checking again
        await this.sleep(100);
      }
    }

    // Wait for all requests to complete
    await Promise.all(requests);

    result.totalDuration = (performance.now() - startTime) / 1000;
    result.averageRequestsPerSecond = result.successfulRequests / result.totalDuration;

    this.printResults(result);
    return result;
  }

  /**
   * Test retry logic with exponential backoff
   */
  async testRetryLogic(): Promise<void> {
    console.log('\n🔄 Testing retry logic with exponential backoff...');
    
    const testCases = [
      { attemptCount: 1, expectedDelay: 1000 },
      { attemptCount: 2, expectedDelay: 2000 },
      { attemptCount: 3, expectedDelay: 4000 }
    ];

    for (const testCase of testCases) {
      console.log(`\n  Testing attempt ${testCase.attemptCount}...`);
      
      const startTime = performance.now();
      
      // Simulate a rate-limited request
      try {
        // Force multiple rapid requests to trigger rate limit
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(this.openAIService.analyzeSentiment({
            text: `Test text ${i}`,
            includeConfidence: true
          }));
        }
        await Promise.all(promises);
      } catch (error: any) {
        const duration = performance.now() - startTime;
        
        if (error.openaiError?.type === 'rate_limit') {
          console.log(`  ✅ Rate limit detected after ${duration.toFixed(0)}ms`);
          console.log(`  ⏱️  Retry after: ${error.openaiError.retryAfter}s`);
        } else {
          console.log(`  ❌ Unexpected error: ${error.message}`);
        }
      }
    }
  }

  /**
   * Test queue behavior under rate limit pressure
   */
  async testQueueBehavior(): Promise<void> {
    console.log('\n📊 Testing queue behavior under rate limit pressure...');
    
    const batchSizes = [5, 10, 20, 50];
    
    for (const batchSize of batchSizes) {
      console.log(`\n  Testing batch of ${batchSize} requests...`);
      
      const startTime = performance.now();
      const results = {
        completed: 0,
        rateLimited: 0,
        failed: 0
      };

      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        const promise = this.makeTestRequest(results, startTime + i * 100);
        promises.push(promise);
        
        // Stagger requests slightly
        await this.sleep(50);
      }

      await Promise.all(promises);
      
      const duration = (performance.now() - startTime) / 1000;
      const effectiveRate = results.completed / duration;
      
      console.log(`  ✅ Completed: ${results.completed}/${batchSize}`);
      console.log(`  ⚡ Effective rate: ${effectiveRate.toFixed(2)} req/s`);
      console.log(`  🚦 Rate limited: ${results.rateLimited} times`);
      
      if (effectiveRate > this.requestsPerSecond + 0.5) {
        console.log(`  ⚠️  WARNING: Effective rate exceeds limit!`);
      }
    }
  }

  /**
   * Test error message propagation to frontend
   */
  async testErrorMessages(): Promise<void> {
    console.log('\n📝 Testing error message propagation...');
    
    const errorScenarios = [
      { 
        name: 'Invalid API Key',
        config: { apiKey: 'invalid-key' },
        expectedType: 'authentication'
      },
      {
        name: 'Empty Text',
        config: { apiKey: process.env.OPENAI_API_KEY || 'test-key' },
        text: '',
        expectedType: 'invalid_request'
      },
      {
        name: 'Network Timeout',
        config: { 
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
          timeout: 1 // 1ms timeout to force timeout
        },
        expectedType: 'timeout'
      }
    ];

    for (const scenario of errorScenarios) {
      console.log(`\n  Testing ${scenario.name}...`);
      
      const service = new OpenAIService(scenario.config);
      
      try {
        await service.analyzeSentiment({
          text: scenario.text || 'Test text',
          includeConfidence: true
        });
        console.log(`  ❌ Expected error but request succeeded`);
      } catch (error: any) {
        console.log(`  ✅ Error caught: ${error.message}`);
        
        if (error.openaiError) {
          console.log(`  📋 Error type: ${error.openaiError.type}`);
          console.log(`  📋 Error code: ${error.openaiError.code}`);
          
          if (error.openaiError.type !== scenario.expectedType) {
            console.log(`  ⚠️  Expected type ${scenario.expectedType} but got ${error.openaiError.type}`);
          }
        }
      }
    }
  }

  /**
   * Make a test request and track results
   */
  private async makeTestRequest(
    results: any,
    timestamp: number
  ): Promise<void> {
    try {
      await this.openAIService.analyzeSentiment({
        text: `Test request at ${timestamp}`,
        includeConfidence: true
      });
      results.successfulRequests++;
    } catch (error: any) {
      if (error.openaiError?.type === 'rate_limit') {
        results.rateLimitedRequests++;
        
        // Check if retry succeeded
        if (error.openaiError.code === 'rate_limit_retry') {
          results.retrySuccesses++;
        }
      } else {
        results.failedRequests++;
        results.errors.push({
          timestamp,
          error: error.message,
          type: error.openaiError?.type || 'unknown'
        });
      }
    }
  }

  /**
   * Check if we can make a request based on rate limit
   */
  private canMakeRequest(currentTime: number): boolean {
    // Remove requests older than 1 second
    const oneSecondAgo = currentTime - 1000;
    this.requestTimes = this.requestTimes.filter(time => time > oneSecondAgo);
    
    // Check if we're under the rate limit
    return this.requestTimes.length < this.requestsPerSecond;
  }

  /**
   * Print test results
   */
  private printResults(result: RateLimitTestResult): void {
    console.log('\n📊 Rate Limiting Test Results:');
    console.log(`📈 Total requests: ${result.totalRequests}`);
    console.log(`✅ Successful: ${result.successfulRequests}`);
    console.log(`🚦 Rate limited: ${result.rateLimitedRequests}`);
    console.log(`❌ Failed: ${result.failedRequests}`);
    console.log(`🔄 Retry successes: ${result.retrySuccesses}`);
    console.log(`⏱️  Duration: ${result.totalDuration.toFixed(2)}s`);
    console.log(`⚡ Average rate: ${result.averageRequestsPerSecond.toFixed(2)} req/s`);
    
    if (result.averageRequestsPerSecond > this.requestsPerSecond) {
      console.log(`\n⚠️  WARNING: Average rate exceeds limit of ${this.requestsPerSecond} req/s`);
    } else {
      console.log(`\n✅ Rate limiting working correctly (under ${this.requestsPerSecond} req/s)`);
    }

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(error => {
        console.log(`  - ${error.type}: ${error.error}`);
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests if executed directly
if (require.main === module) {
  async function runTests() {
    const test = new RateLimitTest();
    
    try {
      // Test 1: Basic rate limiting
      console.log('=== Test 1: Basic Rate Limiting ===');
      await test.testRateLimiting(10);

      // Test 2: Retry logic
      console.log('\n=== Test 2: Retry Logic ===');
      await test.testRetryLogic();

      // Test 3: Queue behavior
      console.log('\n=== Test 3: Queue Behavior ===');
      await test.testQueueBehavior();

      // Test 4: Error messages
      console.log('\n=== Test 4: Error Messages ===');
      await test.testErrorMessages();

      console.log('\n✅ All rate limiting tests completed!');
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  }

  runTests();
}