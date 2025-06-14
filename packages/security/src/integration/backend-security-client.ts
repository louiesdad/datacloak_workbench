import { SecurityAuditResult, PIIDetectionResult } from '../interfaces/datacloak';
import { SecurityEvent, SecurityMetrics } from '../monitoring/security-monitor';

export interface BackendSecurityAPI {
  auditDataset: (datasetId: string) => Promise<SecurityAuditResult>;
  scanText: (text: string) => Promise<PIIDetectionResult[]>;
  reportSecurityEvent: (event: SecurityEvent) => Promise<void>;
  getSecurityMetrics: () => Promise<SecurityMetrics>;
  updateComplianceStatus: (datasetId: string, status: ComplianceStatus) => Promise<void>;
  getAuditHistory: (limit?: number) => Promise<SecurityAuditResult[]>;
}

export interface ComplianceStatus {
  datasetId: string;
  complianceScore: number;
  lastAuditDate: Date;
  violations: string[];
  status: 'compliant' | 'non_compliant' | 'pending' | 'review_required';
}

export interface SecurityConfiguration {
  baseURL: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  enableRealTimeReporting: boolean;
}

export class BackendSecurityClient implements BackendSecurityAPI {
  private config: SecurityConfiguration;
  private eventQueue: SecurityEvent[] = [];
  private isProcessingQueue = false;

  constructor(config: Partial<SecurityConfiguration> = {}) {
    this.config = {
      baseURL: 'http://localhost:3001',
      timeout: 30000,
      retryAttempts: 3,
      enableRealTimeReporting: true,
      ...config
    };
  }

  async auditDataset(datasetId: string): Promise<SecurityAuditResult> {
    const endpoint = `/api/v1/security/audit`;
    const payload = { datasetId };

    const response = await this.makeRequest('POST', endpoint, payload);
    
    if (!response.success) {
      throw new Error(`Audit failed: ${response.error}`);
    }

    return this.transformAuditResponse(response.data);
  }

  async scanText(text: string): Promise<PIIDetectionResult[]> {
    const endpoint = `/api/v1/security/scan`;
    const payload = { text };

    const response = await this.makeRequest('POST', endpoint, payload);
    
    if (!response.success) {
      throw new Error(`Scan failed: ${response.error}`);
    }

    return response.data.detections || [];
  }

  async reportSecurityEvent(event: SecurityEvent): Promise<void> {
    if (this.config.enableRealTimeReporting) {
      try {
        const endpoint = `/api/v1/security/events`;
        await this.makeRequest('POST', endpoint, event);
      } catch (error) {
        // Queue for later if real-time reporting fails
        this.eventQueue.push(event);
        this.processEventQueue();
      }
    } else {
      this.eventQueue.push(event);
    }
  }

  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const endpoint = `/api/v1/security/metrics`;
    const response = await this.makeRequest('GET', endpoint);
    
    if (!response.success) {
      throw new Error(`Failed to get metrics: ${response.error}`);
    }

