import { DataCloakBridge, DataCloakConfig, PIIDetectionResult, MaskingResult, SecurityAuditResult } from '../interfaces/datacloak';
export interface DataCloakBinaryConfig extends DataCloakConfig {
    binaryPath?: string;
    useSystemBinary?: boolean;
    fallbackToMock?: boolean;
}
export declare class NativeDataCloakBridge implements DataCloakBridge {
    private config;
    private binaryPath;
    private initialized;
    private readonly version;
    constructor(config?: Partial<DataCloakBinaryConfig>);
    initialize(config: DataCloakConfig): Promise<void>;
    detectPII(text: string): Promise<PIIDetectionResult[]>;
    maskText(text: string): Promise<MaskingResult>;
    auditSecurity(filePath: string): Promise<SecurityAuditResult>;
    isAvailable(): boolean;
    getVersion(): string;
    private locateDataCloakBinary;
    private getBinaryPaths;
    private findSystemBinary;
    private verifyBinaryCompatibility;
    private executeBinaryCommand;
    private parseDetectionResult;
    private parseMaskingResult;
    private parseAuditResult;
    private mapPIIType;
    private fallbackDetectPII;
    private fallbackMaskText;
    private fallbackAuditSecurity;
}
//# sourceMappingURL=native-bridge.d.ts.map