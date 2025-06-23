/**
 * DataCloak Manager - Unified Service Management
 * 
 * This manager eliminates circular dependencies by providing a single entry point
 * for all DataCloak operations. It manages bridge instances, configuration,
 * and service lifecycle.
 */

import { join } from 'path';
import { AppError } from '../../middleware/error.middleware';
import { CircuitBreaker, circuitBreakerManager } from '../circuit-breaker.service';
import logger from '../../config/logger';
import {
  DataCloakConfig,
  DataCloakBridge,
  PIIDetectionResult,
  MaskingResult,
  SecurityAuditResult,
  ServiceOperationResult,
  ServiceError,
  ServiceState,
  HealthStatus,
  BatchProcessingResult,
  FileProcessingResult,
  StreamProcessingOptions,
  DataCloakErrorCodes,
  DEFAULT_DATACLOAK_CONFIG,
  isPIIDetectionResult,
  isMaskingResult
} from './types';

/**
 * DataCloak Manager - Centralized service management
 */
export class DataCloakManager {
  private static instance: DataCloakManager;
  private bridge: DataCloakBridge | null = null;
  private config: DataCloakConfig;
  private initialized = false;
  private circuitBreaker: CircuitBreaker;
  private state: ServiceState;

  private constructor() {
    this.config = { ...DEFAULT_DATACLOAK_CONFIG };
    this.state = {
      initialized: false,
      healthy: false,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      }
    };

