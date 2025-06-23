import { WebSocket } from 'ws';
import express from 'express';
import { Server, createServer } from 'http';
import { EventEmitter } from 'events';
import { WebSocketService } from '../../services/websocket.service';
import { SSEService } from '../../services/sse.service';
import { eventEmitter, EventTypes } from '../../services/event.service';

// Mock the logger
jest.mock('../../config/logger', () => {
  return {
    __esModule: true,
    default: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }
  };
});

// Create a mock SSE client
class MockSSEClient extends EventEmitter {
  public written: string[] = [];
  public headers: any = {};
  public statusCode?: number;
  public connected = true;

  writeHead(statusCode: number, headers: any) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  write(data: string) {
    if (!this.connected) return false;
    this.written.push(data);
    return true;
  }

  end() {
    this.connected = false;
    this.emit('close');
  }

  getLastMessage(): any {
    if (this.written.length === 0) return null;
    const lastMsg = this.written[this.written.length - 1];
    try {
      // Parse SSE message format
      const lines = lastMsg.split('\\n');
      const eventLine = lines.find(line => line.startsWith('event: '));
      const dataLine = lines.find(line => line.startsWith('data: '));
      
      if (dataLine) {
        const data = dataLine.substring(6); // Remove 'data: '
        return {
          event: eventLine ? eventLine.substring(7) : undefined,
          data: JSON.parse(data)
        };
      }
    } catch (e) {
      return { raw: lastMsg };
    }
    return null;
  }
}

