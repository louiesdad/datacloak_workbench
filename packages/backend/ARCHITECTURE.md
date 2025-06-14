# Backend Architecture Documentation

## Overview

The DataCloak Sentiment Workbench backend is a robust Express.js TypeScript API that provides sentiment analysis, data management, security auditing, and analytics capabilities. It features DataCloak security integration for PII protection, dual-database architecture with SQLite for transactional data and DuckDB for analytical workloads, and comprehensive security monitoring.

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Language**: TypeScript 5.x
- **Databases**: 
  - SQLite 3 (transactional data)
  - DuckDB (analytics)
- **Testing**: Jest with 84.86% coverage
- **Validation**: Joi
- **File Processing**: Multer, csv-parser, xlsx

## Architecture Layers

### 1. API Layer (`/src/routes`)
- **Health Routes**: System monitoring and status checks
- **Sentiment Routes**: Text analysis endpoints
- **Data Routes**: File upload and dataset management
- **Middleware**: Error handling, validation, CORS

### 2. Controller Layer (`/src/controllers`)
- **SentimentController**: Handles sentiment analysis requests
- **DataController**: Manages file uploads and datasets
- Validates requests using Joi schemas
- Returns standardized responses

### 3. Service Layer (`/src/services`)
- **SentimentService**: Core sentiment analysis logic
  - Keyword-based sentiment scoring
  - Batch processing support
  - History and statistics tracking
- **DataService**: File processing and dataset management
  - CSV/Excel parsing
  - Field type inference
  - Export functionality

### 4. Database Layer (`/src/database`)
- **SQLite**: Transactional data storage
  - Sentiment analysis results
  - Dataset metadata
  - Analysis batches
- **DuckDB**: Analytics and reporting
  - Aggregated analytics
  - Large-scale data processing
  - Time-series analysis

### 5. Validation Layer (`/src/validation`)
- Joi schemas for all API endpoints
- Request body validation
- Query parameter validation
- Path parameter validation

## Key Features

### Sentiment Analysis
- **Keyword-based scoring**: Analyzes text using positive/negative word lists
- **Confidence scoring**: Provides confidence levels for predictions
- **Batch processing**: Handles up to 1000 texts per request
- **History tracking**: Stores all analysis results with timestamps

### Data Management
- **Large file support**: Handles files up to 50GB
- **Format support**: CSV, Excel (XLSX), and plain text
- **Field inference**: Automatically detects data types
- **Preview generation**: Returns sample data for validation
- **Security scanning**: Automatic PII detection during file upload
- **Risk assessment**: Compliance scoring and risk level classification

### Security & Privacy
- **PII Detection**: Automatic detection of emails, phones, SSNs, credit cards, names
- **Text Masking**: Real-time PII masking before sentiment analysis
- **Security Auditing**: File-level security audits with compliance scoring
- **Event Tracking**: Comprehensive logging of all security events
- **Compliance Monitoring**: GDPR, CCPA, HIPAA, PCI compliance tracking
- **DataCloak Integration**: Native bridge with fallback to high-fidelity mock

### Database Design

#### SQLite Schema
```sql
-- Sentiment analyses
CREATE TABLE sentiment_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  score REAL NOT NULL,
  confidence REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Datasets
CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  mime_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analysis batches
CREATE TABLE analysis_batches (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL DEFAULT 0,
  total_records INTEGER NOT NULL,
  completed_records INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id)
);
```

#### DuckDB Schema
```sql
-- Text analytics
CREATE TABLE text_analytics (
  id INTEGER PRIMARY KEY,
  text VARCHAR,
  sentiment VARCHAR,
  score DOUBLE,
  confidence DOUBLE,
  word_count INTEGER,
  char_count INTEGER,
  batch_id VARCHAR,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Health Endpoints
- `GET /health` - Basic health check
- `GET /api/v1/health/status` - Detailed service status

### Sentiment Analysis
- `POST /api/v1/sentiment/analyze` - Analyze single text
- `POST /api/v1/sentiment/batch` - Batch analysis
- `GET /api/v1/sentiment/history` - Analysis history
- `GET /api/v1/sentiment/statistics` - Aggregate statistics

### Data Management
- `POST /api/v1/data/upload` - Upload dataset
- `GET /api/v1/data/datasets` - List datasets
- `GET /api/v1/data/datasets/:id` - Get dataset details
- `DELETE /api/v1/data/datasets/:id` - Delete dataset
- `POST /api/v1/data/export` - Export data

## Error Handling

The API uses a custom `AppError` class for consistent error responses:

```typescript
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

Common error codes:
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `DB_ERROR` - Database operation failed
- `INVALID_FILE_TYPE` - Unsupported file format
- `BATCH_TOO_LARGE` - Batch size exceeds limit

## Testing Strategy

### Test Coverage (84.86%)
- **Unit Tests**: Controllers, services, middleware
- **Integration Tests**: API endpoints, database operations
- **Validation Tests**: All Joi schemas
- **Edge Case Tests**: Error conditions, boundary values

### Test Structure
```
tests/
├── unit/
│   ├── config.test.ts
│   ├── controllers.test.ts
│   ├── data.service.test.ts
│   ├── sentiment.service.test.ts
│   ├── middleware.test.ts
│   ├── validation.test.ts
│   └── service-edge-cases.test.ts
└── integration/
    └── api.test.ts
```

## Configuration

Environment variables are managed through `src/config/env.ts`:

