import { spawn, ChildProcess } from 'child_process';
import { platform } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { 
  DataCloakBridge, 
  DataCloakConfig, 
  PIIDetectionResult, 
  MaskingResult, 
  SecurityAuditResult, 
  PIIType 
} from '../interfaces/datacloak';

export interface DataCloakBinaryConfig extends DataCloakConfig {
  binaryPath?: string;
  useSystemBinary?: boolean;
  fallbackToMock?: boolean;
}

export class NativeDataCloakBridge implements DataCloakBridge {
  private config: DataCloakBinaryConfig = {};
  private binaryPath: string | null = null;
  private initialized = false;
  private readonly version = '1.0.0-native';

  constructor(config: Partial<DataCloakBinaryConfig> = {}) {
    this.config = {
      fallbackToMock: true,
      useSystemBinary: false,
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };
  }

  async initialize(config: DataCloakConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    try {
      this.binaryPath = await this.locateDataCloakBinary();
      await this.verifyBinaryCompatibility();
      this.initialized = true;
    } catch (error) {
      if (this.config.fallbackToMock) {
        console.warn('DataCloak binary not available, using mock implementation');
        this.initialized = true;
      } else {
        throw new Error(`Failed to initialize DataCloak: ${error}`);
      }
    }
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    if (!this.binaryPath) {
      return this.fallbackDetectPII(text);
    }

    try {
      const command = {
        action: 'detect',
        text,
        options: {
          confidence_threshold: 0.8,
          include_patterns: true
        }
      };

      const result = await this.executeBinaryCommand(command);
      return this.parseDetectionResult(result);
    } catch (error) {
      if (this.config.fallbackToMock) {
        console.warn('Binary detection failed, falling back to mock');
        return this.fallbackDetectPII(text);
      }
      throw error;
    }
  }

  async maskText(text: string): Promise<MaskingResult> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    const startTime = Date.now();
    
    if (!this.binaryPath) {
      return this.fallbackMaskText(text, startTime);
    }

