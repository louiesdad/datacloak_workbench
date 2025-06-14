export interface DataCloakConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface PIIDetectionResult {
  fieldName: string;
  piiType: PIIType;
  confidence: number;
  sample: string;
  masked: string;
}

export interface MaskingResult {
  originalText: string;
  maskedText: string;
  detectedPII: PIIDetectionResult[];
  metadata: {
    processingTime: number;
    fieldsProcessed: number;
    piiItemsFound: number;
  };
}

export interface SecurityAuditResult {
  timestamp: Date;
  fileProcessed: string;
  piiItemsDetected: number;
  maskingAccuracy: number;
  encryptionStatus: 'enabled' | 'disabled';
  complianceScore: number;
  violations: string[];
  recommendations: string[];
}

export enum PIIType {
  SSN = 'SSN',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  CREDIT_CARD = 'CREDIT_CARD',
  ADDRESS = 'ADDRESS',
  NAME = 'NAME',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
  CUSTOM = 'CUSTOM'
}

export interface DataCloakBridge {
  initialize(config: DataCloakConfig): Promise<void>;
  detectPII(text: string): Promise<PIIDetectionResult[]>;
  maskText(text: string): Promise<MaskingResult>;
  auditSecurity(filePath: string): Promise<SecurityAuditResult>;
  isAvailable(): boolean;
  getVersion(): string;
}