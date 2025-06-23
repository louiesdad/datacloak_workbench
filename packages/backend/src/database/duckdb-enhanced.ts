import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { config } from '../config/env';
import { withSQLiteConnection } from './sqlite-refactored';

// Dynamic import to handle missing native dependencies
let duckdb: any = null;
try {
  duckdb = require('duckdb');
} catch (error) {
  console.warn('DuckDB native module not available, analytics will use SQLite fallback');
}

export interface DuckDBConfig {
  path: string;
  maxConnections?: number;
  maxIdleTime?: number;
  operationTimeout?: number;
  enableFallback?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

interface PooledDuckDBConnection {
  id: string;
  connection: any; // DuckDB Database instance
  isInUse: boolean;
  lastUsed: Date;
  isHealthy: boolean;
  errorCount: number;
}

interface QueuedOperation {
  sql: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  type: 'query' | 'run';
  timeout: number;
  timestamp: Date;
  retryCount: number;
}

export class EnhancedDuckDBService extends EventEmitter {
  private connections: Map<string, PooledDuckDBConnection> = new Map();
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private config: Required<DuckDBConfig>;
  private isInitialized = false;
  private initializationError: Error | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly fallbackEnabled: boolean;

  constructor(userConfig: DuckDBConfig) {
    super();
    this.config = {
      path: userConfig.path,
      maxConnections: userConfig.maxConnections || 3,
      maxIdleTime: userConfig.maxIdleTime || 300000,
      operationTimeout: userConfig.operationTimeout || 30000,
      enableFallback: userConfig.enableFallback ?? true,
      retryAttempts: userConfig.retryAttempts || 3,
      retryDelay: userConfig.retryDelay || 1000
    };
    
    this.fallbackEnabled = this.config.enableFallback;
    
    this.startPeriodicTasks();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationError) {
      throw this.initializationError;
    }

    if (process.env.SKIP_DUCKDB === 'true' || !duckdb) {
      console.log('DuckDB initialization skipped due to SKIP_DUCKDB flag or missing native module');
      if (!duckdb && this.fallbackEnabled) {
        this.emit('fallback-enabled', new Error('DuckDB native module not available'));
      }
      return;
    }

    try {
      await this.ensureDbDirectory();
      await this.createInitialConnection();
      await this.createTables();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log(`Enhanced DuckDB service initialized with ${this.config.maxConnections} max connections`);
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to initialize DuckDB service:', this.initializationError);
      
      if (this.fallbackEnabled) {
        console.log('DuckDB initialization failed, analytics will fall back to SQLite');
        this.emit('fallback-enabled', this.initializationError);
      } else {
        throw this.initializationError;
      }
    }
  }

