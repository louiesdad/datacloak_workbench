#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import { initializeSQLite, withSQLiteConnection } from './sqlite-refactored';
import { MigrationSystem } from './migration-system';

const program = new Command();

program
  .name('migrate')
  .description('Database migration CLI tool')
  .version('1.0.0');

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    try {
      await initializeSQLite();
      await withSQLiteConnection(async (db) => {
        const migrationsPath = path.join(__dirname, 'migrations');
        const migrationSystem = new MigrationSystem(db, migrationsPath);
        await migrationSystem.status();
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('up')
  .description('Run pending migrations')
  .option('-t, --target <version>', 'Target version to migrate to')
  .action(async (options) => {
    try {
      await initializeSQLite();
      await withSQLiteConnection(async (db) => {
        const migrationsPath = path.join(__dirname, 'migrations');
        const migrationSystem = new MigrationSystem(db, migrationsPath);
        
        const targetVersion = options.target ? parseInt(options.target, 10) : undefined;
        await migrationSystem.migrate(targetVersion);
        
        console.log('Migrations completed successfully');
      });
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('down')
  .description('Rollback migrations')
  .option('-t, --target <version>', 'Target version to rollback to', '0')
  .action(async (options) => {
    try {
      await initializeSQLite();
      await withSQLiteConnection(async (db) => {
        const migrationsPath = path.join(__dirname, 'migrations');
        const migrationSystem = new MigrationSystem(db, migrationsPath);
        
        const targetVersion = parseInt(options.target, 10);
        await migrationSystem.rollback(targetVersion);
        
        console.log('Rollback completed successfully');
      });
    } catch (error) {
      console.error('Rollback failed:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset all migrations (rollback to version 0)')
  .option('-f, --force', 'Force reset without confirmation')
  .action(async (options) => {
    if (!options.force) {
      const { default: inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'This will reset all migrations. Are you sure?',
          default: false
        }
      ]);
      
      if (!confirm) {
        console.log('Reset cancelled');
        return;
      }
    }
    
    try {
      await initializeSQLite();
      await withSQLiteConnection(async (db) => {
        const migrationsPath = path.join(__dirname, 'migrations');
        const migrationSystem = new MigrationSystem(db, migrationsPath);
        
        await migrationSystem.reset();
        console.log('Database reset completed');
      });
    } catch (error) {
      console.error('Reset failed:', error);
      process.exit(1);
    }
  });

program
  .command('create <name>')
  .description('Create a new migration file')
  .action(async (name) => {
    try {
      const fs = await import('fs');
      const migrationsPath = path.join(__dirname, 'migrations');
      
      if (!fs.existsSync(migrationsPath)) {
        fs.mkdirSync(migrationsPath, { recursive: true });
      }
      
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .map(f => parseInt(f.split('_')[0], 10))
        .filter(n => !isNaN(n));
      
      const nextVersion = files.length > 0 ? Math.max(...files) + 1 : 1;
      const paddedVersion = nextVersion.toString().padStart(3, '0');
      const filename = `${paddedVersion}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;
      const filepath = path.join(migrationsPath, filename);
      
      const template = `-- UP
-- Add your migration SQL here


-- DOWN
-- Add your rollback SQL here

`;
      
      fs.writeFileSync(filepath, template);
      console.log(`Created migration: ${filename}`);
    } catch (error) {
      console.error('Failed to create migration:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

export { program };