```typescript
{
  nodeEnv: 'development' | 'test' | 'production',
  port: 3001,
  database: {
    sqlitePath: './data/sentiment.db',
    duckdbPath: './data/analytics.db'
  }
}
```

## Performance Considerations

1. **File Processing**: Uses streaming for large files
2. **Database Queries**: Indexed columns for fast lookups
3. **Batch Processing**: Transaction-based for consistency
4. **Memory Management**: Configurable limits for uploads

## Security Features

1. **Input Validation**: All inputs validated with Joi
2. **SQL Injection Prevention**: Parameterized queries
3. **File Type Validation**: Whitelist of allowed MIME types
4. **Error Sanitization**: No sensitive data in error messages
5. **CORS Configuration**: Restricted to frontend origin

## Development Workflow

1. **Local Development**: `npm run dev` (with hot reload)
2. **Testing**: `npm test` or `npm run test:coverage`
3. **Building**: `npm run build`
4. **Production**: `npm start`

### Job Queue System

The backend includes a comprehensive job queue system for handling long-running operations:

#### Supported Job Types
- `sentiment_analysis_batch` - Process large batches of text analysis
- `file_processing` - Stream process large files with chunked reading
- `security_scan` - Comprehensive security scanning of datasets
- `data_export` - Export processed data in various formats

#### Job Queue Features
```typescript
// Create a batch sentiment analysis job
const jobId = jobQueue.addJob('sentiment_analysis_batch', {
  texts: ['text1', 'text2', ...],
  enablePIIMasking: true
}, { priority: 'high' });

// Monitor job progress
jobQueue.on('job:progress', (job) => {
  console.log(`Job ${job.id}: ${job.progress}% complete`);
});
```

#### Queue Management
- **Priority scheduling**: low, medium, high, critical
- **Concurrent processing**: Configurable max concurrent jobs (default: 3)
- **Progress tracking**: Real-time progress updates and ETA
- **Error handling**: Automatic retry and fallback mechanisms
- **Job lifecycle**: pending → running → completed/failed/cancelled

### Large File Processing

#### Chunked File Reading
The system automatically uses chunked processing for files larger than 100MB:

```typescript
// FileStreamService automatically chunks large files
const result = await fileStreamService.streamProcessFile(filePath, {
  chunkSize: 256 * 1024 * 1024, // 256MB chunks
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentComplete}%`);
  },
  onChunk: async (chunk) => {
    // Process each chunk as it's read
    await processChunk(chunk.data);
  }
});
```

#### Performance Features
- **Memory efficiency**: 256MB chunk processing prevents memory overload
- **Progress tracking**: Real-time progress with estimated completion time
- **Fallback support**: Automatic fallback to regular parsing if streaming fails
- **Format support**: Both CSV and Excel files with optimized streaming

### Job Queue API Endpoints

#### Create Job
```http
POST /api/v1/jobs
Content-Type: application/json

{
  "type": "sentiment_analysis_batch",
  "data": {
    "texts": ["text1", "text2"],
    "enablePIIMasking": true
  },
  "priority": "high"
}
```

#### Monitor Job
```http
GET /api/v1/jobs/:jobId
```

#### List Jobs
```http
GET /api/v1/jobs?status=running&type=file_processing&limit=10
```

#### Cancel Job
```http
DELETE /api/v1/jobs/:jobId
```

#### Queue Statistics
```http
GET /api/v1/jobs/stats/summary
```

#### Wait for Completion
```http
POST /api/v1/jobs/:jobId/wait
Content-Type: application/json

{
  "timeout": 30000
}
```

## Enhanced Database Schema

### Job Processing Tables
```sql
-- Job queue tracking (in-memory, not persisted)
-- Jobs are managed in memory for performance
-- Completed job results are stored in existing tables
```

### File Processing Enhancements
The existing dataset tables now support chunked processing metadata:
- Processing progress tracking
- Chunk-based field inference
- Memory usage estimation

## Performance Optimizations

### File Upload Processing
- **Automatic chunking**: Files >100MB processed in 256MB chunks
- **Memory management**: Configurable memory limits and cleanup
- **Progress reporting**: Real-time upload and processing progress
- **Security integration**: PII scanning during chunked processing

### Batch Operations
- **Background processing**: Long-running operations moved to job queue
- **Concurrent execution**: Multiple jobs processed simultaneously
- **Resource management**: Configurable concurrency limits
- **Error recovery**: Automatic retry mechanisms for failed operations

## Testing Infrastructure

### Enhanced Test Coverage
- **Error handling tests**: Comprehensive error scenario validation
- **Integration tests**: End-to-end API testing with proper error handling
- **Performance tests**: Large file processing and concurrent operation testing
- **Security tests**: PII detection and masking validation

### Test Categories
1. **Unit Tests**: Individual component testing
2. **Integration Tests**: API endpoint testing
3. **Error Handling Tests**: Validation and error response testing
4. **Security Tests**: PII detection and compliance testing
5. **Performance Tests**: Large file and concurrent processing

## Future Enhancements

1. **Authentication**: JWT-based auth system
2. **Rate Limiting**: Request throttling
3. **Caching**: Redis for frequently accessed data
4. **WebSocket**: Real-time analysis updates
5. **ML Integration**: Advanced sentiment models
6. **Job Persistence**: Database-backed job queue for reliability
7. **Distributed Processing**: Multi-node job processing
8. **Advanced Monitoring**: Metrics and alerting system