import { EventEmitter } from 'events';

export class MockRedisInstance extends EventEmitter {
  store = new Map<string, any>();
  ttlStore = new Map<string, number>();
  expirations = new Map<string, number>(); // Alias for ttlStore for test compatibility
  
  constructor() {
    super();
    // Link expirations to ttlStore for backward compatibility
    this.expirations = this.ttlStore;
    
    // Emit connect and ready events after a small delay to simulate Redis connection
    setImmediate(() => {
      this.emit('connect');
      this.emit('ready');
      this.emit('connected'); // For RedisJobQueueService compatibility
    });
  }
  
  async get(key: string) {
    // Check if key has expired
    if (this.ttlStore.has(key)) {
      const expiry = this.ttlStore.get(key)!;
      if (Date.now() > expiry) {
        this.store.delete(key);
        this.ttlStore.delete(key);
        return null;
      }
    }
    return this.store.get(key) || null;
  }
  
  async set(key: string, value: any, ...args: any[]) {
    this.store.set(key, value);
    
    // Handle EX option (expire in seconds)
    if (args.length >= 2 && args[0] === 'EX') {
      const seconds = parseInt(args[1]);
      const expiry = Date.now() + (seconds * 1000);
      this.ttlStore.set(key, expiry);
    }
    
    return 'OK';
  }
  
  async setex(key: string, seconds: number, value: any) {
    this.store.set(key, value);
    const expiry = Date.now() + (seconds * 1000);
    this.ttlStore.set(key, expiry);
    return 'OK';
  }
  
  async exists(key: string) {
    // Check if key has expired
    if (this.ttlStore.has(key)) {
      const expiry = this.ttlStore.get(key)!;
      if (Date.now() > expiry) {
        this.store.delete(key);
        this.ttlStore.delete(key);
        return 0;
      }
    }
    return this.store.has(key) ? 1 : 0;
  }
  
  async expire(key: string, seconds: number) {
    if (this.store.has(key)) {
      const expiry = Date.now() + (seconds * 1000);
      this.ttlStore.set(key, expiry);
      return 1;
    }
    return 0;
  }
  
  async ttl(key: string) {
    if (!this.store.has(key)) return -2; // Key doesn't exist
    
    if (!this.ttlStore.has(key)) return -1; // Key exists but has no expiry
    
    const expiry = this.ttlStore.get(key)!;
    const remainingMs = expiry - Date.now();
    
    if (remainingMs <= 0) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return -2; // Key expired and deleted
    }
    
