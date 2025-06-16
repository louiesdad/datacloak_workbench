import WebSocket from 'ws';
import { promisify } from 'util';
import * as os from 'os';

const sleep = promisify(setTimeout);

interface StressTestConfig {
  wsUrl: string;
  maxConnections: number;
  connectionRate: number; // connections per second
  messageSendRate: number; // messages per second per connection
  testDuration: number; // seconds
  rampUpTime: number; // seconds to reach max connections
}

interface StressTestMetrics {
  connectionsAttempted: number;
  connectionsSuccessful: number;
  connectionsFailed: number;
  messagessSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  errors: Map<string, number>;
  latencies: number[];
  cpuUsage: number;
  memoryUsage: number;
  testDuration: number;
}

class WebSocketStressTest {
  private config: StressTestConfig;
  private connections: Map<number, WebSocket> = new Map();
  private metrics: StressTestMetrics;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(config: Partial<StressTestConfig> = {}) {
    this.config = {
      wsUrl: 'ws://localhost:3001/ws',
      maxConnections: 500,
      connectionRate: 50,
      messageSendRate: 1,
      testDuration: 60,
      rampUpTime: 10,
      ...config
    };

    this.metrics = this.resetMetrics();
  }

  private resetMetrics(): StressTestMetrics {
    return {
      connectionsAttempted: 0,
      connectionsSuccessful: 0,
      connectionsFailed: 0,
      messagessSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      errors: new Map(),
      latencies: [],
      cpuUsage: 0,
      memoryUsage: 0,
      testDuration: 0
    };
  }

  async runStressTest(): Promise<StressTestMetrics> {
    console.log('\n🔥 WebSocket Stress Test Starting...\n');
    console.log('Configuration:');
    console.log(`  - Target URL: ${this.config.wsUrl}`);
    console.log(`  - Max Connections: ${this.config.maxConnections}`);
    console.log(`  - Connection Rate: ${this.config.connectionRate}/sec`);
    console.log(`  - Message Rate: ${this.config.messageSendRate}/sec per connection`);
    console.log(`  - Test Duration: ${this.config.testDuration}s`);
    console.log(`  - Ramp Up Time: ${this.config.rampUpTime}s`);
    console.log('\n' + '='.repeat(60) + '\n');

    this.metrics = this.resetMetrics();
    this.isRunning = true;
    this.startTime = Date.now();

    // Start monitoring
    const monitoringInterval = setInterval(() => this.captureSystemMetrics(), 1000);

    // Start connection ramp-up
    await this.rampUpConnections();

    // Run the test for the specified duration
    const testEndTime = this.startTime + (this.config.testDuration * 1000);
    
    while (Date.now() < testEndTime && this.isRunning) {
      await this.maintainConnections();
      await sleep(100);
    }

    // Stop the test
    this.isRunning = false;
    clearInterval(monitoringInterval);

    // Close all connections
    await this.closeAllConnections();

    this.metrics.testDuration = (Date.now() - this.startTime) / 1000;

    return this.metrics;
  }

  private async rampUpConnections(): Promise<void> {
    const connectionsPerInterval = Math.ceil(this.config.maxConnections / this.config.rampUpTime);
    const intervalMs = 1000;

    for (let i = 0; i < this.config.rampUpTime && this.isRunning; i++) {
      const startCount = this.connections.size;
      const targetCount = Math.min(
        startCount + connectionsPerInterval,
        this.config.maxConnections
      );

      const connectionPromises: Promise<void>[] = [];
      
      for (let j = startCount; j < targetCount; j++) {
        connectionPromises.push(this.createConnection(j));
      }

      await Promise.all(connectionPromises);
      
      console.log(`[${i + 1}s] Active connections: ${this.connections.size}/${this.config.maxConnections}`);
      
      if (this.connections.size < this.config.maxConnections) {
        await sleep(intervalMs);
      }
    }
  }