    return response.data;
  }

  async updateComplianceStatus(datasetId: string, status: ComplianceStatus): Promise<void> {
    const endpoint = `/api/v1/security/compliance/${datasetId}`;
    await this.makeRequest('PUT', endpoint, status);
  }

  async getAuditHistory(limit = 50): Promise<SecurityAuditResult[]> {
    const endpoint = `/api/v1/security/audit/history?limit=${limit}`;
    const response = await this.makeRequest('GET', endpoint);
    
    if (!response.success) {
      throw new Error(`Failed to get audit history: ${response.error}`);
    }

    return response.data.map((item: any) => this.transformAuditResponse(item));
  }

  async bulkAuditDatasets(datasetIds: string[]): Promise<SecurityAuditResult[]> {
    const endpoint = `/api/v1/security/audit/bulk`;
    const payload = { datasetIds };

    const response = await this.makeRequest('POST', endpoint, payload);
    
    if (!response.success) {
      throw new Error(`Bulk audit failed: ${response.error}`);
    }

    return response.data.map((item: any) => this.transformAuditResponse(item));
  }

  async scheduleAudit(datasetId: string, scheduleConfig: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string;
    enabled: boolean;
  }): Promise<void> {
    const endpoint = `/api/v1/security/audit/schedule`;
    const payload = { datasetId, ...scheduleConfig };

    await this.makeRequest('POST', endpoint, payload);
  }

  async getComplianceReport(options: {
    dateFrom?: Date;
    dateTo?: Date;
    datasetIds?: string[];
    format?: 'json' | 'pdf' | 'csv';
  } = {}): Promise<any> {
    const endpoint = `/api/v1/security/compliance/report`;
    const queryParams = new URLSearchParams();

    if (options.dateFrom) {
      queryParams.append('dateFrom', options.dateFrom.toISOString());
    }
    if (options.dateTo) {
      queryParams.append('dateTo', options.dateTo.toISOString());
    }
    if (options.datasetIds) {
      queryParams.append('datasetIds', options.datasetIds.join(','));
    }
    if (options.format) {
      queryParams.append('format', options.format);
    }

    const url = `${endpoint}?${queryParams.toString()}`;
    const response = await this.makeRequest('GET', url);
    
    if (!response.success) {
      throw new Error(`Failed to generate compliance report: ${response.error}`);
    }

    return response.data;
  }

  async configureSecurityPolicies(policies: {
    piiDetectionEnabled: boolean;
    maskingRequired: boolean;
    auditFrequency: string;
    retentionDays: number;
    alertThresholds: {
      complianceScore: number;
      piiDetectionRate: number;
    };
  }): Promise<void> {
    const endpoint = `/api/v1/security/policies`;
    await this.makeRequest('PUT', endpoint, policies);
  }

  // Real-time monitoring integration
  establishSecurityStream(onEvent: (event: any) => void): () => void {
    const eventSource = new EventSource(`${this.config.baseURL}/api/v1/security/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (error) {
        console.error('Failed to parse security stream event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Security stream error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  private async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const endpoint = `/api/v1/security/events/batch`;
      const batch = this.eventQueue.splice(0, 100); // Process in batches of 100

      await this.makeRequest('POST', endpoint, { events: batch });
      
      // Continue processing if there are more events
      if (this.eventQueue.length > 0) {
        setTimeout(() => this.processEventQueue(), 1000);
      }
    } catch (error) {
      console.error('Failed to process event queue:', error);
      // Re-add events to queue for retry
      setTimeout(() => this.processEventQueue(), 5000);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    payload?: any
  ): Promise<any> {
    const url = `${this.config.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const requestConfig: RequestInit = {
      method,
      headers,
    };

    if (payload && method !== 'GET') {
      requestConfig.body = JSON.stringify(payload);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...requestConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();
        return responseText ? JSON.parse(responseText) : {};

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts - 1) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  private transformAuditResponse(data: any): SecurityAuditResult {
    return {
      timestamp: new Date(data.timestamp),
      fileProcessed: data.fileProcessed || data.datasetId,
      piiItemsDetected: data.piiItemsDetected || 0,
      maskingAccuracy: data.maskingAccuracy || 0,
      encryptionStatus: data.encryptionStatus || 'disabled',
      complianceScore: data.complianceScore || 0,
      violations: data.violations || [],
      recommendations: data.recommendations || []
    };
  }

  // Health check and connectivity
  async testConnection(): Promise<boolean> {
    try {
      const endpoint = `/api/v1/health/status`;
      const response = await this.makeRequest('GET', endpoint);
      return response.success === true;
    } catch {
      return false;
    }
  }

  async getServerInfo(): Promise<{
    version: string;
    securityFeatures: string[];
    supportedFormats: string[];
  }> {
    const endpoint = `/api/v1/security/info`;
    const response = await this.makeRequest('GET', endpoint);
    
    if (!response.success) {
      throw new Error(`Failed to get server info: ${response.error}`);
    }

    return response.data;
  }
}

// Factory function for easy instantiation
export function createSecurityClient(config?: Partial<SecurityConfiguration>): BackendSecurityClient {
  return new BackendSecurityClient(config);
}

// Utility functions for integration
export class SecurityIntegrationUtils {
  static async validateBackendCompatibility(client: BackendSecurityClient): Promise<{
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const isConnected = await client.testConnection();
      if (!isConnected) {
        issues.push('Cannot connect to backend security service');
        recommendations.push('Verify backend service is running and accessible');
      }

      const serverInfo = await client.getServerInfo();
      const requiredFeatures = ['pii_detection', 'audit_trails', 'compliance_reporting'];
      
      for (const feature of requiredFeatures) {
        if (!serverInfo.securityFeatures.includes(feature)) {
          issues.push(`Missing required feature: ${feature}`);
          recommendations.push(`Enable ${feature} in backend configuration`);
        }
      }

      const requiredFormats = ['csv', 'json'];
      for (const format of requiredFormats) {
        if (!serverInfo.supportedFormats.includes(format)) {
          issues.push(`Unsupported format: ${format}`);
          recommendations.push(`Add support for ${format} format`);
        }
      }

    } catch (error) {
      issues.push(`Compatibility check failed: ${error}`);
      recommendations.push('Check backend service health and API endpoints');
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    };
  }

  static createMockResponse(type: 'audit' | 'scan' | 'metrics'): any {
    switch (type) {
      case 'audit':
        return {
          timestamp: new Date(),
          fileProcessed: 'mock-dataset',
          piiItemsDetected: Math.floor(Math.random() * 10),
          maskingAccuracy: 0.95,
          encryptionStatus: 'enabled',
          complianceScore: 0.9,
          violations: [],
          recommendations: ['Enable additional PII detection patterns']
        };

      case 'scan':
        return [
          {
            fieldName: 'email',
            piiType: 'EMAIL',
            confidence: 0.95,
            sample: 'user@example.com',
            masked: 'u***@example.com'
          }
        ];

      case 'metrics':
        return {
          totalEvents: 100,
          eventsByType: { pii_detected: 50, compliance_breach: 5 },
          eventsBySeverity: { low: 70, medium: 25, high: 5 },
          averageComplianceScore: 0.9,
          averageProcessingTime: 150,
          errorRate: 0.02,
          trendsLast24h: {
            piiDetections: new Array(24).fill(0).map(() => Math.floor(Math.random() * 10)),
            complianceScores: [0.9, 0.85, 0.92, 0.88],
            processingTimes: [120, 150, 180, 140]
          }
        };

      default:
        return {};
    }
  }
}