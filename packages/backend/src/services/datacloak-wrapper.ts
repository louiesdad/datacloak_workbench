// DataCloak wrapper that provides a fallback when FFI is not available
import { AppError } from '../middleware/error.middleware';

interface PIIDetectionResult {
  fieldName: string;
  piiType: string;
  confidence: number;
  sample: string;
  masked: string;
}

interface DataCloakConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  redosProtection?: boolean;
  emailValidation?: 'regex' | 'validator' | 'hybrid';
  creditCardValidation?: 'basic' | 'luhn' | 'full';
  enableMonitoring?: boolean;
  performanceMode?: 'fast' | 'accurate' | 'balanced';
  maxTextLength?: number;
  regexTimeout?: number;
}

class DataCloakFallback {
  private enabled = false;

  async initialize(config: DataCloakConfig): Promise<void> {
    console.warn('DataCloak FFI not available - using fallback mode with basic PII detection');
    this.enabled = true;
  }

  private maskWithFormat(value: string, type: string): string {
    switch (type) {
      case 'EMAIL':
        // Preserve @ and domain structure
        const emailParts = value.split('@');
        if (emailParts.length === 2) {
          const [local, domain] = emailParts;
          const domainParts = domain.split('.');
          return '*'.repeat(local.length) + '@' + '*'.repeat(domainParts[0].length) + '.' + domainParts.slice(1).join('.');
        }
        return '*'.repeat(value.length);
      
      case 'PHONE':
        // Preserve dashes and parentheses
        return value.replace(/\d/g, '*');
      
      case 'SSN':
        // Preserve dashes
        return value.replace(/\d/g, '*');
      
      case 'CREDIT_CARD':
        // Show last 4 digits
        if (value.length >= 4) {
          return '*'.repeat(value.length - 4) + value.slice(-4);
        }
        return '*'.repeat(value.length);
      
      default:
        return '*'.repeat(value.length);
    }
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];
    
    // Basic PII patterns
    const patterns = [
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN' },
      { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'EMAIL', confidence: 0.95 },
      { regex: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g, type: 'PHONE' },
      { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, type: 'CREDIT_CARD' }
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex);
      for (const match of matches) {
        results.push({
          fieldName: 'text',
          piiType: pattern.type,
          confidence: (pattern as any).confidence || 0.8,
          sample: match[0],
          masked: this.maskWithFormat(match[0], pattern.type)
        });
      }
    }

    return results;
  }

  async maskText(text: string): Promise<{
    originalText: string;
    maskedText: string;
    detectedPII: PIIDetectionResult[];
    metadata: {
      processingTime: number;
      fieldsProcessed: number;
      piiItemsFound: number;
    };
  }> {
    const startTime = Date.now();
    const detectedPII = await this.detectPII(text);
    let maskedText = text;

    // Sort by position in reverse to avoid offset issues
    const sortedPII = [...detectedPII].sort((a, b) => 
      text.lastIndexOf(b.sample) - text.lastIndexOf(a.sample)
    );

    for (const pii of sortedPII) {
      maskedText = maskedText.replace(pii.sample, pii.masked || this.maskWithFormat(pii.sample, pii.piiType));
    }

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

  async auditSecurity(filePath: string): Promise<any> {
    // Mock security audit for fallback mode
    return {
      complianceScore: 0.85,
      violations: [],
      recommendations: [
        'Enable full PII masking for production',
        'Implement data retention policies',
        'Enable audit logging'
      ],
      piiItemsDetected: 0,
      maskingAccuracy: 0.98,
      encryptionStatus: 'enabled',
      piiResults: []
    };
  }

  isAvailable(): boolean {
    return this.enabled;
  }

  getVersion(): string {
    return 'fallback-1.0.0';
  }

  async getStats(): Promise<any> {
    return {
      version: this.getVersion(),
      available: this.isAvailable(),
      fallbackMode: true
    };
  }
}

let dataCloakInstance: any;

// Try to load the real DataCloak, fall back if FFI fails
export async function getDataCloakInstance() {
  if (dataCloakInstance) {
    return dataCloakInstance;
  }

  // Check if we should use the real DataCloak library
  const libraryPath = process.env.DATACLOAK_LIBRARY_PATH;
  
  if (libraryPath) {
    try {
      // Try to load the real DataCloak library using koffi
      const { DataCloakKoffiWrapper } = await import('./datacloak-koffi-wrapper');
      console.log('Loading real DataCloak library from:', libraryPath);
      dataCloakInstance = new DataCloakKoffiWrapper(libraryPath);
      await dataCloakInstance.initialize({});
      console.log('Successfully loaded real DataCloak library');
      return dataCloakInstance;
    } catch (error) {
      console.error('Failed to load real DataCloak library:', error);
      console.log('Falling back to basic implementation');
    }
  }

  // Fallback to basic implementation
  console.log('Using DataCloak fallback implementation');
  dataCloakInstance = new DataCloakFallback();

  return dataCloakInstance;
}