export interface ServiceConstructor<T = any> {
  new (...args: any[]): T;
}

export interface ServiceDescriptor<T = any> {
  token: string | symbol | ServiceConstructor<T>;
  implementation: ServiceConstructor<T>;
  singleton?: boolean;
  factory?: () => T;
  dependencies?: Array<string | symbol | ServiceConstructor>;
}

export interface ServiceProvider {
  provide: string | symbol | ServiceConstructor;
  useClass?: ServiceConstructor;
  useFactory?: (...args: any[]) => any;
  useValue?: any;
  deps?: Array<string | symbol | ServiceConstructor>;
  singleton?: boolean;
}

export interface IServiceContainer {
  register<T>(descriptor: ServiceDescriptor<T>): void;
  registerProvider(provider: ServiceProvider): void;
  resolve<T>(token: string | symbol | ServiceConstructor<T>): T;
  resolveAll<T>(token: string | symbol | ServiceConstructor<T>): T[];
  has(token: string | symbol | ServiceConstructor): boolean;
  clear(): void;
}

export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  child(meta: any): ILogger;
}

export interface IConfigService {
  get<T = any>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  reload(): Promise<void>;
}

export interface IRateLimiter {
  consume(key: string, points?: number): Promise<boolean>;
  reset(key: string): Promise<void>;
  getRemaining(key: string): Promise<number>;
}

export interface ICacheService {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export interface IDatabaseService {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  run(sql: string, params?: any[]): Promise<{ changes: number; lastID: number }>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface IEventService {
  emit(event: string, data?: any): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
}

export interface IJobQueueService {
  add<T = any>(type: string, data: T, options?: any): Promise<string>;
  process<T = any>(type: string, handler: (job: any) => Promise<void>): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getJob(id: string): Promise<any>;
  removeJob(id: string): Promise<boolean>;
}

// Service tokens
export const SERVICE_TOKENS = {
  Logger: Symbol('Logger'),
  Config: Symbol('Config'),
  RateLimiter: Symbol('RateLimiter'),
  Cache: Symbol('Cache'),
  Database: Symbol('Database'),
  EventBus: Symbol('EventBus'),
  JobQueue: Symbol('JobQueue'),
  Container: Symbol('Container')
} as const;