# DataCloak Sentiment Workbench - Data Storage & Cleanup Guide

## Table of Contents
1. [Overview](#overview)
2. [Data Storage Locations](#data-storage-locations)
3. [Data Persistence Behavior](#data-persistence-behavior)
4. [Cleanup Methods](#cleanup-methods)
5. [Automated Cleanup](#automated-cleanup)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The DataCloak Sentiment Workbench stores data in multiple locations using different storage mechanisms. This guide explains where data is stored, how long it persists, and how to manage data cleanup effectively.

## Data Storage Locations

### 1. Database Files
All database files are stored in the backend directory structure:

```
📂 packages/backend/
├── 📊 database.db (3.6MB) - Main application database
├── 📊 database.db-shm - Shared memory file
├── 📊 database.db-wal - Write-ahead log
└── 📂 data/
    ├── 📊 app.db - Application data
    ├── 📊 sqlite.db - SQLite specific data
    ├── 📊 analytics.db - Analytics data
    └── 📊 duckdb.db - DuckDB analytics database
```

**Key Database Tables:**
- `sentiment_analyses` - Stores all sentiment analysis results (2,026+ records)
- `datasets` - Metadata for uploaded files (16+ records)
- `data_retention_policies` - Configurable retention rules (currently empty)
- `openai_api_logs` - API usage logs (if implemented)
- `job_queue` - Processing job records (if implemented)

### 2. Uploaded Files
User-uploaded CSV/TSV files are stored with UUID filenames for security:

```
📂 packages/backend/data/uploads/
├── 📄 0149b8ce-8f2d-4a85-b5f7-3e78e2c90a2e.csv
├── 📄 01ad2cf5-3bae-4c9f-b892-1e8e3c86e66f.txt
└── ... (typically 40+ files)
```

**Storage Details:**
- Files retain original extensions (.csv, .txt, .tsv)
- Maximum file size: 53GB (configurable)
- Allowed types: CSV, XLSX, XLS, TSV

### 3. Log Files
Application logs are stored in multiple locations:

```
📂 packages/backend/logs/
├── 📄 combined.log - All application logs
├── 📄 error.log - Error logs only
├── 📄 exceptions.log - Unhandled exceptions
└── 📄 rejections.log - Promise rejections

📂 packages/backend/
├── 📄 server.log - Server startup logs
├── 📄 backend.log - Backend application logs
└── 📄 *-debug.log - Debug level logs
```

### 4. Temporary/In-Memory Storage
Some data is stored only in memory and resets on server restart:

- **OpenAI API usage statistics** - In-memory counter
- **Job queue status** - In-memory job tracking
- **WebSocket connections** - Active session data
- **Cache data** - Memory-based caching

## Data Persistence Behavior

### What Persists Across Restarts ✅
- Uploaded files and dataset metadata
- Sentiment analysis results
- User configurations
- Database records

### What Doesn't Persist ❌
- OpenAI API usage stats (resets to 0)
- Active job queue (clears on restart)
- Real-time WebSocket data
- In-memory cache

### Default Retention Periods
The system includes configurable retention policies with these defaults:

| Data Type | Retention Period | Action |
|-----------|-----------------|---------|
| Audit Logs | 90 days | Archive |
| Technical Logs | 30 days | Delete |
| Security Logs | 180 days | Archive |
| Performance Logs | 7 days | Delete |
| Application Data | Indefinite* | None |

*Application data (analyses, datasets) persists indefinitely unless manually configured otherwise.

## Cleanup Methods

### 1. Manual Command-Line Cleanup

#### Clean Specific Data Types
```bash
# Clean uploaded files only
rm -rf packages/backend/data/uploads/*

# Clean logs only
rm -rf packages/backend/logs/*
rm -f packages/backend/*.log

# Clean in-memory database artifacts
rm -f packages/backend/file::memory:*
```

#### Full Data Reset (⚠️ WARNING: Deletes ALL data)
```bash
# Stop the backend first
pkill -f "node.*backend"

# Remove all databases
rm -f packages/backend/database.db*
rm -f packages/backend/data/*.db*

# Remove all uploads
rm -rf packages/backend/data/uploads/*

# Remove all logs
rm -rf packages/backend/logs/*
```

### 2. API-Based Cleanup

#### Delete Specific Dataset
```bash
curl -X DELETE http://localhost:3001/api/v1/data/{datasetId}
```

#### Clear OpenAI Stats (in-memory only)
```bash
curl -X POST http://localhost:3001/api/v1/openai/stats/clear
```

#### Clean Old Audit Logs
```bash
curl -X DELETE "http://localhost:3001/api/v1/audit/cleanup?olderThanDays=30"
```

### 3. Database-Level Cleanup

Connect to the SQLite database and run cleanup queries:

```bash
# Connect to database
sqlite3 packages/backend/database.db
```

```sql
-- Delete sentiment analyses older than 30 days
DELETE FROM sentiment_analyses WHERE created_at < datetime('now', '-30 days');

-- Delete datasets older than 30 days
DELETE FROM datasets WHERE created_at < datetime('now', '-30 days');

-- Delete orphaned records
DELETE FROM sentiment_analyses WHERE dataset_id NOT IN (SELECT id FROM datasets);

-- Reclaim disk space
VACUUM;

-- Check database size
SELECT page_count * page_size / 1024 / 1024 AS size_mb FROM pragma_page_count(), pragma_page_size();
```

### 4. Cleanup Script

Create a `cleanup.sh` script for regular maintenance:

```bash
#!/bin/bash

# DataCloak Cleanup Script
# Usage: ./cleanup.sh [--all|--logs|--old-data|--uploads]

set -e

BACKEND_DIR="packages/backend"
DAYS_TO_KEEP=30

show_usage() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  --all       Clean everything (requires confirmation)"
    echo "  --logs      Clean log files only"
    echo "  --old-data  Clean data older than $DAYS_TO_KEEP days"
    echo "  --uploads   Clean uploaded files"
    echo "  --help      Show this help message"
}

clean_logs() {
    echo "🧹 Cleaning log files..."
    rm -f $BACKEND_DIR/logs/*.log
    rm -f $BACKEND_DIR/*.log
    echo "✅ Logs cleaned"
}

clean_old_data() {
    echo "🧹 Cleaning data older than $DAYS_TO_KEEP days..."
    
    # Clean old uploaded files
    find $BACKEND_DIR/data/uploads -type f -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true
    
    # Clean old database records via SQLite
    sqlite3 $BACKEND_DIR/database.db <<EOF
DELETE FROM sentiment_analyses WHERE created_at < datetime('now', '-$DAYS_TO_KEEP days');
DELETE FROM datasets WHERE created_at < datetime('now', '-$DAYS_TO_KEEP days');
VACUUM;
EOF
    
    echo "✅ Old data cleaned"
}

clean_uploads() {
    echo "🧹 Cleaning uploaded files..."
    rm -rf $BACKEND_DIR/data/uploads/*
    echo "✅ Uploads cleaned"
}

clean_all() {
    echo "⚠️  WARNING: This will delete ALL data!"
    echo "Are you sure? (yes/no)"
    read -r response
    
    if [[ "$response" != "yes" ]]; then
        echo "❌ Cleanup cancelled"
        exit 0
    fi
    
    echo "🧹 Performing full cleanup..."
    
    # Stop backend if running
    pkill -f "node.*backend" 2>/dev/null || true
    
    # Clean everything
    rm -f $BACKEND_DIR/database.db*
    rm -f $BACKEND_DIR/data/*.db*
    rm -rf $BACKEND_DIR/data/uploads/*
    rm -rf $BACKEND_DIR/logs/*
    rm -f $BACKEND_DIR/file::memory:*
    
    echo "✅ Full cleanup complete"
}

# Main script logic
case "${1}" in
    --all)
        clean_all
        ;;
    --logs)
        clean_logs
        ;;
    --old-data)
        clean_old_data
        ;;
    --uploads)
        clean_uploads
        ;;
    --help|*)
        show_usage
        ;;
esac
```

Make the script executable:
```bash
chmod +x cleanup.sh
```

## Automated Cleanup

### 1. Built-in Background Tasks
The system includes automated cleanup tasks that run daily:

| Task | Schedule | Action |
|------|----------|---------|
| Database Cleanup | 2:00 AM | Removes sessions > 30 days, orphaned data |
| Log Rotation | 1:00 AM | Rotates logs > 100MB, deletes logs > 30 days |
| Backup Creation | 3:00 AM | Creates backup, keeps last 7 backups |

### 2. Configure Data Retention Policies

Add retention policies to the database:

```sql
-- Add retention policy for sentiment analyses
INSERT INTO data_retention_policies (
    policy_name,
    table_name,
    retention_days,
    action,
    is_active
) VALUES (
    'sentiment_analysis_30d',
    'sentiment_analyses',
    30,
    'delete',
    1
);

-- Add retention policy for datasets
INSERT INTO data_retention_policies (
    policy_name,
    table_name,
    retention_days,
    action,
    is_active
) VALUES (
    'dataset_90d',
    'datasets',
    90,
    'archive',
    1
);
```

### 3. Custom Cleanup Service

Create a Node.js cleanup service (`cleanup-service.js`):

```javascript
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class CleanupService {
    constructor() {
        this.uploadsDir = './packages/backend/data/uploads';
        this.dbPath = './packages/backend/database.db';
    }

    // Clean files older than specified days
    cleanOldFiles(daysToKeep = 30) {
        const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
        let deletedCount = 0;

        fs.readdirSync(this.uploadsDir).forEach(file => {
            const filePath = path.join(this.uploadsDir, file);
            const stats = fs.statSync(filePath);
            
            if (Date.now() - stats.mtime.getTime() > maxAge) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`Deleted: ${file}`);
            }
        });

        console.log(`✅ Cleaned ${deletedCount} old files`);
    }

    // Clean database records
    cleanDatabase(daysToKeep = 30) {
        const db = new sqlite3.Database(this.dbPath);
        
        db.serialize(() => {
            // Delete old sentiment analyses
            db.run(`
                DELETE FROM sentiment_analyses 
                WHERE created_at < datetime('now', '-${daysToKeep} days')
            `, function(err) {
                console.log(`Deleted ${this.changes} old sentiment analyses`);
            });

            // Delete old datasets
            db.run(`
                DELETE FROM datasets 
                WHERE created_at < datetime('now', '-${daysToKeep} days')
            `, function(err) {
                console.log(`Deleted ${this.changes} old datasets`);
            });

            // Vacuum to reclaim space
            db.run('VACUUM');
        });

        db.close();
    }

    // Get storage statistics
    getStorageStats() {
        const stats = {
            uploads: { count: 0, size: 0 },
            database: { size: 0 },
            logs: { count: 0, size: 0 }
        };

        // Count uploads
        const uploadFiles = fs.readdirSync(this.uploadsDir);
        stats.uploads.count = uploadFiles.length;
        stats.uploads.size = uploadFiles.reduce((total, file) => {
            const filePath = path.join(this.uploadsDir, file);
            return total + fs.statSync(filePath).size;
        }, 0);

        // Database size
        stats.database.size = fs.statSync(this.dbPath).size;

        // Format sizes
        const formatSize = (bytes) => {
            const mb = bytes / 1024 / 1024;
            return `${mb.toFixed(2)} MB`;
        };

        console.log('\n📊 Storage Statistics:');
        console.log(`Uploads: ${stats.uploads.count} files (${formatSize(stats.uploads.size)})`);
        console.log(`Database: ${formatSize(stats.database.size)}`);
        
        return stats;
    }
}

// Run cleanup if called directly
if (require.main === module) {
    const cleaner = new CleanupService();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    const daysToKeep = parseInt(args[0]) || 30;
    
    console.log(`🧹 Starting cleanup (keeping last ${daysToKeep} days)...`);
    
    cleaner.getStorageStats();
    cleaner.cleanOldFiles(daysToKeep);
    cleaner.cleanDatabase(daysToKeep);
    
    console.log('\n✅ Cleanup complete!');
    cleaner.getStorageStats();
}

module.exports = CleanupService;
```

## Best Practices

### 1. Regular Maintenance Schedule
- **Daily**: Automated log rotation
- **Weekly**: Clean old uploaded files
- **Monthly**: Database optimization (VACUUM)
- **Quarterly**: Full backup and archive

### 2. Before Cleanup
Always backup important data:
```bash
# Backup database
cp packages/backend/database.db backups/database-$(date +%Y%m%d).db

# Backup uploads
tar -czf backups/uploads-$(date +%Y%m%d).tar.gz packages/backend/data/uploads/
```

### 3. Monitor Disk Usage
Regular monitoring helps prevent storage issues:
```bash
# Check storage usage
du -sh packages/backend/data/*
du -sh packages/backend/logs/*
df -h

# Find large files
find packages/backend -type f -size +100M -ls
```

### 4. Configure Alerts
Set up disk space monitoring:
```bash
# Add to crontab
*/30 * * * * df -h | grep -E '^/dev/' | awk '{if(int($5) > 80) print "Disk usage alert: " $0}'
```

## Troubleshooting

### Issue: Dashboard shows no historical data
**Cause**: Data is stored in memory and resets on restart
**Solution**: Implement persistent storage for OpenAI logs and job queue

### Issue: Database file growing too large
**Solution**:
```sql
-- Check table sizes
SELECT 
    name,
    SUM(pgsize) / 1024 / 1024 as size_mb
FROM dbstat
GROUP BY name
ORDER BY size_mb DESC;

-- Clean and optimize
DELETE FROM sentiment_analyses WHERE created_at < datetime('now', '-90 days');
VACUUM;
ANALYZE;
```

### Issue: Upload directory full
**Solution**:
```bash
# Find and remove orphaned files
sqlite3 packages/backend/database.db "SELECT file_path FROM datasets" | while read path; do
    basename "$path"
done > active_files.txt

cd packages/backend/data/uploads
ls | grep -vf active_files.txt | xargs rm -f
```

### Issue: Logs consuming too much space
**Solution**:
```bash
# Implement log rotation
cat > /etc/logrotate.d/datacloak << EOF
/path/to/packages/backend/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 node node
}
EOF
```

## Security Considerations

1. **Uploaded files** are stored with UUID names to prevent path traversal attacks
2. **Database backups** should be encrypted if they contain sensitive data
3. **Log files** may contain sensitive information - ensure proper access controls
4. **Cleanup scripts** should verify file ownership before deletion
5. **Retention policies** must comply with data protection regulations (GDPR, CCPA)

---

*Last updated: June 2025*
*Version: 1.0*