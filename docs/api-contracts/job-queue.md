# Job Queue API

This document covers the background job processing system for handling long-running operations like batch sentiment analysis, large file processing, security scans, and data exports.

## 🔄 Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/jobs` | POST | Create a new background job |
| `/api/v1/jobs/:id` | GET | Get job status and progress |
| `/api/v1/jobs` | GET | List jobs with filtering |
| `/api/v1/jobs/:id` | DELETE | Cancel a running job |
| `/api/v1/jobs/stats/summary` | GET | Get queue statistics |
| `/api/v1/jobs/:id/wait` | POST | Wait for job completion |

---

## 📝 Job Types

The system supports four types of background jobs:

```typescript
type JobType = 
  | 'sentiment_analysis_batch'  // Batch sentiment analysis
  | 'file_processing'          // Large file processing with chunking
  | 'security_scan'            // Comprehensive security scanning
  | 'data_export';             // Data export in various formats
```

### Job Priorities
```typescript
type JobPriority = 'low' | 'medium' | 'high' | 'critical';
```

### Job Status Lifecycle
```typescript
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
```

---

## ✨ Create Job

Create a new background job for processing.

### `POST /api/v1/jobs`

#### Request Body
```json
{
  "type": "sentiment_analysis_batch",
  "data": {
    "texts": [
      "I love this product!",
      "This is terrible quality.",
      "Average experience, nothing special."
    ],
    "enablePIIMasking": true
  },
  "priority": "high"
}
```

#### Request Schema
```typescript
interface CreateJobRequest {
  type: JobType;                    // Required: Job type
  data: JobData;                    // Required: Job-specific data
  priority?: JobPriority;           // Optional: Job priority (default: 'medium')
}

// Job-specific data types
type JobData = 
  | SentimentAnalysisBatchData
  | FileProcessingData
  | SecurityScanData
  | DataExportData;
```

#### Job Data Types

##### Sentiment Analysis Batch
```typescript
interface SentimentAnalysisBatchData {
  texts: string[];                  // Array of texts to analyze (max 10,000)
  enablePIIMasking?: boolean;       // Enable PII masking (default: true)
  includeKeywords?: boolean;        // Include keyword extraction
  language?: string;                // Language code (default: 'en')
}
```

##### File Processing
```typescript
interface FileProcessingData {
  filePath: string;                 // Path to file to process
  datasetId: string;                // Dataset identifier
  processingType?: 'parse' | 'analyze'; // Processing type (default: 'parse')
  chunkSize?: number;               // Chunk size in bytes (default: 256MB)
}
```

##### Security Scan
```typescript
interface SecurityScanData {
  filePath: string;                 // Path to file to scan
  datasetId: string;                // Dataset identifier
  scanType?: 'quick' | 'full';     // Scan type (default: 'full')
  complianceFramework?: string[];   // Compliance frameworks to check
}
```

