import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { configSchema, IConfig } from '../config/config.schema';

export interface ConfigUpdateEvent {
  key: string;
  oldValue: any;
  newValue: any;
}

export class ConfigService extends EventEmitter {
  private static instance: ConfigService;
  private config: IConfig;
  private encryptionKey: Buffer | null = null;
  private configFilePath: string;
  private watcher: chokidar.FSWatcher | null = null;
  
  private constructor() {
    super();
    this.configFilePath = path.join(process.cwd(), 'config.json');
    this.initialize();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private initialize(): void {
    // Load environment variables
    this.loadEnvironmentConfig();
    
    // Load persisted configuration
    this.loadPersistedConfig();
    
    // Set up encryption if key is provided
    if (this.config.CONFIG_ENCRYPTION_KEY) {
      this.encryptionKey = crypto.scryptSync(
        this.config.CONFIG_ENCRYPTION_KEY,
        'salt',
        32
      );
    }
    
    // Set up hot-reload if enabled (disabled in test environment to prevent memory leaks)
    if (this.config.ENABLE_HOT_RELOAD && process.env.NODE_ENV !== 'test') {
      this.setupHotReload();
    }
  }

  private loadEnvironmentConfig(): void {
    const envConfig: any = {};
    
    // Load all environment variables
    Object.keys(process.env).forEach(key => {
      envConfig[key] = process.env[key];
    });
    
    // Validate configuration
    const { error, value } = configSchema.validate(envConfig);
    
    if (error) {
      throw new Error(`Configuration validation error: ${error.message}`);
    }
    
    this.config = value as IConfig;
  }

  private loadPersistedConfig(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const encryptedData = fs.readFileSync(this.configFilePath, 'utf8');
        const decryptedConfig = this.decrypt(encryptedData);
        const persistedConfig = JSON.parse(decryptedConfig);
        
        // Merge persisted config with environment config
        // Environment variables take precedence
        Object.keys(persistedConfig).forEach(key => {
          if (!process.env[key] && persistedConfig[key] !== undefined) {
            (this.config as any)[key] = persistedConfig[key];
          }
        });
        
        console.log('Loaded persisted configuration');
      }
    } catch (error) {
      console.error('Failed to load persisted configuration', error);
    }
  }

  private setupHotReload(): void {
    this.watcher = chokidar.watch(this.configFilePath, {
      persistent: true,
      ignoreInitial: true,
    });
    
    this.watcher.on('change', () => {
      console.log('Configuration file changed, reloading...');
      this.loadPersistedConfig();
      this.emit('config.updated', this.config);
    });
    
    console.log('Configuration hot-reload enabled');
  }

  private encrypt(text: string): string {
    if (!this.encryptionKey) {
      return text;
    }
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    if (!this.encryptionKey) {
      return text;
    }
    
    try {
      const parts = text.split(':');
      if (parts.length !== 2) {
        // Not encrypted format, return as-is
        return text;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        this.encryptionKey,
        iv
      );
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.warn('Failed to decrypt configuration, returning as plaintext:', error);
      return text;
    }
  }

  public get<K extends keyof IConfig>(key: K): IConfig[K] {
    return this.config[key];
  }

  public getAll(): IConfig {
    return { ...this.config };
  }

  public async update<K extends keyof IConfig>(
    key: K,
    value: IConfig[K]
  ): Promise<void> {
    const oldValue = this.config[key];
    
    // Create temporary config for validation
    const tempConfig = { ...this.config };
    tempConfig[key] = value;
    
    // Validate the new configuration with timeout
    const validationTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Configuration validation timeout')), 5000);
    });
    
    try {
      const validationPromise = new Promise<void>((resolve, reject) => {
        try {
          const { error } = configSchema.validate(tempConfig, { abortEarly: true });
          if (error) {
            reject(new Error(`Configuration validation error: ${error.message}`));
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });
      
      await Promise.race([validationPromise, validationTimeout]);
    } catch (error) {
      throw error;
    }
    
    // Apply the change
    this.config[key] = value;
    
    // Persist the configuration with timeout
    try {
      await Promise.race([
        this.persistConfig(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Configuration persistence timeout')), 3000)
        )
      ]);
    } catch (error) {
      // Rollback on persistence failure
      this.config[key] = oldValue;
      throw new Error(`Failed to persist configuration: ${error.message}`);
    }
    
    // Emit update event
    this.emit('config.updated', {
      key,
      oldValue,
      newValue: value,
    } as ConfigUpdateEvent);
    
    console.log(`Configuration updated: ${key}`);
  }

  public async updateMultiple(
    updates: Partial<IConfig>
  ): Promise<void> {
    const oldValues: Partial<IConfig> = {};
    
    // Store old values and apply updates
    Object.keys(updates).forEach(key => {
      const configKey = key as keyof IConfig;
      (oldValues as any)[configKey] = this.config[configKey];
      (this.config as any)[key] = updates[configKey];
    });
    
    // Validate the new configuration
    const { error } = configSchema.validate(this.config);
    
    if (error) {
      // Rollback changes
      Object.keys(oldValues).forEach(key => {
        (this.config as any)[key] = oldValues[key as keyof IConfig];
      });
      
      throw new Error(`Configuration validation error: ${error.message}`);
    }
    
    // Persist the configuration
    await this.persistConfig();
    
    // Emit update events for each changed key
    Object.keys(updates).forEach(key => {
      this.emit('config.updated', {
        key,
        oldValue: oldValues[key as keyof IConfig],
        newValue: updates[key as keyof IConfig],
      } as ConfigUpdateEvent);
    });
    
    console.log(`Multiple configuration values updated`);
  }

  private async persistConfig(): Promise<void> {
    try {
      // Filter out sensitive environment-only variables
      const configToPersist = { ...this.config };
      delete (configToPersist as any).CONFIG_ENCRYPTION_KEY;
      delete (configToPersist as any).JWT_SECRET;
      
      const jsonConfig = JSON.stringify(configToPersist, null, 2);
      const encryptedConfig = this.encrypt(jsonConfig);
      
      fs.writeFileSync(this.configFilePath, encryptedConfig, 'utf8');
      
      console.log('Configuration persisted to disk');
    } catch (error) {
      console.error('Failed to persist configuration', error);
      throw error;
    }
  }

  public isOpenAIConfigured(): boolean {
    return !!this.config.OPENAI_API_KEY;
  }

  public getOpenAIConfig() {
    return {
      apiKey: this.config.OPENAI_API_KEY as string | undefined,
      model: this.config.OPENAI_MODEL,
      maxTokens: this.config.OPENAI_MAX_TOKENS,
      temperature: this.config.OPENAI_TEMPERATURE,
      timeout: this.config.OPENAI_TIMEOUT,
    };
  }

  public getSanitizedConfig(): Partial<IConfig> {
    const sanitized = { ...this.config };
    
    // Remove sensitive values
    if (sanitized.OPENAI_API_KEY) {
      sanitized.OPENAI_API_KEY = 'sk-***' + sanitized.OPENAI_API_KEY.slice(-4);
    }
    delete (sanitized as any).CONFIG_ENCRYPTION_KEY;
    delete (sanitized as any).JWT_SECRET;
    delete (sanitized as any).ADMIN_PASSWORD;
    
    return sanitized;
  }

  public destroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}