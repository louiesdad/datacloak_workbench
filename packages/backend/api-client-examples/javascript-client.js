/**
 * DataCloak Sentiment Workbench JavaScript Client
 * 
 * A comprehensive JavaScript/Node.js client for the DataCloak API
 * Supports both browser and Node.js environments
 */

class DataCloakClient {
    constructor(options = {}) {
        this.baseURL = options.baseURL || 'http://localhost:3001';
        this.token = options.token;
        this.timeout = options.timeout || 30000;
        
        // Initialize HTTP client based on environment
        if (typeof window !== 'undefined') {
            // Browser environment - use fetch
            this.httpClient = this.createFetchClient();
        } else {
            // Node.js environment - use axios if available, otherwise fetch
            try {
                const axios = require('axios');
                this.httpClient = this.createAxiosClient(axios);
            } catch (e) {
                // Fallback to fetch for Node.js 18+
                this.httpClient = this.createFetchClient();
            }
        }
    }

    /**
     * Create fetch-based HTTP client
     */
    createFetchClient() {
        return {
            async request(config) {
                const url = `${config.baseURL}${config.url}`;
                const options = {
                    method: config.method,
                    headers: config.headers,
                    signal: AbortSignal.timeout(config.timeout)
                };

                if (config.data) {
                    if (config.data instanceof FormData) {
                        options.body = config.data;
                    } else {
                        options.body = JSON.stringify(config.data);
                    }
                }

                const response = await fetch(url, options);
                
                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: response.statusText }));
                    throw new DataCloakError(error.error || 'Request failed', response.status, error.code);
                }

                return { data: await response.json() };
            }
        };
    }

    /**
     * Create axios-based HTTP client
     */
    createAxiosClient(axios) {
        return axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: this.getDefaultHeaders()
        });
    }

    /**
     * Get default headers
     */
    getDefaultHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * Make HTTP request
     */
    async request(method, url, data = null, options = {}) {
        const config = {
            method: method.toUpperCase(),
            url,
            baseURL: this.baseURL,
            headers: { ...this.getDefaultHeaders(), ...options.headers },
            timeout: options.timeout || this.timeout
        };

        if (data) {
            config.data = data;
        }

        try {
            const response = await this.httpClient.request(config);
            return response.data;
        } catch (error) {
            if (error instanceof DataCloakError) {
                throw error;
            }
            
            const message = error.response?.data?.error || error.message || 'Request failed';
            const status = error.response?.status || 500;
            const code = error.response?.data?.code || 'UNKNOWN_ERROR';
            
            throw new DataCloakError(message, status, code);
        }
    }

    // Authentication methods
    async login(username, password) {
        const response = await this.request('POST', '/api/auth/login', {
            username,
            password
        });

        if (response.success && response.data.token) {
            this.token = response.data.token;
        }

        return response;
    }

    async verifyToken() {
        return this.request('POST', '/api/auth/verify');
    }

    // Sentiment Analysis methods
    async analyzeSentiment(text, options = {}) {
        return this.request('POST', '/api/v1/sentiment/analyze', {
            text,
            options
        });
    }

    async batchAnalyzeSentiment(texts, options = {}) {
        return this.request('POST', '/api/v1/sentiment/batch', {
            texts,
            options
        });
    }

    async getSentimentHistory(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `/api/v1/sentiment/history?${params}` : '/api/v1/sentiment/history';
        return this.request('GET', url);
    }

    async getSentimentStatistics() {
        return this.request('GET', '/api/v1/sentiment/statistics');
    }

    async estimateCost(data) {
        return this.request('POST', '/api/v1/sentiment/estimate-cost', data);
    }

    // Security & PII Detection methods
    async detectPII(text, options = {}) {
        return this.request('POST', '/api/v1/security/detect', {
            text,
            options
        });
    }

    async maskSensitiveData(text, options = {}) {
        return this.request('POST', '/api/v1/security/mask', {
            text,
            options
        });
    }

    async auditSecurity(filePath) {
        return this.request('POST', '/api/v1/security/audit/file', {
            filePath
        });
    }

    async scanDataset(datasetId) {
        return this.request('POST', '/api/v1/security/scan/dataset', {
            datasetId
        });
    }

    async getSecurityMetrics() {
        return this.request('GET', '/api/v1/security/metrics');
    }

    // Data Management methods
    async uploadDataset(file, metadata = {}) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(metadata));

        return this.request('POST', '/api/v1/data/upload', formData, {
            headers: {
                // Let browser/fetch set Content-Type for FormData
                'Content-Type': undefined
            }
        });
    }

    async getDatasets(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `/api/v1/data/datasets?${params}` : '/api/v1/data/datasets';
        return this.request('GET', url);
    }

    async getDataset(datasetId) {
        return this.request('GET', `/api/v1/data/datasets/${datasetId}`);
    }

    async deleteDataset(datasetId) {
        return this.request('DELETE', `/api/v1/data/datasets/${datasetId}`);
    }

    async exportData(datasetId, options = {}) {
        return this.request('POST', '/api/v1/data/export', {
            datasetId,
            ...options
        });
    }

    // Job Management methods
    async createJob(type, data, options = {}) {
        return this.request('POST', '/api/v1/jobs', {
            type,
            data,
            priority: options.priority || 'medium',
            metadata: options.metadata || {}
        });
    }

    async getJob(jobId) {
        return this.request('GET', `/api/v1/jobs/${jobId}`);
    }

    async getJobs(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `/api/v1/jobs?${params}` : '/api/v1/jobs';
        return this.request('GET', url);
    }

    async cancelJob(jobId) {
        return this.request('DELETE', `/api/v1/jobs/${jobId}`);
    }

    async getJobProgress(jobId) {
        return this.request('GET', `/api/v1/jobs/${jobId}/progress`);
    }

    async waitForJob(jobId, timeout = 60000) {
        return this.request('POST', `/api/v1/jobs/${jobId}/wait`, {
            timeout
        });
    }

    // Health & Monitoring methods
    async getHealth() {
        return this.request('GET', '/health');
    }

    async getDetailedHealth() {
        return this.request('GET', '/api/v1/health/status');
    }

    async getSystemMetrics() {
        return this.request('GET', '/api/v1/monitoring/system');
    }

    async getMemoryMetrics() {
        return this.request('GET', '/api/v1/monitoring/memory/current');
    }

    // Configuration methods (admin only)
    async getConfig() {
        return this.request('GET', '/api/config');
    }

    async updateConfig(key, value) {
        return this.request('PUT', '/api/config', { key, value });
    }

    async batchUpdateConfig(updates) {
        return this.request('PUT', '/api/config/batch', { updates });
    }

    // Utility methods
    async testConnection() {
        try {
            await this.getHealth();
            return true;
        } catch (error) {
            return false;
        }
    }

    // Event Stream methods (for real-time updates)
    createEventStream() {
        if (typeof EventSource === 'undefined') {
            throw new Error('EventSource not supported in this environment');
        }

        const eventSource = new EventSource(`${this.baseURL}/api/v1/sse/events`);
        
        return {
            eventSource,
            onMessage: (callback) => {
                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        callback(data);
                    } catch (error) {
                        console.error('Error parsing SSE data:', error);
                    }
                };
            },
            onError: (callback) => {
                eventSource.onerror = callback;
            },
            close: () => {
                eventSource.close();
            }
        };
    }

    // WebSocket methods (for real-time bidirectional communication)
    createWebSocket() {
        if (typeof WebSocket === 'undefined') {
            throw new Error('WebSocket not supported in this environment');
        }

        const protocol = this.baseURL.startsWith('https') ? 'wss' : 'ws';
        const wsURL = this.baseURL.replace(/^https?/, protocol) + '/api/v1/websocket';
        const ws = new WebSocket(wsURL);

        return {
            websocket: ws,
            authenticate: () => {
                if (this.token && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'auth',
                        token: this.token
                    }));
                }
            },
            send: (message) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            },
            onMessage: (callback) => {
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        callback(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket data:', error);
                    }
                };
            },
            onOpen: (callback) => {
                ws.onopen = callback;
            },
            onClose: (callback) => {
                ws.onclose = callback;
            },
            onError: (callback) => {
                ws.onerror = callback;
            },
            close: () => {
                ws.close();
            }
        };
    }
}

