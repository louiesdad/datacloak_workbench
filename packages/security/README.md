# @dsw/security

Production-ready security package for DataCloak Sentiment Workbench - PII masking, security auditing, and privacy protection.

## Overview

The security package provides comprehensive privacy protection and security auditing capabilities for sensitive data processing. It integrates with DataCloak for PII detection and masking, implements OS-native secure key storage, and provides real-time security monitoring.

## Features

### 🔐 PII Detection & Masking
- **DataCloak Integration**: Native FFI bridge with graceful fallback to high-fidelity mock
- **Comprehensive PII Types**: Email, phone, SSN, credit cards, addresses, names, dates of birth
- **Advanced Masking Strategies**: Context-aware masking with configurable patterns
- **High Accuracy**: Confidence scoring and validation for all detections

### 🔑 Secure Key Management
- **OS Keychain Integration**: macOS Security framework and Windows Credential Manager
- **AES-256-CBC Encryption**: Secure fallback with proper IV handling
- **Key Rotation**: Automated key rotation with integrity validation
- **Cross-Platform**: Unified API across operating systems

### 📊 Security Monitoring
- **Real-Time Alerts**: Configurable rules for security events and compliance breaches
- **Event Tracking**: Comprehensive logging of PII detection, violations, and performance issues
- **Metrics Aggregation**: Trend analysis and compliance score monitoring
- **Export Capabilities**: JSON and CSV export for audit trails

### 🧪 Testing & Validation
- **Adversarial Corpus**: 110,000+ synthetic PII combinations for comprehensive testing
- **Mutation Testing**: ≥85% mutation score requirement for security-critical code
- **Performance Testing**: Large text input validation and memory leak detection
- **Integration Testing**: End-to-end workflow validation

## Quick Start

```typescript
import { 
  DataCloakBridge, 
  SecurityAuditor, 
  SecurityMonitor,
  KeychainManager 
} from '@dsw/security';

// Initialize DataCloak
const dataCloak = new DataCloakBridge();
await dataCloak.initialize({ fallbackToMock: true });

// Detect and mask PII
const detections = await dataCloak.detectPII('Contact john@example.com');
const masked = await dataCloak.maskText('Contact john@example.com');

// Security auditing
const auditor = new SecurityAuditor(dataCloak);
const auditResult = await auditor.auditFile('/path/to/data.csv');

// Real-time monitoring
const monitor = new SecurityMonitor();
monitor.startMonitoring();
monitor.recordPIIDetection('source', detections, 150);

// Secure key storage
const keychain = new KeychainManager();
const keyId = await keychain.generateAndStoreKey('encryption-key');
```

## Core Components

### DataCloak Bridge
- **NativeDataCloakBridge**: FFI integration with DataCloak binary
- **DataCloakMock**: High-fidelity mock for testing and fallback
- **Unified Interface**: Consistent API regardless of implementation

### Security Auditor
- **File Auditing**: Comprehensive security assessment of data files
- **Compliance Scoring**: Automated compliance score calculation
- **Violation Detection**: Identification of security policy violations
- **History Tracking**: Audit trail with configurable retention

### Security Monitor
- **Event Recording**: PII detection, security violations, performance issues
- **Alert Rules**: Configurable conditions and actions for security events
- **Metrics Collection**: Real-time aggregation of security metrics
- **Export Functions**: Audit-ready data export capabilities

### Keychain Manager
- **Cross-Platform**: macOS Keychain Services and Windows Credential Manager
- **Secure Storage**: AES-256-CBC encryption for unsupported platforms
- **Key Lifecycle**: Generation, storage, rotation, and validation
- **Integrity Checks**: Automated validation of stored keys

### Adversarial Corpus
- **Comprehensive Dataset**: 110,000+ synthetic PII examples
- **Difficulty Levels**: Easy, medium, hard, and extreme test cases
- **PII Type Coverage**: All supported PII types with contextual variations
- **Testing Integration**: Direct integration with security auditor

## Configuration

