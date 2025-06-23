import { progressEmitter } from '../progress-emitter.service';
import { eventEmitter } from '../event.service';

describe('WebSocket Progress Integration', () => {
  let mockBroadcast: jest.Mock;

  beforeEach(() => {
    // Mock a WebSocket broadcast listener
    mockBroadcast = jest.fn();
    eventEmitter.on('job:progress', mockBroadcast);
  });

  afterEach(() => {
    eventEmitter.removeAllListeners();
  });

  test('should integrate progress emitter with WebSocket events', async () => {
    const jobId = 'integration-test-123';
    
    // Initialize a job
    progressEmitter.initializeJob(jobId, 5000);
    
    // Process rows - this should trigger WebSocket broadcasts
    progressEmitter.updateProgress(jobId, 500);   // No broadcast
    progressEmitter.updateProgress(jobId, 1000);  // Should broadcast
    progressEmitter.updateProgress(jobId, 1500);  // No broadcast
    progressEmitter.updateProgress(jobId, 2000);  // Should broadcast
    
    // Verify broadcasts were triggered
    expect(mockBroadcast).toHaveBeenCalledTimes(2);
    
    // Verify the broadcast data
    expect(mockBroadcast).toHaveBeenNthCalledWith(1, {
      jobId,
      rowsProcessed: 1000,
      totalRows: 5000,
      progress: 20,
      timeElapsed: expect.any(Number)
    });
    
    expect(mockBroadcast).toHaveBeenNthCalledWith(2, {
      jobId,
      rowsProcessed: 2000,
      totalRows: 5000,
      progress: 40,
      timeElapsed: expect.any(Number)
    });
  });

  test('should demonstrate real-world usage in controller', () => {
    // This test shows how the progress emitter would be used in the controller
    const mockController = {
      async analyzePreview(data: any) {
        const jobId = `preview-${Date.now()}`;
        const texts = data.texts;
        
        // Initialize progress tracking
        progressEmitter.initializeJob(jobId, texts.length);
        
        // Process texts with progress updates
        for (let i = 0; i < texts.length; i++) {
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 1));
          
          // Update progress
          progressEmitter.updateProgress(jobId, i + 1);
        }
        
        return { jobId, status: 'complete' };
      }
    };
    
    // The WebSocket service would automatically broadcast these updates
    expect(mockController.analyzePreview).toBeDefined();
  });
});