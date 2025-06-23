# Data Pipeline Architecture

## Overview

The data pipeline architecture provides a robust, scalable solution for ingesting, validating, transforming, and storing data from various sources. It's designed with modularity, error recovery, and performance in mind.

## Architecture Components

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Data Sources  │────▶│  File Streaming  │────▶│   CSV/Excel      │
│  (CSV, Excel)   │     │     Service      │     │     Parsers      │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    Analytics    │◀────│   Data Storage   │◀────│  Data Validation │
│    (DuckDB)     │     │ (SQLite/DuckDB)  │     │  & Transformation│
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Event Emitters  │
                        │ (Progress, Logs) │
                        └──────────────────┘
```

## Core Services

### 1. File Streaming Service
- **Purpose**: Handle large file processing without memory overflow
- **Features**:
  - Chunk-based processing
  - Progress tracking
  - Backpressure handling
  - Multi-format support (CSV, Excel)
- **Key Methods**:
  - `streamProcessFile()`: Main streaming interface
  - `getFileChunks()`: Manual chunk processing
  - `estimateMemoryUsage()`: Resource planning

### 2. Data Parsers

#### CSV Parser (PapaParse Adapter)
- Automatic delimiter detection
- Flexible parsing options
- Streaming support for large files
- Field statistics analysis

#### Excel Parser (XLSX)
- Sheet-by-sheet processing
- Data type preservation
- Memory-efficient for large workbooks

### 3. Data Validation Service
- **Schema-based validation**
- **Built-in validators**: email, URL, phone, date, number, regex
- **Custom validators** for domain-specific rules
- **Data transformations**:
  - String normalization
  - HTML sanitization
  - Type conversions
  - Default values
- **Detailed reporting** with field-level statistics

### 4. Database Layer

#### SQLite (Primary Storage)
- Connection pooling for performance
- Migration system for schema evolution
- Transaction support
- Optimized for writes

#### DuckDB (Analytics)
- Columnar storage for fast analytics
- SQL-compatible queries
- Integration with SQLite data
- Optimized for reads

### 5. Migration System
- Version control for database schemas
- Rollback capabilities
- Checksum validation
- Automatic migration on startup

## Data Flow

### 1. Ingestion Flow
```
File Upload → Validation → Parsing → Transformation → Storage → Analytics
```

1. **File Upload**: Files are uploaded through the REST API
2. **Validation**: File format and size validation
3. **Parsing**: Stream-based parsing with progress tracking
4. **Transformation**: Apply business rules and data cleaning
5. **Storage**: Persist to SQLite with transaction support
6. **Analytics**: Sync to DuckDB for reporting

### 2. Error Handling Flow
```
Error Detection → Logging → Recovery Strategy → Partial Success → Report
```

- **Graceful degradation**: Process what's possible
- **Detailed error tracking**: Row-level error information
- **Automatic retry**: For transient failures
- **Partial commits**: Save valid data even with errors

## Implementation Patterns

### 1. Streaming Pattern
```typescript
// Large file processing
await fileStreamService.streamProcessFile(filePath, {
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  onChunk: async (chunk) => {
    // Process chunk
    const validated = await validationService.validateData(chunk.data, 'schema');
    await saveToDatabase(validated.transformedData);
  },
  onProgress: (progress) => {
    // Update UI/logs
    console.log(`Progress: ${progress.percentComplete}%`);
  }
});
```

### 2. Validation Pattern
```typescript
// Define schema
const schema: ValidationSchema = {
  name: 'user-import',
  rules: [
    { field: 'email', type: 'email', transform: (v) => v.toLowerCase() },
    { field: 'age', type: 'number', options: { min: 18, max: 120 } },
    { field: 'phone', type: 'phone' }
  ],
  strict: true
};

// Validate with transformation
const result = await validationService.validateData(data, 'user-import', {
  transform: true,
  transformOptions: {
    trimStrings: true,
    normalizeEmail: true,
    defaultValues: { status: 'pending' }
  }
});
```

### 3. Error Recovery Pattern
```typescript
// Batch processing with error recovery
const batchSize = 1000;
const errors = [];

