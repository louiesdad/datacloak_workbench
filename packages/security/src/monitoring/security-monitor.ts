import { EventEmitter } from 'events';
import { SecurityAuditResult, PIIDetectionResult } from '../interfaces/datacloak';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: 'pii_detected' | 'security_violation' | 'compliance_breach' | 'performance_issue' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  data: any;
  resolved: boolean;
}

export interface MonitoringConfig {
  enableRealTimeAlerts: boolean;
  alertThresholds: {
    piiDetectionRate: number;
    complianceScore: number;
    processingTime: number;
    errorRate: number;
  };
  retentionDays: number;
  aggregationIntervalMs: number;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  averageComplianceScore: number;
  averageProcessingTime: number;
  errorRate: number;
  trendsLast24h: {
    piiDetections: number[];
    complianceScores: number[];
    processingTimes: number[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (event: SecurityEvent, metrics: SecurityMetrics) => boolean;
  action: (event: SecurityEvent, metrics: SecurityMetrics) => void;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: Date;
}

export class SecurityMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics;
  private alertRules: Map<string, AlertRule> = new Map();
  private metricsInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      enableRealTimeAlerts: true,
      alertThresholds: {
        piiDetectionRate: 100, // alerts per hour
        complianceScore: 0.8,
        processingTime: 5000, // milliseconds
        errorRate: 0.1 // 10%
      },
      retentionDays: 30,
      aggregationIntervalMs: 60000, // 1 minute
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.setupDefaultAlertRules();
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics_updated', this.metrics);
    }, this.config.aggregationIntervalMs);

    this.emit('monitoring_started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.emit('monitoring_stopped');
  }

  recordPIIDetection(source: string, detections: PIIDetectionResult[], processingTime: number): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'pii_detected',
      severity: this.calculatePIISeverity(detections),
      source,
      data: {
        detectionsCount: detections.length,
        detections,
        processingTime
      },
      resolved: false
    };

    this.addEvent(event);
  }

  recordSecurityViolation(source: string, violation: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'security_violation',
      severity,
      source,
      data: { violation },
      resolved: false
    };

    this.addEvent(event);
  }

  recordComplianceBreach(source: string, auditResult: SecurityAuditResult): void {
    const severity = auditResult.complianceScore < 0.5 ? 'critical' : 
                    auditResult.complianceScore < 0.7 ? 'high' : 'medium';

    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'compliance_breach',
      severity,
      source,
      data: { auditResult },
      resolved: false
    };

    this.addEvent(event);
  }

  recordPerformanceIssue(source: string, issue: string, processingTime: number): void {
    const severity = processingTime > 10000 ? 'high' : 
                    processingTime > 5000 ? 'medium' : 'low';

    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'performance_issue',
      severity,
      source,
      data: { issue, processingTime },
      resolved: false
    };

    this.addEvent(event);
  }

  recordError(source: string, error: string | Error, context?: any): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'error',
      severity: 'medium',
      source,
      data: { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context 
      },
      resolved: false
    };

    this.addEvent(event);
  }

  resolveEvent(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId);
    if (event && !event.resolved) {
      event.resolved = true;
      this.emit('event_resolved', event);
      return true;
    }
    return false;
  }

  getEvents(options: {
    type?: string;
    severity?: string;
    source?: string;
    resolved?: boolean;
    since?: Date;
    limit?: number;
  } = {}): SecurityEvent[] {
    let filtered = this.events;

    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    if (options.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }
    if (options.source) {
      filtered = filtered.filter(e => e.source === options.source);
    }
    if (options.resolved !== undefined) {
      filtered = filtered.filter(e => e.resolved === options.resolved);
    }
    if (options.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  exportEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2);
    } else {
      // CSV format
      const headers = ['id', 'timestamp', 'type', 'severity', 'source', 'resolved', 'data'];
      const rows = this.events.map(event => [
        event.id,
        event.timestamp.toISOString(),
        event.type,
        event.severity,
        event.source,
        event.resolved.toString(),
        JSON.stringify(event.data)
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }

  clearOldEvents(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    const initialCount = this.events.length;
    this.events = this.events.filter(event => event.timestamp >= cutoffDate);
    
    const removedCount = initialCount - this.events.length;
    if (removedCount > 0) {
      this.emit('events_cleaned', { removedCount, totalRemaining: this.events.length });
    }
  }

  private addEvent(event: SecurityEvent): void {
    this.events.push(event);
    this.emit('event_added', event);

    if (this.config.enableRealTimeAlerts) {
      this.checkAlertRules(event);
    }

    // Clean old events periodically
    if (this.events.length % 1000 === 0) {
      this.clearOldEvents();
    }
  }

  private checkAlertRules(event: SecurityEvent): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldownMs) {
        continue;
      }

      try {
        if (rule.condition(event, this.metrics)) {
          rule.lastTriggered = new Date();
          rule.action(event, this.metrics);
          this.emit('alert_triggered', { rule, event });
        }
      } catch (error) {
        this.emit('alert_rule_error', { rule, error });
      }
    }
  }

  private updateMetrics(): void {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= last24h);

    this.metrics = {
      totalEvents: this.events.length,
      eventsByType: this.countBy(this.events, 'type'),
      eventsBySeverity: this.countBy(this.events, 'severity'),
      averageComplianceScore: this.calculateAverageCompliance(recentEvents),
      averageProcessingTime: this.calculateAverageProcessingTime(recentEvents),
      errorRate: this.calculateErrorRate(recentEvents),
      trendsLast24h: this.calculateTrends(recentEvents)
    };
  }

  private initializeMetrics(): SecurityMetrics {
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      averageComplianceScore: 1.0,
      averageProcessingTime: 0,
      errorRate: 0,
      trendsLast24h: {
        piiDetections: [],
        complianceScores: [],
        processingTimes: []
      }
    };
  }

  private setupDefaultAlertRules(): void {
    // High PII detection rate alert
    this.addAlertRule({
      id: 'high_pii_rate',
      name: 'High PII Detection Rate',
      condition: (event, metrics) => {
        const hourlyRate = metrics.eventsByType['pii_detected'] || 0;
        return hourlyRate > this.config.alertThresholds.piiDetectionRate;
      },
      action: (event, metrics) => {
        this.emit('alert', {
          type: 'high_pii_rate',
          message: `High PII detection rate: ${metrics.eventsByType['pii_detected']} detections`,
          severity: 'medium'
        });
      },
      enabled: true,
      cooldownMs: 300000 // 5 minutes
    });

    // Low compliance score alert
    this.addAlertRule({
      id: 'low_compliance',
      name: 'Low Compliance Score',
      condition: (event, metrics) => {
        return event.type === 'compliance_breach' && 
               metrics.averageComplianceScore < this.config.alertThresholds.complianceScore;
      },
      action: (event, metrics) => {
        this.emit('alert', {
          type: 'low_compliance',
          message: `Compliance score below threshold: ${metrics.averageComplianceScore.toFixed(2)}`,
          severity: 'high'
        });
      },
      enabled: true,
      cooldownMs: 600000 // 10 minutes
    });

    // Performance issue alert
    this.addAlertRule({
      id: 'slow_processing',
      name: 'Slow Processing Performance',
      condition: (event, metrics) => {
        return event.type === 'performance_issue' && 
               metrics.averageProcessingTime > this.config.alertThresholds.processingTime;
      },
      action: (event, metrics) => {
        this.emit('alert', {
          type: 'slow_processing',
          message: `Processing time exceeded threshold: ${metrics.averageProcessingTime}ms`,
          severity: 'medium'
        });
      },
      enabled: true,
      cooldownMs: 300000 // 5 minutes
    });

    // High error rate alert
    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: (event, metrics) => {
        return metrics.errorRate > this.config.alertThresholds.errorRate;
      },
      action: (event, metrics) => {
        this.emit('alert', {
          type: 'high_error_rate',
          message: `Error rate exceeded threshold: ${(metrics.errorRate * 100).toFixed(1)}%`,
          severity: 'high'
        });
      },
      enabled: true,
      cooldownMs: 600000 // 10 minutes
    });
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculatePIISeverity(detections: PIIDetectionResult[]): 'low' | 'medium' | 'high' | 'critical' {
    if (detections.length === 0) return 'low';
    if (detections.length > 10) return 'critical';
    if (detections.length > 5) return 'high';
    if (detections.length > 2) return 'medium';
    return 'low';
  }

  private countBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAverageCompliance(events: SecurityEvent[]): number {
    const complianceEvents = events.filter(e => 
      e.type === 'compliance_breach' && e.data?.auditResult?.complianceScore != null
    );
    
    if (complianceEvents.length === 0) return 1.0;
    
    const sum = complianceEvents.reduce((acc, event) => 
      acc + event.data.auditResult.complianceScore, 0
    );
    
    return sum / complianceEvents.length;
  }

  private calculateAverageProcessingTime(events: SecurityEvent[]): number {
    const perfEvents = events.filter(e => 
      e.data?.processingTime != null
    );
    
    if (perfEvents.length === 0) return 0;
    
    const sum = perfEvents.reduce((acc, event) => 
      acc + event.data.processingTime, 0
    );
    
    return sum / perfEvents.length;
  }

  private calculateErrorRate(events: SecurityEvent[]): number {
    if (events.length === 0) return 0;
    
    const errorCount = events.filter(e => e.type === 'error').length;
    return errorCount / events.length;
  }

  private calculateTrends(events: SecurityEvent[]): SecurityMetrics['trendsLast24h'] {
    const hoursBack = 24;
    const piiDetections = new Array(hoursBack).fill(0);
    const complianceScores: number[] = [];
    const processingTimes: number[] = [];

    events.forEach(event => {
      const hoursAgo = Math.floor((Date.now() - event.timestamp.getTime()) / (1000 * 60 * 60));
      
      if (hoursAgo < hoursBack) {
        if (event.type === 'pii_detected') {
          piiDetections[hoursBack - 1 - hoursAgo]++;
        }
        
        if (event.data?.auditResult?.complianceScore != null) {
          complianceScores.push(event.data.auditResult.complianceScore);
        }
        
        if (event.data?.processingTime != null) {
          processingTimes.push(event.data.processingTime);
        }
      }
    });

    return {
      piiDetections,
      complianceScores,
      processingTimes
    };
  }
}