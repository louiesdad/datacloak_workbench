-- Add logging and decision tracking tables
-- Migration 006: Add logging infrastructure tables

-- UP
-- Table for storing analysis decision summaries
CREATE TABLE IF NOT EXISTS analysis_decision_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    step_count INTEGER NOT NULL DEFAULT 1,
    average_confidence REAL NOT NULL,
    total_duration INTEGER NOT NULL, -- milliseconds
    dataset_id TEXT,
    user_id TEXT,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing audit report summaries
CREATE TABLE IF NOT EXISTS analysis_audit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT UNIQUE NOT NULL,
    generated_at DATETIME NOT NULL,
    time_range_start DATETIME NOT NULL,
    time_range_end DATETIME NOT NULL,
    total_decisions INTEGER NOT NULL,
    average_confidence REAL NOT NULL,
    total_datasets INTEGER NOT NULL,
    average_decision_time REAL NOT NULL, -- milliseconds
    recommendations_count INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_decision_summaries_trace_id ON analysis_decision_summaries(trace_id);
CREATE INDEX IF NOT EXISTS idx_decision_summaries_decision_type ON analysis_decision_summaries(decision_type);
CREATE INDEX IF NOT EXISTS idx_decision_summaries_dataset_id ON analysis_decision_summaries(dataset_id);
CREATE INDEX IF NOT EXISTS idx_decision_summaries_created_at ON analysis_decision_summaries(created_at);
CREATE INDEX IF NOT EXISTS idx_decision_summaries_user_id ON analysis_decision_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_reports_report_id ON analysis_audit_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON analysis_audit_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_audit_reports_time_range ON analysis_audit_reports(time_range_start, time_range_end);

-- Add trace_id column to existing sentiment_analyses table (if it doesn't exist)
-- This will help link sentiment analyses to decision traces
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll handle it differently
-- ALTER TABLE sentiment_analyses ADD COLUMN trace_id TEXT DEFAULT NULL;
-- CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_trace_id ON sentiment_analyses(trace_id);

-- Add logging metadata to datasets table (if columns don't exist)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll handle it differently
-- ALTER TABLE datasets ADD COLUMN pii_detected INTEGER DEFAULT 0;
-- ALTER TABLE datasets ADD COLUMN compliance_score REAL DEFAULT NULL;
-- ALTER TABLE datasets ADD COLUMN risk_level TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_datasets_pii_detected ON datasets(pii_detected);
CREATE INDEX IF NOT EXISTS idx_datasets_risk_level ON datasets(risk_level);

-- Create a view for decision analytics
CREATE VIEW IF NOT EXISTS decision_analytics AS
SELECT 
    decision_type,
    COUNT(*) as total_decisions,
    AVG(average_confidence) as avg_confidence,
    AVG(total_duration) as avg_duration,
    MIN(created_at) as first_decision,
    MAX(created_at) as last_decision,
    COUNT(DISTINCT dataset_id) as unique_datasets,
    COUNT(DISTINCT user_id) as unique_users
FROM analysis_decision_summaries
GROUP BY decision_type;

-- Create a view for audit report summaries
CREATE VIEW IF NOT EXISTS audit_report_summary AS
SELECT 
    DATE(generated_at) as report_date,
    COUNT(*) as reports_generated,
    AVG(total_decisions) as avg_decisions_per_report,
    AVG(average_confidence) as avg_confidence,
    AVG(total_datasets) as avg_datasets_per_report,
    AVG(average_decision_time) as avg_decision_time
FROM analysis_audit_reports
GROUP BY DATE(generated_at)
ORDER BY report_date DESC;

-- DOWN
DROP VIEW IF EXISTS audit_report_summary;
DROP VIEW IF EXISTS decision_analytics;
DROP INDEX IF EXISTS idx_datasets_risk_level;
DROP INDEX IF EXISTS idx_datasets_pii_detected;
DROP INDEX IF EXISTS idx_sentiment_analyses_trace_id;
DROP INDEX IF EXISTS idx_audit_reports_time_range;
DROP INDEX IF EXISTS idx_audit_reports_generated_at;
DROP INDEX IF EXISTS idx_audit_reports_report_id;
DROP INDEX IF EXISTS idx_decision_summaries_user_id;
DROP INDEX IF EXISTS idx_decision_summaries_created_at;
DROP INDEX IF EXISTS idx_decision_summaries_dataset_id;
DROP INDEX IF EXISTS idx_decision_summaries_decision_type;
DROP INDEX IF EXISTS idx_decision_summaries_trace_id;
DROP TABLE IF EXISTS analysis_audit_reports;
DROP TABLE IF EXISTS analysis_decision_summaries;