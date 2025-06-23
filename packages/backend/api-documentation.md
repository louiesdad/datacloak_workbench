# DataCloak Sentiment Workbench API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Base URLs](#base-urls)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
- [Client Examples](#client-examples)
- [SDKs and Libraries](#sdks-and-libraries)

---

## Overview

The DataCloak Sentiment Workbench provides a comprehensive REST API for sentiment analysis, data security, PII detection, and compliance management. The API supports:

- **Sentiment Analysis**: Advanced sentiment analysis with OpenAI integration
- **Data Security**: PII detection, masking, and security auditing
- **Compliance**: GDPR, HIPAA, and custom compliance framework support
- **Real-time Processing**: WebSocket and Server-Sent Events for live updates
- **Batch Processing**: High-volume data processing with job queues
- **Stream Processing**: Large file handling with memory-efficient streaming

## Authentication

### JWT Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Admin Authentication
Admin endpoints support both JWT and Basic authentication:

```http
Authorization: Basic <base64-encoded-username:password>
```

### Getting a JWT Token
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

## Base URLs

- **Production**: `https://api.datacloak-sentiment.com`
- **Development**: `http://localhost:3001`
- **API Prefix**: All API routes are prefixed with `/api/v1/` except authentication and configuration

## Response Format

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

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "openai": "healthy",
    "datacloak": "healthy"
  }
}
```

## Error Handling

### HTTP Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `AUTH_REQUIRED` - Authentication required
- `INSUFFICIENT_PERMISSIONS` - Access denied
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `DATACLOAK_ERROR` - DataCloak service error
- `OPENAI_ERROR` - OpenAI service error
- `DATABASE_ERROR` - Database operation failed

## Rate Limiting

API requests are rate-limited per IP address:
- **Default**: 100 requests per 15 minutes
- **Admin endpoints**: 50 requests per 15 minutes
- **Upload endpoints**: 10 requests per 15 minutes

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248600
```

---

# API Endpoints

## Health & Status

### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /api/v1/health/status
Detailed health status with service checks.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "openai": "healthy",
    "datacloak": "healthy"
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

## Authentication

