/**
 * SSE Progress Events Test
 * Tests Server-Sent Events for long-running operations
 */

import EventSource from 'eventsource';
import { performance } from 'perf_hooks';
import fetch from 'node-fetch';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  events: SSEEvent[];
  errors: string[];
}

interface SSEEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export class SSEProgressTest {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private events: SSEEvent[] = [];
  private errors: string[] = [];

  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Run all SSE tests
   */
  async runTests(): Promise<TestResult[]> {
    console.log('🔌 Testing SSE Progress Events...\n');
    
    const results: TestResult[] = [];

    // Test 1: SSE Connection
    console.log('📡 Test 1: SSE Connection');
    results.push(await this.testSSEConnection());

    // Test 2: Job Progress Events
    console.log('\n📊 Test 2: Job Progress Events');
    results.push(await this.testJobProgressEvents());

    // Test 3: Sentiment Analysis Progress
    console.log('\n🧠 Test 3: Sentiment Analysis Progress');
    results.push(await this.testSentimentProgress());

    // Test 4: File Processing Progress
    console.log('\n📁 Test 4: File Processing Progress');
    results.push(await this.testFileProgress());

    // Test 5: Progress Accuracy
    console.log('\n✅ Test 5: Progress Accuracy');
    results.push(await this.testProgressAccuracy());

    // Test 6: Connection Handling
    console.log('\n🔄 Test 6: Connection Handling');
    results.push(await this.testConnectionHandling());

    this.printResults(results);
    return results;
  }

