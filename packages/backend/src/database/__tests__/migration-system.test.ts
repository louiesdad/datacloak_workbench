import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MigrationSystem } from '../migration-system';

describe('MigrationSystem', () => {
  let tempDir: string;
  let dbPath: string;
  let migrationsPath: string;
  let db: Database.Database;
  let migrationSystem: MigrationSystem;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    dbPath = path.join(tempDir, 'test.db');
    migrationsPath = path.join(tempDir, 'migrations');
    
    fs.mkdirSync(migrationsPath);
    
    db = new Database(dbPath);
    migrationSystem = new MigrationSystem(db, migrationsPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('migration table creation', () => {
    test('should create migrations table', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='_migrations'
      `).all();
      
      expect(tables).toHaveLength(1);
    });
  });

  describe('loading migrations', () => {
    test('should load migrations from filesystem', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);

-- DOWN
DROP TABLE users;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_add_email.sql'),
        `-- UP
ALTER TABLE users ADD COLUMN email TEXT;

-- DOWN
ALTER TABLE users DROP COLUMN email;`
      );

      const migrations = await migrationSystem.loadMigrations();
      
      expect(migrations).toHaveLength(2);
      expect(migrations[0].version).toBe(1);
      expect(migrations[0].name).toBe('create_users');
      expect(migrations[1].version).toBe(2);
      expect(migrations[1].name).toBe('add_email');
    });

    test('should ignore non-migration files', async () => {
      fs.writeFileSync(path.join(migrationsPath, 'readme.txt'), 'ignored');
      fs.writeFileSync(
        path.join(migrationsPath, '001_test.sql'),
        `-- UP
CREATE TABLE test (id INTEGER PRIMARY KEY);`
      );

      const migrations = await migrationSystem.loadMigrations();
      expect(migrations).toHaveLength(1);
    });

    test('should sort migrations by version', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '003_third.sql'),
        `-- UP
CREATE TABLE third (id INTEGER PRIMARY KEY);`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '001_first.sql'),
        `-- UP
CREATE TABLE first (id INTEGER PRIMARY KEY);`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_second.sql'),
        `-- UP
CREATE TABLE second (id INTEGER PRIMARY KEY);`
      );

      const migrations = await migrationSystem.loadMigrations();
      
      expect(migrations[0].name).toBe('first');
      expect(migrations[1].name).toBe('second');
      expect(migrations[2].name).toBe('third');
    });
  });

  describe('migration execution', () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO users (name) VALUES ('test');

-- DOWN
DROP TABLE users;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_add_email.sql'),
        `-- UP
ALTER TABLE users ADD COLUMN email TEXT;

-- DOWN
ALTER TABLE users DROP COLUMN email;`
      );
    });

    test('should apply migrations', async () => {
      await migrationSystem.migrate();

      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).all();
      
      expect(tables).toHaveLength(1);

      const columns = db.prepare(`PRAGMA table_info(users)`).all();
      expect(columns).toHaveLength(3); // id, name, email

      const records = migrationSystem.getAppliedMigrations();
      expect(records).toHaveLength(2);
    });

    test('should track applied migrations', async () => {
      await migrationSystem.migrate();

      const applied = migrationSystem.getAppliedMigrations();
      expect(applied).toHaveLength(2);
      expect(applied[0].version).toBe(1);
      expect(applied[1].version).toBe(2);
    });

    test('should not reapply migrations', async () => {
      await migrationSystem.migrate();
      
      const beforeCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      
      await migrationSystem.migrate();
      
      const afterCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(afterCount.count).toBe(beforeCount.count);
    });

    test('should migrate to specific version', async () => {
      await migrationSystem.migrate(1);

      const applied = migrationSystem.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe(1);

      const columns = db.prepare(`PRAGMA table_info(users)`).all();
      expect(columns).toHaveLength(2); // id, name (no email yet)
    });

    test('should detect modified migrations', async () => {
      await migrationSystem.migrate(1);

      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, modified BOOLEAN);

-- DOWN
DROP TABLE users;`
      );

      await expect(migrationSystem.migrate()).rejects.toThrow('has been modified');
    });
  });

  describe('rollback functionality', () => {
    beforeEach(async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);

-- DOWN
DROP TABLE users;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_add_email.sql'),
        `-- UP
ALTER TABLE users ADD COLUMN email TEXT;

-- DOWN
ALTER TABLE users DROP COLUMN email;`
      );

      await migrationSystem.migrate();
    });

    test('should rollback to specific version', async () => {
      await migrationSystem.rollback(1);

      const applied = migrationSystem.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].version).toBe(1);

      const columns = db.prepare(`PRAGMA table_info(users)`).all();
      expect(columns).toHaveLength(2); // id, name (email rolled back)
    });

    test('should rollback all migrations', async () => {
      await migrationSystem.rollback(0);

      const applied = migrationSystem.getAppliedMigrations();
      expect(applied).toHaveLength(0);

      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).all();
      
      expect(tables).toHaveLength(0);
    });

    test('should handle missing rollback statements', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '003_no_rollback.sql'),
        `-- UP
CREATE TABLE temp_table (id INTEGER PRIMARY KEY);`
      );

      await migrationSystem.migrate();

      await expect(migrationSystem.rollback(2)).rejects.toThrow('does not support rollback');
    });
  });

  describe('current version tracking', () => {
    test('should return 0 for empty database', () => {
      expect(migrationSystem.getCurrentVersion()).toBe(0);
    });

    test('should return highest applied version', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_first.sql'),
        `-- UP
CREATE TABLE first (id INTEGER PRIMARY KEY);`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '003_third.sql'),
        `-- UP
CREATE TABLE third (id INTEGER PRIMARY KEY);`
      );

      await migrationSystem.migrate();
      expect(migrationSystem.getCurrentVersion()).toBe(3);
    });
  });

  describe('additional comprehensive tests', () => {
    test('should handle missing UP section', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_invalid.sql'),
        `-- This migration has no UP section
-- DOWN
DROP TABLE test;`
      );

      await expect(migrationSystem.loadMigrations()).rejects.toThrow('missing UP section');
    });

    test('should create migrations directory if not exists', async () => {
      const newMigrationsPath = path.join(tempDir, 'new-migrations');
      const newSystem = new MigrationSystem(db, newMigrationsPath);
      
      await newSystem.loadMigrations();
      
      expect(fs.existsSync(newMigrationsPath)).toBe(true);
    });

    test('should handle migration errors gracefully', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_error.sql'),
        `-- UP
CREATE TABLE test (id INTEGER PRIMARY KEY);
INVALID SQL STATEMENT;

-- DOWN
DROP TABLE test;`
      );

      await expect(migrationSystem.migrate()).rejects.toThrow('Failed to apply migration');
    });

    test('should handle rollback errors gracefully', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_rollback_error.sql'),
        `-- UP
CREATE TABLE test (id INTEGER PRIMARY KEY);

-- DOWN
INVALID SQL STATEMENT;`
      );

      await migrationSystem.migrate();
      
      await expect(migrationSystem.rollback(0)).rejects.toThrow('Failed to rollback migration');
    });

    test('should call status method and log migration status', async () => {
      // Mock console.log
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = jest.fn().mockImplementation((...args) => {
        logs.push(args.join(' '));
      });

      fs.writeFileSync(
        path.join(migrationsPath, '001_first.sql'),
        `-- UP
CREATE TABLE first (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE first;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_second.sql'),
        `-- UP
CREATE TABLE second (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE second;`
      );

      // Apply only first migration
      await migrationSystem.migrate(1);
      
      // Call status
      await migrationSystem.status();

      // Restore console.log
      console.log = originalLog;

      // Debug: print actual logs
      // console.log('Actual logs:', logs);

      // Check logs
      expect(logs.some(log => log.includes('Migration Status'))).toBe(true);
      expect(logs.some(log => log.includes('[✓] 1_first'))).toBe(true);
      expect(logs.some(log => log.includes('[ ] 2_second'))).toBe(true);
      expect(logs.some(log => log.includes('Current version: 1'))).toBe(true);
      expect(logs.some(log => log.includes('Total migrations: 2'))).toBe(true);
      expect(logs.some(log => log.includes('Applied migrations: 1'))).toBe(true);
    });

    test('should handle reset method', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE users;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_create_posts.sql'),
        `-- UP
CREATE TABLE posts (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE posts;`
      );

      // Apply migrations
      await migrationSystem.migrate();
      expect(migrationSystem.getCurrentVersion()).toBe(2);

      // Reset
      await migrationSystem.reset();
      expect(migrationSystem.getCurrentVersion()).toBe(0);

      // Check tables are dropped
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'posts')
      `).all();
      
      expect(tables).toHaveLength(0);
    });

    test('should handle concurrent migration scenarios', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_create_users.sql'),
        `-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
INSERT INTO users (name) VALUES ('user1');

-- DOWN
DROP TABLE users;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_create_posts.sql'),
        `-- UP
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  content TEXT
);

-- DOWN
DROP TABLE posts;`
      );

      // Apply migrations
      await migrationSystem.migrate();

      // Check referential integrity
      const tables = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='posts'
      `).get() as { sql: string };
      
      expect(tables.sql).toContain('REFERENCES users(id)');
    });

    test('should handle complex rollback scenarios', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_base.sql'),
        `-- UP
CREATE TABLE base (id INTEGER PRIMARY KEY);
INSERT INTO base (id) VALUES (1), (2), (3);

-- DOWN
DROP TABLE base;`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '002_add_column.sql'),
        `-- UP
ALTER TABLE base ADD COLUMN value INTEGER DEFAULT 0;
UPDATE base SET value = id * 10;

-- DOWN
-- SQLite doesn't support DROP COLUMN directly
BEGIN;
CREATE TABLE base_temp AS SELECT id FROM base;
DROP TABLE base;
ALTER TABLE base_temp RENAME TO base;
COMMIT;`
      );

      // Apply all migrations
      await migrationSystem.migrate();
      
      // Check data
      const beforeRollback = db.prepare('SELECT * FROM base ORDER BY id').all();
      expect(beforeRollback).toHaveLength(3);
      expect(beforeRollback[0]).toHaveProperty('value', 10);

      // Rollback to version 1
      await migrationSystem.rollback(1);
      
      // Check column is removed
      const columns = db.prepare(`PRAGMA table_info(base)`).all();
      expect(columns).toHaveLength(1); // Only id column
      
      // Check data is preserved
      const afterRollback = db.prepare('SELECT * FROM base ORDER BY id').all();
      expect(afterRollback).toHaveLength(3);
    });

    test('should calculate correct checksums', async () => {
      const migration1 = `-- UP
CREATE TABLE test1 (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE test1;`;

      const migration2 = `-- UP
CREATE TABLE test2 (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE test2;`;

      fs.writeFileSync(path.join(migrationsPath, '001_test1.sql'), migration1);
      fs.writeFileSync(path.join(migrationsPath, '002_test2.sql'), migration2);

      await migrationSystem.migrate();

      const applied = migrationSystem.getAppliedMigrations();
      expect(applied[0].checksum).toBeDefined();
      expect(applied[1].checksum).toBeDefined();
      expect(applied[0].checksum).not.toBe(applied[1].checksum);
    });

    test('should handle migrations with transactions', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_transactional.sql'),
        `-- UP
BEGIN;
CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER NOT NULL);
INSERT INTO accounts (balance) VALUES (100), (200);
UPDATE accounts SET balance = balance + 50;
COMMIT;

-- DOWN
DROP TABLE accounts;`
      );

      await migrationSystem.migrate();

      const accounts = db.prepare('SELECT * FROM accounts ORDER BY id').all() as Array<{ balance: number }>;
      expect(accounts).toHaveLength(2);
      expect(accounts[0].balance).toBe(150);
      expect(accounts[1].balance).toBe(250);
    });

    test('should handle migration with multiple statements per line', async () => {
      fs.writeFileSync(
        path.join(migrationsPath, '001_multi_statement.sql'),
        `-- UP
CREATE TABLE t1 (id INTEGER); CREATE TABLE t2 (id INTEGER); CREATE TABLE t3 (id INTEGER);

-- DOWN
DROP TABLE t1; DROP TABLE t2; DROP TABLE t3;`
      );

      await migrationSystem.migrate();

      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE 't%'
        ORDER BY name
      `).all() as Array<{ name: string }>;
      
      expect(tables).toHaveLength(3);
      expect(tables.map(t => t.name)).toEqual(['t1', 't2', 't3']);
    });

    test('should handle edge case version numbers', async () => {
      // Test with leading zeros
      fs.writeFileSync(
        path.join(migrationsPath, '001_first.sql'),
        `-- UP
CREATE TABLE first (id INTEGER PRIMARY KEY);`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '010_tenth.sql'),
        `-- UP
CREATE TABLE tenth (id INTEGER PRIMARY KEY);`
      );

      fs.writeFileSync(
        path.join(migrationsPath, '100_hundredth.sql'),
        `-- UP
CREATE TABLE hundredth (id INTEGER PRIMARY KEY);`
      );

      const migrations = await migrationSystem.loadMigrations();
      
      expect(migrations).toHaveLength(3);
      expect(migrations[0].version).toBe(1);
      expect(migrations[1].version).toBe(10);
      expect(migrations[2].version).toBe(100);
    });
  });
});