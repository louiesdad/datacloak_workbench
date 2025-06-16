import { WebSocketService } from '../websocket.service';
import { MockWebSocketServer, MockWebSocket } from '../../tests/mocks/websocket.mock';
import { eventEmitter, EventTypes } from '../event.service';
import { Server } from 'http';

// Mock the ws module
jest.mock('ws', () => {
  const { MockWebSocket, MockWebSocketServer } = require('../../tests/mocks/websocket.mock');
  return {
    WebSocket: MockWebSocket,
    WebSocketServer: MockWebSocketServer
  };
});

// Mock logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockServer: any;
  let mockWss: MockWebSocketServer;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebSocketService();
    mockServer = { on: jest.fn() } as any;
    
    // Clear any existing event listeners
    eventEmitter.removeAllListeners();
  });

  afterEach(() => {
    service.shutdown();
    jest.clearAllTimers();
  });

  describe('initialize', () => {
    it('should create WebSocket server and set up event listeners', () => {
      service.initialize(mockServer as Server);
      
      // Get the WebSocketServer instance
      mockWss = (service as any).wss;
      
      expect(mockWss).toBeDefined();
      expect(mockWss.options.path).toBe('/ws');
      expect(mockWss.options.clientTracking).toBe(false);
    });

    it('should handle new connections', async () => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
      
      // Simulate a new connection
      const mockClient = mockWss.simulateConnection({ url: '/ws' });
      
      // Wait for connection handling
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(service.getClientCount()).toBe(1);
      
      // Check if welcome message was sent
      const messages = mockClient.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      const welcomeMessage = JSON.parse(messages[0]);
      expect(welcomeMessage.type).toBe('connection');
      expect(welcomeMessage.data.message).toContain('Connected to DataCloak');
    });
  });

  describe('client management', () => {
    beforeEach(() => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    it('should handle client disconnection', async () => {
      const mockClient = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(service.getClientCount()).toBe(1);
      
      // Simulate disconnect
      mockClient.simulateClose();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(service.getClientCount()).toBe(0);
    });

    it('should handle client messages', async () => {
      const mockClient = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientId = Array.from((service as any).clients.keys())[0];
      
      // Test heartbeat
      mockClient.simulateMessage({
        type: 'heartbeat',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const messages = mockClient.getMessages();
      const heartbeatResponse = messages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.type === 'heartbeat_response';
      });
      
      expect(heartbeatResponse).toBeDefined();
    });

    it('should handle topic subscription', async () => {
      const mockClient = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientId = Array.from((service as any).clients.keys())[0] as string;
      const clientInfo = service.getClientInfo(clientId);
      
      expect(clientInfo?.subscriptions.has('global')).toBe(true);
      
      // Subscribe to a topic
      mockClient.simulateMessage({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const updatedInfo = service.getClientInfo(clientId as string);
      expect(updatedInfo?.subscriptions.has('sentiment')).toBe(true);
    });

    it('should handle topic unsubscription', async () => {
      const mockClient = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientId = Array.from((service as any).clients.keys())[0] as string;
      
      // Subscribe first
      mockClient.simulateMessage({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Then unsubscribe
      mockClient.simulateMessage({
        type: 'unsubscribe',
        data: { topic: 'sentiment' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientInfo = service.getClientInfo(clientId);
      expect(clientInfo?.subscriptions.has('sentiment')).toBe(false);
    });

    it('should handle authentication', async () => {
      const mockClient = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientId = Array.from((service as any).clients.keys())[0] as string;
      
      mockClient.simulateMessage({
        type: 'authenticate',
        data: { userId: 'user123' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientInfo = service.getClientInfo(clientId);
      expect(clientInfo?.userId).toBe('user123');
    });
  });

  describe('broadcasting', () => {
    beforeEach(() => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    it('should broadcast to all clients', async () => {
      const client1 = mockWss.simulateConnection();
      const client2 = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client1.clearMessages();
      client2.clearMessages();
      
      const message = { type: 'test', data: { value: 123 } };
      const sentCount = service.broadcast(message);
      
      expect(sentCount).toBe(2);
      
      const messages1 = client1.getMessages();
      const messages2 = client2.getMessages();
      
      expect(messages1.length).toBe(1);
      expect(messages2.length).toBe(1);
      expect(JSON.parse(messages1[0]).type).toBe('test');
    });

    it('should broadcast to specific topic subscribers', async () => {
      const client1 = mockWss.simulateConnection();
      const client2 = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Subscribe client1 to sentiment topic
      client1.simulateMessage({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client1.clearMessages();
      client2.clearMessages();
      
      const message = { type: 'sentiment_update', data: { sentiment: 'positive' } };
      const sentCount = service.broadcast(message, { topic: 'sentiment' });
      
      expect(sentCount).toBe(1); // Only client1 should receive it
      
      const messages1 = client1.getMessages();
      const messages2 = client2.getMessages();
      
      expect(messages1.length).toBe(1);
      expect(messages2.length).toBe(0);
    });

    it('should broadcast to specific user', async () => {
      const client1 = mockWss.simulateConnection();
      const client2 = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Authenticate client1
      client1.simulateMessage({
        type: 'authenticate',
        data: { userId: 'user123' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client1.clearMessages();
      client2.clearMessages();
      
      const message = { type: 'user_notification', data: { text: 'Hello user' } };
      const sentCount = service.sendToUser('user123', message);
      
      expect(sentCount).toBe(1);
      
      const messages1 = client1.getMessages();
      const messages2 = client2.getMessages();
      
      expect(messages1.length).toBe(1);
      expect(messages2.length).toBe(0);
    });
  });

  describe('event integration', () => {
    beforeEach(() => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    it('should broadcast sentiment progress events', async () => {
      const client = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Subscribe to sentiment topic
      client.simulateMessage({
        type: 'subscribe',
        data: { topic: 'sentiment' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      client.clearMessages();
      
      // Emit sentiment progress event
      eventEmitter.emit(EventTypes.SENTIMENT_PROGRESS, {
        progress: 50,
        message: 'Processing sentiment'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const messages = client.getMessages();
      expect(messages.length).toBe(1);
      
      const message = JSON.parse(messages[0]);
      expect(message.type).toBe('sentiment_progress');
      expect(message.data.progress).toBe(50);
    });

    it('should broadcast job events', async () => {
      const client = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Subscribe to jobs topic
      client.simulateMessage({
        type: 'subscribe',
        data: { topic: 'jobs' }
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      client.clearMessages();
      
      // Emit job created event
      eventEmitter.emit(EventTypes.JOB_CREATED, {
        jobId: 'job123',
        type: 'sentiment_analysis',
        status: 'pending'
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const messages = client.getMessages();
      expect(messages.length).toBe(1);
      
      const message = JSON.parse(messages[0]);
      expect(message.type).toBe('job_created');
      expect(message.data.jobId).toBe('job123');
    });
  });

  describe('connection health', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send heartbeat pings', async () => {
      const client = mockWss.simulateConnection();
      
      // Clear initial messages
      await jest.advanceTimersByTimeAsync(50);
      client.clearMessages();
      
      // Mock ping method
      const pingMock = jest.spyOn(client, 'ping');
      
      // Fast-forward to trigger heartbeat
      await jest.advanceTimersByTimeAsync(30000);
      
      expect(pingMock).toHaveBeenCalled();
    });

    it('should disconnect inactive clients', async () => {
      const client = mockWss.simulateConnection();
      await jest.advanceTimersByTimeAsync(50);
      
      expect(service.getClientCount()).toBe(1);
      
      // Set client as not alive
      const clientId = Array.from((service as any).clients.keys())[0];
      const clientInfo = (service as any).clients.get(clientId);
      clientInfo.isAlive = false;
      
      // Trigger heartbeat check
      await jest.advanceTimersByTimeAsync(30000);
      
      expect(service.getClientCount()).toBe(0);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    it('should handle invalid message format', async () => {
      const client = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client.clearMessages();
      
      // Send invalid JSON
      client.simulateMessage('invalid json{');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const messages = client.getMessages();
      const errorMessage = messages.find(msg => {
        const parsed = JSON.parse(msg);
        return parsed.type === 'error';
      });
      
      expect(errorMessage).toBeDefined();
      expect(JSON.parse(errorMessage).data.message).toContain('Invalid message format');
    });

    it('should handle client errors', async () => {
      const client = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(service.getClientCount()).toBe(1);
      
      // Simulate error
      client.simulateError(new Error('Connection error'));
      
      // Client should still be connected (error logged but not disconnected)
      expect(service.getClientCount()).toBe(1);
    });
  });

  describe('client operations', () => {
    beforeEach(() => {
      service.initialize(mockServer as Server);
      mockWss = (service as any).wss;
    });

    it('should disconnect specific client', async () => {
      const client = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const clientId = Array.from((service as any).clients.keys())[0] as string;
      
      const result = service.disconnectClient(clientId, 'Admin action');
      
      expect(result).toBe(true);
      expect(service.getClientCount()).toBe(0);
    });

    it('should return false when disconnecting non-existent client', () => {
      const result = service.disconnectClient('non-existent-id');
      expect(result).toBe(false);
    });

    it('should get all clients', async () => {
      const client1 = mockWss.simulateConnection();
      const client2 = mockWss.simulateConnection();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const allClients = service.getAllClients();
      expect(allClients.size).toBe(2);
    });
  });
});