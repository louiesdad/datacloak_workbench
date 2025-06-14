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
exports.KeychainManager = void 0;
const child_process_1 = require("child_process");
const os_1 = require("os");
const crypto_utils_1 = require("../encryption/crypto-utils");
class KeychainManager {
    constructor(config) {
        this.memoryKeys = new Map();
        this.currentPlatform = (0, os_1.platform)();
        this.config = {
            fallbackToFileSystem: true,
            ...config
        };
    }
    async storeKey(keyId, keyData) {
        try {
            if (this.supportsNativeKeychain()) {
                await this.storeInNativeKeychain(keyId, keyData);
                return;
            }
        }
        catch (error) {
            console.warn(`Native keychain storage failed: ${error}`);
        }
        if (this.config.fallbackToFileSystem) {
            await this.storeInFileSystem(keyId, keyData);
        }
        else {
            this.storeInMemory(keyId, keyData);
        }
    }
    async retrieveKey(keyId) {
        try {
            if (this.supportsNativeKeychain()) {
                const key = await this.retrieveFromNativeKeychain(keyId);
                if (key)
                    return key;
            }
        }
        catch (error) {
            console.warn(`Native keychain retrieval failed: ${error}`);
        }
        if (this.config.fallbackToFileSystem) {
            return this.retrieveFromFileSystem(keyId);
        }
        else {
            return this.retrieveFromMemory(keyId);
        }
    }
    async deleteKey(keyId) {
        try {
            if (this.supportsNativeKeychain()) {
                await this.deleteFromNativeKeychain(keyId);
            }
        }
        catch (error) {
            console.warn(`Native keychain deletion failed: ${error}`);
        }
        if (this.config.fallbackToFileSystem) {
            await this.deleteFromFileSystem(keyId);
        }
        else {
            this.deleteFromMemory(keyId);
        }
    }
    async generateAndStoreKey(keyId) {
        const key = crypto_utils_1.CryptoUtils.generateKey();
        await this.storeKey(keyId, key);
        return key;
    }
    async rotateKey(keyId) {
        await this.deleteKey(keyId);
        return this.generateAndStoreKey(keyId);
    }
    listKeys() {
        return Array.from(this.memoryKeys.keys());
    }
    supportsNativeKeychain() {
        return this.currentPlatform === 'darwin' || this.currentPlatform === 'win32';
    }
    async storeInNativeKeychain(keyId, keyData) {
        if (this.currentPlatform === 'darwin') {
            await this.macOSKeychainStore(keyId, keyData);
        }
        else if (this.currentPlatform === 'win32') {
            await this.windowsCredentialStore(keyId, keyData);
        }
        else {
            throw new Error('Native keychain not supported on this platform');
        }
    }
    async retrieveFromNativeKeychain(keyId) {
        if (this.currentPlatform === 'darwin') {
            return this.macOSKeychainRetrieve(keyId);
        }
        else if (this.currentPlatform === 'win32') {
            return this.windowsCredentialRetrieve(keyId);
        }
        else {
            throw new Error('Native keychain not supported on this platform');
        }
    }
    async deleteFromNativeKeychain(keyId) {
        if (this.currentPlatform === 'darwin') {
            await this.macOSKeychainDelete(keyId);
        }
        else if (this.currentPlatform === 'win32') {
            await this.windowsCredentialDelete(keyId);
        }
        else {
            throw new Error('Native keychain not supported on this platform');
        }
    }
    async macOSKeychainStore(keyId, keyData) {
        return new Promise((resolve, reject) => {
            const args = [
                'add-generic-password',
                '-s', this.config.serviceName,
                '-a', `${this.config.accountName}-${keyId}`,
                '-w', keyData,
                '-U' // Update if exists
            ];
            const process = (0, child_process_1.spawn)('security', args);
            let errorOutput = '';
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`macOS keychain store failed: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute security command: ${error}`));
            });
        });
    }
    async macOSKeychainRetrieve(keyId) {
        return new Promise((resolve, reject) => {
            const args = [
                'find-generic-password',
                '-s', this.config.serviceName,
                '-a', `${this.config.accountName}-${keyId}`,
                '-w' // Output password only
            ];
            const process = (0, child_process_1.spawn)('security', args);
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
                    resolve(output.trim() || null);
                }
                else if (errorOutput.includes('could not be found')) {
                    resolve(null);
                }
                else {
                    reject(new Error(`macOS keychain retrieve failed: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute security command: ${error}`));
            });
        });
    }
    async macOSKeychainDelete(keyId) {
        return new Promise((resolve, reject) => {
            const args = [
                'delete-generic-password',
                '-s', this.config.serviceName,
                '-a', `${this.config.accountName}-${keyId}`
            ];
            const process = (0, child_process_1.spawn)('security', args);
            let errorOutput = '';
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0 || errorOutput.includes('could not be found')) {
                    resolve();
                }
                else {
                    reject(new Error(`macOS keychain delete failed: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute security command: ${error}`));
            });
        });
    }
    async windowsCredentialStore(keyId, keyData) {
        return new Promise((resolve, reject) => {
            const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
            const args = [
                '/generic', `/target:${targetName}`,
                `/user:${this.config.accountName}`,
                `/pass:${keyData}`
            ];
            const process = (0, child_process_1.spawn)('cmdkey', args);
            let errorOutput = '';
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Windows credential store failed: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute cmdkey command: ${error}`));
            });
        });
    }
    async windowsCredentialRetrieve(keyId) {
        // Windows credential retrieval requires PowerShell for security
        return new Promise((resolve, reject) => {
            const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
            const script = `
        try {
          $cred = Get-StoredCredential -Target '${targetName}' -ErrorAction Stop
          $cred.GetNetworkCredential().Password
        } catch {
          exit 1
        }
      `;
            const process = (0, child_process_1.spawn)('powershell', ['-Command', script]);
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
                    resolve(output.trim() || null);
                }
                else {
                    resolve(null); // Credential not found
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute PowerShell command: ${error}`));
            });
        });
    }
    async windowsCredentialDelete(keyId) {
        return new Promise((resolve, reject) => {
            const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
            const args = [`/delete`, `/target:${targetName}`];
            const process = (0, child_process_1.spawn)('cmdkey', args);
            let errorOutput = '';
            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0 || errorOutput.includes('not exist')) {
                    resolve();
                }
                else {
                    reject(new Error(`Windows credential delete failed: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(new Error(`Failed to execute cmdkey command: ${error}`));
            });
        });
    }
    async storeInFileSystem(keyId, keyData) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key required for filesystem storage');
        }
        const encrypted = crypto_utils_1.CryptoUtils.encrypt(keyData, this.config.encryptionKey);
        const filePath = this.getKeyFilePath(keyId);
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        await fs.writeFile(filePath, JSON.stringify(encrypted));
    }
    async retrieveFromFileSystem(keyId) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key required for filesystem storage');
        }
        try {
            const filePath = this.getKeyFilePath(keyId);
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            const encryptedData = await fs.readFile(filePath, 'utf8');
            const encrypted = JSON.parse(encryptedData);
            return crypto_utils_1.CryptoUtils.decrypt(encrypted, this.config.encryptionKey);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    async deleteFromFileSystem(keyId) {
        try {
            const filePath = this.getKeyFilePath(keyId);
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    getKeyFilePath(keyId) {
        const path = require('path');
        const os = require('os');
        const keyDir = path.join(os.homedir(), '.datacloak', 'keys');
        // Ensure directory exists
        const fs = require('fs');
        fs.mkdirSync(keyDir, { recursive: true });
        return path.join(keyDir, `${keyId}.encrypted`);
    }
    storeInMemory(keyId, keyData) {
        const key = {
            id: keyId,
            data: keyData,
            metadata: {
                created: new Date(),
                lastAccessed: new Date(),
                source: 'memory'
            }
        };
        this.memoryKeys.set(keyId, key);
    }
    retrieveFromMemory(keyId) {
        const key = this.memoryKeys.get(keyId);
        if (key) {
            key.metadata.lastAccessed = new Date();
            return key.data;
        }
        return null;
    }
    deleteFromMemory(keyId) {
        this.memoryKeys.delete(keyId);
    }
    // Security utilities
    secureWipeMemoryKeys() {
        for (const [keyId, key] of this.memoryKeys) {
            crypto_utils_1.CryptoUtils.secureWipe(key.data);
        }
        this.memoryKeys.clear();
    }
    async validateKeyIntegrity(keyId) {
        try {
            const key = await this.retrieveKey(keyId);
            return key !== null && crypto_utils_1.CryptoUtils.isValidKey(key);
        }
        catch {
            return false;
        }
    }
}
exports.KeychainManager = KeychainManager;
//# sourceMappingURL=keychain-manager.js.map