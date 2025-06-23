-- Migration 007: Add causal analysis tables for business events and impact tracking
-- UP

-- Table for storing business events that may impact customer sentiment
CREATE TABLE IF NOT EXISTS business_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type TEXT NOT NULL,
    event_date DATE NOT NULL,
    description TEXT NOT NULL,
    affected_customers JSON NOT NULL, -- JSON array of customer IDs or "all"
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
);

-- Table for storing calculated impact of events on sentiment
CREATE TABLE IF NOT EXISTS event_impacts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_id TEXT NOT NULL,
    impact_percentage REAL NOT NULL, -- Percentage change in sentiment
    customers_affected INTEGER NOT NULL,
    sentiment_before REAL NOT NULL,
    sentiment_after REAL NOT NULL,
    is_significant BOOLEAN NOT NULL DEFAULT 0,
    confidence REAL NOT NULL,
    p_value REAL NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES business_events(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_events_event_date ON business_events(event_date);
CREATE INDEX IF NOT EXISTS idx_business_events_event_type ON business_events(event_type);
CREATE INDEX IF NOT EXISTS idx_business_events_deleted_at ON business_events(deleted_at);
CREATE INDEX IF NOT EXISTS idx_event_impacts_event_id ON event_impacts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_impacts_calculated_at ON event_impacts(calculated_at);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_business_events_timestamp 
AFTER UPDATE ON business_events
BEGIN
    UPDATE business_events 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- DOWN
DROP TRIGGER IF EXISTS update_business_events_timestamp;
DROP INDEX IF EXISTS idx_event_impacts_calculated_at;
DROP INDEX IF EXISTS idx_event_impacts_event_id;
DROP INDEX IF EXISTS idx_business_events_deleted_at;
DROP INDEX IF EXISTS idx_business_events_event_type;
DROP INDEX IF EXISTS idx_business_events_event_date;
DROP TABLE IF EXISTS event_impacts;
DROP TABLE IF EXISTS business_events;