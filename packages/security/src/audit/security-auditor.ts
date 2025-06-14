import { SecurityAuditResult, PIIDetectionResult } from '../interfaces/datacloak';
import { DataCloakBridge } from '../interfaces/datacloak';

export interface AuditConfig {
  enableRealTimeMonitoring: boolean;
  complianceThreshold: number;
  alertOnViolations: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export interface AuditReport {
  reportId: string;
  timestamp: Date;
  filesAudited: number;
  totalPIIDetected: number;
  averageAccuracy: number;
  complianceScore: number;
  criticalViolations: string[];
  recommendations: string[];
  auditResults: SecurityAuditResult[];
}

export class SecurityAuditor {
  private dataCloakBridge: DataCloakBridge;
  private config: AuditConfig;
  private auditHistory: SecurityAuditResult[] = [];

  constructor(dataCloakBridge: DataCloakBridge, config: Partial<AuditConfig> = {}) {
    this.dataCloakBridge = dataCloakBridge;
    this.config = {
      enableRealTimeMonitoring: false,
      complianceThreshold: 0.8,
      alertOnViolations: true,
      logLevel: 'info',
      ...config
    };
  }

  async auditFile(filePath: string): Promise<SecurityAuditResult> {
    if (!this.dataCloakBridge.isAvailable()) {
      throw new Error('DataCloak bridge is not available');
    }

    const result = await this.dataCloakBridge.auditSecurity(filePath);
    this.auditHistory.push(result);

    if (this.config.alertOnViolations && result.violations.length > 0) {
      this.triggerAlert(result);
    }

    this.log('info', `Audited file: ${filePath} - Score: ${result.complianceScore}`);
    return result;
  }

  async auditMultipleFiles(filePaths: string[]): Promise<AuditReport> {
    const reportId = this.generateReportId();
    const auditResults: SecurityAuditResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.auditFile(filePath);
        auditResults.push(result);
      } catch (error) {
        this.log('error', `Failed to audit ${filePath}: ${error}`);
      }
    }

    return this.generateReport(reportId, auditResults);
  }

  async validatePIIMasking(originalText: string, maskedText: string): Promise<boolean> {
    const originalPII = await this.dataCloakBridge.detectPII(originalText);
    const maskedPII = await this.dataCloakBridge.detectPII(maskedText);

    const unmaskPIICount = maskedPII.filter(pii => 
      originalPII.some(orig => orig.sample === pii.sample)
    ).length;

    const maskingEffectiveness = 1 - (unmaskPIICount / Math.max(originalPII.length, 1));
    return maskingEffectiveness >= this.config.complianceThreshold;
  }

  getAuditHistory(): SecurityAuditResult[] {
    return [...this.auditHistory];
  }

  clearAuditHistory(): void {
    this.auditHistory = [];
  }

  updateConfig(newConfig: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private generateReport(reportId: string, auditResults: SecurityAuditResult[]): AuditReport {
    const totalPIIDetected = auditResults.reduce((sum, result) => sum + result.piiItemsDetected, 0);
    const averageAccuracy = auditResults.length > 0 
      ? auditResults.reduce((sum, result) => sum + result.maskingAccuracy, 0) / auditResults.length 
      : 0;
    
    const complianceScore = auditResults.length > 0
      ? auditResults.reduce((sum, result) => sum + result.complianceScore, 0) / auditResults.length
      : 0;

    const criticalViolations = auditResults
      .filter(result => result.complianceScore < this.config.complianceThreshold)
      .flatMap(result => result.violations);

    const recommendations = [...new Set(auditResults.flatMap(result => result.recommendations))];

    return {
      reportId,
      timestamp: new Date(),
      filesAudited: auditResults.length,
      totalPIIDetected,
      averageAccuracy,
      complianceScore,
      criticalViolations,
      recommendations,
      auditResults
    };
  }

  private generateReportId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private triggerAlert(result: SecurityAuditResult): void {
    this.log('warn', `Security violations detected in ${result.fileProcessed}: ${result.violations.join(', ')}`);
  }

  private log(level: AuditConfig['logLevel'], message: string): void {
    const levels: Record<AuditConfig['logLevel'], number> = {
      error: 0, warn: 1, info: 2, debug: 3
    };

    if (levels[level] <= levels[this.config.logLevel]) {
      console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`);
    }
  }
}