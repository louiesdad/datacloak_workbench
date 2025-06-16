import WebSocket from 'ws';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

interface ConnectionResult {
  clientId: number;
  connected: boolean;
  duration: number;
  error?: string;
  messagesReceived: number;
  messagesSent: number;
}

interface TestResult {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  totalMessagesExchanged: number;
  testDuration: number;
  connectionsPerSecond: number;
  errors: string[];
}

class ConcurrentWebSocketTest {
  private wsUrl: string;
  private connections: WebSocket[] = [];
  private results: ConnectionResult[] = [];

  constructor(wsUrl: string = 'ws://localhost:3001/ws') {
    this.wsUrl = wsUrl;
  }

  async testConcurrentConnections(numConnections: number, messagesPerClient: number = 5): Promise<TestResult> {
    console.log(`\n🔧 Testing ${numConnections} concurrent WebSocket connections...\n`);
    
    const startTime = Date.now();
    const connectionPromises: Promise<ConnectionResult>[] = [];

    // Create all connections concurrently
    for (let i = 0; i < numConnections; i++) {
      connectionPromises.push(this.createConnection(i, messagesPerClient));
      
      // Small delay between connection attempts to avoid overwhelming the server
      if (i % 10 === 0 && i > 0) {
        await sleep(10);
      }
    }

    // Wait for all connections to complete
    this.results = await Promise.all(connectionPromises);
    
    const testDuration = Date.now() - startTime;

    // Calculate statistics
    const successfulConnections = this.results.filter(r => r.connected).length;
    const failedConnections = this.results.filter(r => !r.connected).length;
    const totalMessagesExchanged = this.results.reduce((sum, r) => sum + r.messagesReceived + r.messagesSent, 0);
    const averageConnectionTime = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    const connectionsPerSecond = (successfulConnections / testDuration) * 1000;
    const errors = this.results.filter(r => r.error).map(r => r.error!);

    // Clean up all connections
    await this.cleanup();

    return {
      totalConnections: numConnections,
      successfulConnections,
      failedConnections,
      averageConnectionTime,
      totalMessagesExchanged,
      testDuration,
      connectionsPerSecond,
      errors: [...new Set(errors)] // Unique errors only
    };
  }

  private async createConnection(clientId: number, messagesPerClient: number): Promise<ConnectionResult> {
    const startTime = Date.now();
    let messagesReceived = 0;
    let messagesSent = 0;
    let connected = false;
    let error: string | undefined;

    try {
      const ws = new WebSocket(this.wsUrl);
      this.connections.push(ws);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          connected = true;
          resolve();
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          error = err.message;
          reject(err);
        });
      });

      // Subscribe to sentiment feed
      ws.send(JSON.stringify({
        type: 'subscribe',
        topic: 'sentiment_feed'
      }));
      messagesSent++;

      // Send test messages
      for (let i = 0; i < messagesPerClient; i++) {
        ws.send(JSON.stringify({
          type: 'message',
          data: {
            clientId,
            messageIndex: i,
            timestamp: new Date().toISOString()
          }
        }));
        messagesSent++;
        
        // Small delay between messages
        await sleep(100);
      }

      // Listen for messages
      await new Promise<void>((resolve) => {
        const messageTimeout = setTimeout(resolve, 2000);

        ws.on('message', (data) => {
          messagesReceived++;
          
          // Reset timeout on each message
          clearTimeout(messageTimeout);
          setTimeout(resolve, 500);
        });
      });

      // Unsubscribe before closing
      ws.send(JSON.stringify({
        type: 'unsubscribe',
        topic: 'sentiment_feed'
      }));
      messagesSent++;

      ws.close();

    } catch (err) {
      error = (err as Error).message;
      connected = false;
    }

    const duration = Date.now() - startTime;

    return {
      clientId,
      connected,
      duration,
      error,
      messagesReceived,
      messagesSent
    };
  }

  private async cleanup(): Promise<void> {
    // Close all remaining connections
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    this.connections = [];
    
    // Wait for all connections to close
    await sleep(500);
  }

  async runLoadTest(): Promise<void> {
    console.log('🚀 WebSocket Concurrent Connection Test Suite\n');
    console.log('=' .repeat(50));

    const testScenarios = [
      { connections: 10, messages: 5, description: 'Light load' },
      { connections: 50, messages: 3, description: 'Medium load' },
      { connections: 100, messages: 2, description: 'Heavy load' },
      { connections: 200, messages: 1, description: 'Stress test' }
    ];

    for (const scenario of testScenarios) {
      console.log(`\n📊 Test: ${scenario.description}`);
      console.log(`   Connections: ${scenario.connections}`);
      console.log(`   Messages per client: ${scenario.messages}`);
      
      const result = await this.testConcurrentConnections(scenario.connections, scenario.messages);
      
      console.log(`\n   ✅ Results:`);
      console.log(`      Successful connections: ${result.successfulConnections}/${result.totalConnections}`);
      console.log(`      Failed connections: ${result.failedConnections}`);
      console.log(`      Average connection time: ${result.averageConnectionTime.toFixed(2)}ms`);
      console.log(`      Total messages exchanged: ${result.totalMessagesExchanged}`);
      console.log(`      Test duration: ${result.testDuration}ms`);
      console.log(`      Connections per second: ${result.connectionsPerSecond.toFixed(2)}`);
      
      if (result.errors.length > 0) {
        console.log(`\n   ⚠️  Errors encountered:`);
        result.errors.forEach(err => console.log(`      - ${err}`));
      }

      // Calculate success rate
      const successRate = (result.successfulConnections / result.totalConnections) * 100;
      
      if (successRate === 100) {
        console.log(`\n   🎉 Perfect! All connections successful`);
      } else if (successRate >= 95) {
        console.log(`\n   ✅ Excellent: ${successRate.toFixed(1)}% success rate`);
      } else if (successRate >= 80) {
        console.log(`\n   ⚠️  Good: ${successRate.toFixed(1)}% success rate`);
      } else {
        console.log(`\n   ❌ Poor: ${successRate.toFixed(1)}% success rate`);
      }

      // Wait between test scenarios
      await sleep(2000);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All concurrent connection tests completed!\n');
  }
}

// Run the test if executed directly
if (require.main === module) {
  const tester = new ConcurrentWebSocketTest();
  
  tester.runLoadTest()
    .then(() => {
      console.log('Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { ConcurrentWebSocketTest };