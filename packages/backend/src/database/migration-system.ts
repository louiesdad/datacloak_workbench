import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface Migration {
  id: string;
  version: number;
  name: string;
  up: string;
  down: string;
  checksum: string;
}

export interface MigrationRecord {
  id: string;
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
}

export class MigrationSystem {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath: string) {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.ensureMigrationTable();
  }

  private ensureMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_version ON _migrations(version);
    `);
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async loadMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1], 10);
      const name = match[2];
      const filePath = path.join(this.migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Check if the file contains an UP section marker
      if (!content.includes('-- UP')) {
        throw new Error(`Migration ${file} missing UP section`);
      }

      const [upSection, downSection] = content.split(/^-- DOWN$/m);
      
      const up = upSection.replace(/^-- UP$/m, '').trim();
      const down = downSection ? downSection.trim() : '';
      
      migrations.push({
        id: `${version}_${name}`,
        version,
        name,
        up,
        down,
        checksum: this.calculateChecksum(up)
      });
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  getAppliedMigrations(): MigrationRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, version, name, checksum, applied_at 
      FROM _migrations 
      ORDER BY version
    `);
    
    return stmt.all() as MigrationRecord[];
  }

  getCurrentVersion(): number {
    const stmt = this.db.prepare('SELECT MAX(version) as version FROM _migrations');
    const result = stmt.get() as { version: number | null };
    return result.version || 0;
  }

  async migrate(targetVersion?: number): Promise<void> {
    const migrations = await this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const currentVersion = this.getCurrentVersion();

    const target = targetVersion ?? Math.max(...migrations.map(m => m.version), 0);

    if (target === currentVersion) {
      console.log('Database is already up to date');
      return;
    }

    const appliedMap = new Map(applied.map(a => [a.version, a]));

    for (const migration of migrations) {
      const appliedMigration = appliedMap.get(migration.version);
      
      if (appliedMigration) {
        if (appliedMigration.checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.id} has been modified after being applied. ` +
            `Expected checksum: ${appliedMigration.checksum}, ` +
            `Current checksum: ${migration.checksum}`
          );
        }
        continue;
      }

      if (migration.version <= target && migration.version > currentVersion) {
        console.log(`Applying migration: ${migration.id}`);
        
        // Check if migration already contains transaction statements
        const hasTransaction = migration.up.toUpperCase().includes('BEGIN') || 
                              migration.up.toUpperCase().includes('COMMIT');
        
        if (hasTransaction) {
          // Execute migration with its own transaction handling
          try {
            this.db.exec(migration.up);
            
            const stmt = this.db.prepare(`
              INSERT INTO _migrations (id, version, name, checksum)
              VALUES (?, ?, ?, ?)
            `);
            
            stmt.run(migration.id, migration.version, migration.name, migration.checksum);
            console.log(`Applied migration: ${migration.id}`);
          } catch (error) {
            throw new Error(`Failed to apply migration ${migration.id}: ${error}`);
          }
        } else {
          // Wrap in transaction
          const transaction = this.db.prepare('BEGIN');
          const commit = this.db.prepare('COMMIT');
          const rollback = this.db.prepare('ROLLBACK');

          try {
            transaction.run();
            
            this.db.exec(migration.up);
            
            const stmt = this.db.prepare(`
              INSERT INTO _migrations (id, version, name, checksum)
              VALUES (?, ?, ?, ?)
            `);
            
            stmt.run(migration.id, migration.version, migration.name, migration.checksum);
            
            commit.run();
            console.log(`Applied migration: ${migration.id}`);
          } catch (error) {
            rollback.run();
            throw new Error(`Failed to apply migration ${migration.id}: ${error}`);
          }
        }
      }
    }
  }

  async rollback(targetVersion: number = 0): Promise<void> {
    const migrations = await this.loadMigrations();
    const applied = this.getAppliedMigrations().reverse();
    
    for (const record of applied) {
      if (record.version <= targetVersion) break;
      
      const migration = migrations.find(m => m.version === record.version);
      if (!migration) {
        throw new Error(`Migration ${record.id} not found in filesystem`);
      }

      if (!migration.down) {
        throw new Error(`Migration ${record.id} does not support rollback`);
      }

      console.log(`Rolling back migration: ${migration.id}`);
      
      // Check if migration already contains transaction statements
      const hasTransaction = migration.down.toUpperCase().includes('BEGIN') || 
                            migration.down.toUpperCase().includes('COMMIT');
      
      if (hasTransaction) {
        // Execute migration with its own transaction handling
        try {
          this.db.exec(migration.down);
          
          const stmt = this.db.prepare('DELETE FROM _migrations WHERE version = ?');
          stmt.run(migration.version);
          
          console.log(`Rolled back migration: ${migration.id}`);
        } catch (error) {
          throw new Error(`Failed to rollback migration ${migration.id}: ${error}`);
        }
      } else {
        // Wrap in transaction
        const transaction = this.db.prepare('BEGIN');
        const commit = this.db.prepare('COMMIT');
        const rollback = this.db.prepare('ROLLBACK');

        try {
          transaction.run();
          
          this.db.exec(migration.down);
          
          const stmt = this.db.prepare('DELETE FROM _migrations WHERE version = ?');
          stmt.run(migration.version);
          
          commit.run();
          console.log(`Rolled back migration: ${migration.id}`);
        } catch (error) {
          rollback.run();
          throw new Error(`Failed to rollback migration ${migration.id}: ${error}`);
        }
      }
    }
  }

  async reset(): Promise<void> {
    await this.rollback(0);
  }

  async status(): Promise<void> {
    const migrations = await this.loadMigrations();
    const applied = this.getAppliedMigrations();
    const appliedSet = new Set(applied.map(a => a.version));

    console.log('\nMigration Status:');
    console.log('=================');
    
    for (const migration of migrations) {
      const status = appliedSet.has(migration.version) ? '✓' : ' ';
      console.log(`[${status}] ${migration.id}`);
    }
    
    console.log(`\nCurrent version: ${this.getCurrentVersion()}`);
    console.log(`Total migrations: ${migrations.length}`);
    console.log(`Applied migrations: ${applied.length}`);
  }
}