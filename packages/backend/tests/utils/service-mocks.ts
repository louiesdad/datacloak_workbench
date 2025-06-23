// Mock implementations for all services

export const createMockAuthService = () => ({
  validateCredentials: jest.fn().mockResolvedValue(true),
  generateToken: jest.fn().mockReturnValue('mock-token'),
  verifyToken: jest.fn().mockResolvedValue({ username: 'testuser', role: 'user' }),
  refreshToken: jest.fn().mockReturnValue('new-mock-token'),
  revokeToken: jest.fn().mockResolvedValue(true),
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  comparePassword: jest.fn().mockResolvedValue(true)
});

export const createMockDataService = () => ({
  uploadDataset: jest.fn().mockResolvedValue({
    id: 'dataset-123',
    filename: 'test.csv',
    status: 'uploaded'
  }),
  getDatasets: jest.fn().mockResolvedValue({
    datasets: [{ id: 'dataset-123', filename: 'test.csv' }],
    total: 1
  }),
  getDatasetById: jest.fn().mockResolvedValue({
    id: 'dataset-123',
    filename: 'test.csv',
    preview: { headers: ['col1', 'col2'], rows: [] }
  }),
  deleteDataset: jest.fn().mockResolvedValue({ success: true }),
  validateDataset: jest.fn().mockResolvedValue({ valid: true }),
  exportData: jest.fn().mockResolvedValue({ data: 'exported-data' }),
  transformData: jest.fn().mockResolvedValue({ transformed: true })
});

export const createMockOpenAIService = () => ({
  analyzeSentiment: jest.fn().mockResolvedValue({
    sentiment: 'positive',
    confidence: 0.95,
    model: 'gpt-4'
  }),
  batchAnalyzeSentiment: jest.fn().mockResolvedValue({
    results: [
      { text: 'test1', sentiment: 'positive', confidence: 0.9 },
      { text: 'test2', sentiment: 'negative', confidence: 0.8 }
    ]
  }),
  generateInsights: jest.fn().mockResolvedValue({
    insights: ['Insight 1', 'Insight 2'],
    summary: 'Summary of analysis'
  }),
  classifyText: jest.fn().mockResolvedValue({
    category: 'product-review',
    confidence: 0.85
  })
});

export const createMockSecurityService = () => ({
  scanForPII: jest.fn().mockResolvedValue({
    hasPII: false,
    fields: [],
    summary: 'No PII detected'
  }),
  validateData: jest.fn().mockResolvedValue({ valid: true }),
  sanitizeData: jest.fn().mockImplementation(data => data),
  encryptData: jest.fn().mockResolvedValue('encrypted-data'),
  decryptData: jest.fn().mockResolvedValue('decrypted-data'),
  generateComplianceReport: jest.fn().mockResolvedValue({
    compliant: true,
    issues: [],
    recommendations: []
  })
});

export const createMockCacheService = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(false),
  expire: jest.fn().mockResolvedValue(true),
  flush: jest.fn().mockResolvedValue(true),
  getStats: jest.fn().mockResolvedValue({
    hits: 100,
    misses: 20,
    hitRate: 0.83
  })
});

export const createMockJobQueueService = () => ({
  addJob: jest.fn().mockResolvedValue({
    id: 'job-123',
    status: 'pending'
  }),
  getJob: jest.fn().mockResolvedValue({
    id: 'job-123',
    status: 'completed',
    result: {}
  }),
  updateJob: jest.fn().mockResolvedValue(true),
  cancelJob: jest.fn().mockResolvedValue(true),
  getJobsByUser: jest.fn().mockResolvedValue([]),
  processQueue: jest.fn().mockResolvedValue(undefined),
  getQueueStats: jest.fn().mockResolvedValue({
    pending: 5,
    processing: 2,
    completed: 100,
    failed: 3
  })
});

