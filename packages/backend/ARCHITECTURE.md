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

## Future Enhancements

1. **Authentication**: JWT-based auth system
2. **Rate Limiting**: Request throttling
3. **Caching**: Redis for frequently accessed data
4. **WebSocket**: Real-time analysis updates
5. **ML Integration**: Advanced sentiment models