import request from 'supertest';
import { createApp } from '../../src/app';
import { JobQueueService, Job, JobType } from '../../src/services/job-queue.service';

// Simple test to verify job queue is working
const testJobQueue = () => {
  let app: any;
  let server: any;
  let jobQueue: JobQueueService;

  beforeAll(async () => {
    // Create app and get the job queue instance
    app = createApp();
    server = app.listen(0); // Use random port for testing
    
    // Get job queue instance from the app
    jobQueue = (app as any).jobQueue;
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should create and process a simple job', async () => {
    // Register a test handler
    jobQueue.registerHandler('sentiment_analysis_batch' as JobType, async (job: Job) => {
      return { message: `Processed job ${job.id} with data: ${JSON.stringify(job.data)}` };
    });

    // Create a test job
    const response = await request(app)
      .post('/api/v1/jobs')
      .send({
        type: 'sentiment_analysis_batch',
        data: { texts: ['Hello, World!'] },
        priority: 'medium'
      });

    // Basic response validation
    if (response.status !== 201) {
      throw new Error(`Expected status 201 but got ${response.status}`);
    }
    
    if (!response.body.data?.jobId) {
      throw new Error('Response missing jobId');
    }

    // Wait a bit for the job to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check job status
    const jobId = response.body.data.jobId;
    const statusResponse = await request(app).get(`/api/v1/jobs/${jobId}`);
    
    if (statusResponse.status !== 200) {
      throw new Error(`Expected status 200 but got ${statusResponse.status}`);
    }
    
    if (statusResponse.body.data.status !== 'completed') {
      throw new Error(`Expected job status 'completed' but got '${statusResponse.body.data.status}'`);
    }
    
    if (!statusResponse.body.data.result?.message) {
      throw new Error('Job result missing message');
    }
    
    console.log('Job queue test passed successfully!');
  });
};

// Run the test if this file is executed directly
if (require.main === module) {
  const jest = require('jest');
  jest.run([__filename]);
} else {
  // Export for Jest
  module.exports = testJobQueue;
}
