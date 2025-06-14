/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  coverageAnalysis: 'perTest',
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/__tests__/**/*.ts',
    '!src/index.ts'
  ],
  thresholds: {
    high: 90,
    low: 85,
    break: 80
  },
  mutator: {
    plugins: ['@stryker-mutator/typescript-checker']
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  timeoutMS: 60000,
  maxConcurrentTestRunners: 4,
  tempDirName: 'stryker-tmp',
  cleanTempDir: true,
  htmlReporter: {
    fileName: 'mutation-report.html',
    baseDir: 'reports/mutation'
  },
  jsonReporter: {
    fileName: 'mutation-report.json',
    baseDir: 'reports/mutation'
  },
  // Security-specific mutation configuration
  mutationScore: {
    minimumScore: 85,
    criticalModules: [
      'src/mock/datacloak-mock.ts',
      'src/audit/security-auditor.ts',
      'src/encryption/crypto-utils.ts',
      'src/datacloak/native-bridge.ts',
      'src/keychain/keychain-manager.ts'
    ],
    criticalMinimumScore: 90
  },
  // Custom mutation operators for security-critical code
  mutationOperators: [
    'ArithmeticOperator',
    'ArrayDeclaration',
    'ArrowFunction',
    'AssignmentOperator',
    'BlockStatement',
    'BooleanLiteral',
    'ConditionalExpression',
    'EqualityOperator',
    'LogicalOperator',
    'MethodExpression',
    'ObjectLiteral',
    'OptionalChaining',
    'RegexLiteral',
    'StringLiteral',
    'UnaryOperator'
  ],
  // Ignore patterns for known safe mutations
  ignoredMutations: [
    {
      mutatorName: 'StringLiteral',
      location: {
        start: { line: 0, column: 0 },
        end: { line: 999, column: 999 }
      },
      reason: 'Version strings and constants'
    }
  ],
  // Security-focused plugins
  plugins: [
    '@stryker-mutator/core',
    '@stryker-mutator/jest-runner',
    '@stryker-mutator/typescript-checker',
    '@stryker-mutator/html-reporter'
  ],
  // Custom timeout for security tests
  timeoutFactor: 2,
  disableTypeChecks: false,
  // Incremental mode for faster subsequent runs
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',
  // Build command for TypeScript compilation
  buildCommand: 'npm run build',
  // Force enable for security package
  force: true
};