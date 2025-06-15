import { createApp } from '../src/app';
import { JobQueueService } from '../src/services/job-queue.service';
import { Job } from '../src/services/job-queue.service';

async function testJobQueue() {
  console.log('Starting job queue test...');
  
  // Create app and get the job queue instance
  const app = createApp();
  const server = app.listen(0); // Use random port
  
  try {
    // Get job queue instance from the app
    const jobQueue: JobQueueService = (app as any).jobQueue;
    
    if (!jobQueue) {
      throw new Error('Job queue not found in app');
    }
    
    console.log('Job queue initialized');
    
    // Register a test handler
    jobQueue.registerHandler('sentiment_analysis_batch', async (job: Job) => {
      console.log(`Processing job ${job.id} with data:`, job.data);
      return { 
        message: `Processed job ${job.id}`,
        input: job.data
      };
    });
    
    console.log('Test handler registered');
    
    // Create a test job
    const jobId = jobQueue.addJob('sentiment_analysis_batch', { 
      texts: ['Hello, World!'] 
    });
    
    console.log(`Created job with ID: ${jobId}`);
    
    // Wait a bit for the job to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check job status
    const job = jobQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    console.log('Job status:', job.status);
    console.log('Job result:', job.result);
    
    if (job.status !== 'completed') {
      throw new Error(`Expected job status 'completed' but got '${job.status}'`);
    }
    
    console.log('✅ Job queue test passed successfully!');
    
  } catch (error) {
    console.error('❌ Job queue test failed:', error);
    process.exit(1);
  } finally {
    // Close the server
    server.close();
  }
}

// Run the test
testJobQueue().catch(console.error);
