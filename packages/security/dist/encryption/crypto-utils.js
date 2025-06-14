"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoUtils = void 0;
const crypto_1 = require("crypto");
class CryptoUtils {
    static generateKey() {
        return (0, crypto_1.randomBytes)(this.DEFAULT_CONFIG.keyLength).toString('hex');
    }
    static generateIV() {
        return (0, crypto_1.randomBytes)(this.DEFAULT_CONFIG.ivLength).toString('hex');
    }
    static hashData(data) {
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
    static encrypt(text, key, config = {}) {
        const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
        const iv = (0, crypto_1.randomBytes)(this.DEFAULT_CONFIG.ivLength);
        let keyBuffer;
        if (key.length === this.DEFAULT_CONFIG.keyLength * 2) {
            keyBuffer = Buffer.from(key, 'hex');
        }
        else {
            keyBuffer = Buffer.from(key.padEnd(this.DEFAULT_CONFIG.keyLength * 2, '0').slice(0, this.DEFAULT_CONFIG.keyLength * 2), 'hex');
        }
        const cipher = (0, crypto_1.createCipheriv)(finalConfig.algorithm, keyBuffer, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return {
            data: encrypted,
            iv: iv.toString('hex'),
            algorithm: finalConfig.algorithm,
            timestamp: new Date()
        };
    }
    static decrypt(encryptedData, key) {
        let keyBuffer;
        if (key.length === this.DEFAULT_CONFIG.keyLength * 2) {
            keyBuffer = Buffer.from(key, 'hex');
        }
        else {
            keyBuffer = Buffer.from(key.padEnd(this.DEFAULT_CONFIG.keyLength * 2, '0').slice(0, this.DEFAULT_CONFIG.keyLength * 2), 'hex');
        }
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = (0, crypto_1.createDecipheriv)(encryptedData.algorithm, keyBuffer, iv);
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    static secureWipe(data) {
        if (typeof data !== 'string')
            return;
        for (let i = 0; i < data.length; i++) {
            data = data.substring(0, i) + '\0' + data.substring(i + 1);
        }
    }
    static isValidKey(key) {
        return typeof key === 'string' && key.length >= this.DEFAULT_CONFIG.keyLength;
    }
    static generateSecureToken(length = 32) {
        return (0, crypto_1.randomBytes)(length).toString('base64');
    }
}
exports.CryptoUtils = CryptoUtils;
CryptoUtils.DEFAULT_CONFIG = {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16
};
//# sourceMappingURL=crypto-utils.js.map