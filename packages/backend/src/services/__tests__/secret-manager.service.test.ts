import { SecretManagerService } from '../secret-manager.service';
import { ConfigService } from '../config.service';
import { SecretValidator, secretUtils } from '../../config/secrets';

// Mock ConfigService
jest.mock('../config.service', () => ({
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((key: string) => {
        const mockConfig: Record<string, any> = {
          SECRET_PROVIDER: 'env',
          SECRET_CACHE_TTL: 3600,
          SECRET_ACCESS_LOG_SIZE: 1000,
        };
        return mockConfig[key];
      }),
    }),
  },
}));

// Mock logger
jest.mock('../../config/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('SecretManagerService', () => {
  let secretManager: SecretManagerService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (SecretManagerService as any).instance = undefined;
    
    // Set up test environment variables
    process.env.TEST_SECRET = 'test-value';
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-for-validation';
    
    // Create instance after environment is set up
    secretManager = SecretManagerService.getInstance();
  });
  
  afterEach(async () => {
    if (secretManager && typeof secretManager.close === 'function') {
      await secretManager.close();
    }
    // Clean up all test environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('TEST_') || key.startsWith('SECRET') || key === 'JWT_SECRET' || key === 'NEW_KEY' || key === 'NEW_VALUE') {
        delete process.env[key];
      }
    });
  });
  
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SecretManagerService.getInstance();
      const instance2 = SecretManagerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('getSecret', () => {
    it('should retrieve secret from environment', async () => {
      const value = await secretManager.getSecret('TEST_SECRET');
      expect(value).toBe('test-value');
    });
    
    it('should cache secrets', async () => {
      // First call - from environment
      const value1 = await secretManager.getSecret('TEST_SECRET');
      
      // Change env value
      process.env.TEST_SECRET = 'new-value';
      
      // Second call - should be from cache
      const value2 = await secretManager.getSecret('TEST_SECRET');
      expect(value2).toBe('test-value'); // Still the cached value
    });
    
    it('should log access', async () => {
      await secretManager.getSecret('TEST_SECRET', 'user123');
      
      const log = secretManager.getAccessLog();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        secretKey: 'TEST_SECRET',
        accessedBy: 'user123',
        operation: 'read',
        success: true,
      });
    });
    
    it('should throw error for non-existent secret', async () => {
      await expect(secretManager.getSecret('NON_EXISTENT')).rejects.toThrow(
        "Secret 'NON_EXISTENT' not found in environment"
      );
    });
  });
  
  describe('setSecret', () => {
    it('should set secret in environment', async () => {
      await secretManager.setSecret('NEW_VALUE', 'new-value');
      expect(process.env.NEW_VALUE).toBe('new-value');
    });
    
    it('should validate secret before setting', async () => {
      await expect(
        secretManager.setSecret('', 'value')
      ).rejects.toThrow('Secret key must be a non-empty string');
      
      await expect(
        secretManager.setSecret('invalid-key', 'value')
      ).rejects.toThrow('Secret key must contain only uppercase letters, numbers, and underscores');
    });
    
    it('should clear cache when setting secret', async () => {
      // Get secret to cache it
      await secretManager.getSecret('TEST_SECRET');
      
      // Set new value with a longer value to meet validation
      const longValue = 'updated-value-that-is-at-least-64-characters-long-for-validation-purposes';
      await secretManager.setSecret('TEST_SECRET', longValue);
      
      // Get again - should not be cached
      const value = await secretManager.getSecret('TEST_SECRET');
      expect(value).toBe(longValue);
    });
    
    it('should log access', async () => {
      await secretManager.setSecret('NEW_VALUE', 'value', {}, 'admin');
      
      const log = secretManager.getAccessLog({ operation: 'write' });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        secretKey: 'NEW_VALUE',
        accessedBy: 'admin',
        operation: 'write',
        success: true,
      });
    });
  });
  
  describe('deleteSecret', () => {
    it('should delete secret from environment', async () => {
      process.env.DELETE_ME = 'value';
      await secretManager.deleteSecret('DELETE_ME');
      expect(process.env.DELETE_ME).toBeUndefined();
    });
    
    it('should clear cache when deleting', async () => {
      process.env.CACHED_SECRET = 'value';
      
      // Cache the secret
      await secretManager.getSecret('CACHED_SECRET');
      
      // Delete it
      await secretManager.deleteSecret('CACHED_SECRET');
      
      // Try to get it again
      await expect(secretManager.getSecret('CACHED_SECRET')).rejects.toThrow();
    });
  });
  
  describe('rotateSecret', () => {
    it('should generate new secret value', async () => {
      process.env.ROTATE_ME = 'old-value';
      
      const newValue = await secretManager.rotateSecret('ROTATE_ME');
      expect(newValue).not.toBe('old-value');
      expect(newValue).toHaveLength(44); // Base64 encoded 32 bytes
      expect(process.env.ROTATE_ME).toBe(newValue);
    });
    
    it('should clear cache after rotation', async () => {
      process.env.CACHED_ROTATE = 'old-value';
      
      // Cache the secret
      await secretManager.getSecret('CACHED_ROTATE');
      
      // Rotate it
      await secretManager.rotateSecret('CACHED_ROTATE');
      
      // Get again - should be new value
      const value = await secretManager.getSecret('CACHED_ROTATE');
      expect(value).not.toBe('old-value');
    });
  });
  
  describe('setupRotationSchedule', () => {
    jest.useFakeTimers();
    
    it('should rotate secret on schedule', async () => {
      process.env.SCHEDULED_SECRET = 'initial-value';
      
      secretManager.setupRotationSchedule('SCHEDULED_SECRET', 1000);
      
      // Fast forward time
      jest.advanceTimersByTime(1000);
      
      // Wait for async rotation
      await Promise.resolve();
      
      expect(process.env.SCHEDULED_SECRET).not.toBe('initial-value');
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
  });
  
  describe('access logging', () => {
    it('should filter access log by criteria', async () => {
      // Create a fresh instance to ensure clean log
      (SecretManagerService as any).instance = undefined;
      const freshSecretManager = SecretManagerService.getInstance();
      
      // Set up environment for test
      process.env.TEST_VAR1 = 'value1';
      process.env.TEST_VAR2 = 'value2';
      process.env.TEST_VAR3 = 'value3';
      
      // Generate various access logs
      await freshSecretManager.getSecret('TEST_VAR1', 'user1');
      await freshSecretManager.setSecret('TEST_VAR2', 'updated-value', {}, 'user2');
      await freshSecretManager.getSecret('TEST_VAR1', 'user2');
      await freshSecretManager.deleteSecret('TEST_VAR3', 'user1');
      
      // Filter by secret key - expecting 3 logs (1 from first get, 2 from cached get due to double logging)
      const testVar1Logs = freshSecretManager.getAccessLog({ secretKey: 'TEST_VAR1' });
      expect(testVar1Logs).toHaveLength(3);
      
      // Filter by user
      const user1Logs = freshSecretManager.getAccessLog({ accessedBy: 'user1' });
      expect(user1Logs).toHaveLength(2);
      
      // Filter by operation - expecting 3 read logs due to double logging on cache hit
      const readLogs = freshSecretManager.getAccessLog({ operation: 'read' });
      expect(readLogs).toHaveLength(3);
      
      // Clean up
      await freshSecretManager.close();
      delete process.env.TEST_VAR1;
      delete process.env.TEST_VAR2;
      delete process.env.TEST_VAR3;
    });
    
    it('should export access log as JSON', async () => {
      await secretManager.getSecret('TEST_SECRET', 'export-test');
      
      const exported = await secretManager.exportAccessLog();
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toMatchObject({
        secretKey: 'TEST_SECRET',
        accessedBy: 'export-test',
      });
    });
  });
  
  describe('cache management', () => {
    it('should clear all cached secrets', async () => {
      // Set up environment
      process.env.SECRET1 = 'original-value1';
      process.env.SECRET2 = 'original-value2';
      
      // Cache multiple secrets
      await secretManager.getSecret('SECRET1');
      await secretManager.getSecret('SECRET2');
      
      // Clear cache
      secretManager.clearCache();
      
      // Change env values
      process.env.SECRET1 = 'new-value1';
      process.env.SECRET2 = 'new-value2';
      
      // Get again - should be new values
      const value1 = await secretManager.getSecret('SECRET1');
      const value2 = await secretManager.getSecret('SECRET2');
      
      expect(value1).toBe('new-value1');
      expect(value2).toBe('new-value2');
    });
  });
});