/**
 * Custom error class for DataCloak API errors
 */
class DataCloakError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'DataCloakError';
        this.status = status;
        this.code = code;
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = { DataCloakClient, DataCloakError };
} else if (typeof window !== 'undefined') {
    // Browser
    window.DataCloakClient = DataCloakClient;
    window.DataCloakError = DataCloakError;
}

// Usage Examples:

/*
// Basic usage
const client = new DataCloakClient({
    baseURL: 'http://localhost:3001',
    token: 'your-jwt-token'
});

// Sentiment analysis
const sentiment = await client.analyzeSentiment('I love this product!', {
    model: 'gpt-4',
    includeEmotions: true
});

// Batch sentiment analysis
const batchResult = await client.batchAnalyzeSentiment([
    'Great product!',
    'Terrible service',
    'It was okay'
], {
    model: 'gpt-4',
    parallel: true
});

// PII detection
const piiResult = await client.detectPII('My email is john@example.com', {
    types: ['EMAIL', 'PHONE'],
    confidence: 0.8
});

// Upload dataset
const uploadResult = await client.uploadDataset(file, {
    name: 'Customer Feedback',
    description: 'Q4 2024 customer feedback data',
    tags: ['customer', 'feedback', '2024']
});

// Create and monitor job
const job = await client.createJob('sentiment_analysis', {
    datasetId: 'dataset_123',
    options: { model: 'gpt-4' }
});

// Poll for job completion
const pollJob = async (jobId) => {
    while (true) {
        const status = await client.getJob(jobId);
        if (status.data.status === 'completed') {
            return status.data.result;
        } else if (status.data.status === 'failed') {
            throw new Error(status.data.error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

// Real-time updates with Server-Sent Events
const eventStream = client.createEventStream();
eventStream.onMessage((data) => {
    console.log('Real-time update:', data);
});

// Real-time communication with WebSocket
const ws = client.createWebSocket();
ws.onOpen(() => {
    ws.authenticate();
});
ws.onMessage((data) => {
    console.log('WebSocket message:', data);
});

// Error handling
try {
    const result = await client.analyzeSentiment('test');
} catch (error) {
    if (error instanceof DataCloakError) {
        console.error(`API Error: ${error.message} (${error.code})`);
    } else {
        console.error('Unexpected error:', error);
    }
}
*/