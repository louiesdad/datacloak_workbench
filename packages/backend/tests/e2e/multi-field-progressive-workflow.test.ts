import request from 'supertest';
import { Express } from 'express';
import { ComprehensiveDataGenerator } from '../../src/utils/comprehensive-data-generator';
import { ExpressAppFactory } from '../utils/express-app-factory';
import { MockFactory } from '../utils/mock-factory';

describe('Multi-Field Progressive Analysis E2E', () => {
  let app: Express;
  let authToken: string;
  let userId: number;

  beforeAll(async () => {
    app = ExpressAppFactory.createTestApp({
      useAuth: false, // Disable auth for simpler testing
      mountRoutes: true
    });
    
    // Mock auth for testing
    authToken = 'mock-jwt-token';
    userId = 1;
  });

  describe('Progressive Multi-Field Analysis Flow', () => {
    it('should complete full progressive analysis workflow', async () => {
      // Generate test data
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Convert dataset to CSV
      const csvContent = [
        dataset.headers.join(','),
        ...dataset.records.slice(0, 1000).map(record => 
          dataset.headers.map(header => `"${record[header as keyof typeof record]}"`).join(',')
        )
      ].join('\n');

      // Step 1: Upload file with multi-field support
      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .attach('file', Buffer.from(csvContent), 'test_data.csv')
        .field('options', JSON.stringify({
          supportMultiField: true,
          progressiveAnalysis: true
        }));

      expect(uploadResponse.body).toHaveProperty('fileId');
      expect(uploadResponse.body).toHaveProperty('detectedFields');
      expect(uploadResponse.body.detectedFields).toHaveProperty('textFields');
      expect(uploadResponse.body.detectedFields).toHaveProperty('recommendedForAnalysis');

      const fileId = uploadResponse.body.fileId;

      // Step 2: Start quick preview analysis (first 1000 rows)
      const previewResponse = await request(app)
        .post(`/api/sentiment/analyze/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId,
          fields: ['product_review', 'customer_comment'],
          previewSize: 1000
        })
        .expect(202);

      expect(previewResponse.body).toHaveProperty('jobId');
      expect(previewResponse.body).toHaveProperty('estimatedTime');
      expect(previewResponse.body.estimatedTime).toBeLessThanOrEqual(5); // 5 minutes max

      const previewJobId = previewResponse.body.jobId;

      // Step 3: Check preview progress
      const progressResponse = await request(app)
        .get(`/api/sentiment/analyze/progress/${previewJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(progressResponse.body).toHaveProperty('status');
      expect(progressResponse.body).toHaveProperty('progress');
      expect(progressResponse.body).toHaveProperty('partialResults');

      // Step 4: Get preview results
      const previewResultsResponse = await request(app)
        .get(`/api/sentiment/results/${previewJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(previewResultsResponse.body).toHaveProperty('metadata');
      expect(previewResultsResponse.body).toHaveProperty('fieldAnalysis');
      expect(previewResultsResponse.body).toHaveProperty('sentimentDistribution');
      expect(previewResultsResponse.body.metadata.rowsProcessed).toBe(1000);

      // Step 5: Start full analysis based on preview
      const fullAnalysisResponse = await request(app)
        .post(`/api/sentiment/analyze/full`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId,
          fields: ['product_review', 'customer_comment'],
          basedOnPreview: previewJobId,
          options: {
            progressiveUpdates: true,
            notificationEmail: 'test@example.com'
          }
        })
        .expect(202);

      expect(fullAnalysisResponse.body).toHaveProperty('jobId');
      expect(fullAnalysisResponse.body).toHaveProperty('estimatedTime');
      expect(fullAnalysisResponse.body.estimatedTime).toBeGreaterThan(30); // Longer processing time

      const fullJobId = fullAnalysisResponse.body.jobId;

      // Step 6: Check progressive updates
      const progressiveResponse = await request(app)
        .get(`/api/sentiment/analyze/progress/${fullJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(progressiveResponse.body).toHaveProperty('currentFindings');
      expect(progressiveResponse.body).toHaveProperty('progressMilestones');
      expect(progressiveResponse.body).toHaveProperty('partialResultsAvailable');
    });

    it('should handle field discovery and recommendation', async () => {
      // Upload file with mixed field types
      const csvContent = `
customer_id,email,phone,feedback_text,rating,order_date,notes,pii_field
CUST-001,test@example.com,555-1234,"Great product, love it!",5,2024-01-01,"Staff was helpful","SSN: 123-45-6789"
CUST-002,user@test.com,555-5678,"Terrible service, very disappointed",1,2024-01-02,"Needs improvement","DOB: 1990-01-01"
      `.trim();

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'mixed_fields.csv')
        .field('options', JSON.stringify({
          fieldDiscovery: true,
          securityScan: true
        }))
        .expect(200);

      const fieldAnalysis = uploadResponse.body.fieldAnalysis;

      // Should identify text fields for sentiment analysis
      expect(fieldAnalysis.recommendedFields).toContain('feedback_text');
      expect(fieldAnalysis.recommendedFields).toContain('notes');

      // Should identify PII fields for masking
      expect(fieldAnalysis.piiFields).toContain('email');
      expect(fieldAnalysis.piiFields).toContain('phone');
      expect(fieldAnalysis.piiFields).toContain('pii_field');

      // Should exclude non-text fields
      expect(fieldAnalysis.excludedFields).toContain('rating');
      expect(fieldAnalysis.excludedFields).toContain('order_date');

      // Should provide confidence scores
      fieldAnalysis.fieldConfidence.forEach((field: any) => {
        expect(field.confidence).toBeGreaterThanOrEqual(0);
        expect(field.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should provide clear time expectations and progress communication', async () => {
      const csvContent = 'id,text\n1,"Sample text"\n2,"Another sample"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'small_file.csv')
        .expect(200);

      const timeEstimateResponse = await request(app)
        .post('/api/sentiment/estimate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: uploadResponse.body.fileId,
          fields: ['text'],
          analysisType: 'full'
        })
        .expect(200);

      expect(timeEstimateResponse.body).toHaveProperty('quickPreview');
      expect(timeEstimateResponse.body).toHaveProperty('statisticalSample');
      expect(timeEstimateResponse.body).toHaveProperty('fullAnalysis');

      expect(timeEstimateResponse.body.quickPreview).toHaveProperty('estimatedMinutes');
      expect(timeEstimateResponse.body.quickPreview).toHaveProperty('rowCount');
      expect(timeEstimateResponse.body.quickPreview).toHaveProperty('description');

      expect(timeEstimateResponse.body.statisticalSample).toHaveProperty('estimatedMinutes');
      expect(timeEstimateResponse.body.statisticalSample).toHaveProperty('confidenceLevel');
      expect(timeEstimateResponse.body.statisticalSample).toHaveProperty('accuracy');

      expect(timeEstimateResponse.body.fullAnalysis).toHaveProperty('estimatedHours');
      expect(timeEstimateResponse.body.fullAnalysis).toHaveProperty('totalRows');
    });
  });

  describe('Real-time Progress Dashboard', () => {
    it('should provide live progress updates via WebSocket', (done) => {
      // Test WebSocket connectivity for real-time updates
      const WebSocket = require('ws');
      const fs = require('fs');
      const FormData = require('form-data');
      
      // Start a long-running analysis job first
      const csvContent = 'id,text\n1,"Sample text for analysis"\n2,"Another sample text"';
      
      request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'websocket_test.csv')
        .end((err, uploadRes) => {
          if (err) return done(err);
          
          const fileId = uploadRes.body.fileId;
          
          // Start analysis
          request(app)
            .post('/api/sentiment/analyze')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              fileId,
              fields: ['text'],
              enableWebSocket: true
            })
            .end((err, analysisRes) => {
              if (err) return done(err);
              
              const jobId = analysisRes.body.jobId;
              
              // Connect to WebSocket
              const ws = new WebSocket('ws://localhost:3000/ws', {
                headers: {
                  'Authorization': `Bearer ${authToken}`
                }
              });
              
              let progressReceived = false;
              
              ws.on('open', () => {
                // Subscribe to job progress
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  jobId: jobId
                }));
              });
              
              ws.on('message', (data) => {
                try {
                  const message = JSON.parse(data.toString());
                  
                  if (message.type === 'progress' && message.jobId === jobId) {
                    expect(message).toHaveProperty('progress');
                    expect(message).toHaveProperty('status');
                    expect(message.progress).toBeGreaterThanOrEqual(0);
                    expect(message.progress).toBeLessThanOrEqual(100);
                    progressReceived = true;
                  }
                  
                  if (message.type === 'completed' || progressReceived) {
                    ws.close();
                    done();
                  }
                } catch (parseError) {
                  ws.close();
                  done(parseError);
                }
              });
              
              ws.on('error', (error) => {
                done(error);
              });
              
              // Timeout after 5 seconds
              setTimeout(() => {
                if (!progressReceived) {
                  ws.close();
                  done(new Error('No progress updates received via WebSocket'));
                }
              }, 5000);
            });
        });
    });

    it('should provide SSE progress updates', async () => {
      const csvContent = 'id,text\n1,"Sample text"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'sse_test.csv')
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: uploadResponse.body.fileId,
          fields: ['text'],
          enableSSE: true
        })
        .expect(202);

      const jobId = analysisResponse.body.jobId;

      // Test SSE endpoint
      const sseResponse = await request(app)
        .get(`/api/sentiment/progress/stream/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'text/event-stream')
        .expect(200);

      expect(sseResponse.headers['content-type']).toContain('text/event-stream');
      expect(sseResponse.headers['cache-control']).toBe('no-cache');
      expect(sseResponse.headers['connection']).toBe('keep-alive');
    });

    it('should provide partial results during processing', async () => {
      const generator = new ComprehensiveDataGenerator(42);
      const dataset = generator.generateEcommerceStandardDataset();
      
      // Create larger dataset for partial results testing
      const csvContent = [
        dataset.headers.join(','),
        ...dataset.records.slice(0, 5000).map(record => 
          dataset.headers.map(header => `"${record[header as keyof typeof record]}"`).join(',')
        )
      ].join('\n');

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'large_test.csv')
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: uploadResponse.body.fileId,
          fields: ['product_review', 'customer_comment'],
          partialResults: true,
          updateInterval: 1000 // 1 second for testing
        })
        .expect(202);

      const jobId = analysisResponse.body.jobId;

      // Wait a bit then check for partial results
      await new Promise(resolve => setTimeout(resolve, 2000));

      const partialResponse = await request(app)
        .get(`/api/sentiment/results/${jobId}/partial`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(partialResponse.body).toHaveProperty('processedCount');
      expect(partialResponse.body).toHaveProperty('totalCount');
      expect(partialResponse.body).toHaveProperty('currentFindings');
      expect(partialResponse.body).toHaveProperty('isPartial', true);
      expect(partialResponse.body.processedCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unsupported file types gracefully', async () => {
      const invalidContent = 'This is not a CSV file';

      const response = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(invalidContent), 'invalid.txt')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unsupported file type');
    });

    it('should handle files with no text fields', async () => {
      const csvContent = 'id,number,date\n1,100,2024-01-01\n2,200,2024-01-02';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'no_text.csv')
        .expect(200);

      expect(uploadResponse.body.fieldAnalysis.recommendedFields).toHaveLength(0);
      expect(uploadResponse.body.fieldAnalysis.textFieldCount).toBe(0);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: uploadResponse.body.fileId,
          fields: []
        })
        .expect(400);

      expect(analysisResponse.body.error).toContain('No text fields selected');
    });

    it('should handle processing cancellation', async () => {
      const csvContent = 'id,text\n1,"Sample text"';

      const uploadResponse = await request(app)
        .post('/api/data/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from(csvContent), 'cancel_test.csv')
        .expect(200);

      const analysisResponse = await request(app)
        .post('/api/sentiment/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId: uploadResponse.body.fileId,
          fields: ['text']
        })
        .expect(202);

      const jobId = analysisResponse.body.jobId;

      // Cancel the job
      const cancelResponse = await request(app)
        .delete(`/api/sentiment/analyze/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cancelResponse.body.status).toBe('cancelled');

      // Check job status
      const statusResponse = await request(app)
        .get(`/api/sentiment/analyze/progress/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('cancelled');
    });
  });
});