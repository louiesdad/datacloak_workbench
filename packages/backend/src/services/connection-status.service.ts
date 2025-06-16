import { EventEmitter } from 'events';
import { websocketService } from './websocket.service';

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  connectionCount: number;
  uptime: number;
  latency: number | null;
  serverStatus: 'healthy' | 'degraded' | 'down';
  services: {
    database: 'connected' | 'disconnected' | 'error';
    websocket: 'connected' | 'disconnected' | 'error';
    analytics: 'running' | 'stopped' | 'error';
    sentiment: 'running' | 'stopped' | 'error';
  };
  errors: string[];
}

class ConnectionStatusService extends EventEmitter {
  private status: ConnectionStatus;
  private startTime: Date;
  private statusCheckInterval?: NodeJS.Timeout;
  private latencyCheckInterval?: NodeJS.Timeout;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly LATENCY_CHECK_INTERVAL = 10000; // 10 seconds

  constructor() {
    super();
    this.startTime = new Date();
    this.status = {
      isConnected: true,
      lastConnected: new Date(),
      lastDisconnected: null,
      connectionCount: 0,
      uptime: 0,
      latency: null,
      serverStatus: 'healthy',
      services: {
        database: 'connected',
        websocket: 'disconnected',
        analytics: 'stopped',
        sentiment: 'stopped'
      },
      errors: []
    };
  }

  initialize(): void {
    console.log('Connection status service initialized');
    
    // Start periodic status checks
    this.statusCheckInterval = setInterval(() => {
      this.checkAllServices();
    }, this.CHECK_INTERVAL);

    // Start latency monitoring
    this.latencyCheckInterval = setInterval(() => {
      this.checkLatency();
    }, this.LATENCY_CHECK_INTERVAL);

    // Listen to WebSocket events
    this.setupWebSocketListeners();

    // Initial check
    this.checkAllServices();
  }

  shutdown(): void {
    console.log('Connection status service shutting down');
    
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    if (this.latencyCheckInterval) {
      clearInterval(this.latencyCheckInterval);
    }
    
    this.removeAllListeners();
  }

  private setupWebSocketListeners(): void {
    // Listen for WebSocket connection events
    websocketService.on('connection', () => {
      this.updateServiceStatus('websocket', 'connected');
      this.updateConnectionStatus(true);
      this.status.connectionCount++;
      this.emitStatusUpdate();
    });

    websocketService.on('disconnection', () => {
      this.updateServiceStatus('websocket', 'disconnected');
      this.updateConnectionStatus(false);
      this.emitStatusUpdate();
    });

    websocketService.on('error', (error: Error) => {
      this.updateServiceStatus('websocket', 'error');
      this.addError(`WebSocket error: ${error.message}`);
      this.emitStatusUpdate();
    });
  }

  private async checkAllServices(): Promise<void> {
    try {
      // Update uptime
      this.status.uptime = Date.now() - this.startTime.getTime();

      // Check database connection
      await this.checkDatabaseStatus();

      // Check analytics service
      this.checkAnalyticsStatus();

      // Check sentiment service
      this.checkSentimentStatus();

      // Determine overall server status
      this.updateServerStatus();

      this.emitStatusUpdate();
    } catch (error) {
      console.error('Error checking service status:', error);
      this.addError(`Status check failed: ${(error as Error).message}`);
    }
  }

  private async checkDatabaseStatus(): Promise<void> {
    try {
      // Import database here to avoid circular dependencies
      const { getSQLiteConnection } = await import('../database/sqlite');
      const db = getSQLiteConnection();
      
      // Simple health check query
      await new Promise<void>((resolve, reject) => {
        db.get('SELECT 1', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.updateServiceStatus('database', 'connected');
    } catch (error) {
      this.updateServiceStatus('database', 'error');
      this.addError(`Database error: ${(error as Error).message}`);
    }
  }

  private checkAnalyticsStatus(): void {
    try {
      // Check if analytics service is running by checking if it's imported and initialized
      const analyticsService = require('./analytics.service').analyticsService;
      if (analyticsService && analyticsService.isInitialized) {
        this.updateServiceStatus('analytics', 'running');
      } else {
        this.updateServiceStatus('analytics', 'stopped');
      }
    } catch (error) {
      this.updateServiceStatus('analytics', 'error');
      this.addError(`Analytics service error: ${(error as Error).message}`);
    }
  }

  private checkSentimentStatus(): void {
    try {
      // Check if sentiment service is available
      const sentimentService = require('./sentiment.service').sentimentService;
      if (sentimentService) {
        this.updateServiceStatus('sentiment', 'running');
      } else {
        this.updateServiceStatus('sentiment', 'stopped');
      }
    } catch (error) {
      this.updateServiceStatus('sentiment', 'error');
      this.addError(`Sentiment service error: ${(error as Error).message}`);
    }
  }

  private async checkLatency(): Promise<void> {
    try {
      const start = Date.now();
      
      // Simple latency check using database query
      const { getSQLiteConnection } = await import('../database/sqlite');
      const db = getSQLiteConnection();
      
      await new Promise<void>((resolve, reject) => {
        db.get('SELECT 1', (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      this.status.latency = Date.now() - start;
    } catch (error) {
      this.status.latency = null;
      this.addError(`Latency check failed: ${(error as Error).message}`);
    }
  }

  private updateServiceStatus(service: keyof ConnectionStatus['services'], status: string): void {
    this.status.services[service] = status as any;
  }

  private updateConnectionStatus(isConnected: boolean): void {
    const wasConnected = this.status.isConnected;
    this.status.isConnected = isConnected;

    if (isConnected && !wasConnected) {
      this.status.lastConnected = new Date();
    } else if (!isConnected && wasConnected) {
      this.status.lastDisconnected = new Date();
    }
  }

  private updateServerStatus(): void {
    const services = this.status.services;
    const errorCount = Object.values(services).filter(status => status === 'error').length;
    const disconnectedCount = Object.values(services).filter(status => 
      status === 'disconnected' || status === 'stopped'
    ).length;

    if (errorCount > 0) {
      this.status.serverStatus = 'down';
    } else if (disconnectedCount > 1) {
      this.status.serverStatus = 'degraded';
    } else {
      this.status.serverStatus = 'healthy';
    }
  }

  private addError(error: string): void {
    this.status.errors.push(error);
    
    // Keep only the last 50 errors
    if (this.status.errors.length > 50) {
      this.status.errors = this.status.errors.slice(-50);
    }
  }

  private emitStatusUpdate(): void {
    this.emit('status-update', this.getStatus());
    
    // Broadcast to WebSocket clients
    websocketService.broadcast({
      type: 'connection_status',
      data: this.getStatus()
    }, { topic: 'connection_status' });
  }

  public getStatus(): ConnectionStatus {
    return {
      ...this.status,
      uptime: Date.now() - this.startTime.getTime()
    };
  }

  public getConnectionCount(): number {
    return this.status.connectionCount;
  }

  public getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  public getLatency(): number | null {
    return this.status.latency;
  }

  public isHealthy(): boolean {
    return this.status.serverStatus === 'healthy';
  }

  public forceStatusCheck(): Promise<void> {
    return this.checkAllServices();
  }

  public clearErrors(): void {
    this.status.errors = [];
    this.emitStatusUpdate();
  }
}

export const connectionStatusService = new ConnectionStatusService();