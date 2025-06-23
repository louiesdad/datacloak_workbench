import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { ConfigService } from './config.service';
import logger from '../config/logger';

export interface Secret {
  key: string;
  value: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface SecretProvider {
  name: string;
  getSecret(key: string): Promise<string>;
  setSecret(key: string, value: string, metadata?: Record<string, any>): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(): Promise<string[]>;
  rotateSecret(key: string): Promise<string>;
}

export interface SecretAccess {
  secretKey: string;
  accessedBy: string;
  accessedAt: Date;
  operation: 'read' | 'write' | 'delete' | 'rotate';
  success: boolean;
  metadata?: Record<string, any>;
}

export class SecretManagerService extends EventEmitter {
  private static instance: SecretManagerService;
  private providers: Map<string, SecretProvider> = new Map();
  private cache: Map<string, { value: string; expiresAt: Date }> = new Map();
  private accessLog: SecretAccess[] = [];
  private rotationSchedule: Map<string, NodeJS.Timeout> = new Map();
  private configService: ConfigService;

  private constructor() {
    super();
    try {
      this.configService = ConfigService.getInstance();
    } catch (error) {
      // Fallback for testing environments
      this.configService = {
        get: (key: string) => {
          const defaults: Record<string, any> = {
            SECRET_PROVIDER: 'env',
            SECRET_CACHE_TTL: 3600,
            SECRET_ACCESS_LOG_SIZE: 10000,
          };
          return process.env[key] || defaults[key];
        }
      } as any;
    }
    this.initializeProviders();
  }

  static getInstance(): SecretManagerService {
    if (!SecretManagerService.instance) {
      SecretManagerService.instance = new SecretManagerService();
    }
    return SecretManagerService.instance;
  }

  private initializeProviders(): void {
    // Initialize default providers based on configuration
    const secretProvider = this.configService?.get ? 
      this.configService.get('SECRET_PROVIDER') : 
      'env';
    
    switch (secretProvider) {
      case 'aws':
        this.registerProvider('aws', new AWSSecretsManagerProvider());
        break;
      case 'azure':
        this.registerProvider('azure', new AzureKeyVaultProvider());
        break;
      case 'vault':
        this.registerProvider('vault', new HashiCorpVaultProvider());
        break;
      default:
        this.registerProvider('env', new EnvironmentSecretProvider());
    }
  }

  registerProvider(name: string, provider: SecretProvider): void {
    this.providers.set(name, provider);
    logger.info(`Registered secret provider: ${name}`);
  }

  async getSecret(key: string, userId?: string): Promise<string> {
    const startTime = Date.now();
    let success = false;
    
    try {
      // Check cache first
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > new Date()) {
        success = true;
        this.logAccess({
          secretKey: key,
          accessedBy: userId || 'system',
          accessedAt: new Date(),
          operation: 'read',
          success: true,
          metadata: { cached: true }
        });
        return cached.value;
      }

      // Get from provider
      const provider = this.getActiveProvider();
      const value = await provider.getSecret(key);
      
      // Cache the secret
      const ttl = this.configService?.get ? 
        (this.configService.get('SECRET_CACHE_TTL') || 3600) : 
        3600;
      this.cache.set(key, {
        value,
        expiresAt: new Date(Date.now() + ttl * 1000)
      });

      success = true;
      this.emit('secret:accessed', { key, provider: provider.name });
      
      return value;
    } catch (error) {
      logger.error(`Failed to get secret ${key}:`, error);
      throw error;
    } finally {
      this.logAccess({
        secretKey: key,
        accessedBy: userId || 'system',
        accessedAt: new Date(),
        operation: 'read',
        success,
        metadata: { duration: Date.now() - startTime }
      });
    }
  }

  async setSecret(
    key: string, 
    value: string, 
    metadata?: Record<string, any>,
    userId?: string
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    
    try {
      // Validate secret
      this.validateSecret(key, value);
      
      const provider = this.getActiveProvider();
      await provider.setSecret(key, value, metadata);
      
      // Clear cache
      this.cache.delete(key);
      
      success = true;
      this.emit('secret:updated', { key, provider: provider.name });
    } catch (error) {
      logger.error(`Failed to set secret ${key}:`, error);
      throw error;
    } finally {
      this.logAccess({
        secretKey: key,
        accessedBy: userId || 'system',
        accessedAt: new Date(),
        operation: 'write',
        success,
        metadata: { duration: Date.now() - startTime }
      });
    }
  }

