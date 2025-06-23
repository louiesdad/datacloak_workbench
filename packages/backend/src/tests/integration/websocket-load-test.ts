import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface TestClient {
  id: string;
  ws: WebSocket;
  messagesReceived: number;
  connected: boolean;
  latencies: number[];
}

class WebSocketLoadTest {
  private clients: Map<string, TestClient> = new Map();
  private serverUrl: string;
  private testDuration: number;
  private sentimentInterval?: NodeJS.Timeout;
  private startTime: number = 0;

  constructor(serverUrl: string = 'ws://localhost:8000/ws', testDuration: number = 60000) {
    this.serverUrl = serverUrl;
    this.testDuration = testDuration;
  }

  async runTest(numClients: number): Promise<void> {
    console.log(`\n🚀 Starting WebSocket load test with ${numClients} clients`);
    console.log(`Server URL: ${this.serverUrl}`);
    console.log(`Test duration: ${this.testDuration / 1000} seconds\n`);

    this.startTime = Date.now();

    try {
      // Create clients
      await this.createClients(numClients);
      
      // Start sending mock sentiment data
      this.startSentimentSimulation();
      
      // Wait for test duration
      await this.waitForDuration();
      
      // Print results
      this.printResults();
      
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      // Cleanup
      this.cleanup();
    }
  }

  private async createClients(numClients: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < numClients; i++) {
      promises.push(this.createClient(i));
      
      // Add small delay between connections to avoid overwhelming the server
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    await Promise.all(promises);
    console.log(`✅ Successfully connected ${this.clients.size} clients\n`);
  }

  private createClient(index: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const clientId = uuidv4();
      const ws = new WebSocket(this.serverUrl);
      
      const client: TestClient = {
        id: clientId,
        ws,
        messagesReceived: 0,
        connected: false,
        latencies: []
      };
      
      ws.on('open', () => {
        client.connected = true;
        this.clients.set(clientId, client);
        
        // Subscribe to sentiment topic
        ws.send(JSON.stringify({
          type: 'subscribe',
          data: { topic: 'sentiment' }
        }));
        
        // Start heartbeat
        this.startHeartbeat(client);
        
        if (index % 10 === 0) {
          console.log(`Client ${index + 1} connected`);
        }
        
        resolve();
      });
      
      ws.on('message', (data) => {
        client.messagesReceived++;
        
        try {
          const message = JSON.parse(data.toString());
          
          // Handle heartbeat response
          if (message.type === 'heartbeat_response' && message.timestamp) {
            const latency = Date.now() - message.timestamp;
            client.latencies.push(latency);
          }
        } catch (error) {
          // Ignore parse errors
        }
      });
      
      ws.on('error', (error) => {
        console.error(`Client ${index} error:`, error.message);
        reject(error);
      });
      
      ws.on('close', () => {
        client.connected = false;
      });
    });
  }

  private startHeartbeat(client: TestClient): void {
    const interval = setInterval(() => {
      if (client.connected && client.ws.readyState === WebSocket.OPEN) {
        const timestamp = Date.now();
        client.ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp
        }));
      }
    }, 5000); // Send heartbeat every 5 seconds
    
    // Store interval for cleanup
    (client as any).heartbeatInterval = interval;
  }

  private startSentimentSimulation(): void {
    console.log('📊 Starting sentiment event simulation...\n');
    
    // Simulate sentiment analysis events
    this.sentimentInterval = setInterval(() => {
      const sentiments = ['positive', 'negative', 'neutral'];
      const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
      
      const event = {
        type: 'sentiment_complete',
        data: {
          id: uuidv4(),
          text: `Test message ${Date.now()}`,
          sentiment,
          score: Math.random() * 2 - 1,
          confidence: Math.random(),
          timestamp: new Date().toISOString()
        }
      };
      
      // Send to a random subset of clients (simulate broadcast)
      const clientArray = Array.from(this.clients.values());
      const numRecipients = Math.floor(clientArray.length * 0.8); // 80% of clients
      
      for (let i = 0; i < numRecipients; i++) {
        const randomClient = clientArray[Math.floor(Math.random() * clientArray.length)];
        if (randomClient.connected && randomClient.ws.readyState === WebSocket.OPEN) {
          randomClient.ws.send(JSON.stringify(event));
        }
      }
    }, 100); // Send events every 100ms (10 per second)
  }

  private waitForDuration(): Promise<void> {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        const progress = (elapsed / this.testDuration) * 100;
        
        process.stdout.write(`\rTest progress: ${progress.toFixed(1)}%`);
        
        if (elapsed >= this.testDuration) {
          clearInterval(interval);
          console.log('\n');
          resolve();
        }
      }, 1000);
    });
  }

  private printResults(): void {
    console.log('\n📈 Test Results:');
    console.log('================\n');
    
    let totalMessages = 0;
    let connectedClients = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    
    this.clients.forEach(client => {
      totalMessages += client.messagesReceived;
      if (client.connected) connectedClients++;
      
      client.latencies.forEach(latency => {
        totalLatency += latency;
        latencyCount++;
      });
    });
    
    const avgLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
    const avgMessagesPerClient = totalMessages / this.clients.size;
    
    console.log(`Total clients created: ${this.clients.size}`);
    console.log(`Connected clients: ${connectedClients}`);
    console.log(`Disconnected clients: ${this.clients.size - connectedClients}`);
    console.log(`Total messages received: ${totalMessages}`);
    console.log(`Average messages per client: ${avgMessagesPerClient.toFixed(2)}`);
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Test duration: ${(Date.now() - this.startTime) / 1000}s`);
    
    // Connection stability
    const connectionRate = (connectedClients / this.clients.size) * 100;
    console.log(`\nConnection stability: ${connectionRate.toFixed(1)}%`);
    
    if (connectionRate >= 95) {
      console.log('✅ Excellent connection stability!');
    } else if (connectionRate >= 90) {
      console.log('⚠️  Good connection stability, but some clients disconnected.');
    } else {
      console.log('❌ Poor connection stability. Many clients disconnected.');
    }
  }

  private cleanup(): void {
    console.log('\n🧹 Cleaning up...');
    
    // Stop sentiment simulation
    if (this.sentimentInterval) {
      clearInterval(this.sentimentInterval);
    }
    
    // Close all connections
    this.clients.forEach(client => {
      if ((client as any).heartbeatInterval) {
        clearInterval((client as any).heartbeatInterval);
      }
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });
    
    this.clients.clear();
    console.log('✅ Cleanup complete\n');
  }
}

// Run the test
async function main() {
  const numClients = parseInt(process.argv[2]) || 100;
  const duration = parseInt(process.argv[3]) || 30000; // 30 seconds default
  const serverUrl = process.argv[4] || 'ws://localhost:8000/ws';
  
  const test = new WebSocketLoadTest(serverUrl, duration);
  
  try {
    await test.runTest(numClients);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { WebSocketLoadTest };