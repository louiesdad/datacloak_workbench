/**
 * Configuration Factory
 * 
 * Generates test configuration data for testing configuration management,
 * environment settings, and service configuration scenarios.
 */

import { AbstractFactory, testRandom } from './base.factory';

export interface TestConfig {
  id: string;
  name: string;
  environment: 'development' | 'staging' | 'production' | 'test';
  settings: {
    database: {
      host: string;
      port: number;
      name: string;
      ssl: boolean;
      poolSize: number;
    };
    cache: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
      type: 'memory' | 'redis';
    };
    api: {
      port: number;
      timeout: number;
      rateLimit: {
        enabled: boolean;
        requests: number;
        window: number;
      };
    };
    sentiment: {
      provider: 'openai' | 'local' | 'mock';
      batchSize: number;
      confidence: number;
      languages: string[];
    };
    datacloak: {
      enabled: boolean;
      piiTypes: string[];
      maskingMode: 'redact' | 'replace' | 'encrypt';
      confidence: number;
    };
    logging: {
      level: 'debug' | 'info' | 'warn' | 'error';
      format: 'json' | 'text';
      targets: string[];
    };
  };
  features: {
    realtime: boolean;
    exports: boolean;
    analytics: boolean;
    multiUser: boolean;
    apiAccess: boolean;
  };
  metadata: {
    version: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
  };
}

export interface TestEnvironmentConfig {
  NODE_ENV: string;
  PORT: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  LOG_LEVEL: string;
  OPENAI_API_KEY?: string;
  SECRET_KEY: string;
  CORS_ORIGINS: string;
}

