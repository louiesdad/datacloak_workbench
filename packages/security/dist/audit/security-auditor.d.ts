import { SecurityAuditResult } from '../interfaces/datacloak';
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
export declare class SecurityAuditor {
    private dataCloakBridge;
    private config;
    private auditHistory;
    constructor(dataCloakBridge: DataCloakBridge, config?: Partial<AuditConfig>);
    auditFile(filePath: string): Promise<SecurityAuditResult>;
    auditMultipleFiles(filePaths: string[]): Promise<AuditReport>;
    validatePIIMasking(originalText: string, maskedText: string): Promise<boolean>;
    getAuditHistory(): SecurityAuditResult[];
    clearAuditHistory(): void;
    updateConfig(newConfig: Partial<AuditConfig>): void;
    private generateReport;
    private generateReportId;
    private triggerAlert;
    private log;
}
//# sourceMappingURL=security-auditor.d.ts.map