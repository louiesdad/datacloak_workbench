-- Enhanced DataCloak Database Schema Extensions
-- TASK-202: Database Schema Extensions for Advanced Features
-- Created for compliance framework, risk assessment, custom patterns, and monitoring

-- ==============================================
-- 1. COMPLIANCE FRAMEWORKS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0',
    type TEXT NOT NULL CHECK (type IN ('HIPAA', 'PCI-DSS', 'GDPR', 'CCPA', 'SOX', 'ISO27001', 'NIST', 'Custom')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    
    -- Configuration stored as JSON
    configuration TEXT, -- JSON object containing framework-specific settings
    
    -- Risk scoring parameters
    risk_thresholds TEXT, -- JSON: {"low": 25, "medium": 50, "high": 75, "critical": 90}
    
    -- Framework metadata
    industry TEXT, -- Target industry: healthcare, financial, retail, government, etc.
    jurisdiction TEXT, -- Geographic scope: US, EU, UK, Global, etc.
    mandatory_fields TEXT, -- JSON array of required fields for compliance
    
    -- Audit and validation
    validation_rules TEXT, -- JSON object with validation criteria
    audit_frequency INTEGER DEFAULT 30, -- Days between audits
    retention_period INTEGER DEFAULT 2555, -- Days (7 years default)
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_audit_at DATETIME,
    
    -- Audit trail
    created_by TEXT,
    updated_by TEXT
);

-- ==============================================
-- 2. FRAMEWORK CONFIGURATIONS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS framework_configurations (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    
    -- Configuration details
    config_name TEXT NOT NULL,
    config_value TEXT, -- JSON or text value
    config_type TEXT NOT NULL CHECK (config_type IN ('string', 'number', 'boolean', 'json', 'array')),
    
    -- Validation
    is_required BOOLEAN DEFAULT FALSE,
    validation_pattern TEXT, -- Regex pattern for validation
    default_value TEXT,
    
    -- Metadata
    description TEXT,
    category TEXT, -- Group related configurations
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(framework_id, config_name)
);

-- ==============================================
-- 3. RISK ASSESSMENTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS risk_assessments (
    id TEXT PRIMARY KEY,
    
    -- Assessment metadata
    assessment_name TEXT NOT NULL,
    dataset_id TEXT REFERENCES datasets(id) ON DELETE SET NULL,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    
    -- Risk scoring
    overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Detailed risk breakdown
    pii_risk_score INTEGER DEFAULT 0,
    financial_risk_score INTEGER DEFAULT 0,
    health_risk_score INTEGER DEFAULT 0,
    geographic_risk_score INTEGER DEFAULT 0,
    
    -- Assessment data
    data_categories_detected TEXT, -- JSON array of detected data types
    sensitive_fields_count INTEGER DEFAULT 0,
    total_records_analyzed INTEGER DEFAULT 0,
    
    -- Geographic and contextual risk
    geographic_jurisdiction TEXT,
    data_residency_requirements TEXT, -- JSON object
    cross_border_transfer_risk INTEGER DEFAULT 0,
    
    -- Compliance mapping
    compliance_violations TEXT, -- JSON array of specific violations
    recommendations TEXT, -- JSON array of remediation recommendations
    mitigation_strategies TEXT, -- JSON array of risk mitigation options
    
    -- Processing metadata
    analysis_duration INTEGER, -- Processing time in milliseconds
    algorithm_version TEXT DEFAULT '1.0',
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reviewed')),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    
    -- Audit information
    assessed_by TEXT,
    reviewed_by TEXT,
    review_comments TEXT
);

