import { WebSocketService } from '../websocket.service';
import { eventEmitter, EventTypes } from '../event.service';
import { WebSocket } from 'ws';
import { Server } from 'http';

// Mock ws module
jest.mock('ws');

describe('WebSocket Progress System', () => {
  let websocketService: WebSocketService;
  let mockServer: Server;
  let mockWebSocket: any;
  let mockWebSocketServer: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      readyState: WebSocket.OPEN,
      ping: jest.fn()
    };

    // Mock WebSocketServer
    mockWebSocketServer = {
      on: jest.fn((event, handler) => {
        if (event === 'connection') {
          // Simulate a connection with proper setup
          setTimeout(() => {
            handler(mockWebSocket, {});
            // Simulate client subscribing to topics
            const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
            if (messageHandler) {
              // Subscribe to jobs topic
              messageHandler(JSON.stringify({
                type: 'subscribe',
                data: { topic: 'jobs' }
              }));
              // Subscribe to sentiment topic
              messageHandler(JSON.stringify({
                type: 'subscribe',
                data: { topic: 'sentiment' }
              }));
            }
          }, 10);
        }
      }),
      clients: new Set()
    };

    // Mock the WebSocket constructor
    (WebSocket as any).WebSocketServer = jest.fn().mockImplementation(() => mockWebSocketServer);
    (WebSocket as any).OPEN = 1;

    // Create service instance
    websocketService = new WebSocketService();
    mockServer = {} as Server;
  });

  afterEach(() => {
    // Clear all event listeners
    eventEmitter.removeAllListeners();
    // Clear any timers
    jest.clearAllTimers();
  });

  describe('Progress Event Broadcasting', () => {
    test('should emit progress events every 1000 rows processed', async () => {
      // Initialize the WebSocket service
      websocketService.initialize(mockServer);
      
      // Wait for connection to be established and subscriptions to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Emit a job progress event
      eventEmitter.emit('job:progress', {
        jobId: 'job-123',
        rowsProcessed: 1000,
        totalRows: 5000,
        progress: 20,
        timeElapsed: 60000
      });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify WebSocket message was sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('job_progress')
      );

      // Find the job_progress message (skip connection and client_count messages)
      const jobProgressCall = mockWebSocket.send.mock.calls.find(
        call => call[0].includes('job_progress')
      );
      
      expect(jobProgressCall).toBeDefined();
      const sentMessage = JSON.parse(jobProgressCall[0]);
      expect(sentMessage).toMatchObject({
        type: 'job_progress',
        data: {
          jobId: 'job-123',
          rowsProcessed: 1000,
          totalRows: 5000,
          progress: 20
        }
      });
    });

    test('should handle sentiment analysis progress events', async () => {
      websocketService.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Emit sentiment progress event
      eventEmitter.emit('sentiment:progress', {
        jobId: 'job-456',
        filesProcessed: 2,
        totalFiles: 10,
        currentFile: 'data.csv',
        rowsInCurrentFile: 2000,
        totalRowsInCurrentFile: 10000,
        overallProgress: 15
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify the message was sent
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('sentiment_progress')
      );
    });

    test('should handle reconnection gracefully', async () => {
      websocketService.initialize(mockServer);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate disconnect
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      // Try to emit progress event
      eventEmitter.emit('job:progress', {
        jobId: 'job-789',
        progress: 50
      });

      // Should not throw error even if client is disconnected
      expect(() => {
        websocketService.broadcast({ type: 'test', data: {} });
      }).not.toThrow();
    });
  });
});