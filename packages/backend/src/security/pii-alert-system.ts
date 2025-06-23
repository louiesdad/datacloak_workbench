/**
 * PII Alert System
 * 
 * Manages PII leak alerts, notification delivery, and alert aggregation
 * for comprehensive PII protection monitoring.
 */

import { EventEmitter } from 'events';
import { logger } from '../config/logger';
import { PIILeakAlert } from './pii-masking-verifier';

export interface AlertConfiguration {
  emailNotifications: boolean;
  webhookUrl?: string;
  slackWebhook?: string;
  alertThresholds: {
    warning: number;  // alerts per hour
    error: number;    // alerts per hour  
    critical: number; // alerts per day
  };
  escalationRules: EscalationRule[];
}

export interface EscalationRule {
  severity: 'warning' | 'error' | 'critical';
  threshold: number;
  timeWindow: number; // minutes
  action: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
}

export interface AlertAggregation {
  period: string;
  totalAlerts: number;
  severityCounts: Record<string, number>;
  piiTypeCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
}

export class PIIAlertSystem extends EventEmitter {
  private configuration: AlertConfiguration;
  private alertHistory: PIILeakAlert[];
  private alertCounters: Map<string, number>;
  private escalationTimers: Map<string, NodeJS.Timeout>;
  private lastAggregation: AlertAggregation | null;

  constructor(configuration?: Partial<AlertConfiguration>) {
    super();
    
    this.configuration = {
      emailNotifications: true,
      alertThresholds: {
        warning: 10,  // 10 warnings per hour
        error: 5,     // 5 errors per hour
        critical: 1   // 1 critical per day
      },
      escalationRules: [
        {
          severity: 'critical',
          threshold: 1,
          timeWindow: 5, // 5 minutes
          action: 'email',
          recipients: ['security@company.com']
        },
        {
          severity: 'error',
          threshold: 3,
          timeWindow: 30, // 30 minutes
          action: 'slack',
          recipients: ['#security-alerts']
        }
      ],
      ...configuration
    };
    
    this.alertHistory = [];
    this.alertCounters = new Map();
    this.escalationTimers = new Map();
    this.lastAggregation = null;
    
    this.initializeCounters();
    this.setupPeriodicAggregation();
  }

  /**
   * Process incoming PII leak alert
   */
  async processAlert(alert: PIILeakAlert): Promise<void> {
    try {
      // Add to history
      this.alertHistory.push(alert);
      
      // Update counters
      this.updateCounters(alert);
      
      // Check thresholds
      await this.checkThresholds(alert);
      
      // Check escalation rules
      await this.checkEscalationRules(alert);
      
      // Emit event for other systems
      this.emit('pii-alert', alert);
      
      // Log structured alert
      await this.logStructuredAlert(alert);
      
    } catch (error) {
      logger.error('Failed to process PII alert:', error);
    }
  }

  /**
   * Update alert counters
   */
  private updateCounters(alert: PIILeakAlert): void {
    const hourKey = this.getHourKey();
    const dayKey = this.getDayKey();
    const severityHourKey = `${alert.severity}:${hourKey}`;
    const severityDayKey = `${alert.severity}:${dayKey}`;
    
    this.alertCounters.set(hourKey, (this.alertCounters.get(hourKey) || 0) + 1);
    this.alertCounters.set(dayKey, (this.alertCounters.get(dayKey) || 0) + 1);
    this.alertCounters.set(severityHourKey, (this.alertCounters.get(severityHourKey) || 0) + 1);
    this.alertCounters.set(severityDayKey, (this.alertCounters.get(severityDayKey) || 0) + 1);
  }

  /**
   * Check alert thresholds
   */
  private async checkThresholds(alert: PIILeakAlert): Promise<void> {
    const hourKey = this.getHourKey();
    const dayKey = this.getDayKey();
    const severityHourKey = `${alert.severity}:${hourKey}`;
    const severityDayKey = `${alert.severity}:${dayKey}`;
    
    const thresholds = this.configuration.alertThresholds;
    
    // Check hourly thresholds
    if (alert.severity === 'warning' && 
        (this.alertCounters.get(severityHourKey) || 0) >= thresholds.warning) {
      await this.triggerThresholdAlert('warning', 'hourly', this.alertCounters.get(severityHourKey)!);
    }
    
    if (alert.severity === 'error' && 
        (this.alertCounters.get(severityHourKey) || 0) >= thresholds.error) {
      await this.triggerThresholdAlert('error', 'hourly', this.alertCounters.get(severityHourKey)!);
    }
    
    // Check daily thresholds
    if (alert.severity === 'critical' && 
        (this.alertCounters.get(severityDayKey) || 0) >= thresholds.critical) {
      await this.triggerThresholdAlert('critical', 'daily', this.alertCounters.get(severityDayKey)!);
    }
  }

