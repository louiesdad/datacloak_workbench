import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { websocketService } from './websocket.service';
import { eventEmitter, EventTypes } from './event.service';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  PROGRESS = 'progress',
  SYSTEM = 'system'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  category?: string;
  actionable?: boolean;
  actions?: NotificationAction[];
  metadata?: any;
  expiresAt?: Date;
  persistent?: boolean;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    message?: string;
  };
}

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string;
  data?: any;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'user' | 'role' | 'topic' | 'broadcast';
  target?: string; // userId, role, or topic name
  filters?: NotificationFilter;
  active: boolean;
  createdAt: Date;
}

export interface NotificationFilter {
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  categories?: string[];
  sources?: string[];
}

export interface NotificationSubscription {
  clientId: string;
  userId?: string;
  channels: Set<string>;
  filters?: NotificationFilter;
  deliveryPreferences?: {
    bundleInterval?: number; // Bundle notifications over this interval
    maxBundle?: number; // Max notifications per bundle
    quietHours?: { start: string; end: string };
    soundEnabled?: boolean;
  };
  lastDelivery: Date;
  pendingNotifications: Notification[];
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: (notification: Notification) => boolean;
  channels: string[];
  priority: number;
  active: boolean;
}

export class NotificationChannelsService extends EventEmitter {
  private channels = new Map<string, NotificationChannel>();
  private subscriptions = new Map<string, NotificationSubscription>();
  private routingRules = new Map<string, RoutingRule>();
  private notificationHistory: Notification[] = [];
  private maxHistorySize = 1000;
  private bundleIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    super();
    this.setupDefaultChannels();
    this.setupEventListeners();
    this.setupDefaultRoutingRules();
  }

  private setupDefaultChannels(): void {
    // System broadcast channel
    this.createChannel({
      id: 'system-broadcast',
      name: 'System Broadcast',
      type: 'broadcast',
      active: true,
      createdAt: new Date()
    });

    // Error notifications channel
    this.createChannel({
      id: 'error-channel',
      name: 'Error Notifications',
      type: 'topic',
      target: 'errors',
      filters: {
        types: [NotificationType.ERROR],
        priorities: [NotificationPriority.HIGH, NotificationPriority.CRITICAL]
      },
      active: true,
      createdAt: new Date()
    });

    // Progress updates channel
    this.createChannel({
      id: 'progress-channel',
      name: 'Progress Updates',
      type: 'topic',
      target: 'progress',
      filters: {
        types: [NotificationType.PROGRESS]
      },
      active: true,
      createdAt: new Date()
    });
  }

  private setupDefaultRoutingRules(): void {
    // Route critical errors to all users
    this.addRoutingRule({
      id: 'critical-errors',
      name: 'Critical Error Broadcasting',
      condition: (n) => n.type === NotificationType.ERROR && n.priority === NotificationPriority.CRITICAL,
      channels: ['system-broadcast'],
      priority: 100,
      active: true
    });

    // Route job progress to progress channel
    this.addRoutingRule({
      id: 'job-progress',
      name: 'Job Progress Routing',
      condition: (n) => n.type === NotificationType.PROGRESS && n.category === 'job',
      channels: ['progress-channel'],
      priority: 50,
      active: true
    });

    // Route system notifications
    this.addRoutingRule({
      id: 'system-notifications',
      name: 'System Notification Routing',
      condition: (n) => n.type === NotificationType.SYSTEM,
      channels: ['system-broadcast'],
      priority: 75,
      active: true
    });
  }

  private setupEventListeners(): void {
    // Job events
    eventEmitter.on(EventTypes.JOB_PROGRESS, (data) => {
      this.notify({
        type: NotificationType.PROGRESS,
        priority: NotificationPriority.MEDIUM,
        title: `Job Progress: ${data.type}`,
        message: data.message || `Processing ${data.progress}%`,
        source: 'job-queue',
        category: 'job',
        progress: {
          current: data.currentStep || data.progress,
          total: data.totalSteps || 100,
          percentage: data.progress
        },
        metadata: { jobId: data.jobId, jobType: data.type }
      });
    });

    eventEmitter.on(EventTypes.JOB_COMPLETE, (data) => {
      this.notify({
        type: NotificationType.SUCCESS,
        priority: NotificationPriority.MEDIUM,
        title: `Job Completed: ${data.type}`,
        message: 'Job completed successfully',
        source: 'job-queue',
        category: 'job',
        metadata: { jobId: data.jobId, jobType: data.type, result: data.result }
      });
    });

    eventEmitter.on(EventTypes.JOB_FAILED, (data) => {
      this.notify({
        type: NotificationType.ERROR,
        priority: NotificationPriority.HIGH,
        title: `Job Failed: ${data.type}`,
        message: data.error || 'Job failed with an error',
        source: 'job-queue',
        category: 'job',
        actionable: true,
        actions: [{
          id: 'retry',
          label: 'Retry Job',
          type: 'primary',
          action: 'retry_job',
          data: { jobId: data.jobId }
        }],
        metadata: { jobId: data.jobId, jobType: data.type, error: data.error }
      });
    });

    // Security events
    eventEmitter.on('security:threat_detected', (data) => {
      this.notify({
        type: NotificationType.WARNING,
        priority: NotificationPriority.HIGH,
        title: 'Security Threat Detected',
        message: data.message,
        source: 'security',
        category: 'security',
        actionable: true,
        actions: [{
          id: 'view_details',
          label: 'View Details',
          type: 'primary',
          action: 'view_threat_details',
          data: { threatId: data.threatId }
        }],
        metadata: data
      });
    });

    // System events
    eventEmitter.on('system:high_memory', (data) => {
      this.notify({
        type: NotificationType.WARNING,
        priority: NotificationPriority.HIGH,
        title: 'High Memory Usage',
        message: `Memory usage is at ${data.percentage}%`,
        source: 'system',
        category: 'performance',
        metadata: data
      });
    });

    // WebSocket message handling
    eventEmitter.on('ws:message', ({ clientId, message }: any) => {
      switch (message.type) {
        case 'subscribe_notifications':
          this.subscribeClient(clientId, message.data);
          break;
        case 'unsubscribe_notifications':
          this.unsubscribeClient(clientId);
          break;
        case 'acknowledge_notification':
          this.acknowledgeNotification(clientId, message.data?.notificationId);
          break;
        case 'notification_action':
          this.handleNotificationAction(clientId, message.data);
          break;
      }
    });

    // Client disconnect
    eventEmitter.on(EventTypes.WS_CLIENT_DISCONNECTED, ({ clientId }: any) => {
      this.unsubscribeClient(clientId);
    });
  }

  createChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
    logger.info(`Notification channel created: ${channel.name}`);
  }

  deleteChannel(channelId: string): boolean {
    const deleted = this.channels.delete(channelId);
    if (deleted) {
      // Remove channel from all routing rules
      this.routingRules.forEach((rule) => {
        rule.channels = rule.channels.filter(id => id !== channelId);
      });
    }
    return deleted;
  }

  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.set(rule.id, rule);
    logger.info(`Routing rule added: ${rule.name}`);
  }

  removeRoutingRule(ruleId: string): boolean {
    return this.routingRules.delete(ruleId);
  }

  subscribeClient(clientId: string, options: {
    userId?: string;
    channels?: string[];
    filters?: NotificationFilter;
    deliveryPreferences?: any;
  } = {}): void {
    const subscription: NotificationSubscription = {
      clientId,
      userId: options.userId,
      channels: new Set(options.channels || ['system-broadcast']),
      filters: options.filters,
      deliveryPreferences: options.deliveryPreferences,
      lastDelivery: new Date(),
      pendingNotifications: []
    };

    this.subscriptions.set(clientId, subscription);
    websocketService.subscribeToTopic(clientId, 'notifications', { subscription });

    // Set up bundling if requested
    if (options.deliveryPreferences?.bundleInterval) {
      this.setupBundling(clientId);
    }

    websocketService.sendToClient(clientId, {
      type: 'notifications_subscribed',
      data: {
        channels: Array.from(subscription.channels),
        filters: subscription.filters
      }
    });

    logger.info(`Notification subscription created for client: ${clientId}`);
  }

  unsubscribeClient(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    // Clear bundling interval
    const interval = this.bundleIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.bundleIntervals.delete(clientId);
    }

    websocketService.unsubscribeFromTopic(clientId, 'notifications');
    this.subscriptions.delete(clientId);

    logger.info(`Notification subscription removed for client: ${clientId}`);
  }

  private setupBundling(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription?.deliveryPreferences?.bundleInterval) return;

    const interval = setInterval(() => {
      this.deliverBundledNotifications(clientId);
    }, subscription.deliveryPreferences.bundleInterval);

    this.bundleIntervals.set(clientId, interval);
  }

  private deliverBundledNotifications(clientId: string): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription || subscription.pendingNotifications.length === 0) return;

    const bundle = subscription.pendingNotifications.splice(0, 
      subscription.deliveryPreferences?.maxBundle || 10
    );

    websocketService.sendToClient(clientId, {
      type: 'notification_bundle',
      data: {
        notifications: bundle,
        remaining: subscription.pendingNotifications.length
      }
    });

    subscription.lastDelivery = new Date();
  }

  notify(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const fullNotification: Notification = {
      ...notification,
      id: uuidv4(),
      timestamp: new Date()
    };

    // Add to history
    this.notificationHistory.push(fullNotification);
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift();
    }

    // Apply routing rules
    const channelsToNotify = this.getChannelsForNotification(fullNotification);

    // Deliver to subscribed clients
    this.subscriptions.forEach((subscription, clientId) => {
      if (this.shouldDeliverToClient(fullNotification, subscription, channelsToNotify)) {
        this.deliverNotification(clientId, fullNotification);
      }
    });

    // Emit event for other services
    this.emit('notification', fullNotification);
  }

  private getChannelsForNotification(notification: Notification): Set<string> {
    const channels = new Set<string>();

    // Apply routing rules in priority order
    const sortedRules = Array.from(this.routingRules.values())
      .filter(rule => rule.active)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.condition(notification)) {
        rule.channels.forEach(channelId => channels.add(channelId));
      }
    }

    return channels;
  }

  private shouldDeliverToClient(
    notification: Notification,
    subscription: NotificationSubscription,
    notificationChannels: Set<string>
  ): boolean {
    // Check if client is subscribed to any of the notification's channels
    const hasChannel = Array.from(notificationChannels).some(
      channelId => subscription.channels.has(channelId)
    );

    if (!hasChannel) return false;

    // Apply client filters
    if (subscription.filters) {
      const { types, priorities, categories, sources } = subscription.filters;

      if (types && !types.includes(notification.type)) return false;
      if (priorities && !priorities.includes(notification.priority)) return false;
      if (categories && notification.category && !categories.includes(notification.category)) return false;
      if (sources && !sources.includes(notification.source)) return false;
    }

    // Check quiet hours
    if (subscription.deliveryPreferences?.quietHours) {
      const now = new Date();
      const { start, end } = subscription.deliveryPreferences.quietHours;
      // Simple time comparison (could be enhanced)
      const currentTime = `${now.getHours()}:${now.getMinutes()}`;
      if (currentTime >= start && currentTime <= end) {
        // Only deliver critical notifications during quiet hours
        if (notification.priority !== NotificationPriority.CRITICAL) {
          return false;
        }
      }
    }

    return true;
  }

  private deliverNotification(clientId: string, notification: Notification): void {
    const subscription = this.subscriptions.get(clientId);
    if (!subscription) return;

    // Bundle notifications if configured
    if (subscription.deliveryPreferences?.bundleInterval) {
      subscription.pendingNotifications.push(notification);
      return;
    }

    // Immediate delivery
    websocketService.sendToClient(clientId, {
      type: 'notification',
      data: notification
    });

    subscription.lastDelivery = new Date();
  }

  acknowledgeNotification(clientId: string, notificationId: string): void {
    // Record acknowledgment
    logger.info(`Notification ${notificationId} acknowledged by client ${clientId}`);

    // Emit event for tracking
    this.emit('notification:acknowledged', {
      clientId,
      notificationId,
      timestamp: new Date()
    });
  }

  handleNotificationAction(clientId: string, data: {
    notificationId: string;
    actionId: string;
    actionData?: any;
  }): void {
    const notification = this.notificationHistory.find(n => n.id === data.notificationId);
    if (!notification) return;

    const action = notification.actions?.find(a => a.id === data.actionId);
    if (!action) return;

    // Emit action event
    this.emit('notification:action', {
      clientId,
      notification,
      action,
      data: data.actionData,
      timestamp: new Date()
    });

    // Handle specific actions
    switch (action.action) {
      case 'retry_job':
        eventEmitter.emit('job:retry_request', action.data);
        break;
      case 'view_threat_details':
        // Route to security service
        eventEmitter.emit('security:view_threat', action.data);
        break;
      // Add more action handlers as needed
    }

    // Send confirmation
    websocketService.sendToClient(clientId, {
      type: 'notification_action_result',
      data: {
        notificationId: data.notificationId,
        actionId: data.actionId,
        status: 'success'
      }
    });
  }

  // Get notification history
  getHistory(filters?: {
    limit?: number;
    since?: Date;
    types?: NotificationType[];
    priorities?: NotificationPriority[];
  }): Notification[] {
    let history = [...this.notificationHistory];

    if (filters?.since) {
      history = history.filter(n => n.timestamp >= filters.since!);
    }

    if (filters?.types) {
      history = history.filter(n => filters.types!.includes(n.type));
    }

    if (filters?.priorities) {
      history = history.filter(n => filters.priorities!.includes(n.priority));
    }

    if (filters?.limit) {
      history = history.slice(-filters.limit);
    }

    return history.reverse(); // Most recent first
  }

  // Get statistics
  getStats(): {
    totalNotifications: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
    activeSubscriptions: number;
    activeChannels: number;
  } {
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    this.notificationHistory.forEach((n) => {
      byType[n.type] = (byType[n.type] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });

    return {
      totalNotifications: this.notificationHistory.length,
      byType: byType as Record<NotificationType, number>,
      byPriority: byPriority as Record<NotificationPriority, number>,
      activeSubscriptions: this.subscriptions.size,
      activeChannels: Array.from(this.channels.values()).filter(c => c.active).length
    };
  }

  // Cleanup
  shutdown(): void {
    // Clear all intervals
    this.bundleIntervals.forEach(interval => clearInterval(interval));
    this.bundleIntervals.clear();

    // Clear data
    this.channels.clear();
    this.subscriptions.clear();
    this.routingRules.clear();
    this.notificationHistory = [];

    // Remove event listeners
    this.removeAllListeners();
  }
}

export const notificationChannelsService = new NotificationChannelsService();