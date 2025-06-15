# Health & Status API

This document covers system health monitoring, service status checks, and diagnostic endpoints for the DataCloak Sentiment Workbench.

## 🩺 Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check (lightweight) |
| `/api/v1/health/status` | GET | Detailed service status |
| `/api/v1/health/ready` | GET | Readiness probe for deployments |
| `/api/v1/health/live` | GET | Liveness probe for containers |

---

## ⚡ Basic Health Check

Lightweight endpoint for basic health verification.

### `GET /health`

#### Request
```http
GET /health
```

#### Response (Healthy)
```json
{
  "status": "healthy",
  "timestamp": "2025-06-15T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

#### Response (Unhealthy)
```json
{
  "status": "unhealthy",
  "timestamp": "2025-06-15T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0",
  "error": "Database connection failed"
}
```

#### Response Codes
- `200 OK` - Service is healthy
- `503 Service Unavailable` - Service is unhealthy

#### Performance Characteristics
- **Response Time**: < 10ms
- **Dependencies**: None (no database calls)
- **Use Case**: Load balancer health checks

---

## 🔍 Detailed Service Status

Comprehensive health check with service dependencies and diagnostics.

### `GET /api/v1/health/status`

#### Request
```http
GET /api/v1/health/status
```

#### Response (All Services Healthy)
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "environment": "development",
    "version": "1.0.0",
    "uptime": 86400,
    "services": {
      "api": {
        "status": "operational",
        "responseTime": 15,
        "lastCheck": "2025-06-15T10:30:00.000Z",
        "dependencies": []
      },
      "database": {
        "sqlite": {
          "status": "connected",
          "responseTime": 5,
          "connectionPool": {
            "active": 2,
            "idle": 8,
            "max": 10
          },
          "lastQuery": "2025-06-15T10:29:55.000Z",
          "version": "3.42.0"
        },
        "duckdb": {
          "status": "connected",
          "responseTime": 8,
          "memoryUsage": "45MB",
          "lastQuery": "2025-06-15T10:29:50.000Z",
          "version": "0.9.2"
        }
      },
      "jobQueue": {
        "status": "operational",
        "queueSize": 3,
        "runningJobs": 1,
        "completedJobs": 247,
        "failedJobs": 5,
        "maxConcurrency": 3,
        "averageProcessingTime": 45000
      },
      "fileSystem": {
        "status": "healthy",
        "uploadDirectory": {
          "path": "/app/data/uploads",
          "available": true,
          "freeSpace": "85GB",
          "permissions": "read-write"
        },
        "tempDirectory": {
          "path": "/tmp",
          "available": true,
          "freeSpace": "15GB",
          "permissions": "read-write"
        }
      },
      "security": {
        "status": "operational",
        "piiDetection": {
          "status": "healthy",
          "accuracy": 0.95,
          "responseTime": 12
        },
        "masking": {
          "status": "healthy",
          "throughput": "1000 texts/second",
          "responseTime": 8
        },
        "compliance": {
          "status": "healthy",
          "frameworks": ["GDPR", "CCPA", "HIPAA", "PCI"],
          "lastUpdate": "2025-06-15T10:00:00.000Z"
        }
      }
    },
    "performance": {
      "cpu": {
        "usage": 25.5,
        "cores": 8,
        "loadAverage": [1.2, 1.1, 1.0]
      },
      "memory": {
        "used": "512MB",
        "total": "2GB",
        "usage": 25.6,
        "available": "1.5GB"
      },
      "disk": {
        "used": "15GB",
        "total": "100GB",
        "usage": 15.0,
        "available": "85GB"
      },
      "network": {
        "bytesIn": 1024000,
        "bytesOut": 2048000,
        "requestsPerSecond": 25.5,
        "errorRate": 0.02
      }
    },
    "checks": {
      "databaseConnectivity": "passed",
      "fileSystemAccess": "passed",
      "memoryUsage": "passed",
      "diskSpace": "passed",
      "jobQueueCapacity": "passed",
      "securityServices": "passed"
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Degraded Services)
```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "timestamp": "2025-06-15T10:30:00.000Z",
    "environment": "production",
    "version": "1.0.0",
    "uptime": 86400,
    "services": {
      "api": {
        "status": "operational",
        "responseTime": 15,
        "lastCheck": "2025-06-15T10:30:00.000Z"
      },
      "database": {
        "sqlite": {
          "status": "connected",
          "responseTime": 5,
          "connectionPool": {
            "active": 8,
            "idle": 2,
            "max": 10
          }
        },
        "duckdb": {
          "status": "error",
          "error": "Connection timeout",
          "lastSuccessfulConnection": "2025-06-15T10:25:00.000Z",
          "retryCount": 3
        }
      },
      "jobQueue": {
        "status": "degraded",
        "queueSize": 150,
        "runningJobs": 3,
        "warning": "Queue size approaching maximum capacity",
        "maxQueueSize": 200
      }
    },
    "alerts": [
      {
        "severity": "warning",
        "service": "duckdb",
        "message": "Database connection timeout",
        "timestamp": "2025-06-15T10:28:00.000Z",
        "impact": "Analytics features unavailable"
      },
      {
        "severity": "warning",
        "service": "jobQueue",
        "message": "High queue utilization",
        "timestamp": "2025-06-15T10:29:00.000Z",
        "impact": "Increased job processing delays"
      }
    ],
    "checks": {
      "databaseConnectivity": "partial",
      "fileSystemAccess": "passed",
      "memoryUsage": "passed",
      "diskSpace": "passed",
      "jobQueueCapacity": "warning",
      "securityServices": "passed"
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Health Status Levels
```typescript
type HealthStatus = 
  | 'healthy'     // All services operational
  | 'degraded'    // Some services have issues but core functionality available
  | 'unhealthy';  // Critical services down, limited functionality

type ServiceStatus = 
  | 'operational' // Service fully functional
  | 'degraded'    // Service functional but with issues
  | 'down'        // Service not available
  | 'maintenance'; // Service in maintenance mode
```

---

## 🚀 Readiness Probe

Kubernetes-style readiness probe for deployment orchestration.

### `GET /api/v1/health/ready`

#### Request
```http
GET /api/v1/health/ready
```

#### Response (Ready)
```json
{
  "success": true,
  "data": {
    "ready": true,
    "timestamp": "2025-06-15T10:30:00.000Z",
    "checks": {
      "database": "ready",
      "fileSystem": "ready",
      "jobQueue": "ready",
      "configuration": "ready"
    },
    "readinessTime": 5000
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Not Ready)
```json
{
  "success": false,
  "error": "Service not ready",
  "details": {
    "ready": false,
    "timestamp": "2025-06-15T10:30:00.000Z",
    "checks": {
      "database": "not_ready",
      "fileSystem": "ready",
      "jobQueue": "initializing",
      "configuration": "ready"
    },
    "blockers": [
      "Database migration in progress",
      "Job queue initializing"
    ],
    "estimatedReadyTime": "2025-06-15T10:32:00.000Z"
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response Codes
- `200 OK` - Service is ready to accept traffic
- `503 Service Unavailable` - Service is not ready

#### Readiness Criteria
1. **Database Connectivity**: Both SQLite and DuckDB accessible
2. **File System Access**: Upload and temp directories writable
3. **Job Queue**: Background processing system initialized
4. **Configuration**: All required configuration loaded
5. **Security Services**: PII detection and masking operational

---

## 💓 Liveness Probe

Kubernetes-style liveness probe for container health monitoring.

### `GET /api/v1/health/live`

#### Request
```http
GET /api/v1/health/live
```

#### Response (Alive)
```json
{
  "success": true,
  "data": {
    "alive": true,
    "timestamp": "2025-06-15T10:30:00.000Z",
    "uptime": 86400,
    "checks": {
      "process": "running",
      "memory": "healthy",
      "eventLoop": "responsive",
      "api": "responding"
    }
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response (Dead/Unresponsive)
```json
{
  "success": false,
  "error": "Service unresponsive",
  "details": {
    "alive": false,
    "timestamp": "2025-06-15T10:30:00.000Z",
    "checks": {
      "process": "running",
      "memory": "critical",
      "eventLoop": "blocked",
      "api": "timeout"
    },
    "issues": [
      "Memory usage exceeds 95%",
      "Event loop lag > 1000ms",
      "API response time > 30 seconds"
    ]
  },
  "timestamp": "2025-06-15T10:30:00.000Z"
}
```

#### Response Codes
- `200 OK` - Service is alive and responsive
- `503 Service Unavailable` - Service is unresponsive or dead

#### Liveness Criteria
1. **Process Health**: Main process running without critical errors
2. **Memory Usage**: Memory consumption within acceptable limits (<90%)
3. **Event Loop**: Node.js event loop responsive (lag <100ms)
4. **API Responsiveness**: Core endpoints responding within timeout

---

## 📊 Service Dependencies

### Database Health Checks

#### SQLite Health
```typescript
interface SQLiteHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime: number;        // milliseconds
  connectionPool: {
    active: number;
    idle: number;
    max: number;
  };
  lastQuery: string;          // ISO timestamp
  version: string;
  fileSize: number;           // bytes
  integrityCheck: 'passed' | 'failed';
}
```

#### DuckDB Health
```typescript
interface DuckDBHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime: number;       // milliseconds
  memoryUsage: string;        // human readable
  lastQuery: string;          // ISO timestamp
  version: string;
  activeConnections: number;
  tableCount: number;
}
```

### Job Queue Health
```typescript
interface JobQueueHealth {
  status: 'operational' | 'degraded' | 'down';
  queueSize: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  maxConcurrency: number;
  averageProcessingTime: number; // milliseconds
  oldestPendingJob?: string;    // ISO timestamp
}
```

### File System Health
```typescript
interface FileSystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uploadDirectory: DirectoryHealth;
  tempDirectory: DirectoryHealth;
}

