import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

export interface SQLitePoolConfig {
  path: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
  pragmas?: string[];
}

interface PooledConnection {
  db: Database.Database;
  id: number;
  inUse: boolean;
  lastUsed: number;
}

export class SQLiteConnectionPool extends EventEmitter {
  private connections: PooledConnection[] = [];
  private waitingQueue: Array<(conn: Database.Database) => void> = [];
  private config: Required<SQLitePoolConfig>;
  private connectionCounter = 0;
  private cleanupInterval?: NodeJS.Timeout;
  private closed = false;

  constructor(config: SQLitePoolConfig) {
    super();
    
    // Use shorter timeouts in test environment for faster test execution
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
    const defaultIdleTimeout = isTestEnvironment ? 200 : 30000;
    // Increase timeout to prevent connection acquisition failures
    const defaultAcquireTimeout = isTestEnvironment ? 5000 : 30000;
    
    this.config = {
      path: config.path,
      maxConnections: config.maxConnections || 10,
      idleTimeoutMs: config.idleTimeoutMs ?? defaultIdleTimeout,
      acquireTimeoutMs: config.acquireTimeoutMs ?? defaultAcquireTimeout,
      pragmas: config.pragmas || [
        'PRAGMA journal_mode = WAL;',
        'PRAGMA synchronous = NORMAL;',
        'PRAGMA cache_size = 1000000;',
        'PRAGMA foreign_keys = ON;',
        'PRAGMA temp_store = MEMORY;',
        'PRAGMA mmap_size = 30000000000;'
      ]
    };

    this.ensureDbDirectory();
    this.startCleanupInterval();
  }

  private ensureDbDirectory(): void {
    const dbPath = path.resolve(this.config.path);
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  private createConnection(): Database.Database {
    const db = new Database(this.config.path);
    
    for (const pragma of this.config.pragmas) {
      db.exec(pragma);
    }
    
    return db;
  }

  async acquire(): Promise<Database.Database> {
    if (this.closed) {
      throw new Error('Connection pool is closed');
    }

    const availableConn = this.connections.find(c => !c.inUse);
    
    if (availableConn) {
      availableConn.inUse = true;
      availableConn.lastUsed = Date.now();
      this.emit('acquire', availableConn.id);
      return availableConn.db;
    }

    if (this.connections.length < this.config.maxConnections) {
      const db = this.createConnection();
      const conn: PooledConnection = {
        db,
        id: ++this.connectionCounter,
        inUse: true,
        lastUsed: Date.now()
      };
      this.connections.push(conn);
      this.emit('create', conn.id);
      this.emit('acquire', conn.id);
      return db;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve);
        if (index > -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Failed to acquire connection within ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      const wrappedResolve = (conn: Database.Database) => {
        clearTimeout(timeout);
        resolve(conn);
      };

      this.waitingQueue.push(wrappedResolve);
    });
  }

  release(db: Database.Database): void {
    const conn = this.connections.find(c => c.db === db);
    
    if (!conn) {
      throw new Error('Connection not found in pool');
    }

    conn.inUse = false;
    conn.lastUsed = Date.now();
    this.emit('release', conn.id);

    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        conn.inUse = true;
        conn.lastUsed = Date.now();
        this.emit('acquire', conn.id);
        waiting(conn.db);
      }
    }
  }

  async withConnection<T>(fn: (db: Database.Database) => T | Promise<T>): Promise<T> {
    const db = await this.acquire();
    try {
      return await fn(db);
    } finally {
      this.release(db);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: PooledConnection[] = [];

      for (const conn of this.connections) {
        if (!conn.inUse && 
            now - conn.lastUsed > this.config.idleTimeoutMs && 
            this.connections.length > 1) {
          toRemove.push(conn);
        }
      }

      for (const conn of toRemove) {
        const index = this.connections.indexOf(conn);
        if (index > -1) {
          this.connections.splice(index, 1);
          conn.db.close();
          this.emit('close', conn.id);
        }
      }
    }, this.config.idleTimeoutMs / 2);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    
    this.closed = true;
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const waiting of this.waitingQueue) {
      waiting(null as any);
    }
    this.waitingQueue = [];

    for (const conn of this.connections) {
      conn.db.close();
      this.emit('close', conn.id);
    }
    
    this.connections = [];
  }

  getPoolStats() {
    return {
      total: this.connections.length,
      inUse: this.connections.filter(c => c.inUse).length,
      idle: this.connections.filter(c => !c.inUse).length,
      waiting: this.waitingQueue.length
    };
  }
}