export class ConfigFactory extends AbstractFactory<TestConfig> {
  build(overrides?: Partial<TestConfig>): TestConfig {
    const environment = testRandom.choice(['development', 'staging', 'production', 'test'] as const);
    const name = `${environment}_config_${this.sequence()}`;

    const base: TestConfig = {
      id: this.generateUuid(),
      name,
      environment,
      settings: {
        database: {
          host: environment === 'test' ? 'localhost' : `db-${environment}.example.com`,
          port: environment === 'test' ? 5433 : 5432,
          name: `app_${environment}`,
          ssl: environment === 'production',
          poolSize: environment === 'production' ? 20 : 10
        },
        cache: {
          enabled: environment !== 'test',
          ttl: testRandom.integer(300, 3600), // 5 minutes to 1 hour
          maxSize: testRandom.integer(100, 1000),
          type: environment === 'production' ? 'redis' : 'memory'
        },
        api: {
          port: environment === 'test' ? 0 : testRandom.integer(3000, 4000),
          timeout: testRandom.integer(5000, 30000),
          rateLimit: {
            enabled: environment === 'production',
            requests: testRandom.integer(100, 1000),
            window: testRandom.integer(60, 300) // 1-5 minutes
          }
        },
        sentiment: {
          provider: environment === 'test' ? 'mock' : testRandom.choice(['openai', 'local']),
          batchSize: testRandom.integer(10, 100),
          confidence: testRandom.float(0.6, 0.9),
          languages: ['en', 'es', 'fr']
        },
        datacloak: {
          enabled: environment !== 'development',
          piiTypes: ['email', 'phone', 'ssn', 'credit_card', 'name', 'address'],
          maskingMode: testRandom.choice(['redact', 'replace', 'encrypt']),
          confidence: testRandom.float(0.7, 0.9)
        },
        logging: {
          level: environment === 'production' ? 'info' : 'debug',
          format: environment === 'production' ? 'json' : 'text',
          targets: environment === 'production' ? ['file', 'console'] : ['console']
        }
      },
      features: {
        realtime: environment !== 'test',
        exports: true,
        analytics: environment === 'production',
        multiUser: environment !== 'development',
        apiAccess: true
      },
      metadata: {
        version: `1.${testRandom.integer(0, 9)}.${testRandom.integer(0, 9)}`,
        createdAt: this.generateTimestamp(testRandom.integer(0, 30)),
        updatedAt: this.generateTimestamp(testRandom.integer(0, 7)),
        createdBy: `admin_${this.sequence()}`
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Create development configuration
   */
  createDevelopment(overrides?: Partial<TestConfig>): TestConfig {
    return this.create({
      environment: 'development',
      name: `development_config_${this.sequence()}`,
      settings: {
        ...this.create().settings,
        database: {
          host: 'localhost',
          port: 5432,
          name: 'app_development',
          ssl: false,
          poolSize: 5
        },
        cache: {
          enabled: false,
          ttl: 300,
          maxSize: 100,
          type: 'memory'
        },
        logging: {
          level: 'debug',
          format: 'text',
          targets: ['console']
        }
      },
      features: {
        realtime: false,
        exports: true,
        analytics: false,
        multiUser: false,
        apiAccess: true
      },
      ...overrides
    });
  }

  /**
   * Create production configuration
   */
  createProduction(overrides?: Partial<TestConfig>): TestConfig {
    return this.create({
      environment: 'production',
      name: `production_config_${this.sequence()}`,
      settings: {
        ...this.create().settings,
        database: {
          host: 'db-prod.example.com',
          port: 5432,
          name: 'app_production',
          ssl: true,
          poolSize: 20
        },
        cache: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
          type: 'redis'
        },
        api: {
          port: 3000,
          timeout: 30000,
          rateLimit: {
            enabled: true,
            requests: 1000,
            window: 300
          }
        },
        logging: {
          level: 'info',
          format: 'json',
          targets: ['file', 'console']
        }
      },
      features: {
        realtime: true,
        exports: true,
        analytics: true,
        multiUser: true,
        apiAccess: true
      },
      ...overrides
    });
  }

  /**
   * Create test configuration
   */
  createTest(overrides?: Partial<TestConfig>): TestConfig {
    return this.create({
      environment: 'test',
      name: `test_config_${this.sequence()}`,
      settings: {
        ...this.create().settings,
        database: {
          host: 'localhost',
          port: 5433,
          name: ':memory:',
          ssl: false,
          poolSize: 1
        },
        cache: {
          enabled: false,
          ttl: 60,
          maxSize: 50,
          type: 'memory'
        },
        api: {
          port: 0, // Random port
          timeout: 5000,
          rateLimit: {
            enabled: false,
            requests: 0,
            window: 0
          }
        },
        sentiment: {
          provider: 'mock',
          batchSize: 10,
          confidence: 0.8,
          languages: ['en']
        },
        logging: {
          level: 'warn',
          format: 'text',
          targets: ['console']
        }
      },
      features: {
        realtime: false,
        exports: true,
        analytics: false,
        multiUser: false,
        apiAccess: true
      },
      ...overrides
    });
  }

  /**
   * Create environment variables configuration
   */
  createEnvironmentConfig(environment: string = 'test'): TestEnvironmentConfig {
    const basePort = environment === 'test' ? '0' : '3000';
    const dbUrl = environment === 'test' 
      ? 'sqlite::memory:'
      : `postgresql://user:pass@localhost:5432/app_${environment}`;

    return {
      NODE_ENV: environment,
      PORT: basePort,
      DATABASE_URL: dbUrl,
      REDIS_URL: environment === 'production' ? 'redis://localhost:6379' : undefined,
      LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
      OPENAI_API_KEY: environment !== 'test' ? `sk-test-${testRandom.string(32)}` : undefined,
      SECRET_KEY: testRandom.string(64),
      CORS_ORIGINS: environment === 'production' ? 'https://app.example.com' : '*'
    };
  }

  /**
   * Create configuration with disabled features
   */
  createMinimal(overrides?: Partial<TestConfig>): TestConfig {
    return this.create({
      settings: {
        ...this.create().settings,
        cache: {
          enabled: false,
          ttl: 0,
          maxSize: 0,
          type: 'memory'
        },
        api: {
          port: 3000,
          timeout: 5000,
          rateLimit: {
            enabled: false,
            requests: 0,
            window: 0
          }
        },
        sentiment: {
          provider: 'mock',
          batchSize: 1,
          confidence: 0.5,
          languages: ['en']
        },
        datacloak: {
          enabled: false,
          piiTypes: [],
          maskingMode: 'redact',
          confidence: 0.5
        }
      },
      features: {
        realtime: false,
        exports: false,
        analytics: false,
        multiUser: false,
        apiAccess: true
      },
      ...overrides
    });
  }

  /**
   * Create configuration with all features enabled
   */
  createFullyFeatured(overrides?: Partial<TestConfig>): TestConfig {
    return this.create({
      settings: {
        ...this.create().settings,
        cache: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
          type: 'redis'
        },
        sentiment: {
          provider: 'openai',
          batchSize: 100,
          confidence: 0.9,
          languages: ['en', 'es', 'fr', 'de', 'it', 'pt']
        },
        datacloak: {
          enabled: true,
          piiTypes: ['email', 'phone', 'ssn', 'credit_card', 'name', 'address', 'ip_address', 'passport'],
          maskingMode: 'encrypt',
          confidence: 0.9
        }
      },
      features: {
        realtime: true,
        exports: true,
        analytics: true,
        multiUser: true,
        apiAccess: true
      },
      ...overrides
    });
  }

  /**
   * Apply environment variables to process.env
   */
  applyEnvironmentConfig(envConfig: TestEnvironmentConfig): void {
    Object.entries(envConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }

  /**
   * Clean up environment variables
   */
  cleanupEnvironmentConfig(envConfig: TestEnvironmentConfig): void {
    Object.keys(envConfig).forEach(key => {
      delete process.env[key];
    });
  }
}

// Export factory instance
export const configFactory = new ConfigFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('config', configFactory);