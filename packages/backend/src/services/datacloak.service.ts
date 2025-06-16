import { AppError } from '../middleware/error.middleware';
import { join } from 'path';

// Import types - will be resolved when security package is properly built
interface DataCloakConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  // Production features
  redosProtection?: boolean;
  emailValidation?: 'regex' | 'validator' | 'hybrid';
  creditCardValidation?: 'basic' | 'luhn' | 'full';
  enableMonitoring?: boolean;
  performanceMode?: 'fast' | 'accurate' | 'balanced';
  maxTextLength?: number;
  regexTimeout?: number;
}

interface PIIDetectionResult {
  fieldName: string;
  piiType: string;
  confidence: number;
  sample: string;
  masked: string;
}

interface DataCloakBridge {
  initialize(config: DataCloakConfig): Promise<void>;
  detectPII(text: string): Promise<PIIDetectionResult[]>;
  maskText(text: string): Promise<{
    originalText: string;
    maskedText: string;
    detectedPII: PIIDetectionResult[];
    metadata: {
      processingTime: number;
      fieldsProcessed: number;
      piiItemsFound: number;
    };
  }>;
  auditSecurity(filePath: string): Promise<any>;
  isAvailable(): boolean;
  getVersion(): string;
}

export class DataCloakService {
  private bridge: DataCloakBridge;
  private initialized = false;
  private config: DataCloakConfig;

  constructor() {
    // Use real DataCloak bridge if available, fallback to mock
    try {
      // Try to load the REAL DataCloak FFI bridge first
      const { RealDataCloakFFIBridge } = require('../../../security/src/datacloak/real-ffi-bridge');
      this.bridge = new RealDataCloakFFIBridge();
      console.log('✅ Using REAL DataCloak FFI bridge with native library');
    } catch (realError) {
      try {
        // Try to load the binary bridge fallback
        const { RateLimitedBinaryBridge } = require('../../../security/src/datacloak/binary-bridge');
        this.bridge = new RateLimitedBinaryBridge();
        console.log('Using DataCloak binary bridge with rate limiting');
      } catch (binaryError) {
        try {
          // Try original FFI bridge as fallback
          const { RateLimitedDataCloakBridge } = require('../../../security/src/datacloak/ffi-bridge');
          this.bridge = new RateLimitedDataCloakBridge();
          console.log('Using DataCloak FFI bridge with rate limiting');
        } catch (ffiError) {
          console.warn('⚠️ Real DataCloak bridges not available, using mock implementation');
          console.warn('Real FFI error:', realError.message);
          console.warn('Binary bridge error:', binaryError.message);
          console.warn('FFI bridge error:', ffiError.message);
          this.bridge = this.createMockBridge();
        }
      }
    }

    this.config = {
      apiKey: process.env.DATACLOAK_API_KEY,
      endpoint: process.env.DATACLOAK_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      timeout: parseInt(process.env.DATACLOAK_TIMEOUT || '30000', 10),
      retryAttempts: parseInt(process.env.DATACLOAK_RETRY_ATTEMPTS || '3', 10),
      // Production features
      redosProtection: process.env.DATACLOAK_REDOS_PROTECTION === 'true',
      emailValidation: (process.env.DATACLOAK_EMAIL_VALIDATION as 'regex' | 'validator' | 'hybrid') || 'validator',
      creditCardValidation: (process.env.DATACLOAK_CC_VALIDATION as 'basic' | 'luhn' | 'full') || 'luhn',
      enableMonitoring: process.env.DATACLOAK_MONITORING === 'true',
      performanceMode: (process.env.DATACLOAK_PERFORMANCE_MODE as 'fast' | 'accurate' | 'balanced') || 'balanced',
      maxTextLength: parseInt(process.env.DATACLOAK_MAX_TEXT_LENGTH || '100000', 10),
      regexTimeout: parseInt(process.env.DATACLOAK_REGEX_TIMEOUT || '1000', 10)
    };
  }

  private getDataCloakBinaryPath(): string {
    // Determine the binary path based on platform
    const platform = process.platform;
    const basePath = join(__dirname, '..', '..', '..', '..', 'security', 'bin');
    
    switch (platform) {
      case 'darwin':
        return join(basePath, 'macos', 'datacloak');
      case 'win32':
        return join(basePath, 'windows', 'datacloak.exe');
      case 'linux':
        return join(basePath, 'linux', 'datacloak');
      default:
        throw new AppError(`Unsupported platform: ${platform}`, 500, 'UNSUPPORTED_PLATFORM');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.bridge.initialize(this.config);
      this.initialized = true;
      console.log(`DataCloak initialized successfully. Version: ${this.bridge.getVersion()}`);
    } catch (error) {
      console.error('Failed to initialize DataCloak:', error);
      throw new AppError('Failed to initialize DataCloak', 500, 'DATACLOAK_INIT_ERROR');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.bridge.detectPII(text);
    } catch (error) {
      console.error('PII detection failed:', error);
      throw new AppError('PII detection failed', 500, 'PII_DETECTION_ERROR');
    }
  }

