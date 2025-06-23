import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '../config/logger';

export interface DeploymentPipelineOptions {
  databaseService: any;
  migrationsPath: string;
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

export class DeploymentPipelineService {
  private databaseService: any;
  private migrationsPath: string;

  constructor(options: DeploymentPipelineOptions) {
    this.databaseService = options.databaseService;
    this.migrationsPath = options.migrationsPath;
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
}

export default DeploymentPipelineService;