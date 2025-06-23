#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { program } from 'commander';
import * as inquirer from 'inquirer';
import { ConfigValidator } from '../src/config/config-validator';
import { configSchema } from '../src/config/config.schema';
import { productionConfigSchema } from '../src/config/production.config';

interface MigrationOptions {
  source: string;
  target: string;
  environment: string;
  dryRun: boolean;
  interactive: boolean;
  generateSecrets: boolean;
  backup: boolean;
}

interface ConfigMigration {
  version: string;
  changes: string[];
  timestamp: Date;
  backup?: string;
}

class ConfigMigrator {
  private migrations: ConfigMigration[] = [];

  constructor(private options: MigrationOptions) {}

  async migrate(): Promise<void> {
    console.log('🚀 Configuration Migration Tool');
    console.log('==============================\n');

    try {
      // Load source configuration
      const sourceConfig = await this.loadConfig(this.options.source);
      console.log(`✅ Loaded source configuration from: ${this.options.source}`);

      // Backup if requested
      if (this.options.backup && !this.options.dryRun) {
        const backupPath = await this.backupConfig(sourceConfig);
        console.log(`✅ Created backup at: ${backupPath}`);
      }

      // Analyze required changes
      const changes = await this.analyzeChanges(sourceConfig);
      console.log(`\n📊 Found ${changes.length} required changes`);

      if (changes.length === 0) {
        console.log('✨ Configuration is already up to date!');
        return;
      }

      // Show changes
      console.log('\n📝 Required changes:');
      changes.forEach((change, index) => {
        console.log(`   ${index + 1}. ${change.description}`);
      });

      // Apply changes
      let targetConfig = { ...sourceConfig };
      
      if (this.options.interactive) {
        targetConfig = await this.interactiveMigration(targetConfig, changes);
      } else {
        targetConfig = await this.automaticMigration(targetConfig, changes);
      }

      // Generate secure values if requested
      if (this.options.generateSecrets) {
        targetConfig = await this.generateSecureValues(targetConfig);
      }

      // Validate final configuration
      const validation = await ConfigValidator.validate(targetConfig, {
        environment: this.options.environment,
        strict: this.options.environment === 'production'
      });

      if (!validation.valid) {
        console.error('\n❌ Validation failed:');
        validation.errors?.forEach(error => console.error(`   - ${error}`));
        
        if (!this.options.interactive || !await this.confirmContinue()) {
          throw new Error('Configuration validation failed');
        }
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('\n⚠️  Warnings:');
        validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }

      // Save configuration
      if (!this.options.dryRun) {
        await this.saveConfig(targetConfig, this.options.target);
        console.log(`\n✅ Migrated configuration saved to: ${this.options.target}`);
        
        // Save migration record
        await this.saveMigrationRecord({
          version: this.getConfigVersion(targetConfig),
          changes: changes.map(c => c.description),
          timestamp: new Date()
        });
      } else {
        console.log('\n🔍 Dry run complete. No changes were saved.');
        console.log('\nMigrated configuration:');
        console.log(ConfigValidator.exportConfig(targetConfig, true));
      }

    } catch (error) {
      console.error(`\n❌ Migration failed: ${error.message}`);
      process.exit(1);
    }
  }

  private async loadConfig(filePath: string): Promise<any> {
    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
  }

