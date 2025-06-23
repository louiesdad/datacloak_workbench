import { v4 as uuidv4 } from 'uuid';
import { Factory, TestDataOptions } from './types';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface TestAuthToken {
  token: string;
  userId: string;
  expiresAt: string;
  scope: string[];
}

class UserFactory implements Factory<TestUser> {
  create(options: TestDataOptions = {}): TestUser {
    const id = uuidv4();
    const now = new Date().toISOString();
    const index = options.seed || Math.floor(Math.random() * 1000);
    
    return {
      id,
      username: options.overrides?.username || `testuser${index}`,
      email: options.overrides?.email || `testuser${index}@example.com`,
      password: options.overrides?.password || 'test-password-123',
      role: options.overrides?.role || 'user',
      isActive: options.overrides?.isActive ?? true,
      createdAt: now,
      lastLogin: options.overrides?.lastLogin,
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestUser[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        ...options,
        seed: (options.seed || 0) + index
      })
    );
  }

  build(overrides: Partial<TestUser> = {}): TestUser {
    return this.create({ overrides });
  }

  createAdmin(): TestUser {
    return this.create({
      overrides: {
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin' as const,
        password: 'admin-password-123'
      }
    });
  }

  createInactive(): TestUser {
    return this.create({
      overrides: {
        isActive: false
      }
    });
  }
}

class AuthTokenFactory implements Factory<TestAuthToken> {
  create(options: TestDataOptions = {}): TestAuthToken {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now
    
    return {
      token: options.overrides?.token || `test-token-${uuidv4()}`,
      userId: options.overrides?.userId || uuidv4(),
      expiresAt: expiresAt.toISOString(),
      scope: options.overrides?.scope || ['read', 'write'],
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestAuthToken[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestAuthToken> = {}): TestAuthToken {
    return this.create({ overrides });
  }

  createExpired(): TestAuthToken {
    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() - 1); // 1 hour ago
    
    return this.create({
      overrides: {
        expiresAt: expiredAt.toISOString()
      }
    });
  }

  createReadOnly(): TestAuthToken {
    return this.create({
      overrides: {
        scope: ['read']
      }
    });
  }
}

// Export factory instances
export const userFactory = new UserFactory();
export const authTokenFactory = new AuthTokenFactory();