// Mock implementation of sqlite-refactored for testing

class MockDatabase {
  prepare(sql: string) {
    return {
      get: jest.fn().mockReturnValue(null),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1 }),
      iterate: jest.fn().mockReturnValue([]),
    };
  }

  exec(sql: string) {
    return this;
  }

  transaction(fn: () => void) {
    return fn;
  }

  close() {
    return this;
  }
}

const mockDb = new MockDatabase();

export const initializeSQLite = jest.fn().mockResolvedValue(undefined);

export const getSQLiteConnection = jest.fn().mockResolvedValue(mockDb);

export const releaseSQLiteConnection = jest.fn();

export const withSQLiteConnection = jest.fn().mockImplementation(async (fn) => {
  return fn(mockDb);
});

export const closeSQLiteConnection = jest.fn().mockResolvedValue(undefined);

export const getSQLitePoolStats = jest.fn().mockReturnValue({
  activeConnections: 0,
  idleConnections: 1,
  totalConnections: 1,
});

export const runMigration = jest.fn().mockResolvedValue(undefined);

export const rollbackMigration = jest.fn().mockResolvedValue(undefined);

export const getMigrationStatus = jest.fn().mockResolvedValue(undefined);