-- ==============================================
-- 4. CUSTOM PATTERNS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS custom_patterns (
    id TEXT PRIMARY KEY,
    
    -- Pattern definition
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    regex_pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    industry TEXT DEFAULT 'general',
    
    -- Pattern metadata
    confidence_level REAL NOT NULL DEFAULT 0.8 CHECK (confidence_level >= 0 AND confidence_level <= 1),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Validation and testing
    test_cases TEXT, -- JSON array of positive test cases
    invalid_cases TEXT, -- JSON array of negative test cases
    validation_results TEXT, -- JSON object with test results
    
    -- Performance metrics
    avg_processing_time REAL DEFAULT 0, -- Milliseconds
    accuracy_rate REAL DEFAULT 0 CHECK (accuracy_rate >= 0 AND accuracy_rate <= 1),
    false_positive_rate REAL DEFAULT 0 CHECK (false_positive_rate >= 0 AND false_positive_rate <= 1),
    false_negative_rate REAL DEFAULT 0 CHECK (false_negative_rate >= 0 AND false_negative_rate <= 1),
    
    -- Usage statistics
    times_used INTEGER DEFAULT 0,
    successful_matches INTEGER DEFAULT 0,
    failed_matches INTEGER DEFAULT 0,
    
    -- Pattern complexity and optimization
    complexity_score INTEGER DEFAULT 0,
    estimated_processing_time REAL DEFAULT 0,
    optimization_suggestions TEXT, -- JSON array
    
    -- Compliance mapping
    compliance_frameworks TEXT, -- JSON array of applicable frameworks
    data_classification TEXT, -- Personal, Financial, Health, etc.
    sensitivity_level TEXT CHECK (sensitivity_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    
    -- Audit trail
    created_by TEXT,
    updated_by TEXT,
    version INTEGER DEFAULT 1
);

-- ==============================================
-- 5. PATTERN USAGE LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS pattern_usage_logs (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL REFERENCES custom_patterns(id) ON DELETE CASCADE,
    
    -- Usage context
    dataset_id TEXT REFERENCES datasets(id) ON DELETE SET NULL,
    risk_assessment_id TEXT REFERENCES risk_assessments(id) ON DELETE SET NULL,
    
    -- Performance data
    processing_time REAL NOT NULL, -- Milliseconds
    matches_found INTEGER DEFAULT 0,
    confidence_score REAL,
    
    -- Result metadata
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamps
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- 6. AUDIT LOGS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    
    -- Event identification
    event_type TEXT NOT NULL CHECK (event_type IN (
        'data_access', 'data_modification', 'pattern_creation', 'pattern_modification',
        'risk_assessment', 'compliance_check', 'configuration_change', 'user_action',
        'system_event', 'security_event', 'export_event', 'import_event'
    )),
    event_category TEXT NOT NULL CHECK (event_category IN ('security', 'compliance', 'data', 'system', 'user')),
    
    -- Event details
    description TEXT NOT NULL,
    details TEXT, -- JSON object with event-specific data
    
    -- Context information
    user_id TEXT,
    user_email TEXT,
    user_role TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- Resource information
    resource_type TEXT, -- table, file, pattern, etc.
    resource_id TEXT,
    resource_name TEXT,
    
    -- Compliance context
    framework_id TEXT REFERENCES compliance_frameworks(id) ON DELETE SET NULL,
    compliance_requirement TEXT,
    
    -- Risk and severity
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    
    -- Data changes (for modification events)
    old_values TEXT, -- JSON object
    new_values TEXT, -- JSON object
    
    -- Timestamps
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Compliance metadata
    retention_until DATETIME, -- When this log can be deleted
    archived BOOLEAN DEFAULT FALSE
);

-- ==============================================
-- 7. PERFORMANCE METRICS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    
    -- Metric identification
    metric_name TEXT NOT NULL,
    metric_category TEXT NOT NULL CHECK (metric_category IN (
        'api_performance', 'database_performance', 'cache_performance', 
        'pattern_performance', 'system_resources', 'user_activity'
    )),
    
    -- Metric values
    numeric_value REAL,
    string_value TEXT,
    json_value TEXT, -- Complex metric data
    
    -- Context
    component TEXT, -- Which component generated this metric
    endpoint TEXT, -- API endpoint (if applicable)
    operation TEXT, -- Specific operation being measured
    
    -- Aggregation info
    aggregation_type TEXT CHECK (aggregation_type IN ('instant', 'average', 'sum', 'count', 'min', 'max')),
    time_window INTEGER, -- Seconds over which metric was collected
    
    -- Metadata
    tags TEXT, -- JSON object with additional tags
    
    -- Timestamps
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    period_start DATETIME,
    period_end DATETIME
);

