import { 
  DataCloakBridge, 
  DataCloakConfig, 
  PIIDetectionResult, 
  MaskingResult, 
  SecurityAuditResult, 
  PIIType 
} from '../interfaces/datacloak';

const PII_PATTERNS = {
  [PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  [PIIType.PHONE]: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
  [PIIType.SSN]: /\b(?!000|666|9\d{2})\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}\b/g,
  [PIIType.CREDIT_CARD]: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  [PIIType.NAME]: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
  [PIIType.DATE_OF_BIRTH]: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g
};

const MASKING_STRATEGIES: Record<PIIType, (text: string) => string> = {
  [PIIType.EMAIL]: (text: string) => text.replace(/(.{1,3})[^@]*(@.*)/, '$1****$2'),
  [PIIType.PHONE]: () => 'XXX-XXX-XXXX',
  [PIIType.SSN]: () => 'XXX-XX-XXXX',
  [PIIType.CREDIT_CARD]: (text: string) => '**** **** **** ' + text.slice(-4),
  [PIIType.NAME]: () => '[NAME]',
  [PIIType.DATE_OF_BIRTH]: () => 'XX/XX/XXXX',
  [PIIType.ADDRESS]: () => '[ADDRESS]',
  [PIIType.CUSTOM]: () => '[MASKED]'
};

export class DataCloakMock implements DataCloakBridge {
  private config: DataCloakConfig = {};
  private initialized = false;
  private readonly version = '1.0.0-mock';

  async initialize(config: DataCloakConfig): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
    this.config = { ...config };
    this.initialized = true;
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    const results: PIIDetectionResult[] = [];
    
    Object.entries(PII_PATTERNS).forEach(([piiType, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const maskingFn = MASKING_STRATEGIES[piiType as PIIType];
          results.push({
            fieldName: 'detected_field',
            piiType: piiType as PIIType,
            confidence: Math.random() * 0.4 + 0.6,
            sample: match,
            masked: maskingFn ? maskingFn(match) : '[MASKED]'
          });
        });
      }
    });

    return results;
  }

  async maskText(text: string): Promise<MaskingResult> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    const startTime = Date.now();
    const detectedPII = await this.detectPII(text);
    
    let maskedText = text;
    detectedPII.forEach(pii => {
      maskedText = maskedText.replace(pii.sample, pii.masked);
    });

    return {
      originalText: text,
      maskedText,
      detectedPII,
      metadata: {
        processingTime: Date.now() - startTime,
        fieldsProcessed: 1,
        piiItemsFound: detectedPII.length
      }
    };
  }

  async auditSecurity(filePath: string): Promise<SecurityAuditResult> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    const mockPIICount = Math.floor(Math.random() * 100);
    const mockAccuracy = Math.random() * 0.1 + 0.9;
    const mockComplianceScore = Math.random() * 0.2 + 0.8;

    const violations = mockComplianceScore < 0.9 ? [
      'Potential PII exposure in field: customer_notes',
      'Insufficient encryption for sensitive data'
    ] : [];

    const recommendations = [
      'Enable field-level encryption for sensitive columns',
      'Implement data retention policies',
      'Regular PII scanning recommended'
    ];

    return {
      timestamp: new Date(),
      fileProcessed: filePath,
      piiItemsDetected: mockPIICount,
      maskingAccuracy: mockAccuracy,
      encryptionStatus: Math.random() > 0.5 ? 'enabled' : 'disabled',
      complianceScore: mockComplianceScore,
      violations,
      recommendations
    };
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getVersion(): string {
    return this.version;
  }
}