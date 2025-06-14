import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  algorithm: string;
  timestamp: Date;
}

export class CryptoUtils {
  private static readonly DEFAULT_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-cbc',
    keyLength: 32,
    ivLength: 16
  };

  static generateKey(): string {
    return randomBytes(this.DEFAULT_CONFIG.keyLength).toString('hex');
  }

  static generateIV(): string {
    return randomBytes(this.DEFAULT_CONFIG.ivLength).toString('hex');
  }

  static hashData(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  static encrypt(text: string, key: string, config: Partial<EncryptionConfig> = {}): EncryptedData {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const iv = randomBytes(this.DEFAULT_CONFIG.ivLength);
    
    let keyBuffer: Buffer;
    if (key.length === this.DEFAULT_CONFIG.keyLength * 2) {
      keyBuffer = Buffer.from(key, 'hex');
    } else {
      keyBuffer = Buffer.from(key.padEnd(this.DEFAULT_CONFIG.keyLength * 2, '0').slice(0, this.DEFAULT_CONFIG.keyLength * 2), 'hex');
    }
    
    const cipher = createCipheriv(finalConfig.algorithm, keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      algorithm: finalConfig.algorithm,
      timestamp: new Date()
    };
  }

  static decrypt(encryptedData: EncryptedData, key: string): string {
    let keyBuffer: Buffer;
    if (key.length === this.DEFAULT_CONFIG.keyLength * 2) {
      keyBuffer = Buffer.from(key, 'hex');
    } else {
      keyBuffer = Buffer.from(key.padEnd(this.DEFAULT_CONFIG.keyLength * 2, '0').slice(0, this.DEFAULT_CONFIG.keyLength * 2), 'hex');
    }
    const iv = Buffer.from(encryptedData.iv, 'hex');
    
    const decipher = createDecipheriv(encryptedData.algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  static secureWipe(data: string): void {
    if (typeof data !== 'string') return;
    
    for (let i = 0; i < data.length; i++) {
      data = data.substring(0, i) + '\0' + data.substring(i + 1);
    }
  }

  static isValidKey(key: string): boolean {
    return typeof key === 'string' && key.length >= this.DEFAULT_CONFIG.keyLength;
  }

  static generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('base64');
  }
}