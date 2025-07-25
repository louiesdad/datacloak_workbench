"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealDataCloakFFIBridge = void 0;
const ffi = __importStar(require("ffi-napi"));
const ref = __importStar(require("ref-napi"));
const path = __importStar(require("path"));
// Define C types for FFI
const StringPtr = ref.refType('CString');
const JsonPtr = ref.refType('CString');
/**
 * Real DataCloak FFI Bridge using the actual Rust library
 * Replaces the mock implementation with real PII detection
 */
class RealDataCloakFFIBridge {
    constructor() {
        this.initialized = false;
        // Path to the built DataCloak library
        this.libPath = path.join(__dirname, '../../../bin/libdatacloak_core.dylib');
        try {
            // Load the DataCloak native library
            this.datacloak = ffi.Library(this.libPath, {
                // Core functions
                'datacloak_init': ['int', []],
                'datacloak_detect_pii': [JsonPtr, ['string']],
                'datacloak_mask_text': [JsonPtr, ['string']],
                'datacloak_obfuscate_batch': [JsonPtr, ['string', 'int']],
                'datacloak_get_version': ['string', []],
                'datacloak_cleanup': ['void', []],
                // Configuration functions
                'datacloak_set_config': ['int', ['string']],
                'datacloak_get_stats': [JsonPtr, []],
                // Memory management
                'datacloak_free_string': ['void', [JsonPtr]]
            });
            console.log('✅ DataCloak native library loaded successfully');
        }
        catch (error) {
            console.error('❌ Failed to load DataCloak native library:', error);
            throw new Error(`Failed to load DataCloak library: ${error.message}`);
        }
    }
    async initialize(config) {
        if (this.initialized)
            return;
        try {
            // Initialize the DataCloak library
            const result = this.datacloak.datacloak_init();
            if (result !== 0) {
                throw new Error(`DataCloak initialization failed with code: ${result}`);
            }
            // Set configuration if provided
            if (config) {
                const configJson = JSON.stringify({
                    llm_config: {
                        api_key: config.apiKey || process.env.OPENAI_API_KEY,
                        model: config.model || 'gpt-3.5-turbo',
                        rate_limit: 3.0, // 3 requests per second
                        max_retries: 3
                    },
                    batch_size: config.batchSize || 100,
                    confidence_threshold: config.confidenceThreshold || 0.8
                });
                const configResult = this.datacloak.datacloak_set_config(configJson);
                if (configResult !== 0) {
                    console.warn('⚠️ DataCloak config set failed, using defaults');
                }
            }
            this.initialized = true;
            console.log('✅ DataCloak initialized successfully');
        }
        catch (error) {
            console.error('❌ DataCloak initialization error:', error);
            throw error;
        }
    }
    async detectPII(text) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            // Call native PII detection
            const resultPtr = this.datacloak.datacloak_detect_pii(text);
            if (!resultPtr) {
                throw new Error('DataCloak detectPII returned null');
            }
            // Convert C string to JavaScript string
            const resultJson = ref.readCString(resultPtr, 0);
            // Free the native memory
            this.datacloak.datacloak_free_string(resultPtr);
            // Parse the JSON result
            const result = JSON.parse(resultJson);
            if (!result.success) {
                throw new Error(result.error || 'PII detection failed');
            }
            // Convert to expected format
            return (result.data || []).map((item) => ({
                fieldName: 'text',
                piiType: item.pattern_type?.toUpperCase() || 'UNKNOWN',
                confidence: item.confidence || 0.9,
                sample: item.original_text || item.text,
                masked: item.obfuscated_text || this.maskValue(item.original_text, item.pattern_type)
            }));
        }
        catch (error) {
            console.error('❌ DataCloak PII detection error:', error);
            // Fallback to basic patterns if native call fails
            return this.fallbackPIIDetection(text);
        }
    }
    async maskText(text) {
        if (!this.initialized) {
            await this.initialize();
        }
        const startTime = Date.now();
        try {
            // Call native text masking
            const resultPtr = this.datacloak.datacloak_mask_text(text);
            if (!resultPtr) {
                throw new Error('DataCloak maskText returned null');
            }
            const resultJson = ref.readCString(resultPtr, 0);
            this.datacloak.datacloak_free_string(resultPtr);
            const result = JSON.parse(resultJson);
            if (!result.success) {
                throw new Error(result.error || 'Text masking failed');
            }
            const data = result.data;
            const processingTime = Date.now() - startTime;
            // Convert detected PII to expected format
            const detectedPII = (data.detected_patterns || []).map((item) => ({
                fieldName: 'text',
                piiType: item.pattern_type?.toUpperCase() || 'UNKNOWN',
                confidence: item.confidence || 0.9,
                sample: item.original_text,
                masked: item.obfuscated_text
            }));
            return {
                originalText: text,
                maskedText: data.obfuscated_text || text,
                detectedPII,
                metadata: {
                    processingTime,
                    fieldsProcessed: 1,
                    piiItemsFound: detectedPII.length
                }
            };
        }
        catch (error) {
            console.error('❌ DataCloak text masking error:', error);
            // Fallback implementation
            const detectedPII = await this.detectPII(text);
            let maskedText = text;
            for (const pii of detectedPII) {
                maskedText = maskedText.replace(pii.sample, pii.masked);
            }
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
    }
    async obfuscateBatch(texts, batchSize = 100) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            const textsJson = JSON.stringify(texts);
            const resultPtr = this.datacloak.datacloak_obfuscate_batch(textsJson, batchSize);
            if (!resultPtr) {
                throw new Error('DataCloak obfuscateBatch returned null');
            }
            const resultJson = ref.readCString(resultPtr, 0);
            this.datacloak.datacloak_free_string(resultPtr);
            const result = JSON.parse(resultJson);
            if (!result.success) {
                throw new Error(result.error || 'Batch obfuscation failed');
            }
            return result.data || [];
        }
        catch (error) {
            console.error('❌ DataCloak batch obfuscation error:', error);
            // Fallback to individual processing
            const results = [];
            for (const text of texts) {
                const masked = await this.maskText(text);
                results.push({
                    original: text,
                    obfuscated: masked.maskedText,
                    patterns: masked.detectedPII
                });
            }
            return results;
        }
    }
    getVersion() {
        try {
            return this.datacloak.datacloak_get_version() || '1.0.0-native';
        }
        catch (error) {
            return '1.0.0-native-error';
        }
    }
    isAvailable() {
        return this.initialized;
    }
    async getStats() {
        try {
            const resultPtr = this.datacloak.datacloak_get_stats();
            if (!resultPtr) {
                return { available: this.initialized, version: this.getVersion() };
            }
            const resultJson = ref.readCString(resultPtr, 0);
            this.datacloak.datacloak_free_string(resultPtr);
            const result = JSON.parse(resultJson);
            return result.data || { available: this.initialized, version: this.getVersion() };
        }
        catch (error) {
            return {
                available: this.initialized,
                version: this.getVersion(),
                error: error.message
            };
        }
    }
    cleanup() {
        if (this.initialized) {
            try {
                this.datacloak.datacloak_cleanup();
            }
            catch (error) {
                console.warn('DataCloak cleanup error:', error);
            }
            this.initialized = false;
        }
    }
    // Fallback PII detection using regex patterns (simplified)
    fallbackPIIDetection(text) {
        const patterns = [
            { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi },
            { type: 'PHONE', regex: /(?:\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4}))/g },
            { type: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
            { type: 'CREDIT_CARD', regex: /\b(?:\d[ -]*?){13,19}\b/g }
        ];
        const results = [];
        for (const pattern of patterns) {
            const matches = Array.from(text.matchAll(pattern.regex));
            for (const match of matches) {
                results.push({
                    fieldName: 'text',
                    piiType: pattern.type,
                    confidence: 0.85,
                    sample: match[0],
                    masked: this.maskValue(match[0], pattern.type.toLowerCase())
                });
            }
        }
        return results;
    }
    maskValue(value, type) {
        switch (type.toLowerCase()) {
            case 'email':
                const [local, domain] = value.split('@');
                return local[0] + '***@' + domain;
            case 'phone':
                return value.replace(/\d/g, '*').replace(/\*{4}$/, value.slice(-4));
            case 'ssn':
                return '***-**-' + value.slice(-4);
            case 'credit_card':
                return '**** **** **** ' + value.replace(/\D/g, '').slice(-4);
            default:
                return '***';
        }
    }
}
exports.RealDataCloakFFIBridge = RealDataCloakFFIBridge;
// Process cleanup
process.on('exit', () => {
    // Global cleanup if needed
});
exports.default = RealDataCloakFFIBridge;
//# sourceMappingURL=real-ffi-bridge.js.map