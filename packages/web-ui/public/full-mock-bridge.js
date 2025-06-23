// Complete mock platform bridge for web mode
window.platformBridge = {
  capabilities: {
    hasFileSystemAccess: true,
    hasNotifications: true,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser'
  },
  
  backend: {
    getHealthStatus: async () => {
      const response = await fetch('http://localhost:3001/api/v1/health/status');
      if (!response.ok) throw new Error('Backend not available');
      return await response.json();
    },
    
    getDatasets: async () => {
      try {
        const response = await fetch('http://localhost:3001/api/v1/datasets');
        const data = await response.json();
        return { success: true, data: data.data || [] };
      } catch (error) {
        return { success: true, data: [] };
      }
    },
    
    uploadData: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:3001/api/v1/datasets/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      return {
        success: !result.error,
        data: result.data || result,
        error: result.error
      };
    },
    
    analyzeSentiment: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/sentiment/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    },
    
    batchAnalyzeSentiment: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/sentiment/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    },
    
    getFieldInference: async (datasetId) => {
      const response = await fetch(`http://localhost:3001/api/v1/datasets/${datasetId}/infer-fields`);
      return await response.json();
    },
    
    estimateCost: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/sentiment/estimate-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    },
    
    exportData: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    },
    
    performSecurityAudit: async (request) => {
      const response = await fetch('http://localhost:3001/api/v1/security/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      return await response.json();
    }
  },
  
  fileSystem: {
    readFile: async (path) => {
      // For web mode, return empty string
      return '';
    },
    
    writeFile: async (path, content) => {
      // For web mode, use download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop();
      a.click();
      URL.revokeObjectURL(url);
    },
    
    selectDirectory: async () => {
      // Not supported in web mode
      return null;
    },
    
    selectFile: async (filters) => {
      // Create file input for web mode
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (filters && filters.length > 0) {
          input.accept = filters.map(f => f.extensions.map(e => `.${e}`).join(',')).join(',');
        }
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            resolve(file.path || file.name);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    },
    
    selectFiles: async (filters) => {
      // Create file input for web mode
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        if (filters && filters.length > 0) {
          input.accept = filters.map(f => f.extensions.map(e => `.${e}`).join(',')).join(',');
        }
        input.onchange = (e) => {
          const files = Array.from(e.target.files);
          resolve(files.map(f => f.path || f.name));
        };
        input.click();
      });
    },
    
    getFileInfo: async (path) => {
      // For web mode, return mock info
      return {
        name: path.split('/').pop(),
        path: path,
        size: 0,
        type: 'file',
        lastModified: Date.now()
      };
    },
    
    readFileStream: async function* (path, chunkSize = 65536) {
      // For web mode, yield empty chunks
      yield new Uint8Array(0);
    }
  }
};

// Also add file system access API support
window.isFileSystemAccessSupported = false;

console.log('Platform bridge initialized for web mode');