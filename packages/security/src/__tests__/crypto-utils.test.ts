import { CryptoUtils } from '../encryption/crypto-utils';

describe('CryptoUtils', () => {
  describe('key generation', () => {
    it('should generate a key', () => {
      const key = CryptoUtils.generateKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate different keys each time', () => {
      const key1 = CryptoUtils.generateKey();
      const key2 = CryptoUtils.generateKey();
      expect(key1).not.toBe(key2);
    });

    it('should validate key correctness', () => {
      const validKey = CryptoUtils.generateKey();
      const invalidKey = 'short';
      
      expect(CryptoUtils.isValidKey(validKey)).toBe(true);
      expect(CryptoUtils.isValidKey(invalidKey)).toBe(false);
    });
  });

  describe('IV generation', () => {
    it('should generate an IV', () => {
      const iv = CryptoUtils.generateIV();
      expect(typeof iv).toBe('string');
      expect(iv.length).toBeGreaterThan(0);
    });

    it('should generate different IVs each time', () => {
      const iv1 = CryptoUtils.generateIV();
      const iv2 = CryptoUtils.generateIV();
      expect(iv1).not.toBe(iv2);
    });
  });

  describe('hashing', () => {
    it('should hash data consistently', () => {
      const data = 'test data';
      const hash1 = CryptoUtils.hashData(data);
      const hash2 = CryptoUtils.hashData(data);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64); // SHA-256 hex length
    });

    it('should produce different hashes for different data', () => {
      const hash1 = CryptoUtils.hashData('data1');
      const hash2 = CryptoUtils.hashData('data2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt text successfully', () => {
      const originalText = 'This is sensitive data';
      const key = CryptoUtils.generateKey();
      
      const encrypted = CryptoUtils.encrypt(originalText, key);
      const decrypted = CryptoUtils.decrypt(encrypted, key);
      
      expect(decrypted).toBe(originalText);
      expect(encrypted.data).not.toBe(originalText);
    });

    it('should include metadata in encrypted data', () => {
      const text = 'test';
      const key = CryptoUtils.generateKey();
      
      const encrypted = CryptoUtils.encrypt(text, key);
      
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.algorithm).toBeDefined();
      expect(encrypted.timestamp).toBeInstanceOf(Date);
    });

    it('should produce different encrypted data for same input', () => {
      const text = 'test';
      const key = CryptoUtils.generateKey();
      
      const encrypted1 = CryptoUtils.encrypt(text, key);
      const encrypted2 = CryptoUtils.encrypt(text, key);
      
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle custom encryption config', () => {
      const text = 'test';
      const key = CryptoUtils.generateKey();
      const config = { algorithm: 'aes-256-cbc' };
      
      const encrypted = CryptoUtils.encrypt(text, key, config);
      const decrypted = CryptoUtils.decrypt(encrypted, key);
      
      expect(decrypted).toBe(text);
      expect(encrypted.algorithm).toBe(config.algorithm);
    });
  });

  describe('secure token generation', () => {
    it('should generate secure tokens', () => {
      const token = CryptoUtils.generateSecureToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate tokens of specified length', () => {
      const token = CryptoUtils.generateSecureToken(16);
      expect(token.length).toBeGreaterThan(16); // Base64 encoded, so longer than input
    });

    it('should generate different tokens each time', () => {
      const token1 = CryptoUtils.generateSecureToken();
      const token2 = CryptoUtils.generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('secure wipe', () => {
    it('should handle secure wipe without errors', () => {
      const data = 'sensitive data';
      expect(() => CryptoUtils.secureWipe(data)).not.toThrow();
    });

    it('should handle non-string input gracefully', () => {
      expect(() => CryptoUtils.secureWipe(null as any)).not.toThrow();
      expect(() => CryptoUtils.secureWipe(undefined as any)).not.toThrow();
      expect(() => CryptoUtils.secureWipe(123 as any)).not.toThrow();
    });
  });
});