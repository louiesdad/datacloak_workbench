import * as duckdb from 'duckdb';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { EventEmitter } from 'events';

interface PooledConnection {
  id: string;
  connection: duckdb.Database;
  isInUse: boolean;
  lastUsed: Date;
  transactionCount: number;
}

interface QueuedOperation {
  sql: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  type: 'query' | 'run';
  timeout: number;
  timestamp: Date;
}

class DuckDBConnectionPool extends EventEmitter {
  private connections: Map<string, PooledConnection> = new Map();
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private readonly maxConnections: number;
  private readonly maxIdleTime: number;
  private readonly operationTimeout: number;
  private readonly dbPath: string;
  private isInitialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    maxConnections = 3,
    maxIdleTime = 300000, // 5 minutes
    operationTimeout = 30000 // 30 seconds
  ) {
    super();
    this.maxConnections = maxConnections;
    this.maxIdleTime = maxIdleTime;
    this.operationTimeout = operationTimeout;
    this.dbPath = path.resolve(config.database.duckdb.path);
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupIdleConnections(), 60000); // 1 minute
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure data directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create initial connection and tables
      await this.createConnection();
      await this.createTables();
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log(`DuckDB connection pool initialized with ${this.maxConnections} max connections`);
    } catch (error) {
      console.error('Failed to initialize DuckDB connection pool:', error);
      throw error;
    }
  }

  private async createConnection(): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const connection = new duckdb.Database(this.dbPath, (err) => {
        if (err) {
          console.error(`Failed to create DuckDB connection ${connectionId}:`, err);
          reject(err);
          return;
        }

        const pooledConnection: PooledConnection = {
          id: connectionId,
          connection,
          isInUse: false,
          lastUsed: new Date(),
          transactionCount: 0
        };

        this.connections.set(connectionId, pooledConnection);
        resolve(pooledConnection);
      });
    });
  }

  private async getAvailableConnection(): Promise<PooledConnection> {
    // Try to find an available connection
    for (const [id, conn] of this.connections) {
      if (!conn.isInUse) {
        conn.isInUse = true;
        conn.lastUsed = new Date();
        return conn;
      }
    }

    // Create new connection if under limit
    if (this.connections.size < this.maxConnections) {
      const newConnection = await this.createConnection();
      newConnection.isInUse = true;
      return newConnection;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        for (const [id, conn] of this.connections) {
          if (!conn.isInUse) {
            clearInterval(checkInterval);
            conn.isInUse = true;
            conn.lastUsed = new Date();
            resolve(conn);
            return;
          }
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available DuckDB connection'));
      }, 10000);
    });
  }

  private releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.isInUse = false;
      connection.lastUsed = new Date();
      connection.transactionCount = Math.max(0, connection.transactionCount - 1);
    }
  }

  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToClose: string[] = [];

    for (const [id, conn] of this.connections) {
      const idleTime = now.getTime() - conn.lastUsed.getTime();
      
      if (!conn.isInUse && 
          idleTime > this.maxIdleTime && 
          this.connections.size > 1 &&
          conn.transactionCount === 0) {
        connectionsToClose.push(id);
      }
    }

    connectionsToClose.forEach(id => {
      const conn = this.connections.get(id);
      if (conn) {
        try {
          conn.connection.close();
          this.connections.delete(id);
          console.log(`Closed idle DuckDB connection: ${id}`);
        } catch (error) {
          console.error(`Error closing DuckDB connection ${id}:`, error);
        }
      }
    });
  }

  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    return this.queueOperation(sql, params, 'query');
  }

  async executeRun(sql: string, params: any[] = []): Promise<void> {
    await this.queueOperation(sql, params, 'run');
  }

  private async queueOperation(sql: string, params: any[], type: 'query' | 'run'): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation: QueuedOperation = {
        sql,
        params,
        resolve,
        reject,
        type,
        timeout: this.operationTimeout,
        timestamp: new Date()
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

        // Check for timeout
        const now = new Date();
        if (now.getTime() - operation.timestamp.getTime() > operation.timeout) {
          operation.reject(new Error('Operation timeout'));
          continue;
        }

        try {
          const connection = await this.getAvailableConnection();
          connection.transactionCount++;

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
          } finally {
            this.releaseConnection(connection.id);
          }
        } catch (error) {
          operation.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private executeQueryWithConnection(
    connection: duckdb.Database, 
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
    connection: duckdb.Database, 
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
    // Use a simple approach without prepared statements for DDL
    const connection = await this.getAvailableConnection();
    
    try {
      // Create main analytics table
      await new Promise<void>((resolve, reject) => {
        connection.connection.run(`
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
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create statistics table
      await new Promise<void>((resolve, reject) => {
        connection.connection.run(`
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
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_created_at ON text_analytics(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_sentiment ON text_analytics(sentiment)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_dataset_id ON text_analytics(dataset_id)',
        'CREATE INDEX IF NOT EXISTS idx_text_analytics_batch_id ON text_analytics(batch_id)',
        'CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_date_bucket ON sentiment_statistics(date_bucket)',
        'CREATE INDEX IF NOT EXISTS idx_sentiment_statistics_sentiment ON sentiment_statistics(sentiment)'
      ];

      for (const indexSQL of indexes) {
        await new Promise<void>((resolve, reject) => {
          connection.connection.run(indexSQL, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      this.releaseConnection(connection.id);
    }
  }

  async getPoolStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    queueLength: number;
    poolHealth: 'healthy' | 'warning' | 'critical';
  }> {
    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values()).filter(c => c.isInUse).length;
    const queueLength = this.operationQueue.length;

    let poolHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (queueLength > 10 || activeConnections === totalConnections) {
      poolHealth = 'warning';
    }
    if (queueLength > 50 || totalConnections === 0) {
      poolHealth = 'critical';
    }

    return {
      totalConnections,
      activeConnections,
      queueLength,
      poolHealth
    };
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
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
    
    console.log('DuckDB connection pool shutdown complete');
  }
}

// Export singleton instance
export const duckDBPool = new DuckDBConnectionPool();

// Export legacy functions for backward compatibility
export const initializeDuckDB = () => duckDBPool.initialize();
export const getDuckDBConnection = () => {
  console.warn('getDuckDBConnection is deprecated. Use duckDBPool.executeQuery/executeRun instead.');
  return null; // Force migration to new API
};
export const queryDuckDB = (sql: string, params: any[] = []) => duckDBPool.executeQuery(sql, params);
export const runDuckDB = (sql: string, params: any[] = []) => duckDBPool.executeRun(sql, params);
export const closeDuckDBConnection = () => duckDBPool.shutdown();