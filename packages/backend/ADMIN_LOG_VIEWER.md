# Admin Log Viewer Documentation

## Overview
The DataCloak Sentiment Workbench now includes a comprehensive admin log viewing system that allows system administrators to:
- View application logs in real-time
- Search and filter logs by level, date, and content
- Download log archives
- Monitor system health
- Access audit trails

## Features

### 1. Log Viewing
- **Multiple Log Types**: Combined, Error, Performance, Exceptions, Promise Rejections
- **Log Level Filtering**: Error, Warning, Info, Debug
- **Search Functionality**: Full-text search across log entries
- **Pagination**: Efficient loading of large log files

### 2. Real-time Log Streaming
- Live log updates using Server-Sent Events (SSE)
- Automatic scrolling to new entries
- Start/stop streaming on demand

### 3. Log Management
- **Download Logs**: Export log files as ZIP archives
- **Clear Old Logs**: Remove logs older than specified days (with backup)
- **Audit Trail**: Database-stored audit logs with CSV export

### 4. System Health Monitoring
- Real-time system status
- Database connection status
- Memory usage metrics
- Uptime tracking

## Access Control

### Authentication
The admin endpoints are protected by JWT authentication with an additional admin role check.

**Environment Variables:**
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
```

### Admin Login
Access the admin interface at: `http://localhost:5173/admin-logs.html`

## API Endpoints

### Log Viewing
```
GET /api/admin/logs
Query Parameters:
- logType: combined|error|performance|exceptions|rejections
- level: error|warn|info|debug
- startDate: ISO date string
- endDate: ISO date string
- search: search text
- limit: number (default: 100)
- offset: number (default: 0)
```

### Log Streaming
```
GET /api/admin/logs/stream
Query Parameters:
- logType: combined|error|performance|exceptions|rejections

Returns: Server-Sent Events stream
```

### Log Download
```
GET /api/admin/logs/download
Query Parameters:
- types: all|combined,error,performance (comma-separated)

Returns: ZIP archive
```

### Clear Logs
```
DELETE /api/admin/logs/clear
Body:
{
  "logType": "error",
  "olderThanDays": 30
}
```

### System Health
```
GET /api/admin/health
Returns: System health metrics including:
- Node.js version and memory usage
- System CPU and memory stats
- Service statuses
- Database connection info
- Storage usage
```

### Audit Logs
```
GET /api/admin/audit-logs
Query Parameters:
- userId: filter by user
- category: filter by category
- startDate: ISO date string
- endDate: ISO date string
- limit: number
- offset: number
```

## Log Storage

### File-based Logs (Winston)
Location: `/packages/backend/logs/`
- `combined.log` - All application logs
- `error.log` - Error-level logs only
- `performance.log` - Performance metrics
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

### Database Audit Logs
Stored in SQLite table: `audit_logs`
- User actions
- Configuration changes
- Security events
- Compliance tracking

## Usage Examples

### Viewing Recent Errors
1. Navigate to admin interface
2. Select "Errors Only" from Log Type dropdown
3. Click "Refresh Logs"

### Real-time Monitoring
1. Click "Start Live Stream"
2. Logs will appear in real-time as they're generated
3. Click "Stop Live Stream" to pause

### Searching for Specific Events
1. Enter search term (e.g., "authentication failed")
2. Select appropriate log type and level
3. Click "Refresh Logs"

### Downloading Logs for Analysis
1. Select log types to download
2. Click "Download Logs"
3. Receive ZIP archive with selected log files

## Security Considerations

1. **Authentication Required**: All admin endpoints require valid JWT token
2. **Admin Role Verification**: Additional check for admin privileges
3. **Sensitive Data Redaction**: Configuration endpoints sanitize sensitive values
4. **Audit Trail**: All admin actions are logged
5. **HTTPS Recommended**: Use TLS in production

## Performance Notes

- Log files are read using streams for efficiency
- Large files are paginated (default 100 entries)
- Real-time streaming uses SSE for low overhead
- Log rotation prevents unbounded file growth

## Troubleshooting

### Cannot Access Admin Interface
- Verify ADMIN_USERNAME and ADMIN_PASSWORD are set
- Check JWT_SECRET is configured
- Ensure backend is running on correct port

### Logs Not Appearing
- Check log directory permissions
- Verify Winston configuration
- Ensure log level allows desired entries

### Stream Connection Drops
- Check for proxy timeout settings
- Verify SSE is not blocked by firewall
- Consider implementing reconnection logic

## Future Enhancements
- Log analytics and visualization
- Alert configuration for error thresholds
- Integration with external monitoring tools
- Advanced search with regex support
- Log retention policies UI