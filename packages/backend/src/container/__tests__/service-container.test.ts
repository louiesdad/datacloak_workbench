import { ServiceContainer, getContainer, resetContainer } from '../service-container';
import { SERVICE_TOKENS } from '../interfaces';

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(() => {
    container.clear();
    resetContainer();
  });

  describe('basic registration and resolution', () => {
    it('should register and resolve a simple service', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      container.register({
        token: 'TestService',
        implementation: TestService
      });

      const instance = container.resolve<TestService>('TestService');
      expect(instance).toBeInstanceOf(TestService);
      expect((instance as any).getValue()).toBe('test');
    });

    it('should return same instance for singleton services', () => {
      class TestService {}

      container.register({
        token: 'TestService',
        implementation: TestService,
        singleton: true
      });

      const instance1 = container.resolve('TestService');
      const instance2 = container.resolve('TestService');

      expect(instance1).toBe(instance2);
    });

    it('should return different instances for non-singleton services', () => {
      class TestService {}

      container.register({
        token: 'TestService',
        implementation: TestService,
        singleton: false
      });

      const instance1 = container.resolve('TestService');
      const instance2 = container.resolve('TestService');

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('provider registration', () => {
    it('should register with useClass', () => {
      class TestService {
        getValue() {
          return 'test';
        }
      }

      container.registerProvider({
        provide: 'TestService',
        useClass: TestService
      });

      const instance = container.resolve<TestService>('TestService');
      expect((instance as any).getValue()).toBe('test');
    });

    it('should register with useFactory', () => {
      container.registerProvider({
        provide: 'TestService',
        useFactory: () => ({ getValue: () => 'factory' })
      });

      const instance = container.resolve<any>('TestService');
      expect(instance.getValue()).toBe('factory');
    });

    it('should register with useValue', () => {
      const testValue = { getValue: () => 'value' };

      container.registerProvider({
        provide: 'TestService',
        useValue: testValue
      });

      const instance = container.resolve('TestService');
      expect(instance).toBe(testValue);
      expect(instance.getValue()).toBe('value');
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies', () => {
      class DatabaseService {
        connect() {
          return 'connected';
        }
      }

      class UserService {
        constructor(private db: DatabaseService) {}
        
        getUsers() {
          return `users from ${this.db.connect()}`;
        }
      }

      container.register({
        token: 'DatabaseService',
        implementation: DatabaseService
      });

      container.register({
        token: 'UserService',
        implementation: UserService,
        dependencies: ['DatabaseService']
      });

      const userService = container.resolve<UserService>('UserService');
      expect(userService.getUsers()).toBe('users from connected');
    });

    it('should inject factory dependencies', () => {
      class ConfigService {
        get(key: string) {
          return `config-${key}`;
        }
      }

      container.registerProvider({
        provide: 'ConfigService',
        useClass: ConfigService
      });

      container.registerProvider({
        provide: 'LoggerService',
        useFactory: (config: ConfigService) => ({
          log: (msg: string) => `${config.get('logLevel')}: ${msg}`
        }),
        deps: ['ConfigService']
      });

      const logger = container.resolve<any>('LoggerService');
      expect(logger.log('test')).toBe('config-logLevel: test');
    });

    it('should handle nested dependencies', () => {
      class ConfigService {
        getValue() {
          return 'config';
        }
      }

      class DatabaseService {
        constructor(private config: ConfigService) {}
        
        connect() {
          return `connected-${this.config.getValue()}`;
        }
      }

      class UserService {
        constructor(private db: DatabaseService) {}
        
        getUsers() {
          return `users-${this.db.connect()}`;
        }
      }

      container.register({
        token: 'ConfigService',
        implementation: ConfigService
      });

      container.register({
        token: 'DatabaseService',
        implementation: DatabaseService,
        dependencies: ['ConfigService']
      });

      container.register({
        token: 'UserService',
        implementation: UserService,
        dependencies: ['DatabaseService']
      });

      const userService = container.resolve<UserService>('UserService');
      expect(userService.getUsers()).toBe('users-connected-config');
    });
  });

  describe('symbol tokens', () => {
    it('should work with symbol tokens', () => {
      const TEST_TOKEN = Symbol('TestService');
      
      class TestService {
        getValue() {
          return 'symbol-test';
        }
      }

      container.register({
        token: TEST_TOKEN,
        implementation: TestService
      });

      const instance = container.resolve<TestService>(TEST_TOKEN);
      expect(instance.getValue()).toBe('symbol-test');
    });

    it('should work with predefined service tokens', () => {
      class LoggerService {
        log(msg: string) {
          return `logged: ${msg}`;
        }
      }

      container.register({
        token: SERVICE_TOKENS.Logger,
        implementation: LoggerService
      });

      const logger = container.resolve<LoggerService>(SERVICE_TOKENS.Logger);
      expect(logger.log('test')).toBe('logged: test');
    });
  });

  describe('error handling', () => {
    it('should throw error for unregistered service', () => {
      expect(() => {
        container.resolve('NonExistentService');
      }).toThrow('No provider found for NonExistentService');
    });

    it('should detect circular dependencies', () => {
      class ServiceA {
        constructor(public serviceB: ServiceB) {}
      }

      class ServiceB {
        constructor(public serviceA: ServiceA) {}
      }

      container.register({
        token: 'ServiceA',
        implementation: ServiceA,
        dependencies: ['ServiceB']
      });

      container.register({
        token: 'ServiceB',
        implementation: ServiceB,
        dependencies: ['ServiceA']
      });

      expect(() => {
        container.resolve('ServiceA');
      }).toThrow('Circular dependency detected while resolving ServiceA');
    });

    it('should throw error for invalid service descriptor', () => {
      container.register({
        token: 'InvalidService',
        implementation: null as any
      });

      expect(() => {
        container.resolve('InvalidService');
      }).toThrow('Invalid service descriptor for InvalidService');
    });
  });

  describe('utility methods', () => {
    it('should check if service exists', () => {
      class TestService {}

      container.register({
        token: 'TestService',
        implementation: TestService
      });

      expect(container.has('TestService')).toBe(true);
      expect(container.has('NonExistentService')).toBe(false);
    });

    it('should resolve all instances of a token', () => {
      class ServiceImpl1 {
        getId() {
          return 1;
        }
      }

      class ServiceImpl2 {
        getId() {
          return 2;
        }
      }

      container.register({
        token: 'Service1',
        implementation: ServiceImpl1
      });

      container.register({
        token: 'Service2',
        implementation: ServiceImpl2
      });

      // This is a bit contrived since resolveAll looks for exact token matches
      const services = container.resolveAll('Service1');
      expect(services).toHaveLength(1);
      expect(services[0].getId()).toBe(1);
    });

    it('should clear all services', () => {
      class TestService {}

      container.register({
        token: 'TestService',
        implementation: TestService
      });

      expect(container.has('TestService')).toBe(true);

      container.clear();

      expect(container.has('TestService')).toBe(false);
    });
  });

  describe('global container', () => {
    it('should return singleton global container', () => {
      const container1 = getContainer();
      const container2 = getContainer();

      expect(container1).toBe(container2);
    });

    it('should reset global container', () => {
      const container1 = getContainer();
      container1.register({
        token: 'TestService',
        implementation: class {}
      });

      expect(container1.has('TestService')).toBe(true);

      resetContainer();

      const container2 = getContainer();
      expect(container2.has('TestService')).toBe(false);
    });
  });

  describe('complex scenarios', () => {
    it('should handle factory with multiple dependencies', () => {
      class ConfigService {
        get(key: string) {
          return `config-${key}`;
        }
      }

      class DatabaseService {
        query() {
          return 'query-result';
        }
      }

      container.registerProvider({
        provide: 'ConfigService',
        useClass: ConfigService
      });

      container.registerProvider({
        provide: 'DatabaseService',
        useClass: DatabaseService
      });

      container.registerProvider({
        provide: 'ComplexService',
        useFactory: (config: ConfigService, db: DatabaseService) => ({
          process: () => `${config.get('env')}-${db.query()}`
        }),
        deps: ['ConfigService', 'DatabaseService']
      });

      const service = container.resolve<any>('ComplexService');
      expect(service.process()).toBe('config-env-query-result');
    });

    it('should handle mixed singleton and non-singleton services', () => {
      class SingletonService {
        private static counter = 0;
        public id: number;

        constructor() {
          this.id = ++SingletonService.counter;
        }
      }

      class TransientService {
        private static counter = 0;
        public id: number;

        constructor() {
          this.id = ++TransientService.counter;
        }
      }

      container.register({
        token: 'SingletonService',
        implementation: SingletonService,
        singleton: true
      });

      container.register({
        token: 'TransientService',
        implementation: TransientService,
        singleton: false
      });

      const singleton1 = container.resolve<SingletonService>('SingletonService');
      const singleton2 = container.resolve<SingletonService>('SingletonService');
      const transient1 = container.resolve<TransientService>('TransientService');
      const transient2 = container.resolve<TransientService>('TransientService');

      expect(singleton1.id).toBe(singleton2.id);
      expect(transient1.id).not.toBe(transient2.id);
    });
  });
});