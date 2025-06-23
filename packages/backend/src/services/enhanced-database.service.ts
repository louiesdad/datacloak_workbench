import { getSQLiteConnection } from '../database/sqlite-refactored';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Database Service
 * TASK-202: Database Schema Extensions
 * 
 * Service layer for interacting with enhanced database tables
 * including compliance frameworks, risk assessments, custom patterns, etc.
 */

export interface ComplianceFramework {
  id: string;
  name: string;
  description?: string;
  version: string;
  type: 'HIPAA' | 'PCI-DSS' | 'GDPR' | 'CCPA' | 'SOX' | 'ISO27001' | 'NIST' | 'Custom';
  status: 'active' | 'inactive' | 'deprecated';
  configuration?: any;
  risk_thresholds?: any;
  industry?: string;
  jurisdiction?: string;
  mandatory_fields?: string[];
  validation_rules?: any;
  audit_frequency?: number;
  retention_period?: number;
  created_at?: string;
  updated_at?: string;
  last_audit_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface RiskAssessment {
  id: string;
  assessment_name: string;
  dataset_id?: string;
  framework_id: string;
  overall_risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  pii_risk_score?: number;
  financial_risk_score?: number;
  health_risk_score?: number;
  geographic_risk_score?: number;
  data_categories_detected?: string[];
  sensitive_fields_count?: number;
  total_records_analyzed?: number;
  geographic_jurisdiction?: string;
  data_residency_requirements?: any;
  cross_border_transfer_risk?: number;
  compliance_violations?: any[];
  recommendations?: string[];
  mitigation_strategies?: string[];
  analysis_duration?: number;
  algorithm_version?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reviewed';
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  assessed_by?: string;
  reviewed_by?: string;
  review_comments?: string;
}

export interface CustomPattern {
  id: string;
  name: string;
  description?: string;
  regex_pattern: string;
  category: string;
  industry: string;
  confidence_level: number;
  priority: number;
  enabled: boolean;
  test_cases?: string[];
  invalid_cases?: string[];
  validation_results?: any;
  avg_processing_time?: number;
  accuracy_rate?: number;
  false_positive_rate?: number;
  false_negative_rate?: number;
  times_used?: number;
  successful_matches?: number;
  failed_matches?: number;
  complexity_score?: number;
  estimated_processing_time?: number;
  optimization_suggestions?: string[];
  compliance_frameworks?: string[];
  data_classification?: string;
  sensitivity_level?: 'low' | 'medium' | 'high' | 'critical';
  created_at?: string;
  updated_at?: string;
  last_used_at?: string;
  created_by?: string;
  updated_by?: string;
  version?: number;
}

export interface AuditLog {
  id: string;
  event_type: string;
  event_category: 'security' | 'compliance' | 'data' | 'system' | 'user';
  description: string;
  details?: any;
  user_id?: string;
  user_email?: string;
  user_role?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  framework_id?: string;
  compliance_requirement?: string;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  old_values?: any;
  new_values?: any;
  event_timestamp?: string;
  retention_until?: string;
  archived?: boolean;
}

export class EnhancedDatabaseService {
  private db: Database.Database | null = null;
  private preparedStatements: Map<string, any> = new Map();
  private maxPreparedStatements: number = 100;

  constructor() {
    // Initialize synchronously in tests, async in production
    this.initialize().catch(error => {
      console.warn('Failed to initialize Enhanced Database Service:', error);
    });
  }

  private async initialize() {
    try {
      // Check if we're in a test environment
      if (process.env.NODE_ENV === 'test') {
        // Try synchronous first for test mocks
        try {
          this.db = await getSQLiteConnection();
        } catch (error: any) {
          console.warn('Database not available for EnhancedDatabaseService:', error.message);
          this.db = null;
        }
      } else {
        // Production: handle async initialization
        getSQLiteConnection().then(db => {
          this.db = db;
        }).catch(error => {
          console.warn('Database not available for EnhancedDatabaseService:', error.message);
          this.db = null;
        });
      }
    } catch (error: any) {
      console.warn('Database not available for EnhancedDatabaseService:', error.message);
      this.db = null;
    }
  }

  // ==============================================
  // COMPLIANCE FRAMEWORKS OPERATIONS
  // ==============================================

