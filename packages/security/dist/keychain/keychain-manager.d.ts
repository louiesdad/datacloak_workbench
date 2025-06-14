export interface KeychainConfig {
    serviceName: string;
    accountName: string;
    fallbackToFileSystem?: boolean;
    encryptionKey?: string;
}
export interface SecureKey {
    id: string;
    data: string;
    metadata: {
        created: Date;
        lastAccessed: Date;
        source: 'keychain' | 'filesystem' | 'memory';
    };
}
export declare class KeychainManager {
    private config;
    private memoryKeys;
    private readonly currentPlatform;
    constructor(config: KeychainConfig);
    storeKey(keyId: string, keyData: string): Promise<void>;
    retrieveKey(keyId: string): Promise<string | null>;
    deleteKey(keyId: string): Promise<void>;
    generateAndStoreKey(keyId: string): Promise<string>;
    rotateKey(keyId: string): Promise<string>;
    listKeys(): string[];
    private supportsNativeKeychain;
    private storeInNativeKeychain;
    private retrieveFromNativeKeychain;
    private deleteFromNativeKeychain;
    private macOSKeychainStore;
    private macOSKeychainRetrieve;
    private macOSKeychainDelete;
    private windowsCredentialStore;
    private windowsCredentialRetrieve;
    private windowsCredentialDelete;
    private storeInFileSystem;
    private retrieveFromFileSystem;
    private deleteFromFileSystem;
    private getKeyFilePath;
    private storeInMemory;
    private retrieveFromMemory;
    private deleteFromMemory;
    secureWipeMemoryKeys(): void;
    validateKeyIntegrity(keyId: string): Promise<boolean>;
}
//# sourceMappingURL=keychain-manager.d.ts.map