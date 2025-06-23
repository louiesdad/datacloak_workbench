/**
 * PII Masking Verification System
 * 
 * Implements pre-logging PII scanner, masking validation rules,
 * and alerts for PII leaks to ensure data privacy compliance.
 */

import { SecurityService } from '../services/security.service';
import { logger } from '../config/logger';

export interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: PIIType[];
  confidence: number;
  positions: PIIPosition[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PIIType {
  type: string;
  value: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  masked?: boolean;
}

export interface PIIPosition {
  start: number;
  end: number;
  type: string;
  value: string;
}

export interface MaskingRule {
  piiType: string;
  maskingStrategy: 'full' | 'partial' | 'hash' | 'redact';
  preserveLength: boolean;
  minimumConfidence: number;
  exemptions?: string[];
}

export interface PIILeakAlert {
  timestamp: string;
  severity: 'warning' | 'error' | 'critical';
  source: string;
  piiType: string;
  confidence: number;
  context: string;
  masked: boolean;
  riskAssessment: string;
}

export class PIIMaskingVerifier {
  private securityService: SecurityService;
  private maskingRules: Map<string, MaskingRule>;
  private alertCallbacks: ((alert: PIILeakAlert) => void)[];
  private lastScanResults: Map<string, PIIDetectionResult>;

  constructor() {
    this.securityService = new SecurityService();
    this.maskingRules = new Map();
    this.alertCallbacks = [];
    this.lastScanResults = new Map();
    this.initializeDefaultMaskingRules();
  }

  private initializeDefaultMaskingRules(): void {
    const defaultRules: MaskingRule[] = [
      {
        piiType: 'SSN',
        maskingStrategy: 'partial',
        preserveLength: true,
        minimumConfidence: 0.8,
      },
      {
        piiType: 'EMAIL',
        maskingStrategy: 'partial',
        preserveLength: false,
        minimumConfidence: 0.7,
      },
      {
        piiType: 'PHONE',
        maskingStrategy: 'partial',
        preserveLength: true,
        minimumConfidence: 0.7,
      },
      {
        piiType: 'CREDIT_CARD',
        maskingStrategy: 'full',
        preserveLength: true,
        minimumConfidence: 0.9,
      },
      {
        piiType: 'NAME',
        maskingStrategy: 'partial',
        preserveLength: false,
        minimumConfidence: 0.6,
      },
      {
        piiType: 'ADDRESS',
        maskingStrategy: 'hash',
        preserveLength: false,
        minimumConfidence: 0.7,
      },
      {
        piiType: 'DATE_OF_BIRTH',
        maskingStrategy: 'redact',
        preserveLength: false,
        minimumConfidence: 0.8,
      },
    ];

    defaultRules.forEach(rule => {
      this.maskingRules.set(rule.piiType, rule);
    });
  }

  /**
   * Pre-logging PII scanner - scans content before logging
   */
  async scanBeforeLogging(content: string, context: string): Promise<string> {
    try {
      const scanResult = await this.detectPII(content, context);
      
      if (scanResult.hasPII) {
        await this.handlePIIDetection(scanResult, context);
        return this.applyMasking(content, scanResult);
      }
      
      return content;
    } catch (error) {
      logger.error('PII scanning failed:', error);
      // On error, apply conservative masking
      return this.applyConservativeMasking(content);
    }
  }

  /**
   * Detect PII in content with enhanced analysis
   */
  async detectPII(content: string, context: string = 'unknown'): Promise<PIIDetectionResult> {
    const cacheKey = `${context}:${this.hashContent(content)}`;
    
    // Check cache for recent scans
    if (this.lastScanResults.has(cacheKey)) {
      const cached = this.lastScanResults.get(cacheKey)!;
      if (Date.now() - new Date(cached.timestamp || 0).getTime() < 300000) { // 5 min cache
        return cached;
      }
    }

    const detectedTypes: PIIType[] = [];
    const positions: PIIPosition[] = [];
    
    // Use security service for initial detection
    const securityResults = await this.securityService.detectPII(content);
    
    for (const result of securityResults) {
      const piiType: PIIType = {
        type: result.piiType,
        value: result.value,
        confidence: result.confidence,
        riskLevel: this.assessRiskLevel(result.piiType, result.confidence),
        masked: false
      };
      
      detectedTypes.push(piiType);
      
      // Find position in content
      const position = content.indexOf(result.value);
      if (position !== -1) {
        positions.push({
          start: position,
          end: position + result.value.length,
          type: result.piiType,
          value: result.value
        });
      }
    }

    // Enhanced pattern-based detection
    const enhancedResults = this.performEnhancedDetection(content);
    detectedTypes.push(...enhancedResults.types);
    positions.push(...enhancedResults.positions);

    const hasPII = detectedTypes.length > 0;
    const overallConfidence = hasPII 
      ? detectedTypes.reduce((sum, type) => sum + type.confidence, 0) / detectedTypes.length 
      : 0;
    const riskLevel = this.calculateOverallRiskLevel(detectedTypes);

    const result: PIIDetectionResult = {
      hasPII,
      detectedTypes,
      confidence: overallConfidence,
      positions,
      riskLevel,
      timestamp: new Date().toISOString()
    } as PIIDetectionResult & { timestamp: string };

    // Cache result
    this.lastScanResults.set(cacheKey, result);
    
    return result;
  }

  /**
   * Enhanced pattern-based PII detection
   */
  private performEnhancedDetection(content: string): { types: PIIType[]; positions: PIIPosition[] } {
    const types: PIIType[] = [];
    const positions: PIIPosition[] = [];

    const patterns = {
      SSN: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      PHONE: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      DATE_OF_BIRTH: /\b(?:0[1-9]|1[0-2])[-\/](?:0[1-9]|[12]\d|3[01])[-\/](?:19|20)\d{2}\b/g,
    };

    for (const [piiType, pattern] of Object.entries(patterns)) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const confidence = this.calculatePatternConfidence(piiType, match[0]);
        const riskLevel = this.assessRiskLevel(piiType, confidence);
        
        if (confidence >= 0.5) { // Minimum threshold
          types.push({
            type: piiType,
            value: match[0],
            confidence,
            riskLevel,
            masked: false
          });
          
          positions.push({
            start: match.index,
            end: match.index + match[0].length,
            type: piiType,
            value: match[0]
          });
        }
      }
    }

    return { types, positions };
  }

  /**
   * Apply masking based on detection results and rules
   */
  private applyMasking(content: string, scanResult: PIIDetectionResult): string {
    let maskedContent = content;
    
    // Sort positions by start index in descending order to maintain positions during replacement
    const sortedPositions = [...scanResult.positions].sort((a, b) => b.start - a.start);
    
    for (const position of sortedPositions) {
      const rule = this.maskingRules.get(position.type);
      if (!rule || scanResult.detectedTypes.find(t => t.value === position.value)?.confidence! < rule.minimumConfidence) {
        continue;
      }
      
      const maskedValue = this.maskValue(position.value, rule);
      maskedContent = maskedContent.substring(0, position.start) + 
                    maskedValue + 
                    maskedContent.substring(position.end);
    }
    
    return maskedContent;
  }

  /**
   * Mask individual values based on masking strategy
   */
  private maskValue(value: string, rule: MaskingRule): string {
    switch (rule.maskingStrategy) {
      case 'full':
        return rule.preserveLength ? '*'.repeat(value.length) : '***';
      
      case 'partial':
        if (value.length <= 4) {
          return '*'.repeat(value.length);
        }
        const keepStart = Math.ceil(value.length * 0.2);
        const keepEnd = Math.ceil(value.length * 0.2);
        const maskLength = value.length - keepStart - keepEnd;
        return value.substring(0, keepStart) + 
               '*'.repeat(maskLength) + 
               value.substring(value.length - keepEnd);
      
      case 'hash':
        return `[HASH:${this.hashContent(value).substring(0, 8)}]`;
      
      case 'redact':
        return '[REDACTED]';
      
      default:
        return '***';
    }
  }

  /**
   * Conservative masking when PII detection fails
   */
  private applyConservativeMasking(content: string): string {
    // Apply conservative patterns that might contain PII
    return content
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '***-**-****') // SSN pattern
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***') // Email
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '****-****-****-****') // Credit card
      .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****'); // Phone
  }

  /**
   * Handle PII detection by generating alerts
   */
  private async handlePIIDetection(scanResult: PIIDetectionResult, context: string): Promise<void> {
    for (const piiType of scanResult.detectedTypes) {
      if (piiType.confidence >= 0.7) { // Alert threshold
        const alert: PIILeakAlert = {
          timestamp: new Date().toISOString(),
          severity: this.getSeverityLevel(piiType.riskLevel),
          source: context,
          piiType: piiType.type,
          confidence: piiType.confidence,
          context: `PII detected in ${context}`,
          masked: false, // Will be updated after masking
          riskAssessment: this.generateRiskAssessment(piiType)
        };
        
        await this.triggerAlert(alert);
      }
    }
  }

  /**
   * Trigger PII leak alert
   */
  private async triggerAlert(alert: PIILeakAlert): Promise<void> {
    // Log the alert
    logger.warn('PII Detection Alert', {
      ...alert,
      timestamp: alert.timestamp
    });
    
    // Trigger all registered callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback failed:', error);
      }
    }
    
    // Store alert in audit log if critical
    if (alert.severity === 'critical') {
      await this.storeAuditAlert(alert);
    }
  }

  /**
   * Store critical alerts in audit log
   */
  private async storeAuditAlert(alert: PIILeakAlert): Promise<void> {
    // This would integrate with audit logging system
    logger.error('CRITICAL PII LEAK DETECTED', {
      alert,
      action: 'AUDIT_LOG_ENTRY',
      requiresReview: true
    });
  }

  /**
   * Validate masking effectiveness
   */
  async validateMasking(originalContent: string, maskedContent: string, context: string): Promise<boolean> {
    if (originalContent === maskedContent) {
      return false; // No masking applied
    }
    
    // Re-scan masked content to ensure no PII remains
    const postMaskingScan = await this.detectPII(maskedContent, `${context}:post-masking`);
    
    if (postMaskingScan.hasPII) {
      const alert: PIILeakAlert = {
        timestamp: new Date().toISOString(),
        severity: 'critical',
        source: context,
        piiType: postMaskingScan.detectedTypes[0]?.type || 'UNKNOWN',
        confidence: postMaskingScan.confidence,
        context: 'Masking validation failed - PII still present after masking',
        masked: false,
        riskAssessment: 'CRITICAL: Masking ineffective'
      };
      
      await this.triggerAlert(alert);
      return false;
    }
    
    return true;
  }

  /**
   * Add masking rule
   */
  addMaskingRule(piiType: string, rule: MaskingRule): void {
    this.maskingRules.set(piiType, rule);
  }

  /**
   * Add alert callback
   */
  addAlertCallback(callback: (alert: PIILeakAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get masking statistics
   */
  getMaskingStatistics(): {
    totalScans: number;
    piiDetected: number;
    maskingSuccess: number;
    alertsTriggered: number;
  } {
    const totalScans = this.lastScanResults.size;
    const piiDetected = Array.from(this.lastScanResults.values()).filter(r => r.hasPII).length;
    
    return {
      totalScans,
      piiDetected,
      maskingSuccess: 0, // Would track from masking validation
      alertsTriggered: 0 // Would track from alert system
    };
  }

  // Helper methods
  private hashContent(content: string): string {
    // Simple hash for content identification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private assessRiskLevel(piiType: string, confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    const criticalTypes = ['SSN', 'CREDIT_CARD', 'MEDICAL_RECORD'];
    const highTypes = ['EMAIL', 'PHONE', 'ADDRESS', 'DATE_OF_BIRTH'];
    
    if (criticalTypes.includes(piiType) && confidence > 0.8) return 'critical';
    if (criticalTypes.includes(piiType) || (highTypes.includes(piiType) && confidence > 0.8)) return 'high';
    if (highTypes.includes(piiType) || confidence > 0.7) return 'medium';
    return 'low';
  }

  private calculateOverallRiskLevel(detectedTypes: PIIType[]): 'low' | 'medium' | 'high' | 'critical' {
    if (detectedTypes.some(t => t.riskLevel === 'critical')) return 'critical';
    if (detectedTypes.some(t => t.riskLevel === 'high')) return 'high';
    if (detectedTypes.some(t => t.riskLevel === 'medium')) return 'medium';
    return 'low';
  }

  private calculatePatternConfidence(piiType: string, value: string): number {
    // Enhanced confidence calculation based on pattern strength
    const baseConfidences: Record<string, number> = {
      SSN: 0.9,
      CREDIT_CARD: 0.85,
      EMAIL: 0.8,
      PHONE: 0.75,
      IP_ADDRESS: 0.7,
      DATE_OF_BIRTH: 0.6
    };
    
    let confidence = baseConfidences[piiType] || 0.5;
    
    // Adjust based on value characteristics
    if (piiType === 'EMAIL' && value.includes('@') && value.includes('.')) {
      confidence += 0.1;
    }
    
    if (piiType === 'SSN' && /^\d{3}-\d{2}-\d{4}$/.test(value)) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }

  private getSeverityLevel(riskLevel: string): 'warning' | 'error' | 'critical' {
    switch (riskLevel) {
      case 'critical': return 'critical';
      case 'high': return 'error';
      case 'medium': return 'warning';
      default: return 'warning';
    }
  }

  private generateRiskAssessment(piiType: PIIType): string {
    const assessments: Record<string, string> = {
      critical: `Critical PII exposure risk - immediate masking required`,
      high: `High PII exposure risk - masking recommended`,
      medium: `Medium PII exposure risk - consider masking`,
      low: `Low PII exposure risk - monitor`
    };
    
    return assessments[piiType.riskLevel] || 'Unknown risk level';
  }
}

// Singleton instance for application-wide use
export const piiMaskingVerifier = new PIIMaskingVerifier();