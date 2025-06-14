"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdversarialCorpus = exports.createSecurityClient = exports.BackendSecurityClient = exports.SecurityMonitor = exports.KeychainManager = exports.CryptoUtils = exports.SecurityAuditor = exports.NativeDataCloakBridge = exports.DataCloakBridge = void 0;
// Core interfaces and types
__exportStar(require("./interfaces/datacloak"), exports);
// Implementation modules
__exportStar(require("./mock/datacloak-mock"), exports);
__exportStar(require("./datacloak/native-bridge"), exports);
__exportStar(require("./audit/security-auditor"), exports);
__exportStar(require("./encryption/crypto-utils"), exports);
__exportStar(require("./keychain/keychain-manager"), exports);
__exportStar(require("./monitoring/security-monitor"), exports);
__exportStar(require("./integration/backend-security-client"), exports);
// Testing and validation
__exportStar(require("./testing/adversarial-corpus"), exports);
// Main exports with aliases
var datacloak_mock_1 = require("./mock/datacloak-mock");
Object.defineProperty(exports, "DataCloakBridge", { enumerable: true, get: function () { return datacloak_mock_1.DataCloakMock; } });
var native_bridge_1 = require("./datacloak/native-bridge");
Object.defineProperty(exports, "NativeDataCloakBridge", { enumerable: true, get: function () { return native_bridge_1.NativeDataCloakBridge; } });
var security_auditor_1 = require("./audit/security-auditor");
Object.defineProperty(exports, "SecurityAuditor", { enumerable: true, get: function () { return security_auditor_1.SecurityAuditor; } });
var crypto_utils_1 = require("./encryption/crypto-utils");
Object.defineProperty(exports, "CryptoUtils", { enumerable: true, get: function () { return crypto_utils_1.CryptoUtils; } });
var keychain_manager_1 = require("./keychain/keychain-manager");
Object.defineProperty(exports, "KeychainManager", { enumerable: true, get: function () { return keychain_manager_1.KeychainManager; } });
var security_monitor_1 = require("./monitoring/security-monitor");
Object.defineProperty(exports, "SecurityMonitor", { enumerable: true, get: function () { return security_monitor_1.SecurityMonitor; } });
var backend_security_client_1 = require("./integration/backend-security-client");
Object.defineProperty(exports, "BackendSecurityClient", { enumerable: true, get: function () { return backend_security_client_1.BackendSecurityClient; } });
Object.defineProperty(exports, "createSecurityClient", { enumerable: true, get: function () { return backend_security_client_1.createSecurityClient; } });
var adversarial_corpus_1 = require("./testing/adversarial-corpus");
Object.defineProperty(exports, "AdversarialCorpus", { enumerable: true, get: function () { return adversarial_corpus_1.AdversarialCorpus; } });
//# sourceMappingURL=index.js.map