##### Data Export
```typescript
interface DataExportData {
  datasetId: string;                // Dataset to export
  format: 'csv' | 'json' | 'xlsx'; // Export format
  filters?: {                       // Optional filters
    sentiment?: 'positive' | 'negative' | 'neutral';
    dateRange?: {
      start: string;
      end: string;
    };
    limit?: number;
  };
  includeMetadata?: boolean;        // Include export metadata
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "type": "sentiment_analysis_batch",
    "status": "pending",
    "priority": "high",
    "createdAt": "2025-06-15T10:30:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Responses
```json
{
  "success": false,
  "error": "Invalid job type",
  "details": {
    "code": "INVALID_JOB_TYPE",
    "allowedTypes": ["sentiment_analysis_batch", "file_processing", "security_scan", "data_export"]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📊 Get Job Status

Retrieve the current status and progress of a specific job.

### `GET /api/v1/jobs/:id`

#### Path Parameters
- `id`: Job UUID

#### Request
```http
GET /api/v1/jobs/550e8400-e29b-41d4-a716-446655440000
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "sentiment_analysis_batch",
    "status": "running",
    "priority": "high",
    "progress": 65.5,
    "createdAt": "2025-06-15T10:30:00.000Z",
    "startedAt": "2025-06-15T10:30:15.000Z",
    "estimatedCompletion": "2025-06-15T10:32:00.000Z",
    "processingStats": {
      "totalItems": 1000,
      "processedItems": 655,
      "failedItems": 5,
      "averageProcessingTime": 45,
      "currentSpeed": "22 items/second"
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Completed Job)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "sentiment_analysis_batch",
    "status": "completed",
    "priority": "high",
    "progress": 100,
    "createdAt": "2025-06-15T10:30:00.000Z",
    "startedAt": "2025-06-15T10:30:15.000Z",
    "completedAt": "2025-06-15T10:31:45.000Z",
    "result": {
      "totalProcessed": 1000,
      "results": [
        {
          "text": "I love this product!",
          "sentiment": "positive",
          "score": 0.8,
          "confidence": 0.95
        }
      ],
      "summary": {
        "successful": 995,
        "failed": 5,
        "averageScore": 0.15,
        "distribution": {
          "positive": 450,
          "negative": 300,
          "neutral": 245
        }
      }
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Job not found",
  "details": {
    "code": "JOB_NOT_FOUND",
    "jobId": "invalid-uuid"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📋 List Jobs

List jobs with optional filtering and pagination.

### `GET /api/v1/jobs`

#### Query Parameters
- `status` (optional): Filter by job status
- `type` (optional): Filter by job type
- `priority` (optional): Filter by priority
- `limit` (optional): Number of jobs to return (default: 50, max: 100)
- `page` (optional): Page number (default: 1)

#### Request Examples
```http
# Get all jobs
GET /api/v1/jobs

# Filter by status
GET /api/v1/jobs?status=running

# Filter by type and priority
GET /api/v1/jobs?type=sentiment_analysis_batch&priority=high

# Paginated results
GET /api/v1/jobs?page=2&limit=20
```

#### Response
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "sentiment_analysis_batch",
        "status": "running",
        "priority": "high",
        "progress": 65.5,
        "createdAt": "2025-06-15T10:30:00.000Z",
        "startedAt": "2025-06-15T10:30:15.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "type": "file_processing",
        "status": "pending",
        "priority": "medium",
        "progress": 0,
        "createdAt": "2025-06-15T10:25:00.000Z"
      }
    ],
    "total": 25
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## ❌ Cancel Job

Cancel a pending or running job.

### `DELETE /api/v1/jobs/:id`

#### Path Parameters
- `id`: Job UUID

#### Request
```http
DELETE /api/v1/jobs/550e8400-e29b-41d4-a716-446655440000
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Job cancelled successfully",
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Job not found or cannot be cancelled",
  "details": {
    "code": "JOB_NOT_CANCELLABLE",
    "currentStatus": "completed"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Cancellation Rules
- **Pending jobs**: Can be cancelled immediately
- **Running jobs**: Will be cancelled at next safe checkpoint
- **Completed jobs**: Cannot be cancelled
- **Failed jobs**: Cannot be cancelled

---

## 📊 Queue Statistics

Get overview statistics about the job queue performance.

### `GET /api/v1/jobs/stats/summary`

#### Request
```http
GET /api/v1/jobs/stats/summary
```

#### Response
```json
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 5,
    "running": 3,
    "completed": 135,
    "failed": 5,
    "cancelled": 2,
    "performance": {
      "averageProcessingTime": 45000,
      "throughput": "25 jobs/minute",
      "successRate": 94.7,
      "peakConcurrency": 5
    },
    "byType": {
      "sentiment_analysis_batch": {
        "total": 80,
        "completed": 75,
        "failed": 3,
        "cancelled": 2
      },
      "file_processing": {
        "total": 35,
        "completed": 32,
        "failed": 2,
        "cancelled": 1
      },
      "security_scan": {
        "total": 25,
        "completed": 25,
        "failed": 0,
        "cancelled": 0
      },
      "data_export": {
        "total": 10,
        "completed": 8,
        "failed": 1,
        "cancelled": 1
      }
    },
    "byPriority": {
      "critical": 2,
      "high": 15,
      "medium": 80,
      "low": 53
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## ⏳ Wait for Completion

Wait for a job to complete with a specified timeout.

### `POST /api/v1/jobs/:id/wait`

#### Path Parameters
- `id`: Job UUID

#### Request Body
```json
{
  "timeout": 30000
}
```

#### Request Schema
```typescript
interface WaitForJobRequest {
  timeout?: number;                 // Timeout in milliseconds (default: 30000, max: 300000)
}
```

#### Response (Completed)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "sentiment_analysis_batch",
    "status": "completed",
    "progress": 100,
    "result": {
      // Job result data
    },
    "completedAt": "2025-06-15T10:31:45.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Timeout)
```json
{
  "success": false,
  "error": "Job timeout",
  "details": {
    "code": "JOB_TIMEOUT",
    "currentStatus": "running",
    "currentProgress": 65.5
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## ⚙️ Job Processing Architecture

### Queue Management
```typescript
interface QueueConfig {
  maxConcurrentJobs: 3;             // Maximum simultaneous jobs
  priorityScheduling: true;         // Process high priority first
  retryPolicy: {
    maxRetries: 3;
    backoffStrategy: 'exponential';
    retryableErrors: ['NETWORK_ERROR', 'TEMPORARY_FAILURE'];
  };
  cleanup: {
    completedJobTTL: 86400000;      // 24 hours
    failedJobTTL: 259200000;        // 72 hours
  };
}
```

### Progress Tracking
```typescript
interface ProgressTracking {
  updateInterval: 1000;             // Update progress every second
  metrics: [
    'itemsProcessed',
    'itemsRemaining',
    'processingSpeed',
    'estimatedCompletion',
    'memoryUsage'
  ];
  callbacks: {
    onProgress: (job: Job, progress: number) => void;
    onComplete: (job: Job, result: any) => void;
    onError: (job: Job, error: Error) => void;
  };
}
```

### Job Handlers
Each job type has a dedicated handler:

```typescript
interface JobHandler {
  type: JobType;
  execute: (job: Job, updateProgress: ProgressCallback) => Promise<any>;
  validate: (data: any) => ValidationResult;
  estimateTime: (data: any) => number;
  estimateMemory: (data: any) => number;
}
```

---

## 🔧 Validation Rules

### Job Creation Validation
```typescript
interface JobValidation {
  type: {
    required: true;
    enum: ['sentiment_analysis_batch', 'file_processing', 'security_scan', 'data_export'];
  };
  data: {
    required: true;
    type: 'object';
    // Validation varies by job type
  };
  priority: {
    optional: true;
    enum: ['low', 'medium', 'high', 'critical'];
    default: 'medium';
  };
}
```

### Job-Specific Validation

#### Sentiment Analysis Batch
```typescript
interface SentimentBatchValidation {
  texts: {
    required: true;
    type: 'array';
    minItems: 1;
    maxItems: 10000;
    items: {
      type: 'string';
      minLength: 1;
      maxLength: 10000;
    };
  };
  enablePIIMasking: {
    type: 'boolean';
    default: true;
  };
}
```

#### File Processing
```typescript
interface FileProcessingValidation {
  filePath: {
    required: true;
    type: 'string';
    pattern: '^[a-zA-Z0-9/_.-]+$';  // Safe file path
  };
  datasetId: {
    required: true;
    type: 'string';
    format: 'uuid';
  };
  processingType: {
    enum: ['parse', 'analyze'];
    default: 'parse';
  };
}
```

---

## ⚡ Performance Characteristics

### Job Processing Times
```typescript
interface ProcessingTimes {
  sentiment_analysis_batch: {
    '100 texts': '< 10 seconds';
    '1000 texts': '< 60 seconds';
    '10000 texts': '< 10 minutes';
  };
  file_processing: {
    '10MB file': '< 30 seconds';
    '100MB file': '< 5 minutes';
    '1GB file': '< 30 minutes';
  };
  security_scan: {
    'quick scan': '< 30 seconds';
    'full scan': '< 5 minutes per 100MB';
  };
  data_export: {
    '1000 records': '< 10 seconds';
    '100000 records': '< 2 minutes';
  };
}
```

### Memory Usage
```typescript
interface MemoryUsage {
  baseQueue: '10MB';
  perJob: {
    sentiment_analysis_batch: '50MB per 1000 texts';
    file_processing: '256MB per chunk';
    security_scan: '100MB per scan';
    data_export: '50MB per 10000 records';
  };
}
```

### Throughput Limits
```typescript
interface ThroughputLimits {
  maxConcurrentJobs: 3;
  maxQueueSize: 1000;
  maxJobsPerMinute: 60;
  maxJobsPerHour: 3600;
}
```

---

## 🔒 Security Considerations

### Job Data Security
1. **Input Validation**: All job data strictly validated
2. **Resource Limits**: Memory and time limits per job
3. **Access Control**: Jobs isolated from each other
4. **Audit Trail**: All job operations logged

### Error Handling
1. **Graceful Failures**: Jobs fail safely without affecting others
2. **Resource Cleanup**: Automatic cleanup of failed jobs
3. **Error Logging**: Detailed error information for debugging
4. **User Privacy**: No sensitive data in error messages

---

## 🐛 Common Error Scenarios

### Job Creation Errors
```json
{
  "success": false,
  "error": "Invalid job data",
  "details": {
    "code": "INVALID_JOB_DATA",
    "errors": [
      {
        "field": "texts",
        "message": "Array must contain at least 1 item"
      }
    ]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

### Job Processing Errors
```json
{
  "success": false,
  "error": "Job processing failed",
  "details": {
    "code": "JOB_PROCESSING_ERROR",
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "stage": "processing",
    "message": "Memory limit exceeded"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 🚀 Usage Examples

### Complete Job Workflow
```typescript
// 1. Create a sentiment analysis batch job
const createResponse = await fetch('/api/v1/jobs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'sentiment_analysis_batch',
    data: {
      texts: ['Text 1', 'Text 2', 'Text 3'],
      enablePIIMasking: true
    },
    priority: 'high'
  })
});

const { jobId } = createResponse.data;

// 2. Monitor progress
const pollProgress = async () => {
  const statusResponse = await fetch(`/api/v1/jobs/${jobId}`);
  const job = statusResponse.data;
  
  console.log(`Progress: ${job.progress}%`);
  
  if (job.status === 'completed') {
    console.log('Job completed:', job.result);
    return job.result;
  } else if (job.status === 'failed') {
    console.error('Job failed:', job.error);
    throw new Error(job.error);
  }
  
  // Continue polling
  setTimeout(pollProgress, 1000);
};

// 3. Or wait for completion
const waitResponse = await fetch(`/api/v1/jobs/${jobId}/wait`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timeout: 60000 })
});

if (waitResponse.data.status === 'completed') {
  console.log('Job completed:', waitResponse.data.result);
}
```

### Job Queue Management
```typescript
class JobQueueManager {
  async submitBatch(texts: string[], priority: JobPriority = 'medium') {
    const response = await fetch('/api/v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'sentiment_analysis_batch',
        data: { texts, enablePIIMasking: true },
        priority
      })
    });
    
    return response.data.jobId;
  }
  
  async getQueueStatus() {
    const response = await fetch('/api/v1/jobs/stats/summary');
    return response.data;
  }
  
  async cancelJob(jobId: string) {
    const response = await fetch(`/api/v1/jobs/${jobId}`, {
      method: 'DELETE'
    });
    
    return response.success;
  }
  
  async monitorJob(jobId: string, onProgress: (progress: number) => void) {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await fetch(`/api/v1/jobs/${jobId}`);
          const job = response.data;
          
          onProgress(job.progress);
          
          if (job.status === 'completed') {
            resolve(job.result);
          } else if (job.status === 'failed') {
            reject(new Error(job.error));
          } else {
            setTimeout(poll, 1000);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }
}
```

---

This comprehensive documentation covers all job queue functionality for background processing. The system provides reliable, scalable processing for all long-running operations in the DataCloak Sentiment Workbench.