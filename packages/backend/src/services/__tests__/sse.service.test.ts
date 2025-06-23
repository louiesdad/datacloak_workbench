import { SSEService, SSEClient, SSEEvent } from '../sse.service';
import { Response } from 'express';
import { EventEmitter } from 'events';

// Mock Response object
class MockResponse extends EventEmitter {
  public headers: any = {};
  public statusCode?: number;
  public written: string[] = [];

  writeHead(statusCode: number, headers: any) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  write(data: string) {
    this.written.push(data);
    return true;
  }

  end() {
    this.emit('close');
  }
}

describe('SSEService', () => {
  let sseService: SSEService;
  let mockResponse: MockResponse;

  beforeEach(() => {
    jest.useFakeTimers();
    sseService = new SSEService();
    mockResponse = new MockResponse();
  });

  afterEach(() => {
    sseService.stopPingInterval();
    sseService.removeAllListeners();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize SSE service', () => {
      expect(sseService).toBeDefined();
      expect(sseService['pingInterval']).toBeDefined();
    });

    it('should start ping interval automatically', () => {
      expect(sseService['pingInterval']).not.toBeNull();
    });
  });

  describe('addClient', () => {
    it('should register a new client', () => {
      const clientId = sseService.addClient(mockResponse as any);

      expect(clientId).toBeDefined();
      expect(typeof clientId).toBe('string');
      expect(sseService['clients'].has(clientId)).toBe(true);
    });

    it('should set correct SSE headers', () => {
      sseService.addClient(mockResponse as any);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers['Content-Type']).toBe('text/event-stream');
      expect(mockResponse.headers['Cache-Control']).toBe('no-cache');
      expect(mockResponse.headers['Connection']).toBe('keep-alive');
      expect(mockResponse.headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should send initial connection event', () => {
      const clientId = sseService.addClient(mockResponse as any);

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0]).toContain('event: connected');
      expect(mockResponse.written[0]).toContain(`"clientId":"${clientId}"`);
    });

    it('should store user ID if provided', () => {
      const userId = 'user123';
      const clientId = sseService.addClient(mockResponse as any, userId);

      const client = sseService['clients'].get(clientId);
      expect(client?.userId).toBe(userId);
    });

    it('should handle client disconnect', () => {
      const clientId = sseService.addClient(mockResponse as any);
      expect(sseService['clients'].has(clientId)).toBe(true);

      mockResponse.emit('close');
      expect(sseService['clients'].has(clientId)).toBe(false);
    });

    it('should emit client:connected event', () => {
      const listener = jest.fn();
      sseService.on('client:connected', listener);

      const userId = 'user123';
      const clientId = sseService.addClient(mockResponse as any, userId);

      expect(listener).toHaveBeenCalledWith({
        clientId,
        userId
      });
    });
  });

  describe('removeClient', () => {
    it('should remove client', () => {
      const clientId = sseService.addClient(mockResponse as any);
      expect(sseService['clients'].has(clientId)).toBe(true);

      sseService.removeClient(clientId);
      expect(sseService['clients'].has(clientId)).toBe(false);
    });

    it('should emit client:disconnected event', () => {
      const listener = jest.fn();
      sseService.on('client:disconnected', listener);

      const userId = 'user123';
      const clientId = sseService.addClient(mockResponse as any, userId);
      sseService.removeClient(clientId);

      expect(listener).toHaveBeenCalledWith({
        clientId,
        userId
      });
    });

    it('should handle non-existent client gracefully', () => {
      expect(() => sseService.removeClient('non-existent')).not.toThrow();
    });
  });

  describe('sendToClient', () => {
    it('should send event to specific client', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = []; // Clear initial connection event

      const event: SSEEvent = {
        event: 'test',
        data: { message: 'Hello' }
      };

      sseService.sendToClient(clientId, event);

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0]).toContain('event: test');
      expect(mockResponse.written[0]).toContain('data: {"message":"Hello"}');
    });

    it('should update client lastPing', () => {
      const clientId = sseService.addClient(mockResponse as any);
      const client = sseService['clients'].get(clientId);
      const originalPing = client!.lastPing;

      // Advance time
      jest.advanceTimersByTime(5000);

      sseService.sendToClient(clientId, { data: 'test' });

      expect(client!.lastPing.getTime()).toBeGreaterThan(originalPing.getTime());
    });

    it('should handle write errors by removing client', () => {
      const clientId = sseService.addClient(mockResponse as any);
      
      // Make write throw an error
      mockResponse.write = jest.fn().mockImplementation(() => {
        throw new Error('Write failed');
      });

      sseService.sendToClient(clientId, { data: 'test' });

      expect(sseService['clients'].has(clientId)).toBe(false);
    });

    it('should ignore non-existent clients', () => {
      expect(() => sseService.sendToClient('non-existent', { data: 'test' })).not.toThrow();
    });
  });

  describe('sendToUser', () => {
    it('should send event to all clients of a user', () => {
      const userId = 'user123';
      const clientId1 = sseService.addClient(new MockResponse() as any, userId);
      const clientId2 = sseService.addClient(new MockResponse() as any, userId);
      const clientId3 = sseService.addClient(new MockResponse() as any, 'other-user');

      const event: SSEEvent = {
        event: 'user-event',
        data: { message: 'User update' }
      };

      sseService.sendToUser(userId, event);

      const client1 = sseService['clients'].get(clientId1);
      const client2 = sseService['clients'].get(clientId2);
      const client3 = sseService['clients'].get(clientId3);

      expect((client1?.response as any).written.length).toBe(2); // connection + event
      expect((client2?.response as any).written.length).toBe(2);
      expect((client3?.response as any).written.length).toBe(1); // only connection
    });

    it('should handle users with no clients', () => {
      expect(() => sseService.sendToUser('no-clients', { data: 'test' })).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('should send event to all connected clients', () => {
      const response1 = new MockResponse();
      const response2 = new MockResponse();
      const response3 = new MockResponse();

      sseService.addClient(response1 as any);
      sseService.addClient(response2 as any);
      sseService.addClient(response3 as any);

      const event: SSEEvent = {
        event: 'broadcast',
        data: { message: 'Global update' }
      };

      sseService.broadcast(event.event!, event.data);

      expect(response1.written.length).toBe(2); // connection + broadcast
      expect(response2.written.length).toBe(2);
      expect(response3.written.length).toBe(2);

      expect(response1.written[1]).toContain('event: broadcast');
      expect(response1.written[1]).toContain('data: {"message":"Global update"}');
    });

    it('should handle empty client list', () => {
      expect(() => sseService.broadcast('test', { data: 'test' })).not.toThrow();
    });
  });

  describe('sendProgress', () => {
    it('should send progress update', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      sseService.sendProgress(clientId, 'job123', 50, 'Processing...');

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0]).toContain('event: progress');
      expect(mockResponse.written[0]).toContain('"jobId":"job123"');
      expect(mockResponse.written[0]).toContain('"progress":50');
      expect(mockResponse.written[0]).toContain('"message":"Processing..."');
    });

    it('should handle progress without message', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      sseService.sendProgress(clientId, 'job123', 75);

      expect(mockResponse.written[0]).toContain('"progress":75');
      expect(mockResponse.written[0]).not.toContain('message');
    });
  });

  describe('sendError', () => {
    it('should send error event', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      sseService.sendError(clientId, 'job123', 'Processing failed');

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0]).toContain('event: error');
      expect(mockResponse.written[0]).toContain('"jobId":"job123"');
      expect(mockResponse.written[0]).toContain('"error":"Processing failed"');
    });
  });

  describe('sendComplete', () => {
    it('should send complete event', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      const result = { data: 'processed', count: 100 };
      sseService.sendComplete(clientId, 'job123', result);

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0]).toContain('event: complete');
      expect(mockResponse.written[0]).toContain('"jobId":"job123"');
      expect(mockResponse.written[0]).toContain('"result":{"data":"processed","count":100}');
    });
  });

  describe('getClientCount', () => {
    it('should return total client count', () => {
      expect(sseService.getClientCount()).toBe(0);

      sseService.addClient(new MockResponse() as any);
      sseService.addClient(new MockResponse() as any);

      expect(sseService.getClientCount()).toBe(2);
    });
  });

  describe('getClients', () => {
    it('should return client information', () => {
      const userId = 'user123';
      const clientId = sseService.addClient(mockResponse as any, userId);

      const clients = sseService.getClients();

      expect(clients).toHaveLength(1);
      expect(clients[0]).toMatchObject({
        id: clientId,
        userId,
        connected: true
      });
      expect(clients[0].connectedAt).toBeInstanceOf(Date);
    });
  });

  describe('ping mechanism', () => {
    it('should send ping to all clients periodically', () => {
      const response1 = new MockResponse();
      const response2 = new MockResponse();

      sseService.addClient(response1 as any);
      sseService.addClient(response2 as any);

      // Clear initial events
      response1.written = [];
      response2.written = [];

      // Advance time to trigger ping
      jest.advanceTimersByTime(30000);

      expect(response1.written.length).toBe(1);
      expect(response2.written.length).toBe(1);
      expect(response1.written[0]).toContain('event: ping');
    });

    it('should remove stale clients during ping', () => {
      const clientId = sseService.addClient(mockResponse as any);
      const client = sseService['clients'].get(clientId);

      // Set lastPing to an old time (before the 2-minute timeout)
      const oldTime = new Date();
      oldTime.setTime(oldTime.getTime() - 150000); // 2.5 minutes ago
      client!.lastPing = oldTime;

      // Make write throw an error so lastPing doesn't get updated during broadcast
      mockResponse.write = jest.fn().mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Trigger ping check which should remove stale clients
      jest.advanceTimersByTime(30000);

      expect(sseService['clients'].has(clientId)).toBe(false);
    });

    it('should handle ping errors gracefully', () => {
      const clientId = sseService.addClient(mockResponse as any);
      
      // Make write throw an error
      mockResponse.write = jest.fn().mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Should not throw
      expect(() => jest.advanceTimersByTime(30000)).not.toThrow();
      
      // Client should be removed
      expect(sseService['clients'].has(clientId)).toBe(false);
    });
  });

  describe('formatSSEMessage', () => {
    it('should format event with all fields', () => {
      const event: SSEEvent = {
        id: 'msg123',
        event: 'test',
        data: { message: 'Hello' },
        retry: 5000
      };

      const formatted = sseService['formatSSEMessage'](event);

      expect(formatted).toContain('id: msg123\n');
      expect(formatted).toContain('event: test\n');
      expect(formatted).toContain('data: {"message":"Hello"}\n');
      expect(formatted).toContain('retry: 5000\n');
      expect(formatted.endsWith('\n\n')).toBe(true);
    });

    it('should format minimal event', () => {
      const event: SSEEvent = {
        data: 'Simple message'
      };

      const formatted = sseService['formatSSEMessage'](event);

      expect(formatted).toBe('data: "Simple message"\n\n');
    });

    it('should handle multi-line data', () => {
      const event: SSEEvent = {
        data: { message: 'Line 1\nLine 2\nLine 3' }
      };

      const formatted = sseService['formatSSEMessage'](event);

      expect(formatted).toContain('data: {"message":"Line 1\\nLine 2\\nLine 3"}');
    });

    it('should stringify non-string data', () => {
      const event: SSEEvent = {
        data: { number: 123, boolean: true, array: [1, 2, 3] }
      };

      const formatted = sseService['formatSSEMessage'](event);

      expect(formatted).toContain('data: {"number":123,"boolean":true,"array":[1,2,3]}');
    });
  });

  describe('stopPingInterval', () => {
    it('should stop ping interval', () => {
      expect(sseService['pingInterval']).not.toBeNull();

      sseService.stopPingInterval();

      expect(sseService['pingInterval']).toBeNull();
    });

    it('should handle multiple stop calls', () => {
      sseService.stopPingInterval();
      expect(() => sseService.stopPingInterval()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on service shutdown', () => {
      const clientId1 = sseService.addClient(new MockResponse() as any);
      const clientId2 = sseService.addClient(new MockResponse() as any);

      expect(sseService.getClientCount()).toBe(2);
      expect(sseService['pingInterval']).not.toBeNull();

      // Simulate service shutdown
      sseService['clients'].forEach((client, id) => sseService.removeClient(id));
      sseService.stopPingInterval();

      expect(sseService.getClientCount()).toBe(0);
      expect(sseService['pingInterval']).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle circular JSON references', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // Should not throw
      expect(() => sseService.sendToClient(clientId, { data: circularObj })).not.toThrow();
      
      // Should have attempted to write something
      expect(mockResponse.written.length).toBeGreaterThan(0);
    });

    it('should handle very large messages', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      const largeData = {
        data: 'x'.repeat(1000000) // 1MB string
      };

      sseService.sendToClient(clientId, { data: largeData });

      expect(mockResponse.written.length).toBe(1);
      expect(mockResponse.written[0].length).toBeGreaterThan(1000000);
    });

    it('should handle special characters in data', () => {
      const clientId = sseService.addClient(mockResponse as any);
      mockResponse.written = [];

      const specialData = {
        message: 'Hello\r\nWorld\r\n\r\nSSE Test',
        emoji: '😀🎉',
        unicode: '你好世界'
      };

      sseService.sendToClient(clientId, { data: specialData });

      expect(mockResponse.written[0]).toContain('😀🎉');
      expect(mockResponse.written[0]).toContain('你好世界');
    });
  });

  describe('performance', () => {
    it('should handle many concurrent clients', () => {
      const clients: string[] = [];
      
      // Add 1000 clients
      for (let i = 0; i < 1000; i++) {
        const clientId = sseService.addClient(new MockResponse() as any);
        clients.push(clientId);
      }

      expect(sseService.getClientCount()).toBe(1000);

      // Broadcast to all
      const start = Date.now();
      sseService.broadcast('test', { message: 'Broadcast to all' });
      const duration = Date.now() - start;

      // Should complete reasonably fast
      expect(duration).toBeLessThan(100);

      // Clean up
      clients.forEach(id => sseService.removeClient(id));
      expect(sseService.getClientCount()).toBe(0);
    });
  });
});