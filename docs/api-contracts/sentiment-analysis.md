# Sentiment Analysis API

This document covers all endpoints related to text sentiment analysis, including single text analysis, batch processing, and historical data retrieval.

## 📊 Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sentiment/analyze` | POST | Analyze single text |
| `/api/v1/sentiment/batch` | POST | Batch analyze multiple texts |
| `/api/v1/sentiment/history` | GET | Get analysis history |
| `/api/v1/sentiment/statistics` | GET | Get aggregate statistics |

---

## 🔍 Single Text Analysis

Analyze the sentiment of a single piece of text.

### `POST /api/v1/sentiment/analyze`

#### Request Body
```json
{
  "text": "I absolutely love this product! It exceeded all my expectations.",
  "options": {
    "enablePIIMasking": true,
    "includeKeywords": false,
    "language": "en"
  }
}
```

#### Request Schema
```typescript
interface SentimentAnalysisRequest {
  text: string;                    // Required: Text to analyze (max 10,000 chars)
  options?: {
    enablePIIMasking?: boolean;    // Optional: Mask PII before analysis (default: true)
    includeKeywords?: boolean;     // Optional: Include keyword extraction (default: false)
    language?: string;             // Optional: Language code (default: 'en')
  };
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "text": "I absolutely love this product! It exceeded all my expectations.",
    "maskedText": "I absolutely love this product! It exceeded all my expectations.",
    "sentiment": "positive",
    "score": 0.85,
    "confidence": 0.92,
    "keywords": ["love", "exceeded", "expectations"],
    "processingTime": 45,
    "piiDetected": false,
    "createdAt": "2025-06-15T10:30:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response Fields
```typescript
interface SentimentResult {
  id: string;                      // Unique analysis ID
  text: string;                    // Original text
  maskedText?: string;             // PII-masked text (if masking enabled)
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;                   // Sentiment score (-1 to 1)
  confidence: number;              // Confidence level (0 to 1)
  keywords?: string[];             // Extracted keywords (if enabled)
  processingTime: number;          // Processing time in milliseconds
  piiDetected: boolean;            // Whether PII was found and masked
  createdAt: string;               // ISO timestamp
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Text is required",
  "details": {
    "code": "VALIDATION_ERROR",
    "field": "text"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Error Codes
- `VALIDATION_ERROR` - Invalid or missing text
- `TEXT_TOO_LONG` - Text exceeds 10,000 character limit
- `PROCESSING_ERROR` - Internal analysis error
- `PII_MASKING_ERROR` - Failed to mask PII

---

## 📚 Batch Analysis

Analyze multiple texts in a single request for improved efficiency.

### `POST /api/v1/sentiment/batch`

#### Request Body
```json
{
  "texts": [
    "I love this product!",
    "This is terrible quality.",
    "It's okay, nothing special.",
    "Amazing customer service!"
  ],
  "options": {
    "enablePIIMasking": true,
    "includeKeywords": false
  }
}
```

#### Request Schema
```typescript
interface BatchSentimentRequest {
  texts: string[];                 // Required: Array of texts (max 1,000 items)
  options?: {
    enablePIIMasking?: boolean;    // Optional: Mask PII before analysis (default: true)
    includeKeywords?: boolean;     // Optional: Include keyword extraction (default: false)
    language?: string;             // Optional: Language code (default: 'en')
  };
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "text": "I love this product!",
      "sentiment": "positive",
      "score": 0.8,
      "confidence": 0.95,
      "processingTime": 12,
      "piiDetected": false,
      "createdAt": "2025-06-15T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "text": "This is terrible quality.",
      "sentiment": "negative",
      "score": -0.7,
      "confidence": 0.88,
      "processingTime": 10,
      "piiDetected": false,
      "createdAt": "2025-06-15T10:30:00.000Z"
    }
  ],
  "summary": {
    "total": 4,
    "processed": 4,
    "failed": 0,
    "averageScore": 0.15,
    "averageConfidence": 0.91,
    "averageProcessingTime": 11.5,
    "distribution": {
      "positive": 2,
      "negative": 1,
      "neutral": 1
    },
    "piiItemsMasked": 0
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Batch Processing Limits
```typescript
interface BatchLimits {
  maxTexts: 1000;                  // Maximum texts per batch
  maxTextLength: 10000;            // Maximum characters per text
  maxTotalLength: 1000000;         // Maximum total characters in batch
  timeoutSeconds: 300;             // 5-minute timeout
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Batch size exceeds maximum limit of 1000 texts",
  "details": {
    "code": "BATCH_TOO_LARGE",
    "provided": 1500,
    "maximum": 1000
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📜 Analysis History

Retrieve historical sentiment analysis results with pagination and filtering.

### `GET /api/v1/sentiment/history`

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 200)
- `sentiment` (optional): Filter by sentiment ('positive', 'negative', 'neutral')
- `startDate` (optional): Filter from date (ISO string)
- `endDate` (optional): Filter to date (ISO string)
- `minScore` (optional): Minimum sentiment score (-1 to 1)
- `maxScore` (optional): Maximum sentiment score (-1 to 1)

#### Request Examples
```http
# Get recent history
GET /api/v1/sentiment/history?page=1&limit=20

# Filter positive sentiment
GET /api/v1/sentiment/history?sentiment=positive&limit=10

# Filter by date range
GET /api/v1/sentiment/history?startDate=2025-01-01&endDate=2025-06-15

# Filter by score range
GET /api/v1/sentiment/history?minScore=0.5&maxScore=1.0
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "text": "I love this product!",
      "sentiment": "positive",
      "score": 0.8,
      "confidence": 0.95,
      "createdAt": "2025-06-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📊 Statistics

Get aggregate statistics about sentiment analysis results.

### `GET /api/v1/sentiment/statistics`

#### Query Parameters
- `period` (optional): Time period ('24h', '7d', '30d', 'all') (default: '7d')
- `groupBy` (optional): Group results by ('day', 'week', 'month') (default: 'day')

#### Request
```http
GET /api/v1/sentiment/statistics?period=7d&groupBy=day
```

#### Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalAnalyses": 1500,
      "averageScore": 0.23,
      "averageConfidence": 0.87,
      "distribution": {
        "positive": 650,
        "negative": 450,
        "neutral": 400
      },
      "distributionPercentage": {
        "positive": 43.3,
        "negative": 30.0,
        "neutral": 26.7
      }
    },
    "trends": [
      {
        "date": "2025-06-09",
        "count": 200,
        "averageScore": 0.15,
        "distribution": {
          "positive": 85,
          "negative": 65,
          "neutral": 50
        }
      },
      {
        "date": "2025-06-10",
        "count": 180,
        "averageScore": 0.28,
        "distribution": {
          "positive": 90,
          "negative": 45,
          "neutral": 45
        }
      }
    ],
    "topKeywords": [
      {
        "keyword": "love",
        "frequency": 45,
        "averageScore": 0.85
      },
      {
        "keyword": "hate",
        "frequency": 32,
        "averageScore": -0.75
      }
    ],
    "scoreDistribution": {
      "veryNegative": 12,    // -1.0 to -0.6
      "negative": 28,        // -0.6 to -0.2
      "neutral": 35,         // -0.2 to 0.2
      "positive": 20,        // 0.2 to 0.6
      "veryPositive": 5      // 0.6 to 1.0
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 🔧 Sentiment Analysis Engine

### Algorithm Details
The sentiment analysis uses a keyword-based approach with the following characteristics:

#### Scoring Method
```typescript
interface SentimentScoring {
  method: 'keyword-based';
  positiveWords: string[];     // 2000+ positive keywords
  negativeWords: string[];     // 2000+ negative keywords
  scoreRange: [-1, 1];         // -1 (very negative) to 1 (very positive)
  neutralThreshold: 0.1;       // |score| < 0.1 = neutral
}
```

#### Confidence Calculation
```typescript
interface ConfidenceCalculation {
  factors: [
    'keyword_frequency',       // How many sentiment words found
    'text_length',            // Longer text = higher confidence
    'word_strength',          // Strong words = higher confidence
    'context_clarity'         // Clear context = higher confidence
  ];
  range: [0, 1];              // 0 (no confidence) to 1 (very confident)
}
```

#### PII Masking Integration
```typescript
interface PIIMasking {
  enabled: true;               // Default enabled
  patterns: [
    'EMAIL',                  // email@domain.com → [EMAIL]
    'PHONE',                  // 555-1234 → [PHONE]
    'SSN',                    // 123-45-6789 → [SSN]
    'CREDIT_CARD',           // 4111-1111-1111-1111 → [CARD]
    'NAME',                   // John Doe → [NAME]
    'DATE_OF_BIRTH'          // 01/01/1990 → [DOB]
  ];
  impact: 'minimal';          // Masking preserves sentiment context
}
```

---

## ⚡ Performance Characteristics

### Response Times (P95)
```typescript
interface PerformanceMetrics {
  singleAnalysis: '< 50ms';
  batchAnalysis: {
    '10 texts': '< 200ms',
    '100 texts': '< 1.5s',
    '1000 texts': '< 15s'
  };
  historyRetrieval: '< 100ms';
  statistics: '< 200ms';
}
```

### Throughput Capacity
```typescript
interface ThroughputLimits {
  singleRequests: '1000 requests/second';
  batchRequests: '100 batches/second';
  concurrentAnalyses: '50 parallel requests';
  dailyLimit: 'unlimited';
}
```

### Memory Usage
```typescript
interface MemoryUsage {
  singleAnalysis: '< 1MB';
  batchAnalysis: '< 10MB per 1000 texts';
  keywordDictionary: '5MB cached';
  historyStorage: 'SQLite database';
}
```

---

## 🔒 Security & Privacy

### PII Protection
1. **Automatic Detection**: Scans for common PII patterns
2. **Masking Options**: Replace, encrypt, or redact PII
3. **Audit Trail**: Logs all PII detection and masking actions
4. **Compliance**: GDPR, CCPA, HIPAA compliant processing

### Data Retention
```typescript
interface DataRetention {
  analysisResults: '30 days default';  // Configurable
  originalText: 'never stored';        // Privacy by design
  maskedText: '7 days';               // For debugging
  aggregateStats: 'permanent';        // No PII in aggregates
}
```

### Privacy Features
1. **Local Processing**: All analysis done locally
2. **No External Calls**: No data sent to third parties
3. **Secure Storage**: Encrypted at rest
4. **Access Control**: Restricted file system access

---

## 🔧 Validation Rules

### Text Validation
```typescript
interface TextValidation {
  required: true;
  type: 'string';
  minLength: 1;
  maxLength: 10000;
  encoding: 'utf-8';
  sanitization: true;          // Remove harmful content
}
```

### Batch Validation
```typescript
interface BatchValidation {
  texts: {
    required: true;
    type: 'array';
    minItems: 1;
    maxItems: 1000;
    items: {
      type: 'string';
      maxLength: 10000;
    };
  };
  totalLength: {
    max: 1000000;              // 1M chars total
  };
}
```

### Query Parameter Validation
```typescript
interface QueryValidation {
  page: {
    type: 'integer';
    min: 1;
    default: 1;
  };
  limit: {
    type: 'integer';
    min: 1;
    max: 200;
    default: 50;
  };
  sentiment: {
    type: 'string';
    enum: ['positive', 'negative', 'neutral'];
  };
  startDate: {
    type: 'string';
    format: 'iso-date';
  };
  endDate: {
    type: 'string';
    format: 'iso-date';
  };
  minScore: {
    type: 'number';
    min: -1;
    max: 1;
  };
  maxScore: {
    type: 'number';
    min: -1;
    max: 1;
  };
}
```

---

## 🐛 Common Error Scenarios

### Validation Errors
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "code": "VALIDATION_ERROR",
    "errors": [
      {
        "field": "text",
        "message": "Text is required"
      },
      {
        "field": "texts[0]",
        "message": "Text exceeds maximum length of 10,000 characters"
      }
    ]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

### Processing Errors
```json
{
  "success": false,
  "error": "Sentiment analysis failed",
  "details": {
    "code": "PROCESSING_ERROR",
    "message": "Unable to process text due to encoding issues"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

### Rate Limiting (Future)
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": {
    "code": "RATE_LIMITED",
    "limit": 1000,
    "remaining": 0,
    "resetTime": "2025-06-15T11:00:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 🚀 Usage Examples

### Complete Analysis Workflow
```typescript
// 1. Single text analysis with PII masking
const singleResult = await fetch('/api/v1/sentiment/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Contact me at john@example.com for amazing products!',
    options: { 
      enablePIIMasking: true,
      includeKeywords: true 
    }
  })
});

// 2. Batch analysis for efficiency
const batchResult = await fetch('/api/v1/sentiment/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: [
      'I love this!',
      'This is terrible',
      'It\'s okay'
    ],
    options: { enablePIIMasking: true }
  })
});

// 3. Review historical trends
const history = await fetch('/api/v1/sentiment/history?period=7d');

// 4. Get statistics for reporting
const stats = await fetch('/api/v1/sentiment/statistics?period=30d&groupBy=week');
```

### Real-time Sentiment Monitoring
```typescript
// Monitor sentiment in real-time
class SentimentMonitor {
  async analyzeText(text: string) {
    const response = await fetch('/api/v1/sentiment/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    const result = await response.json();
    
    if (result.success) {
      this.updateDashboard(result.data);
      
      // Alert on negative sentiment
      if (result.data.sentiment === 'negative' && result.data.score < -0.5) {
        this.triggerAlert(result.data);
      }
    }
  }
  
  private updateDashboard(result: SentimentResult) {
    // Update real-time dashboard
  }
  
  private triggerAlert(result: SentimentResult) {
    // Send notification for negative feedback
  }
}
```

---

This comprehensive documentation covers all sentiment analysis functionality. For background processing of large sentiment analysis jobs, see the [Job Queue API documentation](./job-queue.md).