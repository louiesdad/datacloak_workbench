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
exports.RateLimitedDataCloakBridge = exports.DataCloakFFIBridge = void 0;
const ffi = __importStar(require("ffi-napi"));
const ref = __importStar(require("ref-napi"));
const path = __importStar(require("path"));
class DataCloakFFIBridge {
    constructor() {
        this.initialized = false;
        try {
            // Determine the library path based on platform
            const libPath = this.getLibraryPath();
            // Define the FFI interface
            this.library = ffi.Library(libPath, {
                'datacloak_create': ['pointer', []],
                'datacloak_destroy': ['void', ['pointer']],
                'datacloak_detect_pii': ['string', ['pointer', 'string']],
                'datacloak_mask_text': ['string', ['pointer', 'string']],
                'datacloak_free_string': ['void', ['string']],
                'datacloak_version': ['string', []]
            });
            console.log('DataCloak FFI library loaded successfully');
        }
        catch (error) {
            console.error('Failed to load DataCloak FFI library:', error);
            throw new Error(`Failed to load DataCloak library: ${error}`);
        }
    }
    getLibraryPath() {
        const platform = process.platform;
        const basePath = path.join(__dirname, '..', '..', 'datacloak-core', 'target', 'release');
        switch (platform) {
            case 'darwin':
                return path.join(basePath, 'libdatacloak_core.dylib');
            case 'win32':
                return path.join(basePath, 'datacloak_core.dll');
            case 'linux':
                return path.join(basePath, 'libdatacloak_core.so');
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        try {
            this.engine = this.library.datacloak_create();
            if (ref.isNull(this.engine)) {
                throw new Error('Failed to create DataCloak engine');
            }
            this.initialized = true;
            console.log(`DataCloak FFI engine initialized. Version: ${this.getVersion()}`);
        }
        catch (error) {
            throw new Error(`Failed to initialize DataCloak engine: ${error}`);
        }
    }
    async detectPII(text) {
        if (!this.initialized || ref.isNull(this.engine)) {
            throw new Error('DataCloak engine not initialized');
        }
        try {
            const resultJson = this.library.datacloak_detect_pii(this.engine, text);
            if (!resultJson) {
                throw new Error('PII detection failed');
            }
            const results = JSON.parse(resultJson);
            // Convert Rust result format to our interface format
            return results.map((result) => ({
                fieldName: result.field_name,
                piiType: result.pii_type,
                confidence: result.confidence,
                sample: result.sample,
                masked: result.masked
            }));
        }
        catch (error) {
            throw new Error(`PII detection failed: ${error}`);
        }
    }
    async maskText(text) {
        if (!this.initialized || ref.isNull(this.engine)) {
            throw new Error('DataCloak engine not initialized');
        }
        try {
            const resultJson = this.library.datacloak_mask_text(this.engine, text);
            if (!resultJson) {
                throw new Error('Text masking failed');
            }
            const result = JSON.parse(resultJson);
            // Convert Rust result format to our interface format
            const detectedPII = result.detected_pii.map((pii) => ({
                fieldName: pii.field_name,
                piiType: pii.pii_type,
                confidence: pii.confidence,
                sample: pii.sample,
                masked: pii.masked
            }));
            return {
                originalText: result.original_text,
                maskedText: result.masked_text,
                detectedPII,
                metadata: {
                    processingTime: result.metadata.processing_time,
                    fieldsProcessed: result.metadata.fields_processed,
                    piiItemsFound: result.metadata.pii_items_found
                }
            };
        }
        catch (error) {
            throw new Error(`Text masking failed: ${error}`);
        }
    }
    async auditSecurity(filePath) {
        // For now, return a mock audit result
        // In a real implementation, this would process the file
        return {
            timestamp: new Date(),
            fileProcessed: filePath,
            piiItemsDetected: 0,
            maskingAccuracy: 0.98,
            encryptionStatus: 'disabled',
            complianceScore: 0.95,
            violations: [],
            recommendations: []
        };
    }
    isAvailable() {
        return this.initialized && !ref.isNull(this.engine);
    }
    getVersion() {
        try {
            return this.library.datacloak_version() || '1.0.0-ffi';
        }
        catch (error) {
            return '1.0.0-ffi-error';
        }
    }
    destroy() {
        if (this.initialized && !ref.isNull(this.engine)) {
            this.library.datacloak_destroy(this.engine);
            this.engine = null;
            this.initialized = false;
            console.log('DataCloak FFI engine destroyed');
        }
    }
}
exports.DataCloakFFIBridge = DataCloakFFIBridge;
// Rate limiting implementation
class RateLimitedDataCloakBridge {
    constructor() {
        this.requestQueue = [];
        this.processing = false;
        this.lastRequestTime = 0;
        this.REQUEST_INTERVAL = 334; // ~3 requests per second (1000ms / 3 = 333.33ms)
        this.bridge = new DataCloakFFIBridge();
    }
    async processQueue() {
        if (this.processing || this.requestQueue.length === 0) {
            return;
        }
        this.processing = true;
        while (this.requestQueue.length > 0) {
            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.REQUEST_INTERVAL) {
                const waitTime = this.REQUEST_INTERVAL - timeSinceLastRequest;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            const item = this.requestQueue.shift();
            if (item) {
                try {
                    const result = await item.request();
                    item.resolve(result);
                }
                catch (error) {
                    item.reject(error);
                }
                this.lastRequestTime = Date.now();
            }
        }
        this.processing = false;
    }
    queueRequest(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject, request });
            this.processQueue();
        });
    }
    async initialize() {
        return this.bridge.initialize();
    }
    async detectPII(text) {
        return this.queueRequest(() => this.bridge.detectPII(text));
    }
    async maskText(text) {
        return this.queueRequest(() => this.bridge.maskText(text));
    }
    async auditSecurity(filePath) {
        return this.queueRequest(() => this.bridge.auditSecurity(filePath));
    }
    isAvailable() {
        return this.bridge.isAvailable();
    }
    getVersion() {
        return this.bridge.getVersion();
    }
    destroy() {
        this.bridge.destroy();
    }
}
exports.RateLimitedDataCloakBridge = RateLimitedDataCloakBridge;
//# sourceMappingURL=ffi-bridge.js.map