  private async createConnection(id: number): Promise<void> {
    this.metrics.connectionsAttempted++;

    try {
      const ws = new WebSocket(this.config.wsUrl);
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          this.metrics.connectionsSuccessful++;
          this.connections.set(id, ws);
          
          // Subscribe to updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic: 'sentiment_feed'
          }));
          
          resolve();
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          this.recordError(err.message);
          reject(err);
        });
      });

      // Setup message handling
      ws.on('message', (data) => {
        this.metrics.messagesReceived++;
        this.metrics.bytesTransferred += data.toString().length;
        
        // Calculate latency if message contains timestamp
        try {
          const message = JSON.parse(data.toString());
          if (message.timestamp) {
            const latency = Date.now() - new Date(message.timestamp).getTime();
            this.metrics.latencies.push(latency);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('close', () => {
        this.connections.delete(id);
        
        // Reconnect if test is still running
        if (this.isRunning && this.connections.size < this.config.maxConnections) {
          setTimeout(() => this.createConnection(id), 1000);
        }
      });

      // Start sending messages
      this.startMessageSender(ws, id);

    } catch (error) {
      this.metrics.connectionsFailed++;
      this.recordError((error as Error).message);
    }
  }

  private startMessageSender(ws: WebSocket, connectionId: number): void {
    const intervalMs = 1000 / this.config.messageSendRate;
    
    const sendInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && this.isRunning) {
        const message = JSON.stringify({
          type: 'test_message',
          connectionId,
          timestamp: new Date().toISOString(),
          data: `Test message from connection ${connectionId}`
        });
        
        ws.send(message);
        this.metrics.messagessSent++;
        this.metrics.bytesTransferred += message.length;
      } else {
        clearInterval(sendInterval);
      }
    }, intervalMs);
  }

  private async maintainConnections(): Promise<void> {
    const currentConnections = this.connections.size;
    const targetConnections = this.config.maxConnections;
    
    if (currentConnections < targetConnections) {
      const needed = Math.min(
        targetConnections - currentConnections,
        this.config.connectionRate
      );
      
      const promises: Promise<void>[] = [];
      for (let i = 0; i < needed; i++) {
        const id = Date.now() + i;
        promises.push(this.createConnection(id));
      }
      
      await Promise.all(promises);
    }
  }

  private async closeAllConnections(): Promise<void> {
    console.log('\nClosing all connections...');
    
    const closePromises: Promise<void>[] = [];
    
    this.connections.forEach((ws, id) => {
      closePromises.push(new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          ws.once('close', resolve);
        } else {
          resolve();
        }
      }));
    });
    
    await Promise.all(closePromises);
    this.connections.clear();
  }

  private captureSystemMetrics(): void {
    // CPU usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    this.metrics.cpuUsage = Math.max(this.metrics.cpuUsage, usage);
    
    // Memory usage
    const used = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();
    const memoryPercentage = (usedMemory / totalMemory) * 100;
    
    this.metrics.memoryUsage = Math.max(this.metrics.memoryUsage, memoryPercentage);
  }

  private recordError(error: string): void {
    const count = this.metrics.errors.get(error) || 0;
    this.metrics.errors.set(error, count + 1);
  }

  printResults(metrics: StressTestMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Stress Test Results\n');
    
    console.log('Connection Statistics:');
    console.log(`  - Attempted: ${metrics.connectionsAttempted}`);
    console.log(`  - Successful: ${metrics.connectionsSuccessful}`);
    console.log(`  - Failed: ${metrics.connectionsFailed}`);
    console.log(`  - Success Rate: ${((metrics.connectionsSuccessful / metrics.connectionsAttempted) * 100).toFixed(2)}%`);
    
    console.log('\nMessage Statistics:');
    console.log(`  - Messages Sent: ${metrics.messagessSent}`);
    console.log(`  - Messages Received: ${metrics.messagesReceived}`);
    console.log(`  - Total Bytes: ${(metrics.bytesTransferred / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  - Throughput: ${(metrics.messagessSent / metrics.testDuration).toFixed(2)} msg/sec`);
    
    if (metrics.latencies.length > 0) {
      const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      const maxLatency = Math.max(...metrics.latencies);
      const minLatency = Math.min(...metrics.latencies);
      
      console.log('\nLatency Statistics:');
      console.log(`  - Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  - Min: ${minLatency}ms`);
      console.log(`  - Max: ${maxLatency}ms`);
    }
    
    console.log('\nSystem Resources:');
    console.log(`  - Peak CPU Usage: ${metrics.cpuUsage}%`);
    console.log(`  - Peak Memory Usage: ${metrics.memoryUsage.toFixed(2)}%`);
    
    if (metrics.errors.size > 0) {
      console.log('\nErrors Encountered:');
      metrics.errors.forEach((count, error) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }
    
    console.log(`\nTest Duration: ${metrics.testDuration.toFixed(2)}s`);
    console.log('='.repeat(60) + '\n');
  }
}

// Run the stress test if executed directly
if (require.main === module) {
  const config: Partial<StressTestConfig> = {
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100'),
    connectionRate: parseInt(process.env.CONNECTION_RATE || '20'),
    messageSendRate: parseInt(process.env.MESSAGE_RATE || '1'),
    testDuration: parseInt(process.env.TEST_DURATION || '30'),
    rampUpTime: parseInt(process.env.RAMP_UP_TIME || '5')
  };

  const stressTest = new WebSocketStressTest(config);
  
  stressTest.runStressTest()
    .then((metrics) => {
      stressTest.printResults(metrics);
      
      // Determine if test passed
      const successRate = (metrics.connectionsSuccessful / metrics.connectionsAttempted) * 100;
      
      if (successRate >= 95) {
        console.log('✅ Stress test PASSED!\n');
        process.exit(0);
      } else {
        console.log('❌ Stress test FAILED - Success rate below 95%\n');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Stress test error:', error);
      process.exit(1);
    });
}

export { WebSocketStressTest, StressTestConfig, StressTestMetrics };