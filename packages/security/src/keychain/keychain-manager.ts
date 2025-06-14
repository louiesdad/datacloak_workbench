import { spawn } from 'child_process';
import { platform } from 'os';
import { CryptoUtils, EncryptedData } from '../encryption/crypto-utils';

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

export class KeychainManager {
  private config: KeychainConfig;
  private memoryKeys: Map<string, SecureKey> = new Map();
  private readonly currentPlatform = platform();

  constructor(config: KeychainConfig) {
    this.config = {
      fallbackToFileSystem: true,
      ...config
    };
  }

  async storeKey(keyId: string, keyData: string): Promise<void> {
    try {
      if (this.supportsNativeKeychain()) {
        await this.storeInNativeKeychain(keyId, keyData);
        return;
      }
    } catch (error) {
      console.warn(`Native keychain storage failed: ${error}`);
    }

    if (this.config.fallbackToFileSystem) {
      await this.storeInFileSystem(keyId, keyData);
    } else {
      this.storeInMemory(keyId, keyData);
    }
  }

  async retrieveKey(keyId: string): Promise<string | null> {
    try {
      if (this.supportsNativeKeychain()) {
        const key = await this.retrieveFromNativeKeychain(keyId);
        if (key) return key;
      }
    } catch (error) {
      console.warn(`Native keychain retrieval failed: ${error}`);
    }

    if (this.config.fallbackToFileSystem) {
      return this.retrieveFromFileSystem(keyId);
    } else {
      return this.retrieveFromMemory(keyId);
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    try {
      if (this.supportsNativeKeychain()) {
        await this.deleteFromNativeKeychain(keyId);
      }
    } catch (error) {
      console.warn(`Native keychain deletion failed: ${error}`);
    }

    if (this.config.fallbackToFileSystem) {
      await this.deleteFromFileSystem(keyId);
    } else {
      this.deleteFromMemory(keyId);
    }
  }

  async generateAndStoreKey(keyId: string): Promise<string> {
    const key = CryptoUtils.generateKey();
    await this.storeKey(keyId, key);
    return key;
  }

  async rotateKey(keyId: string): Promise<string> {
    await this.deleteKey(keyId);
    return this.generateAndStoreKey(keyId);
  }

  listKeys(): string[] {
    return Array.from(this.memoryKeys.keys());
  }

  private supportsNativeKeychain(): boolean {
    return this.currentPlatform === 'darwin' || this.currentPlatform === 'win32';
  }

  private async storeInNativeKeychain(keyId: string, keyData: string): Promise<void> {
    if (this.currentPlatform === 'darwin') {
      await this.macOSKeychainStore(keyId, keyData);
    } else if (this.currentPlatform === 'win32') {
      await this.windowsCredentialStore(keyId, keyData);
    } else {
      throw new Error('Native keychain not supported on this platform');
    }
  }

  private async retrieveFromNativeKeychain(keyId: string): Promise<string | null> {
    if (this.currentPlatform === 'darwin') {
      return this.macOSKeychainRetrieve(keyId);
    } else if (this.currentPlatform === 'win32') {
      return this.windowsCredentialRetrieve(keyId);
    } else {
      throw new Error('Native keychain not supported on this platform');
    }
  }

  private async deleteFromNativeKeychain(keyId: string): Promise<void> {
    if (this.currentPlatform === 'darwin') {
      await this.macOSKeychainDelete(keyId);
    } else if (this.currentPlatform === 'win32') {
      await this.windowsCredentialDelete(keyId);
    } else {
      throw new Error('Native keychain not supported on this platform');
    }
  }

  private async macOSKeychainStore(keyId: string, keyData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'add-generic-password',
        '-s', this.config.serviceName,
        '-a', `${this.config.accountName}-${keyId}`,
        '-w', keyData,
        '-U' // Update if exists
      ];

      const process = spawn('security', args);
      
      let errorOutput = '';
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`macOS keychain store failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute security command: ${error}`));
      });
    });
  }

  private async macOSKeychainRetrieve(keyId: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const args = [
        'find-generic-password',
        '-s', this.config.serviceName,
        '-a', `${this.config.accountName}-${keyId}`,
        '-w' // Output password only
      ];

      const process = spawn('security', args);
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim() || null);
        } else if (errorOutput.includes('could not be found')) {
          resolve(null);
        } else {
          reject(new Error(`macOS keychain retrieve failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute security command: ${error}`));
      });
    });
  }

  private async macOSKeychainDelete(keyId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'delete-generic-password',
        '-s', this.config.serviceName,
        '-a', `${this.config.accountName}-${keyId}`
      ];

      const process = spawn('security', args);
      
      let errorOutput = '';
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || errorOutput.includes('could not be found')) {
          resolve();
        } else {
          reject(new Error(`macOS keychain delete failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute security command: ${error}`));
      });
    });
  }

  private async windowsCredentialStore(keyId: string, keyData: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
      const args = [
        '/generic', `/target:${targetName}`,
        `/user:${this.config.accountName}`,
        `/pass:${keyData}`
      ];

      const process = spawn('cmdkey', args);
      
      let errorOutput = '';
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Windows credential store failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute cmdkey command: ${error}`));
      });
    });
  }

  private async windowsCredentialRetrieve(keyId: string): Promise<string | null> {
    // Windows credential retrieval requires PowerShell for security
    return new Promise((resolve, reject) => {
      const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
      const script = `
        try {
          $cred = Get-StoredCredential -Target '${targetName}' -ErrorAction Stop
          $cred.GetNetworkCredential().Password
        } catch {
          exit 1
        }
      `;

      const process = spawn('powershell', ['-Command', script]);
      
      let output = '';
      let errorOutput = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim() || null);
        } else {
          resolve(null); // Credential not found
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute PowerShell command: ${error}`));
      });
    });
  }

  private async windowsCredentialDelete(keyId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const targetName = `${this.config.serviceName}:${this.config.accountName}-${keyId}`;
      const args = [`/delete`, `/target:${targetName}`];

      const process = spawn('cmdkey', args);
      
      let errorOutput = '';
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 || errorOutput.includes('not exist')) {
          resolve();
        } else {
          reject(new Error(`Windows credential delete failed: ${errorOutput}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute cmdkey command: ${error}`));
      });
    });
  }

  private async storeInFileSystem(keyId: string, keyData: string): Promise<void> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required for filesystem storage');
    }

    const encrypted = CryptoUtils.encrypt(keyData, this.config.encryptionKey);
    const filePath = this.getKeyFilePath(keyId);
    
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(encrypted));
  }

  private async retrieveFromFileSystem(keyId: string): Promise<string | null> {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key required for filesystem storage');
    }

    try {
      const filePath = this.getKeyFilePath(keyId);
      const fs = await import('fs/promises');
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const encrypted: EncryptedData = JSON.parse(encryptedData);
      return CryptoUtils.decrypt(encrypted, this.config.encryptionKey);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async deleteFromFileSystem(keyId: string): Promise<void> {
    try {
      const filePath = this.getKeyFilePath(keyId);
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private getKeyFilePath(keyId: string): string {
    const path = require('path');
    const os = require('os');
    const keyDir = path.join(os.homedir(), '.datacloak', 'keys');
    
    // Ensure directory exists
    const fs = require('fs');
    fs.mkdirSync(keyDir, { recursive: true });
    
    return path.join(keyDir, `${keyId}.encrypted`);
  }

  private storeInMemory(keyId: string, keyData: string): void {
    const key: SecureKey = {
      id: keyId,
      data: keyData,
      metadata: {
        created: new Date(),
        lastAccessed: new Date(),
        source: 'memory'
      }
    };
    this.memoryKeys.set(keyId, key);
  }

  private retrieveFromMemory(keyId: string): string | null {
    const key = this.memoryKeys.get(keyId);
    if (key) {
      key.metadata.lastAccessed = new Date();
      return key.data;
    }
    return null;
  }

  private deleteFromMemory(keyId: string): void {
    this.memoryKeys.delete(keyId);
  }

  // Security utilities
  secureWipeMemoryKeys(): void {
    for (const [keyId, key] of this.memoryKeys) {
      CryptoUtils.secureWipe(key.data);
    }
    this.memoryKeys.clear();
  }

  async validateKeyIntegrity(keyId: string): Promise<boolean> {
    try {
      const key = await this.retrieveKey(keyId);
      return key !== null && CryptoUtils.isValidKey(key);
    } catch {
      return false;
    }
  }
}