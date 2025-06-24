import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

test.describe('Multi-File Analysis API Integration E2E', () => {
  let apiContext: APIRequestContext;
  let sessionId: string;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:8000', // Backend API base URL
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test('Complete API workflow - session creation to insights generation', async () => {
    // Step 1: Create Analysis Session
    await test.step('Create analysis session via API', async () => {
      const response = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'API E2E Test Session',
          description: 'End-to-end API testing session'
        }
      });

      expect(response.status()).toBe(201);
      const sessionData = await response.json();
      
      expect(sessionData).toHaveProperty('sessionId');
      expect(sessionData).toHaveProperty('createdAt');
      
      sessionId = sessionData.sessionId;
    });

    // Step 2: Upload Files to Session
    await test.step('Upload multiple files to session', async () => {
      // Upload users.csv
      const usersResponse = await apiContext.post(`/api/v3/sessions/${sessionId}/files`, {
        multipart: {
          file: {
            name: 'users.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(`customer_id,email,name,signup_date
user_001,john@test.com,John Doe,2024-01-15
user_002,jane@test.com,Jane Smith,2024-01-16`)
          }
        }
      });

      expect(usersResponse.status()).toBe(200);
      const usersMetadata = await usersResponse.json();
      
      expect(usersMetadata).toHaveProperty('fileId');
      expect(usersMetadata.filename).toBe('users.csv');
      expect(usersMetadata.rowCount).toBeGreaterThan(0);
      expect(usersMetadata.columns).toBeInstanceOf(Array);

      // Upload orders.csv
      const ordersResponse = await apiContext.post(`/api/v3/sessions/${sessionId}/files`, {
        multipart: {
          file: {
            name: 'orders.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(`order_id,customer_id,total_amount,order_date
ord_001,user_001,149.99,2024-02-01
ord_002,user_002,89.50,2024-02-02`)
          }
        }
      });

      expect(ordersResponse.status()).toBe(200);
      const ordersMetadata = await ordersResponse.json();
      expect(ordersMetadata.filename).toBe('orders.csv');
    });

    // Step 3: Discover Relationships
    await test.step('Discover relationships between files', async () => {
      const response = await apiContext.post(`/api/v3/sessions/${sessionId}/discover`, {
        data: {
          threshold: 0.7,
          async: false // Synchronous for testing
        }
      });

      expect(response.status()).toBe(200);
      const discoveryData = await response.json();
      
      expect(discoveryData).toHaveProperty('relationships');
      expect(discoveryData).toHaveProperty('relationshipGraph');
      expect(discoveryData.relationships).toBeInstanceOf(Array);
      
      // Should find customer_id relationship
      const customerIdRelationship = discoveryData.relationships.find(
        (rel: any) => rel.sourceColumn === 'customer_id' && rel.targetColumn === 'customer_id'
      );
      expect(customerIdRelationship).toBeDefined();
      expect(customerIdRelationship.matchRate).toBeGreaterThan(0.5);
    });

    // Step 4: Analyze Patterns
    await test.step('Analyze behavioral patterns', async () => {
      const response = await apiContext.post(`/api/v3/sessions/${sessionId}/analyze`, {
        data: {
          correlationThreshold: 0.5,
          minSupport: 0.3
        }
      });

      expect(response.status()).toBe(200);
      const patterns = await response.json();
      
      expect(patterns).toBeInstanceOf(Array);
      
      // Check pattern structure
      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern).toHaveProperty('description');
        expect(pattern).toHaveProperty('correlation');
        expect(pattern).toHaveProperty('confidence');
      }
    });

    // Step 5: Get Join Recommendations
    await test.step('Get join recommendations', async () => {
      const response = await apiContext.get(`/api/v3/sessions/${sessionId}/recommendations`);

      expect(response.status()).toBe(200);
      const recommendations = await response.json();
      
      expect(recommendations).toBeInstanceOf(Array);
      
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation).toHaveProperty('files');
        expect(recommendation).toHaveProperty('joinKeys');
        expect(recommendation).toHaveProperty('expectedImprovement');
        expect(recommendation).toHaveProperty('sampleQuery');
        
        // Validate SQL query structure
        expect(recommendation.sampleQuery).toContain('JOIN');
        expect(recommendation.sampleQuery).toContain('SELECT');
      }
    });

    // Step 6: Generate Insights
    await test.step('Generate natural language insights', async () => {
      const response = await apiContext.get(`/api/v3/sessions/${sessionId}/insights`);

      expect(response.status()).toBe(200);
      const insightData = await response.json();
      
      expect(insightData).toHaveProperty('insights');
      expect(insightData).toHaveProperty('summary');
      expect(insightData.insights).toBeInstanceOf(Array);
      
      if (insightData.insights.length > 0) {
        const insight = insightData.insights[0];
        expect(insight).toHaveProperty('category');
        expect(insight).toHaveProperty('title');
        expect(insight).toHaveProperty('description');
        expect(insight).toHaveProperty('recommendedActions');
        expect(insight).toHaveProperty('confidence');
        
        // Validate insight categories
        const validCategories = ['LEADING_INDICATOR', 'CORRELATED_BEHAVIOR', 'DATA_QUALITY', 'HIDDEN_SEGMENT', 'ANOMALOUS_PATTERN'];
        expect(validCategories).toContain(insight.category);
      }
    });

    // Step 7: Verify Session Status
    await test.step('Verify session completion status', async () => {
      const response = await apiContext.get(`/api/v3/sessions/${sessionId}`);

      expect(response.status()).toBe(200);
      const sessionData = await response.json();
      
      expect(sessionData).toHaveProperty('sessionId', sessionId);
      expect(sessionData).toHaveProperty('status');
      expect(sessionData).toHaveProperty('files');
      expect(sessionData.files.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('API error handling and validation', async () => {
    await test.step('Test invalid session creation', async () => {
      const response = await apiContext.post('/api/v3/sessions', {
        data: {} // Missing required fields
      });

      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
      expect(errorData.error).toContain('name is required');
    });

    await test.step('Test file upload to non-existent session', async () => {
      const response = await apiContext.post('/api/v3/sessions/nonexistent-session/files', {
        multipart: {
          file: {
            name: 'test.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('id,name\n1,test')
          }
        }
      });

      expect(response.status()).toBe(404);
    });

    await test.step('Test discovery on session with no files', async () => {
      // Create empty session
      const sessionResponse = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'Empty Session',
          description: 'Session with no files'
        }
      });
      
      const sessionData = await sessionResponse.json();
      const emptySessionId = sessionData.sessionId;

      // Try to discover relationships
      const discoveryResponse = await apiContext.post(`/api/v3/sessions/${emptySessionId}/discover`);
      
      expect(discoveryResponse.status()).toBe(400);
      const errorData = await discoveryResponse.json();
      expect(errorData.error).toContain('files required');
    });

    await test.step('Test invalid file format', async () => {
      // Create session
      const sessionResponse = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'Invalid File Test',
          description: 'Testing invalid file uploads'
        }
      });
      
      const sessionData = await sessionResponse.json();
      const testSessionId = sessionData.sessionId;

      // Try to upload non-CSV file
      const response = await apiContext.post(`/api/v3/sessions/${testSessionId}/files`, {
        multipart: {
          file: {
            name: 'document.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4 fake pdf content')
          }
        }
      });

      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('CSV files only');
    });
  });

  test('API performance and concurrency', async () => {
    await test.step('Test concurrent file uploads', async () => {
      // Create session
      const sessionResponse = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'Concurrent Test',
          description: 'Testing concurrent uploads'
        }
      });
      
      const sessionData = await sessionResponse.json();
      const concurrentSessionId = sessionData.sessionId;

      // Upload multiple files concurrently
      const uploadPromises = [
        apiContext.post(`/api/v3/sessions/${concurrentSessionId}/files`, {
          multipart: {
            file: {
              name: 'file1.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('id,name\n1,Alice\n2,Bob')
            }
          }
        }),
        apiContext.post(`/api/v3/sessions/${concurrentSessionId}/files`, {
          multipart: {
            file: {
              name: 'file2.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('id,value\n1,100\n2,200')
            }
          }
        }),
        apiContext.post(`/api/v3/sessions/${concurrentSessionId}/files`, {
          multipart: {
            file: {
              name: 'file3.csv',
              mimeType: 'text/csv',
              buffer: Buffer.from('id,status\n1,active\n2,inactive')
            }
          }
        })
      ];

      const responses = await Promise.all(uploadPromises);
      
      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });

      // Verify all files were uploaded
      const sessionStatusResponse = await apiContext.get(`/api/v3/sessions/${concurrentSessionId}`);
      const sessionStatus = await sessionStatusResponse.json();
      expect(sessionStatus.files.length).toBe(3);
    });

    await test.step('Test API response times', async () => {
      // Create session with timing
      const startTime = Date.now();
      
      const response = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'Performance Test',
          description: 'Testing API performance'
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status()).toBe(201);
      // Session creation should be fast (< 1 second)
      expect(responseTime).toBeLessThan(1000);
      
      const sessionData = await response.json();
      const perfSessionId = sessionData.sessionId;

      // Test file upload timing
      const uploadStartTime = Date.now();
      
      const uploadResponse = await apiContext.post(`/api/v3/sessions/${perfSessionId}/files`, {
        multipart: {
          file: {
            name: 'perf-test.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('id,data\n' + Array.from({length: 1000}, (_, i) => `${i},data${i}`).join('\n'))
          }
        }
      });
      
      const uploadTime = Date.now() - uploadStartTime;
      
      expect(uploadResponse.status()).toBe(200);
      // File upload should be reasonable (< 5 seconds for small test file)
      expect(uploadTime).toBeLessThan(5000);
    });
  });

  test('API data integrity and validation', async () => {
    await test.step('Test data consistency through API workflow', async () => {
      // Create session
      const sessionResponse = await apiContext.post('/api/v3/sessions', {
        data: {
          name: 'Data Integrity Test',
          description: 'Testing data consistency'
        }
      });
      
      const sessionData = await sessionResponse.json();
      const integritySessionId = sessionData.sessionId;

      // Upload structured test data
      const usersData = `customer_id,email,name
user_001,test1@example.com,Test User 1
user_002,test2@example.com,Test User 2
user_003,test3@example.com,Test User 3`;

      const ordersData = `order_id,customer_id,amount
ord_001,user_001,100.00
ord_002,user_002,200.00
ord_003,user_001,150.00`;

      await apiContext.post(`/api/v3/sessions/${integritySessionId}/files`, {
        multipart: {
          file: {
            name: 'integrity-users.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(usersData)
          }
        }
      });

      await apiContext.post(`/api/v3/sessions/${integritySessionId}/files`, {
        multipart: {
          file: {
            name: 'integrity-orders.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(ordersData)
          }
        }
      });

      // Discover relationships
      const discoveryResponse = await apiContext.post(`/api/v3/sessions/${integritySessionId}/discover`);
      const discoveryData = await discoveryResponse.json();

      // Should find customer_id relationship with 100% match rate
      const relationship = discoveryData.relationships.find(
        (rel: any) => rel.sourceColumn === 'customer_id' && rel.targetColumn === 'customer_id'
      );
      
      expect(relationship).toBeDefined();
      expect(relationship.matchRate).toBe(1.0); // Perfect match
      expect(relationship.relationshipType).toContain('ONE_TO_MANY');

      // Verify data sampling
      expect(relationship.sampleMatches).toBeInstanceOf(Array);
      expect(relationship.sampleMatches.length).toBeGreaterThan(0);
    });
  });
});