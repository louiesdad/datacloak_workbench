# API Overview

## Architecture Principles

The DataCloak Sentiment Workbench API is built on RESTful principles with the following design goals:

### 🎯 Core Design Principles

1. **Privacy-First**: All PII data is processed locally with optional masking
2. **Offline-Capable**: Complete functionality without external dependencies
3. **Type-Safe**: Comprehensive TypeScript contracts for all interactions
4. **Scalable**: Background job processing for large datasets
5. **Secure**: Built-in security scanning and compliance monitoring

### 🏗️ API Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Processing    │
│   (React)       │    │   (Express)     │    │   Services      │
│                 │    │                 │    │                 │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │ UI Layer  │◄─┼────┼─►│Controllers│◄─┼────┼─►│ Job Queue │  │
│  └───────────┘  │    │  └───────────┘  │    │  └───────────┘  │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  ┌───────────┐  │
│  │API Client │◄─┼────┼─►│Middleware │  │    │  │ File      │  │
│  └───────────┘  │    │  └───────────┘  │    │  │ Streaming │  │
│  ┌───────────┐  │    │  ┌───────────┐  │    │  └───────────┘  │
│  │State Mgmt │  │    │  │ Services  │◄─┼────┼─►│ Security  │  │
│  └───────────┘  │    │  └───────────┘  │    │  │ Scanner   │  │
└─────────────────┘    └─────────────────┘    │  └───────────┘  │
                                              │  ┌───────────┐  │
                                              │  │ Analytics │  │
                                              │  │ Engine    │  │
                                              │  └───────────┘  │
                                              └─────────────────┘
```

### 📊 Data Flow

1. **Request Validation**: All requests validated with Joi schemas
2. **Authentication**: Optional JWT-based auth (future implementation)
3. **Rate Limiting**: Configurable throttling (future implementation)
4. **Processing**: Synchronous for simple operations, asynchronous for complex ones
5. **Response**: Standardized format with error handling

## Technology Stack

### Backend Components
- **Express.js 4.18**: Web framework
- **TypeScript 5.x**: Type safety and development experience
- **SQLite 3**: Transactional data storage
- **DuckDB**: Analytics and reporting
- **Joi**: Request validation
- **Multer**: File upload handling

### Processing Services
- **Job Queue**: Background processing with priority scheduling
- **File Streaming**: Chunked processing for large files (256MB chunks)
- **Security Scanner**: PII detection and compliance monitoring
- **Sentiment Engine**: Keyword-based sentiment analysis

### Development Tools
- **Jest**: Testing framework with 82%+ coverage
- **ESLint/Prettier**: Code quality and formatting
- **Nodemon**: Development server with hot reload
- **TypeScript Contracts**: Shared type definitions

## API Versioning

### Current Version: v1

```
/api/v1/
├── health/              # System health and monitoring
├── data/                # Dataset management
├── sentiment/           # Sentiment analysis
├── jobs/                # Background job processing
└── security/            # PII detection and security
```

### Version Strategy
- **Semantic Versioning**: Major.Minor.Patch
- **Backward Compatibility**: Maintained within major versions
- **Deprecation Policy**: 90-day notice for breaking changes
- **Migration Guides**: Provided for major version updates

## Request/Response Patterns

### Standard Request Format
```typescript
interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: {
    'Content-Type': 'application/json';
    'Accept': 'application/json';
    // Optional authentication headers
  };
  body?: any;
  query?: Record<string, string>;
}
```

### Standard Response Format
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: {
    code: string;
    field?: string;
    value?: any;
  };
  timestamp: string;
}
```

## Content Types

### Supported Request Types
- `application/json` - Standard API requests
- `multipart/form-data` - File uploads
- `application/x-www-form-urlencoded` - Form submissions

### Supported Response Types
- `application/json` - Standard API responses
- `text/csv` - Data exports
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` - Excel exports
- `application/octet-stream` - Binary downloads

## Rate Limiting & Throttling

### Current Implementation
- No rate limiting (development phase)
- File size limits: 50GB maximum
- Concurrent job limits: 3 simultaneous background jobs

### Future Implementation
```typescript
interface RateLimit {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}
```

## Security Model

### Current Security Features
1. **Input Validation**: Joi schemas for all endpoints
2. **CORS Protection**: Configurable cross-origin policies
3. **Helmet.js**: Security headers (XSS, CSRF, etc.)
4. **PII Detection**: Automatic scanning and masking
5. **Error Sanitization**: No sensitive data in responses

### Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## Performance Characteristics

### Throughput Benchmarks
- **Simple sentiment analysis**: ~1000 requests/second
- **Batch sentiment analysis**: ~100 batches/second (10 texts each)
- **File upload**: ~100MB/second (depends on storage)
- **PII scanning**: ~50MB/second text processing

### Memory Usage
- **Base memory**: ~50MB idle
- **File processing**: ~256MB per active chunk
- **Job processing**: ~100MB per concurrent job
- **Maximum memory**: ~1GB under full load

### Response Times (P95)
- **Health check**: <10ms
- **Simple sentiment**: <50ms
- **File upload (10MB)**: <2s
- **Security scan**: <5s per MB
- **Job status**: <20ms

## Monitoring & Observability

### Health Endpoints
```
GET /health                 # Basic health check
GET /api/v1/health/status   # Detailed service status
```

### Metrics Collected
- Request duration and count
- Error rates by endpoint
- Memory and CPU usage
- Database connection status
- Job queue statistics

### Logging
- **Structured logging**: JSON format
- **Log levels**: DEBUG, INFO, WARN, ERROR
- **Request tracking**: Unique request IDs
- **Performance metrics**: Response times and throughput

## Error Handling Strategy

### Error Classification
1. **Client Errors (4xx)**: Invalid requests, validation failures
2. **Server Errors (5xx)**: Internal errors, service unavailable
3. **Business Logic Errors**: Domain-specific validation failures

### Error Response Codes
```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

### Recovery Strategies
- **Automatic retries**: For transient failures
- **Circuit breakers**: For service dependencies
- **Graceful degradation**: Fallback responses
- **Health checks**: Service availability monitoring

## Future Enhancements

### Authentication & Authorization
```typescript
interface AuthConfig {
  provider: 'jwt' | 'oauth2' | 'saml';
  secretKey: string;
  expirationTime: string;
  refreshTokens: boolean;
}
```

### Real-time Features
```typescript
interface WebSocketConfig {
  endpoint: '/ws';
  events: ['progress', 'completion', 'error'];
  authentication: boolean;
  heartbeat: number;
}
```

### Caching Strategy
```typescript
interface CacheConfig {
  provider: 'redis' | 'memory';
  ttl: number;
  maxSize: number;
  keyPattern: string;
}
```

---

This overview provides the foundation for understanding the API architecture. For detailed endpoint documentation, refer to the specific contract files in this directory.