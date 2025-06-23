import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { configSchema, IConfig } from './config.schema';
import { productionConfigSchema, IProductionConfig, validateProductionConfig } from './production.config';
import logger from './logger';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  config?: IConfig | IProductionConfig;
}

export interface ConfigValidationOptions {
  environment?: string;
  strict?: boolean;
  checkSecrets?: boolean;
  checkPaths?: boolean;
}

export class ConfigValidator {
  private static readonly WEAK_PASSWORDS = [
    'password', 'admin', '12345678', 'qwerty', 'letmein',
    'welcome', 'monkey', 'dragon', 'baseball', 'master'
  ];

  /**
   * Validate configuration based on environment
   */
  public static async validate(
    config: any,
    options: ConfigValidationOptions = {}
  ): Promise<ValidationResult> {
    const {
      environment = process.env.NODE_ENV || 'development',
      strict = environment === 'production',
      checkSecrets = true,
      checkPaths = true
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Choose schema based on environment
      let validationResult;
      if (environment === 'production') {
        validationResult = validateProductionConfig(config);
      } else {
        const result = configSchema.validate(config, { 
          abortEarly: false,
          convert: true 
        });
        validationResult = result.error ? { error: result.error } : { value: result.value };
      }

      if (validationResult.error) {
        validationResult.error.details.forEach(detail => {
          errors.push(`${detail.path.join('.')}: ${detail.message}`);
        });
        return { valid: false, errors };
      }

      const validatedConfig = validationResult.value!;

      // Additional security checks
      if (checkSecrets) {
        const secretErrors = this.validateSecrets(validatedConfig, strict);
        errors.push(...secretErrors.errors);
        warnings.push(...secretErrors.warnings);
      }

      // Path validation
      if (checkPaths) {
        const pathErrors = await this.validatePaths(validatedConfig);
        errors.push(...pathErrors.errors);
        warnings.push(...pathErrors.warnings);
      }

      // Environment-specific checks
      const envErrors = this.validateEnvironmentSpecific(validatedConfig, environment);
      errors.push(...envErrors.errors);
      warnings.push(...envErrors.warnings);

      // Dependency checks
      const depErrors = this.validateDependencies(validatedConfig);
      errors.push(...depErrors.errors);
      warnings.push(...depErrors.warnings);

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        config: errors.length === 0 ? validatedConfig : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Validate secrets and sensitive configuration
   */
  private static validateSecrets(
    config: any,
    strict: boolean
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // JWT Secret validation
    if (config.JWT_SECRET) {
      if (config.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET must be at least 32 characters long');
      }
      if (config.JWT_SECRET === 'default-jwt-secret-change-in-production') {
        if (strict) {
          errors.push('Default JWT secret not allowed in production');
        } else {
          warnings.push('Using default JWT secret - change before production');
        }
      }
    }

    // Admin password validation
    if (config.ADMIN_PASSWORD) {
      const password = config.ADMIN_PASSWORD.toLowerCase();
      if (this.WEAK_PASSWORDS.some(weak => password.includes(weak))) {
        errors.push('Admin password contains common weak patterns');
      }
      if (strict && config.ADMIN_PASSWORD.length < 16) {
        errors.push('Admin password must be at least 16 characters in production');
      }
    }

    // OpenAI API key validation
    if (config.OPENAI_API_KEY) {
      if (!config.OPENAI_API_KEY.startsWith('sk-')) {
        errors.push('Invalid OpenAI API key format');
      }
      if (config.OPENAI_API_KEY.includes('test') && strict) {
        warnings.push('Test API key detected - ensure this is intentional');
      }
    }

    // Encryption key validation
    if (config.CONFIG_ENCRYPTION_KEY) {
      if (config.CONFIG_ENCRYPTION_KEY.length < 32) {
        errors.push('CONFIG_ENCRYPTION_KEY must be at least 32 characters');
      }
      // Check entropy
      const entropy = this.calculateEntropy(config.CONFIG_ENCRYPTION_KEY);
      if (entropy < 3.5) {
        warnings.push('CONFIG_ENCRYPTION_KEY has low entropy - consider using a stronger key');
      }
    }

    // Session secret validation
    if (config.SESSION_SECRET) {
      if (config.SESSION_SECRET.length < 32) {
        errors.push('SESSION_SECRET must be at least 32 characters');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate file paths and directories
   */
  private static async validatePaths(
    config: any
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Database paths
    if (config.DB_PATH) {
      const dbDir = path.dirname(config.DB_PATH);
      try {
        await fs.promises.access(dbDir, fs.constants.W_OK);
      } catch {
        warnings.push(`Database directory ${dbDir} is not writable or doesn't exist`);
      }
    }

    // Log directory
    if (config.LOG_DIR) {
      try {
        await fs.promises.access(config.LOG_DIR, fs.constants.W_OK);
      } catch {
        try {
          await fs.promises.mkdir(config.LOG_DIR, { recursive: true });
          warnings.push(`Created log directory: ${config.LOG_DIR}`);
        } catch (err) {
          errors.push(`Cannot create log directory: ${config.LOG_DIR}`);
        }
      }
    }

    // SSL certificate paths
    if (config.SSL_ENABLED) {
      if (config.SSL_CERT_PATH) {
        try {
          await fs.promises.access(config.SSL_CERT_PATH, fs.constants.R_OK);
        } catch {
          errors.push(`SSL certificate not found or not readable: ${config.SSL_CERT_PATH}`);
        }
      }
      if (config.SSL_KEY_PATH) {
        try {
          await fs.promises.access(config.SSL_KEY_PATH, fs.constants.R_OK);
        } catch {
          errors.push(`SSL key not found or not readable: ${config.SSL_KEY_PATH}`);
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Environment-specific validation
   */
  private static validateEnvironmentSpecific(
    config: any,
    environment: string
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (environment === 'production') {
      // Production-specific checks
      if (!config.REDIS_PASSWORD) {
        errors.push('Redis password is required in production');
      }
      if (!config.SSL_ENABLED) {
        errors.push('SSL must be enabled in production');
      }
      if (config.ENABLE_DEBUG_ENDPOINTS) {
        errors.push('Debug endpoints must be disabled in production');
      }
      if (!config.ERROR_REPORTING_ENABLED) {
        warnings.push('Error reporting is disabled - consider enabling for production monitoring');
      }
    } else if (environment === 'development') {
      // Development-specific warnings
      if (config.SSL_ENABLED) {
        warnings.push('SSL is enabled in development - this may complicate local testing');
      }
      if (!config.ENABLE_HOT_RELOAD) {
        warnings.push('Hot reload is disabled in development');
      }
    }

    // Cross-environment checks
    if (config.RATE_LIMIT_MAX_REQUESTS > 1000) {
      warnings.push('Rate limit is very high - this may allow abuse');
    }

    if (config.JOB_QUEUE_MAX_CONCURRENT > 20) {
      warnings.push('Very high concurrent job limit may impact performance');
    }

    return { errors, warnings };
  }

  /**
   * Validate configuration dependencies
   */
  private static validateDependencies(
    config: any
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Redis dependencies
    if (config.CACHE_TYPE === 'redis' && !config.REDIS_ENABLED) {
      errors.push('Redis cache type selected but Redis is not enabled');
    }

    // OpenAI dependencies
    if (!config.OPENAI_API_KEY && config.NODE_ENV === 'production') {
      warnings.push('OpenAI API key not configured - sentiment analysis will be unavailable');
    }

    // Backup dependencies
    if (config.BACKUP_ENABLED && !config.DB_PATH) {
      errors.push('Backup enabled but no database path configured');
    }

    // Tracing dependencies
    if (config.ENABLE_TRACING && !config.TRACING_ENDPOINT) {
      errors.push('Tracing enabled but no endpoint configured');
    }

    // Session dependencies
    if (!config.SESSION_SECRET && config.ENABLE_CONFIG_API) {
      errors.push('Session secret required when config API is enabled');
    }

    return { errors, warnings };
  }

  /**
   * Calculate entropy of a string (for password strength)
   */
  private static calculateEntropy(str: string): number {
    const freq: { [key: string]: number } = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    
    for (const char in freq) {
      const p = freq[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Generate secure configuration values
   */
  public static generateSecureValues(): {
    jwtSecret: string;
    sessionSecret: string;
    encryptionKey: string;
    adminPassword: string;
  } {
    return {
      jwtSecret: crypto.randomBytes(64).toString('hex'),
      sessionSecret: crypto.randomBytes(64).toString('hex'),
      encryptionKey: crypto.randomBytes(32).toString('hex'),
      adminPassword: this.generateSecurePassword()
    };
  }

  /**
   * Generate a secure password
   */
  private static generateSecurePassword(): string {
    const length = 20;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure at least one of each required character type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*()_+-='[Math.floor(Math.random() * 14)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Export configuration (with secrets masked)
   */
  public static exportConfig(config: any, maskSecrets = true): string {
    const exported = { ...config };
    
    if (maskSecrets) {
      const secretKeys = [
        'JWT_SECRET', 'SESSION_SECRET', 'CONFIG_ENCRYPTION_KEY',
        'ADMIN_PASSWORD', 'REDIS_PASSWORD', 'OPENAI_API_KEY',
        'ERROR_REPORTING_DSN'
      ];
      
      for (const key of secretKeys) {
        if (exported[key]) {
          exported[key] = '***REDACTED***';
        }
      }
    }
    
    return JSON.stringify(exported, null, 2);
  }
}