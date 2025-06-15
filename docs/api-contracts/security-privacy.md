# Security & Privacy API

This document covers all endpoints related to PII detection, data masking, security auditing, and compliance monitoring.

## 🔒 Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/security/detect` | POST | Detect PII in text |
| `/api/v1/security/mask` | POST | Mask PII in text |
| `/api/v1/security/audit/file` | POST | Audit file for security compliance |
| `/api/v1/security/scan/dataset/:id` | POST | Scan dataset for PII and compliance |
| `/api/v1/security/metrics` | GET | Get security metrics and scores |
| `/api/v1/security/status` | GET | Get security service status |
| `/api/v1/security/audit/history` | GET | Get audit history |

---

## 🔍 PII Detection

Detect personally identifiable information (PII) in text content.

### `POST /api/v1/security/detect`

#### Request Body
```json
{
  "text": "Please contact John Doe at john.doe@example.com or call him at (555) 123-4567. His SSN is 123-45-6789.",
  "options": {
    "piiTypes": ["EMAIL", "PHONE", "SSN", "NAME"],
    "confidence": 0.8,
    "includeContext": true
  }
}
```

#### Request Schema
```typescript
interface PIIDetectionRequest {
  text: string;                     // Required: Text to scan for PII
  options?: {
    piiTypes?: PIIType[];          // Optional: Specific PII types to detect
    confidence?: number;           // Optional: Minimum confidence (0-1, default: 0.7)
    includeContext?: boolean;      // Optional: Include surrounding context
  };
}

type PIIType = 
  | 'EMAIL' | 'PHONE' | 'SSN' | 'CREDIT_CARD' | 'NAME' 
  | 'DATE_OF_BIRTH' | 'ADDRESS' | 'IP_ADDRESS' | 'CUSTOM';
```

#### Response (Success)
```json
{
  "success": true,
  "data": [
    {
      "type": "EMAIL",
      "value": "john.doe@example.com",
      "startIndex": 35,
      "endIndex": 56,
      "confidence": 0.95,
      "context": "contact John Doe at john.doe@example.com or call",
      "severity": "medium"
    },
    {
      "type": "PHONE",
      "value": "(555) 123-4567",
      "startIndex": 73,
      "endIndex": 87,
      "confidence": 0.98,
      "context": "call him at (555) 123-4567. His SSN",
      "severity": "medium"
    },
    {
      "type": "SSN",
      "value": "123-45-6789",
      "startIndex": 99,
      "endIndex": 110,
      "confidence": 0.99,
      "context": "His SSN is 123-45-6789.",
      "severity": "high"
    },
    {
      "type": "NAME",
      "value": "John Doe",
      "startIndex": 15,
      "endIndex": 23,
      "confidence": 0.85,
      "context": "Please contact John Doe at john.doe",
      "severity": "low"
    }
  ],
  "summary": {
    "totalPIIFound": 4,
    "riskScore": 0.75,
    "complianceIssues": ["GDPR", "PCI"],
    "recommendations": [
      "Mask email addresses before processing",
      "Replace SSN with encrypted identifier"
    ]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### PII Detection Patterns
```typescript
interface PIIPatterns {
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  PHONE: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
  SSN: /\b(?!000|666|9\d{2})\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}\b/g;
  CREDIT_CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g;
  NAME: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  DATE_OF_BIRTH: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g;
}
```

---

## 🎭 Text Masking

Mask or redact PII in text while preserving context and readability.

### `POST /api/v1/security/mask`

#### Request Body
```json
{
  "text": "Contact john.doe@example.com or call (555) 123-4567",
  "options": {
    "maskingStrategy": "replace",
    "preserveFormat": true,
    "customMasks": {
      "EMAIL": "[EMAIL]",
      "PHONE": "[PHONE]"
    },
    "confidence": 0.8
  }
}
```

#### Request Schema
```typescript
interface TextMaskingRequest {
  text: string;                     // Required: Text to mask
  options?: {
    maskingStrategy?: MaskingStrategy; // Optional: Masking approach
    preserveFormat?: boolean;      // Optional: Keep original format
    customMasks?: Record<PIIType, string>; // Optional: Custom mask patterns
    confidence?: number;           // Optional: Minimum confidence for masking
    auditTrail?: boolean;         // Optional: Create audit record
  };
}