  private async saveConfig(config: any, filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save with proper formatting
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  private async backupConfig(config: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve('config-backups');
    const backupPath = path.join(backupDir, `config-backup-${timestamp}.json`);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(backupPath, JSON.stringify(config, null, 2), 'utf8');
    return backupPath;
  }

  private async analyzeChanges(config: any): Promise<Array<{
    key: string;
    description: string;
    action: 'add' | 'update' | 'remove';
    value?: any;
  }>> {
    const changes = [];
    const schema = this.options.environment === 'production' 
      ? productionConfigSchema 
      : configSchema;

    // Get schema description
    const schemaDesc = schema.describe();
    const requiredKeys = new Set<string>();
    const schemaKeys = new Set<string>();

    // Extract keys from schema
    if (schemaDesc.keys) {
      Object.entries(schemaDesc.keys).forEach(([key, value]: [string, any]) => {
        schemaKeys.add(key);
        if (value.flags?.presence === 'required') {
          requiredKeys.add(key);
        }
      });
    }

    // Check for missing required keys
    for (const key of requiredKeys) {
      if (!(key in config)) {
        changes.push({
          key,
          description: `Add required field: ${key}`,
          action: 'add',
          value: this.getDefaultValue(key)
        });
      }
    }

    // Check for deprecated keys
    const deprecatedKeys = this.getDeprecatedKeys();
    for (const key in config) {
      if (deprecatedKeys.has(key)) {
        changes.push({
          key,
          description: `Remove deprecated field: ${key}`,
          action: 'remove'
        });
      }
    }

    // Environment-specific changes
    if (this.options.environment === 'production') {
      // Ensure production values
      if (config.NODE_ENV !== 'production') {
        changes.push({
          key: 'NODE_ENV',
          description: 'Update NODE_ENV to production',
          action: 'update',
          value: 'production'
        });
      }

      if (!config.REDIS_ENABLED) {
        changes.push({
          key: 'REDIS_ENABLED',
          description: 'Enable Redis for production',
          action: 'update',
          value: true
        });
      }

      if (config.ENABLE_HOT_RELOAD) {
        changes.push({
          key: 'ENABLE_HOT_RELOAD',
          description: 'Disable hot reload for production',
          action: 'update',
          value: false
        });
      }
    }

    return changes;
  }

  private async interactiveMigration(config: any, changes: any[]): Promise<any> {
    const result = { ...config };

    for (const change of changes) {
      console.log(`\n📋 ${change.description}`);
      
      if (change.action === 'add' || change.action === 'update') {
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'value',
          message: `Enter value for ${change.key}:`,
          default: change.value || this.getDefaultValue(change.key)
        }]);
        
        result[change.key] = this.parseValue(answer.value);
      } else if (change.action === 'remove') {
        const answer = await inquirer.prompt([{
          type: 'confirm',
          name: 'remove',
          message: `Remove ${change.key}?`,
          default: true
        }]);
        
        if (answer.remove) {
          delete result[change.key];
        }
      }
    }

    return result;
  }

  private async automaticMigration(config: any, changes: any[]): Promise<any> {
    const result = { ...config };

    for (const change of changes) {
      if (change.action === 'add' || change.action === 'update') {
        result[change.key] = change.value || this.getDefaultValue(change.key);
      } else if (change.action === 'remove') {
        delete result[change.key];
      }
    }

    return result;
  }

  private async generateSecureValues(config: any): Promise<any> {
    const result = { ...config };
    const secureValues = ConfigValidator.generateSecureValues();

    console.log('\n🔐 Generating secure values...');

    // Only generate if not already set or if using defaults
    if (!result.JWT_SECRET || result.JWT_SECRET === 'default-jwt-secret-change-in-production') {
      result.JWT_SECRET = secureValues.jwtSecret;
      console.log('   ✅ Generated JWT_SECRET');
    }

    if (!result.SESSION_SECRET) {
      result.SESSION_SECRET = secureValues.sessionSecret;
      console.log('   ✅ Generated SESSION_SECRET');
    }

    if (!result.CONFIG_ENCRYPTION_KEY) {
      result.CONFIG_ENCRYPTION_KEY = secureValues.encryptionKey;
      console.log('   ✅ Generated CONFIG_ENCRYPTION_KEY');
    }

    if (this.options.environment === 'production' && 
        (!result.ADMIN_PASSWORD || result.ADMIN_PASSWORD.length < 16)) {
      result.ADMIN_PASSWORD = secureValues.adminPassword;
      console.log('   ✅ Generated strong ADMIN_PASSWORD');
    }

    return result;
  }

  private getDefaultValue(key: string): any {
    const defaults: Record<string, any> = {
      PORT: 3001,
      NODE_ENV: this.options.environment,
      LOG_LEVEL: 'info',
      LOG_DIR: './logs',
      DB_PATH: './data/sqlite.db',
      DUCKDB_PATH: './data/duckdb.db',
      REDIS_ENABLED: false,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      CACHE_ENABLED: true,
      CACHE_TYPE: 'memory',
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      ADMIN_USERNAME: 'admin',
      CORS_ORIGINS: 'http://localhost:3000',
      ENABLE_HOT_RELOAD: this.options.environment !== 'production',
      ENABLE_CONFIG_API: this.options.environment !== 'production',
    };

    return defaults[key];
  }

  private getDeprecatedKeys(): Set<string> {
    return new Set([
      'OLD_CONFIG_KEY',
      'LEGACY_OPTION',
      'DEPRECATED_FEATURE'
    ]);
  }

  private parseValue(value: string): any {
    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // If not JSON, return as string
      return value;
    }
  }

  private getConfigVersion(config: any): string {
    // Simple version based on schema
    const keys = Object.keys(config).sort().join(',');
    return crypto.createHash('sha256').update(keys).digest('hex').substring(0, 8);
  }

  private async saveMigrationRecord(migration: ConfigMigration): Promise<void> {
    const migrationFile = path.resolve('config-migrations.json');
    
    try {
      const existing = fs.existsSync(migrationFile) 
        ? JSON.parse(fs.readFileSync(migrationFile, 'utf8'))
        : [];
      
      existing.push(migration);
      fs.writeFileSync(migrationFile, JSON.stringify(existing, null, 2), 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not save migration record: ${error.message}`);
    }
  }

  private async confirmContinue(): Promise<boolean> {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'continue',
      message: 'Continue anyway?',
      default: false
    }]);
    
    return answer.continue;
  }
}

// CLI setup
program
  .name('migrate-config')
  .description('Migrate configuration between environments and versions')
  .version('1.0.0');

program
  .option('-s, --source <path>', 'Source configuration file', './config.json')
  .option('-t, --target <path>', 'Target configuration file', './config.json')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .option('-d, --dry-run', 'Show what would be changed without saving')
  .option('-i, --interactive', 'Interactive mode for reviewing changes')
  .option('-g, --generate-secrets', 'Generate secure values for secrets')
  .option('-b, --backup', 'Create backup before migration')
  .parse(process.argv);

const options = program.opts() as MigrationOptions;

// Run migration
const migrator = new ConfigMigrator(options);
migrator.migrate().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});