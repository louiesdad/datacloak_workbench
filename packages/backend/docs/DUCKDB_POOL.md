# DuckDB Connection Pool

## Overview

The DuckDB connection pool provides safe, concurrent access to the DuckDB analytics database. It replaces the single global connection with a managed pool that handles concurrent operations, prevents lock conflicts, and provides monitoring capabilities.

## Features

- **Connection Pooling**: Up to 3 concurrent connections with automatic management
- **Operation Queuing**: Serialized operations to prevent database locks
- **Health Monitoring**: Real-time pool status and performance metrics
- **Automatic Cleanup**: Idle connection cleanup and resource management
- **SQL Injection Protection**: Prepared statements for all operations
- **Graceful Fallback**: Non-blocking analytics operations

## Usage

### Basic Operations

```typescript
import { duckDBPool, runDuckDB, queryDuckDB } from '../database/duckdb-pool';

// Execute a query
const results = await queryDuckDB('SELECT * FROM text_analytics WHERE sentiment = ?', ['positive']);

// Execute a statement
await runDuckDB('INSERT INTO text_analytics (text, sentiment, score) VALUES (?, ?, ?)', [text, sentiment, score]);

// Direct pool access
await duckDBPool.executeQuery('SELECT COUNT(*) FROM text_analytics');
await duckDBPool.executeRun('UPDATE text_analytics SET processed = true WHERE id = ?', [id]);
```

### Pool Health Monitoring

```typescript
const stats = await duckDBPool.getPoolStats();
console.log(stats);
/*
{
  totalConnections: 2,
  activeConnections: 1,
  queueLength: 3,
  poolHealth: 'healthy' | 'warning' | 'critical'
}
*/
```

### Health Endpoint

Monitor pool status via REST API:

```bash
curl http://localhost:3001/api/health/duckdb-pool
```

Response:
```json
{
  "status": "success",
  "timestamp": "2025-01-14T10:30:00.000Z",
  "pool": {
    "totalConnections": 2,
    "activeConnections": 0,
    "queueLength": 0,
    "poolHealth": "healthy"
  },
  "recommendations": {}
}
```

## Configuration

### Pool Settings

- **Max Connections**: 3 (configurable)
- **Max Idle Time**: 5 minutes (300,000ms)
- **Operation Timeout**: 30 seconds (30,000ms)
- **Cleanup Interval**: 1 minute

### Environment Variables

```bash
# Database path (inherited from existing config)
DUCKDB_PATH=./data/analytics.duckdb
NODE_ENV=production  # Disables analytics in test mode
```

## Architecture

### Connection Lifecycle

1. **Initialization**: Pool creates initial connection and database tables
2. **Operation Request**: Client requests database operation
3. **Queue Management**: Operation added to queue if no connections available
4. **Execution**: Available connection processes operation with prepared statements
5. **Release**: Connection returned to pool for reuse
6. **Cleanup**: Idle connections closed after timeout

### Concurrency Handling

- **Queue-based Processing**: Operations processed sequentially to prevent locks
- **Connection Reuse**: Efficient connection management reduces overhead
- **Transaction Tracking**: Monitors active transactions per connection
- **Graceful Degradation**: Analytics failures don't block main operations

## Migration Guide

### From Old API

```typescript
// OLD - Direct connection (causes lock conflicts)
import { getDuckDBConnection, runDuckDB } from '../database/duckdb';
const db = getDuckDBConnection();
await db.run(`INSERT INTO table VALUES ('${unsafe}')`);  // SQL injection risk

// NEW - Connection pool (safe and concurrent)
import { runDuckDB } from '../database/duckdb-pool';
await runDuckDB('INSERT INTO table VALUES (?)', [safe]);  // Prepared statement
```

### Backward Compatibility

The new pool exports compatible functions:
- `runDuckDB()` - Executes statements with parameters
- `queryDuckDB()` - Executes queries with parameters  
- `initializeDuckDB()` - Initializes the pool
- `closeDuckDBConnection()` - Shuts down the pool

## Performance Benefits

- **Reduced Lock Conflicts**: Eliminated "file locked by another process" errors
- **Better Concurrency**: Multiple operations can be queued safely
- **Resource Efficiency**: Automatic cleanup prevents connection leaks
- **Monitoring**: Real-time visibility into database performance
- **Security**: Prepared statements prevent SQL injection

## Troubleshooting

### Common Issues

1. **Pool Exhaustion**: Monitor `/api/health/duckdb-pool` for `poolHealth: 'warning'`
2. **Queue Buildup**: Check `queueLength` - may indicate slow queries
3. **Connection Timeouts**: Operations timeout after 30 seconds

### Debug Logging

```typescript
// Enable detailed logging
duckDBPool.on('initialized', () => console.log('Pool ready'));
duckDBPool.on('error', (error) => console.error('Pool error:', error));
```

### Health Check Integration

```typescript
// In your monitoring system
const health = await duckDBPool.getPoolStats();
if (health.poolHealth !== 'healthy') {
  // Alert or scale resources
}
```