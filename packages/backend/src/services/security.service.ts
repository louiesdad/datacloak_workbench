// Import from the security package
import { 
  DataCloakBridge,
  NativeDataCloakBridge,
  PIIDetectionResult,
  MaskingResult,
  SecurityAuditResult,
  DataCloakConfig
} from '@dsw/security';
import { AppError } from '../middleware/error.middleware';
import { getSQLiteConnection } from '../database/sqlite';
import { v4 as uuidv4 } from 'uuid';

export interface SecurityScanRequest {
  text?: string;
  filePath?: string;
  options?: {
    includePatterns?: boolean;
    confidenceThreshold?: number;
    preserveFormat?: boolean;
  };
}

export interface SecurityEvent {
  id: string;
  type: 'pii_detected' | 'masking_applied' | 'audit_completed' | 'violation_found';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: any;
  source: string;
}

export interface SecurityMetrics {
  totalScans: number;
  piiItemsDetected: number;
  averageConfidence: number;
  complianceScore: number;
  recentEvents: SecurityEvent[];
}


export class SecurityService {
  private dataCloakBridge: DataCloakBridge;
  private initialized = false;

  constructor() {
    // Use NativeDataCloakBridge with fallback to mock
    this.dataCloakBridge = new NativeDataCloakBridge({
      fallbackToMock: true,
      useSystemBinary: true,
      timeout: 30000,
      retryAttempts: 3
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize DataCloak bridge
      await this.dataCloakBridge.initialize();

      this.initialized = true;
      console.log(`Security service initialized with ${this.dataCloakBridge.getVersion()}`);
    } catch (error) {
      throw new AppError('Failed to initialize security service', 500, 'SECURITY_INIT_ERROR');
    }
  }

  async detectPII(text: string): Promise<PIIDetectionResult[]> {
    await this.ensureInitialized();

    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for PII detection', 400, 'INVALID_TEXT');
    }

    try {
      const results = await this.dataCloakBridge.detectPII(text);
      
      // Log security event
      await this.logSecurityEvent({
        type: 'pii_detected',
        severity: results.length > 0 ? 'medium' : 'low',
        details: {
          textLength: text.length,
          piiFound: results.length,
          types: results.map(r => r.piiType)
        },
        source: 'api_request'
      });

      return results;
    } catch (error) {
      throw new AppError('Failed to detect PII', 500, 'PII_DETECTION_ERROR');
    }
  }

  async maskText(text: string, _options?: { preserveFormat?: boolean }): Promise<MaskingResult> {
    await this.ensureInitialized();

    if (!text || text.trim().length === 0) {
      throw new AppError('Text is required for masking', 400, 'INVALID_TEXT');
    }

    try {
      const result = await this.dataCloakBridge.maskText(text);
      
      // Log security event
      await this.logSecurityEvent({
        type: 'masking_applied',
        severity: result.detectedPII.length > 0 ? 'medium' : 'low',
        details: {
          originalLength: text.length,
          maskedLength: result.maskedText.length,
          piiItemsMasked: result.detectedPII.length,
          processingTime: result.metadata.processingTime
        },
        source: 'api_request'
      });

      return result;
    } catch (error) {
      throw new AppError('Failed to mask text', 500, 'TEXT_MASKING_ERROR');
    }
  }

  async auditFile(filePath: string): Promise<SecurityAuditResult> {
    await this.ensureInitialized();

    if (!filePath) {
      throw new AppError('File path is required for audit', 400, 'INVALID_FILE_PATH');
    }

    try {
      const result = await this.dataCloakBridge.auditSecurity(filePath);
      
      // Log security event
      await this.logSecurityEvent({
        type: 'audit_completed',
        severity: this.getSeverityFromComplianceScore(result.complianceScore),
        details: {
          filePath,
          piiItemsDetected: result.piiItemsDetected,
          complianceScore: result.complianceScore,
          violations: result.violations.length,
          recommendations: result.recommendations.length
        },
        source: 'file_audit'
      });

      // Store audit result in database
      await this.storeAuditResult(result);

      return result;
    } catch (error) {
      throw new AppError('Failed to audit file', 500, 'FILE_AUDIT_ERROR');
    }
  }

  async scanDataset(datasetId: string, filePath: string): Promise<{
    auditResult: SecurityAuditResult;
    piiSummary: {
      totalFields: number;
      piiFields: number;
      riskLevel: string;
      recommendations: string[];
    };
  }> {
    await this.ensureInitialized();

    try {
      // Perform security audit
      const auditResult = await this.auditFile(filePath);
      
      // Analyze PII risk
      const piiSummary = {
        totalFields: 1, // Will be updated based on actual file analysis
        piiFields: auditResult.piiItemsDetected,
        riskLevel: this.getRiskLevel(auditResult.complianceScore),
        recommendations: auditResult.recommendations
      };

      // Update dataset with security metadata
      await this.updateDatasetSecurity(datasetId, auditResult, piiSummary);

      return { auditResult, piiSummary };
    } catch (error) {
      throw new AppError('Failed to scan dataset', 500, 'DATASET_SCAN_ERROR');
    }
  }

