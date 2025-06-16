# DataCloak API Documentation

## Overview

DataCloak is a high-performance data obfuscation library with automatic PII detection and LLM-based analytics. This document describes the DataCloak service integration in the Sentiment Workbench.

## Service Methods

### Initialize

```typescript
await dataCloak.initialize(): Promise<void>
```

Initializes the DataCloak service with configuration from environment variables. Must be called before using other methods.

**Environment Variables:**
- `DATACLOAK_API_KEY`: API key for DataCloak LLM integration
- `DATACLOAK_API_ENDPOINT`: LLM endpoint (default: OpenAI)
- `DATACLOAK_TIMEOUT`: Request timeout in milliseconds (default: 30000)
- `DATACLOAK_RETRY_ATTEMPTS`: Number of retry attempts (default: 3)
- `DATACLOAK_USE_MOCK`: Use mock implementation for development (default: false)

### PII Detection

```typescript
await dataCloak.detectPII(text: string): Promise<PIIDetectionResult[]>
```

Detects personally identifiable information in the provided text.

**Parameters:**
- `text`: The text to analyze for PII

**Returns:**
```typescript
interface PIIDetectionResult {
  fieldName: string;      // Field or context where PII was found
  piiType: PIIType;       // Type of PII detected
  confidence: number;     // Confidence score (0-1)
  sample: string;         // Sample of detected PII
  masked: string;         // Masked version of the PII
}

enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  ADDRESS = 'address',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
  IP_ADDRESS = 'ip_address',
  CUSTOM = 'custom'
}
```

**Example:**
```typescript
const text = 'Contact john.doe@example.com or call 555-123-4567';
const results = await dataCloak.detectPII(text);
// Results: [
//   { fieldName: 'email', piiType: 'email', confidence: 0.99, sample: 'john.doe@example.com', masked: 'j***.***@e******.com' },
//   { fieldName: 'phone', piiType: 'phone', confidence: 0.95, sample: '555-123-4567', masked: '***-***-4567' }
// ]
```

### Text Masking

```typescript
await dataCloak.maskText(text: string): Promise<MaskingResult>
```

Masks all detected PII in the provided text.

**Parameters:**
- `text`: The text to mask

**Returns:**
```typescript
interface MaskingResult {
  originalText: string;   // Original unmasked text
  maskedText: string;     // Text with PII masked
  piiItemsFound: number;  // Number of PII items found
}
```

**Example:**
```typescript
const text = 'Email me at test@example.com';
const result = await dataCloak.maskText(text);
// Result: {
//   originalText: 'Email me at test@example.com',
//   maskedText: 'Email me at ****@*******.***',
//   piiItemsFound: 1
// }
```

### Batch Operations

```typescript
await dataCloak.detectPIIBatch(texts: string[]): Promise<PIIDetectionResult[][]>
await dataCloak.maskTextBatch(texts: string[]): Promise<MaskingResult[]>
```

Process multiple texts in batch for better performance.

**Parameters:**
- `texts`: Array of texts to process

**Returns:**
- Array of results corresponding to each input text

**Example:**
```typescript
const texts = ['Email: test1@example.com', 'Phone: 555-123-4567'];
const results = await dataCloak.detectPIIBatch(texts);
// Results: [
//   [{ piiType: 'email', ... }],
//   [{ piiType: 'phone', ... }]
// ]
```

### Security Audit

```typescript
await dataCloak.auditSecurity(filePath: string): Promise<SecurityAuditResult>
```

Performs a comprehensive security audit on a file to detect PII and compliance issues.

**Parameters:**
- `filePath`: Path to the file to audit

**Returns:**
```typescript
interface SecurityAuditResult {
  timestamp: Date;
  fileProcessed: string;
  piiItemsDetected: number;
  maskingAccuracy: number;
  encryptionStatus: 'enabled' | 'disabled';
  complianceScore: number;
  violations: string[];
  recommendations: string[];
}
```

### Utility Methods

```typescript
dataCloak.isAvailable(): boolean
dataCloak.getVersion(): string
await dataCloak.getStats(): Promise<Stats>
```

Check service availability, version, and statistics.

## Performance Characteristics

- **PII Detection**: < 100ms per text (up to 10KB)
- **Batch Processing**: 100 texts per batch
- **Memory Usage**: < 500MB for 20GB file processing
- **Streaming Support**: 8KB-4MB configurable chunks
- **Rate Limiting**: 3 requests/second to LLM APIs

## Security Features

- **ReDoS Protection**: All regex patterns protected against DoS
- **Validator-based Detection**: RFC-compliant email validation
- **Luhn Validation**: Credit card number verification
- **Secure Masking**: Preserves format while hiding sensitive data

## Error Handling

All methods throw `AppError` with appropriate error codes:

- `DATACLOAK_INIT_ERROR`: Initialization failed
- `PII_DETECTION_ERROR`: PII detection failed
- `TEXT_MASKING_ERROR`: Text masking failed
- `SECURITY_AUDIT_ERROR`: Security audit failed

## Integration Example

```typescript
import { dataCloak } from './services/datacloak.service';

// Initialize once at startup
await dataCloak.initialize();

// Process incoming data
const customerData = 'Customer email: john@example.com, SSN: 123-45-6789';
const masked = await dataCloak.maskText(customerData);

// Store masked data
await database.save({
  data: masked.maskedText,
  piiDetected: masked.piiItemsFound > 0
});

// Audit file security
const audit = await dataCloak.auditSecurity('./uploads/customers.csv');
if (audit.complianceScore < 0.8) {
  console.warn('Compliance issues detected:', audit.violations);
}
```

## Testing

Run integration tests:
```bash
npm run test:datacloak-ffi
```

Performance tests:
```bash
npm run test:performance
```

## Troubleshooting

1. **Binary not found**: Ensure DataCloak binary is in `packages/security/bin/{platform}/`
2. **Initialization fails**: Check environment variables and binary permissions
3. **Mock fallback**: Set `DATACLOAK_USE_MOCK=true` for development without binary
4. **Performance issues**: Adjust batch size and chunk configuration