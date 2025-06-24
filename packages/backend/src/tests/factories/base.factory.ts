/**
 * Base Factory System
 * 
 * Provides core factory functionality for generating test data with proper
 * sequencing, relationships, and realistic variations.
 */

import { randomUUID } from 'crypto';

// Seed for consistent test data
const seed = 'test-seed-2024';
let sequenceCounter = 1000;

/**
 * Simple pseudo-random number generator for consistent test data
 */
export class TestRandom {
  private seed: number;

  constructor(seedValue?: string) {
    this.seed = this.hashCode(seedValue || seed);
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  integer(min: number = 0, max: number = 100): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number = 0, max: number = 1): number {
    return this.next() * (max - min) + min;
  }

  boolean(): boolean {
    return this.next() > 0.5;
  }

  choice<T>(array: T[]): T {
    return array[this.integer(0, array.length - 1)];
  }

  string(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.integer(0, chars.length - 1)];
    }
    return result;
  }

  email(): string {
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.io'];
    const username = this.string(8).toLowerCase();
    const domain = this.choice(domains);
    return `${username}@${domain}`;
  }

  phone(): string {
    return `555-${this.integer(100, 999)}-${this.integer(1000, 9999)}`;
  }
}

/**
 * Base factory interface
 */
export interface BaseFactory<T> {
  create(overrides?: Partial<T>): T;
  createMany(count: number, overrides?: Partial<T>): T[];
  sequence(): number;
  reset(): void;
}

/**
 * Abstract base factory implementation
 */
export abstract class AbstractFactory<T> implements BaseFactory<T> {
  protected random: TestRandom;
  protected sequenceCounter: number = 1000;

  constructor(seedValue?: string) {
    this.random = new TestRandom(seedValue);
  }

  abstract build(overrides?: Partial<T>): T;

  create(overrides?: Partial<T>): T {
    return this.build(overrides);
  }

  createMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  sequence(): number {
    return ++this.sequenceCounter;
  }

  reset(): void {
    this.sequenceCounter = 1000;
    this.random = new TestRandom(seed);
  }

  protected merge<U>(base: U, overrides?: Partial<U>): U {
    return { ...base, ...overrides };
  }

  protected generateId(): string {
    return `test-${this.sequenceCounter}-${this.random.string(8)}`;
  }

  protected generateUuid(): string {
    return randomUUID();
  }

  protected generateTimestamp(daysAgo: number = 0): Date {
    const now = new Date();
    now.setDate(now.getDate() - daysAgo);
    now.setHours(this.random.integer(0, 23));
    now.setMinutes(this.random.integer(0, 59));
    now.setSeconds(this.random.integer(0, 59));
    return now;
  }
}

/**
 * Factory registry for managing factory instances
 */
export class FactoryRegistry {
  private static factories: Map<string, BaseFactory<any>> = new Map();

  static register<T>(name: string, factory: BaseFactory<T>): void {
    this.factories.set(name, factory);
  }

  static get<T>(name: string): BaseFactory<T> | undefined {
    return this.factories.get(name);
  }

  static create<T>(name: string, overrides?: Partial<T>): T {
    const factory = this.get<T>(name);
    if (!factory) {
      throw new Error(`Factory '${name}' not found`);
    }
    return factory.create(overrides);
  }

  static createMany<T>(name: string, count: number, overrides?: Partial<T>): T[] {
    const factory = this.get<T>(name);
    if (!factory) {
      throw new Error(`Factory '${name}' not found`);
    }
    return factory.createMany(count, overrides);
  }

  static reset(): void {
    for (const factory of this.factories.values()) {
      factory.reset();
    }
  }

  static clear(): void {
    this.factories.clear();
  }
}

/**
 * Common trait mixins for factories
 */
export const FactoryTraits = {
  withTimestamps: <T extends object>(obj: T): T & { createdAt: Date; updatedAt: Date } => ({
    ...obj,
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  withId: <T extends object>(obj: T, id?: string): T & { id: string } => ({
    ...obj,
    id: id || `test-${sequenceCounter++}-${Math.random().toString(36).substr(2, 8)}`
  }),

  withUser: <T extends object>(obj: T, userId?: string): T & { userId: string } => ({
    ...obj,
    userId: userId || `user-${sequenceCounter++}`
  }),

  withMetadata: <T extends object>(obj: T, metadata?: Record<string, any>): T & { metadata: Record<string, any> } => ({
    ...obj,
    metadata: metadata || {
      source: 'test',
      environment: 'test',
      version: '1.0.0'
    }
  })
};

/**
 * Global test random instance for consistent data generation
 */
export const testRandom = new TestRandom();

/**
 * Utility functions for common test data patterns
 */
export const TestDataUtils = {
  /**
   * Generate consistent test data based on a seed
   */
  withSeed<T>(seed: string, generator: () => T): T {
    const oldRandom = new TestRandom(seed);
    return generator();
  },

  /**
   * Create a sequence of related objects
   */
  sequence<T>(count: number, generator: (index: number) => T): T[] {
    return Array.from({ length: count }, (_, index) => generator(index));
  },

  /**
   * Generate realistic text content
   */
  generateText(type: 'positive' | 'negative' | 'neutral' | 'mixed', length: number = 100): string {
    const templates = {
      positive: [
        'This is an excellent product that exceeded my expectations.',
        'I absolutely love this service and would highly recommend it.',
        'Amazing quality and fantastic customer support.',
        'Best purchase I have made in a long time.'
      ],
      negative: [
        'This product is terrible and does not work as advertised.',
        'Worst customer service experience I have ever had.',
        'Complete waste of money and time.',
        'Would not recommend this to anyone.'
      ],
      neutral: [
        'This product meets basic requirements.',
        'The service is adequate for the price.',
        'Nothing particularly special but it works.',
        'Standard quality, as expected.'
      ],
      mixed: [
        'The product is good but the shipping was slow.',
        'Great features but poor customer service.',
        'Love the design but quality could be better.',
        'Works well most of the time but has some issues.'
      ]
    };

    const template = testRandom.choice(templates[type]);
    if (template.length >= length) {
      return template.substring(0, length);
    }

    // Extend template to reach desired length
    let text = template;
    while (text.length < length) {
      text += ' ' + testRandom.choice(templates[type]);
    }
    
    return text.substring(0, length);
  },

  /**
   * Generate realistic personal information (for testing PII detection)
   */
  generatePII() {
    return {
      email: testRandom.email(),
      phone: testRandom.phone(),
      ssn: `${testRandom.integer(100, 999)}-${testRandom.integer(10, 99)}-${testRandom.integer(1000, 9999)}`,
      creditCard: `4${testRandom.integer(100, 999)}-${testRandom.integer(1000, 9999)}-${testRandom.integer(1000, 9999)}-${testRandom.integer(1000, 9999)}`,
      name: `${testRandom.choice(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa'])} ${testRandom.choice(['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Garcia'])}`,
      address: `${testRandom.integer(100, 9999)} ${testRandom.choice(['Main', 'Oak', 'Pine', 'Elm', 'Park'])} St, ${testRandom.choice(['Anytown', 'Springfield', 'Riverside', 'Franklin'])} ${testRandom.choice(['CA', 'NY', 'TX', 'FL'])}`
    };
  }
};