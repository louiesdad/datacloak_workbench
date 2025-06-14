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
export declare class CryptoUtils {
    private static readonly DEFAULT_CONFIG;
    static generateKey(): string;
    static generateIV(): string;
    static hashData(data: string): string;
    static encrypt(text: string, key: string, config?: Partial<EncryptionConfig>): EncryptedData;
    static decrypt(encryptedData: EncryptedData, key: string): string;
    static secureWipe(data: string): void;
    static isValidKey(key: string): boolean;
    static generateSecureToken(length?: number): string;
}
//# sourceMappingURL=crypto-utils.d.ts.map