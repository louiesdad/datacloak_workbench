import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Increase max listeners for our use case
    
    // Handle errors to prevent uncaught exceptions
    this.on('error', (error) => {
      console.error('EventEmitter error:', error);
    });
  }
}

// Create a singleton event emitter for the application
export const eventEmitter = new AppEventEmitter();

// Define event types for better type safety
export const EventTypes = {
  // Sentiment Analysis Events
  SENTIMENT_PROGRESS: 'sentiment:progress',
  SENTIMENT_COMPLETE: 'sentiment:complete',
  SENTIMENT_ERROR: 'sentiment:error',
  
  // File Processing Events
  FILE_PROGRESS: 'file:progress',
  FILE_COMPLETE: 'file:complete',
  FILE_ERROR: 'file:error',
  
  // PII Detection Events
  PII_DETECTED: 'pii:detected',
  PII_SCAN_COMPLETE: 'pii:scan:complete',
  
  // Job Queue Events
  JOB_CREATED: 'job:created',
  JOB_PROGRESS: 'job:progress',
  JOB_COMPLETE: 'job:complete',
  JOB_FAILED: 'job:failed',
  JOB_CANCELLED: 'job:cancelled',
  JOB_RETRY: 'job:retry',
  
  // System Events
  METRICS_UPDATE: 'metrics:update',
  MEMORY_WARNING: 'memory:warning',
  RATE_LIMIT_EXCEEDED: 'rateLimit:exceeded',
  
  // WebSocket Events
  WS_MESSAGE: 'ws:message',
  WS_CLIENT_CONNECTED: 'ws:client:connected',
  WS_CLIENT_DISCONNECTED: 'ws:client:disconnected',
  
  // Security Events
  SECURITY_ALERT: 'security:alert',
  COMPLIANCE_CHECK: 'compliance:check',
  
  // Analytics Events
  ANALYTICS_UPDATE: 'analytics:update',
  INSIGHTS_GENERATED: 'insights:generated',
} as const;

// Helper function to emit events with consistent structure
export function emitEvent(eventType: string, data: any): void {
  eventEmitter.emit(eventType, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// EventService class for dependency injection
export class EventService {
  private static instance: EventService;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = eventEmitter;
  }

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  emit(event: string, data?: any): void {
    emitEvent(event, data || {});
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    this.emitter.once(event, listener);
  }

  removeAllListeners(event?: string): void {
    this.emitter.removeAllListeners(event);
  }

  getMaxListeners(): number {
    return this.emitter.getMaxListeners();
  }

  setMaxListeners(n: number): void {
    this.emitter.setMaxListeners(n);
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }

  eventNames(): (string | symbol)[] {
    return this.emitter.eventNames();
  }
}