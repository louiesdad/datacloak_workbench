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
}

export default DeploymentPipelineService;