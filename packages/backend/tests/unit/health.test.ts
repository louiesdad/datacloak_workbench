import { getSQLiteConnection } from '../../src/database/sqlite';

// Mock the database connection
jest.mock('../../src/database/sqlite');

describe('Health Routes', () => {

  it('should return health status with database check', async () => {
    // Import the health route handler
    const { createApp } = require('../../src/app');
    const request = require('supertest');
    
    const app = createApp();
    
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('environment');
  });

  it('should check service dependencies', async () => {
    const { createApp } = require('../../src/app');
    const request = require('supertest');
    
    // Mock successful database connection
    (getSQLiteConnection as jest.Mock).mockReturnValue({
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue({ result: 1 })
      })
    });

    const app = createApp();
    
    const response = await request(app)
      .get('/api/v1/health/status')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
  });

  it('should handle database connection failure gracefully', async () => {
    const { createApp } = require('../../src/app');
    const request = require('supertest');
    
    // Mock failed database connection
    (getSQLiteConnection as jest.Mock).mockReturnValue(null);

    const app = createApp();
    
    const response = await request(app)
      .get('/api/v1/health/status')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
    expect(response.body.services).toHaveProperty('database');
  });
});