  async deleteSecret(key: string, userId?: string): Promise<void> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const provider = this.getActiveProvider();
      await provider.deleteSecret(key);
      
      // Clear cache and rotation schedule
      this.cache.delete(key);
      const rotationTimer = this.rotationSchedule.get(key);
      if (rotationTimer) {
        clearInterval(rotationTimer);
        this.rotationSchedule.delete(key);
      }
      
      success = true;
      this.emit('secret:deleted', { key, provider: provider.name });
    } catch (error) {
      logger.error(`Failed to delete secret ${key}:`, error);
      throw error;
    } finally {
      this.logAccess({
        secretKey: key,
        accessedBy: userId || 'system',
        accessedAt: new Date(),
        operation: 'delete',
        success,
        metadata: { duration: Date.now() - startTime }
      });
    }
  }

  async rotateSecret(key: string, userId?: string): Promise<string> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const provider = this.getActiveProvider();
      const newValue = await provider.rotateSecret(key);
      
      // Clear cache
      this.cache.delete(key);
      
      success = true;
      this.emit('secret:rotated', { key, provider: provider.name });
      
      return newValue;
    } catch (error) {
      logger.error(`Failed to rotate secret ${key}:`, error);
      throw error;
    } finally {
      this.logAccess({
        secretKey: key,
        accessedBy: userId || 'system',
        accessedAt: new Date(),
        operation: 'rotate',
        success,
        metadata: { duration: Date.now() - startTime }
      });
    }
  }

  setupRotationSchedule(key: string, intervalMs: number): void {
    // Clear existing schedule
    const existing = this.rotationSchedule.get(key);
    if (existing) {
      clearInterval(existing);
    }

    // Set up new schedule
    const timer = setInterval(async () => {
      try {
        await this.rotateSecret(key, 'scheduled-rotation');
        logger.info(`Successfully rotated secret: ${key}`);
      } catch (error) {
        logger.error(`Failed to rotate secret ${key} on schedule:`, error);
        this.emit('secret:rotation-failed', { key, error });
      }
    }, intervalMs);

    this.rotationSchedule.set(key, timer);
    logger.info(`Set up rotation schedule for ${key} every ${intervalMs}ms`);
  }

  private validateSecret(key: string, value: string): void {
    // Key validation
    if (!key || typeof key !== 'string' || key.length === 0) {
      throw new Error('Secret key must be a non-empty string');
    }

    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error('Secret key must contain only uppercase letters, numbers, and underscores');
    }

    // Value validation
    if (!value || typeof value !== 'string' || value.length === 0) {
      throw new Error('Secret value must be a non-empty string');
    }

    // Check for common mistakes
    if (value.includes('password') || value.includes('secret') || value.includes('key')) {
      logger.warn(`Secret ${key} contains sensitive keywords in value`);
    }

    // Length validation based on key type
    if (key.endsWith('_KEY') && value.length < 32) {
      throw new Error('Encryption keys must be at least 32 characters');
    }

    if (key.endsWith('_SECRET') && value.length < 64) {
      throw new Error('Secrets must be at least 64 characters');
    }

    if (key.endsWith('_TOKEN') && value.length < 32) {
      throw new Error('Tokens must be at least 32 characters');
    }
  }

  private getActiveProvider(): SecretProvider {
    const providerName = this.configService?.get ? 
      (this.configService.get('SECRET_PROVIDER') || 'env') : 
      'env';
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Secret provider '${providerName}' not found`);
    }
    
    return provider;
  }

  private logAccess(access: SecretAccess): void {
    this.accessLog.push(access);
    
    // Trim access log if too large
    const maxLogSize = this.configService?.get ? 
      (this.configService.get('SECRET_ACCESS_LOG_SIZE') || 10000) : 
      10000;
    if (this.accessLog.length > maxLogSize) {
      this.accessLog = this.accessLog.slice(-maxLogSize);
    }

    // Emit access event for external auditing
    this.emit('secret:access', access);
  }

  getAccessLog(filters?: {
    secretKey?: string;
    accessedBy?: string;
    operation?: SecretAccess['operation'];
    startDate?: Date;
    endDate?: Date;
  }): SecretAccess[] {
    let log = [...this.accessLog];

    if (filters) {
      if (filters.secretKey) {
        log = log.filter(l => l.secretKey === filters.secretKey);
      }
      if (filters.accessedBy) {
        log = log.filter(l => l.accessedBy === filters.accessedBy);
      }
      if (filters.operation) {
        log = log.filter(l => l.operation === filters.operation);
      }
      if (filters.startDate) {
        log = log.filter(l => l.accessedAt >= filters.startDate!);
      }
      if (filters.endDate) {
        log = log.filter(l => l.accessedAt <= filters.endDate!);
      }
    }

    return log;
  }

  async exportAccessLog(): Promise<string> {
    const log = this.getAccessLog();
    return JSON.stringify(log, null, 2);
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Secret cache cleared');
  }

  async close(): Promise<void> {
    // Clear all rotation schedules
    for (const [key, timer] of this.rotationSchedule) {
      clearInterval(timer);
    }
    this.rotationSchedule.clear();
    
    // Clear cache
    this.cache.clear();
    
    // Clear access log
    this.accessLog = [];
    
    logger.info('Secret manager service closed');
  }
}

// Environment-based secret provider (default)
class EnvironmentSecretProvider implements SecretProvider {
  name = 'env';

  async getSecret(key: string): Promise<string> {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Secret '${key}' not found in environment`);
    }
    return value;
  }

  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async deleteSecret(key: string): Promise<void> {
    delete process.env[key];
  }

  async listSecrets(): Promise<string[]> {
    return Object.keys(process.env).filter(key => 
      key.endsWith('_SECRET') || 
      key.endsWith('_KEY') || 
      key.endsWith('_TOKEN') ||
      key.endsWith('_PASSWORD')
    );
  }

  async rotateSecret(key: string): Promise<string> {
    const newValue = crypto.randomBytes(32).toString('base64');
    await this.setSecret(key, newValue);
    return newValue;
  }
}

