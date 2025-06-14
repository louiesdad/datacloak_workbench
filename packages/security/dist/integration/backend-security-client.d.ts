import { SecurityAuditResult, PIIDetectionResult } from '../interfaces/datacloak';
import { SecurityEvent, SecurityMetrics } from '../monitoring/security-monitor';
export interface BackendSecurityAPI {
    auditDataset: (datasetId: string) => Promise<SecurityAuditResult>;
    scanText: (text: string) => Promise<PIIDetectionResult[]>;
    reportSecurityEvent: (event: SecurityEvent) => Promise<void>;
    getSecurityMetrics: () => Promise<SecurityMetrics>;
    updateComplianceStatus: (datasetId: string, status: ComplianceStatus) => Promise<void>;
    getAuditHistory: (limit?: number) => Promise<SecurityAuditResult[]>;
}
export interface ComplianceStatus {
    datasetId: string;
    complianceScore: number;
    lastAuditDate: Date;
    violations: string[];
    status: 'compliant' | 'non_compliant' | 'pending' | 'review_required';
}
export interface SecurityConfiguration {
    baseURL: string;
    apiKey?: string;
    timeout: number;
    retryAttempts: number;
    enableRealTimeReporting: boolean;
}
export declare class BackendSecurityClient implements BackendSecurityAPI {
    private config;
    private eventQueue;
    private isProcessingQueue;
    constructor(config?: Partial<SecurityConfiguration>);
    auditDataset(datasetId: string): Promise<SecurityAuditResult>;
    scanText(text: string): Promise<PIIDetectionResult[]>;
    reportSecurityEvent(event: SecurityEvent): Promise<void>;
    getSecurityMetrics(): Promise<SecurityMetrics>;
    updateComplianceStatus(datasetId: string, status: ComplianceStatus): Promise<void>;
    getAuditHistory(limit?: number): Promise<SecurityAuditResult[]>;
    bulkAuditDatasets(datasetIds: string[]): Promise<SecurityAuditResult[]>;
    scheduleAudit(datasetId: string, scheduleConfig: {
        frequency: 'daily' | 'weekly' | 'monthly';
        time?: string;
        enabled: boolean;
    }): Promise<void>;
    getComplianceReport(options?: {
        dateFrom?: Date;
        dateTo?: Date;
        datasetIds?: string[];
        format?: 'json' | 'pdf' | 'csv';
    }): Promise<any>;
    configureSecurityPolicies(policies: {
        piiDetectionEnabled: boolean;
        maskingRequired: boolean;
        auditFrequency: string;
        retentionDays: number;
        alertThresholds: {
            complianceScore: number;
            piiDetectionRate: number;
        };
    }): Promise<void>;
    establishSecurityStream(onEvent: (event: any) => void): () => void;
    private processEventQueue;
    private makeRequest;
    private transformAuditResponse;
    testConnection(): Promise<boolean>;
    getServerInfo(): Promise<{
        version: string;
        securityFeatures: string[];
        supportedFormats: string[];
    }>;
}
export declare function createSecurityClient(config?: Partial<SecurityConfiguration>): BackendSecurityClient;
export declare class SecurityIntegrationUtils {
    static validateBackendCompatibility(client: BackendSecurityClient): Promise<{
        compatible: boolean;
        issues: string[];
        recommendations: string[];
    }>;
    static createMockResponse(type: 'audit' | 'scan' | 'metrics'): any;
}
//# sourceMappingURL=backend-security-client.d.ts.map