  /**
   * Check escalation rules
   */
  private async checkEscalationRules(alert: PIILeakAlert): Promise<void> {
    for (const rule of this.configuration.escalationRules) {
      if (rule.severity === alert.severity) {
        const windowStart = Date.now() - (rule.timeWindow * 60 * 1000);
        const recentAlerts = this.alertHistory.filter(a => 
          a.severity === rule.severity && 
          new Date(a.timestamp).getTime() >= windowStart
        );
        
        if (recentAlerts.length >= rule.threshold) {
          await this.triggerEscalation(rule, recentAlerts);
        }
      }
    }
  }

  /**
   * Trigger threshold alert
   */
  private async triggerThresholdAlert(severity: string, period: string, count: number): Promise<void> {
    const thresholdAlert = {
      type: 'threshold_exceeded',
      severity,
      period,
      count,
      timestamp: new Date().toISOString(),
      message: `PII alert threshold exceeded: ${count} ${severity} alerts in ${period} period`
    };
    
    logger.warn('PII Alert Threshold Exceeded', thresholdAlert);
    
    // Send notifications based on configuration
    if (this.configuration.emailNotifications) {
      await this.sendEmailNotification(thresholdAlert);
    }
    
    if (this.configuration.webhookUrl) {
      await this.sendWebhookNotification(thresholdAlert);
    }
    
    this.emit('threshold-exceeded', thresholdAlert);
  }

  /**
   * Trigger escalation
   */
  private async triggerEscalation(rule: EscalationRule, alerts: PIILeakAlert[]): Promise<void> {
    const escalationKey = `${rule.severity}:${rule.timeWindow}`;
    
    // Prevent duplicate escalations
    if (this.escalationTimers.has(escalationKey)) {
      return;
    }
    
    const escalation = {
      rule,
      alerts,
      triggeredAt: new Date().toISOString(),
      message: `Escalation triggered: ${alerts.length} ${rule.severity} alerts in ${rule.timeWindow} minutes`
    };
    
    logger.error('PII Alert Escalation Triggered', escalation);
    
    // Execute escalation action
    switch (rule.action) {
      case 'email':
        await this.sendEscalationEmail(escalation);
        break;
      case 'slack':
        await this.sendSlackNotification(escalation);
        break;
      case 'webhook':
        await this.sendWebhookNotification(escalation);
        break;
      case 'sms':
        await this.sendSMSNotification(escalation);
        break;
    }
    
    // Set cooldown timer
    const cooldown = setTimeout(() => {
      this.escalationTimers.delete(escalationKey);
    }, rule.timeWindow * 60 * 1000);
    
    this.escalationTimers.set(escalationKey, cooldown);
    
    this.emit('escalation-triggered', escalation);
  }

  /**
   * Generate alert aggregation
   */
  generateAggregation(period: 'hour' | 'day' | 'week' = 'hour'): AlertAggregation {
    const now = new Date();
    let startTime: Date;
    let periodString: string;
    
    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        periodString = `${now.getHours()}:00 - ${now.getHours() + 1}:00`;
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        periodString = now.toDateString();
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        periodString = `Week of ${startTime.toDateString()}`;
        break;
    }
    
    const periodAlerts = this.alertHistory.filter(alert => 
      new Date(alert.timestamp).getTime() >= startTime.getTime()
    );
    
    const severityCounts: Record<string, number> = {};
    const piiTypeCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    
    for (const alert of periodAlerts) {
      severityCounts[alert.severity] = (severityCounts[alert.severity] || 0) + 1;
      piiTypeCounts[alert.piiType] = (piiTypeCounts[alert.piiType] || 0) + 1;
      sourceCounts[alert.source] = (sourceCounts[alert.source] || 0) + 1;
    }
    
