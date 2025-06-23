import { AppError } from '../middleware/error.middleware';
import { dataCloakManager } from './datacloak/manager';
import {
  DataCloakConfig,
  PIIDetectionResult,
  MaskingResult,
  SecurityAuditResult,
  ServiceOperationResult,
  BatchProcessingResult,
  HealthStatus,
  DataCloakErrorCodes,
  FieldInput,
  FieldMaskingResult,
  FieldMaskingOptions
} from './datacloak/types';

/**
 * DataCloak Service - Simplified wrapper around DataCloak Manager
 * 
 * This service provides a simplified interface for DataCloak operations,
 * delegating to the unified manager to eliminate circular dependencies.
 */
export class DataCloakService {
  private readonly manager = dataCloakManager;

  constructor(config?: Partial<DataCloakConfig>) {
    // Initialize manager with optional config
    if (config) {
      this.manager.updateConfig(config);
    }
  }

  /**
   * Initialize the DataCloak service
   */
  async initialize(config?: Partial<DataCloakConfig>): Promise<void> {
    await this.manager.initialize(config);
  }

  /**
   * Detect PII in text
   */
  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    const result = await this.manager.detectPII(text);
    if (!result.success) {
      throw new AppError(
        result.error?.message || 'PII detection failed',
        500,
        result.error?.code || DataCloakErrorCodes.PII_DETECTION_FAILED
      );
    }
    return result.data!;
  }

  /**
   * Mask PII in text
   */
  async maskText(text: string): Promise<{ originalText: string; maskedText: string; piiItemsFound: number }> {
    const result = await this.manager.maskText(text);
    if (!result.success) {
      throw new AppError(
        result.error?.message || 'Text masking failed',
        500,
        result.error?.code || DataCloakErrorCodes.TEXT_MASKING_FAILED
      );
    }
    
    const maskingResult = result.data!;
    return {
      originalText: maskingResult.originalText,
      maskedText: maskingResult.maskedText,
      piiItemsFound: maskingResult.metadata.piiItemsFound
    };
  }

  /**
   * Process multiple texts for PII detection
   */
  async detectPIIBatch(texts: string[]): Promise<PIIDetectionResult[][]> {
    const result = await this.manager.batchProcessPII(texts);
    if (!result.success) {
      throw new AppError(
        result.error?.message || 'Batch PII detection failed',
        500,
        result.error?.code || DataCloakErrorCodes.BATCH_PROCESSING_FAILED
      );
    }
    return result.data!.results;
  }

  /**
   * Process multiple texts for masking
   */
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

  /**
   * Mask multiple fields - new multi-field functionality
   */
  async maskFields(fields: FieldInput[], options?: FieldMaskingOptions): Promise<FieldMaskingResult[]> {
    this.validateFieldsInput(fields);

    if (fields.length === 0) {
      return [];
    }

    const batchSize = options?.batchSize || 100;
    const continueOnError = options?.continueOnError !== false;
    const results: FieldMaskingResult[] = [];

    // Process fields in batches for better performance
    for (let i = 0; i < fields.length; i += batchSize) {
      const batch = fields.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch, continueOnError);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Validate fields input array
   */
  private validateFieldsInput(fields: FieldInput[]): void {
    if (!Array.isArray(fields)) {
      throw new AppError('Fields must be an array', 400, DataCloakErrorCodes.CONFIG_INVALID);
    }

    for (const field of fields) {
      if (!field || typeof field.fieldName !== 'string') {
        throw new AppError('Invalid field structure', 400, DataCloakErrorCodes.CONFIG_INVALID);
      }
      // Allow null/undefined text but validate non-null text is string
      if (field.text !== null && field.text !== undefined && typeof field.text !== 'string') {
        throw new AppError('Invalid field structure', 400, DataCloakErrorCodes.CONFIG_INVALID);
      }
    }
  }

  /**
   * Process a batch of fields
   */
  private async processBatch(batch: FieldInput[], continueOnError: boolean): Promise<FieldMaskingResult[]> {
    const promises = batch.map(field => this.processField(field, continueOnError));
    return Promise.all(promises);
  }

  /**
   * Process a single field
   */
  private async processField(field: FieldInput, continueOnError: boolean): Promise<FieldMaskingResult> {
    try {
      if (field.text == null) {
        return this.createErrorResult(field, 'Text cannot be null or undefined', 'validation', false);
      }

      const maskResult = await this.maskText(field.text);
      
      return {
        fieldName: field.fieldName,
        originalText: maskResult.originalText,
        maskedText: maskResult.maskedText,
        piiItemsFound: maskResult.piiItemsFound,
        metadata: field.metadata,
        success: true
      };
    } catch (error) {
      if (!continueOnError) {
        throw error;
      }

      return this.createErrorResult(
        field, 
        error instanceof Error ? error.message : 'Unknown error',
        'processing',
        true
      );
    }
  }

  /**
   * Create an error result for a field
   */
  private createErrorResult(
    field: FieldInput, 
    message: string, 
    type: 'validation' | 'processing',
    retryable: boolean
  ): FieldMaskingResult {
    return {
      fieldName: field.fieldName,
      originalText: field.text || '',
      maskedText: field.text || '',
      piiItemsFound: 0,
      metadata: field.metadata,
      success: false,
      error: {
        code: DataCloakErrorCodes.TEXT_MASKING_FAILED,
        message,
        type,
        retryable
      }
    };
  }

  /**
   * Audit security of a file
   */
  async auditSecurity(filePath: string): Promise<SecurityAuditResult> {
    const result = await this.manager.auditSecurity(filePath);
    if (!result.success) {
      throw new AppError(
        result.error?.message || 'Security audit failed',
        500,
        result.error?.code || DataCloakErrorCodes.SYSTEM_ERROR
      );
    }
    return result.data!;
  }

  /**
   * Get health status of the DataCloak service
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return this.manager.getHealthStatus();
  }

  /**
   * Check if DataCloak service is available
   */
  isAvailable(): boolean {
    return this.manager.getState().healthy;
  }

  /**
   * Get current configuration (without sensitive data)
   */
  getConfig(): Omit<DataCloakConfig, 'apiKey'> {
    return this.manager.getSafeConfig();
  }

  /**
   * Get DataCloak version
   */
  async getVersion(): Promise<string> {
    const health = await this.manager.getHealthStatus();
    return health.version;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<DataCloakConfig>): Promise<void> {
    await this.manager.updateConfig(config);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.manager.getCircuitBreakerMetrics();
  }

  /**
   * Reset circuit breaker (for manual intervention)
   */
  resetCircuitBreaker(): void {
    this.manager.getCircuitBreakerMetrics(); // Access to reset functionality would be through manager
  }

  /**
   * Force circuit breaker to open (for testing)
   */
  forceCircuitBreakerOpen(): void {
    // This would need to be implemented in the manager if needed for testing
  }

  /**
   * Get service state for monitoring
   */
  getServiceState() {
    return this.manager.getState();
  }
}

// Singleton instance
export const dataCloak = new DataCloakService();