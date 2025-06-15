# Data Management API

This document covers all endpoints related to file upload, dataset management, and data export functionality.

## 📁 Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/data/upload` | POST | Upload CSV/Excel files |
| `/api/v1/data/datasets` | GET | List uploaded datasets |
| `/api/v1/data/datasets/:id` | GET | Get dataset details |
| `/api/v1/data/datasets/:id` | DELETE | Delete a dataset |
| `/api/v1/data/export` | POST | Export data in various formats |

---

## 📤 File Upload

Upload CSV or Excel files for processing and analysis.

### `POST /api/v1/data/upload`

#### Request
```http
POST /api/v1/data/upload
Content-Type: multipart/form-data

form-data:
  file: [binary file data]
```

#### Supported File Types
- **CSV**: `text/csv`, `text/plain`
- **Excel**: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Maximum Size**: 50GB
- **Processing**: Automatic chunked processing for files >100MB

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "dataset": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "generated-uuid.csv",
      "originalFilename": "customer-data.csv",
      "size": 2048576,
      "recordCount": 10000,
      "mimeType": "text/csv",
      "createdAt": "2025-06-15T10:30:00.000Z",
      "updatedAt": "2025-06-15T10:30:00.000Z"
    },
    "previewData": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "555-1234"
      },
      // ... up to 100 preview rows
    ],
    "fieldInfo": [
      {
        "name": "id",
        "type": "integer",
        "sampleValues": [1, 2, 3, 4, 5],
        "nullCount": 0,
        "piiDetected": false
      },
      {
        "name": "email",
        "type": "string",
        "sampleValues": ["john@example.com", "jane@example.com"],
        "nullCount": 2,
        "piiDetected": true,
        "piiType": "EMAIL"
      }
    ],
    "securityScan": {
      "piiItemsDetected": 25,
      "complianceScore": 0.85,
      "riskLevel": "medium",
      "recommendations": [
        "Enable field-level encryption for sensitive columns",
        "Implement data retention policies"
      ]
    }
  },
  "message": "File uploaded and processed successfully",
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Error)
```json
{
  "success": false,
  "error": "Unsupported file type. Only CSV and Excel files are allowed.",
  "details": {
    "code": "INVALID_FILE_TYPE",
    "providedType": "application/pdf"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Codes
- `NO_FILE` - No file provided in request
- `INVALID_FILE_TYPE` - Unsupported file format
- `FILE_TOO_LARGE` - File exceeds 50GB limit
- `UPLOAD_PROCESSING_ERROR` - Failed to process uploaded file

#### Large File Processing
For files >100MB, the system automatically uses chunked processing:

```typescript
interface ChunkedProcessing {
  chunkSize: 256 * 1024 * 1024; // 256MB
  progressTracking: boolean;
  memoryOptimized: boolean;
  fallbackEnabled: boolean;
}
```

---

## 📋 Dataset Listing

List all uploaded datasets with pagination and filtering.

### `GET /api/v1/data/datasets`

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10, max: 100)

#### Request
```http
GET /api/v1/data/datasets?page=1&pageSize=20
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "550e8400-e29b-41d4-a716-446655440000.csv",
      "originalFilename": "customer-data.csv",
      "size": 2048576,
      "recordCount": 10000,
      "mimeType": "text/csv",
      "createdAt": "2025-06-15T10:30:00.000Z",
      "updatedAt": "2025-06-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📊 Dataset Details

Get detailed information about a specific dataset.

### `GET /api/v1/data/datasets/:id`

#### Path Parameters
- `id`: Dataset UUID

#### Request
```http
GET /api/v1/data/datasets/550e8400-e29b-41d4-a716-446655440000
```

