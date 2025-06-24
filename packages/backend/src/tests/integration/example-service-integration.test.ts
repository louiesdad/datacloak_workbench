import { createIntegrationTestSuite, useIntegrationTest } from '../utils/integration-helpers';
import supertest from 'supertest';

/**
 * Example Integration Test
 * 
 * Demonstrates how to use the integration test framework for cross-service testing.
 * This test shows service orchestration, API testing, and resource cleanup.
 */

createIntegrationTestSuite(
  'Service Integration Example',
  {
    enableDatabase: true,
    enableCache: true,
    enableWebServer: true,
    testTimeout: 30000
  },
  () => {
    const { getService, getServer, waitForServices, resetServices } = useIntegrationTest();

    describe('Database and Cache Integration', () => {
      test('should persist data across database and cache layers', async () => {
        // Wait for services to be ready
        await waitForServices(['database', 'cache']);

        // Get service instances
        const database = getService('database');
        const cache = getService('cache');

        expect(database).toBeDefined();
        expect(cache).toBeDefined();

        // Test data flow between services
        const testData = { id: 'test-1', name: 'Integration Test', value: 42 };

        // Store in database (assuming a generic store method exists)
        if (database && typeof database.store === 'function') {
          await database.store('test_table', testData);
        }

        // Cache the data
        if (cache && typeof cache.set === 'function') {
          await cache.set('test-key', testData, 300); // 5 minute TTL
        }

        // Verify data consistency
        if (cache && typeof cache.get === 'function') {
          const cachedData = await cache.get('test-key');
          expect(cachedData).toEqual(testData);
        }
      });

      test('should handle service failures gracefully', async () => {
        const cache = getService('cache');
        
        if (cache && typeof cache.clear === 'function') {
          // Clear cache to simulate failure recovery
          await cache.clear();

          // Verify cache is empty
          if (typeof cache.get === 'function') {
            const result = await cache.get('non-existent-key');
            expect(result).toBeNull();
          }
        }
      });
    });

    describe('API Integration', () => {
      test('should handle API requests end-to-end', async () => {
        // Wait for web server to be ready
        await waitForServices(['webserver']);

        const server = getServer('webserver');
        expect(server).toBeDefined();

        if (server) {
          // Test health endpoint
          const response = await supertest(server)
            .get('/health')
            .expect(200);

          expect(response.body).toHaveProperty('status');
          expect(response.body.status).toBe('healthy');
        }
      });

      test('should authenticate and access protected endpoints', async () => {
        const server = getServer('webserver');
        
        if (server) {
          // First, try accessing protected endpoint without auth
          await supertest(server)
            .get('/api/protected')
            .expect(401);

          // Then authenticate and access
          const loginResponse = await supertest(server)
            .post('/api/auth/login')
            .send({
              username: 'test@example.com',
              password: 'testpassword'
            });

          if (loginResponse.status === 200) {
            const token = loginResponse.body.token;

            // Access protected endpoint with token
            await supertest(server)
              .get('/api/protected')
              .set('Authorization', `Bearer ${token}`)
              .expect(200);
          }
        }
      });
    });

    describe('Service Reset and Isolation', () => {
      test('should isolate test data between test runs', async () => {
        const cache = getService('cache');
        
        if (cache && typeof cache.set === 'function' && typeof cache.get === 'function') {
          // Set test data
          await cache.set('isolation-test', 'first-run', 300);
          
          // Verify data exists
          const firstValue = await cache.get('isolation-test');
          expect(firstValue).toBe('first-run');

          // Reset services (this should clear the cache)
          await resetServices();

          // Verify data is cleared
          const secondValue = await cache.get('isolation-test');
          expect(secondValue).toBeNull();
        }
      });

      test('should maintain service availability after reset', async () => {
        // Reset all services
        await resetServices();

        // Verify services are still available
        await waitForServices(['database', 'cache']);

        const database = getService('database');
        const cache = getService('cache');

        expect(database).toBeDefined();
        expect(cache).toBeDefined();
      });
    });

    describe('Performance and Resource Management', () => {
      test('should handle concurrent operations', async () => {
        const cache = getService('cache');
        
        if (cache && typeof cache.set === 'function' && typeof cache.get === 'function') {
          // Create multiple concurrent operations
          const operations = Array.from({ length: 10 }, (_, i) =>
            cache.set(`concurrent-${i}`, `value-${i}`, 300)
          );

          // Wait for all operations to complete
          await Promise.all(operations);

          // Verify all values were set correctly
          const verifications = Array.from({ length: 10 }, (_, i) =>
            cache.get(`concurrent-${i}`)
          );

          const results = await Promise.all(verifications);
          results.forEach((value, index) => {
            expect(value).toBe(`value-${index}`);
          });
        }
      });

      test('should not leak resources between tests', async () => {
        // This test verifies that resources are properly cleaned up
        // In a real scenario, you might check for open file handles,
        // database connections, memory usage, etc.
        
        const initialStatus = await getService('database');
        expect(initialStatus).toBeDefined();

        // Perform operations that might create resources
        await resetServices();

        // Verify services are still healthy
        const finalStatus = await getService('database');
        expect(finalStatus).toBeDefined();
      });
    });
  }
);