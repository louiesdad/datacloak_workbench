-- UP
-- Sentiment analysis results table
CREATE TABLE IF NOT EXISTS sentiment_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  score REAL NOT NULL CHECK (score >= -1 AND score <= 1),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  mime_type TEXT,
  security_audit_id TEXT,
  pii_detected INTEGER DEFAULT 0,
  compliance_score REAL,
  risk_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analysis batches table
CREATE TABLE IF NOT EXISTS analysis_batches (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0,
  total_records INTEGER NOT NULL,
  completed_records INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Security audits table
CREATE TABLE IF NOT EXISTS security_audits (
  id TEXT PRIMARY KEY,
  file_processed TEXT NOT NULL,
  pii_items_detected INTEGER DEFAULT 0,
  masking_accuracy REAL DEFAULT 0,
  encryption_status TEXT CHECK (encryption_status IN ('enabled', 'disabled')),
  compliance_score REAL DEFAULT 0,
  violations TEXT, -- JSON array
  recommendations TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pii_detected', 'masking_applied', 'audit_completed', 'violation_found')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details TEXT, -- JSON object
  source TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Compliance audits table
CREATE TABLE IF NOT EXISTS compliance_audits (
  audit_id TEXT PRIMARY KEY,
  overall_score INTEGER NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('compliant', 'non_compliant', 'needs_review')),
  gdpr_score INTEGER DEFAULT 0,
  ccpa_score INTEGER DEFAULT 0,
  hipaa_score INTEGER DEFAULT 0,
  violations_count INTEGER DEFAULT 0,
  recommendations_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_created_at ON sentiment_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_sentiment ON sentiment_analyses(sentiment);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);
CREATE INDEX IF NOT EXISTS idx_datasets_risk_level ON datasets(risk_level);
CREATE INDEX IF NOT EXISTS idx_analysis_batches_status ON analysis_batches(status);
CREATE INDEX IF NOT EXISTS idx_analysis_batches_dataset_id ON analysis_batches(dataset_id);
CREATE INDEX IF NOT EXISTS idx_security_audits_created_at ON security_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audits_compliance_score ON security_audits(compliance_score);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_audits_created_at ON compliance_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_audits_overall_score ON compliance_audits(overall_score);

-- Create triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_sentiment_analyses_updated_at 
AFTER UPDATE ON sentiment_analyses
BEGIN
  UPDATE sentiment_analyses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_datasets_updated_at 
AFTER UPDATE ON datasets
BEGIN
  UPDATE datasets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_analysis_batches_updated_at 
AFTER UPDATE ON analysis_batches
BEGIN
  UPDATE analysis_batches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_security_audits_updated_at 
AFTER UPDATE ON security_audits
BEGIN
  UPDATE security_audits SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- DOWN
DROP TRIGGER IF EXISTS update_security_audits_updated_at;
DROP TRIGGER IF EXISTS update_analysis_batches_updated_at;
DROP TRIGGER IF EXISTS update_datasets_updated_at;
DROP TRIGGER IF EXISTS update_sentiment_analyses_updated_at;

DROP INDEX IF EXISTS idx_compliance_audits_overall_score;
DROP INDEX IF EXISTS idx_compliance_audits_created_at;
DROP INDEX IF EXISTS idx_security_events_severity;
DROP INDEX IF EXISTS idx_security_events_type;
DROP INDEX IF EXISTS idx_security_events_created_at;
DROP INDEX IF EXISTS idx_security_audits_compliance_score;
DROP INDEX IF EXISTS idx_security_audits_created_at;
DROP INDEX IF EXISTS idx_analysis_batches_dataset_id;
DROP INDEX IF EXISTS idx_analysis_batches_status;
DROP INDEX IF EXISTS idx_datasets_risk_level;
DROP INDEX IF EXISTS idx_datasets_created_at;
DROP INDEX IF EXISTS idx_sentiment_analyses_sentiment;
DROP INDEX IF EXISTS idx_sentiment_analyses_created_at;

DROP TABLE IF EXISTS compliance_audits;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS security_audits;
DROP TABLE IF EXISTS analysis_batches;
DROP TABLE IF EXISTS datasets;
DROP TABLE IF EXISTS sentiment_analyses;