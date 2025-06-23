import { Server } from 'http';
import { WebSocketService } from '../services/websocket.service';
import { SSEService } from '../services/sse.service';
import { closeDatabase } from '../database';
import logger from '../config/logger';

interface ShutdownOptions {
  timeout?: number;
  signals?: string[];
}

export class GracefulShutdown {
  private server: Server;
  private wsService?: WebSocketService;
  private sseService?: SSEService;
  private isShuttingDown = false;
  private shutdownTimeout: number;
  private connections = new Set<any>();

  constructor(
    server: Server,
    wsService?: WebSocketService,
    sseService?: SSEService,
    options: ShutdownOptions = {}
  ) {
    this.server = server;
    this.wsService = wsService;
    this.sseService = sseService;
    this.shutdownTimeout = options.timeout || 30000; // 30 seconds default

    // Track connections
    this.server.on('connection', (connection) => {
      this.connections.add(connection);
      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });

    // Register shutdown handlers
    const signals = options.signals || ['SIGTERM', 'SIGINT'];
    signals.forEach(signal => {
      process.on(signal, () => this.shutdown(signal));
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.shutdown('UNHANDLED_REJECTION');
    });
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.info('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // Set a timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit...');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Step 1: Stop accepting new connections
      logger.info('Stopping server from accepting new connections...');
      await this.closeServer();

      // Step 2: Close WebSocket connections
      if (this.wsService) {
        logger.info('Closing WebSocket connections...');
        this.wsService.shutdown();
      }

      // Step 3: Close SSE connections
      if (this.sseService) {
        logger.info('Closing SSE connections...');
        this.sseService.stopPingInterval();
        // Note: SSE clients will be closed when HTTP connections close
      }

      // Step 4: Close existing HTTP connections
      logger.info('Closing existing HTTP connections...');
      await this.closeConnections();

      // Step 5: Close database connections
      logger.info('Closing database connections...');
      await closeDatabase();

      // Step 6: Clean up any other resources
      logger.info('Cleaning up resources...');
      await this.cleanup();

      clearTimeout(forceShutdownTimer);
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceShutdownTimer);
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  private closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async closeConnections(): Promise<void> {
    // Give connections 5 seconds to close gracefully
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Force close remaining connections
    for (const connection of this.connections) {
      connection.destroy();
    }
    this.connections.clear();
  }

  private async cleanup(): Promise<void> {
    // Add any additional cleanup logic here
    // For example: clearing caches, saving state, etc.
    
    // Clear event listeners
    process.removeAllListeners();
  }

  // Health check endpoint to use during deployment
  public isHealthy(): boolean {
    return !this.isShuttingDown;
  }
}

// Middleware to reject requests during shutdown
export const shutdownMiddleware = (shutdown: GracefulShutdown) => {
  return (req: any, res: any, next: any) => {
    if (!shutdown.isHealthy()) {
      res.status(503).json({
        error: 'Server is shutting down',
        message: 'The server is currently shutting down. Please try again later.'
      });
    } else {
      next();
    }
  };
};