interface DirectoryHealth {
  path: string;
  available: boolean;
  freeSpace: string;           // human readable
  permissions: string;
  lastWrite?: string;          // ISO timestamp
}
```

### Security Services Health
```typescript
interface SecurityHealth {
  status: 'operational' | 'degraded' | 'down';
  piiDetection: {
    status: 'healthy' | 'error';
    accuracy: number;
    responseTime: number;
    lastCalibration?: string;
  };
  masking: {
    status: 'healthy' | 'error';
    throughput: string;
    responseTime: number;
  };
  compliance: {
    status: 'healthy' | 'error';
    frameworks: string[];
    lastUpdate: string;
  };
}
```

---

## ⚡ Performance Monitoring

### System Metrics
```typescript
interface SystemMetrics {
  cpu: {
    usage: number;              // percentage
    cores: number;
    loadAverage: number[];      // 1, 5, 15 minute averages
  };
  memory: {
    used: string;               // human readable
    total: string;
    usage: number;              // percentage
    available: string;
    heapUsed?: string;          // Node.js heap (if applicable)
  };
  disk: {
    used: string;
    total: string;
    usage: number;              // percentage
    available: string;
    iops?: number;              // operations per second
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    requestsPerSecond: number;
    errorRate: number;          // percentage
    activeConnections?: number;
  };
}
```

### Health Check Performance
```typescript
interface HealthCheckPerformance {
  basic: '< 5ms';               // /health endpoint
  detailed: '< 100ms';          // /api/v1/health/status
  readiness: '< 50ms';          // /api/v1/health/ready
  liveness: '< 10ms';           // /api/v1/health/live
}
```

### Alerting Thresholds
```typescript
interface AlertThresholds {
  memory: {
    warning: 80;               // percentage
    critical: 95;
  };
  disk: {
    warning: 85;               // percentage
    critical: 95;
  };
  cpu: {
    warning: 80;               // percentage
    critical: 95;
  };
  responseTime: {
    warning: 1000;             // milliseconds
    critical: 5000;
  };
  errorRate: {
    warning: 5;                // percentage
    critical: 10;
  };
  queueSize: {
    warning: 100;              // number of jobs
    critical: 500;
  };
}
```

---

## 🔍 Health Check Strategies

### Circuit Breaker Pattern
```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;         // failures before opening
  recoveryTimeout: 30000;      // milliseconds
  monitoringPeriod: 60000;     // milliseconds
  expectedError: ['TIMEOUT', 'CONNECTION_ERROR'];
}
```

### Retry Logic
```typescript
interface RetryConfig {
  maxRetries: 3;
  baseDelay: 1000;             // milliseconds
  maxDelay: 10000;             // milliseconds
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_FAILURE'];
}
```

### Health Check Caching
```typescript
interface HealthCacheConfig {
  basicHealthTTL: 5000;        // 5 seconds
  detailedHealthTTL: 30000;    // 30 seconds
  readinessTTL: 10000;         // 10 seconds
  livenessTTL: 5000;           // 5 seconds
  invalidateOnError: true;
}
```

---

## 🚨 Alert Configuration

### Alert Severity Levels
```typescript
type AlertSeverity = 
  | 'info'     // Informational, no action required
  | 'warning'  // Attention needed, service degraded
  | 'error'    // Action required, functionality impacted
  | 'critical'; // Immediate action required, service down
