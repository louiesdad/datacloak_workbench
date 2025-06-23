import { IConfig } from '../config.schema';
import { IProductionConfig } from '../production.config';
import { developmentConfig } from './development';
import { productionConfig } from './production';
import { testConfig } from './test';
import { stagingConfig } from './staging';

export type Environment = 'development' | 'test' | 'staging' | 'production';

export interface EnvironmentConfig {
  name: Environment;
  defaults: Partial<IConfig | IProductionConfig>;
  required: string[];
  forbidden?: string[];
  overrides?: Record<string, any>;
  validators?: Array<(config: any) => { valid: boolean; error?: string }>;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(env?: string): EnvironmentConfig {
  const environment = (env || process.env.NODE_ENV || 'development').toLowerCase() as Environment;
  
  switch (environment) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Apply environment-specific configuration
 */
export function applyEnvironmentConfig(
  baseConfig: any,
  environment?: string
): IConfig | IProductionConfig {
  const envConfig = getEnvironmentConfig(environment);
  
  // Start with environment defaults
  let config = { ...envConfig.defaults };
  
  // Merge with base configuration (base config takes precedence)
  Object.keys(baseConfig).forEach(key => {
    if (baseConfig[key] !== undefined && baseConfig[key] !== null) {
      config[key] = baseConfig[key];
    }
  });
  
  // Apply environment-specific overrides (these take final precedence)
  if (envConfig.overrides) {
    Object.keys(envConfig.overrides).forEach(key => {
      config[key] = envConfig.overrides![key];
    });
  }
  
  // Ensure required fields are present
  for (const field of envConfig.required) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(`Required field '${field}' missing for ${envConfig.name} environment`);
    }
  }
  
  // Remove forbidden fields
  if (envConfig.forbidden) {
    for (const field of envConfig.forbidden) {
      delete config[field];
    }
  }
  
  // Run custom validators
  if (envConfig.validators) {
    for (const validator of envConfig.validators) {
      const result = validator(config);
      if (!result.valid) {
        throw new Error(`Environment validation failed: ${result.error}`);
      }
    }
  }
  
  return config as IConfig | IProductionConfig;
}

/**
 * Configuration inheritance hierarchy
 * Base -> Environment Defaults -> User Config -> Environment Overrides
 */
export class ConfigurationHierarchy {
  private layers: Map<string, any> = new Map();
  
  constructor(private environment: Environment) {
    this.initializeLayers();
  }
  
  private initializeLayers(): void {
    // Layer 1: Base defaults from schema
    this.layers.set('base', this.getBaseDefaults());
    
    // Layer 2: Environment-specific defaults
    const envConfig = getEnvironmentConfig(this.environment);
    this.layers.set('environment', envConfig.defaults);
    
    // Layer 3: User configuration (set later)
    this.layers.set('user', {});
    
    // Layer 4: Environment overrides
    this.layers.set('overrides', envConfig.overrides || {});
  }
  
  private getBaseDefaults(): any {
    // Extract defaults from schema
    return {
      PORT: 3001,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      DB_PATH: './data/sqlite.db',
      DUCKDB_PATH: './data/duckdb.db',
      OPENAI_MODEL: 'gpt-3.5-turbo',
      OPENAI_MAX_TOKENS: 150,
      OPENAI_TEMPERATURE: 0.1,
      OPENAI_TIMEOUT: 30000,
      JWT_SECRET: 'default-jwt-secret-change-in-production',
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      ADMIN_USERNAME: 'admin',
      REDIS_ENABLED: false,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      REDIS_KEY_PREFIX: 'dsw:',
      JOB_QUEUE_MAX_CONCURRENT: 3,
      JOB_QUEUE_RETRY_ATTEMPTS: 3,
      JOB_QUEUE_RETRY_DELAY: 5000,
      JOB_QUEUE_ENABLE_DEAD_LETTER: true,
      CACHE_ENABLED: true,
      CACHE_TYPE: 'memory',
      CACHE_DEFAULT_TTL: 3600,
      CACHE_MAX_MEMORY: 100 * 1024 * 1024,
      CACHE_COMPRESSION_THRESHOLD: 1024,
      ENABLE_HOT_RELOAD: true,
      ENABLE_CONFIG_API: true,
    };
  }
  
  public setUserConfig(config: any): void {
    this.layers.set('user', config);
  }
  
  public resolve(): any {
    const result: any = {};
    
    // Apply layers in order
    for (const [name, layer] of this.layers) {
      Object.keys(layer).forEach(key => {
        if (layer[key] !== undefined && layer[key] !== null) {
          result[key] = layer[key];
        }
      });
    }
    
    return result;
  }
  
  public explain(key: string): { value: any; source: string } | null {
    // Walk layers in reverse order to find where value comes from
    const layerOrder = ['overrides', 'user', 'environment', 'base'];
    
    for (const layerName of layerOrder) {
      const layer = this.layers.get(layerName);
      if (layer && layer[key] !== undefined && layer[key] !== null) {
        return {
          value: layer[key],
          source: layerName
        };
      }
    }
    
    return null;
  }
  
  public getLayer(name: string): any {
    return { ...this.layers.get(name) };
  }
  
  public getLayers(): string[] {
    return Array.from(this.layers.keys());
  }
}

/**
 * Environment detection utilities
 */
export class EnvironmentDetector {
  static detect(): Environment {
    // Check NODE_ENV first
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    if (nodeEnv && ['development', 'test', 'staging', 'production'].includes(nodeEnv)) {
      return nodeEnv as Environment;
    }
    
    // Check for CI/CD environment variables
    if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
      return 'test';
    }
    
    // Check for cloud provider indicators
    if (process.env.DYNO || process.env.HEROKU_APP_NAME) {
      return 'production'; // Heroku
    }
    
    if (process.env.WEBSITE_INSTANCE_ID || process.env.WEBSITE_HOSTNAME) {
      return 'production'; // Azure
    }
    
    if (process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV) {
      return 'production'; // AWS Lambda
    }
    
    if (process.env.K_SERVICE || process.env.K_REVISION) {
      return 'production'; // Google Cloud Run
    }
    
    // Check for Docker
    if (process.env.DOCKER_CONTAINER) {
      const dockerEnv = process.env.DOCKER_ENV;
      const validEnvironments: Environment[] = ['development', 'test', 'staging', 'production'];
      return (dockerEnv && validEnvironments.includes(dockerEnv as Environment)) 
        ? dockerEnv as Environment 
        : 'production';
    }
    
    // Default to development
    return 'development';
  }
  
  static isProduction(): boolean {
    return this.detect() === 'production';
  }
  
  static isDevelopment(): boolean {
    return this.detect() === 'development';
  }
  
  static isTest(): boolean {
    return this.detect() === 'test';
  }
  
  static isStaging(): boolean {
    return this.detect() === 'staging';
  }
}