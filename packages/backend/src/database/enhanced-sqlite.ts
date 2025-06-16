import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getSQLiteConnection } from './sqlite';

/**
 * Enhanced SQLite Database Schema Manager
 * TASK-202: Database Schema Extensions
 * 
 * This module extends the existing SQLite database with enhanced tables
 * for compliance frameworks, risk assessments, custom patterns, and monitoring.
 */

export class EnhancedSQLiteManager {
  private db: Database.Database | null = null;

  constructor() {
    this.db = getSQLiteConnection();
  }

  /**
   * Initialize enhanced database schema
   */
  async initializeEnhancedSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('SQLite database not initialized. Call initializeSQLite() first.');
    }

    try {
      // Read and execute the enhanced schema
      const schemaPath = path.join(__dirname, 'enhanced-schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      // Split the SQL file into individual statements and execute them
      const statements = this.splitSQLStatements(schemaSQL);
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            this.db.exec(statement);
          } catch (error) {
            console.warn(`Warning executing schema statement: ${error.message}`);
            // Continue with other statements even if one fails (for idempotency)
          }
        }
      }

      console.log('Enhanced database schema initialized successfully');
      
      // Verify tables were created
      await this.verifyEnhancedTables();
      
    } catch (error) {
      console.error('Failed to initialize enhanced schema:', error);
      throw error;
    }
  }

  /**
   * Split SQL file into individual statements
   */
  private splitSQLStatements(sql: string): string[] {
    // Remove comments and split by semicolon
    const cleanSQL = sql
      .replace(/--.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
    
    return cleanSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
  }

  /**
   * Verify that all enhanced tables were created successfully
   */
  private async verifyEnhancedTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const expectedTables = [
      'compliance_frameworks',
      'framework_configurations', 
      'risk_assessments',
      'custom_patterns',
      'pattern_usage_logs',
      'audit_logs',
      'performance_metrics',
      'data_retention_policies',
      'data_lineage',
      'system_alerts'
    ];

    const existingTables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row: any) => row.name);

    const missingTables = expectedTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      throw new Error(`Failed to create tables: ${missingTables.join(', ')}`);
    }

    console.log(`Enhanced schema verification complete. ${expectedTables.length} tables verified.`);
  }

  /**
   * Seed initial data for compliance frameworks
   */
  async seedComplianceFrameworks(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const frameworks = [
      {
        id: 'hipaa-2023',
        name: 'HIPAA (Health Insurance Portability and Accountability Act)',
        description: 'US healthcare data protection framework',
        version: '2023.1',
        type: 'HIPAA',
        status: 'active',
        configuration: JSON.stringify({
          strictMode: true,
          auditFrequency: 30,
          encryptionRequired: true,
          accessLogging: true
        }),
        risk_thresholds: JSON.stringify({
          low: 20,
          medium: 40,
          high: 70,
          critical: 85
        }),
        industry: 'healthcare',
        jurisdiction: 'US',
        mandatory_fields: JSON.stringify(['patient_id', 'medical_record_number', 'ssn']),
        validation_rules: JSON.stringify({
          patientIdFormat: '^MRN\\d{8}$',
          ssnRequired: true,
          encryptionLevel: 'AES-256'
        }),
        audit_frequency: 30,
        retention_period: 2555, // 7 years
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'pci-dss-4.0',
        name: 'PCI DSS (Payment Card Industry Data Security Standard)',
        description: 'Credit card and payment data protection standard',
        version: '4.0',
        type: 'PCI-DSS',
        status: 'active',
        configuration: JSON.stringify({
          strictMode: true,
          auditFrequency: 90,
          encryptionRequired: true,
          tokenizationRequired: true,
          accessLogging: true
        }),
        risk_thresholds: JSON.stringify({
          low: 15,
          medium: 35,
          high: 65,
          critical: 80
        }),
        industry: 'financial',
        jurisdiction: 'Global',
        mandatory_fields: JSON.stringify(['credit_card_number', 'cvv', 'expiry_date']),
        validation_rules: JSON.stringify({
          cardNumberFormat: '^\\d{13,19}$',
          cvvRequired: true,
          encryptionLevel: 'AES-256',
          tokenization: true
        }),
        audit_frequency: 90,
        retention_period: 365,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'gdpr-2023',
        name: 'GDPR (General Data Protection Regulation)',
        description: 'EU data protection and privacy regulation',
        version: '2023.1',
        type: 'GDPR',
        status: 'active',
        configuration: JSON.stringify({
          strictMode: true,
          auditFrequency: 60,
          consentRequired: true,
          dataMinimization: true,
          rightToErasure: true,
          portabilitySupport: true
        }),
        risk_thresholds: JSON.stringify({
          low: 25,
          medium: 45,
          high: 70,
          critical: 90
        }),
        industry: 'general',
        jurisdiction: 'EU',
        mandatory_fields: JSON.stringify(['email', 'name', 'ip_address']),
        validation_rules: JSON.stringify({
          emailFormat: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$',
          consentTracking: true,
          dataRetentionLimits: true
        }),
        audit_frequency: 60,
        retention_period: 1095, // 3 years
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'ccpa-2023',
        name: 'CCPA (California Consumer Privacy Act)',
        description: 'California state privacy regulation',
        version: '2023.1',
        type: 'CCPA',
        status: 'active',
        configuration: JSON.stringify({
          strictMode: false,
          auditFrequency: 90,
          consumerRights: true,
          optOutSupport: true,
          dataDisclosure: true
        }),
        risk_thresholds: JSON.stringify({
          low: 30,
          medium: 50,
          high: 75,
          critical: 90
        }),
        industry: 'general',
        jurisdiction: 'US-CA',
        mandatory_fields: JSON.stringify(['personal_info', 'contact_info']),
        validation_rules: JSON.stringify({
          consumerRightsSupport: true,
          optOutMechanism: true,
          dataCategories: ['personal', 'commercial', 'biometric']
        }),
        audit_frequency: 90,
        retention_period: 1095,
        created_by: 'system',
        updated_by: 'system'
      }
    ];

    const insertFramework = this.db.prepare(`
      INSERT OR IGNORE INTO compliance_frameworks (
        id, name, description, version, type, status, configuration,
        risk_thresholds, industry, jurisdiction, mandatory_fields,
        validation_rules, audit_frequency, retention_period,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const framework of frameworks) {
      try {
        insertFramework.run(
          framework.id,
          framework.name,
          framework.description,
          framework.version,
          framework.type,
          framework.status,
          framework.configuration,
          framework.risk_thresholds,
          framework.industry,
          framework.jurisdiction,
          framework.mandatory_fields,
          framework.validation_rules,
          framework.audit_frequency,
          framework.retention_period,
          framework.created_by,
          framework.updated_by
        );
      } catch (error) {
        console.warn(`Warning seeding framework ${framework.id}: ${error.message}`);
      }
    }

    console.log('Compliance frameworks seeded successfully');
  }

  /**
   * Seed initial custom patterns
   */
  async seedCustomPatterns(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const patterns = [
      {
        id: 'pattern-ssn-001',
        name: 'US Social Security Number',
        description: 'Detects US Social Security Numbers in various formats',
        regex_pattern: '^(?!000|666|9\\d{2})\\d{3}-?(?!00)\\d{2}-?(?!0000)\\d{4}$',
        category: 'personal',
        industry: 'general',
        confidence_level: 0.95,
        priority: 1,
        enabled: true,
        test_cases: JSON.stringify(['123-45-6789', '123456789', '123 45 6789']),
        invalid_cases: JSON.stringify(['000-00-0000', '666-00-0000', '123-00-0000']),
        compliance_frameworks: JSON.stringify(['hipaa-2023', 'ccpa-2023']),
        data_classification: 'Personal',
        sensitivity_level: 'critical',
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'pattern-cc-001',
        name: 'Credit Card Number',
        description: 'Detects credit card numbers (Visa, MasterCard, etc.)',
        regex_pattern: '^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$',
        category: 'financial',
        industry: 'financial',
        confidence_level: 0.98,
        priority: 1,
        enabled: true,
        test_cases: JSON.stringify(['4111111111111111', '5555555555554444', '378282246310005']),
        invalid_cases: JSON.stringify(['1234567890123456', '0000000000000000']),
        compliance_frameworks: JSON.stringify(['pci-dss-4.0']),
        data_classification: 'Financial',
        sensitivity_level: 'critical',
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'pattern-email-001',
        name: 'Email Address',
        description: 'Detects email addresses in standard format',
        regex_pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        category: 'personal',
        industry: 'general',
        confidence_level: 0.92,
        priority: 3,
        enabled: true,
        test_cases: JSON.stringify(['user@example.com', 'test.email+tag@domain.co.uk']),
        invalid_cases: JSON.stringify(['invalid.email', '@domain.com', 'user@']),
        compliance_frameworks: JSON.stringify(['gdpr-2023', 'ccpa-2023']),
        data_classification: 'Personal',
        sensitivity_level: 'medium',
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'pattern-phone-001',
        name: 'US Phone Number',
        description: 'Detects US phone numbers in various formats',
        regex_pattern: '^(?:\\+1[-.]?)?(?:\\(?([0-9]{3})\\)?[-.]?)?([0-9]{3})[-.]?([0-9]{4})$',
        category: 'personal',
        industry: 'general',
        confidence_level: 0.88,
        priority: 4,
        enabled: true,
        test_cases: JSON.stringify(['(555) 123-4567', '+1-555-123-4567', '5551234567']),
        invalid_cases: JSON.stringify(['123-456', '000-000-0000']),
        compliance_frameworks: JSON.stringify(['hipaa-2023', 'ccpa-2023']),
        data_classification: 'Personal',
        sensitivity_level: 'medium',
        created_by: 'system',
        updated_by: 'system'
      }
    ];

    const insertPattern = this.db.prepare(`
      INSERT OR IGNORE INTO custom_patterns (
        id, name, description, regex_pattern, category, industry,
        confidence_level, priority, enabled, test_cases, invalid_cases,
        compliance_frameworks, data_classification, sensitivity_level,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const pattern of patterns) {
      try {
        insertPattern.run(
          pattern.id,
          pattern.name,
          pattern.description,
          pattern.regex_pattern,
          pattern.category,
          pattern.industry,
          pattern.confidence_level,
          pattern.priority,
          pattern.enabled,
          pattern.test_cases,
          pattern.invalid_cases,
          pattern.compliance_frameworks,
          pattern.data_classification,
          pattern.sensitivity_level,
          pattern.created_by,
          pattern.updated_by
        );
      } catch (error) {
        console.warn(`Warning seeding pattern ${pattern.id}: ${error.message}`);
      }
    }

    console.log('Custom patterns seeded successfully');
  }

  /**
   * Seed initial data retention policies
   */
  async seedDataRetentionPolicies(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const policies = [
      {
        id: 'policy-hipaa-retention',
        policy_name: 'HIPAA Medical Records Retention',
        description: 'Retention policy for medical records under HIPAA compliance',
        applies_to_table: 'risk_assessments',
        applies_to_data_type: 'medical',
        framework_id: 'hipaa-2023',
        retention_period_days: 2555, // 7 years
        auto_delete: false,
        archive_before_delete: true,
        archive_location: 's3://compliance-archives/hipaa',
        conditions: JSON.stringify({
          data_classification: 'medical',
          sensitivity_level: ['high', 'critical']
        }),
        legal_hold_exempt: false,
        check_frequency_hours: 24,
        batch_size: 100,
        active: true,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'policy-pci-retention',
        policy_name: 'PCI DSS Payment Data Retention', 
        description: 'Retention policy for payment card data under PCI DSS',
        applies_to_table: 'audit_logs',
        applies_to_data_type: 'financial',
        framework_id: 'pci-dss-4.0',
        retention_period_days: 365, // 1 year
        auto_delete: true,
        archive_before_delete: true,
        archive_location: 's3://compliance-archives/pci',
        conditions: JSON.stringify({
          event_category: 'security',
          resource_type: 'payment_data'
        }),
        legal_hold_exempt: false,
        check_frequency_hours: 12,
        batch_size: 500,
        active: true,
        created_by: 'system',
        updated_by: 'system'
      },
      {
        id: 'policy-gdpr-retention',
        policy_name: 'GDPR Personal Data Retention',
        description: 'Retention policy for personal data under GDPR',
        applies_to_table: 'audit_logs',
        applies_to_data_type: 'personal',
        framework_id: 'gdpr-2023',
        retention_period_days: 1095, // 3 years
        auto_delete: false,
        archive_before_delete: true,
        archive_location: 's3://compliance-archives/gdpr',
        conditions: JSON.stringify({
          data_classification: 'personal',
          jurisdiction: 'EU'
        }),
        legal_hold_exempt: true,
        exception_conditions: JSON.stringify({
          consent_withdrawn: true,
          right_to_erasure_requested: true
        }),
        check_frequency_hours: 24,
        batch_size: 200,
        active: true,
        created_by: 'system',
        updated_by: 'system'
      }
    ];

    const insertPolicy = this.db.prepare(`
      INSERT OR IGNORE INTO data_retention_policies (
        id, policy_name, description, applies_to_table, applies_to_data_type,
        framework_id, retention_period_days, auto_delete, archive_before_delete,
        archive_location, conditions, legal_hold_exempt, exception_conditions,
        check_frequency_hours, batch_size, active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const policy of policies) {
      try {
        insertPolicy.run(
          policy.id,
          policy.policy_name,
          policy.description,
          policy.applies_to_table,
          policy.applies_to_data_type,
          policy.framework_id,
          policy.retention_period_days,
          policy.auto_delete,
          policy.archive_before_delete,
          policy.archive_location,
          policy.conditions,
          policy.legal_hold_exempt,
          policy.exception_conditions || null,
          policy.check_frequency_hours,
          policy.batch_size,
          policy.active,
          policy.created_by,
          policy.updated_by
        );
      } catch (error) {
        console.warn(`Warning seeding retention policy ${policy.id}: ${error.message}`);
      }
    }

    console.log('Data retention policies seeded successfully');
  }

  /**
   * Get database statistics and health information
   */
  async getDatabaseStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = {
      tables: {} as any,
      indexes: 0,
      triggers: 0,
      views: 0,
      totalSize: 0,
      lastVacuum: null
    };

    // Get table statistics
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as any[];

    for (const table of tables) {
      const tableName = table.name;
      const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as any;
      const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      stats.tables[tableName] = {
        rowCount: count.count,
        columnCount: tableInfo.length,
        columns: tableInfo.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          primaryKey: col.pk === 1
        }))
      };
    }

    // Count indexes, triggers, and views
    const indexCount = this.db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")
      .get() as any;
    stats.indexes = indexCount.count;

    const triggerCount = this.db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'")
      .get() as any;
    stats.triggers = triggerCount.count;

    const viewCount = this.db
      .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='view'")
      .get() as any;
    stats.views = viewCount.count;

    return stats;
  }

  /**
   * Initialize all enhanced database components
   */
  async initializeComplete(): Promise<void> {
    console.log('Starting enhanced database initialization...');
    
    await this.initializeEnhancedSchema();
    await this.seedComplianceFrameworks();
    await this.seedCustomPatterns();
    await this.seedDataRetentionPolicies();
    
    const stats = await this.getDatabaseStats();
    console.log('Enhanced database initialization complete:');
    console.log(`- Tables: ${Object.keys(stats.tables).length}`);
    console.log(`- Indexes: ${stats.indexes}`);
    console.log(`- Triggers: ${stats.triggers}`);
    console.log(`- Views: ${stats.views}`);
  }
}

// Export singleton instance
export const enhancedSQLiteManager = new EnhancedSQLiteManager();