type MaskingStrategy = 
  | 'replace'      // Replace with placeholder text
  | 'redact'       // Remove completely
  | 'partial'      // Show only part of the value
  | 'encrypt'      // Encrypt with reversible algorithm
  | 'hash';        // One-way hash
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "originalText": "Contact john.doe@example.com or call (555) 123-4567",
    "maskedText": "Contact [EMAIL] or call [PHONE]",
    "maskingApplied": [
      {
        "type": "EMAIL",
        "originalValue": "john.doe@example.com",
        "maskedValue": "[EMAIL]",
        "startIndex": 8,
        "endIndex": 29,
        "confidence": 0.95
      },
      {
        "type": "PHONE",
        "originalValue": "(555) 123-4567",
        "maskedValue": "[PHONE]",
        "startIndex": 38,
        "endIndex": 52,
        "confidence": 0.98
      }
    ],
    "statistics": {
      "originalLength": 53,
      "maskedLength": 27,
      "piiItemsMasked": 2,
      "preservationRatio": 0.51
    },
    "auditId": "audit-550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Masking Strategies

##### Replace Strategy
```typescript
const replaceMasks = {
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  SSN: '[SSN]',
  CREDIT_CARD: '[CARD]',
  NAME: '[NAME]',
  DATE_OF_BIRTH: '[DOB]'
};
```

##### Partial Strategy
```typescript
const partialMasks = {
  EMAIL: 'j***@example.com',        // Show first char and domain
  PHONE: '(555) ***-4567',          // Show area code and last 4
  SSN: '***-**-6789',               // Show last 4 digits
  CREDIT_CARD: '****-****-****-1234' // Show last 4 digits
};
```

##### Format Preservation
```typescript
interface FormatPreservation {
  EMAIL: 'x'.repeat(localPart.length) + '@' + domain;
  PHONE: '(xxx) xxx-xxxx';
  SSN: 'xxx-xx-xxxx';
  CREDIT_CARD: 'xxxx-xxxx-xxxx-xxxx';
}
```

---

## 📋 File Security Audit

Perform comprehensive security audit on uploaded files.

### `POST /api/v1/security/audit/file`

#### Request Body
```json
{
  "filePath": "/path/to/uploaded/file.csv",
  "options": {
    "auditLevel": "comprehensive",
    "complianceFramework": ["GDPR", "CCPA", "HIPAA"],
    "includeRecommendations": true,
    "generateReport": true
  }
}
```

