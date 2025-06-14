import { DataCloakBridge, DataCloakConfig, PIIDetectionResult, MaskingResult, SecurityAuditResult } from '../interfaces/datacloak';
export declare class DataCloakMock implements DataCloakBridge {
    private config;
    private initialized;
    private readonly version;
    initialize(config: DataCloakConfig): Promise<void>;
    detectPII(text: string): Promise<PIIDetectionResult[]>;
    maskText(text: string): Promise<MaskingResult>;
    auditSecurity(filePath: string): Promise<SecurityAuditResult>;
    isAvailable(): boolean;
    getVersion(): string;
}
//# sourceMappingURL=datacloak-mock.d.ts.map