  private async ensureDbDirectory(): Promise<void> {
    const dbDir = path.dirname(this.config.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  private async createInitialConnection(): Promise<void> {
    await this.createConnection();
  }

  private async createConnection(): Promise<PooledDuckDBConnection> {
    return new Promise((resolve, reject) => {
      if (!duckdb) {
        reject(new Error('DuckDB native module not available'));
        return;
      }
      
      const connectionId = `duckdb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const connection = new duckdb(this.config.path, (err) => {
        if (err) {
          console.error(`Failed to create DuckDB connection ${connectionId}:`, err);
          reject(err);
          return;
        }

        const pooledConnection: PooledDuckDBConnection = {
          id: connectionId,
          connection,
          isInUse: false,
          lastUsed: new Date(),
          isHealthy: true,
          errorCount: 0
        };

        this.connections.set(connectionId, pooledConnection);
        this.emit('connection-created', connectionId);
        resolve(pooledConnection);
      });
    });
  }

  private async getAvailableConnection(): Promise<PooledDuckDBConnection> {
    if (!this.isInitialized && !this.initializationError) {
      throw new Error('DuckDB service not initialized');
    }

    if (this.initializationError) {
      throw this.initializationError;
    }

    for (const [id, conn] of this.connections) {
      if (!conn.isInUse && conn.isHealthy) {
        conn.isInUse = true;
        conn.lastUsed = new Date();
        return conn;
      }
    }

    if (this.connections.size < this.config.maxConnections) {
      const newConnection = await this.createConnection();
      newConnection.isInUse = true;
      return newConnection;
    }

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        for (const [id, conn] of this.connections) {
          if (!conn.isInUse && conn.isHealthy) {
            clearInterval(checkInterval);
            conn.isInUse = true;
            conn.lastUsed = new Date();
            resolve(conn);
            return;
          }
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available DuckDB connection'));
      }, 10000);
    });
  }

  private releaseConnection(connectionId: string, hadError: boolean = false): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isInUse = false;
      connection.lastUsed = new Date();
      
      if (hadError) {
        connection.errorCount++;
        if (connection.errorCount > 5) {
          connection.isHealthy = false;
          this.emit('connection-unhealthy', connectionId);
        }
      } else {
        connection.errorCount = Math.max(0, connection.errorCount - 1);
      }
    }
  }

  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.isInitialized && this.fallbackEnabled && this.initializationError) {
      return this.fallbackToSQLite(sql, params, 'query');
    }

    return this.queueOperation(sql, params, 'query');
  }

  async executeRun(sql: string, params: any[] = []): Promise<void> {
    if (!this.isInitialized && this.fallbackEnabled && this.initializationError) {
      await this.fallbackToSQLite(sql, params, 'run');
      return;
    }

    await this.queueOperation(sql, params, 'run');
  }

  private async fallbackToSQLite(sql: string, params: any[], type: 'query' | 'run'): Promise<any> {
    console.warn('Using SQLite fallback for DuckDB operation');
    this.emit('fallback-used', { sql, type });

    const convertedSQL = this.convertDuckDBToSQLite(sql);
    
    return withSQLiteConnection(async (db) => {
      if (type === 'query') {
        const stmt = db.prepare(convertedSQL);
        return stmt.all(...params);
      } else {
        const stmt = db.prepare(convertedSQL);
        return stmt.run(...params);
      }
    });
  }

  private convertDuckDBToSQLite(sql: string): string {
    return sql
      .replace(/\bUUID\b/gi, 'TEXT')
      .replace(/\bBIGINT\b/gi, 'INTEGER')
      .replace(/\bDOUBLE\b/gi, 'REAL')
      .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
      .replace(/\bVARCHAR\b/gi, 'TEXT')
      .replace(/\bgen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))")
      .replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP');
  }

  private async queueOperation(sql: string, params: any[], type: 'query' | 'run'): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation: QueuedOperation = {
        sql,
        params,
        resolve,
        reject,
        type,
        timeout: this.config.operationTimeout,
        timestamp: new Date(),
        retryCount: 0
      };

      this.operationQueue.push(operation);
      
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift();
        if (!operation) continue;

        const now = new Date();
        if (now.getTime() - operation.timestamp.getTime() > operation.timeout) {
          operation.reject(new Error('Operation timeout'));
          continue;
        }

        await this.executeOperation(operation);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    try {
      const connection = await this.getAvailableConnection();
      let hadError = false;

      try {
        if (operation.type === 'query') {
          const result = await this.executeQueryWithConnection(
            connection.connection, 
            operation.sql, 
            operation.params
          );
          operation.resolve(result);
        } else {
          await this.executeRunWithConnection(
            connection.connection, 
            operation.sql, 
            operation.params
          );
          operation.resolve(undefined);
        }
      } catch (error) {
        hadError = true;
        
        if (operation.retryCount < this.config.retryAttempts) {
          operation.retryCount++;
          console.warn(`Retrying operation (${operation.retryCount}/${this.config.retryAttempts}):`, error);
          
          setTimeout(() => {
            this.operationQueue.unshift(operation);
            if (!this.isProcessingQueue) {
              this.processQueue();
            }
          }, this.config.retryDelay);
        } else if (this.fallbackEnabled) {
          try {
            const result = await this.fallbackToSQLite(operation.sql, operation.params, operation.type);
            operation.resolve(result);
          } catch (fallbackError) {
            operation.reject(fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
          }
        } else {
          operation.reject(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        this.releaseConnection(connection.id, hadError);
      }
    } catch (error) {
      if (this.fallbackEnabled) {
        try {
          const result = await this.fallbackToSQLite(operation.sql, operation.params, operation.type);
          operation.resolve(result);
        } catch (fallbackError) {
          operation.reject(fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
        }
      } else {
        operation.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private executeQueryWithConnection(
    connection: any, 
    sql: string, 
    params: any[]
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      connection.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  private executeRunWithConnection(
    connection: any, 
    sql: string, 
    params: any[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.run(sql, params, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    const connection = await this.getAvailableConnection();
    
    try {
      await this.executeRunWithConnection(connection.connection, `
        CREATE TABLE IF NOT EXISTS text_analytics (
          id VARCHAR PRIMARY KEY,
          text VARCHAR NOT NULL,
          sentiment VARCHAR,
          score DOUBLE,
          confidence DOUBLE,
          keywords VARCHAR,
          language VARCHAR,
          word_count INTEGER,
          char_count INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          dataset_id VARCHAR,
          batch_id VARCHAR
        )
      `, []);

      await this.executeRunWithConnection(connection.connection, `
        CREATE TABLE IF NOT EXISTS sentiment_statistics (
          id VARCHAR PRIMARY KEY,
          date_bucket DATE,
          sentiment VARCHAR,
          count BIGINT,
          avg_score DOUBLE,
          avg_confidence DOUBLE,
          dataset_id VARCHAR,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_created_at ON text_analytics(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_sentiment ON text_analytics(sentiment)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_dataset_id ON text_analytics(dataset_id)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_batch_id ON text_analytics(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_date_bucket ON sentiment_statistics(date_bucket)',
        'CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_sentiment ON sentiment_statistics(sentiment)'
      ];

      for (const indexSQL of indexes) {
        await this.executeRunWithConnection(connection.connection, indexSQL, []);
      }
    } finally {
      this.releaseConnection(connection.id);
    }
  }

  private startPeriodicTasks(): void {
    this.cleanupInterval = setInterval(() => this.cleanupIdleConnections(), 60000);
    this.healthCheckInterval = setInterval(() => this.performHealthCheck(), 120000);
  }

  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToClose: string[] = [];

    for (const [id, conn] of this.connections) {
      const idleTime = now.getTime() - conn.lastUsed.getTime();
      
      if (!conn.isInUse && 
          (idleTime > this.config.maxIdleTime || !conn.isHealthy) && 
          this.connections.size > 1) {
        connectionsToClose.push(id);
      }
    }

    connectionsToClose.forEach(id => {
      const conn = this.connections.get(id);
      if (conn) {
        try {
          conn.connection.close();
          this.connections.delete(id);
          this.emit('connection-closed', id);
        } catch (error) {
          console.error(`Error closing DuckDB connection ${id}:`, error);
        }
      }
    });
  }

  private async performHealthCheck(): Promise<void> {
    for (const [id, conn] of this.connections) {
      if (!conn.isInUse) {
        try {
          await this.executeQueryWithConnection(conn.connection, 'SELECT 1 as health_check', []);
          conn.isHealthy = true;
          conn.errorCount = 0;
        } catch (error) {
          conn.isHealthy = false;
          conn.errorCount++;
          this.emit('health-check-failed', { id, error });
        }
      }
    }
  }

  getServiceStats() {
    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isInUse).length;
    const healthyConnections = Array.from(this.connections.values()).filter(c => c.isHealthy).length;
    const queueLength = this.operationQueue.length;
    
    return {
      isInitialized: this.isInitialized,
      hasInitializationError: !!this.initializationError,
      fallbackEnabled: this.fallbackEnabled,
      totalConnections,
      activeConnections,
      healthyConnections,
      queueLength,
      poolHealth: this.getPoolHealth(totalConnections, healthyConnections, queueLength)
    };
  }

  private getPoolHealth(
    totalConnections: number,
    healthyConnections: number,
    queueLength: number
  ): 'healthy' | 'warning' | 'critical' {
    if (!this.isInitialized || totalConnections === 0) {
      return 'critical';
    }
    
    if (queueLength > 50 || healthyConnections === 0) {
      return 'critical';
    }
    
    if (queueLength > 10 || healthyConnections < totalConnections / 2) {
      return 'warning';
    }
    
    return 'healthy';
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    for (const [id, conn] of this.connections) {
      try {
        conn.connection.close();
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
    }

    this.connections.clear();
    this.operationQueue.length = 0;
    this.isInitialized = false;
    this.initializationError = null;
    
    this.emit('shutdown');
    console.log('Enhanced DuckDB service shutdown complete');
  }
}

const duckDBConfig: DuckDBConfig = {
  path: path.resolve(config.database.duckdb.path),
  maxConnections: 3,
  maxIdleTime: 300000,
  operationTimeout: 30000,
  enableFallback: true,
  retryAttempts: 3,
  retryDelay: 1000
};

export const enhancedDuckDBService = new EnhancedDuckDBService(duckDBConfig);

export const initializeDuckDB = () => enhancedDuckDBService.initialize();
export const queryDuckDB = (sql: string, params: any[] = []) => enhancedDuckDBService.executeQuery(sql, params);
export const runDuckDB = (sql: string, params: any[] = []) => enhancedDuckDBService.executeRun(sql, params);
export const closeDuckDBConnection = () => enhancedDuckDBService.shutdown();
export const getDuckDBStats = () => enhancedDuckDBService.getServiceStats();