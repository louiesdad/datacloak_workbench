import request from 'supertest';
import express from 'express';

// Mock everything before importing to ensure isolation
jest.mock('../../services/config.service', () => ({
  ConfigService: {
    getInstance: jest.fn()
  }
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

const mockJwtSign = jest.fn().mockReturnValue('mocked-jwt-token');
jest.mock('jsonwebtoken', () => ({
  sign: mockJwtSign,
  verify: jest.fn()
}));

// Now import after mocking
import authRoutes from '../auth.routes';
import { ConfigService } from '../../services/config.service';
import * as bcrypt from 'bcrypt';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes - Bcrypt Password Handling', () => {
  let mockConfigService: jest.Mocked<any>;

  beforeEach(() => {
    // Clean slate for each test
    jest.clearAllMocks();
    
    mockConfigService = {
      get: jest.fn()
    };
    
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfigService);
  });

  it('should handle bcrypt hashed passwords correctly', async () => {
    // Mock bcrypt.compare to return true
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Configure config service to return bcrypt hash
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return '$2b$10$abcdefghijklmnopqrstuvwxyz'; // Mock bcrypt hash
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });

    const loginData = {
      username: 'admin',
      password: 'test-password'
    };

    const response = await request(app)
      .post('/auth/login')
      .send(loginData)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('expiresIn', 3600);
    
    // Debug: Check if JWT.sign was called
    console.log('JWT sign calls:', mockJwtSign.mock.calls);
    console.log('Response body:', response.body);
    
    expect(response.body).toHaveProperty('token');
    expect(mockJwtSign).toHaveBeenCalled();
    expect(bcrypt.compare).toHaveBeenCalledWith('test-password', '$2b$10$abcdefghijklmnopqrstuvwxyz');
  });

  it('should reject when bcrypt comparison fails', async () => {
    // Mock bcrypt.compare to return false
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    // Configure config service to return bcrypt hash
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'ADMIN_USERNAME':
          return 'admin';
        case 'ADMIN_PASSWORD':
          return '$2b$10$abcdefghijklmnopqrstuvwxyz'; // Mock bcrypt hash
        case 'JWT_SECRET':
          return 'test-jwt-secret-key-for-testing-purposes-only-32-chars-min';
        default:
          return undefined;
      }
    });

    const loginData = {
      username: 'admin',
      password: 'wrong-password'
    };

    const response = await request(app)
      .post('/auth/login')
      .send(loginData)
      .expect(401);

    expect(response.body).toEqual({
      success: false,
      error: 'Invalid credentials'
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', '$2b$10$abcdefghijklmnopqrstuvwxyz');
  });
});