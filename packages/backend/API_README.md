# DataCloak Sentiment Workbench API

[![API Version](https://img.shields.io/badge/API-v1.0.0-blue.svg)](./openapi.yaml)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-green.svg)](./openapi.yaml)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

A comprehensive REST API for sentiment analysis, data security, PII detection, and compliance management.

## 🚀 Quick Start

### 1. Installation & Setup

```bash
# Clone the repository
git clone <repository-url>
cd packages/backend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3001`

### 2. Authentication

Get a JWT token by logging in:

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

Include the token in subsequent requests:

```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:3001/api/v1/sentiment/analyze
```

### 3. Basic Usage

**Analyze Sentiment:**
```bash
curl -X POST http://localhost:3001/api/v1/sentiment/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this product!", "options": {"model": "gpt-4"}}'
```

**Detect PII:**
```bash
curl -X POST http://localhost:3001/api/v1/security/detect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "My email is john@example.com"}'
```

## 📚 Documentation

### Complete Documentation
- **[Comprehensive API Documentation](./api-documentation.md)** - Complete guide with all endpoints, examples, and client libraries
- **[OpenAPI Specification](./openapi.yaml)** - Machine-readable API specification
- **[Interactive API Docs](#interactive-docs)** - Swagger UI for testing endpoints

### Client Libraries & Examples
- **[JavaScript Client](./api-client-examples/javascript-client.js)** - Full-featured JS/Node.js client
- **[Python Client](./api-client-examples/python-client.py)** - Synchronous and asynchronous Python client
- **[cURL Examples](./api-client-examples/curl-examples.sh)** - Comprehensive shell script with all API examples

### Interactive Documentation

Access interactive API documentation at:
- **Swagger UI**: `http://localhost:3001/api/v1/docs` (when available)
- **ReDoc**: `http://localhost:3001/api/v1/redoc` (when available)
- **OpenAPI JSON**: `http://localhost:3001/api/v1/openapi.json`

## 🔧 API Overview

### Core Features

| Feature | Endpoints | Description |
|---------|-----------|-------------|
| **Sentiment Analysis** | `/api/v1/sentiment/*` | Advanced sentiment analysis with OpenAI integration |
| **Data Security** | `/api/v1/security/*` | PII detection, masking, and security auditing |
| **Data Management** | `/api/v1/data/*` | Dataset upload, management, and export |
| **Job Processing** | `/api/v1/jobs/*` | Asynchronous job queue management |
| **Real-time Updates** | `/api/v1/sse/*`, `/api/v1/websocket/*` | Live updates via SSE and WebSocket |
| **Compliance** | `/api/v1/compliance/*` | GDPR, HIPAA, and custom compliance frameworks |
| **Monitoring** | `/api/v1/monitoring/*`, `/api/v1/health/*` | System health and performance metrics |

### API Structure

```
/api/
├── auth/                 # Authentication endpoints
├── config/              # Configuration management (admin)
└── v1/
    ├── sentiment/       # Sentiment analysis
    ├── security/        # PII detection & security
    ├── data/           # Data management
    ├── jobs/           # Job queue management
    ├── export/         # Data export
    ├── health/         # Health checks
    ├── monitoring/     # System monitoring
    ├── cache/          # Cache management
    ├── websocket/      # WebSocket endpoints
    ├── sse/            # Server-Sent Events
    └── ...             # Additional services
```

## 🛠️ Client Examples

### JavaScript/Node.js

```javascript
const { DataCloakClient } = require('./api-client-examples/javascript-client');

const client = new DataCloakClient({
    baseURL: 'http://localhost:3001',
    token: 'your-jwt-token'
});

// Analyze sentiment
const result = await client.analyzeSentiment('I love this product!', {
    model: 'gpt-4',
    includeEmotions: true
});

// Detect PII
const pii = await client.detectPII('My email is john@example.com');

// Upload and process dataset
const upload = await client.uploadDataset(file, {
    name: 'Customer Feedback',
    description: 'Q4 2024 feedback data'
});
```

### Python

```python
from api_client_examples.python_client import DataCloakClient

client = DataCloakClient(
    base_url='http://localhost:3001',
    token='your-jwt-token'
)

# Analyze sentiment
result = client.analyze_sentiment('I love this product!', model='gpt-4')

# Batch processing
batch_result = client.batch_analyze_sentiment([
    'Great product!',
    'Terrible service',
    'It was okay'
])

# Async client for high-performance operations
async with AsyncDataCloakClient() as async_client:
    results = await asyncio.gather(*[
        async_client.analyze_sentiment(text)
        for text in texts
    ])
```

### cURL

Run the comprehensive example script:

```bash
# Make the script executable
chmod +x ./api-client-examples/curl-examples.sh

# Run all examples
./api-client-examples/curl-examples.sh
```

Or use individual commands:

```bash
# Health check
curl http://localhost:3001/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Sentiment analysis
curl -X POST http://localhost:3001/api/v1/sentiment/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Amazing product!", "options": {"model": "gpt-4"}}'
```

## 🔐 Authentication & Security

### Authentication Methods

1. **JWT Bearer Token** (Recommended)
   ```
   Authorization: Bearer <jwt-token>
   ```

2. **Basic Authentication** (Admin endpoints only)
   ```
   Authorization: Basic <base64-encoded-credentials>
   ```

### Rate Limiting

- **Standard endpoints**: 100 requests per 15 minutes
- **Admin endpoints**: 50 requests per 15 minutes
- **Upload endpoints**: 10 requests per 15 minutes

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

### Security Features

- JWT token authentication with configurable expiration
- Role-based access control (admin/user)
- Input validation and sanitization
- PII detection and masking
- Security audit logging
- HTTPS support (production)

## 📊 Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully",
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "executionTime": 150,
    "version": "1.0.0"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTH_REQUIRED` | Authentication required |
| `INSUFFICIENT_PERMISSIONS` | Access denied |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `DATACLOAK_ERROR` | DataCloak service error |
| `OPENAI_ERROR` | OpenAI service error |

## 🚀 Advanced Features

### Real-time Communication

**Server-Sent Events (SSE):**
```javascript
const eventSource = new EventSource('/api/v1/sse/events');
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Real-time update:', data);
};
```

**WebSocket:**
```javascript
const ws = new WebSocket('ws://localhost:3001/api/v1/websocket');
ws.onopen = () => {
    ws.send(JSON.stringify({
        type: 'auth',
        token: 'your-jwt-token'
    }));
};
```

### Batch Processing

**Large Dataset Processing:**
```javascript
// Create processing job
const job = await client.createJob('sentiment_analysis', {
    datasetId: 'dataset_123',
    options: { model: 'gpt-4', batchSize: 1000 }
});

// Monitor progress
const result = await client.pollJobCompletion(job.data.jobId);
```

**Streaming Processing:**
```javascript
// Stream process large files
const stream = await client.streamProcess({
    datasetId: 'dataset_123',
    chunkSize: 1000,
    onProgress: (progress) => {
        console.log(`Progress: ${progress.percentComplete}%`);
    }
});
```

### Data Export

**Multiple Format Support:**
```javascript
// Export as CSV with custom options
const export = await client.exportData('dataset_123', {
    format: 'csv',
    options: {
        includeHeaders: true,
        delimiter: ',',
        encoding: 'utf-8',
        compression: 'gzip'
    },
    filters: {
        columns: ['id', 'text', 'sentiment_score'],
        where: 'sentiment_score > 0.5'
    }
});
```

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/datacloak

# Redis (for caching and job queue)
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# DataCloak
DATACLOAK_API_KEY=your-datacloak-api-key
DATACLOAK_API_ENDPOINT=https://api.datacloak.com

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=50GB
UPLOAD_DIR=./uploads
```

### API Configuration

Update configuration via API (admin only):

```javascript
// Single value update
await client.updateConfig('app.maxRequestsPerMinute', 1000);

// Batch update
await client.batchUpdateConfig({
    'openai.model': 'gpt-4',
    'datacloak.timeout': 30000,
    'app.enableDebugMode': false
});
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### API Testing

```bash
# Test with cURL examples
./api-client-examples/curl-examples.sh

# Test specific endpoints
curl http://localhost:3001/health
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/v1/health/status
```

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load tests
artillery quick --count 100 --num 10 http://localhost:3001/health
```

## 📈 Monitoring & Observability

### Health Endpoints

- **Basic Health**: `GET /health`
- **Detailed Health**: `GET /api/v1/health/status`
- **Service Health**: `GET /api/v1/health/ready`

### Metrics

- **System Metrics**: `GET /api/v1/monitoring/system`
- **Memory Usage**: `GET /api/v1/monitoring/memory/current`
- **Performance**: `GET /api/v1/monitoring/performance`
- **Cache Metrics**: `GET /api/v1/cache/stats`

### Logs

Application logs include:
- Request/response logging
- Error tracking
- Performance metrics
- Security events
- Job processing status

## 🐛 Troubleshooting

### Common Issues

**Authentication Errors:**
```bash
# Check token validity
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/auth/verify
```

**Rate Limiting:**
```bash
# Check rate limit headers
curl -I http://localhost:3001/api/v1/health/status
```

**Service Connectivity:**
```bash
# Test service health
curl http://localhost:3001/api/v1/health/status
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=datacloak:* npm run dev
```

### Support

For issues and questions:
1. Check the [troubleshooting guide](./api-documentation.md#troubleshooting)
2. Review the [OpenAPI specification](./openapi.yaml)
3. Run the [diagnostic script](./api-client-examples/curl-examples.sh)
4. Check application logs

## 📝 Contributing

### API Development

1. **Adding New Endpoints:**
   - Add route handler in `src/routes/`
   - Update OpenAPI specification
   - Add client examples
   - Write tests

2. **Updating Documentation:**
   - Update `api-documentation.md`
   - Update `openapi.yaml`
   - Update client examples
   - Test all examples

3. **Testing:**
   - Write unit tests
   - Add integration tests
   - Update example scripts
   - Verify OpenAPI compliance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../../LICENSE) file for details.

## 🔗 Related Resources

- **[Frontend Documentation](../web-ui/README.md)**
- **[Security Package](../security/README.md)**
- **[Deployment Guide](./DEPLOYMENT.md)**
- **[API Changelog](./CHANGELOG.md)**

---

**API Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**OpenAPI Spec**: [openapi.yaml](./openapi.yaml)