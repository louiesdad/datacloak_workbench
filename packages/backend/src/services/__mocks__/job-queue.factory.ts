// Mock job queue factory for testing
export const getJobQueueService = jest.fn().mockResolvedValue({
  // Queue management
  addJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
  getJob: jest.fn().mockResolvedValue({ id: 'mock-job-id', status: 'completed' }),
  getJobs: jest.fn().mockResolvedValue([]),
  removeJob: jest.fn().mockResolvedValue(true),
  
  // Job statistics
  getStats: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0
  }),
  
  // Queue operations
  pauseQueue: jest.fn().mockResolvedValue(true),
  resumeQueue: jest.fn().mockResolvedValue(true),
  cleanQueue: jest.fn().mockResolvedValue([]),
  
  // Event handlers
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  
  // Queue info
  getQueueInfo: jest.fn().mockResolvedValue({
    name: 'test-queue',
    isPaused: false,
    jobCounts: {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    }
  }),
  
  // Worker management
  getWorkerCount: jest.fn().mockReturnValue(1),
  
  // Utility methods
  isReady: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  
  // Job processing
  process: jest.fn(),
  
  // Additional methods that might be called
  getJobCounts: jest.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0
  }),
  
  getRepeatableJobs: jest.fn().mockResolvedValue([]),
  removeRepeatableByKey: jest.fn().mockResolvedValue(true),
  
  // Bull queue compatibility
  bull: {
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    })
  }
});

// Export the mock instance for direct access in tests
export const mockJobQueueService = getJobQueueService();

// Reset function for tests
export const resetJobQueueMocks = () => {
  getJobQueueService.mockClear();
  Object.keys(mockJobQueueService).forEach(key => {
    if (typeof mockJobQueueService[key] === 'function') {
      mockJobQueueService[key].mockClear();
    }
  });
};