### POST /api/auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h",
    "user": {
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### POST /api/auth/verify
Verify JWT token validity.

**Headers:**
```http
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "username": "admin",
      "role": "admin"
    }
  }
}
```

## Sentiment Analysis

### POST /api/v1/sentiment/analyze
Analyze sentiment of text input.

**Request:**
```json
{
  "text": "I love this new product! It's amazing.",
  "options": {
    "model": "gpt-4",
    "includeEmotions": true,
    "includeKeywords": true,
    "language": "en"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "analysis_12345",
    "sentiment": {
      "label": "positive",
      "score": 0.95,
      "confidence": 0.92
    },
    "emotions": {
      "joy": 0.85,
      "excitement": 0.78,
      "satisfaction": 0.82
    },
    "keywords": [
      {
        "word": "love",
        "sentiment": "positive",
        "weight": 0.9
      },
      {
        "word": "amazing",
        "sentiment": "positive",
        "weight": 0.85
      }
    ],
    "processingTime": 1250,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/v1/sentiment/batch
Batch sentiment analysis for multiple texts.

**Request:**
```json
{
  "texts": [
    "This product is great!",
    "I'm not satisfied with the service.",
    "The experience was okay."
  ],
  "options": {
    "model": "gpt-4",
    "parallel": true,
    "includeEmotions": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch_67890",
    "results": [
      {
        "index": 0,
        "text": "This product is great!",
        "sentiment": {
          "label": "positive",
          "score": 0.88,
          "confidence": 0.91
        }
      },
      {
        "index": 1,
        "text": "I'm not satisfied with the service.",
        "sentiment": {
          "label": "negative",
          "score": -0.75,
          "confidence": 0.89
        }
      },
      {
        "index": 2,
        "text": "The experience was okay.",
        "sentiment": {
          "label": "neutral",
          "score": 0.12,
          "confidence": 0.67
        }
      }
    ],
    "statistics": {
      "totalTexts": 3,
      "positive": 1,
      "negative": 1,
      "neutral": 1,
      "averageScore": 0.08,
      "processingTime": 2100
    }
  }
}
```

### GET /api/v1/sentiment/history
Get sentiment analysis history.

**Query Parameters:**
- `limit` (optional): Number of results (default: 50, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `startDate` (optional): Start date filter (ISO 8601)
- `endDate` (optional): End date filter (ISO 8601)
- `sentiment` (optional): Filter by sentiment (`positive`, `negative`, `neutral`)

**Response:**
```json
{
  "success": true,
  "data": {
    "analyses": [
      {
        "id": "analysis_12345",
        "text": "Sample text...",
        "sentiment": {
          "label": "positive",
          "score": 0.85
        },
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 250,
      "limit": 50,
      "offset": 0,
      "hasNext": true
    }
  }
}
```

## Data Security & PII Detection

### POST /api/v1/security/detect
Detect PII in text content.

**Request:**
```json
{
  "text": "My email is john.doe@example.com and phone is 555-123-4567",
  "options": {
    "types": ["EMAIL", "PHONE", "SSN", "CREDIT_CARD"],
    "confidence": 0.8,
    "includePosition": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "detectedPII": [
      {
        "type": "EMAIL",
        "value": "john.doe@example.com",
        "confidence": 0.95,
        "position": {
          "start": 12,
          "end": 32
        },
        "riskLevel": "medium"
      },
      {
        "type": "PHONE",
        "value": "555-123-4567",
        "confidence": 0.92,
        "position": {
          "start": 46,
          "end": 58
        },
        "riskLevel": "low"
      }
    ],
    "riskScore": 65,
    "processingTime": 120
  }
}
```

### POST /api/v1/security/mask
Mask sensitive information in text.

**Request:**
```json
{
  "text": "Contact John at john.doe@example.com or call 555-123-4567",
  "options": {
    "maskChar": "*",
    "preserveLength": true,
    "maskTypes": ["EMAIL", "PHONE"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalText": "Contact John at john.doe@example.com or call 555-123-4567",
    "maskedText": "Contact John at ********************* or call ************",
    "maskedItems": [
      {
        "type": "EMAIL",
        "original": "john.doe@example.com",
        "masked": "*********************"
      },
      {
        "type": "PHONE",
        "original": "555-123-4567",
        "masked": "************"
      }
    ],
    "processingTime": 85
  }
}
```

## Data Management

### POST /api/v1/data/upload
Upload data files for processing.

**Request (multipart/form-data):**
```
file: <binary file data>
metadata: {
  "name": "customer-feedback.csv",
  "description": "Customer feedback data",
  "tags": ["customer", "feedback", "2024"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "datasetId": "dataset_abc123",
    "fileName": "customer-feedback.csv",
    "fileSize": 1048576,
    "rowCount": 5000,
    "columns": [
      {
        "name": "customer_id",
        "type": "string",
        "nullable": false
      },
      {
        "name": "feedback",
        "type": "string",
        "nullable": true
      },
      {
        "name": "rating",
        "type": "number",
        "nullable": false
      }
    ],
    "uploadTime": "2024-01-15T10:30:00Z",
    "processingStatus": "completed"
  }
}
```

### GET /api/v1/data/datasets
List all uploaded datasets.

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset
- `search` (optional): Search term for dataset name/description
- `tags` (optional): Filter by tags (comma-separated)

**Response:**
```json
{
  "success": true,
  "data": {
    "datasets": [
      {
        "id": "dataset_abc123",
        "name": "customer-feedback.csv",
        "description": "Customer feedback data",
        "fileSize": 1048576,
        "rowCount": 5000,
        "columnCount": 10,
        "uploadTime": "2024-01-15T10:30:00Z",
        "tags": ["customer", "feedback", "2024"]
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "hasNext": true
    }
  }
}
```

## Job Queue Management

### POST /api/v1/jobs
Create a new processing job.

**Request:**
```json
{
  "type": "sentiment_analysis",
  "data": {
    "datasetId": "dataset_abc123",
    "options": {
      "model": "gpt-4",
      "batchSize": 100,
      "includeEmotions": true
    }
  },
  "priority": "high",
  "metadata": {
    "userId": "user_123",
    "source": "web_ui"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_xyz789",
    "status": "queued",
    "type": "sentiment_analysis",
    "priority": "high",
    "estimatedDuration": 1800,
    "createdAt": "2024-01-15T10:30:00Z",
    "queuePosition": 3
  }
}
```

### GET /api/v1/jobs/:jobId
Get job status and details.

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_xyz789",
    "status": "processing",
    "type": "sentiment_analysis",
    "progress": {
      "current": 2500,
      "total": 5000,
      "percentage": 50,
      "eta": 900
    },
    "result": null,
    "error": null,
    "createdAt": "2024-01-15T10:30:00Z",
    "startedAt": "2024-01-15T10:32:00Z",
    "completedAt": null,
    "processingTime": 120
  }
}
```

## Export & Streaming

### POST /api/v1/export/dataset
Export dataset with various format options.

**Request:**
```json
{
  "datasetId": "dataset_abc123",
  "format": "csv",
  "options": {
    "includeHeaders": true,
    "delimiter": ",",
    "encoding": "utf-8",
    "compression": "gzip"
  },
  "filters": {
    "columns": ["customer_id", "feedback", "sentiment_score"],
    "where": "sentiment_score > 0.5"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_def456",
    "status": "processing",
    "downloadUrl": null,
    "estimatedSize": 2048576,
    "estimatedDuration": 60,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET /api/v1/export/stream
Stream export for large datasets.

**Query Parameters:**
- `datasetId`: Dataset ID to export
- `format`: Export format (csv, json, xlsx)
- `chunkSize`: Chunk size for streaming (default: 1000)

**Response:** Streaming response with chunked data

## Real-time Communication

### WebSocket Connection
Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001/api/v1/websocket');

ws.onopen = function() {
    // Send authentication
    ws.send(JSON.stringify({
        type: 'auth',
        token: 'your-jwt-token'
    }));
};

ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
};
```

### Server-Sent Events
Connect to SSE for server-pushed events:

```javascript
const eventSource = new EventSource('/api/v1/sse/events');

eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('SSE Event:', data);
};
```

---

# Client Examples

## JavaScript/Node.js

### Basic Setup
```javascript
const axios = require('axios');

class DataCloakClient {
    constructor(baseURL, token) {
        this.client = axios.create({
            baseURL: baseURL,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async analyzeSentiment(text, options = {}) {
        try {
            const response = await this.client.post('/api/v1/sentiment/analyze', {
                text,
                options
            });
            return response.data;
        } catch (error) {
            throw new Error(`Sentiment analysis failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async detectPII(text, options = {}) {
        try {
            const response = await this.client.post('/api/v1/security/detect', {
                text,
                options
            });
            return response.data;
        } catch (error) {
            throw new Error(`PII detection failed: ${error.response?.data?.error || error.message}`);
        }
    }

    async uploadDataset(filePath, metadata = {}) {
        const FormData = require('form-data');
        const fs = require('fs');
        
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('metadata', JSON.stringify(metadata));

        try {
            const response = await this.client.post('/api/v1/data/upload', form, {
                headers: form.getHeaders(),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            return response.data;
        } catch (error) {
            throw new Error(`Upload failed: ${error.response?.data?.error || error.message}`);
        }
    }
}

// Usage
const client = new DataCloakClient('http://localhost:3001', 'your-jwt-token');

async function example() {
    // Analyze sentiment
    const sentiment = await client.analyzeSentiment('I love this product!', {
        model: 'gpt-4',
        includeEmotions: true
    });
    console.log('Sentiment:', sentiment);

    // Detect PII
    const pii = await client.detectPII('My email is john@example.com', {
        types: ['EMAIL', 'PHONE']
    });
    console.log('PII Detected:', pii);

    // Upload dataset
    const upload = await client.uploadDataset('./data.csv', {
        name: 'Sample Data',
        description: 'Sample dataset for testing'
    });
    console.log('Upload Result:', upload);
}
```

## Python

### Basic Setup
```python
import requests
import json
from typing import Dict, List, Optional

class DataCloakClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })

    def analyze_sentiment(self, text: str, options: Dict = None) -> Dict:
        """Analyze sentiment of text"""
        if options is None:
            options = {}
        
        response = self.session.post(
            f'{self.base_url}/api/v1/sentiment/analyze',
            json={'text': text, 'options': options}
        )
        response.raise_for_status()
        return response.json()

    def detect_pii(self, text: str, options: Dict = None) -> Dict:
        """Detect PII in text"""
        if options is None:
            options = {}
        
        response = self.session.post(
            f'{self.base_url}/api/v1/security/detect',
            json={'text': text, 'options': options}
        )
        response.raise_for_status()
        return response.json()

    def batch_analyze_sentiment(self, texts: List[str], options: Dict = None) -> Dict:
        """Batch analyze sentiment for multiple texts"""
        if options is None:
            options = {}
        
        response = self.session.post(
            f'{self.base_url}/api/v1/sentiment/batch',
            json={'texts': texts, 'options': options}
        )
        response.raise_for_status()
        return response.json()

    def upload_dataset(self, file_path: str, metadata: Dict = None) -> Dict:
        """Upload a dataset file"""
        if metadata is None:
            metadata = {}
        
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'metadata': json.dumps(metadata)}
            
            # Temporarily remove Content-Type for multipart upload
            headers = self.session.headers.copy()
            if 'Content-Type' in headers:
                del headers['Content-Type']
            
            response = requests.post(
                f'{self.base_url}/api/v1/data/upload',
                files=files,
                data=data,
                headers={k: v for k, v in headers.items() if k != 'Content-Type'}
            )
            response.raise_for_status()
            return response.json()

    def get_job_status(self, job_id: str) -> Dict:
        """Get status of a processing job"""
        response = self.session.get(f'{self.base_url}/api/v1/jobs/{job_id}')
        response.raise_for_status()
        return response.json()

# Usage example
if __name__ == "__main__":
    client = DataCloakClient('http://localhost:3001', 'your-jwt-token')
    
    # Analyze sentiment
    result = client.analyze_sentiment('I love this product!', {
        'model': 'gpt-4',
        'includeEmotions': True
    })
    print('Sentiment:', result)
    
    # Detect PII
    pii_result = client.detect_pii('My email is john@example.com')
    print('PII Detected:', pii_result)
    
    # Batch analysis
    texts = [
        'This is great!',
        'I hate this service.',
        'It\'s okay, I guess.'
    ]
    batch_result = client.batch_analyze_sentiment(texts)
    print('Batch Analysis:', batch_result)
```

## cURL Examples

### Authentication
```bash
# Login to get JWT token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Export token for subsequent requests
export JWT_TOKEN="your-jwt-token-here"
```

### Sentiment Analysis
```bash
# Single text analysis
curl -X POST http://localhost:3001/api/v1/sentiment/analyze \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I love this product!",
    "options": {
      "model": "gpt-4",
      "includeEmotions": true
    }
  }'

# Batch analysis
curl -X POST http://localhost:3001/api/v1/sentiment/batch \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Great product!", "Terrible service", "It was okay"],
    "options": {"model": "gpt-4"}
  }'
