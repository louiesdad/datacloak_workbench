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
  private _messages: any[] = [];

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    this.protocols = protocols;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open');
    }, 10);
  }

  send(data: any): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this._messages.push(data);
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
    const event = {
      data: typeof data === 'string' ? data : JSON.stringify(data),
      type: 'message',
      target: this
    };
    this.emit('message', event);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateClose(code: number = 1000, reason: string = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', { code, reason });
  }

  getMessages(): any[] {
    return this._messages;
  }

  clearMessages(): void {
    this._messages = [];
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