    try {
      const command = {
        action: 'mask',
        text,
        options: {
          preserve_format: true,
          mask_char: '*',
          partial_masking: true
        }
      };

      const result = await this.executeBinaryCommand(command);
      return this.parseMaskingResult(result, text, startTime);
    } catch (error) {
      if (this.config.fallbackToMock) {
        console.warn('Binary masking failed, falling back to mock');
        return this.fallbackMaskText(text, startTime);
      }
      throw error;
    }
  }

  async auditSecurity(filePath: string): Promise<SecurityAuditResult> {
    if (!this.initialized) {
      throw new Error('DataCloak not initialized');
    }

    if (!this.binaryPath) {
      return this.fallbackAuditSecurity(filePath);
    }

    try {
      const command = {
        action: 'audit',
        file_path: filePath,
        options: {
          deep_scan: true,
          check_compliance: true,
          generate_report: true
        }
      };

      const result = await this.executeBinaryCommand(command);
      return this.parseAuditResult(result, filePath);
    } catch (error) {
      if (this.config.fallbackToMock) {
        console.warn('Binary audit failed, falling back to mock');
        return this.fallbackAuditSecurity(filePath);
      }
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  getVersion(): string {
    return this.binaryPath ? `${this.version}-binary` : `${this.version}-mock`;
  }

  private async locateDataCloakBinary(): Promise<string> {
    if (this.config.binaryPath && existsSync(this.config.binaryPath)) {
      return this.config.binaryPath;
    }

    const currentPlatform = platform();
    const possiblePaths = this.getBinaryPaths(currentPlatform);

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    if (this.config.useSystemBinary) {
      // Try to find DataCloak in system PATH
      const systemBinary = await this.findSystemBinary();
      if (systemBinary) {
        return systemBinary;
      }
    }

    throw new Error('DataCloak binary not found');
  }

  private getBinaryPaths(currentPlatform: string): string[] {
    const baseDir = join(__dirname, '..', '..', 'bin');
    
    switch (currentPlatform) {
      case 'win32':
        return [
          join(baseDir, 'windows', 'datacloak.exe'),
          join(baseDir, 'datacloak.exe'),
          'C:\\Program Files\\DataCloak\\datacloak.exe',
          'C:\\Program Files (x86)\\DataCloak\\datacloak.exe'
        ];
      case 'darwin':
        return [
          join(baseDir, 'macos', 'datacloak'),
          join(baseDir, 'datacloak'),
          '/Applications/DataCloak.app/Contents/MacOS/datacloak',
          '/usr/local/bin/datacloak'
        ];
      case 'linux':
        return [
          join(baseDir, 'linux', 'datacloak'),
          join(baseDir, 'datacloak'),
          '/usr/bin/datacloak',
          '/usr/local/bin/datacloak'
        ];
      default:
        return [join(baseDir, 'datacloak')];
    }
  }

  private async findSystemBinary(): Promise<string | null> {
    return new Promise((resolve) => {
      const which = platform() === 'win32' ? 'where' : 'which';
      const process = spawn(which, ['datacloak']);
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim().split('\n')[0]);
        } else {
          resolve(null);
        }
      });

      process.on('error', () => resolve(null));
    });
  }

  private async verifyBinaryCompatibility(): Promise<void> {
    if (!this.binaryPath) {
      throw new Error('No binary path available');
    }

    const command = { action: 'version' };
    const result = await this.executeBinaryCommand(command, 5000);
    
    if (!result.version) {
      throw new Error('Binary version check failed');
    }

    console.log(`DataCloak binary version: ${result.version}`);
  }

  private async executeBinaryCommand(command: any, timeout?: number): Promise<any> {
    if (!this.binaryPath) {
      throw new Error('No binary available');
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.binaryPath!, ['--json'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse binary output: ${error}`));
          }
        } else {
          reject(new Error(`Binary process failed with code ${code}: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to spawn binary process: ${error}`));
      });

      // Set timeout
      const timeoutMs = timeout || this.config.timeout || 30000;
      const timer = setTimeout(() => {
        process.kill();
        reject(new Error('Binary command timeout'));
      }, timeoutMs);

      process.on('close', () => clearTimeout(timer));

      // Send command to binary
      process.stdin.write(JSON.stringify(command));
      process.stdin.end();
    });
  }

  private parseDetectionResult(result: any): PIIDetectionResult[] {
    if (!result.detections) {
      return [];
    }

    return result.detections.map((detection: any) => ({
      fieldName: detection.field || 'unknown',
      piiType: this.mapPIIType(detection.type),
      confidence: detection.confidence || 0.5,
      sample: detection.sample || '',
      masked: detection.masked || '[MASKED]'
    }));
  }

  private parseMaskingResult(result: any, originalText: string, startTime: number): MaskingResult {
    const processingTime = Date.now() - startTime;
    
    return {
      originalText,
      maskedText: result.masked_text || originalText,
      detectedPII: this.parseDetectionResult(result),
      metadata: {
        processingTime,
        fieldsProcessed: 1,
        piiItemsFound: result.pii_count || 0
      }
    };
  }

  private parseAuditResult(result: any, filePath: string): SecurityAuditResult {
    return {
      timestamp: new Date(),
      fileProcessed: filePath,
      piiItemsDetected: result.pii_count || 0,
      maskingAccuracy: result.accuracy || 0.95,
      encryptionStatus: result.encryption_enabled ? 'enabled' : 'disabled',
      complianceScore: result.compliance_score || 0.9,
      violations: result.violations || [],
      recommendations: result.recommendations || []
    };
  }

  private mapPIIType(type: string): PIIType {
    const typeMap: Record<string, PIIType> = {
      'email': PIIType.EMAIL,
      'phone': PIIType.PHONE,
      'ssn': PIIType.SSN,
      'credit_card': PIIType.CREDIT_CARD,
      'address': PIIType.ADDRESS,
      'name': PIIType.NAME,
      'date_of_birth': PIIType.DATE_OF_BIRTH
    };

    return typeMap[type.toLowerCase()] || PIIType.CUSTOM;
  }

  // Fallback methods using existing mock implementation
  private async fallbackDetectPII(text: string): Promise<PIIDetectionResult[]> {
    const { DataCloakMock } = await import('../mock/datacloak-mock');
    const mock = new DataCloakMock();
    await mock.initialize({});
    return mock.detectPII(text);
  }

  private async fallbackMaskText(text: string, startTime: number): Promise<MaskingResult> {
    const { DataCloakMock } = await import('../mock/datacloak-mock');
    const mock = new DataCloakMock();
    await mock.initialize({});
    return mock.maskText(text);
  }

  private async fallbackAuditSecurity(filePath: string): Promise<SecurityAuditResult> {
    const { DataCloakMock } = await import('../mock/datacloak-mock');
    const mock = new DataCloakMock();
    await mock.initialize({});
    return mock.auditSecurity(filePath);
  }
}