    // Initialize circuit breaker
    this.circuitBreaker = circuitBreakerManager.getBreaker('datacloak-manager', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: this.config.timeout || 30000,
      resetTimeout: 30000,
      volumeThreshold: 5,
      errorThresholdPercentage: 60,
      fallbackFunction: async () => this.getFallbackResult()
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DataCloakManager {
    if (!this.instance) {
      this.instance = new DataCloakManager();
    }
    return this.instance;
  }

  /**
   * Initialize the DataCloak manager with configuration
   */
  async initialize(config?: Partial<DataCloakConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.config = {
      ...DEFAULT_DATACLOAK_CONFIG,
      ...this.loadEnvironmentConfig(),
      ...config
    };

    try {
      this.bridge = await this.createBridge();
      await this.bridge.initialize(this.config);
      
      this.initialized = true;
      this.state.initialized = true;
      this.state.healthy = this.bridge.isAvailable();
      
      logger.info('DataCloak manager initialized successfully', {
        bridge: this.getBridgeType(),
        version: this.bridge.getVersion(),
        config: this.getSafeConfig()
      });
    } catch (error) {
      const serviceError = this.createServiceError(
        DataCloakErrorCodes.INIT_FAILED,
        'DataCloak manager initialization failed',
        'system',
        false,
        error
      );
      
      this.state.lastError = serviceError;
      logger.error('DataCloak manager initialization failed', { error: serviceError });
      
      if (!this.config.fallbackToMock) {
        throw new AppError(serviceError.message, 500, serviceError.code);
      }
      
      // Fall back to mock if allowed
      this.bridge = this.createMockBridge();
      await this.bridge.initialize(this.config);
      this.initialized = true;
      this.state.initialized = true;
      this.state.healthy = true;
      
      logger.warn('DataCloak manager initialized with mock bridge', { originalError: serviceError });
    }
  }

  /**
   * Detect PII in text with circuit breaker protection
   */
  async detectPII(text: string): Promise<ServiceOperationResult<PIIDetectionResult[]>> {
    return this.executeWithMetrics(async () => {
      if (!this.initialized) {
        await this.initialize();
      }

      return this.circuitBreaker.execute(async () => {
        const result = await this.bridge!.detectPII(text);
        
        if (!Array.isArray(result) || !result.every(isPIIDetectionResult)) {
          throw new Error('Invalid PII detection result format');
        }
        
        return result;
      });
    });
  }

  /**
   * Mask text with circuit breaker protection
   */
  async maskText(text: string): Promise<ServiceOperationResult<MaskingResult>> {
    return this.executeWithMetrics(async () => {
      if (!this.initialized) {
        await this.initialize();
      }

      return this.circuitBreaker.execute(async () => {
        const result = await this.bridge!.maskText(text);
        
        if (!isMaskingResult(result)) {
          throw new Error('Invalid masking result format');
        }
        
        return result;
      });
    });
  }

  /**
   * Batch process multiple texts
   */
  async batchProcessPII(texts: string[]): Promise<ServiceOperationResult<BatchProcessingResult>> {
    return this.executeWithMetrics(async () => {
      if (!this.initialized) {
        await this.initialize();
      }

      const startTime = Date.now();
      const results: PIIDetectionResult[][] = [];
      const errors: Array<{ index: number; error: ServiceError }> = [];
      
      const batchSize = this.config.batchSize || 100;
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (text, batchIndex) => {
            const globalIndex = i + batchIndex;
            try {
              const result = await this.detectPII(text);
              if (result.success && result.data) {
                results[globalIndex] = result.data;
              } else {
                errors.push({
                  index: globalIndex,
                  error: result.error || this.createServiceError(
                    DataCloakErrorCodes.PII_DETECTION_FAILED,
                    'PII detection failed for batch item',
                    'processing',
                    true
                  )
                });
              }
            } catch (error) {
              errors.push({
                index: globalIndex,
                error: this.createServiceError(
                  DataCloakErrorCodes.BATCH_PROCESSING_FAILED,
                  'Batch processing failed for item',
                  'processing',
                  true,
                  error
                )
              });
            }
          })
        );
      }

      return {
        totalItems: texts.length,
        processedItems: results.filter(r => r).length,
        failedItems: errors.length,
        results,
        errors,
        executionTime: Date.now() - startTime
      };
    });
  }

  /**
   * Audit security of a file
   */
  async auditSecurity(filePath: string): Promise<ServiceOperationResult<SecurityAuditResult>> {
    return this.executeWithMetrics(async () => {
      if (!this.initialized) {
        await this.initialize();
      }

      return this.circuitBreaker.execute(async () => {
        return this.bridge!.auditSecurity(filePath);
      });
    });
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const status: HealthStatus = {
      status: this.state.healthy ? 'healthy' : 'unhealthy',
      version: this.bridge?.getVersion() || 'unknown',
      uptime: process.uptime(),
      lastCheck: new Date(),
      services: {
        ffi: false,
        binary: false,
        mock: false
      },
      performance: {
        averageResponseTime: this.state.stats.averageResponseTime,
        requestsPerSecond: this.calculateRequestsPerSecond(),
        errorRate: this.calculateErrorRate()
      }
    };

    // Determine which bridge type is active
    const bridgeType = this.getBridgeType();
    if (bridgeType === 'real-ffi') {
      status.services.ffi = true;
    } else if (bridgeType === 'binary') {
      status.services.binary = true;
    } else {
      status.services.mock = true;
    }

    return status;
  }

  /**
   * Get current configuration (safe - no secrets)
   */
  getSafeConfig(): Omit<DataCloakConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<DataCloakConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    if (this.initialized && this.bridge) {
      await this.bridge.initialize(this.config);
    }
  }

  /**
   * Reset the manager (for testing)
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.bridge = null;
    this.state = {
      initialized: false,
      healthy: false,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      }
    };
    this.circuitBreaker.reset();
  }

  /**
   * Get service state
   */
  getState(): ServiceState {
    return { ...this.state };
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  // Private helper methods

  private async createBridge(): Promise<DataCloakBridge> {
    // Try to load bridges in order of preference
    const bridgeAttempts = [
      () => this.loadRealFFIBridge(),
      () => this.loadBinaryBridge(),
      () => this.loadFFIBridge()
    ];

    for (const attempt of bridgeAttempts) {
      try {
        const bridge = await attempt();
        if (bridge) {
          return bridge;
        }
      } catch (error) {
        logger.debug('Bridge loading attempt failed', { error: error.message });
      }
    }

    // Fall back to mock if no bridge is available
    logger.warn('No DataCloak bridges available, using mock implementation');
    return this.createMockBridge();
  }

  private async loadRealFFIBridge(): Promise<DataCloakBridge> {
    const { RealDataCloakFFIBridge } = require('../../../security/src/datacloak/real-ffi-bridge');
    return new RealDataCloakFFIBridge();
  }

  private async loadBinaryBridge(): Promise<DataCloakBridge> {
    const { RateLimitedBinaryBridge } = require('../../../security/src/datacloak/binary-bridge');
    return new RateLimitedBinaryBridge();
  }

  private async loadFFIBridge(): Promise<DataCloakBridge> {
    const { RateLimitedDataCloakBridge } = require('../../../security/src/datacloak/ffi-bridge');
    return new RateLimitedDataCloakBridge();
  }

  private createMockBridge(): DataCloakBridge {
    return {
      async initialize() {
        // Mock initialization
      },
      
      async detectPII(text: string): Promise<PIIDetectionResult[]> {
        // Simple mock PII detection
        const patterns = [
          { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, type: 'CREDIT_CARD' },
          { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'EMAIL' },
          { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'SSN' },
          { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'PHONE' }
        ];

        const results: PIIDetectionResult[] = [];
        
        for (const pattern of patterns) {
          let match;
          pattern.regex.lastIndex = 0; // Reset regex
          while ((match = pattern.regex.exec(text)) !== null) {
            results.push({
              fieldName: 'text',
              piiType: pattern.type,
              confidence: 0.85,
              sample: match[0],
              masked: '*'.repeat(match[0].length),
              position: {
                start: match.index || 0,
                end: (match.index || 0) + match[0].length
              }
            });
            
            // Prevent infinite loop with global regex
            if (!pattern.regex.global) break;
          }
        }

        return results;
      },

      async maskText(text: string): Promise<MaskingResult> {
        const detectedPII = await this.detectPII(text);
        let maskedText = text;
        
        for (const pii of detectedPII) {
          maskedText = maskedText.replace(pii.sample, pii.masked);
        }

        return {
          originalText: text,
          maskedText,
          detectedPII,
          metadata: {
            processingTime: 10,
            fieldsProcessed: 1,
            piiItemsFound: detectedPII.length,
            fallbackUsed: true,
            processingMode: 'fast',
            version: '1.0.0-mock'
          }
        };
      },

      async auditSecurity(): Promise<SecurityAuditResult> {
        return {
          timestamp: new Date(),
          fileProcessed: 'mock-file',
          piiItemsDetected: 0,
          maskingAccuracy: 0.95,
          encryptionStatus: 'disabled',
          complianceScore: 0.8,
          violations: [],
          recommendations: ['Use real DataCloak implementation'],
          riskAssessment: {
            overallRisk: 'medium',
            factors: [],
            score: 60,
            mitigationSuggestions: ['Implement proper PII detection']
          }
        };
      },

      isAvailable(): boolean {
        return true;
      },

      getVersion(): string {
        return '1.0.0-mock';
      }
    };
  }

  private loadEnvironmentConfig(): Partial<DataCloakConfig> {
    return {
      apiKey: process.env.DATACLOAK_API_KEY,
      endpoint: process.env.DATACLOAK_API_ENDPOINT,
      timeout: parseInt(process.env.DATACLOAK_TIMEOUT || '0', 10) || undefined,
      retryAttempts: parseInt(process.env.DATACLOAK_RETRY_ATTEMPTS || '0', 10) || undefined,
      redosProtection: process.env.DATACLOAK_REDOS_PROTECTION === 'true',
      emailValidation: (process.env.DATACLOAK_EMAIL_VALIDATION as any) || undefined,
      creditCardValidation: (process.env.DATACLOAK_CC_VALIDATION as any) || undefined,
      enableMonitoring: process.env.DATACLOAK_MONITORING === 'true',
      performanceMode: (process.env.DATACLOAK_PERFORMANCE_MODE as any) || undefined,
      maxTextLength: parseInt(process.env.DATACLOAK_MAX_TEXT_LENGTH || '0', 10) || undefined,
      regexTimeout: parseInt(process.env.DATACLOAK_REGEX_TIMEOUT || '0', 10) || undefined
    };
  }

  private getBridgeType(): string {
    if (!this.bridge) return 'none';
    
    const version = this.bridge.getVersion();
    if (version.includes('mock')) return 'mock';
    if (version.includes('real-ffi')) return 'real-ffi';
    if (version.includes('binary')) return 'binary';
    return 'ffi';
  }

  private async getFallbackResult(): Promise<any> {
    return {
      fallbackUsed: true,
      message: 'DataCloak service temporarily unavailable'
    };
  }

  private async executeWithMetrics<T>(operation: () => Promise<T>): Promise<ServiceOperationResult<T>> {
    const startTime = Date.now();
    this.state.stats.totalRequests++;

    try {
      const data = await operation();
      const executionTime = Date.now() - startTime;
      
      this.state.stats.successfulRequests++;
      this.updateAverageResponseTime(executionTime);
      
      return {
        success: true,
        data,
        metadata: {
          executionTime,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: this.circuitBreaker.getMetrics().state
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.state.stats.failedRequests++;
      this.updateAverageResponseTime(executionTime);
      
      const serviceError = this.createServiceError(
        DataCloakErrorCodes.SYSTEM_ERROR,
        'Operation failed',
        'processing',
        true,
        error
      );
      
      this.state.lastError = serviceError;
      
      return {
        success: false,
        error: serviceError,
        metadata: {
          executionTime,
          retryCount: 0,
          fallbackUsed: false,
          circuitBreakerState: this.circuitBreaker.getMetrics().state
        }
      };
    }
  }

  private createServiceError(
    code: DataCloakErrorCodes,
    message: string,
    type: ServiceError['type'],
    retryable: boolean,
    originalError?: any
  ): ServiceError {
    return {
      code,
      message,
      type,
      retryable,
      details: originalError ? {
        originalMessage: originalError.message,
        stack: originalError.stack
      } : undefined
    };
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.state.stats.totalRequests;
    const currentAverage = this.state.stats.averageResponseTime;
    
    this.state.stats.averageResponseTime = 
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  private calculateRequestsPerSecond(): number {
    const uptime = process.uptime();
    return uptime > 0 ? this.state.stats.totalRequests / uptime : 0;
  }

  private calculateErrorRate(): number {
    const totalRequests = this.state.stats.totalRequests;
    return totalRequests > 0 ? this.state.stats.failedRequests / totalRequests : 0;
  }
}

// Export singleton instance
export const dataCloakManager = DataCloakManager.getInstance();