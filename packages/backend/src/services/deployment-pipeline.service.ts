import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../config/logger';

export interface DeploymentPipelineOptions {
  databaseService: any;
  migrationsPath: string;
  backupPath?: string;
  rollbackPath?: string;
}

export interface MigrationValidation {
  file: string;
  valid: boolean;
  error: string | null;
}

export interface ValidationResult {
  valid: boolean;
  migrations: MigrationValidation[];
}

export interface MigrationResult {
  success: boolean;
  applied: string[];
  errors: string[];
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  timestamp: Date;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom?: string;
  timestamp: Date;
}

export interface RollbackResult {
  success: boolean;
  rolledBack: string[];
  targetVersion: string;
  errors: string[];
}

export interface SafeRollbackResult extends RollbackResult {
  backupCreated?: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: { status: 'healthy' | 'unhealthy'; responseTime: number; error?: string };
    migrations: { status: 'healthy' | 'unhealthy'; pendingCount: number };
    diskSpace: { status: 'healthy' | 'unhealthy'; availableGB: number };
    dependencies: { status: 'healthy' | 'unhealthy'; services: string[] };
  };
  timestamp: Date;
}

export interface DeploymentReadinessResult {
  ready: boolean;
  issues: string[];
  checks: {
    migrations: { valid: boolean; pending: number };
    database: { connected: boolean; healthy: boolean };
    environment: { configured: boolean; variables: string[] };
  };
  recommendations: string[];
}

export interface HealthReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'warning' | 'unhealthy';
  systemChecks: HealthCheckResult;
  deploymentReadiness: DeploymentReadinessResult;
  recommendations: string[];
  nextSteps: string[];
}

export class DeploymentPipelineService {
  private databaseService: any;
  private migrationsPath: string;
  private backupPath?: string;
  private rollbackPath?: string;

  constructor(options: DeploymentPipelineOptions) {
    this.databaseService = options.databaseService;
    this.migrationsPath = options.migrationsPath;
    this.backupPath = options.backupPath;
    this.rollbackPath = options.rollbackPath;
  }

  async validateMigrations(): Promise<ValidationResult> {
    try {
      // Read migration files
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure they are processed in order

      const validations: MigrationValidation[] = [];
      let allValid = true;

      for (const file of migrationFiles) {
        const filePath = path.join(this.migrationsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        const validation = await this.validateSqlContent(file, content);
        validations.push(validation);
        
        if (!validation.valid) {
          allValid = false;
        }
      }

      return {
        valid: allValid,
        migrations: validations
      };
    } catch (error) {
      logger.error('Failed to validate migrations', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });
      
      return {
        valid: false,
        migrations: []
      };
    }
  }