for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  
  try {
    await processBatch(batch);
  } catch (error) {
    // Log error but continue
    errors.push({ batch: i / batchSize, error });
    
    // Try individual records
    for (const record of batch) {
      try {
        await processRecord(record);
      } catch (recordError) {
        errors.push({ record, error: recordError });
      }
    }
  }
}
```

## Performance Optimization

### 1. Connection Pooling
- SQLite: 5-10 connections
- Reuse connections across requests
- Automatic cleanup on idle

### 2. Batch Operations
- Insert multiple records in transactions
- Use prepared statements
- Bulk updates where possible

### 3. Memory Management
- Stream processing for large files
- Chunk size optimization based on available memory
- Garbage collection hints for Node.js

### 4. Indexing Strategy
- Index frequently queried columns
- Composite indexes for complex queries
- Regular index maintenance

## Monitoring and Observability

### 1. Progress Tracking
```typescript
fileStreamService.on('stream:progress', (progress) => {
  logger.info('Processing progress', {
    bytesProcessed: progress.bytesProcessed,
    totalBytes: progress.totalBytes,
    percentComplete: progress.percentComplete,
    estimatedTimeRemaining: progress.estimatedTimeRemaining
  });
});
```

### 2. Performance Metrics
- Rows processed per second
- Memory usage
- Error rates
- Processing time by file size

### 3. Health Checks
- Database connectivity
- File system access
- Memory availability
- Service dependencies

## Security Considerations

### 1. Input Validation
- File type restrictions
- Size limitations
- Content scanning
- Path traversal prevention

### 2. Data Sanitization
- HTML/script removal
- SQL injection prevention
- XSS protection
- Input encoding

### 3. Access Control
- File upload permissions
- Database access restrictions
- API rate limiting
- Audit logging

## Scaling Strategies

### 1. Horizontal Scaling
- Multiple worker processes
- Queue-based job distribution
- Load balancing

### 2. Vertical Scaling
- Memory allocation tuning
- CPU optimization
- I/O performance

### 3. Storage Scaling
- Database partitioning
- Archive old data
- Compression strategies

## Best Practices

### 1. Development
- Use TypeScript for type safety
- Write comprehensive tests
- Document validation schemas
- Version control migrations

### 2. Deployment
- Environment-specific configs
- Graceful shutdown handling
- Health check endpoints
- Monitoring integration

### 3. Operations
- Regular backups
- Performance monitoring
- Error tracking
- Capacity planning

## Example: Complete Pipeline

```typescript
// 1. Define validation schema
const orderSchema: ValidationSchema = {
  name: 'order-import',
  rules: [
    { field: 'order_id', type: 'required' },
    { field: 'customer_email', type: 'email' },
    { field: 'amount', type: 'number', options: { min: 0 } },
    { field: 'order_date', type: 'date' },
    { field: 'status', type: 'regex', options: { pattern: '^(pending|completed|cancelled)$' } }
  ]
};

// 2. Register schema
validationService.registerSchema(orderSchema);

// 3. Process file
const result = await fileStreamService.streamProcessFile('orders.csv', {
  chunkSize: 10 * 1024 * 1024, // 10MB chunks
  
  onChunk: async (chunk) => {
    // Validate chunk
    const validation = await validationService.validateData(
      chunk.data,
      'order-import',
      {
        transform: true,
        transformOptions: {
          trimStrings: true,
          parseNumbers: true,
          parseDates: true,
          defaultValues: {
            status: 'pending',
            processed: false
          }
        }
      }
    );
    
    // Save valid records
    if (validation.transformedData) {
      await dataService.bulkInsert('orders', validation.transformedData);
    }
    
    // Log errors
    if (validation.errors.length > 0) {
      await dataService.logErrors('order_import_errors', validation.errors);
    }
  },
  
  onProgress: (progress) => {
    // Update job status
    await jobService.updateProgress(jobId, progress);
  }
});

// 4. Run analytics
const analytics = await duckdbService.executeQuery(`
  SELECT 
    DATE_TRUNC('month', order_date) as month,
    COUNT(*) as total_orders,
    SUM(amount) as total_revenue,
    AVG(amount) as avg_order_value
  FROM orders
  WHERE status = 'completed'
  GROUP BY month
  ORDER BY month DESC
`);

// 5. Generate report
const report = {
  importSummary: result,
  validationStats: validation.stats,
  analytics: analytics,
  timestamp: new Date()
};
```

## Future Enhancements

1. **Real-time Processing**: WebSocket-based progress updates
2. **Machine Learning**: Automatic data quality scoring
3. **Cloud Storage**: S3/Azure Blob integration
4. **Distributed Processing**: Apache Spark integration
5. **Data Lineage**: Track data transformations
6. **Schema Evolution**: Automatic schema migration
7. **Data Versioning**: Track changes over time
8. **Multi-tenancy**: Isolated processing per tenant