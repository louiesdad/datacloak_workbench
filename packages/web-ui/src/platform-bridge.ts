// Platform Bridge Interface
// This provides a unified API for the web app to interact with different platforms
// (Electron, browser extension, web app, etc.)

export interface PlatformCapabilities {
  hasFileSystemAccess: boolean;
  hasNotifications: boolean;
  hasSystemTray: boolean;
  hasMenuBar: boolean;
  canMinimizeToTray: boolean;
  platform: 'electron' | 'browser' | 'extension';
}

export interface FileSystemAPI {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  selectFile: (filters?: FileFilter[]) => Promise<string | null>;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface NotificationAPI {
  show: (title: string, body: string, options?: NotificationOptions) => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export interface NotificationOptions {
  icon?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}

export interface PlatformBridge {
  capabilities: PlatformCapabilities;
  fileSystem?: FileSystemAPI;
  notifications?: NotificationAPI;
  
  // Platform-specific methods
  minimizeToTray?: () => void;
  showWindow?: () => void;
  quit?: () => void;
  
  // Event listeners
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  emit: (event: string, ...args: any[]) => void;
}

// Type declaration for the global electronAPI if running in Electron
declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      versions: any;
      send: (channel: string, data: any) => void;
      receive: (channel: string, func: Function) => void;
    };
    platformBridge: PlatformBridge;
  }
}

// Event emitter implementation
class EventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, handler: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}

// Browser implementation
class BrowserPlatformBridge extends EventEmitter implements PlatformBridge {
  capabilities: PlatformCapabilities = {
    hasFileSystemAccess: false,
    hasNotifications: 'Notification' in window,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser'
  };

  notifications: NotificationAPI = {
    show: async (title: string, body: string, options?: NotificationOptions) => {
      if (this.capabilities.hasNotifications && Notification.permission === 'granted') {
        new Notification(title, { body, ...options });
      }
    },
    requestPermission: async () => {
      if (this.capabilities.hasNotifications) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
    }
  };
}

// Electron implementation
class ElectronPlatformBridge extends EventEmitter implements PlatformBridge {
  capabilities: PlatformCapabilities = {
    hasFileSystemAccess: true,
    hasNotifications: true,
    hasSystemTray: true,
    hasMenuBar: true,
    canMinimizeToTray: true,
    platform: 'electron'
  };

  fileSystem: FileSystemAPI = {
    readFile: async (path: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('fs:readFile', { path });
        window.electronAPI!.receive('fs:readFile:response', (data: { error?: string; content?: string }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve(data.content!);
          }
        });
      });
    },
    writeFile: async (path: string, content: string) => {
      return new Promise((resolve, reject) => {
        window.electronAPI!.send('fs:writeFile', { path, content });
        window.electronAPI!.receive('fs:writeFile:response', (data: { error?: string }) => {
          if (data.error) {
            reject(new Error(data.error));
          } else {
            resolve();
          }
        });
      });
    },
    selectDirectory: async () => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:selectDirectory', {});
        window.electronAPI!.receive('fs:selectDirectory:response', (data: { path?: string }) => {
          resolve(data.path || null);
        });
      });
    },
    selectFile: async (filters?: FileFilter[]) => {
      return new Promise((resolve) => {
        window.electronAPI!.send('fs:selectFile', { filters });
        window.electronAPI!.receive('fs:selectFile:response', (data: { path?: string }) => {
          resolve(data.path || null);
        });
      });
    }
  };

  notifications: NotificationAPI = {
    show: async (title: string, body: string, options?: NotificationOptions) => {
      window.electronAPI!.send('notification:show', { title, body, options });
    },
    requestPermission: async () => {
      return true; // Electron doesn't need permission
    }
  };

  minimizeToTray = () => {
    window.electronAPI!.send('window:minimizeToTray', {});
  };

  showWindow = () => {
    window.electronAPI!.send('window:show', {});
  };

  quit = () => {
    window.electronAPI!.send('app:quit', {});
  };
}

// Platform detection and bridge initialization
export function initializePlatformBridge(): PlatformBridge {
  if (window.electronAPI) {
    return new ElectronPlatformBridge();
  } else {
    return new BrowserPlatformBridge();
  }
}

// Initialize the bridge on import
if (typeof window !== 'undefined') {
  window.platformBridge = initializePlatformBridge();
}