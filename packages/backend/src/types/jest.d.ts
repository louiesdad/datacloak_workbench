/// <reference types="jest" />

declare global {
  // Jest globals are automatically available in test files
  const describe: jest.Describe;
  const it: jest.It;
  const test: jest.It;
  const expect: jest.Expect;
  const beforeAll: jest.HookBase;
  const afterAll: jest.HookBase;
  const beforeEach: jest.HookBase;
  const afterEach: jest.HookBase;
}

export {};