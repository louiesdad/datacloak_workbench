import { EventEmitter } from 'events';

export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CLOSED;
  url: string;
  protocols?: string | string[];
  
  private _isAlive = true;
  private _sentMessages: any[] = [];
  private _receivedMessages: any[] = [];

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    this.protocols = protocols;
    
    // Start in connecting state
    this.readyState = MockWebSocket.CONNECTING;
    
    // Simulate connection after a brief delay
    process.nextTick(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    });
  }

  send(data: any): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // When server sends to client, it's received by client
    this._receivedMessages.push(data);
    this.emit('message-sent', data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', { code: code || 1000, reason });
    }, 10);
  }

  ping(): void {
    if (this._isAlive) {
      this.emit('pong');
    }
  }

  pong(): void {
    // Mock pong
  }

  terminate(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', { code: 1006, reason: 'Connection terminated' });
  }

  // Test helpers
  simulateMessage(data: any): void {
    // Client sends message to server
    this._sentMessages.push(data);
    const messageData = typeof data === 'string' ? data : JSON.stringify(data);
    // Pass the message data directly, with a toString() method
    const messageBuffer = {
      toString: () => messageData,
      data: messageData
    };
    this.emit('message', messageBuffer);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', { code, reason });
  }

  getMessages(): any[] {
    // Return messages received by this client
    return this._receivedMessages;
  }

  getSentMessages(): any[] {
    // Return messages sent by this client
    return this._sentMessages;
  }

  clearMessages(): void {
    this._receivedMessages = [];
    this._sentMessages = [];
  }

  setAlive(alive: boolean): void {
    this._isAlive = alive;
  }
}

export class MockWebSocketServer extends EventEmitter {
  clients: Set<MockWebSocket> = new Set();
  options: any;

  constructor(options: any) {
    super();
    this.options = options;
  }

  handleUpgrade(request: any, socket: any, head: any, callback: (ws: MockWebSocket) => void): void {
    const ws = new MockWebSocket(this.options.path || '/ws');
    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
    });
    callback(ws);
  }

  close(callback?: () => void): void {
    this.clients.forEach(client => client.close());
    this.clients.clear();
    if (callback) callback();
  }

  // Test helper to simulate a new connection
  simulateConnection(request?: any): MockWebSocket {
    const ws = new MockWebSocket(this.options.path || '/ws');
    // Ensure the connection is open before emitting
    ws.readyState = MockWebSocket.OPEN;
    this.clients.add(ws);
    ws.on('close', () => {
      this.clients.delete(ws);
    });
    this.emit('connection', ws, request);
    return ws;
  }
}

// Mock the ws module
export const mockWs = {
  WebSocket: MockWebSocket,
  WebSocketServer: MockWebSocketServer
};