#### Request Schema
```typescript
interface FileAuditRequest {
  filePath: string;                 // Required: Path to file
  options?: {
    auditLevel?: 'basic' | 'standard' | 'comprehensive'; // Default: 'standard'
    complianceFramework?: ComplianceFramework[]; // Default: ['GDPR']
    includeRecommendations?: boolean; // Default: true
    generateReport?: boolean;       // Default: false
  };
}

type ComplianceFramework = 'GDPR' | 'CCPA' | 'HIPAA' | 'PCI' | 'SOX';
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "auditId": "audit-550e8400-e29b-41d4-a716-446655440000",
    "filePath": "/path/to/uploaded/file.csv",
    "auditLevel": "comprehensive",
    "overallScore": 0.75,
    "riskLevel": "medium",
    "findings": [
      {
        "id": "finding-001",
        "type": "pii_exposure",
        "severity": "high",
        "field": "email",
        "description": "Email addresses found without encryption",
        "affectedRows": 1500,
        "riskScore": 0.85,
        "complianceImpact": ["GDPR", "CCPA"]
      },
      {
        "id": "finding-002",
        "type": "data_quality",
        "severity": "medium",
        "field": "phone",
        "description": "Inconsistent phone number formats",
        "affectedRows": 250,
        "riskScore": 0.45
      }
    ],
    "recommendations": [
      {
        "id": "rec-001",
        "priority": "high",
        "category": "masking",
        "action": "Implement email masking before processing",
        "estimatedEffort": "medium",
        "compliance": ["GDPR", "CCPA"]
      },
      {
        "id": "rec-002",
        "priority": "medium",
        "category": "validation",
        "action": "Standardize phone number formats",
        "estimatedEffort": "low"
      }
    ],
    "compliance": {
      "gdpr": "partial",
      "ccpa": "partial",
      "hipaa": "non_compliant",
      "pci": "compliant"
    },
    "statistics": {
      "totalRows": 10000,
      "totalColumns": 15,
      "piiFieldsFound": 3,
      "sensitiveDataPercentage": 15.5,
      "auditDuration": 45000
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📊 Dataset Security Scan

Perform security scan on a specific dataset with real-time progress.

### `POST /api/v1/security/scan/dataset/:id`

#### Path Parameters
- `id`: Dataset UUID

#### Request Body
```json
{
  "scanType": "full",
  "options": {
    "includeContent": true,
    "complianceCheck": true,
    "generateReport": true
  }
}
```

#### Request Schema
```typescript
interface DatasetScanRequest {
  scanType?: 'quick' | 'full';     // Default: 'full'
  options?: {
    includeContent?: boolean;       // Scan actual content vs metadata only
    complianceCheck?: boolean;      // Check compliance frameworks
    generateReport?: boolean;       // Generate detailed report
    backgroundProcessing?: boolean; // Process as background job
  };
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "scanId": "scan-550e8400-e29b-41d4-a716-446655440000",
    "datasetId": "550e8400-e29b-41d4-a716-446655440000",
    "scanType": "full",
    "status": "completed",
    "piiSummary": {
      "totalPIIItems": 2500,
      "piiTypes": {
        "EMAIL": 1500,
        "PHONE": 800,
        "SSN": 150,
        "CREDIT_CARD": 50
      },
      "riskLevel": "high",
      "affectedFields": ["email", "phone", "ssn", "payment_info"],
      "recommendations": [
        "Enable field-level encryption for sensitive columns",
        "Implement data retention policies",
        "Regular PII scanning recommended"
      ]
    },
    "auditResult": {
      "piiItemsDetected": 2500,
      "maskingAccuracy": 0.95,
      "complianceScore": 0.72,
      "violations": [
        {
          "type": "unencrypted_pii",
          "severity": "high",
          "count": 2500,
          "frameworks": ["GDPR", "CCPA"]
        }
      ],
      "processingTime": 12000
    },
    "complianceStatus": {
      "gdpr": "partial",
      "ccpa": "partial", 
      "hipaa": "non_compliant",
      "pci": "non_compliant"
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📈 Security Metrics

Get comprehensive security metrics and compliance scores.

### `GET /api/v1/security/metrics`

#### Query Parameters
- `period` (optional): Time period ('24h', '7d', '30d', 'all') (default: '7d')
- `framework` (optional): Specific compliance framework
- `includeHistorical` (optional): Include historical trends

#### Request
```http
GET /api/v1/security/metrics?period=7d&includeHistorical=true
```

#### Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalScans": 150,
      "averageComplianceScore": 0.78,
      "totalPIIDetected": 15000,
      "totalPIIMasked": 12000,
      "riskDistribution": {
        "low": 60,
        "medium": 70,
        "high": 15,
        "critical": 5
      }
    },
    "compliance": {
      "gdpr": {
        "score": 0.85,
        "status": "compliant",
        "violations": 2,
        "lastAssessment": "2025-06-15T10:30:00.000Z"
      },
      "ccpa": {
        "score": 0.82,
        "status": "compliant",
        "violations": 3,
        "lastAssessment": "2025-06-15T10:30:00.000Z"
      },
      "hipaa": {
        "score": 0.65,
        "status": "partial",
        "violations": 8,
        "lastAssessment": "2025-06-15T10:30:00.000Z"
      },
      "pci": {
        "score": 0.90,
        "status": "compliant",
        "violations": 1,
        "lastAssessment": "2025-06-15T10:30:00.000Z"
      }
    },
    "piiAnalysis": {
      "byType": {
        "EMAIL": 5000,
        "PHONE": 3500,
        "SSN": 2000,
        "CREDIT_CARD": 1500,
        "NAME": 2000,
        "DATE_OF_BIRTH": 1000
      },
      "maskingEffectiveness": 0.88,
      "averageConfidence": 0.92
    },
    "trends": [
      {
        "date": "2025-06-09",
        "scans": 25,
        "piiDetected": 2500,
        "complianceScore": 0.76
      },
      {
        "date": "2025-06-10",
        "scans": 30,
        "piiDetected": 3000,
        "complianceScore": 0.79
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "category": "encryption",
        "message": "Enable encryption for credit card data",
        "affectedDatasets": 5
      },
      {
        "priority": "medium",
        "category": "retention",
        "message": "Implement data retention policies",
        "affectedDatasets": 12
      }
    ]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## ⚡ Security Service Status

Check the status and health of security services.

### `GET /api/v1/security/status`

#### Response
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "services": {
      "piiDetection": {
        "status": "healthy",
        "responseTime": 15,
        "accuracy": 0.95,
        "lastUpdate": "2025-06-15T10:30:00.000Z"
      },
      "textMasking": {
        "status": "healthy",
        "responseTime": 8,
        "throughput": "1000 texts/second",
        "lastUpdate": "2025-06-15T10:30:00.000Z"
      },
      "complianceEngine": {
        "status": "healthy",
        "frameworks": ["GDPR", "CCPA", "HIPAA", "PCI"],
        "lastUpdate": "2025-06-15T10:30:00.000Z"
      },
      "auditingService": {
        "status": "healthy",
        "queueSize": 3,
        "averageProcessingTime": 45000,
        "lastUpdate": "2025-06-15T10:30:00.000Z"
      }
    },
    "performance": {
      "uptime": "99.95%",
      "averageLatency": 25,
      "requestsPerSecond": 150,
      "errorRate": 0.02
    },
    "version": "1.0.0",
    "lastRestart": "2025-06-14T08:00:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 📜 Audit History

Retrieve historical audit records with filtering and pagination.

### `GET /api/v1/security/audit/history`

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 200)
- `auditType` (optional): Filter by audit type ('file', 'dataset', 'text')
- `riskLevel` (optional): Filter by risk level
- `startDate` (optional): Filter from date
- `endDate` (optional): Filter to date