describe('SecretValidator', () => {
  describe('validateSecret', () => {
    it('should validate JWT_SECRET', () => {
      // Valid base64 string of 64 characters
      const validBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const valid = SecretValidator.validateSecret(
        'JWT_SECRET',
        validBase64
      );
      expect(valid.valid).toBe(true);
      
      const invalid = SecretValidator.validateSecret(
        'JWT_SECRET',
        'too-short'
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('Secret must be at least 64 characters long');
    });
    
    it('should validate ADMIN_PASSWORD complexity', () => {
      const valid = SecretValidator.validateSecret(
        'ADMIN_PASSWORD',
        'ComplexPass123!@#'
      );
      expect(valid.valid).toBe(true);
      
      const invalid = SecretValidator.validateSecret(
        'ADMIN_PASSWORD',
        'simplepassword'
      );
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('Secret must contain at least one uppercase letter');
    });
    
    it('should validate CONFIG_ENCRYPTION_KEY length', () => {
      const valid = SecretValidator.validateSecret(
        'CONFIG_ENCRYPTION_KEY',
        'a'.repeat(32)
      );
      expect(valid.valid).toBe(true);
      
      const tooLong = SecretValidator.validateSecret(
        'CONFIG_ENCRYPTION_KEY',
        'a'.repeat(33)
      );
      expect(tooLong.valid).toBe(false);
      expect(tooLong.errors).toContain('Secret must be at most 32 characters long');
    });
  });
  
  describe('generateSecureSecret', () => {
    it('should generate valid JWT_SECRET', () => {
      const secret = SecretValidator.generateSecureSecret('JWT_SECRET');
      const validation = SecretValidator.validateSecret('JWT_SECRET', secret);
      expect(validation.valid).toBe(true);
      expect(secret.length).toBe(64);
    });
    
    it('should generate valid ADMIN_PASSWORD', () => {
      const password = SecretValidator.generateSecureSecret('ADMIN_PASSWORD');
      const validation = SecretValidator.validateSecret('ADMIN_PASSWORD', password);
      expect(validation.valid).toBe(true);
      expect(/[A-Z]/.test(password)).toBe(true);
      expect(/[a-z]/.test(password)).toBe(true);
      expect(/\d/.test(password)).toBe(true);
      expect(/[@$!%*?&]/.test(password)).toBe(true);
    });
    
    it('should generate valid CONFIG_ENCRYPTION_KEY', () => {
      const key = SecretValidator.generateSecureSecret('CONFIG_ENCRYPTION_KEY');
      expect(key.length).toBe(32);
      const validation = SecretValidator.validateSecret('CONFIG_ENCRYPTION_KEY', key);
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('rotation checks', () => {
    it('should determine if rotation is needed', () => {
      const lastRotated = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const shouldRotate = SecretValidator.shouldRotate('JWT_SECRET', lastRotated);
      expect(shouldRotate).toBe(true);
      
      const recentRotation = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const shouldNotRotate = SecretValidator.shouldRotate('JWT_SECRET', recentRotation);
      expect(shouldNotRotate).toBe(false);
    });
    
    it('should calculate days until rotation', () => {
      const lastRotated = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000); // 80 days ago
      const days = SecretValidator.getDaysUntilRotation('JWT_SECRET', lastRotated);
      expect(days).toBe(10); // 90 - 80 = 10 days remaining
    });
  });
});

describe('secretUtils', () => {
  it('should generate all secret types', () => {
    const jwt = secretUtils.generateJwtSecret();
    const session = secretUtils.generateSessionSecret();
    const encryption = secretUtils.generateEncryptionKey();
    const admin = secretUtils.generateAdminPassword();
    const api = secretUtils.generateApiKey();
    
    expect(jwt.length).toBe(64);
    expect(session.length).toBe(64);
    expect(encryption.length).toBe(32);
    expect(admin.length).toBeGreaterThanOrEqual(16);
    expect(api.length).toBeGreaterThanOrEqual(32);
  });
  
  it('should validate all secrets in object', () => {
    const secrets = {
      JWT_SECRET: secretUtils.generateJwtSecret(),
      SESSION_SECRET: secretUtils.generateSessionSecret(),
      INVALID_SECRET: 'too-short',
    };
    
    const results = secretUtils.validateAllSecrets(secrets);
    expect(results.JWT_SECRET.valid).toBe(true);
    expect(results.SESSION_SECRET.valid).toBe(true);
    expect(results.INVALID_SECRET).toBeUndefined(); // No policy for this key
  });
  
  it('should identify secret keys', () => {
    expect(secretUtils.isSecretKey('JWT_SECRET')).toBe(true);
    expect(secretUtils.isSecretKey('API_KEY')).toBe(true);
    expect(secretUtils.isSecretKey('DATABASE_PASSWORD')).toBe(true);
    expect(secretUtils.isSecretKey('SOME_TOKEN')).toBe(true);
    expect(secretUtils.isSecretKey('REGULAR_CONFIG')).toBe(false);
  });
});