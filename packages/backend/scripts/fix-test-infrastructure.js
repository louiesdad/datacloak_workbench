#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing test infrastructure issues...\n');

// 1. Create a simple test that should pass to verify infrastructure
const simpleTest = `describe('Infrastructure Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });
  
  it('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });
});
`;

fs.writeFileSync(
  path.join(__dirname, '../src/tests/infrastructure.test.ts'),
  simpleTest
);

// 2. Create tsconfig.test.json if it doesn't exist
const tsconfigTest = {
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"],
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*",
    "tests/**/*"
  ]
};

if (!fs.existsSync(path.join(__dirname, '../tsconfig.test.json'))) {
  fs.writeFileSync(
    path.join(__dirname, '../tsconfig.test.json'),
    JSON.stringify(tsconfigTest, null, 2)
  );
}

// 3. Fix the Redis mock to include all required methods
const redisMock = `// Mock Redis client
class MockRedis {
  private store = new Map();
  private expirations = new Map();
  
  async get(key) {
    this.checkExpiration(key);
    return this.store.get(key) || null;
  }
  
  async set(key, value, ...args) {
    this.store.set(key, value);
    
    // Handle expiration
    if (args[0] === 'EX' && args[1]) {
      const expiresAt = Date.now() + (args[1] * 1000);
      this.expirations.set(key, expiresAt);
    }
    return 'OK';
  }
  
  async setex(key, seconds, value) {
    this.store.set(key, value);
    const expiresAt = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiresAt);
    return 'OK';
  }
  
  async del(key) {
    this.store.delete(key);
    this.expirations.delete(key);
    return 1;
  }
  
  async exists(key) {
    this.checkExpiration(key);
    return this.store.has(key) ? 1 : 0;
  }
  
  async keys(pattern = '*') {
    this.checkAllExpirations();
    const allKeys = Array.from(this.store.keys());
    
    if (pattern === '*') return allKeys;
    
    const regex = new RegExp('^' + pattern.replace(/\\*/g, '.*').replace(/\\?/g, '.') + '$');
    return allKeys.filter(key => regex.test(key));
  }
  
  async scan(cursor = '0', ...args) {
    const keys = await this.keys('*');
    return [0, keys]; // Simplified scan
  }
  
  async flushdb() {
    this.store.clear();
    this.expirations.clear();
    return 'OK';
  }
  
  async flushall() {
    return this.flushdb();
  }
  
  multi() {
    const commands = [];
    const multi = {
      del: (key) => { commands.push(['del', key]); return multi; },
      set: (key, value) => { commands.push(['set', key, value]); return multi; },
      setex: (key, ttl, value) => { commands.push(['setex', key, ttl, value]); return multi; },
      sadd: (key, ...values) => { commands.push(['sadd', key, ...values]); return multi; },
      srem: (key, ...values) => { commands.push(['srem', key, ...values]); return multi; },
      exec: async () => {
        const results = [];
        for (const [cmd, ...args] of commands) {
          if (this[cmd]) {
            results.push(await this[cmd](...args));
          }
        }
        return results;
      }
    };
    return multi;
  }
  
  // Hash operations
  async hset(key, field, value) {
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    const hash = this.store.get(key);
    hash.set(field, value);
    return 1;
  }
  
  async hget(key, field) {
    const hash = this.store.get(key);
    return hash && hash.get ? hash.get(field) || null : null;
  }
  
  async hgetall(key) {
    const hash = this.store.get(key);
    if (!hash || !hash.entries) return {};
    
    const result = {};
    for (const [field, value] of hash.entries()) {
      result[field] = value;
    }
    return result;
  }
  
  async hdel(key, field) {
    const hash = this.store.get(key);
    if (hash && hash.delete) {
      return hash.delete(field) ? 1 : 0;
    }
    return 0;
  }
  
  // List operations
  async lpush(key, ...values) {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const list = this.store.get(key);
    list.unshift(...values.reverse());
    return list.length;
  }
  
  async rpush(key, ...values) {
    if (!this.store.has(key)) {
      this.store.set(key, []);
    }
    const list = this.store.get(key);
    list.push(...values);
    return list.length;
  }
  
  async lpop(key) {
    const list = this.store.get(key);
    return list && list.shift ? list.shift() || null : null;
  }
  
  async rpop(key) {
    const list = this.store.get(key);
    return list && list.pop ? list.pop() || null : null;
  }
  
  async lrange(key, start, stop) {
    const list = this.store.get(key);
    if (!list) return [];
    
    // Handle negative indices
    if (stop === -1) stop = list.length - 1;
    return list.slice(start, stop + 1);
  }
  
  async llen(key) {
    const list = this.store.get(key);
    return list ? list.length : 0;
  }
  
  // Set operations
  async sadd(key, ...members) {
    if (!this.store.has(key)) {
      this.store.set(key, new Set());
    }
    const set = this.store.get(key);
    let added = 0;
    for (const member of members) {
      if (!set.has(member)) {
        set.add(member);
        added++;
      }
    }
    return added;
  }
  
  async srem(key, ...members) {
    const set = this.store.get(key);
    if (!set) return 0;
    
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed++;
      }
    }
    return removed;
  }
  
  async smembers(key) {
    const set = this.store.get(key);
    return set ? Array.from(set) : [];
  }
  
  async sismember(key, member) {
    const set = this.store.get(key);
    return set && set.has(member) ? 1 : 0;
  }
  
  // TTL operations
  async ttl(key) {
    this.checkExpiration(key);
    const expiresAt = this.expirations.get(key);
    if (!expiresAt) return -1;
    
    const ttl = Math.floor((expiresAt - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }
  
  async expire(key, seconds) {
    if (!this.store.has(key)) return 0;
    
    const expiresAt = Date.now() + (seconds * 1000);
    this.expirations.set(key, expiresAt);
    return 1;
  }
  
  // Pub/Sub
  on(event, callback) {
    // Simple event handling for tests
    if (event === 'ready') {
      setTimeout(() => callback(), 0);
    }
  }
  
  async publish(channel, message) {
    return 1; // Number of subscribers
  }
  
  async subscribe(...channels) {
    return channels.length;
  }
  
  // Utility methods
  async ping() {
    return 'PONG';
  }
  
  async quit() {
    return 'OK';
  }
  
  async disconnect() {
    this.store.clear();
    this.expirations.clear();
    return true;
  }
  
  duplicate() {
    return new MockRedis();
  }
  
  // Check expiration for a key
  private checkExpiration(key) {
    const expiresAt = this.expirations.get(key);
    if (expiresAt && Date.now() > expiresAt) {
      this.store.delete(key);
      this.expirations.delete(key);
    }
  }
  
  // Check all expirations
  private checkAllExpirations() {
    for (const [key, expiresAt] of this.expirations.entries()) {
      if (Date.now() > expiresAt) {
        this.store.delete(key);
        this.expirations.delete(key);
      }
    }
  }
}

module.exports = jest.fn(() => new MockRedis());
`;

fs.writeFileSync(
  path.join(__dirname, '../src/services/__mocks__/ioredis.js'),
  redisMock
);

console.log('✅ Created infrastructure test');
console.log('✅ Created/updated tsconfig.test.json');
console.log('✅ Updated Redis mock with all required methods');

console.log('\n📝 Next steps:');
console.log('1. Run: npm test src/tests/infrastructure.test.ts');
console.log('2. If that passes, the infrastructure is working');
console.log('3. Then fix individual test files to match actual service APIs');