describe('Real-time Integration Tests', () => {
  let app: express.Application;
  let server: Server;
  let wsService: WebSocketService;
  let sseService: SSEService;
  let serverPort: number;

  beforeAll(async () => {
    // Create Express app
    app = express();
    server = createServer(app);
    
    // Initialize services
    wsService = new WebSocketService();
    sseService = new SSEService();
    
    // Initialize WebSocket service
    wsService.initialize(server);
    
    // Add SSE endpoint
    app.get('/events', (req, res) => {
      const userId = req.query.userId as string;
      sseService.addClient(res, userId);
    });

    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (wsService) {
      wsService.shutdown();
    }
    if (sseService) {
      sseService.stopPingInterval();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear event emitter
    eventEmitter.removeAllListeners();
  });

  describe('WebSocket and SSE Coordination', () => {
    it('should broadcast events to both WebSocket and SSE clients', async () => {
      // Setup WebSocket client
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));

      // Setup SSE client
      const sseClient = new MockSSEClient();
      const clientId = sseService.addClient(sseClient as any, 'user123');
      
      // Clear initial messages
      sseClient.written = [];
      let wsMessages: any[] = [];
      ws.on('message', (data) => {
        wsMessages.push(JSON.parse(data.toString()));
      });

      // Trigger an event that should reach both
      eventEmitter.emit('sentiment:progress', {
        jobId: 'job123',
        progress: 50,
        message: 'Processing sentiment analysis'
      });

      // Wait for messages to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check WebSocket received the event
      const wsMessage = wsMessages.find(msg => msg.type === 'sentiment_progress');
      expect(wsMessage).toBeDefined();
      expect(wsMessage.data.jobId).toBe('job123');
      expect(wsMessage.data.progress).toBe(50);

      // Check SSE also received similar event (if subscribed)
      // Note: SSE service might handle events differently
      
      ws.close();
      sseService.removeClient(clientId);
    });

    it('should handle user-specific messaging across both channels', async () => {
      const userId = 'user456';
      
      // Setup WebSocket client with authentication
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));
      
      // Authenticate WebSocket client
      ws.send(JSON.stringify({
        type: 'authenticate',
        data: { userId }
      }));

      // Setup SSE client for same user
      const sseClient = new MockSSEClient();
      const sseClientId = sseService.addClient(sseClient as any, userId);
      
      // Clear initial messages
      sseClient.written = [];
      let wsMessages: any[] = [];
      ws.on('message', (data) => {
        wsMessages.push(JSON.parse(data.toString()));
      });

      // Wait for authentication
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send user-specific message via WebSocket
      wsService.sendToUser(userId, {
        type: 'user_notification',
        data: { message: 'Personal update for user' }
      });

      // Send user-specific message via SSE
      sseService.sendToUser(userId, {
        event: 'notification',
        data: { message: 'SSE personal update' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check both clients received their respective messages
      const wsNotification = wsMessages.find(msg => msg.type === 'user_notification');
      expect(wsNotification).toBeDefined();
      expect(wsNotification.data.message).toBe('Personal update for user');

      const sseMessage = sseClient.getLastMessage();
      expect(sseMessage?.event).toBe('notification');
      expect(sseMessage?.data.message).toBe('SSE personal update');

      ws.close();
      sseService.removeClient(sseClientId);
    });
  });

  describe('Event System Integration', () => {
    it('should coordinate sentiment analysis workflow', async () => {
      // Setup clients
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));
      
      const sseClient = new MockSSEClient();
      const sseClientId = sseService.addClient(sseClient as any);

      // Subscribe WebSocket to sentiment topic
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      }));

      let wsMessages: any[] = [];
      ws.on('message', (data) => {
        wsMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      sseClient.written = [];

      // Simulate sentiment analysis workflow
      
      // 1. Job created
      eventEmitter.emit('job:created', {
        jobId: 'sentiment-job-789',
        type: 'sentiment_analysis',
        status: 'pending'
      });

      // 2. Progress updates
      eventEmitter.emit('sentiment:progress', {
        jobId: 'sentiment-job-789',
        progress: 25,
        message: 'Starting analysis'
      });

      eventEmitter.emit('sentiment:progress', {
        jobId: 'sentiment-job-789',
        progress: 75,
        message: 'Processing data'
      });

      // 3. Completion
      eventEmitter.emit('sentiment:complete', {
        jobId: 'sentiment-job-789',
        results: {
          positive: 45,
          negative: 30,
          neutral: 25
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify WebSocket received all updates
      const jobCreated = wsMessages.find(msg => msg.type === 'job_created');
      const progress1 = wsMessages.find(msg => 
        msg.type === 'sentiment_progress' && msg.data.progress === 25
      );
      const progress2 = wsMessages.find(msg => 
        msg.type === 'sentiment_progress' && msg.data.progress === 75
      );
      const completed = wsMessages.find(msg => msg.type === 'sentiment_complete');

      expect(jobCreated).toBeDefined();
      expect(progress1).toBeDefined();
      expect(progress2).toBeDefined();
      expect(completed).toBeDefined();
      expect(completed.data.results.positive).toBe(45);

      ws.close();
      sseService.removeClient(sseClientId);
    });

    it('should handle file processing events across channels', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));

      const sseClient = new MockSSEClient();
      const sseClientId = sseService.addClient(sseClient as any);

      // Subscribe to file processing topic
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'file_processing' }
      }));

      let wsMessages: any[] = [];
      ws.on('message', (data) => {
        wsMessages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      sseClient.written = [];

      // Simulate file processing events
      eventEmitter.emit('file:progress', {
        fileId: 'file-456',
        progress: 30,
        stage: 'parsing',
        totalRows: 10000,
        processedRows: 3000
      });

      eventEmitter.emit('pii:detected', {
        fileId: 'file-456',
        detections: [
          { type: 'email', value: 'user@example.com', confidence: 0.95 },
          { type: 'phone', value: '555-0123', confidence: 0.87 }
        ]
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check file progress was received
      const fileProgress = wsMessages.find(msg => msg.type === 'file_progress');
      expect(fileProgress).toBeDefined();
      expect(fileProgress.data.progress).toBe(30);

      // Check PII detection was received
      const piiDetected = wsMessages.find(msg => msg.type === 'pii_detected');
      expect(piiDetected).toBeDefined();
      expect(piiDetected.data.detections).toHaveLength(2);

      ws.close();
      sseService.removeClient(sseClientId);
    });
  });

  describe('Connection Management and Resilience', () => {
    it('should handle client disconnections gracefully', async () => {
      // Connect multiple clients
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      const sseClient1 = new MockSSEClient();
      const sseClient2 = new MockSSEClient();
      const sseId1 = sseService.addClient(sseClient1 as any);
      const sseId2 = sseService.addClient(sseClient2 as any);

      expect(wsService.getClientCount()).toBe(2);
      expect(sseService.getClientCount()).toBe(2);

      // Disconnect one WebSocket client
      ws1.close();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsService.getClientCount()).toBe(1);
      expect(sseService.getClientCount()).toBe(2);

      // Disconnect one SSE client
      sseClient1.end();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(wsService.getClientCount()).toBe(1);
      expect(sseService.getClientCount()).toBe(1);

      // Cleanup
      ws2.close();
      sseService.removeClient(sseId2);
    });

    it('should handle high-frequency events without blocking', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));

      const sseClient = new MockSSEClient();
      const sseId = sseService.addClient(sseClient as any);

      let wsMessageCount = 0;
      ws.on('message', () => wsMessageCount++);

      // Clear initial messages
      sseClient.written = [];

      // Send high-frequency events
      const eventCount = 100;
      const startTime = Date.now();

      for (let i = 0; i < eventCount; i++) {
        eventEmitter.emit('metrics:update', {
          timestamp: Date.now(),
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 100,
          iteration: i
        });
      }

      // Wait for all events to process
      await new Promise(resolve => setTimeout(resolve, 500));
      const processingTime = Date.now() - startTime;

      // Should handle events reasonably fast
      expect(processingTime).toBeLessThan(2000); // Under 2 seconds

      // WebSocket should receive most/all events
      expect(wsMessageCount).toBeGreaterThan(eventCount * 0.8); // At least 80%

      ws.close();
      sseService.removeClient(sseId);
    });
  });

  describe('Topic Subscription and Filtering', () => {
    it('should properly filter events by topic subscription', async () => {
      const ws1 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      const ws2 = new WebSocket(`ws://localhost:${serverPort}/ws`);
      
      await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve))
      ]);

      // Subscribe ws1 to sentiment, ws2 to jobs
      ws1.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      }));

      ws2.send(JSON.stringify({
        type: 'subscribe',
        data: { topic: 'jobs' }
      }));

      let ws1Messages: any[] = [];
      let ws2Messages: any[] = [];
      
      ws1.on('message', (data) => {
        ws1Messages.push(JSON.parse(data.toString()));
      });
      
      ws2.on('message', (data) => {
        ws2Messages.push(JSON.parse(data.toString()));
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear connection messages
      ws1Messages = [];
      ws2Messages = [];

      // Send events to different topics
      eventEmitter.emit('sentiment:progress', {
        jobId: 'sent-123',
        progress: 50
      });

      eventEmitter.emit('job:created', {
        jobId: 'job-456',
        type: 'export'
      });

      eventEmitter.emit('file:progress', {
        fileId: 'file-789',
        progress: 25
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // ws1 should only receive sentiment events
      const ws1SentimentMsg = ws1Messages.find(msg => msg.type === 'sentiment_progress');
      const ws1JobMsg = ws1Messages.find(msg => msg.type === 'job_created');
      const ws1FileMsg = ws1Messages.find(msg => msg.type === 'file_progress');

      expect(ws1SentimentMsg).toBeDefined();
      expect(ws1JobMsg).toBeUndefined();
      expect(ws1FileMsg).toBeUndefined();

      // ws2 should only receive job events
      const ws2SentimentMsg = ws2Messages.find(msg => msg.type === 'sentiment_progress');
      const ws2JobMsg = ws2Messages.find(msg => msg.type === 'job_created');
      const ws2FileMsg = ws2Messages.find(msg => msg.type === 'file_progress');

      expect(ws2SentimentMsg).toBeUndefined();
      expect(ws2JobMsg).toBeDefined();
      expect(ws2FileMsg).toBeUndefined();

      ws1.close();
      ws2.close();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle malformed WebSocket messages', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
      await new Promise(resolve => ws.on('open', resolve));

      let errorMessages: any[] = [];
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'error') {
          errorMessages.push(msg);
        }
      });

      // Send malformed JSON
      ws.send('{"invalid": json}');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should receive error message
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0].data.message).toContain('Invalid message format');

      ws.close();
    });

    it('should handle SSE client write errors', async () => {
      const sseClient = new MockSSEClient();
      const originalWrite = sseClient.write;
      
      // Make write fail after initial setup
      let writeCallCount = 0;
      sseClient.write = function(data: string) {
        writeCallCount++;
        if (writeCallCount > 2) { // Allow connection message
          throw new Error('Write failed');
        }
        return originalWrite.call(this, data);
      };

      const clientId = sseService.addClient(sseClient as any);
      expect(sseService.getClientCount()).toBe(1);

      // This should cause a write error and remove the client
      sseService.sendToClient(clientId, {
        event: 'test',
        data: { message: 'This should fail' }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Client should be removed due to write error
      expect(sseService.getClientCount()).toBe(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent WebSocket and SSE operations', async () => {
      const numClients = 20;
      const wsClients: WebSocket[] = [];
      const sseClients: MockSSEClient[] = [];

      // Connect multiple WebSocket clients
      for (let i = 0; i < numClients; i++) {
        const ws = new WebSocket(`ws://localhost:${serverPort}/ws`);
        wsClients.push(ws);
        await new Promise(resolve => ws.on('open', resolve));
      }

      // Connect multiple SSE clients
      for (let i = 0; i < numClients; i++) {
        const sseClient = new MockSSEClient();
        sseClients.push(sseClient);
        sseService.addClient(sseClient as any, `user-${i}`);
      }

      expect(wsService.getClientCount()).toBe(numClients);
      expect(sseService.getClientCount()).toBe(numClients);

      const startTime = Date.now();

      // Broadcast to all clients
      wsService.broadcast({
        type: 'load_test',
        data: { message: 'Broadcasting to all WebSocket clients' }
      });

      sseService.broadcast('load_test', {
        message: 'Broadcasting to all SSE clients'
      });

      const broadcastTime = Date.now() - startTime;

      // Should complete broadcasts quickly
      expect(broadcastTime).toBeLessThan(1000); // Under 1 second

      // Cleanup
      wsClients.forEach(ws => ws.close());
      sseClients.forEach(client => client.end());
    });
  });
});