import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';
import { eventEmitter } from './event.service';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  isAlive: boolean;
  lastActivity: Date;
  subscriptions: Set<string>;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  id?: string;
}

interface BroadcastOptions {
  userId?: string;
  excludeClient?: string;
  topic?: string;
}

export class WebSocketService {
  private wss?: WebSocketServer;
  private clients = new Map<string, WebSocketClient>();
  private heartbeatInterval?: NodeJS.Timer;
  private cleanupInterval?: NodeJS.Timer;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: false,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startCleanup();
    this.setupEventListeners();

    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = uuidv4();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      isAlive: true,
      lastActivity: new Date(),
      subscriptions: new Set(['global'])
    };

    this.clients.set(clientId, client);
    logger.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        clientId,
        timestamp: Date.now(),
        message: 'Connected to DataCloak Sentiment Workbench'
      }
    });

    // Setup event handlers
    ws.on('message', (message) => this.handleMessage(clientId, message));
    ws.on('pong', () => this.handlePong(clientId));
    ws.on('close', () => this.handleDisconnect(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));

    // Notify about current active clients
    this.broadcast({
      type: 'client_count',
      data: { count: this.clients.size }
    });
  }

  private handleMessage(clientId: string, rawMessage: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const message: WebSocketMessage = JSON.parse(rawMessage.toString());
      
      switch (message.type) {
        case 'heartbeat':
          this.sendToClient(clientId, {
            type: 'heartbeat_response',
            timestamp: message.timestamp
          });
          break;

        case 'subscribe':
          if (message.data?.topic) {
            client.subscriptions.add(message.data.topic);
            this.sendToClient(clientId, {
              type: 'subscribed',
              data: { topic: message.data.topic }
            });
          }
          break;

        case 'unsubscribe':
          if (message.data?.topic) {
            client.subscriptions.delete(message.data.topic);
            this.sendToClient(clientId, {
              type: 'unsubscribed',
              data: { topic: message.data.topic }
            });
          }
          break;

        case 'authenticate':
          if (message.data?.userId) {
            client.userId = message.data.userId;
            this.sendToClient(clientId, {
              type: 'authenticated',
              data: { userId: message.data.userId }
            });
          }
          break;

        default:
          // Handle custom message types
          eventEmitter.emit('ws:message', {
            clientId,
            message,
            client
          });
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastActivity = new Date();
    }
  }

  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    logger.info(`WebSocket client disconnected: ${clientId}`);
    
    this.broadcast({
      type: 'client_count',
      data: { count: this.clients.size }
    });
  }

  private handleError(clientId: string, error: Error): void {
    logger.error(`WebSocket error for client ${clientId}:`, error);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes

      this.clients.forEach((client, clientId) => {
        if (now - client.lastActivity.getTime() > timeout) {
          this.sendToClient(clientId, {
            type: 'timeout',
            data: { message: 'Connection timeout due to inactivity' }
          });
          client.ws.close();
          this.clients.delete(clientId);
        }
      });
    }, 60000); // 1 minute
  }

  private setupEventListeners(): void {
    // Listen for sentiment analysis updates
    eventEmitter.on('sentiment:progress', (data) => {
      this.broadcast({
        type: 'sentiment_progress',
        data
      }, { topic: 'sentiment' });
    });

    eventEmitter.on('sentiment:complete', (data) => {
      this.broadcast({
        type: 'sentiment_complete',
        data
      }, { topic: 'sentiment' });
    });

    // Listen for file processing updates
    eventEmitter.on('file:progress', (data) => {
      this.broadcast({
        type: 'file_progress',
        data
      }, { topic: 'file_processing' });
    });

    // Listen for PII detection updates
    eventEmitter.on('pii:detected', (data) => {
      this.broadcast({
        type: 'pii_detected',
        data
      }, { topic: 'security' });
    });

    // Listen for job queue updates
    eventEmitter.on('job:created', (data) => {
      this.broadcast({
        type: 'job_created',
        data
      }, { topic: 'jobs' });
    });

    eventEmitter.on('job:progress', (data) => {
      this.broadcast({
        type: 'job_progress',
        data
      }, { topic: 'jobs' });
    });

    eventEmitter.on('job:complete', (data) => {
      this.broadcast({
        type: 'job_complete',
        data
      }, { topic: 'jobs' });
    });

    eventEmitter.on('job:failed', (data) => {
      this.broadcast({
        type: 'job_failed',
        data
      }, { topic: 'jobs' });
    });

    // System metrics
    eventEmitter.on('metrics:update', (data) => {
      this.broadcast({
        type: 'metrics_update',
        data
      }, { topic: 'metrics' });
    });
  }

  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || Date.now()
      }));
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  sendToUser(userId: string, message: WebSocketMessage): number {
    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        if (this.sendToClient(client.id, message)) {
          sentCount++;
        }
      }
    });
    return sentCount;
  }

  broadcast(message: WebSocketMessage, options: BroadcastOptions = {}): number {
    let sentCount = 0;
    
    this.clients.forEach((client, clientId) => {
      // Skip if excluding specific client
      if (options.excludeClient === clientId) return;
      
      // Skip if filtering by userId
      if (options.userId && client.userId !== options.userId) return;
      
      // Skip if filtering by topic
      if (options.topic && !client.subscriptions.has(options.topic) && !client.subscriptions.has('global')) return;

      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClientInfo(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  getAllClients(): Map<string, WebSocketClient> {
    return new Map(this.clients);
  }

  disconnectClient(clientId: string, reason?: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    if (reason) {
      this.sendToClient(clientId, {
        type: 'disconnect',
        data: { reason }
      });
    }

    client.ws.close();
    this.clients.delete(clientId);
    return true;
  }

  shutdown(): void {
    logger.info('Shutting down WebSocket server...');

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Disconnect all clients
    this.broadcast({
      type: 'server_shutdown',
      data: { message: 'Server is shutting down' }
    });

    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const websocketService = new WebSocketService();