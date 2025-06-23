import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { websocketService } from './websocket.service';
import { eventEmitter, EventTypes } from './event.service';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import readline from 'readline';

export interface LogStreamOptions {
  userId?: string;
  sessionId?: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  source?: string;
  startTime?: Date;
  endTime?: Date;
  tail?: number;
  follow?: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: string;
  source: string;
  message: string;
  metadata?: any;
  sessionId?: string;
  userId?: string;
}

export interface LogStream {
  id: string;
  options: LogStreamOptions;
  active: boolean;
  clientId: string;
  startedAt: Date;
  lastActivity: Date;
  entriesStreamed: number;
}

export class LogStreamingService extends EventEmitter {
  private streams = new Map<string, LogStream>();
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 10000;
  private logDir: string;
  private activeFileStreams = new Map<string, fs.ReadStream>();

  constructor() {
    super();
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.setupLogCapture();
    this.setupWebSocketHandlers();
  }

  private setupLogCapture(): void {
    // Intercept console methods to capture logs
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };

    ['log', 'error', 'warn', 'info', 'debug'].forEach((method) => {
      (console as any)[method] = (...args: any[]) => {
        // Call original method
        (originalConsole as any)[method](...args);
        
        // Capture to buffer
        this.captureLog(method === 'log' ? 'info' : method, args);
      };
    });