```

### Alert Types
```typescript
interface AlertTypes {
  service_down: {
    severity: 'critical';
    description: 'Core service unavailable';
    escalation: 'immediate';
  };
  degraded_performance: {
    severity: 'warning';
    description: 'Service responding slowly';
    escalation: 'notify';
  };
  resource_exhaustion: {
    severity: 'error';
    description: 'System resources critically low';
    escalation: 'urgent';
  };
  dependency_failure: {
    severity: 'warning';
    description: 'External dependency unavailable';
    escalation: 'monitor';
  };
}
```

### Health Check Notifications
```typescript
interface NotificationConfig {
  channels: ['email', 'slack', 'webhook'];
  thresholds: {
    consecutive_failures: 3;
    error_rate_threshold: 5;    // percentage
    response_time_threshold: 2000; // milliseconds
  };
  escalation: {
    warning: 'team_lead';
    error: 'on_call_engineer';
    critical: 'incident_commander';
  };
}
```

---

## 🔧 Configuration

### Health Check Configuration
```typescript
interface HealthCheckConfig {
  enabled: boolean;
  intervals: {
    basic: 5000;               // milliseconds
    detailed: 30000;
    readiness: 10000;
    liveness: 5000;
  };
  timeouts: {
    database: 5000;            // milliseconds
    fileSystem: 1000;
    jobQueue: 2000;
    security: 3000;
  };
  thresholds: AlertThresholds;
  notifications: NotificationConfig;
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  cache: HealthCacheConfig;
}
```

### Environment-Specific Settings
```typescript
interface EnvironmentHealthConfig {
  development: {
    detailedLogging: true;
    alerting: false;
    performance_monitoring: false;
  };
  staging: {
    detailedLogging: true;
    alerting: true;
    performance_monitoring: true;
  };
  production: {
    detailedLogging: false;
    alerting: true;
    performance_monitoring: true;
    high_availability: true;
  };
}
```

---

## 🚀 Usage Examples

### Basic Health Monitoring
```typescript
class HealthMonitor {
  private healthInterval: NodeJS.Timeout | null = null;
  