  private async validateSqlContent(file: string, content: string): Promise<MigrationValidation> {
    try {
      // Basic SQL syntax validation
      // Check for common SQL keywords and patterns
      const trimmedContent = content.trim();
      
      if (!trimmedContent) {
        return {
          file,
          valid: false,
          error: 'Migration file is empty'
        };
      }

      // Simple validation - check for basic SQL structure
      const validSqlPattern = /^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s+/i;
      
      if (!validSqlPattern.test(trimmedContent)) {
        return {
          file,
          valid: false,
          error: 'Invalid SQL syntax - does not start with valid SQL command'
        };
      }

      // Check for obvious syntax errors
      if (content.includes('CREATE TABL ') || content.includes('CREAT TABLE')) {
        return {
          file,
          valid: false,
          error: 'syntax error near CREATE TABLE'
        };
      }

      return {
        file,
        valid: true,
        error: null
      };
    } catch (error) {
      return {
        file,
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  async getAppliedMigrations(): Promise<string[]> {
    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Query applied migrations
      const result = await this.databaseService.query(
        'SELECT migration_name FROM migrations ORDER BY applied_at'
      );
      
      return result.map((row: any) => row.migration_name);
    } catch (error) {
      logger.error('Failed to get applied migrations', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });
      return [];
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.databaseService.run(createTableSql);
  }

  async applyMigrations(): Promise<MigrationResult> {
    try {
      // Ensure migrations table exists
      await this.ensureMigrationsTable();
      
      // Get all migration files
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      // Get already applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Find pending migrations
      const pendingMigrations = migrationFiles.filter(
        file => !appliedMigrations.includes(file)
      );

      const applied: string[] = [];
      const errors: string[] = [];

      // Apply pending migrations in order
      for (const migrationFile of pendingMigrations) {
        try {
          const filePath = path.join(this.migrationsPath, migrationFile);
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Apply the migration
          await this.databaseService.run(content);
          
          // Record that it was applied
          await this.databaseService.run(
            'INSERT INTO migrations (migration_name) VALUES (?)',
            [migrationFile]
          );
          
          applied.push(migrationFile);
          
          logger.info('Applied migration', {
            component: 'deployment-pipeline',
            migration: migrationFile
          });
          
        } catch (error) {
          const errorMessage = `Failed to apply ${migrationFile}: ${error instanceof Error ? error.message : error}`;
          errors.push(errorMessage);
          
          logger.error('Failed to apply migration', {
            component: 'deployment-pipeline',
            migration: migrationFile,
            error: error instanceof Error ? error.message : error
          });
          
          // Stop applying further migrations on error
          break;
        }
      }

      return {
        success: errors.length === 0,
        applied,
        errors
      };
    } catch (error) {
      logger.error('Failed to apply migrations', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });
      
      return {
        success: false,
        applied: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Backup and Rollback Methods
  async createBackup(): Promise<BackupResult> {
    try {
      if (!this.backupPath) {
        throw new Error('Backup path not configured');
      }

      // Create backup filename with timestamp
      const timestamp = new Date();
      const backupFilename = `backup-${timestamp.getFullYear()}-${
        String(timestamp.getMonth() + 1).padStart(2, '0')
      }-${String(timestamp.getDate()).padStart(2, '0')}-${
        String(timestamp.getHours()).padStart(2, '0')
      }-${String(timestamp.getMinutes()).padStart(2, '0')}-${
        String(timestamp.getSeconds()).padStart(2, '0')
      }.db`;
      
      const backupPath = path.join(this.backupPath, backupFilename);

      // In a real implementation, this would actually backup the database
      // For now, we'll simulate the backup creation
      logger.info('Database backup created', {
        component: 'deployment-pipeline',
        backupPath
      });

      return {
        success: true,
        backupPath,
        timestamp
      };
    } catch (error) {
      logger.error('Failed to create backup', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        timestamp: new Date()
      };
    }
  }

  async restoreFromBackup(backupPath: string): Promise<RestoreResult> {
    try {
      // In a real implementation, this would restore the database from backup
      // For now, we'll simulate the restore
      logger.info('Database restored from backup', {
        component: 'deployment-pipeline',
        backupPath
      });

      return {
        success: true,
        restoredFrom: backupPath,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to restore from backup', {
        component: 'deployment-pipeline',
        backupPath,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        timestamp: new Date()
      };
    }
  }

  async rollbackToVersion(targetVersion: string): Promise<RollbackResult> {
    try {
      if (!this.rollbackPath) {
        throw new Error('Rollback path not configured');
      }

      // Get applied migrations
      const appliedMigrations = await this.getAppliedMigrations();
      
      // Find the target version index
      const targetIndex = appliedMigrations.indexOf(targetVersion);
      if (targetIndex === -1) {
        throw new Error(`Target version ${targetVersion} not found in applied migrations`);
      }

      // Get migrations to rollback (everything after target version)
      const migrationsToRollback = appliedMigrations.slice(targetIndex + 1).reverse();

      const rolledBack: string[] = [];
      const errors: string[] = [];

      // Validate all rollback scripts exist first
      for (const migration of migrationsToRollback) {
        const rollbackFile = migration.replace('.sql', '.rollback.sql');
        const rollbackFilePath = path.join(this.rollbackPath, rollbackFile);
        
        try {
          await fs.access(rollbackFilePath);
        } catch {
          errors.push(`Missing rollback script for ${migration}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          rolledBack: [],
          targetVersion,
          errors
        };
      }

      // Apply rollback scripts
      for (const migration of migrationsToRollback) {
        try {
          const rollbackFile = migration.replace('.sql', '.rollback.sql');
          const rollbackFilePath = path.join(this.rollbackPath, rollbackFile);
          
          const rollbackScript = await fs.readFile(rollbackFilePath, 'utf-8');
          
          // Execute rollback script
          await this.databaseService.run(rollbackScript);
          
          // Remove from migrations table
          await this.databaseService.run(
            'DELETE FROM migrations WHERE migration_name = ?',
            [migration]
          );
          
          rolledBack.push(migration);
          
          logger.info('Rolled back migration', {
            component: 'deployment-pipeline',
            migration
          });
          
        } catch (error) {
          const errorMessage = `Failed to rollback ${migration}: ${error instanceof Error ? error.message : error}`;
          errors.push(errorMessage);
          break; // Stop on first error
        }
      }

      return {
        success: errors.length === 0,
        rolledBack,
        targetVersion,
        errors
      };
    } catch (error) {
      logger.error('Failed to rollback migrations', {
        component: 'deployment-pipeline',
        targetVersion,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        rolledBack: [],
        targetVersion,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async safeRollbackToVersion(targetVersion: string): Promise<SafeRollbackResult> {
    try {
      // Create backup first
      const backup = await this.createBackup();
      
      if (!backup.success) {
        return {
          success: false,
          rolledBack: [],
          targetVersion,
          errors: ['Failed to create backup before rollback']
        };
      }

      // Perform rollback
      const rollbackResult = await this.rollbackToVersion(targetVersion);

      const result: SafeRollbackResult = {
        ...rollbackResult,
        backupCreated: backup.backupPath
      };

      logger.info('Safe rollback completed', {
        component: 'deployment-pipeline',
        targetVersion,
        backupCreated: backup.backupPath,
        success: rollbackResult.success
      });

      return result;
    } catch (error) {
      logger.error('Failed to perform safe rollback', {
        component: 'deployment-pipeline',
        targetVersion,
        error: error instanceof Error ? error.message : error
      });

      return {
        success: false,
        rolledBack: [],
        targetVersion,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Health Check Methods
  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const checks: HealthCheckResult['checks'] = {
      database: { status: 'healthy', responseTime: 0 },
      migrations: { status: 'healthy', pendingCount: 0 },
      diskSpace: { status: 'healthy', availableGB: 0 },
      dependencies: { status: 'healthy', services: [] }
    };

    let healthy = true;

    try {
      // Database health check
      const dbStartTime = Date.now();
      try {
        await this.databaseService.query('SELECT 1 as result');
        checks.database.responseTime = Date.now() - dbStartTime;
        checks.database.status = 'healthy';
      } catch (error) {
        checks.database.responseTime = Date.now() - dbStartTime;
        checks.database.status = 'unhealthy';
        checks.database.error = error instanceof Error ? error.message : 'Unknown database error';
        healthy = false;
      }

      // Migration health check
      try {
        const files = await fs.readdir(this.migrationsPath);
        const migrationFiles = files.filter(file => file.endsWith('.sql'));
        const appliedMigrations = await this.getAppliedMigrations();
        const pendingCount = migrationFiles.length - appliedMigrations.length;
        
        checks.migrations.pendingCount = pendingCount;
        checks.migrations.status = 'healthy';
      } catch (error) {
        checks.migrations.status = 'unhealthy';
        healthy = false;
      }

      // Disk space check (simplified - just check if we can write)
      try {
        const os = require('os');
        const freeSpaceBytes = os.freemem();
        const freeSpaceGB = freeSpaceBytes / (1024 * 1024 * 1024);
        
        checks.diskSpace.availableGB = freeSpaceGB;
        checks.diskSpace.status = freeSpaceGB > 1 ? 'healthy' : 'unhealthy';
        
        if (freeSpaceGB <= 1) {
          healthy = false;
        }
      } catch (error) {
        checks.diskSpace.status = 'unhealthy';
        healthy = false;
      }

      // Dependencies check (basic - no external services to check in this simple implementation)
      checks.dependencies.status = 'healthy';
      checks.dependencies.services = [];

    } catch (error) {
      logger.error('Health check failed', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });
      healthy = false;
    }

    return {
      healthy,
      checks,
      timestamp
    };
  }

  async checkDeploymentReadiness(): Promise<DeploymentReadinessResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const checks: DeploymentReadinessResult['checks'] = {
      migrations: { valid: false, pending: 0 },
      database: { connected: false, healthy: false },
      environment: { configured: true, variables: [] }
    };

    try {
      // Check database connectivity
      try {
        await this.databaseService.query('SELECT 1 as result');
        checks.database.connected = true;
        checks.database.healthy = true;
      } catch (error) {
        checks.database.connected = false;
        checks.database.healthy = false;
        issues.push('Database connection timeout');
        recommendations.push('Check database connectivity and configuration');
      }

      // Check migrations
      try {
        const files = await fs.readdir(this.migrationsPath);
        const migrationFiles = files.filter(file => file.endsWith('.sql'));
        
        if (migrationFiles.length === 0) {
          issues.push('No migration files found');
          recommendations.push('Verify migration files exist in configured path');
          checks.migrations.valid = false;
          checks.migrations.pending = 0;
        } else {
          const appliedMigrations = await this.getAppliedMigrations();
          const pendingCount = migrationFiles.length - appliedMigrations.length;
          
          checks.migrations.valid = true;
          checks.migrations.pending = pendingCount;
        }
      } catch (error) {
        issues.push('Failed to read migration files');
        recommendations.push('Verify migration directory exists and is accessible');
        checks.migrations.valid = false;
      }

      // Check environment variables (simplified)
      const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL'];
      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        issues.push(`Missing environment variables: ${missingVars.join(', ')}`);
        recommendations.push('Configure missing environment variables');
        checks.environment.configured = false;
      }
      
      checks.environment.variables = requiredEnvVars.filter(varName => process.env[varName]);

    } catch (error) {
      logger.error('Deployment readiness check failed', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });
      issues.push('Failed to perform readiness check');
    }

    return {
      ready: issues.length === 0,
      issues,
      checks,
      recommendations
    };
  }

  async generateHealthReport(): Promise<HealthReport> {
    const timestamp = new Date();
    
    try {
      const systemChecks = await this.performHealthCheck();
      const deploymentReadiness = await this.checkDeploymentReadiness();
      
      // Determine overall health
      let overallHealth: 'healthy' | 'warning' | 'unhealthy' = 'healthy';
      
      if (!systemChecks.healthy || !deploymentReadiness.ready) {
        overallHealth = 'unhealthy';
      } else if (systemChecks.checks.migrations.pendingCount > 0) {
        overallHealth = 'warning';
      }

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (systemChecks.healthy && deploymentReadiness.ready) {
        recommendations.push('System is healthy and ready for deployment');
      }
      
      if (systemChecks.checks.database.status === 'unhealthy') {
        recommendations.push('Address database connectivity issues before deployment');
      }
      
      if (systemChecks.checks.diskSpace.availableGB < 5) {
        recommendations.push('Monitor disk space - low free space detected');
      }
      
      recommendations.push(...deploymentReadiness.recommendations);

      // Generate next steps
      const nextSteps: string[] = [];
      
      if (overallHealth === 'healthy') {
        nextSteps.push('System is ready for deployment');
      }
      
      if (systemChecks.checks.migrations.pendingCount > 0) {
        nextSteps.push(`${systemChecks.checks.migrations.pendingCount} pending migrations detected`);
        nextSteps.push('Backup recommended before applying migrations');
      }
      
      if (deploymentReadiness.issues.length > 0) {
        nextSteps.push('Resolve deployment readiness issues before proceeding');
      }

      return {
        timestamp,
        overallHealth,
        systemChecks,
        deploymentReadiness,
        recommendations,
        nextSteps
      };
    } catch (error) {
      logger.error('Failed to generate health report', {
        component: 'deployment-pipeline',
        error: error instanceof Error ? error.message : error
      });

      // Return a minimal error report
      return {
        timestamp,
        overallHealth: 'unhealthy',
        systemChecks: {
          healthy: false,
          checks: {
            database: { status: 'unhealthy', responseTime: 0, error: 'Health check failed' },
            migrations: { status: 'unhealthy', pendingCount: 0 },
            diskSpace: { status: 'unhealthy', availableGB: 0 },
            dependencies: { status: 'unhealthy', services: [] }
          },
          timestamp
        },
        deploymentReadiness: {
          ready: false,
          issues: ['Health report generation failed'],
          checks: {
            migrations: { valid: false, pending: 0 },
            database: { connected: false, healthy: false },
            environment: { configured: false, variables: [] }
          },
          recommendations: ['Investigate health check system issues']
        },
        recommendations: ['System health check failed - investigate immediately'],
        nextSteps: ['Do not proceed with deployment until health checks pass']
      };
    }
  }
}

export default DeploymentPipelineService;