    // Listen to logger events
    if (logger.on) {
      logger.on('data', (info: any) => {
        this.captureLog(info.level || 'info', [info.message], info);
      });
    }
  }

  private captureLog(level: string, args: any[], metadata?: any): void {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      source: this.getCallSource(),
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '),
      metadata
    };

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Stream to active subscribers
    this.streamToSubscribers(entry);
  }

  private getCallSource(): string {
    try {
      const stack = new Error().stack?.split('\n');
      if (stack && stack.length > 4) {
        const match = stack[4].match(/at\s+(.+?)\s+\(/);
        return match ? match[1] : 'unknown';
      }
    } catch {
      // Ignore errors
    }
    return 'unknown';
  }

  private streamToSubscribers(entry: LogEntry): void {
    this.streams.forEach((stream) => {
      if (!stream.active) return;

      // Apply filters
      if (stream.options.level && 
          this.getLogLevelPriority(entry.level) < this.getLogLevelPriority(stream.options.level)) {
        return;
      }

      if (stream.options.source && !entry.source.includes(stream.options.source)) {
        return;
      }

      if (stream.options.userId && entry.userId !== stream.options.userId) {
        return;
      }

      if (stream.options.sessionId && entry.sessionId !== stream.options.sessionId) {
        return;
      }

      if (stream.options.startTime && entry.timestamp < stream.options.startTime) {
        return;
      }

      if (stream.options.endTime && entry.timestamp > stream.options.endTime) {
        return;
      }

      // Send to client
      websocketService.sendToClient(stream.clientId, {
        type: 'log_entry',
        data: {
          streamId: stream.id,
          entry
        }
      });

      stream.lastActivity = new Date();
      stream.entriesStreamed++;
    });
  }

  private getLogLevelPriority(level: string): number {
    const priorities: Record<string, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    return priorities[level] || 2;
  }

  private setupWebSocketHandlers(): void {
    // Listen for WebSocket messages
    eventEmitter.on('ws:message', ({ clientId, message }: any) => {
      switch (message.type) {
        case 'start_log_stream':
          this.startStream(clientId, message.data?.options || {});
          break;
        case 'stop_log_stream':
          this.stopStream(message.data?.streamId);
          break;
        case 'pause_log_stream':
          this.pauseStream(message.data?.streamId);
          break;
        case 'resume_log_stream':
          this.resumeStream(message.data?.streamId);
          break;
      }
    });

    // Clean up streams when client disconnects
    eventEmitter.on(EventTypes.WS_CLIENT_DISCONNECTED, ({ clientId }: any) => {
      this.streams.forEach((stream, streamId) => {
        if (stream.clientId === clientId) {
          this.stopStream(streamId);
        }
      });
    });
  }

  startStream(clientId: string, options: LogStreamOptions): string {
    const streamId = uuidv4();
    const stream: LogStream = {
      id: streamId,
      options,
      active: true,
      clientId,
      startedAt: new Date(),
      lastActivity: new Date(),
      entriesStreamed: 0
    };

    this.streams.set(streamId, stream);

    // Subscribe to log topic
    websocketService.subscribeToTopic(clientId, 'logs', { streamId });

    // Send initial response
    websocketService.sendToClient(clientId, {
      type: 'log_stream_started',
      data: {
        streamId,
        options
      }
    });

    // Send historical logs if requested
    if (options.tail && options.tail > 0) {
      this.sendHistoricalLogs(stream);
    }

    // If following a log file, start tailing
    if (options.follow && options.source?.startsWith('file:')) {
      this.startFileTailing(stream);
    }

    logger.info(`Log stream started: ${streamId}`);
    return streamId;
  }

  private sendHistoricalLogs(stream: LogStream): void {
    const tail = stream.options.tail || 100;
    const historicalLogs = this.logBuffer
      .filter(entry => this.matchesFilters(entry, stream.options))
      .slice(-tail);

    historicalLogs.forEach((entry) => {
      websocketService.sendToClient(stream.clientId, {
        type: 'log_entry',
        data: {
          streamId: stream.id,
          entry,
          historical: true
        }
      });
      stream.entriesStreamed++;
    });
  }

  private matchesFilters(entry: LogEntry, options: LogStreamOptions): boolean {
    if (options.level && 
        this.getLogLevelPriority(entry.level) < this.getLogLevelPriority(options.level)) {
      return false;
    }

    if (options.source && !entry.source.includes(options.source)) {
      return false;
    }

    if (options.userId && entry.userId !== options.userId) {
      return false;
    }

    if (options.sessionId && entry.sessionId !== options.sessionId) {
      return false;
    }

    if (options.startTime && entry.timestamp < options.startTime) {
      return false;
    }

    if (options.endTime && entry.timestamp > options.endTime) {
      return false;
    }

    return true;
  }

  private async startFileTailing(stream: LogStream): Promise<void> {
    const fileName = stream.options.source?.replace('file:', '');
    if (!fileName) return;

    const filePath = path.join(this.logDir, fileName);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        websocketService.sendToClient(stream.clientId, {
          type: 'log_stream_error',
          data: {
            streamId: stream.id,
            error: `Log file not found: ${fileName}`
          }
        });
        return;
      }

      // Create read stream
      const fileStream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        start: 0
      });

      this.activeFileStreams.set(stream.id, fileStream);

      // Use readline to process line by line
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineNumber = 0;
      rl.on('line', (line) => {
        if (!stream.active) {
          rl.close();
          return;
        }

        lineNumber++;
        
        // Parse log line (assuming JSON format)
        try {
          const entry = this.parseLogLine(line, fileName, lineNumber);
          if (entry && this.matchesFilters(entry, stream.options)) {
            this.streamToSubscribers(entry);
          }
        } catch (error) {
          // If not JSON, send as plain text
          const entry: LogEntry = {
            id: uuidv4(),
            timestamp: new Date(),
            level: 'info',
            source: `file:${fileName}:${lineNumber}`,
            message: line
          };
          this.streamToSubscribers(entry);
        }
      });

      rl.on('close', () => {
        if (stream.options.follow && stream.active) {
          // Continue watching for new lines
          this.watchFile(stream, filePath);
        }
      });

    } catch (error) {
      logger.error(`Error tailing log file ${fileName}:`, error);
      websocketService.sendToClient(stream.clientId, {
        type: 'log_stream_error',
        data: {
          streamId: stream.id,
          error: `Failed to tail log file: ${error.message}`
        }
      });
    }
  }

  private parseLogLine(line: string, fileName: string, lineNumber: number): LogEntry | null {
    try {
      const parsed = JSON.parse(line);
      return {
        id: parsed.id || uuidv4(),
        timestamp: new Date(parsed.timestamp || Date.now()),
        level: parsed.level || 'info',
        source: parsed.source || `file:${fileName}:${lineNumber}`,
        message: parsed.message || line,
        metadata: parsed.metadata,
        sessionId: parsed.sessionId,
        userId: parsed.userId
      };
    } catch {
      return null;
    }
  }

  private watchFile(stream: LogStream, filePath: string): void {
    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change' && stream.active) {
        // Read new content
        const stats = fs.statSync(filePath);
        const start = this.activeFileStreams.get(stream.id)?.readableLength || 0;
        
        const newStream = fs.createReadStream(filePath, {
          encoding: 'utf8',
          start
        });

        const rl = readline.createInterface({
          input: newStream,
          crlfDelay: Infinity
        });

        rl.on('line', (line) => {
          if (!stream.active) {
            rl.close();
            watcher.close();
            return;
          }

          const entry = this.parseLogLine(line, path.basename(filePath), 0);
          if (entry && this.matchesFilters(entry, stream.options)) {
            this.streamToSubscribers(entry);
          }
        });
      }
    });

    // Store watcher reference for cleanup
    (stream as any).fileWatcher = watcher;
  }

  stopStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream) return false;

    stream.active = false;

    // Clean up file resources
    const fileStream = this.activeFileStreams.get(streamId);
    if (fileStream) {
      fileStream.destroy();
      this.activeFileStreams.delete(streamId);
    }

    // Clean up file watcher
    if ((stream as any).fileWatcher) {
      (stream as any).fileWatcher.close();
    }

    // Unsubscribe from topic
    websocketService.unsubscribeFromTopic(stream.clientId, 'logs');

    // Send confirmation
    websocketService.sendToClient(stream.clientId, {
      type: 'log_stream_stopped',
      data: {
        streamId,
        entriesStreamed: stream.entriesStreamed,
        duration: Date.now() - stream.startedAt.getTime()
      }
    });

    this.streams.delete(streamId);
    logger.info(`Log stream stopped: ${streamId}`);
    return true;
  }

  pauseStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.active) return false;

    stream.active = false;
    
    websocketService.sendToClient(stream.clientId, {
      type: 'log_stream_paused',
      data: { streamId }
    });

    return true;
  }

  resumeStream(streamId: string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || stream.active) return false;

    stream.active = true;
    stream.lastActivity = new Date();
    
    websocketService.sendToClient(stream.clientId, {
      type: 'log_stream_resumed',
      data: { streamId }
    });

    return true;
  }

  getStreamInfo(streamId: string): LogStream | undefined {
    return this.streams.get(streamId);
  }

  getAllStreams(): LogStream[] {
    return Array.from(this.streams.values());
  }

  getStreamStats(): {
    activeStreams: number;
    totalEntriesStreamed: number;
    bufferSize: number;
    clientCount: number;
  } {
    let totalEntriesStreamed = 0;
    let activeStreams = 0;

    this.streams.forEach((stream) => {
      if (stream.active) activeStreams++;
      totalEntriesStreamed += stream.entriesStreamed;
    });

    return {
      activeStreams,
      totalEntriesStreamed,
      bufferSize: this.logBuffer.length,
      clientCount: this.streams.size
    };
  }

  // Clean up resources
  shutdown(): void {
    // Stop all active streams
    this.streams.forEach((stream) => {
      this.stopStream(stream.id);
    });

    // Clear buffer
    this.logBuffer = [];

    // Remove event listeners
    this.removeAllListeners();
  }
}

export const logStreamingService = new LogStreamingService();