#### Response
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "550e8400-e29b-41d4-a716-446655440000.csv",
    "originalFilename": "customer-data.csv",
    "size": 2048576,
    "recordCount": 10000,
    "mimeType": "text/csv",
    "createdAt": "2025-06-15T10:30:00.000Z",
    "updatedAt": "2025-06-15T10:30:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Dataset not found",
  "details": {
    "code": "DATASET_NOT_FOUND",
    "datasetId": "invalid-uuid"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 🗑️ Dataset Deletion

Delete a dataset and its associated files.

### `DELETE /api/v1/data/datasets/:id`

#### Path Parameters
- `id`: Dataset UUID

#### Request
```http
DELETE /api/v1/data/datasets/550e8400-e29b-41d4-a716-446655440000
```

#### Response
```json
{
  "success": true,
  "message": "Dataset deleted successfully",
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Dataset not found",
  "details": {
    "code": "DATASET_NOT_FOUND"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📤 Data Export

Export processed data in various formats.

### `POST /api/v1/data/export`

#### Request Body
```json
{
  "format": "csv",
  "filters": {
    "sentiment": "positive",
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-12-31"
    }
  },
  "options": {
    "includeHeaders": true,
    "delimiter": ",",
    "encoding": "utf-8"
  }
}
```

#### Request Schema
```typescript
interface ExportRequest {
  format: 'csv' | 'json' | 'xlsx';
  filters?: {
    sentiment?: 'positive' | 'negative' | 'neutral';
    dateRange?: {
      start: string; // ISO date
      end: string;   // ISO date
    };
    score?: {
      min: number;   // -1 to 1
      max: number;   // -1 to 1
    };
    limit?: number;  // Max records to export
  };
  options?: {
    includeHeaders?: boolean;
    delimiter?: string;      // For CSV format
    encoding?: string;       // utf-8, ascii, etc.
    compression?: boolean;   // Gzip compression
  };
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "downloadUrl": "/api/v1/downloads/export-550e8400-e29b-41d4-a716-446655440000.csv",
    "expiresAt": "2025-06-15T11:30:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Export Formats

##### CSV Export
```csv
id,text,sentiment,score,confidence,created_at
1,"I love this product!",positive,0.8,0.95,"2025-06-15T10:30:00.000Z"
2,"This is terrible",negative,-0.7,0.85,"2025-06-15T10:30:00.000Z"
```

##### JSON Export
```json
{
  "metadata": {
    "exportedAt": "2025-06-15T10:30:00.000Z",
    "recordCount": 1000,
    "format": "json"
  },
  "data": [
    {
      "id": 1,
      "text": "I love this product!",
      "sentiment": "positive",
      "score": 0.8,
      "confidence": 0.95,
      "createdAt": "2025-06-15T10:30:00.000Z"
    }
  ]
}
```

---

## 🔧 Validation Rules

### File Upload Validation
```typescript
interface UploadValidation {
  fileRequired: true;
  maxFileSize: 50 * 1024 * 1024 * 1024; // 50GB
  allowedMimeTypes: [
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
}
```

### Dataset ID Validation
```typescript
interface DatasetIdValidation {
  format: 'uuid';
  required: true;
  version: 4; // UUID v4
}
```

### Export Validation
```typescript
interface ExportValidation {
  format: {
    required: true;
    enum: ['csv', 'json', 'xlsx'];
  };
  filters: {
    optional: true;
    sentiment: {
      enum: ['positive', 'negative', 'neutral'];
    };
    dateRange: {
      start: 'ISO date string';
      end: 'ISO date string';
    };
    score: {
      min: { min: -1, max: 1 };
      max: { min: -1, max: 1 };
    };
    limit: { min: 1, max: 100000 };
  };
}
```

---

## 🚀 Performance Characteristics

### Upload Performance
- **Small files (<10MB)**: Processed immediately
- **Medium files (10MB-100MB)**: Streamed processing
- **Large files (>100MB)**: Chunked processing with progress tracking
- **Maximum throughput**: ~100MB/second (hardware dependent)

### Processing Time Estimates
```typescript
interface ProcessingTime {
  small: '<1 second';      // <10MB
  medium: '1-10 seconds';  // 10MB-100MB
  large: '10+ seconds';    // >100MB
  factors: [
    'File size',
    'Row count',
    'Column count',
    'Data complexity',
    'PII detection'
  ];
}
```

### Memory Usage
- **Base processing**: ~50MB
- **Chunked processing**: ~256MB per chunk
- **Preview generation**: ~10MB for 100 rows
- **Field inference**: ~20MB per 1000 columns

---

## 🔒 Security Considerations

### File Upload Security
1. **File type validation**: Strict MIME type checking
2. **Size limits**: 50GB maximum file size
3. **Virus scanning**: Future implementation
4. **Content validation**: Malicious content detection

### Data Privacy
1. **Local processing**: All data processed locally
2. **PII detection**: Automatic scanning during upload
3. **Secure storage**: Files stored with restricted access
4. **Data retention**: Configurable retention policies

### Access Control
1. **File isolation**: Each upload gets unique directory
2. **Path traversal protection**: Validated file paths
3. **Temporary files**: Automatic cleanup after processing
4. **Secure deletion**: Overwrite files before deletion

---

## 🐛 Error Handling

### Common Error Scenarios

#### File Upload Errors
```typescript
enum UploadError {
  NO_FILE = 'No file provided',
  INVALID_FILE_TYPE = 'Unsupported file type',
  FILE_TOO_LARGE = 'File exceeds size limit',
  CORRUPTED_FILE = 'File is corrupted or unreadable',
  PROCESSING_ERROR = 'Failed to process file'
}
```

#### Dataset Access Errors
```typescript
enum DatasetError {
  NOT_FOUND = 'Dataset not found',
  ACCESS_DENIED = 'Access denied to dataset',
  ALREADY_DELETED = 'Dataset has been deleted',
  PROCESSING = 'Dataset is still being processed'
}
```

### Error Recovery
1. **Retry mechanisms**: Automatic retry for transient failures
2. **Partial recovery**: Save progress when possible
3. **Cleanup procedures**: Remove incomplete uploads
4. **User notification**: Clear error messages with suggested actions

---

## 📈 Usage Examples

### Complete Upload Workflow
```typescript
// 1. Upload file
const uploadResponse = await fetch('/api/v1/data/upload', {
  method: 'POST',
  body: formData
});

// 2. Check dataset
const dataset = uploadResponse.data.dataset;

// 3. Review security scan
const securityScan = uploadResponse.data.securityScan;
if (securityScan.riskLevel === 'high') {
  // Handle high-risk data
}

// 4. Process or export as needed
const exportResponse = await fetch('/api/v1/data/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    format: 'csv',
    filters: { sentiment: 'positive' }
  })
});
```

### Large File Processing
```typescript
// Monitor large file upload progress
const fileInput = document.getElementById('file');
const file = fileInput.files[0];

if (file.size > 100 * 1024 * 1024) { // >100MB
  console.log('Large file detected - chunked processing will be used');
  
  // The API automatically handles chunking
  // Progress can be monitored via job queue system
}
```

---

This comprehensive documentation covers all data management functionality. For job queue monitoring of long-running operations, see the [Job Queue API documentation](./job-queue.md).