  async getSecurityMetrics(): Promise<SecurityMetrics> {
    await this.ensureInitialized();

    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    try {
      // Get total scans
      const scanStmt = db.prepare('SELECT COUNT(*) as total FROM security_audits');
      const { total: totalScans } = scanStmt.get() as { total: number };

      // Get total PII items detected
      const piiStmt = db.prepare('SELECT SUM(pii_items_detected) as total FROM security_audits');
      const piiResult = piiStmt.get() as { total: number | null };
      const piiItemsDetected = piiResult?.total || 0;

      // Get average confidence from sentiment analyses (as proxy for confidence)
      const confStmt = db.prepare('SELECT AVG(confidence) as avg FROM sentiment_analyses');
      const confResult = confStmt.get() as { avg: number | null };
      const averageConfidence = confResult?.avg || 0;

      // Get average compliance score
      const compStmt = db.prepare('SELECT AVG(compliance_score) as avg FROM security_audits');
      const compResult = compStmt.get() as { avg: number | null };
      const complianceScore = compResult?.avg || 0;

      // Get recent events
      const eventsStmt = db.prepare(`
        SELECT * FROM security_events 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      const recentEvents = eventsStmt.all() as SecurityEvent[];

      return {
        totalScans: totalScans || 0,
        piiItemsDetected,
        averageConfidence: Number(averageConfidence.toFixed(3)),
        complianceScore: Number(complianceScore.toFixed(3)),
        recentEvents
      };
    } catch (error) {
      throw new AppError('Failed to get security metrics', 500, 'METRICS_ERROR');
    }
  }

  async getAuditHistory(page: number = 1, pageSize: number = 10): Promise<{
    data: SecurityAuditResult[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const db = getSQLiteConnection();
    if (!db) {
      throw new AppError('Database connection not available', 500, 'DB_ERROR');
    }

    const offset = (page - 1) * pageSize;
    
    // Get total count
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM security_audits');
    const { total } = countStmt.get() as { total: number };
    
    // Get paginated results
    const dataStmt = db.prepare(`
      SELECT * FROM security_audits
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const data = dataStmt.all(pageSize, offset) as any[];
    
    // Parse JSON fields
    const parsedData = data.map(row => ({
      ...row,
      violations: JSON.parse(row.violations || '[]'),
      recommendations: JSON.parse(row.recommendations || '[]'),
      timestamp: new Date(row.created_at)
    })) as SecurityAuditResult[];
    
    return {
      data: parsedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) return;

    try {
      const eventId = uuidv4();
      const stmt = db.prepare(`
        INSERT INTO security_events (id, type, severity, details, source)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        eventId,
        event.type,
        event.severity,
        JSON.stringify(event.details),
        event.source
      );
    } catch (error) {
      console.warn('Failed to log security event:', error);
    }
  }

  private async storeAuditResult(result: SecurityAuditResult): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) return;

    try {
      const stmt = db.prepare(`
        INSERT INTO security_audits (
          id, file_processed, pii_items_detected, masking_accuracy,
          encryption_status, compliance_score, violations, recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        uuidv4(),
        result.fileProcessed,
        result.piiItemsDetected,
        result.maskingAccuracy,
        result.encryptionStatus,
        result.complianceScore,
        JSON.stringify(result.violations),
        JSON.stringify(result.recommendations)
      );
    } catch (error) {
      console.warn('Failed to store audit result:', error);
    }
  }

  private async updateDatasetSecurity(
    datasetId: string, 
    auditResult: SecurityAuditResult, 
    piiSummary: any
  ): Promise<void> {
    const db = getSQLiteConnection();
    if (!db) return;

    try {
      const stmt = db.prepare(`
        UPDATE datasets 
        SET 
          security_audit_id = ?,
          pii_detected = ?,
          compliance_score = ?,
          risk_level = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        uuidv4(),
        auditResult.piiItemsDetected > 0 ? 1 : 0,
        auditResult.complianceScore,
        piiSummary.riskLevel,
        datasetId
      );
    } catch (error) {
      console.warn('Failed to update dataset security:', error);
    }
  }

  private getSeverityFromComplianceScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'low';
    if (score >= 0.7) return 'medium';
    if (score >= 0.5) return 'high';
    return 'critical';
  }

  private getRiskLevel(complianceScore: number): string {
    if (complianceScore >= 0.9) return 'low';
    if (complianceScore >= 0.7) return 'medium';
    if (complianceScore >= 0.5) return 'high';
    return 'critical';
  }
}