    // Calculate risk trend
    const riskTrend = this.calculateRiskTrend(periodAlerts);
    
    const aggregation: AlertAggregation = {
      period: periodString,
      totalAlerts: periodAlerts.length,
      severityCounts,
      piiTypeCounts,
      sourceCounts,
      riskTrend
    };
    
    this.lastAggregation = aggregation;
    return aggregation;
  }

  /**
   * Calculate risk trend
   */
  private calculateRiskTrend(alerts: PIILeakAlert[]): 'increasing' | 'stable' | 'decreasing' {
    if (alerts.length < 10) return 'stable';
    
    const midpoint = Math.floor(alerts.length / 2);
    const firstHalf = alerts.slice(0, midpoint);
    const secondHalf = alerts.slice(midpoint);
    
    const firstHalfCritical = firstHalf.filter(a => a.severity === 'critical').length;
    const secondHalfCritical = secondHalf.filter(a => a.severity === 'critical').length;
    
    if (secondHalfCritical > firstHalfCritical * 1.2) return 'increasing';
    if (secondHalfCritical < firstHalfCritical * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(): {
    totalAlerts: number;
    last24Hours: number;
    severityBreakdown: Record<string, number>;
    topPIITypes: Array<{ type: string; count: number }>;
    topSources: Array<{ source: string; count: number }>;
  } {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recent = this.alertHistory.filter(a => new Date(a.timestamp).getTime() >= last24Hours);
    
    const severityBreakdown: Record<string, number> = {};
    const piiTypeCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    
    for (const alert of recent) {
      severityBreakdown[alert.severity] = (severityBreakdown[alert.severity] || 0) + 1;
      piiTypeCounts[alert.piiType] = (piiTypeCounts[alert.piiType] || 0) + 1;
      sourceCounts[alert.source] = (sourceCounts[alert.source] || 0) + 1;
    }
    
    const topPIITypes = Object.entries(piiTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const topSources = Object.entries(sourceCounts)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalAlerts: this.alertHistory.length,
      last24Hours: recent.length,
      severityBreakdown,
      topPIITypes,
      topSources
    };
  }

  // Notification methods (mock implementations)
  private async sendEmailNotification(alert: any): Promise<void> {
    logger.info('Sending email notification', { alert });
    // Email service integration would go here
  }

  private async sendWebhookNotification(alert: any): Promise<void> {
    logger.info('Sending webhook notification', { alert });
    // Webhook service integration would go here
  }

  private async sendSlackNotification(alert: any): Promise<void> {
    logger.info('Sending Slack notification', { alert });
    // Slack integration would go here
  }

  private async sendSMSNotification(alert: any): Promise<void> {
    logger.info('Sending SMS notification', { alert });
    // SMS service integration would go here
  }

  private async sendEscalationEmail(escalation: any): Promise<void> {
    logger.error('Sending escalation email', { escalation });
    // Escalation email service would go here
  }

  private async logStructuredAlert(alert: PIILeakAlert): Promise<void> {
    const structuredLog = {
      eventType: 'pii_leak_alert',
      timestamp: alert.timestamp,
      severity: alert.severity,
      piiType: alert.piiType,
      source: alert.source,
      confidence: alert.confidence,
      masked: alert.masked,
      riskAssessment: alert.riskAssessment,
      context: alert.context
    };
    
    logger.warn('PII Leak Alert', structuredLog);
  }

  // Helper methods
  private initializeCounters(): void {
    // Initialize with zero values for current periods
    const hourKey = this.getHourKey();
    const dayKey = this.getDayKey();
    
    this.alertCounters.set(hourKey, 0);
    this.alertCounters.set(dayKey, 0);
  }

  private setupPeriodicAggregation(): void {
    // Generate aggregation every hour
    setInterval(() => {
      const aggregation = this.generateAggregation('hour');
      this.emit('aggregation-generated', aggregation);
      logger.info('PII Alert Aggregation', aggregation);
    }, 60 * 60 * 1000); // Every hour
  }

  private getHourKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
  }

  private getDayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }
}

// Export singleton instance
export const piiAlertSystem = new PIIAlertSystem();