-- ==============================================
-- 8. DATA RETENTION POLICIES TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id TEXT PRIMARY KEY,
    
    -- Policy definition
    policy_name TEXT NOT NULL UNIQUE,
    description TEXT,
    
    -- Scope
    applies_to_table TEXT, -- Which table this policy applies to
    applies_to_data_type TEXT, -- Type of data (PII, financial, etc.)
    framework_id TEXT REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    
    -- Retention rules
    retention_period_days INTEGER NOT NULL,
    auto_delete BOOLEAN DEFAULT FALSE,
    archive_before_delete BOOLEAN DEFAULT TRUE,
    archive_location TEXT,
    
    -- Conditions for retention
    conditions TEXT, -- JSON object with conditions (e.g., {"risk_level": "high"})
    
    -- Legal holds and exceptions
    legal_hold_exempt BOOLEAN DEFAULT FALSE,
    exception_conditions TEXT, -- JSON object
    
    -- Execution settings
    check_frequency_hours INTEGER DEFAULT 24,
    batch_size INTEGER DEFAULT 1000,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    last_executed_at DATETIME,
    next_execution_at DATETIME,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Audit trail
    created_by TEXT,
    updated_by TEXT
);

-- ==============================================
-- 9. DATA LINEAGE TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS data_lineage (
    id TEXT PRIMARY KEY,
    
    -- Source information
    source_type TEXT NOT NULL CHECK (source_type IN ('file', 'database', 'api', 'stream')),
    source_id TEXT NOT NULL,
    source_name TEXT,
    
    -- Destination information  
    destination_type TEXT NOT NULL CHECK (destination_type IN ('file', 'database', 'api', 'export')),
    destination_id TEXT NOT NULL,
    destination_name TEXT,
    
    -- Transformation information
    transformation_type TEXT CHECK (transformation_type IN (
        'import', 'export', 'mask', 'encrypt', 'anonymize', 'aggregate', 'filter', 'enrich'
    )),
    transformation_details TEXT, -- JSON object
    
    -- Data characteristics
    record_count INTEGER,
    data_size INTEGER, -- Bytes
    pii_fields_affected TEXT, -- JSON array
    
    -- Processing context
    job_id TEXT,
    batch_id TEXT,
    user_id TEXT,
    
    -- Compliance tracking
    compliance_requirements TEXT, -- JSON array
    retention_policy_id TEXT REFERENCES data_retention_policies(id) ON DELETE SET NULL,
    
    -- Timestamps
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================
-- 10. SYSTEM ALERTS TABLE
-- ==============================================
CREATE TABLE IF NOT EXISTS system_alerts (
    id TEXT PRIMARY KEY,
    
    -- Alert identification
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'performance_degradation', 'security_breach', 'compliance_violation',
        'system_error', 'resource_exhaustion', 'data_quality_issue'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    
    -- Alert content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT, -- JSON object with additional details
    
    -- Context
    component TEXT,
    metric_name TEXT,
    threshold_value REAL,
    actual_value REAL,
    
    -- Resolution
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at DATETIME,
    
    -- Notification
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_channels TEXT, -- JSON array
    
    -- Timestamps
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    
    -- Related entities
    framework_id TEXT REFERENCES compliance_frameworks(id) ON DELETE SET NULL,
    pattern_id TEXT REFERENCES custom_patterns(id) ON DELETE SET NULL,
    assessment_id TEXT REFERENCES risk_assessments(id) ON DELETE SET NULL
);

-- ==============================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==============================================

-- Compliance frameworks indexes
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_type ON compliance_frameworks(type);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_status ON compliance_frameworks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_industry ON compliance_frameworks(industry);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_created_at ON compliance_frameworks(created_at);

-- Framework configurations indexes
CREATE INDEX IF NOT EXISTS idx_framework_configurations_framework_id ON framework_configurations(framework_id);
CREATE INDEX IF NOT EXISTS idx_framework_configurations_category ON framework_configurations(category);

-- Risk assessments indexes
CREATE INDEX IF NOT EXISTS idx_risk_assessments_framework_id ON risk_assessments(framework_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_dataset_id ON risk_assessments(dataset_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_risk_level ON risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_status ON risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_at ON risk_assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_overall_score ON risk_assessments(overall_risk_score);

-- Custom patterns indexes
CREATE INDEX IF NOT EXISTS idx_custom_patterns_category ON custom_patterns(category);
CREATE INDEX IF NOT EXISTS idx_custom_patterns_industry ON custom_patterns(industry);
CREATE INDEX IF NOT EXISTS idx_custom_patterns_enabled ON custom_patterns(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_patterns_priority ON custom_patterns(priority);
CREATE INDEX IF NOT EXISTS idx_custom_patterns_created_at ON custom_patterns(created_at);

-- Pattern usage logs indexes
CREATE INDEX IF NOT EXISTS idx_pattern_usage_logs_pattern_id ON pattern_usage_logs(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_logs_used_at ON pattern_usage_logs(used_at);
CREATE INDEX IF NOT EXISTS idx_pattern_usage_logs_dataset_id ON pattern_usage_logs(dataset_id);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON audit_logs(event_category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_framework_id ON audit_logs(framework_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_timestamp ON audit_logs(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON performance_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_component ON performance_metrics(component);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

-- Data retention policies indexes
CREATE INDEX IF NOT EXISTS idx_data_retention_policies_framework_id ON data_retention_policies(framework_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_policies_active ON data_retention_policies(active);
CREATE INDEX IF NOT EXISTS idx_data_retention_policies_next_execution ON data_retention_policies(next_execution_at);

-- Data lineage indexes
CREATE INDEX IF NOT EXISTS idx_data_lineage_source_id ON data_lineage(source_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_destination_id ON data_lineage(destination_id);
CREATE INDEX IF NOT EXISTS idx_data_lineage_processed_at ON data_lineage(processed_at);
CREATE INDEX IF NOT EXISTS idx_data_lineage_job_id ON data_lineage(job_id);

-- System alerts indexes
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_triggered_at ON system_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_component ON system_alerts(component);

-- ==============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ==============================================

-- Compliance frameworks trigger
CREATE TRIGGER IF NOT EXISTS update_compliance_frameworks_updated_at 
AFTER UPDATE ON compliance_frameworks
BEGIN
    UPDATE compliance_frameworks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Framework configurations trigger
CREATE TRIGGER IF NOT EXISTS update_framework_configurations_updated_at 
AFTER UPDATE ON framework_configurations
BEGIN
    UPDATE framework_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Risk assessments trigger
CREATE TRIGGER IF NOT EXISTS update_risk_assessments_updated_at 
AFTER UPDATE ON risk_assessments
BEGIN
    UPDATE risk_assessments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Custom patterns trigger
CREATE TRIGGER IF NOT EXISTS update_custom_patterns_updated_at 
AFTER UPDATE ON custom_patterns
BEGIN
    UPDATE custom_patterns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Data retention policies trigger
CREATE TRIGGER IF NOT EXISTS update_data_retention_policies_updated_at 
AFTER UPDATE ON data_retention_policies
BEGIN
    UPDATE data_retention_policies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ==============================================
-- VIEWS FOR COMMON QUERIES
-- ==============================================

-- Comprehensive risk assessment view
CREATE VIEW IF NOT EXISTS risk_assessment_summary AS
SELECT 
    ra.id,
    ra.assessment_name,
    ra.overall_risk_score,
    ra.risk_level,
    ra.confidence_score,
    cf.name as framework_name,
    cf.type as framework_type,
    d.filename as dataset_filename,
    ra.status,
    ra.created_at,
    ra.completed_at
FROM risk_assessments ra
LEFT JOIN compliance_frameworks cf ON ra.framework_id = cf.id
LEFT JOIN datasets d ON ra.dataset_id = d.id;

-- Active patterns with performance metrics
CREATE VIEW IF NOT EXISTS active_patterns_performance AS
SELECT 
    cp.id,
    cp.name,
    cp.category,
    cp.industry,
    cp.priority,
    cp.confidence_level,
    cp.accuracy_rate,
    cp.avg_processing_time,
    cp.times_used,
    cp.last_used_at
FROM custom_patterns cp
WHERE cp.enabled = TRUE
ORDER BY cp.priority ASC, cp.accuracy_rate DESC;

-- Framework compliance status
CREATE VIEW IF NOT EXISTS framework_compliance_status AS
SELECT 
    cf.id,
    cf.name,
    cf.type,
    cf.status,
    COUNT(ra.id) as total_assessments,
    AVG(ra.overall_risk_score) as avg_risk_score,
    COUNT(CASE WHEN ra.risk_level = 'high' OR ra.risk_level = 'critical' THEN 1 END) as high_risk_assessments
FROM compliance_frameworks cf
LEFT JOIN risk_assessments ra ON cf.id = ra.framework_id
WHERE cf.status = 'active'
GROUP BY cf.id, cf.name, cf.type, cf.status;

-- Recent audit activity
CREATE VIEW IF NOT EXISTS recent_audit_activity AS
SELECT 
    al.id,
    al.event_type,
    al.event_category,
    al.description,
    al.user_email,
    al.resource_type,
    al.resource_name,
    al.severity,
    al.event_timestamp
FROM audit_logs al
ORDER BY al.event_timestamp DESC
LIMIT 1000;