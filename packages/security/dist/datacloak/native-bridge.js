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
exports.NativeDataCloakBridge = void 0;
const child_process_1 = require("child_process");
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
const datacloak_1 = require("../interfaces/datacloak");
class NativeDataCloakBridge {
    constructor(config = {}) {
        this.config = {};
        this.binaryPath = null;
        this.initialized = false;
        this.version = '1.0.0-native';
        this.config = {
            fallbackToMock: true,
            useSystemBinary: false,
            timeout: 30000,
            retryAttempts: 3,
            ...config
        };
    }
    async initialize(config) {
        this.config = { ...this.config, ...config };
        try {
            this.binaryPath = await this.locateDataCloakBinary();
            await this.verifyBinaryCompatibility();
            this.initialized = true;
        }
        catch (error) {
            if (this.config.fallbackToMock) {
                console.warn('DataCloak binary not available, using mock implementation');
                this.initialized = true;
            }
            else {
                throw new Error(`Failed to initialize DataCloak: ${error}`);
            }
        }
    }
    async detectPII(text) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        if (!this.binaryPath) {
            return this.fallbackDetectPII(text);
        }
        try {
            const command = {
                action: 'detect',
                text,
                options: {
                    confidence_threshold: 0.8,
                    include_patterns: true
                }
            };
            const result = await this.executeBinaryCommand(command);
            return this.parseDetectionResult(result);
        }
        catch (error) {
            if (this.config.fallbackToMock) {
                console.warn('Binary detection failed, falling back to mock');
                return this.fallbackDetectPII(text);
            }
            throw error;
        }
    }
    async maskText(text) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        const startTime = Date.now();
        if (!this.binaryPath) {
            return this.fallbackMaskText(text, startTime);
        }
        try {
            const command = {
                action: 'mask',
                text,
                options: {
                    preserve_format: true,
                    mask_char: '*',
                    partial_masking: true
                }
            };
            const result = await this.executeBinaryCommand(command);
            return this.parseMaskingResult(result, text, startTime);
        }
        catch (error) {
            if (this.config.fallbackToMock) {
                console.warn('Binary masking failed, falling back to mock');
                return this.fallbackMaskText(text, startTime);
            }
            throw error;
        }
    }
    async auditSecurity(filePath) {
        if (!this.initialized) {
            throw new Error('DataCloak not initialized');
        }
        if (!this.binaryPath) {
            return this.fallbackAuditSecurity(filePath);
        }
        try {
            const command = {
                action: 'audit',
                file_path: filePath,
                options: {
                    deep_scan: true,
                    check_compliance: true,
                    generate_report: true
                }
            };
            const result = await this.executeBinaryCommand(command);
            return this.parseAuditResult(result, filePath);
        }
        catch (error) {
            if (this.config.fallbackToMock) {
                console.warn('Binary audit failed, falling back to mock');
                return this.fallbackAuditSecurity(filePath);
            }
            throw error;
        }
    }
    isAvailable() {
        return this.initialized;
    }
    getVersion() {
        return this.binaryPath ? `${this.version}-binary` : `${this.version}-mock`;
    }
    async locateDataCloakBinary() {
        if (this.config.binaryPath && (0, fs_1.existsSync)(this.config.binaryPath)) {
            return this.config.binaryPath;
        }
        const currentPlatform = (0, os_1.platform)();
        const possiblePaths = this.getBinaryPaths(currentPlatform);
        for (const path of possiblePaths) {
            if ((0, fs_1.existsSync)(path)) {
                return path;
            }
        }
        if (this.config.useSystemBinary) {
            // Try to find DataCloak in system PATH
            const systemBinary = await this.findSystemBinary();
            if (systemBinary) {
                return systemBinary;
            }
        }
        throw new Error('DataCloak binary not found');
    }
    getBinaryPaths(currentPlatform) {
        const baseDir = (0, path_1.join)(__dirname, '..', '..', 'bin');
        switch (currentPlatform) {
            case 'win32':
                return [
                    (0, path_1.join)(baseDir, 'windows', 'datacloak.exe'),
                    (0, path_1.join)(baseDir, 'datacloak.exe'),
                    'C:\\Program Files\\DataCloak\\datacloak.exe',
                    'C:\\Program Files (x86)\\DataCloak\\datacloak.exe'
                ];
            case 'darwin':
                return [
                    (0, path_1.join)(baseDir, 'macos', 'datacloak'),
                    (0, path_1.join)(baseDir, 'datacloak'),
                    '/Applications/DataCloak.app/Contents/MacOS/datacloak',
                    '/usr/local/bin/datacloak'
                ];
            case 'linux':
                return [
                    (0, path_1.join)(baseDir, 'linux', 'datacloak'),
                    (0, path_1.join)(baseDir, 'datacloak'),
                    '/usr/bin/datacloak',
                    '/usr/local/bin/datacloak'
                ];
            default:
                return [(0, path_1.join)(baseDir, 'datacloak')];
        }
    }
    async findSystemBinary() {
        return new Promise((resolve) => {
            const which = (0, os_1.platform)() === 'win32' ? 'where' : 'which';
            const process = (0, child_process_1.spawn)(which, ['datacloak']);
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0 && output.trim()) {
                    resolve(output.trim().split('\n')[0]);
                }
                else {
                    resolve(null);
                }
            });
            process.on('error', () => resolve(null));
        });
    }
    async verifyBinaryCompatibility() {
        if (!this.binaryPath) {
            throw new Error('No binary path available');
        }
        const command = { action: 'version' };
        const result = await this.executeBinaryCommand(command, 5000);
        if (!result.version) {
            throw new Error('Binary version check failed');
        }
        console.log(`DataCloak binary version: ${result.version}`);
    }
    async executeBinaryCommand(command, timeout) {
        if (!this.binaryPath) {
            throw new Error('No binary available');
        }
        return new Promise((resolve, reject) => {
            const process = (0, child_process_1.spawn)(this.binaryPath, ['--json'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    }
                    catch (error) {
                        reject(new Error(`Failed to parse binary output: ${error}`));
                    }
                }
                else {
                    reject(new Error(`Binary process failed with code ${code}: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to spawn binary process: ${error}`));
            });
            // Set timeout
            const timeoutMs = timeout || this.config.timeout || 30000;
            const timer = setTimeout(() => {
                process.kill();
                reject(new Error('Binary command timeout'));
            }, timeoutMs);
            process.on('close', () => clearTimeout(timer));
            // Send command to binary
            process.stdin.write(JSON.stringify(command));
            process.stdin.end();
        });
    }
    parseDetectionResult(result) {
        if (!result.detections) {
            return [];
        }
        return result.detections.map((detection) => ({
            fieldName: detection.field || 'unknown',
            piiType: this.mapPIIType(detection.type),
            confidence: detection.confidence || 0.5,
            sample: detection.sample || '',
            masked: detection.masked || '[MASKED]'
        }));
    }
    parseMaskingResult(result, originalText, startTime) {
        const processingTime = Date.now() - startTime;
        return {
            originalText,
            maskedText: result.masked_text || originalText,
            detectedPII: this.parseDetectionResult(result),
            metadata: {
                processingTime,
                fieldsProcessed: 1,
                piiItemsFound: result.pii_count || 0
            }
        };
    }
    parseAuditResult(result, filePath) {
        return {
            timestamp: new Date(),
            fileProcessed: filePath,
            piiItemsDetected: result.pii_count || 0,
            maskingAccuracy: result.accuracy || 0.95,
            encryptionStatus: result.encryption_enabled ? 'enabled' : 'disabled',
            complianceScore: result.compliance_score || 0.9,
            violations: result.violations || [],
            recommendations: result.recommendations || []
        };
    }
    mapPIIType(type) {
        const typeMap = {
            'email': datacloak_1.PIIType.EMAIL,
            'phone': datacloak_1.PIIType.PHONE,
            'ssn': datacloak_1.PIIType.SSN,
            'credit_card': datacloak_1.PIIType.CREDIT_CARD,
            'address': datacloak_1.PIIType.ADDRESS,
            'name': datacloak_1.PIIType.NAME,
            'date_of_birth': datacloak_1.PIIType.DATE_OF_BIRTH
        };
        return typeMap[type.toLowerCase()] || datacloak_1.PIIType.CUSTOM;
    }
    // Fallback methods using existing mock implementation
    async fallbackDetectPII(text) {
        const { DataCloakMock } = await Promise.resolve().then(() => __importStar(require('../mock/datacloak-mock')));
        const mock = new DataCloakMock();
        await mock.initialize({});
        return mock.detectPII(text);
    }
    async fallbackMaskText(text, startTime) {
        const { DataCloakMock } = await Promise.resolve().then(() => __importStar(require('../mock/datacloak-mock')));
        const mock = new DataCloakMock();
        await mock.initialize({});
        return mock.maskText(text);
    }
    async fallbackAuditSecurity(filePath) {
        const { DataCloakMock } = await Promise.resolve().then(() => __importStar(require('../mock/datacloak-mock')));
        const mock = new DataCloakMock();
        await mock.initialize({});
        return mock.auditSecurity(filePath);
    }
}
exports.NativeDataCloakBridge = NativeDataCloakBridge;
//# sourceMappingURL=native-bridge.js.map