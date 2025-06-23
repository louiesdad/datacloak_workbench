import { 
  IServiceContainer, 
  ServiceConstructor, 
  ServiceDescriptor, 
  ServiceProvider 
} from './interfaces';

export class ServiceContainer implements IServiceContainer {
  private services = new Map<any, ServiceDescriptor>();
  private instances = new Map<any, any>();
  private resolving = new Set<any>();

  register<T>(descriptor: ServiceDescriptor<T>): void {
    this.services.set(descriptor.token, descriptor);
  }

  registerProvider(provider: ServiceProvider): void {
    const descriptor: ServiceDescriptor = {
      token: provider.provide,
      implementation: null as any,
      singleton: provider.singleton !== false
    };

    if (provider.useClass) {
      descriptor.implementation = provider.useClass;
      descriptor.dependencies = provider.deps;
    } else if (provider.useFactory) {
      descriptor.factory = () => {
        const deps = this.resolveDependencies(provider.deps || []);
        return provider.useFactory!(...deps);
      };
    } else if (provider.useValue !== undefined) {
      this.instances.set(provider.provide, provider.useValue);
      return;
    }

    this.services.set(provider.provide, descriptor);
  }

  resolve<T>(token: string | symbol | ServiceConstructor<T>): T {
    // Check if we have a direct instance
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if we're already resolving this token (circular dependency)
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected while resolving ${this.getTokenName(token)}`);
    }

    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`No provider found for ${this.getTokenName(token)}`);
    }

    this.resolving.add(token);

    try {
      let instance: T;

      if (descriptor.factory) {
        instance = descriptor.factory();
      } else if (descriptor.implementation) {
        const deps = this.resolveDependencies(descriptor.dependencies || []);
        instance = new descriptor.implementation(...deps);
      } else {
        throw new Error(`Invalid service descriptor for ${this.getTokenName(token)}`);
      }

      if (descriptor.singleton !== false) {
        this.instances.set(token, instance);
      }

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  resolveAll<T>(token: string | symbol | ServiceConstructor<T>): T[] {
    const results: T[] = [];
    
    this.services.forEach((descriptor, key) => {
      if (key === token || 
          (descriptor.implementation && descriptor.implementation === token)) {
        results.push(this.resolve(key));
      }
    });

    return results;
  }

  has(token: string | symbol | ServiceConstructor): boolean {
    return this.services.has(token) || this.instances.has(token);
  }

  clear(): void {
    this.services.clear();
    this.instances.clear();
    this.resolving.clear();
  }

  private resolveDependencies(dependencies: Array<string | symbol | ServiceConstructor>): any[] {
    return dependencies.map(dep => this.resolve(dep));
  }

  private getTokenName(token: any): string {
    if (typeof token === 'string') return token;
    if (typeof token === 'symbol') return token.toString();
    if (typeof token === 'function') return token.name;
    return String(token);
  }
}

// Global singleton instance
let container: ServiceContainer | null = null;

export function getContainer(): ServiceContainer {
  if (!container) {
    container = new ServiceContainer();
  }
  return container;
}

export function resetContainer(): void {
  if (container) {
    container.clear();
  }
  container = null;
}