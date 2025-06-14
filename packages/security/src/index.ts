// Core interfaces and types
export * from './interfaces/datacloak';

// Implementation modules
export * from './mock/datacloak-mock';
export * from './datacloak/native-bridge';
export * from './audit/security-auditor';
export * from './encryption/crypto-utils';
export * from './keychain/keychain-manager';
export * from './monitoring/security-monitor';
export * from './integration/backend-security-client';

// Testing and validation
export * from './testing/adversarial-corpus';

// Main exports with aliases
export { DataCloakMock as DataCloakBridge } from './mock/datacloak-mock';
export { NativeDataCloakBridge } from './datacloak/native-bridge';
export { SecurityAuditor } from './audit/security-auditor';
export { CryptoUtils } from './encryption/crypto-utils';
export { KeychainManager } from './keychain/keychain-manager';
export { SecurityMonitor } from './monitoring/security-monitor';
export { BackendSecurityClient, createSecurityClient } from './integration/backend-security-client';
export { AdversarialCorpus } from './testing/adversarial-corpus';