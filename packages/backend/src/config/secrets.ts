import * as Joi from 'joi';
import * as crypto from 'crypto';

export interface SecretPolicy {
  pattern: RegExp;
  minLength: number;
  maxLength?: number;
  rotationInterval?: number; // in milliseconds
  expirationTime?: number; // in milliseconds
  allowedCharacters?: RegExp;
  complexity?: {
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    minComplexityScore?: number;
  };
}

export const secretPolicies: Record<string, SecretPolicy> = {
  JWT_SECRET: {
    pattern: /^[A-Za-z0-9+/=]+$/,
    minLength: 64,
    rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  
  SESSION_SECRET: {
    pattern: /^[A-Za-z0-9+/=]+$/,
    minLength: 64,
    rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  
  CONFIG_ENCRYPTION_KEY: {
    pattern: /^[A-Za-z0-9+/=]+$/,
    minLength: 32,
    maxLength: 32,
    rotationInterval: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  
  ADMIN_PASSWORD: {
    pattern: /^[\x20-\x7E]+$/, // Printable ASCII
    minLength: 16,
    maxLength: 128,
    rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
    complexity: {
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      minComplexityScore: 4
    }
  },
  
  API_KEY: {
    pattern: /^[A-Za-z0-9_-]+$/,
    minLength: 32,
    rotationInterval: 180 * 24 * 60 * 60 * 1000, // 180 days
  },
  
  DATABASE_PASSWORD: {
    pattern: /^[\x20-\x7E]+$/, // Printable ASCII
    minLength: 20,
    maxLength: 128,
    rotationInterval: 180 * 24 * 60 * 60 * 1000, // 180 days
    complexity: {
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    }
  },
  
  REDIS_PASSWORD: {
    pattern: /^[\x20-\x7E]+$/, // Printable ASCII
    minLength: 32,
    rotationInterval: 180 * 24 * 60 * 60 * 1000, // 180 days
  },
  
  OPENAI_API_KEY: {
    pattern: /^sk-[A-Za-z0-9]+$/,
    minLength: 48,
    rotationInterval: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  
  WEBHOOK_SECRET: {
    pattern: /^[A-Za-z0-9+/=]+$/,
    minLength: 32,
    rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  
  OAUTH_CLIENT_SECRET: {
    pattern: /^[A-Za-z0-9_-]+$/,
    minLength: 32,
    rotationInterval: 365 * 24 * 60 * 60 * 1000, // 1 year
  }
};

export const secretSchema = Joi.object({
  SECRET_PROVIDER: Joi.string()
    .valid('env', 'aws', 'azure', 'vault')
    .default('env')
    .description('Secret management provider'),
  
  SECRET_CACHE_TTL: Joi.number()
    .min(0)
    .max(86400)
    .default(3600)
    .description('Secret cache TTL in seconds'),
  
  SECRET_ACCESS_LOG_SIZE: Joi.number()
    .min(100)
    .max(100000)
    .default(10000)
    .description('Maximum number of access log entries to keep'),
  
  SECRET_ROTATION_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable automatic secret rotation'),
  
  SECRET_ROTATION_NOTIFY_DAYS: Joi.number()
    .min(1)
    .max(30)
    .default(7)
    .description('Days before rotation to send notifications'),
  
  // AWS Secrets Manager settings
  AWS_REGION: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'aws',
      then: Joi.required()
    })
    .description('AWS region for Secrets Manager'),
  
  AWS_SECRET_PREFIX: Joi.string()
    .default('datacloak/')
    .description('Prefix for AWS secrets'),
  
  // Azure Key Vault settings
  AZURE_KEY_VAULT_URL: Joi.string()
    .uri()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.required()
    })
    .description('Azure Key Vault URL'),
  
  AZURE_TENANT_ID: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.required()
    })
    .description('Azure tenant ID'),
  
  AZURE_CLIENT_ID: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'azure',
      then: Joi.required()
    })
    .description('Azure client ID'),
  
  // HashiCorp Vault settings
  VAULT_ADDR: Joi.string()
    .uri()
    .when('SECRET_PROVIDER', {
      is: 'vault',
      then: Joi.required()
    })
    .description('HashiCorp Vault address'),
  
  VAULT_TOKEN: Joi.string()
    .when('SECRET_PROVIDER', {
      is: 'vault',
      then: Joi.required()
    })
    .description('HashiCorp Vault token'),
  
  VAULT_PATH: Joi.string()
    .default('secret/datacloak')
    .description('HashiCorp Vault secret path'),
});

export class SecretValidator {
  static validateSecret(key: string, value: string): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const policy = secretPolicies[key];
    
    if (!policy) {
      // No specific policy, apply general validation
      if (value.length < 16) {
        errors.push('Secret must be at least 16 characters long');
      }
      return { valid: errors.length === 0, errors };
    }
    
    // Length validation
    if (value.length < policy.minLength) {
      errors.push(`Secret must be at least ${policy.minLength} characters long`);
    }
    
    if (policy.maxLength && value.length > policy.maxLength) {
      errors.push(`Secret must be at most ${policy.maxLength} characters long`);
    }
    
    // Pattern validation
    if (!policy.pattern.test(value)) {
      errors.push('Secret contains invalid characters');
    }
    
