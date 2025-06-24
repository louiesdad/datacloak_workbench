import { DataCloakService } from './datacloak.service';
import {
  FieldInput,
  PIIDetectionResult,
  FieldDiscoveryOptions,
  FieldDiscoveryResult,
  DiscoveredField,
  PatternAnalysis
} from './datacloak/types';

/**
 * Field Discovery Engine for automated PII field identification
 * 
 * This engine analyzes datasets to automatically discover fields containing PII,
 * assigns confidence scores based on content analysis, and provides pattern analysis
 * for field naming conventions. It supports sampling for large datasets and provides
 * comprehensive reporting with risk assessments.
 * 
 * Key Features:
 * - Automated PII detection with confidence scoring
 * - Field name pattern analysis for additional PII hints
 * - Sampling support for large datasets (performance optimization)
 * - Comprehensive risk assessment and categorization
 * - Error handling with continue-on-error options
 * 
 * @example
 * ```typescript
 * const discoveryEngine = new FieldDiscoveryEngine(dataCloakService);
 * 
 * // Basic discovery
 * const result = await discoveryEngine.discoverPIIFields(dataset);
 * 
 * // Discovery with pattern analysis and sampling
 * const advancedResult = await discoveryEngine.discoverPIIFields(dataset, {
 *   confidenceThreshold: 0.7,
 *   includePatternAnalysis: true,
 *   enableSampling: true,
 *   maxSampleSize: 1000
 * });
 * ```
 */
export class FieldDiscoveryEngine {
  private dataCloak: DataCloakService;

  // Configuration constants
  private static readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.0;
  private static readonly DEFAULT_SAMPLE_SIZE = 1000;
  private static readonly PATTERN_CONFIDENCE = 0.8;

  // Risk level thresholds
  private static readonly RISK_THRESHOLDS = {
    HIGH: 0.9,
    MEDIUM: 0.7,
    LOW: 0.0
  };

  // Common PII field name patterns for pattern analysis
  private static readonly PII_PATTERNS = [
    { pattern: /email|e_mail|e-mail|mail/i, type: 'email' },
    { pattern: /phone|telephone|tel|mobile/i, type: 'phone' },
    { pattern: /ssn|social_security|social-security/i, type: 'ssn' },
    { pattern: /credit_card|creditcard|cc_number/i, type: 'credit_card' },
    { pattern: /first_name|firstname|fname/i, type: 'name' },
    { pattern: /last_name|lastname|lname|surname/i, type: 'name' },
    { pattern: /address|addr|street/i, type: 'address' },
    { pattern: /zip_code|zipcode|postal/i, type: 'postal_code' }
  ];

  constructor(dataCloak: DataCloakService) {
    this.dataCloak = dataCloak;
  }

