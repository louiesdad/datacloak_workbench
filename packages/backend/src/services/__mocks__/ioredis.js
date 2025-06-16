// Mock for ioredis to enable testing without Redis dependency

class MockRedis {
  constructor() {
    this.connected = false;
    this.store = new Map();
  }

  async connect() {
    this.connected = true;
    return 'OK';
  }

  async disconnect() {
    this.connected = false;
    return 'OK';
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value, ...args) {
    this.store.set(key, value);
    return 'OK';
  }

  async del(key) {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async keys(pattern) {
    if (pattern === '*') {
      return Array.from(this.store.keys());
    }
    // Simple pattern matching for test purposes
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async flushall() {
    this.store.clear();
    return 'OK';
  }

  async expire(key, seconds) {
    // For testing, we don't implement actual expiration
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key) {
    return this.store.has(key) ? -1 : -2; // -1 = no expiry, -2 = doesn't exist
  }

  async info() {
    return 'redis_version:6.0.0\r\nconnected_clients:1\r\n';
  }

  async ping() {
    return 'PONG';
  }

  on(event, handler) {
    // Mock event handling
    if (event === 'ready') {
      setTimeout(handler, 10);
    }
    return this;
  }

  off(event, handler) {
    return this;
  }
}

module.exports = MockRedis;
module.exports.default = MockRedis;