### DataCloak Configuration
```typescript
const config = {
  fallbackToMock: true,          // Use mock when binary unavailable
  useSystemBinary: false,        // Use system-installed DataCloak
  binaryPath: '/custom/path',    // Custom binary location
  timeout: 30000                 // Operation timeout (ms)
};
```

### Security Monitor Configuration
```typescript
const monitorConfig = {
  enableRealTimeAlerts: true,
  alertThresholds: {
    piiDetectionRate: 100,       // Events per hour
    complianceScore: 0.8,        // Minimum compliance score
    processingTime: 5000,        // Max processing time (ms)
    errorRate: 0.1               // Maximum error rate (10%)
  },
  retentionDays: 30,             // Event retention period
  aggregationIntervalMs: 60000   // Metrics update interval
};
```

### Keychain Configuration
```typescript
const keychainConfig = {
  serviceName: 'dsw-security',
  accountName: 'user-account',
  fallbackToFileSystem: false,   // Use encrypted files if keychain unavailable
  encryptionAlgorithm: 'aes-256-cbc'
};
```

## Testing

### Run All Tests
```bash
npm test
```

### Performance Testing
```bash
npm run test:performance
```

### Mutation Testing
```bash
npm run test:mutation
```

### Adversarial Testing
```bash
npm run test:adversarial
```

### Coverage Report
```bash
npm run test:coverage
```

## API Reference

### DataCloak Bridge Interface
```typescript
interface DataCloakBridge {
  initialize(config: DataCloakConfig): Promise<void>;
  detectPII(text: string): Promise<PIIDetectionResult[]>;
  maskText(text: string): Promise<MaskingResult>;
  auditData(data: string[]): Promise<SecurityAuditResult>;
  isAvailable(): boolean;
  getVersion(): string;
}
```

### Security Event Types
```typescript
type SecurityEventType = 
  | 'pii_detected' 
  | 'security_violation' 
  | 'compliance_breach' 
  | 'performance_issue' 
  | 'error';

type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';
```

### PII Types Supported
- **EMAIL**: Email addresses with various formats
- **PHONE**: Phone numbers with country codes and formatting
- **SSN**: Social Security Numbers with various formats
- **CREDIT_CARD**: Credit card numbers (Visa, MasterCard, AMEX, etc.)
- **ADDRESS**: Physical addresses and postal codes
- **NAME**: Personal names with various cultural patterns
- **DATE_OF_BIRTH**: Birth dates in multiple formats
- **CUSTOM**: User-defined PII patterns

## Security Best Practices

### Key Management
- Use OS keychain when available
- Rotate keys regularly using `rotateKey()`
- Validate key integrity with `validateKeyIntegrity()`
- Never log or expose keys in application code

### PII Handling
- Always validate masking effectiveness with `SecurityAuditor`
- Use adversarial corpus for comprehensive testing
- Monitor detection rates and false positives
- Implement proper error handling for edge cases

### Monitoring & Alerts
- Configure appropriate alert thresholds for your use case
- Monitor compliance scores and trend analysis
- Export security events for external audit systems
- Regularly review and update alert rules

## Performance Considerations

- **Large Files**: Designed for files up to 50GB with streaming processing
- **Memory Usage**: Optimized for minimal memory footprint
- **Concurrency**: Thread-safe operations for parallel processing
- **Caching**: Intelligent caching of detection patterns and results

## Integration Examples

### With Backend API
```typescript
import { BackendSecurityClient } from '@dsw/security';

const client = new BackendSecurityClient({
  baseURL: 'https://api.example.com',
  enableRealTimeReporting: true
});

await client.reportSecurityEvent(securityEvent);
```

### With Frontend UI
```typescript
// Security status component
const securityMetrics = monitor.getMetrics();
const recentEvents = monitor.getEvents({ limit: 10 });
```

## Contributing

1. Run tests: `npm test`
2. Check coverage: `npm run test:coverage`
3. Run mutation tests: `npm run test:mutation`
4. Build package: `npm run build`

## License

MIT License - see LICENSE file for details.

---

**Security Package**: Production-ready PII protection and security auditing for DataCloak Sentiment Workbench.