// AWS Secrets Manager provider (stub)
class AWSSecretsManagerProvider implements SecretProvider {
  name = 'aws';

  async getSecret(key: string): Promise<string> {
    // TODO: Implement AWS Secrets Manager integration
    throw new Error('AWS Secrets Manager not implemented');
  }

  async setSecret(key: string, value: string): Promise<void> {
    // TODO: Implement AWS Secrets Manager integration
    throw new Error('AWS Secrets Manager not implemented');
  }

  async deleteSecret(key: string): Promise<void> {
    // TODO: Implement AWS Secrets Manager integration
    throw new Error('AWS Secrets Manager not implemented');
  }

  async listSecrets(): Promise<string[]> {
    // TODO: Implement AWS Secrets Manager integration
    throw new Error('AWS Secrets Manager not implemented');
  }

  async rotateSecret(key: string): Promise<string> {
    // TODO: Implement AWS Secrets Manager integration
    throw new Error('AWS Secrets Manager not implemented');
  }
}

// Azure Key Vault provider (stub)
class AzureKeyVaultProvider implements SecretProvider {
  name = 'azure';

  async getSecret(key: string): Promise<string> {
    // TODO: Implement Azure Key Vault integration
    throw new Error('Azure Key Vault not implemented');
  }

  async setSecret(key: string, value: string): Promise<void> {
    // TODO: Implement Azure Key Vault integration
    throw new Error('Azure Key Vault not implemented');
  }

  async deleteSecret(key: string): Promise<void> {
    // TODO: Implement Azure Key Vault integration
    throw new Error('Azure Key Vault not implemented');
  }

  async listSecrets(): Promise<string[]> {
    // TODO: Implement Azure Key Vault integration
    throw new Error('Azure Key Vault not implemented');
  }

  async rotateSecret(key: string): Promise<string> {
    // TODO: Implement Azure Key Vault integration
    throw new Error('Azure Key Vault not implemented');
  }
}

// HashiCorp Vault provider (stub)
class HashiCorpVaultProvider implements SecretProvider {
  name = 'vault';

  async getSecret(key: string): Promise<string> {
    // TODO: Implement HashiCorp Vault integration
    throw new Error('HashiCorp Vault not implemented');
  }

  async setSecret(key: string, value: string): Promise<void> {
    // TODO: Implement HashiCorp Vault integration
    throw new Error('HashiCorp Vault not implemented');
  }

  async deleteSecret(key: string): Promise<void> {
    // TODO: Implement HashiCorp Vault integration
    throw new Error('HashiCorp Vault not implemented');
  }

  async listSecrets(): Promise<string[]> {
    // TODO: Implement HashiCorp Vault integration
    throw new Error('HashiCorp Vault not implemented');
  }

  async rotateSecret(key: string): Promise<string> {
    // TODO: Implement HashiCorp Vault integration
    throw new Error('HashiCorp Vault not implemented');
  }
}

export default SecretManagerService;