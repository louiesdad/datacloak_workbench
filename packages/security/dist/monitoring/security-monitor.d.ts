import { EventEmitter } from 'events';
import { SecurityAuditResult, PIIDetectionResult } from '../interfaces/datacloak';
export interface SecurityEvent {
    id: string;
    timestamp: Date;
    type: 'pii_detected' | 'security_violation' | 'compliance_breach' | 'performance_issue' | 'error';
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    data: any;
    resolved: boolean;
}
export interface MonitoringConfig {
    enableRealTimeAlerts: boolean;
    alertThresholds: {
        piiDetectionRate: number;
        complianceScore: number;
        processingTime: number;
        errorRate: number;
    };
    retentionDays: number;
    aggregationIntervalMs: number;
}
export interface SecurityMetrics {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    averageComplianceScore: number;
    averageProcessingTime: number;
    errorRate: number;
    trendsLast24h: {
        piiDetections: number[];
        complianceScores: number[];
        processingTimes: number[];
    };
}
export interface AlertRule {
    id: string;
    name: string;
    condition: (event: SecurityEvent, metrics: SecurityMetrics) => boolean;
    action: (event: SecurityEvent, metrics: SecurityMetrics) => void;
    enabled: boolean;
    cooldownMs: number;
    lastTriggered?: Date;
}
export declare class SecurityMonitor extends EventEmitter {
    private config;
    private events;
    private metrics;
    private alertRules;
    private metricsInterval;
    private isMonitoring;
    constructor(config?: Partial<MonitoringConfig>);
    startMonitoring(): void;
    stopMonitoring(): void;
    recordPIIDetection(source: string, detections: PIIDetectionResult[], processingTime: number): void;
    recordSecurityViolation(source: string, violation: string, severity: 'low' | 'medium' | 'high' | 'critical'): void;
    recordComplianceBreach(source: string, auditResult: SecurityAuditResult): void;
    recordPerformanceIssue(source: string, issue: string, processingTime: number): void;
    recordError(source: string, error: string | Error, context?: any): void;
    resolveEvent(eventId: string): boolean;
    getEvents(options?: {
        type?: string;
        severity?: string;
        source?: string;
        resolved?: boolean;
        since?: Date;
        limit?: number;
    }): SecurityEvent[];
    getMetrics(): SecurityMetrics;
    addAlertRule(rule: AlertRule): void;
    removeAlertRule(ruleId: string): boolean;
    updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean;
    getAlertRules(): AlertRule[];
    exportEvents(format?: 'json' | 'csv'): string;
    clearOldEvents(): void;
    private addEvent;
    private checkAlertRules;
    private updateMetrics;
    private initializeMetrics;
    private setupDefaultAlertRules;
    private generateEventId;
    private calculatePIISeverity;
    private countBy;
    private calculateAverageCompliance;
    private calculateAverageProcessingTime;
    private calculateErrorRate;
    private calculateTrends;
}
//# sourceMappingURL=security-monitor.d.ts.map