    return Math.ceil(remainingMs / 1000); // Return remaining seconds
  }
  
  async del(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];
    let deleted = 0;
    
    for (const k of keys) {
      if (this.store.has(k)) {
        this.store.delete(k);
        this.ttlStore.delete(k);
        deleted++;
      }
    }
    
    return deleted;
  }
  
  async mget(...keys: string[]) {
    const results: (string | null)[] = [];
    for (const key of keys) {
      results.push(await this.get(key));
    }
    return results;
  }
  
  async mset(...keyValues: string[]) {
    for (let i = 0; i < keyValues.length; i += 2) {
      const key = keyValues[i];
      const value = keyValues[i + 1];
      await this.set(key, value);
    }
    return 'OK';
  }
  
  async hset(hash: string, field: string, value: string) {
    let hashStore = this.store.get(hash);
    if (!hashStore || !(hashStore instanceof Map)) {
      hashStore = new Map();
      this.store.set(hash, hashStore);
    }
    hashStore.set(field, value);
    return 1;
  }
  
  async hget(hash: string, field: string) {
    const hashStore = this.store.get(hash);
    if (hashStore && hashStore instanceof Map) {
      return hashStore.get(field) || null;
    }
    return null;
  }
  
  async hgetall(hash: string) {
    const hashStore = this.store.get(hash);
    if (!hashStore) return null;
    
    const result: any = {};
    for (const [field, value] of hashStore.entries()) {
      result[field] = value;
    }
    return result;
  }
  
  async hdel(hash: string, field: string) {
    const hashStore = this.store.get(hash);
    if (hashStore) {
      hashStore.delete(field);
      return 1;
    }
    return 0;
  }
  
  async hkeys(key: string) {
    const hash = this.store.get(key);
    if (hash && hash instanceof Map) {
      const keys = Array.from(hash.keys());
      return keys;
    }
    // Always return empty array if no hash exists
    return [];
  }
  
  async hincrby(hash: string, field: string, increment: number) {
    let hashStore = this.store.get(hash);
    if (!hashStore || !(hashStore instanceof Map)) {
      hashStore = new Map();
      this.store.set(hash, hashStore);
    }
    const current = parseInt(hashStore.get(field) || '0');
    const newValue = current + increment;
    hashStore.set(field, String(newValue));
    return newValue;
  }
  
  async zadd(key: string, score: number, member: string) {
    let sortedSet = this.store.get(key);
    if (!sortedSet || !(sortedSet instanceof Map)) {
      sortedSet = new Map();
      this.store.set(key, sortedSet);
    }
    sortedSet.set(member, score);
    return 1;
  }
  
  async zrange(key: string, start: number, stop: number) {
    const sortedSet = this.store.get(key);
    if (!sortedSet) return [];
    
    const entries = Array.from(sortedSet.entries()) as [string, number][];
    entries.sort((a, b) => a[1] - b[1]);
    
    return entries.slice(start, stop + 1).map(e => e[0]);
  }
  
  async zrevrange(key: string, start: number, stop: number) {
    const sortedSet = this.store.get(key);
    if (!sortedSet) return [];
    
    const entries = Array.from(sortedSet.entries()) as [string, number][];
    entries.sort((a, b) => b[1] - a[1]);
    
    return entries.slice(start, stop + 1).map(e => e[0]);
  }
  
  async zrem(key: string, member: string) {
    const sortedSet = this.store.get(key);
    if (sortedSet) {
      sortedSet.delete(member);
      return 1;
    }
    return 0;
  }
  
  async zcard(key: string) {
    const sortedSet = this.store.get(key);
    return sortedSet ? sortedSet.size : 0;
  }
  
  async lrange(key: string, start: number, stop: number) {
    const list = this.store.get(key);
    if (!list || !Array.isArray(list)) {
      return [];
    }
    
    // Handle negative indices
    if (stop === -1) stop = list.length - 1;
    return list.slice(start, stop + 1);
  }
  
  async llen(key: string) {
    const list = this.store.get(key);
    return list && Array.isArray(list) ? list.length : 0;
  }
  
  async lpush(key: string, ...values: string[]) {
    let list = this.store.get(key);
    if (!list || !Array.isArray(list)) {
      list = [];
      this.store.set(key, list);
    }
    list.unshift(...values.reverse());
    return list.length;
  }

  async rpush(key: string, ...values: string[]) {
    let list = this.store.get(key);
    if (!list || !Array.isArray(list)) {
      list = [];
      this.store.set(key, list);
    }
    list.push(...values);
    return list.length;
  }
  
  async lrem(key: string, count: number, element: string) {
    const list = this.store.get(key);
    if (!list || !Array.isArray(list)) return 0;
    
    let removed = 0;
    if (count === 0) {
      // Remove all occurrences
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === element) {
          list.splice(i, 1);
          removed++;
        }
      }
    }
    return removed;
  }
  
  async publish(channel: string, message: string) {
    this.emit('message', channel, message);
    return 1;
  }
  
  async subscribe(...channels: string[]) {
    for (const channel of channels) {
      this.emit('subscribe', channel, 1);
    }
    return channels.length;
  }
  
  async unsubscribe(...channels: string[]) {
    for (const channel of channels) {
      this.emit('unsubscribe', channel, 0);
    }
    return channels.length;
  }
  
  async keys(pattern: string) {
    const allKeys = Array.from(this.store.keys());
    if (pattern === '*') return allKeys;
    
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter(key => regex.test(key));
  }
  
  async scan(cursor: string, ...args: any[]) {
    const keys = await this.keys('*');
    return ['0', keys];
  }
  
  async flushdb() {
    this.store.clear();
    this.ttlStore.clear();
    return 'OK';
  }

  async dbsize() {
    return this.store.size;
  }
  
  async flushall() {
    this.store.clear();
    this.ttlStore.clear();
    return 'OK';
  }
  
  checkExpiration(key: string): void {
    if (this.ttlStore.has(key)) {
      const expiry = this.ttlStore.get(key)!;
      if (Date.now() > expiry) {
        this.store.delete(key);
        this.ttlStore.delete(key);
      }
    }
  }
  
  checkAllExpirations(): void {
    for (const [key] of this.ttlStore.entries()) {
      this.checkExpiration(key);
    }
  }
  
  multi() {
    const commands: any[] = [];
    const multi = {
      set: (key: string, value: any, ...args: any[]) => {
        commands.push(['set', key, value, ...args]);
        return multi;
      },
      setex: (key: string, seconds: number, value: any) => {
        commands.push(['setex', key, seconds, value]);
        return multi;
      },
      get: (key: string) => {
        commands.push(['get', key]);
        return multi;
      },
      del: (key: string | string[]) => {
        commands.push(['del', key]);
        return multi;
      },
      exists: (key: string) => {
        commands.push(['exists', key]);
        return multi;
      },
      expire: (key: string, seconds: number) => {
        commands.push(['expire', key, seconds]);
        return multi;
      },
      ttl: (key: string) => {
        commands.push(['ttl', key]);
        return multi;
      },
      zrem: (key: string, member: string) => {
        commands.push(['zrem', key, member]);
        return multi;
      },
      lrem: (key: string, count: number, element: string) => {
        commands.push(['lrem', key, count, element]);
        return multi;
      },
      lpush: (key: string, ...values: string[]) => {
        commands.push(['lpush', key, ...values]);
        return multi;
      },
      rpush: (key: string, ...values: string[]) => {
        commands.push(['rpush', key, ...values]);
        return multi;
      },
      zadd: (key: string, score: number, member: string) => {
        commands.push(['zadd', key, score, member]);
        return multi;
      },
      hset: (key: string, field: string, value: string) => {
        commands.push(['hset', key, field, value]);
        return multi;
      },
      hdel: (key: string, ...fields: string[]) => {
        commands.push(['hdel', key, ...fields]);
        return multi;
      },
      hincrby: (key: string, field: string, increment: number) => {
        commands.push(['hincrby', key, field, increment]);
        return multi;
      },
      exec: async () => {
        const results: any[] = [];
        for (const [cmd, ...args] of commands) {
          try {
            const result = await (this as any)[cmd](...args);
            results.push([null, result]);
          } catch (error) {
            results.push([error, null]);
          }
        }
        return results;
      }
    };
    return multi;
  }
  
  duplicate() {
    const newInstance = new MockRedisInstance();
    // Override constructor name for test compatibility
    Object.defineProperty(newInstance.constructor, 'name', { value: 'MockRedis' });
    return newInstance;
  }
  
  async disconnect() {
    this.store.clear();
    this.ttlStore.clear();
    this.emit('end');
  }
  
  async quit() {
    this.store.clear();
    this.ttlStore.clear();
    this.emit('end');
    return 'OK';
  }
  
  on(event: string, listener: (...args: any[]) => void) {
    return super.on(event, listener);
  }
}

// Create the mock constructor
const RedisMock = jest.fn().mockImplementation(() => new MockRedisInstance());

// Default export mimics ioredis constructor
export default RedisMock;

// Named export for the Redis type
export { RedisMock as Redis };

// Also export the type for TypeScript
export type Redis = MockRedisInstance;