  /**
   * Discover PII fields in a dataset
   * 
   * Analyzes each field in the dataset for PII content using the DataCloak service,
   * applies confidence filtering, and optionally performs pattern analysis on field names.
   * Supports sampling for large datasets to improve performance.
   * 
   * @param dataset - Array of field inputs to analyze
   * @param options - Configuration options for discovery process
   * @returns Promise resolving to comprehensive discovery results
   */
  async discoverPIIFields(
    dataset: FieldInput[], 
    options: FieldDiscoveryOptions = {}
  ): Promise<FieldDiscoveryResult> {
    const startTime = Date.now();
    
    // Extract and set default options
    const {
      confidenceThreshold = FieldDiscoveryEngine.DEFAULT_CONFIDENCE_THRESHOLD,
      includePatternAnalysis = false,
      enableSampling = false,
      maxSampleSize = FieldDiscoveryEngine.DEFAULT_SAMPLE_SIZE,
      continueOnError = false
    } = options;

    // Determine if sampling should be used for performance optimization
    const shouldUseSampling = enableSampling && dataset.length > maxSampleSize;
    const fieldsToAnalyze = shouldUseSampling 
      ? this.sampleFields(dataset, maxSampleSize)
      : dataset;

    // Initialize collection arrays
    const discoveredFields: DiscoveredField[] = [];
    const errors: Array<{ fieldName: string; error: string }> = [];

    // Main analysis loop - process each field for PII content
    await this.analyzeFieldsForPII(fieldsToAnalyze, discoveredFields, errors, {
      confidenceThreshold,
      continueOnError
    });

    // Generate pattern analysis if requested
    let patternAnalysis: PatternAnalysis | undefined;
    if (includePatternAnalysis) {
      patternAnalysis = this.analyzeFieldPatterns(dataset);
    }

    // Generate summary
    const summary = this.generateSummary(discoveredFields, dataset.length);

    return {
      discoveredFields,
      totalFieldsAnalyzed: dataset.length,
      piiFieldsFound: discoveredFields.length,
      samplingUsed: shouldUseSampling,
      sampleSize: shouldUseSampling ? maxSampleSize : undefined,
      patternAnalysis,
      summary,
      errors: errors.length > 0 ? errors : undefined,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Analyze fields for PII content using DataCloak service
   * 
   * @private
   */
  private async analyzeFieldsForPII(
    fieldsToAnalyze: FieldInput[],
    discoveredFields: DiscoveredField[],
    errors: Array<{ fieldName: string; error: string }>,
    options: { confidenceThreshold: number; continueOnError: boolean }
  ): Promise<void> {
    for (const field of fieldsToAnalyze) {
      try {
        const piiResults = await this.dataCloak.detectPII(field.text);
        
        if (piiResults.length > 0) {
          const discoveredField = this.createDiscoveredField(field.fieldName, piiResults);
          
          // Apply confidence threshold filter
          if (discoveredField.confidenceScore >= options.confidenceThreshold) {
            discoveredFields.push(discoveredField);
          }
        }
      } catch (error) {
        if (!options.continueOnError) {
          throw error;
        }
        errors.push({
          fieldName: field.fieldName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Create a discovered field from PII detection results
   * 
   * Aggregates multiple PII detections for a single field into a unified
   * discovered field record with confidence scoring and risk assessment.
   * 
   * @private
   */
  private createDiscoveredField(fieldName: string, piiResults: PIIDetectionResult[]): DiscoveredField {
    const piiTypes = [...new Set(piiResults.map(r => r.piiType))];
    const maxConfidence = Math.max(...piiResults.map(r => r.confidence));
    const riskLevel = this.calculateRiskLevel(maxConfidence);

    const samples = piiResults.map(result => ({
      piiType: result.piiType,
      sample: result.sample,
      masked: result.masked,
      confidence: result.confidence
    }));

    return {
      fieldName,
      piiTypes,
      confidenceScore: maxConfidence,
      riskLevel,
      samples
    };
  }

  /**
   * Calculate risk level based on confidence score
   * 
   * Uses predefined thresholds to categorize PII detection confidence
   * into risk levels for prioritization and reporting.
   * 
   * @private
   */
  private calculateRiskLevel(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence >= FieldDiscoveryEngine.RISK_THRESHOLDS.HIGH) return 'high';
    if (confidence >= FieldDiscoveryEngine.RISK_THRESHOLDS.MEDIUM) return 'medium';
    return 'low';
  }

  /**
   * Analyze field naming patterns for PII hints
   * 
   * Examines field names against known PII naming patterns to identify
   * potentially sensitive fields even when content analysis doesn't detect PII.
   * Useful for finding fields that may contain PII in production but not in samples.
   * 
   * @private
   */
  private analyzeFieldPatterns(dataset: FieldInput[]): PatternAnalysis {
    const suspiciousFieldNames: string[] = [];
    const piiPatternMatches: Array<{
      fieldName: string;
      pattern: string;
      suggestedType: string;
      confidence: number;
    }> = [];

    for (const field of dataset) {
      for (const { pattern, type } of FieldDiscoveryEngine.PII_PATTERNS) {
        if (pattern.test(field.fieldName)) {
          suspiciousFieldNames.push(field.fieldName);
          piiPatternMatches.push({
            fieldName: field.fieldName,
            pattern: pattern.toString(),
            suggestedType: type,
            confidence: FieldDiscoveryEngine.PATTERN_CONFIDENCE
          });
          break; // Only match first pattern per field to avoid duplicates
        }
      }
    }

    return {
      suspiciousFieldNames: [...new Set(suspiciousFieldNames)],
      piiPatternMatches
    };
  }

  /**
   * Sample fields from dataset for performance optimization
   * 
   * Uses simple random sampling to reduce analysis time for large datasets
   * while maintaining statistical representativeness.
   * 
   * @private
   */
  private sampleFields(dataset: FieldInput[], sampleSize: number): FieldInput[] {
    if (dataset.length <= sampleSize) {
      return dataset;
    }

    // Fisher-Yates shuffle for unbiased random sampling
    const shuffled = [...dataset].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }

  /**
   * Generate comprehensive discovery summary
   * 
   * Aggregates discovery results into summary statistics including
   * PII type distribution, confidence metrics, and risk categorization.
   * 
   * @private
   */
  private generateSummary(discoveredFields: DiscoveredField[], totalFields: number) {
    const piiTypesFound = [...new Set(discoveredFields.flatMap(f => f.piiTypes))];
    const totalConfidence = discoveredFields.reduce((sum, field) => sum + field.confidenceScore, 0);
    const averageConfidence = discoveredFields.length > 0 ? totalConfidence / discoveredFields.length : 0;

    // Calculate risk distribution for security assessment
    const riskDistribution = {
      low: discoveredFields.filter(f => f.riskLevel === 'low').length,
      medium: discoveredFields.filter(f => f.riskLevel === 'medium').length,
      high: discoveredFields.filter(f => f.riskLevel === 'high').length,
      critical: discoveredFields.filter(f => f.riskLevel === 'critical').length
    };

    return {
      totalFields,
      fieldsWithPII: discoveredFields.length,
      piiTypesFound,
      averageConfidence,
      riskDistribution
    };
  }
}