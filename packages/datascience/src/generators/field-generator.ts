import { FieldType } from '../types';

export interface FieldGenerationOptions {
  count: number;
  nullRate?: number;
  uniqueRate?: number;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  patterns?: string[];
  customGenerator?: () => any;
}

export class FieldGenerator {
  private static readonly SAMPLE_NAMES = [
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa',
    'William', 'Jennifer', 'James', 'Mary', 'Christopher', 'Patricia'
  ];

  private static readonly SAMPLE_EMAILS = [
    'john@example.com', 'jane.doe@company.org', 'user123@domain.net',
    'admin@website.com', 'support@service.io', 'info@business.co'
  ];

  private static readonly SAMPLE_URLS = [
    'https://example.com', 'http://website.org', 'https://api.service.io/v1',
    'https://docs.platform.com/guide', 'http://blog.company.net/post'
  ];

  private static readonly SAMPLE_PHONES = [
    '+1-555-123-4567', '(555) 987-6543', '555.246.8101',
    '+44 20 7946 0958', '(202) 555-0173'
  ];

  static generate(type: FieldType, options: FieldGenerationOptions): any[] {
    const { count, nullRate = 0.1 } = options;
    const result: any[] = [];

    for (let i = 0; i < count; i++) {
      if (Math.random() < nullRate) {
        result.push(null);
      } else {
        result.push(this.generateValue(type, options, i));
      }
    }

    return result;
  }

  private static generateValue(type: FieldType, options: FieldGenerationOptions, index: number): any {
    if (options.customGenerator) {
      return options.customGenerator();
    }

    switch (type) {
      case 'string':
        return this.generateString(options);
      case 'number':
        return this.generateNumber(options);
      case 'boolean':
        return Math.random() > 0.5;
      case 'date':
        return this.generateDate();
      case 'email':
        return this.generateEmail(index);
      case 'url':
        return this.generateUrl(index);
      case 'phone':
        return this.generatePhone(index);
      case 'json':
        return this.generateJson();
      case 'array':
        return this.generateArray(options);
      case 'object':
        return this.generateObject();
      default:
        return this.generateString(options);
    }
  }

  private static generateString(options: FieldGenerationOptions): string {
    const { minLength = 5, maxLength = 20, patterns } = options;
    
    if (patterns && patterns.length > 0) {
      return patterns[Math.floor(Math.random() * patterns.length)];
    }

    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result.trim() || 'sample';
  }

  private static generateNumber(options: FieldGenerationOptions): number {
    const { minValue = 0, maxValue = 1000 } = options;
    
    if (Math.random() > 0.7) {
      return Math.random() * (maxValue - minValue) + minValue;
    }
    
    return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
  }

  private static generateDate(): string {
    const start = new Date(2020, 0, 1);
    const end = new Date();
    const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(randomTime).toISOString().split('T')[0];
  }

  private static generateEmail(index: number): string {
    if (index < this.SAMPLE_EMAILS.length) {
      return this.SAMPLE_EMAILS[index];
    }
    
    const name = this.SAMPLE_NAMES[Math.floor(Math.random() * this.SAMPLE_NAMES.length)].toLowerCase();
    const domains = ['example.com', 'test.org', 'sample.net', 'demo.io'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    return `${name}${Math.floor(Math.random() * 100)}@${domain}`;
  }

  private static generateUrl(index: number): string {
    if (index < this.SAMPLE_URLS.length) {
      return this.SAMPLE_URLS[index];
    }
    
    const protocols = ['http://', 'https://'];
    const domains = ['example.com', 'website.org', 'service.io', 'platform.net'];
    const paths = ['', '/api', '/docs', '/blog', '/app'];
    
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    
    return `${protocol}${domain}${path}`;
  }

  private static generatePhone(index: number): string {
    if (index < this.SAMPLE_PHONES.length) {
      return this.SAMPLE_PHONES[index];
    }
    
    const formats = [
      () => `+1-555-${this.randomDigits(3)}-${this.randomDigits(4)}`,
      () => `(555) ${this.randomDigits(3)}-${this.randomDigits(4)}`,
      () => `555.${this.randomDigits(3)}.${this.randomDigits(4)}`,
    ];
    
    const format = formats[Math.floor(Math.random() * formats.length)];
    return format();
  }

  private static generateJson(): string {
    const objects = [
      { id: Math.floor(Math.random() * 1000), status: 'active' },
      { name: this.SAMPLE_NAMES[Math.floor(Math.random() * this.SAMPLE_NAMES.length)], age: Math.floor(Math.random() * 80) + 18 },
      { tags: ['test', 'sample'], count: Math.floor(Math.random() * 100) },
    ];
    
    return JSON.stringify(objects[Math.floor(Math.random() * objects.length)]);
  }

  private static generateArray(options: FieldGenerationOptions): any[] {
    const length = Math.floor(Math.random() * 5) + 1;
    const array: any[] = [];
    
    for (let i = 0; i < length; i++) {
      array.push(this.generateString({ ...options, minLength: 3, maxLength: 10 }));
    }
    
    return array;
  }

  private static generateObject(): Record<string, any> {
    const keys = ['id', 'name', 'status', 'created', 'active'];
    const obj: Record<string, any> = {};
    
    const numKeys = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < numKeys; i++) {
      const key = keys[i];
      obj[key] = i === 0 ? Math.floor(Math.random() * 1000) : this.generateString({ count: 1, minLength: 3, maxLength: 15 });
    }
    
    return obj;
  }

  private static randomDigits(count: number): string {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += Math.floor(Math.random() * 10);
    }
    return result;
  }
}