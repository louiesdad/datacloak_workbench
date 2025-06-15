# API Contracts Documentation

This directory contains comprehensive documentation for all API contracts and endpoints in the DataCloak Sentiment Workbench. The contracts are based on the TypeScript interfaces defined in `shared/contracts/` and provide detailed information about request/response formats, validation rules, and usage examples.

## 📁 Documentation Structure

- **[Overview](./overview.md)** - API architecture and design principles
- **[Authentication](./authentication.md)** - Authentication and authorization (future)
- **[Health & Status](./health-status.md)** - System health and monitoring endpoints
- **[Data Management](./data-management.md)** - File upload, dataset management, and export
- **[Sentiment Analysis](./sentiment-analysis.md)** - Text sentiment analysis and batch processing
- **[Job Queue](./job-queue.md)** - Background processing and job management
- **[Security & Privacy](./security-privacy.md)** - PII detection, masking, and compliance
- **[Field Inference](./field-inference.md)** - Automated data type detection
- **[Cost Estimation](./cost-estimation.md)** - LLM operation cost calculation
- **[Error Handling](./error-handling.md)** - Error response formats and codes
- **[WebSocket Events](./websocket-events.md)** - Real-time communication (future)

## 🚀 Quick Start

### Base URL
```
http://localhost:3001/api/v1
```

### Common Headers
```http
Content-Type: application/json
Accept: application/json
```

### Standard Response Format
All API responses follow this structure:
```typescript
{
  "success": boolean,
  "data": any,           // Present on success
  "error": string,       // Present on error
  "message": string,     // Optional descriptive message
  "timestamp": string    // ISO 8601 timestamp
}
```

### Pagination Format
For paginated endpoints:
```typescript
{
  "success": true,
  "data": Array<T>,
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "totalPages": number
  }
}
```

## 🔗 Key Endpoint Groups

### Core Functionality
- **Health Monitoring**: `/health`, `/api/v1/health/status`
- **Data Upload**: `POST /api/v1/data/upload`
- **Sentiment Analysis**: `POST /api/v1/sentiment/analyze`
- **Background Jobs**: `POST /api/v1/jobs`

### Advanced Features
- **Security Scanning**: `POST /api/v1/security/scan/dataset/:id`
- **PII Detection**: `POST /api/v1/security/detect`
- **Job Management**: `GET /api/v1/jobs/:id`
- **Data Export**: `POST /api/v1/data/export`

## 📊 Request/Response Examples

### Simple Sentiment Analysis
```bash
curl -X POST http://localhost:3001/api/v1/sentiment/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "I love this product!"}'
```

### File Upload with PII Detection
```bash
curl -X POST http://localhost:3001/api/v1/data/upload \
  -F "file=@dataset.csv"
```

### Background Job Creation
```bash
curl -X POST http://localhost:3001/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sentiment_analysis_batch",
    "data": {"texts": ["Text 1", "Text 2"]},
    "priority": "high"
  }'
```

## 🛠️ Development Tools

### Contract Validation
The shared contracts in `shared/contracts/` provide TypeScript types for:
- Request/response validation
- Frontend type safety
- API client generation
- Mock data generation

### Testing Utilities
Test fixtures are available in `shared/test-fixtures/` for:
- API response mocking
- Dataset generation
- Performance testing
- Security scenario testing

## 📋 Validation Rules

All endpoints use Joi validation with detailed error messages:
- **Required fields**: Clearly marked in schemas
- **Type validation**: Strict typing for all parameters
- **Range validation**: Min/max values for numeric fields
- **Format validation**: Email, URL, UUID, and custom formats
- **File validation**: MIME type and size restrictions

## 🔒 Security Considerations

- **Input Sanitization**: All inputs are validated and sanitized
- **PII Protection**: Automatic PII detection and masking
- **Rate Limiting**: Configurable request throttling (future)
- **CORS**: Proper cross-origin resource sharing
- **Error Sanitization**: No sensitive information in error responses

## 📈 Performance Features

- **Chunked Processing**: Large files processed in 256MB chunks
- **Background Jobs**: Long-running operations handled asynchronously
- **Progress Tracking**: Real-time progress updates for all operations
- **Memory Management**: Efficient memory usage for large datasets

## 🔄 Versioning

The API uses semantic versioning:
- **Current Version**: v1
- **Backward Compatibility**: Maintained within major versions
- **Deprecation Notice**: 90-day notice for breaking changes

## 📖 Additional Resources

- **[OpenAPI Specification](../api-spec.yaml)** - Machine-readable API specification (future)
- **[Postman Collection](../postman-collection.json)** - API testing collection (future)
- **[SDK Documentation](../sdk/)** - Client SDK documentation (future)
- **[Integration Examples](../examples/)** - Real-world usage examples (future)

---

For technical support or questions about the API contracts, please refer to the [main documentation](../../README.md) or contact the development team.