  async maskText(text: string): Promise<{ originalText: string; maskedText: string; piiItemsFound: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.bridge.maskText(text);
      return {
        originalText: result.originalText,
        maskedText: result.maskedText,
        piiItemsFound: result.metadata.piiItemsFound
      };
    } catch (error) {
      console.error('Text masking failed:', error);
      throw new AppError('Text masking failed', 500, 'TEXT_MASKING_ERROR');
    }
  }

  async detectPIIBatch(texts: string[]): Promise<PIIDetectionResult[][]> {
    const results: PIIDetectionResult[][] = [];
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.detectPII(text))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async maskTextBatch(texts: string[]): Promise<Array<{ originalText: string; maskedText: string; piiItemsFound: number }>> {
    const results: Array<{ originalText: string; maskedText: string; piiItemsFound: number }> = [];
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.maskText(text))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async auditSecurity(filePath: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.bridge.auditSecurity(filePath);
    } catch (error) {
      console.error('Security audit failed:', error);
      throw new AppError('Security audit failed', 500, 'SECURITY_AUDIT_ERROR');
    }
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  getVersion(): string {
    return this.bridge.getVersion();
  }

  async getStats(): Promise<{
    version: string;
    available: boolean;
    initialized: boolean;
    binaryPath?: string;
    config?: any;
  }> {
    return {
      version: this.getVersion(),
      available: this.isAvailable(),
      initialized: this.initialized,
      binaryPath: this.getDataCloakBinaryPath(),
      config: {
        timeout: this.config.timeout,
        retryAttempts: this.config.retryAttempts,
        redosProtection: this.config.redosProtection,
        emailValidation: this.config.emailValidation,
        creditCardValidation: this.config.creditCardValidation,
        enableMonitoring: this.config.enableMonitoring,
        performanceMode: this.config.performanceMode
      }
    };
  }

  /**
   * Run performance tests with large datasets
   */
  async runPerformanceTest(recordCount: number = 1000): Promise<{
    recordsProcessed: number;
    totalTimeMs: number;
    averageTimePerRecord: number;
    piiDetectionRate: number;
    performanceMeetsTarget: boolean;
  }> {
    await this.ensureInitialized();

    const testData = this.generateTestData(recordCount);
    const startTime = Date.now();
    let totalPIIFound = 0;

    console.log(`Starting performance test with ${recordCount} records...`);

    for (let i = 0; i < testData.length; i++) {
      const result = await this.detectPII(testData[i]);
      totalPIIFound += result.length;

      // Log progress every 100 records
      if ((i + 1) % 100 === 0) {
        console.log(`Processed ${i + 1}/${recordCount} records`);
      }
    }

    const totalTimeMs = Date.now() - startTime;
    const averageTimePerRecord = totalTimeMs / recordCount;
    const piiDetectionRate = totalPIIFound / recordCount;
    const performanceMeetsTarget = averageTimePerRecord < 100; // <100ms target

    const results = {
      recordsProcessed: recordCount,
      totalTimeMs,
      averageTimePerRecord,
      piiDetectionRate,
      performanceMeetsTarget
    };

    console.log('Performance Test Results:', results);

    return results;
  }

  /**
   * Generate test data for performance testing
   */
  private generateTestData(count: number): string[] {
    const samples = [
      'Contact John Doe at john.doe@example.com for more information.',
      'Call us at 555-123-4567 or email support@company.com',
      'SSN: 123-45-6789, Credit Card: 4532-1234-5678-9012',
      'Personal data: jane@test.org, phone (555) 987-6543',
      'Regular text without any personal information',
      'Email: user123@domain.co.uk, alternate phone: 555.555.5555'
    ];

    const testData: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomSample = samples[Math.floor(Math.random() * samples.length)];
      // Add some variation to each record
      testData.push(`Record ${i + 1}: ${randomSample} Generated at ${new Date().toISOString()}`);
    }

    return testData;
  }

  private createMockBridge(): DataCloakBridge {
    const self = this; // Reference to access config from bridge methods
    // Enhanced patterns with ReDoS protection
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
      phone: /(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      credit_card: /\b(?:\d[ -]*?){13,19}\b/g,
    };

    // Luhn algorithm for credit card validation
    const isValidLuhn = (cardNumber: string): boolean => {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      
      let sum = 0;
      let alternate = false;
      
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        
        if (alternate) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        alternate = !alternate;
      }
      
      return sum % 10 === 0;
    };

    // Enhanced email validation
    const isValidEmail = (email: string): boolean => {
      if (self.config.emailValidation === 'regex') {
        return patterns.email.test(email);
      } else if (self.config.emailValidation === 'validator') {
        // Enhanced validation with domain checks
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        return emailRegex.test(email) && (validDomains.includes(domain) || domain.includes('.'));
      } else {
        // Hybrid: both regex and domain validation
        return patterns.email.test(email) && email.includes('.') && !email.includes('..');
      }
    };

    // ReDoS protection with timeout
    const safeRegexMatch = (pattern: RegExp, text: string, timeoutMs: number = 1000): RegExpExecArray[] => {
      const matches: RegExpExecArray[] = [];
      const startTime = Date.now();
      
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(text)) !== null) {
        if (Date.now() - startTime > timeoutMs) {
          console.warn('Regex execution timeout - ReDoS protection activated');
          break;
        }
        matches.push(match);
        if (matches.length > 1000) { // Prevent excessive matches
          console.warn('Too many matches detected - limiting results');
          break;
        }
      }
      
      return matches;
    };

    const maskValue = (value: string, type: string): string => {
      switch (type) {
        case 'email':
          const [local, domain] = value.split('@');
          return local[0] + '***@' + domain;
        case 'phone':
          return value.replace(/\d/g, '*').replace(/\*{4}$/, value.slice(-4));
        case 'ssn':
          return '***-**-' + value.slice(-4);
        case 'credit_card':
          return '**** **** **** ' + value.replace(/\D/g, '').slice(-4);
        default:
          return '***';
      }
    };

    const bridge: DataCloakBridge = {
      async initialize(config: DataCloakConfig): Promise<void> {
        console.log('Mock DataCloak bridge initialized');
      },
      
      async detectPII(text: string): Promise<PIIDetectionResult[]> {
        // Check text length protection
        if (self.config.maxTextLength && text.length > self.config.maxTextLength) {
          console.warn(`Text length (${text.length}) exceeds maximum (${self.config.maxTextLength})`);
          text = text.substring(0, self.config.maxTextLength);
        }

        const results: PIIDetectionResult[] = [];
        const timeoutMs = self.config.regexTimeout || 1000;
        
        for (const [type, pattern] of Object.entries(patterns)) {
          let matches: RegExpExecArray[];
          
          if (self.config.redosProtection) {
            matches = safeRegexMatch(pattern, text, timeoutMs);
          } else {
            // Standard regex matching
            matches = [];
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
              matches.push(match);
            }
          }
          
          for (const match of matches) {
            let isValid = true;
            let confidence = 0.95;
            
            // Enhanced validation based on type
            if (type === 'email' && self.config.emailValidation !== 'regex') {
              isValid = isValidEmail(match[0]);
              confidence = isValid ? 0.98 : 0.75;
            } else if (type === 'credit_card' && self.config.creditCardValidation === 'luhn') {
              isValid = isValidLuhn(match[0]);
              confidence = isValid ? 0.99 : 0.60;
            } else if (type === 'credit_card' && self.config.creditCardValidation === 'full') {
              isValid = isValidLuhn(match[0]);
              // Additional full validation could include issuer checks
              confidence = isValid ? 0.99 : 0.50;
            }
            
            if (isValid || confidence > 0.7) { // Include items with reasonable confidence
              results.push({
                fieldName: 'text',
                piiType: type,
                confidence,
                sample: match[0],
                masked: maskValue(match[0], type)
              });
            }
          }
        }
        
        // Log monitoring data if enabled
        if (self.config.enableMonitoring) {
          console.log(`PII Detection: Found ${results.length} items in ${text.length} chars`, {
            types: results.map(r => r.piiType),
            confidences: results.map(r => r.confidence),
            performanceMode: self.config.performanceMode
          });
        }
        
        return results;
      },
      
      async maskText(text: string): Promise<any> {
        const startTime = Date.now();
        const detectedPII = await this.detectPII(text);
        let maskedText = text;
        
        // Sort by position in text (longest first to avoid partial replacements)
        const sortedPII = detectedPII.sort((a, b) => b.sample.length - a.sample.length);
        
        for (const pii of sortedPII) {
          maskedText = maskedText.split(pii.sample).join(pii.masked);
        }
        
        const processingTime = Date.now() - startTime;
        
        // Performance monitoring
        if (self.config.enableMonitoring) {
          console.log(`Masking Performance: ${processingTime}ms for ${text.length} chars, ${detectedPII.length} PII items`);
          
          // Log performance alerts if needed
          if (processingTime > 100) {
            console.warn(`Slow masking operation: ${processingTime}ms - consider optimizing for production`);
          }
        }
        
        return {
          originalText: text,
          maskedText,
          detectedPII,
          metadata: {
            processingTime,
            fieldsProcessed: 1,
            piiItemsFound: detectedPII.length
          }
        };
      },
      
      async auditSecurity(filePath: string): Promise<any> {
        return {
          timestamp: new Date(),
          fileProcessed: filePath,
          piiItemsDetected: 15,
          maskingAccuracy: 0.95,
          encryptionStatus: 'disabled',
          complianceScore: 0.88,
          violations: [],
          recommendations: ['Enable encryption', 'Add access logging']
        };
      },
      
      isAvailable(): boolean {
        return true;
      },
      
      getVersion(): string {
        return '1.0.0-mock';
      }
    };
    
    return bridge;
  }
}

// Singleton instance
export const dataCloak = new DataCloakService();