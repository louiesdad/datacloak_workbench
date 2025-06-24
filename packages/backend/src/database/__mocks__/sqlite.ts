// Mock implementation of sqlite for testing

export class DatabaseService {
  static getInstance = jest.fn();

  all = jest.fn().mockResolvedValue([]);
  get = jest.fn().mockResolvedValue(null);
  run = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowid: 1 });
  prepare = jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(null),
    all: jest.fn().mockReturnValue([]),
    run: jest.fn().mockReturnValue({ changes: 1 }),
  });
  close = jest.fn().mockResolvedValue(undefined);
}

export default DatabaseService;