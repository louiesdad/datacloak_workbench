interface PIIDetectionResult {
    fieldName: string;
    piiType: string;
    confidence: number;
    sample: string;
    masked: string;
}
/**
 * Real DataCloak FFI Bridge using the actual Rust library
 * Replaces the mock implementation with real PII detection
 */
export declare class RealDataCloakFFIBridge {
    private libPath;
    private datacloak;
    private initialized;
    constructor();
    initialize(config?: any): Promise<void>;
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
    obfuscateBatch(texts: string[], batchSize?: number): Promise<any[]>;
    getVersion(): string;
    isAvailable(): boolean;
    getStats(): Promise<any>;
    cleanup(): void;
    private fallbackPIIDetection;
    private maskValue;
}
export default RealDataCloakFFIBridge;
//# sourceMappingURL=real-ffi-bridge.d.ts.map