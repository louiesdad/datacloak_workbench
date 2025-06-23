/**
 * SQLite Database Connection Management
 * 
 * This file provides backward compatibility by re-exporting
 * functions from the refactored SQLite implementation.
 * 
 * @deprecated Use sqlite-refactored.ts directly for new code
 */

// Re-export all functions from the refactored implementation
export * from './sqlite-refactored';

// Provide specific named exports for compatibility
export {
  initializeSQLite,
  getSQLiteConnection,
  withSQLiteConnection,
  releaseSQLiteConnection,
  closeSQLiteConnection,
  getSQLitePoolStats,
  runMigration,
  rollbackMigration,
  getMigrationStatus
} from './sqlite-refactored';

// Provide createTables from deprecated file for backward compatibility
export { createTables } from './sqlite.deprecated';