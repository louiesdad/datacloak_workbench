"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataCloakMock = void 0;
const datacloak_1 = require("../interfaces/datacloak");
const PII_PATTERNS = {
    [datacloak_1.PIIType.EMAIL]: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    [datacloak_1.PIIType.PHONE]: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    [datacloak_1.PIIType.SSN]: /\b(?!000|666|9\d{2})\d{3}-?(?!00)\d{2}-?(?!0000)\d{4}\b/g,
    [datacloak_1.PIIType.CREDIT_CARD]: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    [datacloak_1.PIIType.NAME]: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    [datacloak_1.PIIType.DATE_OF_BIRTH]: /\b(?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g
};
const MASKING_STRATEGIES = {
    [datacloak_1.PIIType.EMAIL]: (text) => text.replace(/(.{1,3})[^@]*(@.*)/, '$1****$2'),
    [datacloak_1.PIIType.PHONE]: () => 'XXX-XXX-XXXX',
    [datacloak_1.PIIType.SSN]: () => 'XXX-XX-XXXX',
    [datacloak_1.PIIType.CREDIT_CARD]: (text) => '**** **** **** ' + text.slice(-4),
    [datacloak_1.PIIType.NAME]: () => '[NAME]',
    [datacloak_1.PIIType.DATE_OF_BIRTH]: () => 'XX/XX/XXXX',
    [datacloak_1.PIIType.ADDRESS]: () => '[ADDRESS]',
    [datacloak_1.PIIType.CUSTOM]: () => '[MASKED]'
};
class DataCloakMock {
    constructor() {
        this.config = {};
        this.initialized = false;
        this.version = '1.0.0-mock';
    }
    async initialize(config) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.config = { ...config };
        this.initialized = true;
    }
    async detectPII(text) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        const results = [];
        Object.entries(PII_PATTERNS).forEach(([piiType, pattern]) => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const maskingFn = MASKING_STRATEGIES[piiType];
                    results.push({
                        fieldName: 'detected_field',
                        piiType: piiType,
                        confidence: Math.random() * 0.4 + 0.6,
                        sample: match,
                        masked: maskingFn ? maskingFn(match) : '[MASKED]'
                    });
                });
            }
        });
        return results;
    }
    async maskText(text) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        const startTime = Date.now();
        const detectedPII = await this.detectPII(text);
        let maskedText = text;
        detectedPII.forEach(pii => {
            maskedText = maskedText.replace(pii.sample, pii.masked);
        });
        return {
            originalText: text,
            maskedText,
            detectedPII,
            metadata: {
                processingTime: Date.now() - startTime,
                fieldsProcessed: 1,
                piiItemsFound: detectedPII.length
            }
        };
    }
    async auditSecurity(filePath) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        await new Promise(resolve => setTimeout(resolve, 200));
        const mockPIICount = Math.floor(Math.random() * 100);
        const mockAccuracy = Math.random() * 0.1 + 0.9;
        const mockComplianceScore = Math.random() * 0.2 + 0.8;
        const violations = mockComplianceScore < 0.9 ? [
            'Potential PII exposure in field: customer_notes',
            'Insufficient encryption for sensitive data'
        ] : [];
        const recommendations = [
            'Enable field-level encryption for sensitive columns',
            'Implement data retention policies',
            'Regular PII scanning recommended'
        ];
        return {
            timestamp: new Date(),
            fileProcessed: filePath,
            piiItemsDetected: mockPIICount,
            maskingAccuracy: mockAccuracy,
            encryptionStatus: Math.random() > 0.5 ? 'enabled' : 'disabled',
            complianceScore: mockComplianceScore,
            violations,
            recommendations
        };
    }
    isAvailable() {
        return this.initialized;
    }
    getVersion() {
        return this.version;
    }
}
exports.DataCloakMock = DataCloakMock;
//# sourceMappingURL=datacloak-mock.js.map