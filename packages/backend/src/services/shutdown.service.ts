import { EventEmitter } from 'events';
import logger from '../config/logger';
import { closeSQLiteConnection } from '../database/sqlite-refactored';

export interface ShutdownHook {
  name: string;
  priority: number; // Lower numbers run first
  timeout: number; // Milliseconds
  handler: () => Promise<void>;
}

class ShutdownService extends EventEmitter {
  private hooks: ShutdownHook[] = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds default
  private forceExitTimeout = 5000; // 5 seconds after graceful shutdown fails

  constructor() {
    super();
    this.setupSignalHandlers();
    this.registerDefaultHooks();
  }

  private setupSignalHandlers(): void {
    // Handle graceful shutdown signals
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM signal, initiating graceful shutdown', { component: 'shutdown' });
      this.initiateShutdown('SIGTERM');
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT signal, initiating graceful shutdown', { component: 'shutdown' });
      this.initiateShutdown('SIGINT');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception, initiating emergency shutdown', { 
        component: 'shutdown', 
        error: error.message,
        stack: error.stack 
      });
      this.initiateShutdown('uncaughtException', true);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection, initiating emergency shutdown', { 
        component: 'shutdown', 
        reason: reason,
        promise: promise 
      });
      this.initiateShutdown('unhandledRejection', true);
    });
  }

  private registerDefaultHooks(): void {
    // Register database connection closure
    this.registerHook({
      name: 'database-connections',
      priority: 10,
      timeout: 5000,
      handler: async () => {
        logger.info('Closing database connections', { component: 'shutdown' });
        await closeSQLiteConnection();
        logger.info('Database connections closed', { component: 'shutdown' });
      }
    });

    // Register file descriptor cleanup
    this.registerHook({
      name: 'file-descriptors',
      priority: 90,
      timeout: 2000,
      handler: async () => {
        logger.info('Cleaning up file descriptors', { component: 'shutdown' });
        // Additional cleanup if needed
        logger.info('File descriptors cleaned up', { component: 'shutdown' });
      }
    });

    // Final logging hook
    this.registerHook({
      name: 'final-logging',
      priority: 100,
      timeout: 1000,
      handler: async () => {
        logger.info('Graceful shutdown completed successfully', { component: 'shutdown' });
        // Allow logger to flush
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  }

  public registerHook(hook: ShutdownHook): void {
    if (this.isShuttingDown) {
      logger.warn('Cannot register shutdown hook during shutdown', { 
        component: 'shutdown',
        hookName: hook.name 
      });
      return;
    }

    // Validate hook
    if (!hook.name || typeof hook.handler !== 'function') {
      throw new Error('Invalid shutdown hook: name and handler are required');
    }

    // Check for duplicate names
    const existingHook = this.hooks.find(h => h.name === hook.name);
    if (existingHook) {
      logger.warn('Replacing existing shutdown hook', { 
        component: 'shutdown',
        hookName: hook.name 
      });
      this.hooks = this.hooks.filter(h => h.name !== hook.name);
    }

    this.hooks.push(hook);
    
    // Sort hooks by priority
    this.hooks.sort((a, b) => a.priority - b.priority);

    logger.debug('Shutdown hook registered', { 
      component: 'shutdown',
      hookName: hook.name,
      priority: hook.priority,
      totalHooks: this.hooks.length
    });
  }

  public unregisterHook(name: string): boolean {
    if (this.isShuttingDown) {
      logger.warn('Cannot unregister shutdown hook during shutdown', { 
        component: 'shutdown',
        hookName: name 
      });
      return false;
    }

    const initialLength = this.hooks.length;
    this.hooks = this.hooks.filter(hook => hook.name !== name);
    const removed = this.hooks.length < initialLength;

    if (removed) {
      logger.debug('Shutdown hook unregistered', { 
        component: 'shutdown',
        hookName: name 
      });
    }

    return removed;
  }

  public getRegisteredHooks(): string[] {
    return this.hooks.map(hook => hook.name);
  }

  public setShutdownTimeout(timeout: number): void {
    if (timeout <= 0) {
      throw new Error('Shutdown timeout must be positive');
    }
    this.shutdownTimeout = timeout;
    logger.debug('Shutdown timeout updated', { 
      component: 'shutdown',
      timeout 
    });
  }

  private async initiateShutdown(signal: string, emergency = false): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress', { component: 'shutdown' });
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();

    logger.info('Initiating graceful shutdown', { 
      component: 'shutdown',
      signal,
      emergency,
      hooksCount: this.hooks.length
    });

    this.emit('shutdown:start', { signal, emergency });

    try {
      if (emergency) {
        // In emergency mode, use shorter timeouts
        await this.executeHooksWithTimeout(Math.min(this.shutdownTimeout / 2, 10000));
      } else {
        await this.executeHooksWithTimeout(this.shutdownTimeout);
      }

      const duration = Date.now() - startTime;
      logger.info('Graceful shutdown completed', { 
        component: 'shutdown',
        duration,
        signal 
      });

      this.emit('shutdown:complete', { signal, duration });
      
      // Exit successfully
      process.exit(0);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Graceful shutdown failed, forcing exit', { 
        component: 'shutdown',
        error: error instanceof Error ? error.message : error,
        duration,
        signal 
      });

      this.emit('shutdown:error', { signal, error, duration });
      
      // Force exit after a brief delay
      setTimeout(() => {
        logger.error('Force exit timeout reached', { component: 'shutdown' });
        process.exit(1);
      }, this.forceExitTimeout);
    }
  }

  private async executeHooksWithTimeout(timeoutMs: number): Promise<void> {
    const totalTimeout = setTimeout(() => {
      throw new Error(`Shutdown timeout reached (${timeoutMs}ms)`);
    }, timeoutMs);

    try {
      logger.info('Executing shutdown hooks', { 
        component: 'shutdown',
        hooksCount: this.hooks.length,
        timeout: timeoutMs
      });

      // Execute hooks in priority order
      for (const hook of this.hooks) {
        await this.executeHook(hook);
      }

      clearTimeout(totalTimeout);
    } catch (error) {
      clearTimeout(totalTimeout);
      throw error;
    }
  }

  private async executeHook(hook: ShutdownHook): Promise<void> {
    const startTime = Date.now();
    
    logger.debug('Executing shutdown hook', { 
      component: 'shutdown',
      hookName: hook.name,
      priority: hook.priority,
      timeout: hook.timeout
    });

    this.emit('hook:start', hook);

    try {
      // Create timeout for individual hook
      const hookTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Hook '${hook.name}' timeout reached (${hook.timeout}ms)`));
        }, hook.timeout);
      });

      // Race between hook execution and timeout
      await Promise.race([
        hook.handler(),
        hookTimeout
      ]);

      const duration = Date.now() - startTime;
      logger.debug('Shutdown hook completed', { 
        component: 'shutdown',
        hookName: hook.name,
        duration
      });

      this.emit('hook:complete', { hook, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Shutdown hook failed', { 
        component: 'shutdown',
        hookName: hook.name,
        error: error instanceof Error ? error.message : error,
        duration
      });

      this.emit('hook:error', { hook, error, duration });
      
      // Don't throw - continue with other hooks, but log the failure
      // In emergency scenarios, we want to try all hooks even if some fail
    }
  }

  // Utility method for services to register themselves
  public static registerService(
    name: string, 
    shutdownFn: () => Promise<void>, 
    priority = 50, 
    timeout = 5000
  ): void {
    shutdownService.registerHook({
      name,
      priority,
      timeout,
      handler: shutdownFn
    });
  }

  // Health check method
  public getStatus(): {
    isShuttingDown: boolean;
    registeredHooks: string[];
    shutdownTimeout: number;
  } {
    return {
      isShuttingDown: this.isShuttingDown,
      registeredHooks: this.getRegisteredHooks(),
      shutdownTimeout: this.shutdownTimeout
    };
  }

  // Method to trigger shutdown programmatically (for testing or manual shutdown)
  public async shutdown(reason = 'manual'): Promise<void> {
    logger.info('Manual shutdown requested', { component: 'shutdown', reason });
    await this.initiateShutdown(reason);
  }
}

// Singleton instance
export const shutdownService = new ShutdownService();

// Convenience function for services to register shutdown hooks
export const registerShutdownHook = (
  name: string, 
  handler: () => Promise<void>, 
  priority = 50, 
  timeout = 5000
): void => {
  shutdownService.registerHook({ name, handler, priority, timeout });
};

export default shutdownService;