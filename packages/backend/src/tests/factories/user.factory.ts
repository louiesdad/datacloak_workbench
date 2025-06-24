/**
 * User Factory
 * 
 * Generates test user data for authentication, authorization, and user management testing.
 */

import { AbstractFactory, FactoryTraits, TestDataUtils, testRandom } from './base.factory';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'analyst' | 'readonly';
  isActive: boolean;
  permissions: string[];
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
    language: string;
  };
  metadata: {
    createdAt: Date;
    lastLogin?: Date;
    loginCount: number;
    source: string;
  };
}

export class UserFactory extends AbstractFactory<TestUser> {
  build(overrides?: Partial<TestUser>): TestUser {
    const firstName = testRandom.choice(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Alex', 'Emma']);
    const lastName = testRandom.choice(['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Garcia', 'Miller', 'Taylor']);
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${this.sequence()}`;
    const email = `${username}@example.com`;
    const role = testRandom.choice(['admin', 'user', 'analyst', 'readonly'] as const);

    const permissions = this.generatePermissionsForRole(role);

    const base: TestUser = {
      id: this.generateUuid(),
      username,
      email,
      firstName,
      lastName,
      role,
      isActive: testRandom.boolean(0.9), // 90% active users
      permissions,
      preferences: {
        theme: testRandom.choice(['light', 'dark']),
        notifications: testRandom.boolean(0.7), // 70% have notifications enabled
        language: testRandom.choice(['en', 'es', 'fr', 'de'])
      },
      metadata: {
        createdAt: this.generateTimestamp(testRandom.integer(0, 365)),
        lastLogin: testRandom.boolean(0.8) ? this.generateTimestamp(testRandom.integer(0, 30)) : undefined,
        loginCount: testRandom.integer(0, 100),
        source: 'test_factory'
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Generate permissions based on role
   */
  private generatePermissionsForRole(role: string): string[] {
    const allPermissions = [
      'read:data',
      'write:data',
      'delete:data',
      'export:data',
      'read:analytics',
      'write:analytics',
      'read:users',
      'write:users',
      'read:admin',
      'write:admin',
      'read:settings',
      'write:settings'
    ];

    switch (role) {
      case 'admin':
        return [...allPermissions];
      case 'analyst':
        return ['read:data', 'write:data', 'export:data', 'read:analytics', 'write:analytics'];
      case 'user':
        return ['read:data', 'write:data', 'export:data'];
      case 'readonly':
        return ['read:data'];
      default:
        return ['read:data'];
    }
  }

  /**
   * Create an admin user
   */
  createAdmin(overrides?: Partial<TestUser>): TestUser {
    return this.create({
      role: 'admin',
      isActive: true,
      firstName: 'Admin',
      lastName: 'User',
      username: `admin.user.${this.sequence()}`,
      email: `admin.user.${this.sequence()}@example.com`,
      ...overrides
    });
  }

  /**
   * Create a standard user
   */
  createStandardUser(overrides?: Partial<TestUser>): TestUser {
    return this.create({
      role: 'user',
      isActive: true,
      ...overrides
    });
  }

  /**
   * Create an analyst user
   */
  createAnalyst(overrides?: Partial<TestUser>): TestUser {
    return this.create({
      role: 'analyst',
      isActive: true,
      firstName: 'Data',
      lastName: 'Analyst',
      ...overrides
    });
  }

  /**
   * Create an inactive user
   */
  createInactiveUser(overrides?: Partial<TestUser>): TestUser {
    return this.create({
      isActive: false,
      metadata: {
        ...this.create().metadata,
        lastLogin: this.generateTimestamp(testRandom.integer(90, 365)) // Last login 3+ months ago
      },
      ...overrides
    });
  }

  /**
   * Create a user with specific permissions
   */
  createWithPermissions(permissions: string[], overrides?: Partial<TestUser>): TestUser {
    return this.create({
      permissions,
      ...overrides
    });
  }

  /**
   * Create a batch of users with different roles
   */
  createUserTeam(size: number = 5): TestUser[] {
    const users: TestUser[] = [];
    
    // Always include one admin
    users.push(this.createAdmin());
    
    // Add analysts and regular users
    for (let i = 1; i < size; i++) {
      const role = testRandom.choice(['user', 'analyst', 'readonly'] as const);
      users.push(this.create({ role }));
    }
    
    return users;
  }
}

// Export factory instance
export const userFactory = new UserFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('user', userFactory);