    // Complexity validation
    if (policy.complexity) {
      const complexityErrors = this.validateComplexity(value, policy.complexity);
      errors.push(...complexityErrors);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private static validateComplexity(
    value: string, 
    requirements: NonNullable<SecretPolicy['complexity']>
  ): string[] {
    const errors: string[] = [];
    let score = 0;
    
    if (requirements.requireUppercase) {
      if (!/[A-Z]/.test(value)) {
        errors.push('Secret must contain at least one uppercase letter');
      } else {
        score++;
      }
    }
    
    if (requirements.requireLowercase) {
      if (!/[a-z]/.test(value)) {
        errors.push('Secret must contain at least one lowercase letter');
      } else {
        score++;
      }
    }
    
    if (requirements.requireNumbers) {
      if (!/\d/.test(value)) {
        errors.push('Secret must contain at least one number');
      } else {
        score++;
      }
    }
    
    if (requirements.requireSpecialChars) {
      if (!/[@$!%*?&]/.test(value)) {
        errors.push('Secret must contain at least one special character (@$!%*?&)');
      } else {
        score++;
      }
    }
    
    if (requirements.minComplexityScore && score < requirements.minComplexityScore) {
      errors.push(`Secret complexity score (${score}) is below minimum (${requirements.minComplexityScore})`);
    }
    
    return errors;
  }
  
  static generateSecureSecret(key: string): string {
    const policy = secretPolicies[key];
    
    if (!policy) {
      // Default secure generation
      return crypto.randomBytes(32).toString('base64');
    }
    
    const length = policy.maxLength || policy.minLength;
    
    // Special handling for specific secret types
    if (key === 'ADMIN_PASSWORD') {
      return this.generateSecurePassword(length);
    }
    
    if (key === 'CONFIG_ENCRYPTION_KEY') {
      return crypto.randomBytes(32).toString('base64').slice(0, 32);
    }
    
    if (key === 'OPENAI_API_KEY') {
      // Generate mock API key for testing
      const random = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '');
      return `sk-${random}`;
    }
    
    // Default to base64 encoded random bytes
    const bytes = Math.ceil(length * 0.75); // Account for base64 expansion
    return crypto.randomBytes(bytes).toString('base64').slice(0, length);
  }
  
  private static generateSecurePassword(length: number): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '@$!%*?&';
    const all = uppercase + lowercase + numbers + special;
    
    let password = '';
    
    // Ensure at least one of each required character type
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += special[crypto.randomInt(special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += all[crypto.randomInt(all.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(2) - 1).join('');
  }
  
  static getRotationSchedule(key: string): number | undefined {
    const policy = secretPolicies[key];
    return policy?.rotationInterval;
  }
  
  static shouldRotate(key: string, lastRotated: Date): boolean {
    const interval = this.getRotationSchedule(key);
    if (!interval) return false;
    
    const now = Date.now();
    const lastRotatedTime = lastRotated.getTime();
    
    return (now - lastRotatedTime) >= interval;
  }
  
  static getDaysUntilRotation(key: string, lastRotated: Date): number | null {
    const interval = this.getRotationSchedule(key);
    if (!interval) return null;
    
    const now = Date.now();
    const lastRotatedTime = lastRotated.getTime();
    const nextRotation = lastRotatedTime + interval;
    const daysRemaining = Math.ceil((nextRotation - now) / (24 * 60 * 60 * 1000));
    
    return Math.max(0, daysRemaining);
  }
}

export interface SecretRotationNotification {
  secretKey: string;
  daysUntilRotation: number;
  lastRotated: Date;
  nextRotation: Date;
}

export class SecretRotationScheduler {
  private rotationMetadata: Map<string, { lastRotated: Date; notified: boolean }> = new Map();
  
  checkRotationNeeded(): SecretRotationNotification[] {
    const notifications: SecretRotationNotification[] = [];
    
    for (const [key, policy] of Object.entries(secretPolicies)) {
      if (!policy.rotationInterval) continue;
      
      const metadata = this.rotationMetadata.get(key);
      if (!metadata) continue;
      
      const daysUntilRotation = SecretValidator.getDaysUntilRotation(key, metadata.lastRotated);
      
      if (daysUntilRotation !== null && daysUntilRotation <= 7 && !metadata.notified) {
        const nextRotation = new Date(
          metadata.lastRotated.getTime() + policy.rotationInterval
        );
        
        notifications.push({
          secretKey: key,
          daysUntilRotation,
          lastRotated: metadata.lastRotated,
          nextRotation
        });
        
        metadata.notified = true;
      }
    }
    
    return notifications;
  }
  
  recordRotation(key: string): void {
    this.rotationMetadata.set(key, {
      lastRotated: new Date(),
      notified: false
    });
  }
  
  getRotationHistory(): Record<string, { lastRotated: Date; notified: boolean }> {
    const history: Record<string, { lastRotated: Date; notified: boolean }> = {};
    
    for (const [key, metadata] of this.rotationMetadata) {
      history[key] = { ...metadata };
    }
    
    return history;
  }
}

// Export utilities for secret management
export const secretUtils = {
  generateJwtSecret: () => SecretValidator.generateSecureSecret('JWT_SECRET'),
  generateSessionSecret: () => SecretValidator.generateSecureSecret('SESSION_SECRET'),
  generateEncryptionKey: () => SecretValidator.generateSecureSecret('CONFIG_ENCRYPTION_KEY'),
  generateAdminPassword: () => SecretValidator.generateSecureSecret('ADMIN_PASSWORD'),
  generateApiKey: () => SecretValidator.generateSecureSecret('API_KEY'),
  
  validateAllSecrets: (secrets: Record<string, string>) => {
    const results: Record<string, { valid: boolean; errors?: string[] }> = {};
    
    for (const [key, value] of Object.entries(secrets)) {
      if (secretPolicies[key]) {
        results[key] = SecretValidator.validateSecret(key, value);
      }
    }
    
    return results;
  },
  
  getSecretPolicy: (key: string) => secretPolicies[key],
  
  isSecretKey: (key: string) => {
    return key.endsWith('_SECRET') || 
           key.endsWith('_KEY') || 
           key.endsWith('_TOKEN') ||
           key.endsWith('_PASSWORD') ||
           key in secretPolicies;
  }
};