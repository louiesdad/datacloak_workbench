import { DataCloakBridge, PIIDetectionResult } from '../interfaces/datacloak';
export declare class DataCloakBinaryBridge implements DataCloakBridge {
    private binaryPath;
    private initialized;
    constructor();
    private getBinaryPath;
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
    private simplePIIDetection;
    private maskEmail;
    private maskPhone;
    private maskSSN;
    private maskCreditCard;
    private isValidLuhn;
    private escapeRegex;
}
export declare class RateLimitedBinaryBridge implements DataCloakBridge {
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
}
//# sourceMappingURL=binary-bridge.d.ts.map