#### Request
```http
GET /api/v1/security/audit/history?auditType=file&riskLevel=high&limit=20
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "auditId": "audit-550e8400-e29b-41d4-a716-446655440000",
      "type": "file",
      "status": "completed",
      "riskLevel": "high",
      "complianceScore": 0.65,
      "piiItemsDetected": 2500,
      "findings": 8,
      "recommendations": 5,
      "filePath": "/uploads/customer-data.csv",
      "createdAt": "2025-06-15T10:30:00.000Z",
      "completedAt": "2025-06-15T10:31:15.000Z"
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

## 🔧 Compliance Frameworks

### Supported Frameworks

#### GDPR (General Data Protection Regulation)
```typescript
interface GDPRCompliance {
  requirements: [
    'data_minimization',
    'purpose_limitation',
    'storage_limitation',
    'accuracy',
    'integrity_confidentiality',
    'accountability'
  ];
  piiCategories: [
    'personal_data',
    'sensitive_personal_data',
    'special_categories'
  ];
  rights: [
    'right_to_access',
    'right_to_rectification',
    'right_to_erasure',
    'right_to_portability'
  ];
}
```

#### CCPA (California Consumer Privacy Act)
```typescript
interface CCPACompliance {
  requirements: [
    'disclosure_of_collection',
    'disclosure_of_sale',
    'right_to_know',
    'right_to_delete',
    'right_to_opt_out'
  ];
  categories: [
    'identifiers',
    'commercial_information',
    'biometric_information',
    'internet_activity',
    'geolocation_data'
  ];
}
```

#### HIPAA (Health Insurance Portability and Accountability Act)
```typescript
interface HIPAACompliance {
  requirements: [
    'administrative_safeguards',
    'physical_safeguards',
    'technical_safeguards'
  ];
  phi_categories: [
    'demographic_information',
    'medical_history',
    'test_results',
    'insurance_information'
  ];
  minimum_necessary: boolean;
}
```

#### PCI DSS (Payment Card Industry Data Security Standard)
```typescript
interface PCICompliance {
  requirements: [
    'secure_network',
    'protect_cardholder_data',
    'vulnerability_management',
    'access_control',
    'network_monitoring',
    'information_security_policy'
  ];
  data_types: [
    'primary_account_number',
    'cardholder_name',
    'expiration_date',
    'service_code'
  ];
}
```

---

## ⚡ Performance Characteristics

### PII Detection Performance
```typescript
interface PIIDetectionPerformance {
  textSize: {
    '1KB': '< 10ms',
    '10KB': '< 50ms',
    '100KB': '< 200ms',
    '1MB': '< 2s'
  };
  accuracy: {
    precision: 0.95,
    recall: 0.92,
    f1Score: 0.935
  };
  throughput: '1000 texts/second';
}
```

### Masking Performance
```typescript
interface MaskingPerformance {
  strategies: {
    replace: '< 5ms per text',
    redact: '< 3ms per text',
    partial: '< 8ms per text',
    encrypt: '< 15ms per text',
    hash: '< 12ms per text'
  };
  throughput: '2000 texts/second';
}
```

### Audit Performance
```typescript
interface AuditPerformance {
  fileSize: {
    '1MB': '< 30 seconds',
    '10MB': '< 2 minutes',
    '100MB': '< 15 minutes',
    '1GB': '< 2 hours'
  };
  comprehensive: '2x basic scan time';
  memory: '< 256MB per scan';
}
```

---

## 🔒 Security Architecture

### Data Protection Layers
```typescript
interface SecurityLayers {
  detection: {
    patterns: 'regex + ML models',
    confidence: 'bayesian scoring',
    context: 'surrounding text analysis'
  };
  masking: {
    reversible: 'AES-256 encryption',
    irreversible: 'SHA-256 hashing',
    format_preserving: 'custom algorithms'
  };
  auditing: {
    logging: 'all operations tracked',
    retention: 'configurable periods',
    compliance: 'framework-specific reports'
  };
}
```

### Privacy by Design
1. **Data Minimization**: Only necessary data processed
2. **Purpose Limitation**: Data used only for stated purposes
3. **Storage Limitation**: Automatic data expiration
4. **Local Processing**: No external data transmission
5. **Encryption at Rest**: All sensitive data encrypted
6. **Access Control**: Role-based access restrictions

---

## 🐛 Error Handling

### Common Error Scenarios

#### PII Detection Errors
```json
{
  "success": false,
  "error": "Text analysis failed",
  "details": {
    "code": "PII_DETECTION_ERROR",
    "message": "Unable to process text encoding"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Masking Errors
```json
{
  "success": false,
  "error": "Masking operation failed",
  "details": {
    "code": "MASKING_ERROR",
    "strategy": "encrypt",
    "message": "Encryption key not available"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Audit Errors
```json
{
  "success": false,
  "error": "File audit failed",
  "details": {
    "code": "AUDIT_ERROR",
    "filePath": "/path/to/file.csv",
    "message": "File is corrupted or unreadable"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

---

## 🚀 Usage Examples

### Complete Security Workflow
```typescript
// 1. Detect PII in uploaded content
const detectResponse = await fetch('/api/v1/security/detect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: userText,
    options: { confidence: 0.8 }
  })
});

const piiResults = detectResponse.data;

// 2. Mask sensitive content if PII found
if (piiResults.length > 0) {
  const maskResponse = await fetch('/api/v1/security/mask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: userText,
      options: { 
        maskingStrategy: 'replace',
        auditTrail: true 
      }
    })
  });
  
  const maskedText = maskResponse.data.maskedText;
  
  // 3. Process masked text for sentiment analysis
  const sentimentResponse = await fetch('/api/v1/sentiment/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: maskedText })
  });
}

// 4. Audit dataset for compliance
const auditResponse = await fetch('/api/v1/security/audit/file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filePath: '/path/to/dataset.csv',
    options: {
      auditLevel: 'comprehensive',
      complianceFramework: ['GDPR', 'CCPA']
    }
  })
});

// 5. Review compliance recommendations
const recommendations = auditResponse.data.recommendations;
for (const rec of recommendations) {
  if (rec.priority === 'high') {
    console.log(`Action required: ${rec.action}`);
  }
}
```

### Real-time PII Monitoring
```typescript
class PIIMonitor {
  private piiThreshold = 0.8;
  
  async monitorText(text: string): Promise<SecurityAlert[]> {
    const alerts: SecurityAlert[] = [];
    
    // Detect PII
    const piiResponse = await fetch('/api/v1/security/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text, 
        options: { confidence: this.piiThreshold } 
      })
    });
    
    const piiItems = piiResponse.data;
    
    // Generate alerts for high-risk PII
    for (const pii of piiItems) {
      if (pii.severity === 'high' || pii.severity === 'critical') {
        alerts.push({
          type: 'pii_detected',
          severity: pii.severity,
          message: `${pii.type} detected in text`,
          action: 'mask_immediately',
          piiType: pii.type,
          confidence: pii.confidence
        });
      }
    }
    
    return alerts;
  }
  
  async autoMask(text: string): Promise<string> {
    const maskResponse = await fetch('/api/v1/security/mask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        options: {
          maskingStrategy: 'replace',
          preserveFormat: true,
          auditTrail: true
        }
      })
    });
    
    return maskResponse.data.maskedText;
  }
}

interface SecurityAlert {
  type: string;
  severity: string;
  message: string;
  action: string;
  piiType: string;
  confidence: number;
}
```

---

This comprehensive documentation covers all security and privacy functionality, ensuring data protection and compliance throughout the DataCloak Sentiment Workbench platform.