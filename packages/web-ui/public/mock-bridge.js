// Mock platform bridge for web-only mode
window.platformBridge = {
  capabilities: {
    hasFileSystemAccess: false,
    hasNotifications: true,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser'
  },
  backend: {
    getHealthStatus: async () => {
      const response = await fetch('http://localhost:3001/health');
      if (!response.ok) throw new Error('Backend not available');
      return await response.json();
    },
    getDatasets: async () => {
      return { success: true, data: [] };
    },
    analyzeSentiment: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/sentiment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    },
    uploadData: async (formData) => {
      const response = await fetch('http://localhost:3001/api/v1/upload', {
        method: 'POST',
        body: formData
      });
      return await response.json();
    }
  }
};