  startMonitoring() {
    this.healthInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/v1/health/status');
        const health = await response.json();
        
        if (health.data.status === 'degraded' || health.data.status === 'unhealthy') {
          this.handleUnhealthyState(health.data);
        }
        
        this.updateDashboard(health.data);
      } catch (error) {
        console.error('Health check failed:', error);
        this.handleHealthCheckFailure();
      }
    }, 30000); // Check every 30 seconds
  }
  
  private handleUnhealthyState(healthData: any) {
    const alerts = healthData.alerts || [];
    for (const alert of alerts) {
      if (alert.severity === 'critical') {
        this.sendAlert(alert);
      }
    }
  }
  
  private updateDashboard(healthData: any) {
    // Update real-time dashboard
    this.updateServiceStatus(healthData.services);
    this.updatePerformanceMetrics(healthData.performance);
  }
  
  stopMonitoring() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}
```

### Kubernetes Integration
```yaml
# kubernetes deployment with health checks
apiVersion: apps/v1
kind: Deployment
metadata:
  name: datacloak-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: datacloak/backend:latest
        ports:
        - containerPort: 3001
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### Custom Health Checks
```typescript
// Custom health check for external dependencies
class CustomHealthCheck {
  async checkExternalAPI() {
    try {
      const response = await fetch('https://api.external-service.com/health', {
        timeout: 5000
      });
      
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime: response.headers.get('x-response-time'),
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }
  
  async performDatabaseMigrationCheck() {
    // Check if database migrations are up to date
    const migrationStatus = await this.checkMigrationStatus();
    
    return {
      status: migrationStatus.pending.length === 0 ? 'healthy' : 'warning',
      pendingMigrations: migrationStatus.pending,
      appliedMigrations: migrationStatus.applied.length,
      lastMigration: migrationStatus.lastApplied
    };
  }
}
```

---

This comprehensive health monitoring system ensures reliable operation and early detection of issues in the DataCloak Sentiment Workbench platform.