```

### PII Detection
```bash
# Detect PII
curl -X POST http://localhost:3001/api/v1/security/detect \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "My email is john@example.com and phone is 555-123-4567",
    "options": {
      "types": ["EMAIL", "PHONE"],
      "confidence": 0.8
    }
  }'

# Mask PII
curl -X POST http://localhost:3001/api/v1/security/mask \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Contact john@example.com for more info",
    "options": {"maskChar": "*", "preserveLength": true}
  }'
```

### File Upload
```bash
# Upload dataset
curl -X POST http://localhost:3001/api/v1/data/upload \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@/path/to/your/data.csv" \
  -F 'metadata={"name": "Sample Data", "description": "Test dataset"}'
```

### Job Management
```bash
# Create job
curl -X POST http://localhost:3001/api/v1/jobs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sentiment_analysis",
    "data": {
      "datasetId": "dataset_abc123",
      "options": {"model": "gpt-4"}
    },
    "priority": "high"
  }'

# Check job status
curl -X GET http://localhost:3001/api/v1/jobs/job_xyz789 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

# SDKs and Libraries

## Official SDKs

### JavaScript/TypeScript SDK
```bash
npm install @datacloak/sentiment-sdk
```

```typescript
import { DataCloakClient } from '@datacloak/sentiment-sdk';

const client = new DataCloakClient({
  baseURL: 'http://localhost:3001',
  token: 'your-jwt-token'
});

// TypeScript support with full type definitions
const result = await client.sentiment.analyze('I love this!', {
  model: 'gpt-4',
  includeEmotions: true
});
```

### Python SDK
```bash
pip install datacloak-sentiment-sdk
```

```python
from datacloak_sentiment import DataCloakClient

client = DataCloakClient(
    base_url='http://localhost:3001',
    token='your-jwt-token'
)

result = client.sentiment.analyze('I love this!', model='gpt-4')
```

## Third-party Libraries

### OpenAPI Generated Clients
The API provides an OpenAPI 3.0 specification that can be used to generate clients in various languages:

- **OpenAPI Specification**: Available at `/api/v1/openapi.json`
- **Swagger UI**: Available at `/api/v1/docs`

Generate clients using OpenAPI Generator:
```bash
# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:3001/api/v1/openapi.json \
  -g python \
  -o ./datacloak-python-client

# Generate Java client
openapi-generator-cli generate \
  -i http://localhost:3001/api/v1/openapi.json \
  -g java \
  -o ./datacloak-java-client
```

---

This comprehensive API documentation covers all endpoints, provides detailed examples, and includes client libraries for easy integration with the DataCloak Sentiment Workbench API.