  async getComplianceFrameworks(filters?: {
    type?: string;
    status?: string;
    industry?: string;
  }): Promise<ComplianceFramework[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM compliance_frameworks WHERE 1=1';
    const params: any[] = [];

    if (filters?.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.industry) {
      query += ' AND industry = ?';
      params.push(filters.industry);
    }

    query += ' ORDER BY created_at DESC';

    const results = this.db.prepare(query).all(...params) as any[];
    return results.map(this.parseComplianceFramework);
  }

  async getComplianceFrameworkById(id: string): Promise<ComplianceFramework | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db
      .prepare('SELECT * FROM compliance_frameworks WHERE id = ?')
      .get(id) as any;

    return result ? this.parseComplianceFramework(result) : null;
  }

  async createComplianceFramework(framework: Omit<ComplianceFramework, 'id' | 'created_at' | 'updated_at'>): Promise<ComplianceFramework> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO compliance_frameworks (
        id, name, description, version, type, status, configuration,
        risk_thresholds, industry, jurisdiction, mandatory_fields,
        validation_rules, audit_frequency, retention_period,
        created_at, updated_at, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      framework.name,
      framework.description || null,
      framework.version,
      framework.type,
      framework.status,
      framework.configuration ? JSON.stringify(framework.configuration) : null,
      framework.risk_thresholds ? JSON.stringify(framework.risk_thresholds) : null,
      framework.industry || null,
      framework.jurisdiction || null,
      framework.mandatory_fields ? JSON.stringify(framework.mandatory_fields) : null,
      framework.validation_rules ? JSON.stringify(framework.validation_rules) : null,
      framework.audit_frequency || null,
      framework.retention_period || null,
      now,
      now,
      framework.created_by || null,
      framework.updated_by || null
    );

