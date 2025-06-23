# Database Migration System Guide

This guide covers the database migration system for the DataCloak Sentiment Workbench backend.

## Overview

The migration system provides:
- **Version Control**: Track database schema changes with numbered migrations
- **Rollback Support**: Safely revert schema changes when needed
- **Checksum Validation**: Detect unauthorized changes to applied migrations
- **CLI Tools**: Command-line interface for migration management
- **Programmatic API**: Integrate migrations into application startup

## Architecture

### Components

1. **MigrationSystem Class** (`migration-system.ts`)
   - Core migration logic
   - Checksum validation
   - Transaction safety

2. **Migration CLI** (`migration-cli.ts`)
   - Command-line interface
   - Migration creation tools
   - Status reporting

3. **SQLite Integration** (`sqlite-refactored.ts`)
   - Automatic migration on startup
   - Connection pool integration

### Migration Files

Migrations are stored in `src/database/migrations/` with the naming convention:
```
001_initial_schema.sql
002_add_user_table.sql
003_add_indexes.sql
```

Each migration file contains:
- **UP section**: Forward migration SQL
- **DOWN section**: Rollback SQL (optional but recommended)

## Usage

### CLI Commands

#### Check Migration Status
```bash
npm run migrate status
```
Shows which migrations are applied and pending.

#### Run Migrations
```bash
# Run all pending migrations
npm run migrate up

# Migrate to specific version
npm run migrate up --target 5
```

#### Rollback Migrations
```bash
# Rollback to previous version
npm run migrate down --target 2

# Reset all migrations
npm run migrate reset
```

#### Create New Migration
```bash
npm run migrate create add_user_preferences
```
Creates a new migration file with the next version number.

### Programmatic API

#### Initialize and Run Migrations
```typescript
import { initializeSQLite, runMigration } from './database/sqlite-refactored';

// Migrations run automatically during initialization
await initializeSQLite();

// Or run manually
await runMigration();
```

#### Manual Migration Control
```typescript
import { withSQLiteConnection } from './database/sqlite-refactored';
import { MigrationSystem } from './database/migration-system';

await withSQLiteConnection(async (db) => {
  const migrationSystem = new MigrationSystem(db, './migrations');
  
  // Get status
  const currentVersion = migrationSystem.getCurrentVersion();
  const applied = migrationSystem.getAppliedMigrations();
  
  // Run migrations
  await migrationSystem.migrate(5); // to version 5
  await migrationSystem.rollback(3); // to version 3
  
  // Show status
  await migrationSystem.status();
});
```

## Migration File Format

### Template
```sql
-- UP
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);

-- DOWN
DROP INDEX IF EXISTS idx_users_username;
DROP TABLE IF EXISTS users;
```

### Best Practices

1. **Always provide DOWN section** for rollback capability
2. **Use IF EXISTS/IF NOT EXISTS** for idempotent operations
3. **Test migrations thoroughly** before deployment
4. **Keep migrations atomic** - one logical change per file
5. **Use descriptive names** for migration files

## Examples

### Adding a New Table
```sql
-- UP
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- DOWN
DROP INDEX IF EXISTS idx_user_sessions_expires_at;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP TABLE IF EXISTS user_sessions;
```

### Adding a Column
```sql
-- UP
ALTER TABLE users ADD COLUMN last_login DATETIME;

-- DOWN
-- Note: SQLite doesn't support DROP COLUMN directly
-- For production, you might need a more complex rollback
-- or avoid adding this rollback section
```

### Modifying Data
```sql
-- UP
UPDATE sentiment_analyses 
SET sentiment = 'neutral' 
WHERE score BETWEEN -0.1 AND 0.1 AND sentiment != 'neutral';

-- DOWN
-- Data modifications are hard to rollback
-- Consider creating a backup or avoiding data changes in migrations
```

## Error Handling

### Common Issues

1. **Modified Migration Error**
   ```
   Migration 001_initial_schema has been modified after being applied
   ```
   - **Cause**: Migration file was changed after being applied
   - **Solution**: Create a new migration file instead

2. **Missing Rollback**
   ```
   Migration 003_add_column does not support rollback
   ```
   - **Cause**: DOWN section is missing or empty
   - **Solution**: Add proper rollback SQL or accept forward-only migration

3. **SQL Syntax Error**
   ```
   Failed to apply migration 002_add_table: syntax error near "CREAT"
   ```
   - **Cause**: SQL syntax error in migration file
   - **Solution**: Fix SQL syntax and try again

### Recovery Strategies

1. **For failed migrations**: Fix the SQL and rerun
2. **For modified migrations**: Create new migration with fixes
3. **For corrupted state**: Use `migrate reset` and restore from backup

## Performance Considerations

1. **Large Data Migrations**: Consider batch processing for large datasets
2. **Index Creation**: May take time on large tables - plan maintenance windows
3. **Transaction Size**: Each migration runs in its own transaction
4. **Connection Pooling**: Migrations use the same connection pool as the application

## Security

1. **Migration files are code** - review them carefully
2. **Backup before major migrations** - especially in production
3. **Test rollbacks** - ensure DOWN sections work correctly
4. **Access control** - limit who can create/run migrations

## Testing

### Unit Tests
Migration system includes comprehensive tests:
```bash
npm test -- --testPathPattern="migration-system.test"
```

### Integration Testing
```typescript
// Example test setup
const tempDb = new Database(':memory:');
const migrationSystem = new MigrationSystem(tempDb, './test-migrations');

await migrationSystem.migrate();
// Test your application logic
await migrationSystem.rollback(0);
```

## Troubleshooting

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=migration npm run migrate status
```

### Manual Recovery
If the migration system gets into a bad state:

1. **Check migration table**:
   ```sql
   SELECT * FROM _migrations ORDER BY version;
   ```

2. **Manual cleanup** (use with caution):
   ```sql
   DELETE FROM _migrations WHERE version > 5;
   ```

3. **Reset and restore**:
   ```bash
   npm run migrate reset --force
   # Restore from backup
   npm run migrate up
   ```

## Contributing

When adding new migrations:

1. Create descriptive migration names
2. Include both UP and DOWN sections
3. Test thoroughly in development
4. Document complex migrations
5. Review with team before merging

## References

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Database Migration Best Practices](https://flywaydb.org/documentation/)
- [Schema Evolution Patterns](https://martinfowler.com/articles/evodb.html)