  /**
   * Test basic SSE connection
   */
  private async testSSEConnection(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'SSE Connection',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      await this.connectSSE();
      
      // Wait for connection event
      await this.waitForEvent('connected', 5000);
      
      if (this.events.length > 0 && this.events[0].type === 'connected') {
        result.passed = true;
        console.log('  ✅ Connected successfully');
        console.log(`  📋 Client ID: ${this.events[0].data.clientId}`);
      } else {
        result.errors.push('No connection event received');
        console.log('  ❌ Connection event not received');
      }

      result.events = [...this.events];
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Connection failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Test job progress events
   */
  private async testJobProgressEvents(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'Job Progress Events',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      await this.connectSSE();
      this.clearEvents();

      // Create a test job
      const jobResponse = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sentiment_analysis_batch',
          data: {
            texts: Array(100).fill('Test text for sentiment analysis'),
            model: 'mock'
          }
        })
      });

      const { data: job } = await jobResponse.json();
      console.log(`  📝 Created job: ${job.id}`);

      // Wait for progress events
      const progressEvents = await this.collectProgressEvents(job.id, 10000);
      
      console.log(`  📊 Received ${progressEvents.length} progress events`);
      
      // Verify progress events
      if (progressEvents.length > 0) {
        const firstProgress = progressEvents[0].data.progress;
        const lastProgress = progressEvents[progressEvents.length - 1].data.progress;
        
        console.log(`  📈 Progress: ${firstProgress}% → ${lastProgress}%`);
        
        // Check if progress increased
        if (lastProgress > firstProgress) {
          result.passed = true;
          console.log('  ✅ Progress events working correctly');
        } else {
          result.errors.push('Progress did not increase');
          console.log('  ❌ Progress did not increase');
        }
      } else {
        result.errors.push('No progress events received');
        console.log('  ❌ No progress events received');
      }

      result.events = progressEvents;
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Test failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Test sentiment analysis progress
   */
  private async testSentimentProgress(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'Sentiment Analysis Progress',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      await this.connectSSE();
      this.clearEvents();

      // Create sentiment analysis job
      const texts = Array(50).fill(null).map((_, i) => 
        `Test text ${i} for sentiment analysis with some content`
      );

      const jobResponse = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sentiment_analysis_batch',
          data: { texts, model: 'mock' }
        })
      });

      const { data: job } = await jobResponse.json();
      
      // Collect sentiment progress events
      const sentimentEvents = await this.collectEvents('sentiment:progress', 10000);
      
      console.log(`  📊 Received ${sentimentEvents.length} sentiment progress events`);
      
      if (sentimentEvents.length > 0) {
        const event = sentimentEvents[0];
        console.log(`  📈 Progress: ${event.data.current}/${event.data.total} (${event.data.progress}%)`);
        
        // Verify event structure
        if (event.data.current && event.data.total && event.data.progress !== undefined) {
          result.passed = true;
          console.log('  ✅ Sentiment progress events have correct structure');
        } else {
          result.errors.push('Invalid sentiment event structure');
          console.log('  ❌ Invalid sentiment event structure');
        }
      } else {
        result.errors.push('No sentiment progress events received');
        console.log('  ❌ No sentiment progress events received');
      }

      result.events = sentimentEvents;
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Test failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Test file processing progress
   */
  private async testFileProgress(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'File Processing Progress',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      await this.connectSSE();
      this.clearEvents();

      // Simulate file processing job
      const jobResponse = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'file_processing',
          data: {
            fileId: 'test-file-123',
            fileName: 'test-data.csv',
            fileSize: 10 * 1024 * 1024 // 10MB
          }
        })
      });

      const { data: job } = await jobResponse.json();
      
      // Collect file progress events
      const fileEvents = await this.collectEvents('file:progress', 10000);
      
      console.log(`  📊 Received ${fileEvents.length} file progress events`);
      
      if (fileEvents.length > 0) {
        const event = fileEvents[0];
        console.log(`  📈 Progress: ${(event.data.bytesProcessed / 1024 / 1024).toFixed(2)}MB / ${(event.data.totalBytes / 1024 / 1024).toFixed(2)}MB (${event.data.progress}%)`);
        
        // Verify event structure
        if (event.data.bytesProcessed !== undefined && 
            event.data.totalBytes !== undefined && 
            event.data.progress !== undefined) {
          result.passed = true;
          console.log('  ✅ File progress events have correct structure');
        } else {
          result.errors.push('Invalid file event structure');
          console.log('  ❌ Invalid file event structure');
        }
      } else {
        result.errors.push('No file progress events received');
        console.log('  ❌ No file progress events received');
      }

      result.events = fileEvents;
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Test failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Test progress accuracy for chunked operations
   */
  private async testProgressAccuracy(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'Progress Accuracy',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      await this.connectSSE();
      this.clearEvents();

      // Create a job with known chunks
      const chunks = 10;
      const jobResponse = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'file_processing',
          data: {
            fileId: 'accuracy-test',
            chunks,
            simulateChunkedProgress: true
          }
        })
      });

      const { data: job } = await jobResponse.json();
      
      // Collect all progress events
      const progressEvents = await this.collectProgressEvents(job.id, 15000);
      
      console.log(`  📊 Received ${progressEvents.length} progress events`);
      
      // Analyze progress accuracy
      const progressValues = progressEvents.map(e => e.data.progress);
      const expectedProgress = Array(chunks).fill(null).map((_, i) => 
        Math.round(((i + 1) / chunks) * 100)
      );
      
      // Check if progress matches expected values
      let accurateProgress = true;
      for (let i = 0; i < Math.min(progressValues.length, expectedProgress.length); i++) {
        const actual = progressValues[i];
        const expected = expectedProgress[i];
        const difference = Math.abs(actual - expected);
        
        if (difference > 5) { // Allow 5% tolerance
          accurateProgress = false;
          console.log(`  ⚠️  Progress mismatch at step ${i}: expected ${expected}%, got ${actual}%`);
        }
      }
      
      if (accurateProgress && progressValues[progressValues.length - 1] === 100) {
        result.passed = true;
        console.log('  ✅ Progress accuracy within tolerance');
      } else {
        result.errors.push('Progress accuracy outside tolerance');
        console.log('  ❌ Progress accuracy outside tolerance');
      }

      result.events = progressEvents;
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Test failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Test connection handling and reconnection
   */
  private async testConnectionHandling(): Promise<TestResult> {
    const startTime = performance.now();
    const result: TestResult = {
      testName: 'Connection Handling',
      passed: false,
      duration: 0,
      events: [],
      errors: []
    };

    try {
      // Test 1: Initial connection
      await this.connectSSE();
      await this.waitForEvent('connected', 5000);
      const firstClientId = this.events[0]?.data?.clientId;
      console.log(`  📋 First connection: ${firstClientId}`);

      // Test 2: Ping events
      const pingEvent = await this.waitForEvent('ping', 35000); // Wait for ping
      if (pingEvent) {
        console.log('  ✅ Received ping event');
      } else {
        console.log('  ⚠️  No ping event received');
      }

      // Test 3: Disconnect and reconnect
      this.disconnectSSE();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.clearEvents();
      await this.connectSSE();
      await this.waitForEvent('connected', 5000);
      const secondClientId = this.events[0]?.data?.clientId;
      console.log(`  📋 Second connection: ${secondClientId}`);

      // Verify new client ID
      if (firstClientId && secondClientId && firstClientId !== secondClientId) {
        result.passed = true;
        console.log('  ✅ Reconnection successful with new client ID');
      } else {
        result.errors.push('Reconnection failed or same client ID');
        console.log('  ❌ Reconnection issue detected');
      }

      result.events = [...this.events];
    } catch (error: any) {
      result.errors.push(error.message);
      console.log(`  ❌ Test failed: ${error.message}`);
    } finally {
      this.disconnectSSE();
      result.duration = performance.now() - startTime;
    }

    return result;
  }

  /**
   * Connect to SSE endpoint
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(`${this.baseUrl}/api/v1/sse/events`);
      
      this.eventSource.onopen = () => {
        resolve();
      };

      this.eventSource.onerror = (error) => {
        reject(new Error('SSE connection failed'));
      };

      this.eventSource.onmessage = (event) => {
        this.handleEvent('message', event.data);
      };

      // Add specific event listeners
      const eventTypes = ['connected', 'ping', 'job:progress', 'job:status', 
                         'sentiment:progress', 'file:progress', 'error'];
      
      eventTypes.forEach(type => {
        this.eventSource!.addEventListener(type, (event: any) => {
          this.handleEvent(type, event.data);
        });
      });
    });
  }

  /**
   * Disconnect SSE
   */
  private disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Handle SSE event
   */
  private handleEvent(type: string, data: string): void {
    try {
      const parsedData = JSON.parse(data);
      this.events.push({
        type,
        data: parsedData,
        timestamp: new Date()
      });
    } catch (error) {
      this.errors.push(`Failed to parse event: ${type}`);
    }
  }

  /**
   * Wait for specific event type
   */
  private async waitForEvent(eventType: string, timeout: number): Promise<SSEEvent | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const event = this.events.find(e => e.type === eventType);
      if (event) {
        return event;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  /**
   * Collect events of specific type
   */
  private async collectEvents(eventType: string, duration: number): Promise<SSEEvent[]> {
    const collected: SSEEvent[] = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const newEvents = this.events.filter(e => 
        e.type === eventType && !collected.includes(e)
      );
      collected.push(...newEvents);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return collected;
  }

  /**
   * Collect progress events for a job
   */
  private async collectProgressEvents(jobId: string, duration: number): Promise<SSEEvent[]> {
    const collected: SSEEvent[] = [];
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const newEvents = this.events.filter(e => 
        e.type === 'job:progress' && 
        e.data.jobId === jobId && 
        !collected.includes(e)
      );
      collected.push(...newEvents);
      
      // Check if job completed
      const statusEvent = this.events.find(e => 
        e.type === 'job:status' && 
        e.data.jobId === jobId &&
        (e.data.status === 'completed' || e.data.status === 'failed')
      );
      
      if (statusEvent) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return collected;
  }

  /**
   * Clear events
   */
  private clearEvents(): void {
    this.events = [];
    this.errors = [];
  }

  /**
   * Print test results
   */
  private printResults(results: TestResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SSE Progress Test Results');
    console.log('='.repeat(60));
    
    let passedCount = 0;
    
    results.forEach(result => {
      console.log(`\n${result.passed ? '✅' : '❌'} ${result.testName}`);
      console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`   Events: ${result.events.length}`);
      
      if (result.errors.length > 0) {
        console.log(`   Errors:`);
        result.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
      }
      
      if (result.passed) passedCount++;
    });
    
    console.log(`\n📊 Overall: ${passedCount}/${results.length} tests passed`);
    console.log('='.repeat(60));
  }
}

// Run tests if executed directly
if (require.main === module) {
  // Check if eventsource is available
  try {
    require.resolve('eventsource');
  } catch {
    console.error('❌ eventsource package required. Install with: npm install eventsource');
    process.exit(1);
  }

  const test = new SSEProgressTest();
  test.runTests().then(() => {
    console.log('\n✅ SSE progress tests completed');
  }).catch(error => {
    console.error('\n❌ SSE progress tests failed:', error);
    process.exit(1);
  });
}