    return this.getComplianceFrameworkById(id) as Promise<ComplianceFramework>;
  }

  async updateComplianceFramework(id: string, updates: Partial<ComplianceFramework>): Promise<ComplianceFramework | null> {
    if (!this.db) throw new Error('Database not initialized');

    const existingFramework = await this.getComplianceFrameworkById(id);
    if (!existingFramework) return null;

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at' && value !== undefined) {
        fields.push(`${key} = ?`);
        if (typeof value === 'object' && value !== null) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return existingFramework;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE compliance_frameworks 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getComplianceFrameworkById(id);
  }

  async deleteComplianceFramework(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM compliance_frameworks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==============================================
  // RISK ASSESSMENTS OPERATIONS
  // ==============================================

  async getRiskAssessments(filters?: {
    framework_id?: string;
    dataset_id?: string;
    risk_level?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<RiskAssessment[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM risk_assessments WHERE 1=1';
    const params: any[] = [];

    if (filters?.framework_id) {
      query += ' AND framework_id = ?';
      params.push(filters.framework_id);
    }
    if (filters?.dataset_id) {
      query += ' AND dataset_id = ?';
      params.push(filters.dataset_id);
    }
    if (filters?.risk_level) {
      query += ' AND risk_level = ?';
      params.push(filters.risk_level);
    }
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const results = this.db.prepare(query).all(...params) as any[];
    return results.map(this.parseRiskAssessment);
  }

  async createRiskAssessment(assessment: Omit<RiskAssessment, 'id' | 'created_at' | 'updated_at'>): Promise<RiskAssessment> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO risk_assessments (
        id, assessment_name, dataset_id, framework_id, overall_risk_score,
        risk_level, confidence_score, pii_risk_score, financial_risk_score,
        health_risk_score, geographic_risk_score, data_categories_detected,
        sensitive_fields_count, total_records_analyzed, geographic_jurisdiction,
        data_residency_requirements, cross_border_transfer_risk,
        compliance_violations, recommendations, mitigation_strategies,
        analysis_duration, algorithm_version, status, created_at, updated_at,
        assessed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      assessment.assessment_name,
      assessment.dataset_id || null,
      assessment.framework_id,
      assessment.overall_risk_score,
      assessment.risk_level,
      assessment.confidence_score,
      assessment.pii_risk_score || null,
      assessment.financial_risk_score || null,
      assessment.health_risk_score || null,
      assessment.geographic_risk_score || null,
      assessment.data_categories_detected ? JSON.stringify(assessment.data_categories_detected) : null,
      assessment.sensitive_fields_count || null,
      assessment.total_records_analyzed || null,
      assessment.geographic_jurisdiction || null,
      assessment.data_residency_requirements ? JSON.stringify(assessment.data_residency_requirements) : null,
      assessment.cross_border_transfer_risk || null,
      assessment.compliance_violations ? JSON.stringify(assessment.compliance_violations) : null,
      assessment.recommendations ? JSON.stringify(assessment.recommendations) : null,
      assessment.mitigation_strategies ? JSON.stringify(assessment.mitigation_strategies) : null,
      assessment.analysis_duration || null,
      assessment.algorithm_version || null,
      assessment.status,
      now,
      now,
      assessment.assessed_by || null
    );

    return this.getRiskAssessmentById(id) as Promise<RiskAssessment>;
  }

  async getRiskAssessmentById(id: string): Promise<RiskAssessment | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db
      .prepare('SELECT * FROM risk_assessments WHERE id = ?')
      .get(id) as any;

    return result ? this.parseRiskAssessment(result) : null;
  }

  // ==============================================
  // CUSTOM PATTERNS OPERATIONS
  // ==============================================

  async getCustomPatterns(filters?: {
    category?: string;
    industry?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CustomPattern[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM custom_patterns WHERE 1=1';
    const params: any[] = [];

    if (filters?.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.industry) {
      query += ' AND industry = ?';
      params.push(filters.industry);
    }
    if (filters?.enabled !== undefined) {
      query += ' AND enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }

    query += ' ORDER BY priority ASC, accuracy_rate DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const results = this.db.prepare(query).all(...params) as any[];
    return results.map(this.parseCustomPattern);
  }

  async createCustomPattern(pattern: Omit<CustomPattern, 'id' | 'created_at' | 'updated_at'>): Promise<CustomPattern> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO custom_patterns (
        id, name, description, regex_pattern, category, industry,
        confidence_level, priority, enabled, test_cases, invalid_cases,
        compliance_frameworks, data_classification, sensitivity_level,
        created_at, updated_at, created_by, updated_by, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      pattern.name,
      pattern.description || null,
      pattern.regex_pattern,
      pattern.category,
      pattern.industry,
      pattern.confidence_level,
      pattern.priority,
      pattern.enabled ? 1 : 0,
      pattern.test_cases ? JSON.stringify(pattern.test_cases) : null,
      pattern.invalid_cases ? JSON.stringify(pattern.invalid_cases) : null,
      pattern.compliance_frameworks ? JSON.stringify(pattern.compliance_frameworks) : null,
      pattern.data_classification || null,
      pattern.sensitivity_level || null,
      now,
      now,
      pattern.created_by || null,
      pattern.updated_by || null,
      pattern.version || 1
    );

    return this.getCustomPatternById(id) as Promise<CustomPattern>;
  }

  async getCustomPatternById(id: string): Promise<CustomPattern | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db
      .prepare('SELECT * FROM custom_patterns WHERE id = ?')
      .get(id) as any;

    return result ? this.parseCustomPattern(result) : null;
  }

  // ==============================================
  // AUDIT LOGS OPERATIONS
  // ==============================================

  async createAuditLog(log: Omit<AuditLog, 'id' | 'event_timestamp'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, event_type, event_category, description, details, user_id,
        user_email, user_role, session_id, ip_address, user_agent,
        resource_type, resource_id, resource_name, framework_id,
        compliance_requirement, risk_level, severity, old_values,
        new_values, event_timestamp, retention_until, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      log.event_type,
      log.event_category,
      log.description,
      log.details ? JSON.stringify(log.details) : null,
      log.user_id || null,
      log.user_email || null,
      log.user_role || null,
      log.session_id || null,
      log.ip_address || null,
      log.user_agent || null,
      log.resource_type || null,
      log.resource_id || null,
      log.resource_name || null,
      log.framework_id || null,
      log.compliance_requirement || null,
      log.risk_level || null,
      log.severity || null,
      log.old_values ? JSON.stringify(log.old_values) : null,
      log.new_values ? JSON.stringify(log.new_values) : null,
      now,
      log.retention_until || null,
      log.archived ? 1 : 0
    );

    return id;
  }

  async getAuditLogs(filters?: {
    event_type?: string;
    event_category?: string;
    user_id?: string;
    resource_type?: string;
    severity?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.event_type) {
      query += ' AND event_type = ?';
      params.push(filters.event_type);
    }
    if (filters?.event_category) {
      query += ' AND event_category = ?';
      params.push(filters.event_category);
    }
    if (filters?.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters?.resource_type) {
      query += ' AND resource_type = ?';
      params.push(filters.resource_type);
    }
    if (filters?.severity) {
      query += ' AND severity = ?';
      params.push(filters.severity);
    }
    if (filters?.start_date) {
      query += ' AND event_timestamp >= ?';
      params.push(filters.start_date);
    }
    if (filters?.end_date) {
      query += ' AND event_timestamp <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY event_timestamp DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const results = this.db.prepare(query).all(...params) as any[];
    return results.map(this.parseAuditLog);
  }

  // ==============================================
  // GENERIC DATABASE OPERATIONS
  // ==============================================

  async executeQuery(sql: string, params?: any[]): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    // Check prepared statement cache
    let stmt = this.preparedStatements.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      
      // Cache management - remove oldest if at limit
      if (this.preparedStatements.size >= this.maxPreparedStatements) {
        const firstKey = this.preparedStatements.keys().next().value;
        this.preparedStatements.delete(firstKey);
      }
      
      this.preparedStatements.set(sql, stmt);
    }
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      if (sql.includes('GROUP BY') || sql.includes('COUNT(') || sql.includes('SUM(') || sql.includes('AVG(') || sql.includes('MAX(') || sql.includes('MIN(')) {
        // Use DuckDB for analytical queries (mock for now)
        return params ? stmt.all(...params) : stmt.all();
      }
      return params ? stmt.all(...params) : stmt.all();
    } else {
      // INSERT, UPDATE, DELETE
      return params ? stmt.run(...params) : stmt.run();
    }
  }

  async batchExecute(queries: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction((queries: Array<{ sql: string; params?: any[] }>) => {
      const results: any[] = [];
      for (const query of queries) {
        const stmt = this.db!.prepare(query.sql);
        const result = query.params ? stmt.run(...query.params) : stmt.run();
        results.push(result);
      }
      return results;
    });

    return transaction(queries);
  }

  async importCSV(tableName: string, csvData: string): Promise<{ rowsImported: number; errors: string[] }> {
    if (!this.db) throw new Error('Database not initialized');

    const errors: string[] = [];
    let rowsImported = 0;

    try {
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        errors.push('CSV must have header and at least one data row');
        return { rowsImported, errors };
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const placeholders = headers.map(() => '?').join(', ');
      const stmt = this.db.prepare(`INSERT INTO ${tableName} (${headers.join(', ')}) VALUES (${placeholders})`);

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length !== headers.length) {
            errors.push(`Row ${i}: Expected ${headers.length} columns, got ${values.length}`);
            continue;
          }
          stmt.run(...values);
          rowsImported++;
        } catch (error: any) {
          errors.push(`Row ${i}: ${error.message}`);
        }
      }
    } catch (error: any) {
      errors.push(`CSV parsing error: ${error.message}`);
    }

    return { rowsImported, errors };
  }

  async exportTable(tableName: string, format: 'csv' | 'json', whereClause?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    if (format !== 'csv' && format !== 'json') {
      throw new Error('Unsupported export format');
    }

    let query = `SELECT * FROM ${tableName}`;
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }

    const results = this.db.prepare(query).all();

    if (results.length === 0) {
      return '';
    }

    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }

    // CSV format
    const headers = Object.keys(results[0] as any);
    const csvLines = [headers.join(',')];
    
    for (const row of results) {
      const values = headers.map(header => {
        const value = (row as any)[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvLines.push(values.join(','));
    }

    return csvLines.join('\n');
  }

  async createTable(tableName: string, schema: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const columns = schema.columns.map((col: any) => {
      let columnDef = `${col.name} ${col.type}`;
      if (col.primaryKey) columnDef += ' PRIMARY KEY';
      if (col.autoIncrement) columnDef += ' AUTOINCREMENT';
      if (col.notNull) columnDef += ' NOT NULL';
      if (col.unique) columnDef += ' UNIQUE';
      if (col.default) columnDef += ` DEFAULT ${col.default}`;
      return columnDef;
    }).join(', ');

    const createTableSQL = `CREATE TABLE ${tableName} (${columns})`;
    this.db.exec(createTableSQL);

    // Create indexes if specified
    if (schema.indexes) {
      for (const index of schema.indexes) {
        const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
        const indexSQL = `CREATE ${indexType} ${index.name} ON ${tableName} (${index.columns.join(', ')})`;
        this.db.exec(indexSQL);
      }
    }
  }

  async getTableSchema(tableName: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    const columns = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
    
    if (columns.length === 0) {
      return null;
    }

    return {
      columns: columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        primaryKey: col.pk === 1,
        default: col.dflt_value
      }))
    };
  }

  async createIndex(tableName: string, columns: string[], options: { unique?: boolean } = {}): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexType = options.unique ? 'UNIQUE INDEX' : 'INDEX';
    const indexName = `idx_${tableName}_${columns.join('_')}`;
    const indexSQL = `CREATE ${indexType} ${indexName} ON ${tableName} (${columns.join(', ')})`;
    
    this.db.exec(indexSQL);
  }

  async analyze(tableName?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const sql = tableName ? `ANALYZE ${tableName}` : 'ANALYZE';
    this.db.exec(sql);
  }

  async vacuum(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec('VACUUM');
  }

  async runAnalyticsQuery(sql: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    // For now, run on SQLite (in a real implementation, this would use DuckDB)
    return this.db.prepare(sql).all();
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        // Ignore close errors
      }
      this.db = null;
    }
  }

  async healthCheck(): Promise<{ sqlite: boolean; duckdb: boolean; overall: boolean }> {
    let sqlite = false;
    let duckdb = false;

    try {
      if (this.db) {
        this.db.prepare('SELECT 1 as result').get();
        sqlite = true;
      }
    } catch (error) {
      sqlite = false;
    }

    try {
      // Mock DuckDB health check
      duckdb = true;
    } catch (error) {
      duckdb = false;
    }

    return {
      sqlite,
      duckdb,
      overall: sqlite && duckdb
    };
  }

  // ==============================================
  // HELPER METHODS
  // ==============================================

  private parseComplianceFramework(row: any): ComplianceFramework {
    return {
      ...row,
      configuration: row.configuration ? JSON.parse(row.configuration) : null,
      risk_thresholds: row.risk_thresholds ? JSON.parse(row.risk_thresholds) : null,
      mandatory_fields: row.mandatory_fields ? JSON.parse(row.mandatory_fields) : null,
      validation_rules: row.validation_rules ? JSON.parse(row.validation_rules) : null
    };
  }

  private parseRiskAssessment(row: any): RiskAssessment {
    return {
      ...row,
      data_categories_detected: row.data_categories_detected ? JSON.parse(row.data_categories_detected) : null,
      data_residency_requirements: row.data_residency_requirements ? JSON.parse(row.data_residency_requirements) : null,
      compliance_violations: row.compliance_violations ? JSON.parse(row.compliance_violations) : null,
      recommendations: row.recommendations ? JSON.parse(row.recommendations) : null,
      mitigation_strategies: row.mitigation_strategies ? JSON.parse(row.mitigation_strategies) : null
    };
  }

  private parseCustomPattern(row: any): CustomPattern {
    return {
      ...row,
      enabled: row.enabled === 1,
      test_cases: row.test_cases ? JSON.parse(row.test_cases) : null,
      invalid_cases: row.invalid_cases ? JSON.parse(row.invalid_cases) : null,
      validation_results: row.validation_results ? JSON.parse(row.validation_results) : null,
      optimization_suggestions: row.optimization_suggestions ? JSON.parse(row.optimization_suggestions) : null,
      compliance_frameworks: row.compliance_frameworks ? JSON.parse(row.compliance_frameworks) : null
    };
  }

  private parseAuditLog(row: any): AuditLog {
    return {
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
      old_values: row.old_values ? JSON.parse(row.old_values) : null,
      new_values: row.new_values ? JSON.parse(row.new_values) : null,
      archived: row.archived === 1
    };
  }
}

// Export factory function instead of singleton to avoid module load issues
export const createEnhancedDatabaseService = () => new EnhancedDatabaseService();

// Lazy singleton for backward compatibility
let enhancedDatabaseServiceInstance: EnhancedDatabaseService | null = null;
export const getEnhancedDatabaseService = () => {
  if (!enhancedDatabaseServiceInstance) {
    enhancedDatabaseServiceInstance = new EnhancedDatabaseService();
  }
  return enhancedDatabaseServiceInstance;
};