export const createMockWebSocketService = () => ({
  initialize: jest.fn(),
  shutdown: jest.fn(),
  broadcast: jest.fn().mockReturnValue(0),
  sendToClient: jest.fn().mockReturnValue(true),
  sendToUser: jest.fn().mockReturnValue(0),
  getClientCount: jest.fn().mockReturnValue(0),
  getClientInfo: jest.fn().mockReturnValue(null),
  disconnectClient: jest.fn().mockReturnValue(false),
  getAllClients: jest.fn().mockReturnValue(new Map()),
  getStats: jest.fn().mockReturnValue({
    totalClients: 0,
    authenticatedClients: 0,
    topicSubscriptions: {}
  })
});

export const createMockSSEService = () => ({
  addClient: jest.fn().mockReturnValue('client-123'),
  removeClient: jest.fn(),
  sendToClient: jest.fn(),
  sendToUser: jest.fn(),
  broadcast: jest.fn(),
  sendProgress: jest.fn(),
  sendError: jest.fn(),
  sendComplete: jest.fn(),
  getClientCount: jest.fn().mockReturnValue(0),
  getClients: jest.fn().mockReturnValue([]),
  stopPingInterval: jest.fn()
});

export const createMockConfigService = () => ({
  get: jest.fn().mockImplementation((key: string) => {
    const config: any = {
      JWT_SECRET: 'test-jwt-secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test-password',
      PORT: 3000,
      NODE_ENV: 'test'
    };
    return config[key];
  }),
  getAll: jest.fn().mockReturnValue({
    JWT_SECRET: 'test-jwt-secret',
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'test-password'
  }),
  set: jest.fn(),
  has: jest.fn().mockReturnValue(true),
  validate: jest.fn().mockReturnValue(true)
});

export const createMockEventService = () => ({
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(0),
  getEventStats: jest.fn().mockReturnValue({
    totalEvents: 100,
    eventTypes: {}
  })
});

export const createMockDataCloakService = () => ({
  initialize: jest.fn().mockResolvedValue(true),
  transformData: jest.fn().mockResolvedValue({
    transformed: true,
    data: 'transformed-data'
  }),
  validatePrivacy: jest.fn().mockResolvedValue({
    valid: true,
    issues: []
  }),
  applyDifferentialPrivacy: jest.fn().mockResolvedValue({
    data: 'private-data',
    epsilon: 1.0
  }),
  shutdown: jest.fn().mockResolvedValue(true)
});

export const createMockInsightsService = () => ({
  generateInsights: jest.fn().mockResolvedValue({
    insights: ['Key insight 1', 'Key insight 2'],
    trends: [],
    recommendations: []
  }),
  analyzeTrends: jest.fn().mockResolvedValue({
    trends: [
      { period: 'daily', direction: 'up', change: 0.15 }
    ]
  }),
  generateReport: jest.fn().mockResolvedValue({
    summary: 'Report summary',
    sections: []
  })
});

// Controller mock factory
export const createMockController = (methods: string[]) => {
  const controller: any = {};
  methods.forEach(method => {
    controller[method] = jest.fn().mockImplementation((req: any, res: any) => {
      res.status(200).json({ success: true });
    });
  });
  return controller;
};

// Database mock factory
export const createMockDatabase = () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  transaction: jest.fn().mockImplementation(async (callback: any) => {
    const trx = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined)
    };
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }),
  getStatus: jest.fn().mockResolvedValue('connected')
});

// Export all mocks as a single object for convenience
export const createAllMocks = () => ({
  authService: createMockAuthService(),
  dataService: createMockDataService(),
  openAIService: createMockOpenAIService(),
  securityService: createMockSecurityService(),
  cacheService: createMockCacheService(),
  jobQueueService: createMockJobQueueService(),
  webSocketService: createMockWebSocketService(),
  sseService: createMockSSEService(),
  configService: createMockConfigService(),
  eventService: createMockEventService(),
  dataCloakService: createMockDataCloakService(),
  insightsService: createMockInsightsService(),
  database: createMockDatabase()
});