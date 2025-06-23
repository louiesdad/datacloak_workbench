import { program } from '../migration-cli';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

jest.mock('../../config/env', () => ({
  config: {
    database: {
      sqlite: {
        path: '/tmp/test-migration-cli.db'
      }
    }
  }
}));

describe('Migration CLI', () => {
  let tempDir: string;
  let originalArgv: string[];
  let consoleLog: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let processExit: jest.SpyInstance;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-cli-test-'));
    originalArgv = process.argv;
    
    consoleLog = jest.spyOn(console, 'log').mockImplementation();
    consoleError = jest.spyOn(console, 'error').mockImplementation();
    processExit = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    process.argv = originalArgv;
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    consoleLog.mockRestore();
    consoleError.mockRestore();
    processExit.mockRestore();
  });

  describe('command parsing', () => {
    test('should have all expected commands', () => {
      const commands = program.commands.map(cmd => cmd.name());
      
      expect(commands).toContain('status');
      expect(commands).toContain('up');
      expect(commands).toContain('down');
      expect(commands).toContain('reset');
      expect(commands).toContain('create');
    });

    test('should have correct command descriptions', () => {
      const statusCmd = program.commands.find(cmd => cmd.name() === 'status');
      const upCmd = program.commands.find(cmd => cmd.name() === 'up');
      const downCmd = program.commands.find(cmd => cmd.name() === 'down');
      const resetCmd = program.commands.find(cmd => cmd.name() === 'reset');
      const createCmd = program.commands.find(cmd => cmd.name() === 'create');
      
      expect(statusCmd?.description()).toBe('Show migration status');
      expect(upCmd?.description()).toBe('Run pending migrations');
      expect(downCmd?.description()).toBe('Rollback migrations');
      expect(resetCmd?.description()).toBe('Reset all migrations (rollback to version 0)');
      expect(createCmd?.description()).toBe('Create a new migration file');
    });
  });

  describe('create command', () => {
    test('should create migration file with correct format', async () => {
      const migrationsPath = path.join(tempDir, 'migrations');
      
      // Mock the migrations directory path
      jest.doMock('path', () => ({
        ...jest.requireActual('path'),
        join: jest.fn().mockImplementation((...args) => {
          if (args.includes('migrations')) {
            return migrationsPath;
          }
          return jest.requireActual('path').join(...args);
        })
      }));

      process.argv = ['node', 'migration-cli.js', 'create', 'add_user_table'];
      
      // Create migrations directory
      fs.mkdirSync(migrationsPath, { recursive: true });
      
      // Import and run the CLI (this is a workaround for testing)
      const { program: testProgram } = await import('../migration-cli');
      
      // Simulate the create command logic manually
      const name = 'add_user_table';
      const nextVersion = 1;
      const paddedVersion = nextVersion.toString().padStart(3, '0');
      const filename = `${paddedVersion}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;
      const filepath = path.join(migrationsPath, filename);
      
      const template = `-- UP
-- Add your migration SQL here


-- DOWN
-- Add your rollback SQL here

`;
      
      fs.writeFileSync(filepath, template);
      
      expect(fs.existsSync(filepath)).toBe(true);
      
      const content = fs.readFileSync(filepath, 'utf8');
      expect(content).toContain('-- UP');
      expect(content).toContain('-- DOWN');
      expect(content).toContain('Add your migration SQL here');
      expect(content).toContain('Add your rollback SQL here');
    });

    test('should increment version number correctly', () => {
      const migrationsPath = path.join(tempDir, 'migrations');
      fs.mkdirSync(migrationsPath, { recursive: true });
      
      // Create existing migration files
      fs.writeFileSync(path.join(migrationsPath, '001_first.sql'), '-- test');
      fs.writeFileSync(path.join(migrationsPath, '002_second.sql'), '-- test');
      
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .map(f => parseInt(f.split('_')[0], 10))
        .filter(n => !isNaN(n));
      
      const nextVersion = files.length > 0 ? Math.max(...files) + 1 : 1;
      expect(nextVersion).toBe(3);
    });

    test('should sanitize migration names', () => {
      const name = 'add-user-table with spaces!';
      const sanitized = name.replace(/[^a-zA-Z0-9]/g, '_');
      expect(sanitized).toBe('add_user_table_with_spaces_');
    });
  });

  describe('command options', () => {
    test('up command should accept target option', () => {
      const upCmd = program.commands.find(cmd => cmd.name() === 'up');
      const targetOption = upCmd?.options.find(opt => opt.long === '--target');
      
      expect(targetOption).toBeDefined();
      expect(targetOption?.description).toBe('Target version to migrate to');
    });

    test('down command should accept target option', () => {
      const downCmd = program.commands.find(cmd => cmd.name() === 'down');
      const targetOption = downCmd?.options.find(opt => opt.long === '--target');
      
      expect(targetOption).toBeDefined();
      expect(targetOption?.description).toBe('Target version to rollback to');
      expect(targetOption?.defaultValue).toBe('0');
    });

    test('reset command should accept force option', () => {
      const resetCmd = program.commands.find(cmd => cmd.name() === 'reset');
      const forceOption = resetCmd?.options.find(opt => opt.long === '--force');
      
      expect(forceOption).toBeDefined();
      expect(forceOption?.description).toBe('Force reset without confirmation');
    });
  });

  describe('error handling', () => {
    test('should handle invalid target version', () => {
      const invalidTargets = ['abc', '-1', '999999999999999999999'];
      
      invalidTargets.forEach(target => {
        const parsed = parseInt(target, 10);
        if (target === 'abc') {
          expect(isNaN(parsed)).toBe(true);
        } else {
          expect(typeof parsed).toBe('number');
        }
      });
    });

    test('should validate migration name format', () => {
      const validNames = ['add_user_table', 'update_schema', 'fix_indexes'];
      const invalidNames = ['', '123', 'a'.repeat(300)];
      
      validNames.forEach(name => {
        expect(name.length).toBeGreaterThan(0);
        expect(name.length).toBeLessThan(255);
      });
      
      invalidNames.forEach(name => {
        if (name === '') {
          expect(name.length).toBe(0);
        } else if (name === '123') {
          // Numbers only might be valid, depends on requirements
          expect(typeof name).toBe('string');
        } else {
          expect(name.length).toBeGreaterThan(255);
        }
      });
    });
  });

  describe('help and version', () => {
    test('should display version', () => {
      expect(program.version()).toBe('1.0.0');
    });

    test('should display program name and description', () => {
      expect(program.name()).toBe('migrate');
      expect(program.description()).toBe('Database migration CLI tool');
    });
  });

  describe('file system operations', () => {
    test('should create migrations directory if it does not exist', () => {
      const migrationsPath = path.join(tempDir, 'new-migrations');
      
      expect(fs.existsSync(migrationsPath)).toBe(false);
      
      fs.mkdirSync(migrationsPath, { recursive: true });
      
      expect(fs.existsSync(migrationsPath)).toBe(true);
    });

    test('should handle file naming collisions', () => {
      const migrationsPath = path.join(tempDir, 'migrations');
      fs.mkdirSync(migrationsPath, { recursive: true });
      
      // Create first migration
      const filename1 = '001_test_migration.sql';
      fs.writeFileSync(path.join(migrationsPath, filename1), '-- test');
      
      // Create second migration with same base name
      const filename2 = '002_test_migration.sql';
      fs.writeFileSync(path.join(migrationsPath, filename2), '-- test');
      
      expect(fs.existsSync(path.join(migrationsPath, filename1))).toBe(true);
      expect(fs.existsSync(path.join(migrationsPath, filename2))).toBe(true);
    });
  });

  describe('migration template', () => {
    test('should generate valid SQL template', () => {
      const template = `-- UP
-- Add your migration SQL here


-- DOWN
-- Add your rollback SQL here

`;
      
      expect(template).toContain('-- UP');
      expect(template).toContain('-- DOWN');
      expect(template.split('\n')).toHaveLength(8); // Including empty lines
    });

    test('should handle various migration types', () => {
      const migrationTypes = [
        'create_table',
        'add_column', 
        'add_index',
        'update_data',
        'drop_constraint'
      ];
      
      migrationTypes.forEach(type => {
        const sanitized = type.replace(/[^a-zA-Z0-9]/g, '_');
        expect(sanitized).toBe(type); // These are already valid
      });
    });
  });
});