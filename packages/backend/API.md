# Backend API Documentation

## Base URL
```
http://localhost:3001/api/v1
```

## Authentication
Currently, the API does not require authentication. This will be added in a future release.

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "data": {...},
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "status": 400
  }
}
```

## Endpoints

### Health Check

#### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-25T10:00:00Z",
  "environment": "development"
}
```

#### GET /api/v1/health/status
Detailed service status including database connectivity.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-25T10:00:00Z",
  "services": {
    "database": {
      "sqlite": "connected",
      "duckdb": "connected"
    }
  }
}
```

### Sentiment Analysis

#### POST /api/v1/sentiment/analyze
Analyze sentiment of a single text.

**Request Body:**
```json
{
  "text": "This product is amazing! I love it."
}
```

**Validation:**
- `text` (string, required): 1-10,000 characters

**Response:**
```json
{
  "data": {
    "id": 1,
    "text": "This product is amazing! I love it.",
    "sentiment": "positive",
    "score": 0.85,
    "confidence": 0.92,
    "createdAt": "2023-12-25T10:00:00Z"
  },
  "message": "Sentiment analysis completed"
}
```

#### POST /api/v1/sentiment/batch
Analyze sentiment of multiple texts.

**Request Body:**
```json
{
  "texts": [
    "Great service!",
    "Terrible experience",
    "It was okay"
  ]
}
```

**Validation:**
- `texts` (array, required): 1-1000 items
- Each text: 1-10,000 characters

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "text": "Great service!",
      "sentiment": "positive",
      "score": 0.8,
      "confidence": 0.9
    },
    {
      "id": 2,
      "text": "Terrible experience",
      "sentiment": "negative",
      "score": -0.8,
      "confidence": 0.85
    },
    {
      "id": 3,
      "text": "It was okay",
      "sentiment": "neutral",
      "score": 0.1,
      "confidence": 0.6
    }
  ],
  "message": "Batch sentiment analysis completed"
}
```

#### GET /api/v1/sentiment/history
Get sentiment analysis history with pagination.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `pageSize` (number, optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "text": "Sample text",
      "sentiment": "positive",
      "score": 0.75,
      "confidence": 0.88,
      "createdAt": "2023-12-25T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### GET /api/v1/sentiment/statistics
Get aggregate sentiment statistics.

**Response:**
```json
{
  "data": {
    "totalAnalyses": 1234,
    "sentimentDistribution": {
      "positive": 600,
      "neutral": 400,
      "negative": 234
    },
    "averageConfidence": 0.82
  }
}
```

### Data Management

#### POST /api/v1/data/upload
Upload a dataset file for analysis.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Supported formats: CSV, Excel (XLSX), Plain text
- Max file size: 50GB

**Response:**
```json
{
  "data": {
    "dataset": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "filename": "data.csv",
      "originalFilename": "customer_reviews.csv",
      "size": 1048576,
      "recordCount": 1000,
      "mimeType": "text/csv",
      "createdAt": "2023-12-25T10:00:00Z",
      "updatedAt": "2023-12-25T10:00:00Z"
    },
    "previewData": [
      {"id": "1", "text": "Sample review", "rating": "5"},
      {"id": "2", "text": "Another review", "rating": "3"}
    ],
    "fieldInfo": [
      {
        "name": "id",
        "type": "string",
        "sampleValues": ["1", "2", "3"],
        "nullCount": 0
      },
      {
        "name": "text",
        "type": "string",
        "sampleValues": ["Sample review", "Another review"],
        "nullCount": 0
      },
      {
        "name": "rating",
        "type": "integer",
        "sampleValues": [5, 3, 4],
        "nullCount": 0
      }
    ]
  },
  "message": "Data uploaded successfully"
}
```

#### GET /api/v1/data/datasets
List all uploaded datasets.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `pageSize` (number, optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "filename": "data.csv",
      "originalFilename": "customer_reviews.csv",
      "size": 1048576,
      "recordCount": 1000,
      "mimeType": "text/csv",
      "createdAt": "2023-12-25T10:00:00Z",
      "updatedAt": "2023-12-25T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

#### GET /api/v1/data/datasets/:id
Get details of a specific dataset.

**Path Parameters:**
- `id` (string, required): Dataset UUID

**Response:**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "filename": "data.csv",
    "originalFilename": "customer_reviews.csv",
    "size": 1048576,
    "recordCount": 1000,
    "mimeType": "text/csv",
    "createdAt": "2023-12-25T10:00:00Z",
    "updatedAt": "2023-12-25T10:00:00Z"
  }
}
```

#### DELETE /api/v1/data/datasets/:id
Delete a dataset.

**Path Parameters:**
- `id` (string, required): Dataset UUID

**Response:**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "message": "Dataset deleted successfully"
}
```

#### POST /api/v1/data/export
Export data in various formats.

**Request Body:**
```json
{
  "format": "csv",
  "datasetId": "123e4567-e89b-12d3-a456-426614174000",
  "dateRange": {
    "start": "2023-01-01T00:00:00Z",
    "end": "2023-12-31T23:59:59Z"
  },
  "sentimentFilter": "positive"
}
```

**Validation:**
- `format` (string, required): One of: "csv", "json", "xlsx"
- `datasetId` (string, optional): UUID of specific dataset
- `dateRange` (object, optional): Date range filter
  - `start` (ISO date, required if dateRange provided)
  - `end` (ISO date, required if dateRange provided)
- `sentimentFilter` (string, optional): One of: "positive", "negative", "neutral"

**Response:**
```json
{
  "data": {
    "downloadUrl": "/exports/export-123456.csv",
    "expiresAt": "2023-12-25T11:00:00Z"
  },
  "message": "Export initiated successfully"
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NO_FILE` | 400 | No file provided in upload |
| `INVALID_FILE_TYPE` | 400 | Unsupported file format |
| `INVALID_TEXT` | 400 | Invalid text for analysis |
| `INVALID_TEXTS` | 400 | Invalid texts array |
| `BATCH_TOO_LARGE` | 400 | Batch size exceeds limit |
| `NOT_FOUND` | 404 | Resource not found |
| `DB_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Internal server error |

## Rate Limiting
Currently not implemented. Will be added in future releases.

## CORS
The API allows requests from the frontend application origin (http://localhost:5173 in development).

## File Size Limits
- Maximum upload size: 50GB
- Supported formats: CSV, Excel (XLSX), Plain text
- Files are processed in chunks to handle large sizes efficiently