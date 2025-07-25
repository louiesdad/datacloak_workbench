/**
 * Server-Sent Events (SSE) Service
 * Handles real-time progress updates for long-running operations
 */

import { Response } from 'express';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface SSEClient {
  id: string;
  response: Response;
  userId?: string;
  createdAt: Date;
  lastPing: Date;
}

export interface SSEEvent {
  id?: string;
  event?: string;
  data: any;
  retry?: number;
}

export class SSEService extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly CLIENT_TIMEOUT = 120000; // 2 minutes

  constructor() {
    super();
    this.startPingInterval();
  }

  /**
   * Register a new SSE client
   */
  addClient(response: Response, userId?: string): string {
    const clientId = uuidv4();
    
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const client: SSEClient = {
      id: clientId,
      response,
      userId,
      createdAt: new Date(),
      lastPing: new Date()
    };

    this.clients.set(clientId, client);

    // Send initial connection event
    this.sendToClient(clientId, {
      event: 'connected',
      data: { clientId, timestamp: new Date() }
    });

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });

    this.emit('client:connected', { clientId, userId });
    return clientId;
  }

  /**
   * Remove a client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.emit('client:disconnected', { clientId, userId: client.userId });
    }
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId: string, event: SSEEvent): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const data = this.formatSSEMessage(event);
      client.response.write(data);
      client.lastPing = new Date();
    } catch (error) {
      // Client disconnected
      this.removeClient(clientId);
    }
  }

  /**
   * Send event to all clients
   */
  broadcast(event: SSEEvent): void;
  broadcast(eventType: string, data: any): void;
  broadcast(eventOrType: SSEEvent | string, data?: any): void {
    let event: SSEEvent;
    if (typeof eventOrType === 'string') {
      event = { event: eventOrType, data };
    } else {
      event = eventOrType;
    }

    const deadClients: string[] = [];

    this.clients.forEach((client, clientId) => {
      try {
        const message = this.formatSSEMessage(event);
        client.response.write(message);
        client.lastPing = new Date();
      } catch (error) {
        deadClients.push(clientId);
      }
    });

    // Remove dead clients
    deadClients.forEach(clientId => this.removeClient(clientId));
  }

  /**
   * Send event to all clients for a specific user
   */
  sendToUser(userId: string, event: SSEEvent): void {
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        this.sendToClient(clientId, event);
      }
    });
  }

  /**
   * Send job progress event
   */
  sendJobProgress(jobId: string, progress: number, message?: string, userId?: string): void {
    const event: SSEEvent = {
      event: 'job:progress',
      data: {
        jobId,
        progress,
        message,
        timestamp: new Date()
      }
    };

    if (userId) {
      this.sendToUser(userId, event);
    } else {
      this.broadcast(event);
    }
  }

  /**
   * Send job status update
   */
  sendJobStatus(jobId: string, status: string, result?: any, error?: string, userId?: string): void {
    const event: SSEEvent = {
      event: 'job:status',
      data: {
        jobId,
        status,
        result,
        error,
        timestamp: new Date()
      }
    };

    if (userId) {
      this.sendToUser(userId, event);
    } else {
      this.broadcast(event);
    }
  }

  /**
   * Send sentiment analysis progress
   */
  sendSentimentProgress(
    analysisId: string,
    current: number,
    total: number,
    currentText?: string,
    userId?: string
  ): void {
    const progress = Math.round((current / total) * 100);
    const event: SSEEvent = {
      event: 'sentiment:progress',
      data: {
        analysisId,
        current,
        total,
        progress,
        currentText: currentText ? currentText.substring(0, 50) + '...' : undefined,
        timestamp: new Date()
      }
    };

    if (userId) {
      this.sendToUser(userId, event);
    } else {
      this.broadcast(event);
    }
  }

  /**
   * Send file processing progress
   */
  sendFileProgress(
    fileId: string,
    bytesProcessed: number,
    totalBytes: number,
    rowsProcessed?: number,
    message?: string,
    userId?: string
  ): void {
    const progress = Math.round((bytesProcessed / totalBytes) * 100);
    const event: SSEEvent = {
      event: 'file:progress',
      data: {
        fileId,
        bytesProcessed,
        totalBytes,
        progress,
        rowsProcessed,
        message,
        timestamp: new Date()
      }
    };

    if (userId) {
      this.sendToUser(userId, event);
    } else {
      this.broadcast(event);
    }
  }

  /**
   * Format SSE message according to spec
   */
  private formatSSEMessage(event: SSEEvent): string {
    let message = '';

    if (event.id) {
      message += `id: ${event.id}\n`;
    }

    if (event.event) {
      message += `event: ${event.event}\n`;
    }

    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }

    // Data must be stringified - handle circular references
    let data: string;
    try {
      data = JSON.stringify(event.data);
    } catch (error) {
      // Handle circular references
      const seen = new WeakSet();
      data = JSON.stringify(event.data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      });
    }
    
    // Handle multi-line data
    const lines = data.split('\n');
    lines.forEach(line => {
      message += `data: ${line}\n`;
    });

    // End with double newline
    message += '\n';

    return message;
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.broadcast({
        event: 'ping',
        data: { timestamp: new Date() }
      });

      // Clean up stale clients
      const now = Date.now();
      const staleClients: string[] = [];

      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing.getTime() > this.CLIENT_TIMEOUT) {
          staleClients.push(clientId);
        }
      });

      staleClients.forEach(clientId => this.removeClient(clientId));
    }, this.PING_INTERVAL);
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Send progress event
   */
  sendProgress(clientId: string, jobId: string, progress: number, message?: string): void {
    const event: SSEEvent = {
      event: 'progress',
      data: {
        jobId,
        progress,
        message,
        timestamp: new Date()
      }
    };
    this.sendToClient(clientId, event);
  }

  /**
   * Send error event
   */
  sendError(clientId: string, jobId: string, error: string): void;
  sendError(error: string, details?: any, userId?: string): void;
  sendError(clientIdOrError: string, jobIdOrDetails?: string | any, errorOrUserId?: string): void {
    if (arguments.length === 3 && typeof jobIdOrDetails === 'string') {
      // sendError(clientId, jobId, error)
      const event: SSEEvent = {
        event: 'error',
        data: {
          jobId: jobIdOrDetails,
          error: errorOrUserId,
          timestamp: new Date()
        }
      };
      this.sendToClient(clientIdOrError, event);
    } else {
      // sendError(error, details?, userId?)
      const event: SSEEvent = {
        event: 'error',
        data: {
          error: clientIdOrError,
          details: jobIdOrDetails,
          timestamp: new Date()
        }
      };

      if (errorOrUserId) {
        this.sendToUser(errorOrUserId, event);
      } else {
        this.broadcast(event);
      }
    }
  }

  /**
   * Send complete event
   */
  sendComplete(clientId: string, jobId: string, result: any): void {
    const event: SSEEvent = {
      event: 'complete',
      data: {
        jobId,
        result,
        timestamp: new Date()
      }
    };
    this.sendToClient(clientId, event);
  }

  /**
   * Get all clients info
   */
  getClients(): Array<{
    id: string;
    userId?: string;
    connected: boolean;
    connectedAt: Date;
  }> {
    const clients: any[] = [];
    this.clients.forEach((client, id) => {
      clients.push({
        id,
        userId: client.userId,
        connected: true,
        connectedAt: client.createdAt
      });
    });
    return clients;
  }

  /**
   * Get clients for a user
   */
  getUserClients(userId: string): SSEClient[] {
    const userClients: SSEClient[] = [];
    this.clients.forEach(client => {
      if (client.userId === userId) {
        userClients.push(client);
      }
    });
    return userClients;
  }

  /**
   * Stop ping interval
   */
  stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      try {
        client.response.end();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });

    this.clients.clear();
  }
}

// Singleton instance
let sseService: SSEService | null = null;

export function getSSEService(): SSEService {
  if (!sseService) {
    sseService = new SSEService();
  }
  return sseService;
}