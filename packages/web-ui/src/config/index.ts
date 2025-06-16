export const config = {
  api: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    timeout: 30000,
    retries: 3
  },
  features: {
    enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
    enableWebWorkers: true,
    enableDebugMode: import.meta.env.DEV
  },
  upload: {
    maxFileSizeGB: 50,
    chunkSizeMB: 10,
    acceptedFormats: ['.csv', '.xlsx', '.xls', '.tsv']
  }
};