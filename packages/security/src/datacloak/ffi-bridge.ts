import * as ffi from 'ffi-napi';
import * as ref from 'ref-napi';
import * as path from 'path';
import { DataCloakBridge, PIIDetectionResult, MaskingResult } from '../interfaces/datacloak';

export class DataCloakFFIBridge implements DataCloakBridge {
  private library: any;
  private engine: any;
  private initialized = false;

  constructor() {
    try {
      // Determine the library path based on platform
      const libPath = this.getLibraryPath();
      
      // Define the FFI interface
      this.library = ffi.Library(libPath, {
        'datacloak_create': ['pointer', []],
        'datacloak_destroy': ['void', ['pointer']],
        'datacloak_detect_pii': ['string', ['pointer', 'string']],
        'datacloak_mask_text': ['string', ['pointer', 'string']],
        'datacloak_free_string': ['void', ['string']],
        'datacloak_version': ['string', []]
      });

      console.log('DataCloak FFI library loaded successfully');
    } catch (error) {
      console.error('Failed to load DataCloak FFI library:', error);
      throw new Error(`Failed to load DataCloak library: ${error}`);
    }
  }

  private getLibraryPath(): string {
    const platform = process.platform;
    const basePath = path.join(__dirname, '..', '..', 'datacloak-core', 'target', 'release');
    
    switch (platform) {
      case 'darwin':
        return path.join(basePath, 'libdatacloak_core.dylib');
      case 'win32':
        return path.join(basePath, 'datacloak_core.dll');
      case 'linux':
        return path.join(basePath, 'libdatacloak_core.so');
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.engine = this.library.datacloak_create();
      if (ref.isNull(this.engine)) {
        throw new Error('Failed to create DataCloak engine');
      }
      
      this.initialized = true;
      console.log(`DataCloak FFI engine initialized. Version: ${this.getVersion()}`);
    } catch (error) {
      throw new Error(`Failed to initialize DataCloak engine: ${error}`);
    }
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    if (!this.initialized || ref.isNull(this.engine)) {
      throw new Error('DataCloak engine not initialized');
    }

    try {
      const resultJson = this.library.datacloak_detect_pii(this.engine, text);
      if (!resultJson) {
        throw new Error('PII detection failed');
      }

      const results = JSON.parse(resultJson);
      
      // Convert Rust result format to our interface format
      return results.map((result: any) => ({
        fieldName: result.field_name,
        piiType: result.pii_type,
        confidence: result.confidence,
        sample: result.sample,
        masked: result.masked
      }));
    } catch (error) {
      throw new Error(`PII detection failed: ${error}`);
    }
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
    if (!this.initialized || ref.isNull(this.engine)) {
      throw new Error('DataCloak engine not initialized');
    }

    try {
      const resultJson = this.library.datacloak_mask_text(this.engine, text);
      if (!resultJson) {
        throw new Error('Text masking failed');
      }

      const result = JSON.parse(resultJson);
      
      // Convert Rust result format to our interface format
      const detectedPII = result.detected_pii.map((pii: any) => ({
        fieldName: pii.field_name,
        piiType: pii.pii_type,
        confidence: pii.confidence,
        sample: pii.sample,
        masked: pii.masked
      }));

      return {
        originalText: result.original_text,
        maskedText: result.masked_text,
        detectedPII,
        metadata: {
          processingTime: result.metadata.processing_time,
          fieldsProcessed: result.metadata.fields_processed,
          piiItemsFound: result.metadata.pii_items_found
        }
      };
    } catch (error) {
      throw new Error(`Text masking failed: ${error}`);
    }
  }

  async auditSecurity(filePath: string): Promise<any> {
    // For now, return a mock audit result
    // In a real implementation, this would process the file
    return {
      timestamp: new Date(),
      fileProcessed: filePath,
      piiItemsDetected: 0,
      maskingAccuracy: 0.98,
      encryptionStatus: 'disabled',
      complianceScore: 0.95,
      violations: [],
      recommendations: []
    };
  }

  isAvailable(): boolean {
    return this.initialized && !ref.isNull(this.engine);
  }

  getVersion(): string {
    try {
      return this.library.datacloak_version() || '1.0.0-ffi';
    } catch (error) {
      return '1.0.0-ffi-error';
    }
  }

  destroy(): void {
    if (this.initialized && !ref.isNull(this.engine)) {
      this.library.datacloak_destroy(this.engine);
      this.engine = null;
      this.initialized = false;
      console.log('DataCloak FFI engine destroyed');
    }
  }
}

// Rate limiting implementation
export class RateLimitedDataCloakBridge implements DataCloakBridge {
  private bridge: DataCloakFFIBridge;
  private requestQueue: Array<{ resolve: Function; reject: Function; request: Function }> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly REQUEST_INTERVAL = 334; // ~3 requests per second (1000ms / 3 = 333.33ms)

  constructor() {
    this.bridge = new DataCloakFFIBridge();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.REQUEST_INTERVAL) {
        const waitTime = this.REQUEST_INTERVAL - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const item = this.requestQueue.shift();
      if (item) {
        try {
          const result = await item.request();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
        this.lastRequestTime = Date.now();
      }
    }

    this.processing = false;
  }

  private queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, request });
      this.processQueue();
    });
  }

  async initialize(): Promise<void> {
    return this.bridge.initialize();
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    return this.queueRequest(() => this.bridge.detectPII(text));
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
    return this.queueRequest(() => this.bridge.maskText(text));
  }

  async auditSecurity(filePath: string): Promise<any> {
    return this.queueRequest(() => this.bridge.auditSecurity(filePath));
  }

  isAvailable(): boolean {
    return this.bridge.isAvailable();
  }

  getVersion(): string {
    return this.bridge.getVersion();
  }

  destroy(): void {
    this.bridge.destroy();
  }
}