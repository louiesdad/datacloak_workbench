import { DataCloakBridge, PIIDetectionResult } from '../interfaces/datacloak';
export declare class DataCloakFFIBridge implements DataCloakBridge {
    private library;
    private engine;
    private initialized;
    constructor();
    private getLibraryPath;
    initialize(): Promise<void>;
    detectPII(text: string): Promise<PIIDetectionResult[]>;
    maskText(text: string): Promise<{
        originalText: string;
        maskedText: string;
        detectedPII: PIIDetectionResult[];
        metadata: {
            processingTime: number;
            fieldsProcessed: number;
            piiItemsFound: number;
        };
    }>;
    auditSecurity(filePath: string): Promise<any>;
    isAvailable(): boolean;
    getVersion(): string;
    destroy(): void;
}
export declare class RateLimitedDataCloakBridge implements DataCloakBridge {
    private bridge;
    private requestQueue;
    private processing;
    private lastRequestTime;
    private readonly REQUEST_INTERVAL;
    constructor();
    private processQueue;
    private queueRequest;
    initialize(): Promise<void>;
    detectPII(text: string): Promise<PIIDetectionResult[]>;
    maskText(text: string): Promise<{
        originalText: string;
        maskedText: string;
        detectedPII: PIIDetectionResult[];
        metadata: {
            processingTime: number;
            fieldsProcessed: number;
            piiItemsFound: number;
        };
    }>;
    auditSecurity(filePath: string): Promise<any>;
    isAvailable(): boolean;
    getVersion(): string;
    destroy(): void;
}
//# sourceMappingURL=ffi-bridge.d.ts.map