import { NotificationChannelsService } from '../notification-channels.service';
import { WebSocketService } from '../websocket.service';
import { EventService } from '../event.service';
import { ConfigService } from '../config.service';
import { CacheService } from '../cache.service';
import { SecurityService } from '../security.service';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('../websocket.service');
jest.mock('../event.service');
jest.mock('../config.service');
jest.mock('../cache.service');
jest.mock('../security.service');

describe('NotificationChannelsService', () => {
  let notificationChannelsService: NotificationChannelsService;
  let mockWebSocketService: jest.Mocked<WebSocketService>;
  let mockEventService: jest.Mocked<EventService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockEventEmitter: EventEmitter;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockWebSocketService = new WebSocketService() as jest.Mocked<WebSocketService>;
    mockEventService = new EventService() as jest.Mocked<EventService>;
    mockConfigService = new ConfigService() as jest.Mocked<ConfigService>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;
    mockSecurityService = new SecurityService() as jest.Mocked<SecurityService>;
    mockEventEmitter = new EventEmitter();

    // Mock config service
    mockConfigService.get = jest.fn().mockImplementation((key: string) => {
      const config: any = {
        'notifications.channels.maxPerUser': 10,
        'notifications.channels.defaultPriority': 'medium',
        'notifications.channels.retryAttempts': 3,
        'notifications.channels.retryDelay': 1000,
        'notifications.channels.batchSize': 100,
        'notifications.channels.bundleInterval': 5000
      };
      return config[key];
    });

    // Mock WebSocket service
    mockWebSocketService.broadcast = jest.fn();
    mockWebSocketService.sendToUser = jest.fn();
    mockWebSocketService.sendToChannel = jest.fn();
    mockWebSocketService.isConnected = jest.fn().mockReturnValue(true);

    // Mock event service
    mockEventService.on = jest.fn((event, handler) => {
      mockEventEmitter.on(event, handler);
    });
    mockEventService.emit = jest.fn((event, data) => {
      mockEventEmitter.emit(event, data);
    });

    // Create service instance
    notificationChannelsService = new NotificationChannelsService(
      mockWebSocketService,
      mockEventService,
      mockConfigService,
      mockCacheService,
      mockSecurityService
    );
  });

  describe('Channel Management', () => {
    it('should create a new notification channel', async () => {
      const channelConfig = {
        id: 'channel-123',
        name: 'High Priority Alerts',
        type: 'alerts',
        userId: 'user-123',
        filters: {
          priority: ['high', 'critical'],
          types: ['risk_alert', 'sentiment_warning']
        },
        destinations: ['websocket', 'email'],
        settings: {
          bundling: true,
          bundleInterval: 5000,
          maxBundleSize: 50
        }
      };

      mockCacheService.get = jest.fn().mockResolvedValue(null);
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      const result = await notificationChannelsService.createChannel(channelConfig);

      expect(result).toMatchObject({
        success: true,
        channel: expect.objectContaining({
          id: 'channel-123',
          name: 'High Priority Alerts',
          active: true,
          createdAt: expect.any(Date)
        })
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `notification:channel:${channelConfig.id}`,
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should update an existing channel', async () => {
      const channelId = 'channel-123';
      const updates = {
        name: 'Updated Channel Name',
        filters: {
          priority: ['high'],
          types: ['risk_alert']
        }
      };

      const existingChannel = {
        id: channelId,
        name: 'Old Name',
        userId: 'user-123',
        filters: { priority: ['low'] },
        active: true
      };

      mockCacheService.get = jest.fn().mockResolvedValue(existingChannel);
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      const result = await notificationChannelsService.updateChannel(channelId, updates);

      expect(result).toMatchObject({
        success: true,
        channel: expect.objectContaining({
          id: channelId,
          name: 'Updated Channel Name',
          filters: updates.filters
        })
      });
    });

    it('should delete a channel', async () => {
      const channelId = 'channel-123';
      
      mockCacheService.get = jest.fn().mockResolvedValue({ id: channelId });
      mockCacheService.delete = jest.fn().mockResolvedValue(true);

      const result = await notificationChannelsService.deleteChannel(channelId);

      expect(result).toMatchObject({
        success: true,
        channelId
      });

      expect(mockCacheService.delete).toHaveBeenCalledWith(`notification:channel:${channelId}`);
    });

    it('should list all channels for a user', async () => {
      const userId = 'user-123';
      const mockChannels = [
        { id: 'channel-1', userId, name: 'Channel 1' },
        { id: 'channel-2', userId, name: 'Channel 2' }
      ];

      mockCacheService.scan = jest.fn().mockResolvedValue(
        mockChannels.map(c => ({ key: `notification:channel:${c.id}`, value: c }))
      );

      const result = await notificationChannelsService.listUserChannels(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'channel-1', name: 'Channel 1' });
    });
  });

  describe('Notification Filtering and Routing', () => {
    it('should route notifications to appropriate channels', async () => {
      const notification = {
        id: 'notif-123',
        type: 'risk_alert',
        priority: 'high',
        title: 'High Risk Detected',
        message: 'Risk threshold exceeded',
        data: { riskScore: 0.85 },
        timestamp: new Date()
      };

      const mockChannels = [
        {
          id: 'channel-1',
          userId: 'user-123',
          filters: { priority: ['high'], types: ['risk_alert'] },
          destinations: ['websocket']
        },
        {
          id: 'channel-2',
          userId: 'user-456',
          filters: { priority: ['low'], types: ['info'] },
          destinations: ['websocket']
        }
      ];

      mockCacheService.scan = jest.fn().mockResolvedValue(
        mockChannels.map(c => ({ key: `notification:channel:${c.id}`, value: c }))
      );

      await notificationChannelsService.routeNotification(notification);

      // Should only send to channel-1 as it matches the filters
      expect(mockWebSocketService.sendToChannel).toHaveBeenCalledWith(
        'channel-1',
        expect.objectContaining({
          type: 'notification',
          notification: expect.objectContaining({
            id: 'notif-123',
            type: 'risk_alert'
          })
        })
      );

      expect(mockWebSocketService.sendToChannel).toHaveBeenCalledTimes(1);
    });

    it('should apply complex filter rules', async () => {
      const channel = {
        id: 'channel-complex',
        userId: 'user-123',
        filters: {
          priority: ['high', 'critical'],
          types: ['risk_alert', 'sentiment_warning'],
          conditions: [
            { field: 'data.riskScore', operator: '>', value: 0.7 },
            { field: 'data.sentimentScore', operator: '<', value: -0.5 }
          ]
        }
      };

      const notification1 = {
        type: 'risk_alert',
        priority: 'high',
        data: { riskScore: 0.8 }
      };

      const notification2 = {
        type: 'risk_alert',
        priority: 'high',
        data: { riskScore: 0.6 }
      };

      const result1 = await notificationChannelsService.matchesFilters(notification1, channel.filters);
      const result2 = await notificationChannelsService.matchesFilters(notification2, channel.filters);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle filter exceptions and edge cases', async () => {
      const channel = {
        filters: {
          priority: ['high'],
          types: ['*'], // Wildcard
          exclude: {
            sources: ['test-system']
          }
        }
      };

      const notification1 = {
        type: 'any_type',
        priority: 'high',
        source: 'production-system'
      };

      const notification2 = {
        type: 'any_type',
        priority: 'high',
        source: 'test-system'
      };

      const result1 = await notificationChannelsService.matchesFilters(notification1, channel.filters);
      const result2 = await notificationChannelsService.matchesFilters(notification2, channel.filters);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('Bundle Delivery', () => {
    it('should bundle notifications for delivery', async () => {
      const channel = {
        id: 'channel-bundle',
        userId: 'user-123',
        settings: {
          bundling: true,
          bundleInterval: 1000,
          maxBundleSize: 5
        }
      };

      mockCacheService.get = jest.fn().mockResolvedValue(channel);

      // Add multiple notifications
      const notifications = Array(3).fill(null).map((_, i) => ({
        id: `notif-${i}`,
        type: 'info',
        priority: 'medium',
        message: `Notification ${i}`
      }));

      for (const notification of notifications) {
        await notificationChannelsService.addToBundle(channel.id, notification);
      }

      // Wait for bundle interval
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Check that bundle was delivered
      expect(mockWebSocketService.sendToChannel).toHaveBeenCalledWith(
        channel.id,
        expect.objectContaining({
          type: 'notification_bundle',
          notifications: expect.arrayContaining([
            expect.objectContaining({ id: 'notif-0' }),
            expect.objectContaining({ id: 'notif-1' }),
            expect.objectContaining({ id: 'notif-2' })
          ])
        })
      );
    });

    it('should flush bundle when max size is reached', async () => {
      const channel = {
        id: 'channel-maxsize',
        userId: 'user-123',
        settings: {
          bundling: true,
          bundleInterval: 10000, // Long interval
          maxBundleSize: 3
        }
      };

      mockCacheService.get = jest.fn().mockResolvedValue(channel);

      // Add notifications up to max size
      const notifications = Array(3).fill(null).map((_, i) => ({
        id: `notif-${i}`,
        type: 'info',
        priority: 'medium',
        message: `Notification ${i}`
      }));

      for (const notification of notifications) {
        await notificationChannelsService.addToBundle(channel.id, notification);
      }

      // Should flush immediately when max size is reached
      expect(mockWebSocketService.sendToChannel).toHaveBeenCalledWith(
        channel.id,
        expect.objectContaining({
          type: 'notification_bundle',
          notifications: expect.arrayContaining(notifications)
        })
      );
    });

    it('should handle bundle delivery failures with retry', async () => {
      const channel = {
        id: 'channel-retry',
        userId: 'user-123',
        settings: {
          bundling: true,
          retryOnFailure: true
        }
      };

      mockCacheService.get = jest.fn().mockResolvedValue(channel);
      mockWebSocketService.sendToChannel = jest.fn()
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ success: true });

      const notification = {
        id: 'notif-retry',
        type: 'alert',
        message: 'Test notification'
      };

      await notificationChannelsService.deliverWithRetry(channel.id, notification);

      expect(mockWebSocketService.sendToChannel).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebSocket Message Handling', () => {
    it('should handle WebSocket connection events', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-123';

      // Simulate connection
      await notificationChannelsService.handleConnection(userId, connectionId);

      // Check pending notifications were sent
      const pendingNotifications = [
        { id: 'pending-1', message: 'Pending notification 1' },
        { id: 'pending-2', message: 'Pending notification 2' }
      ];

      mockCacheService.get = jest.fn().mockResolvedValue(pendingNotifications);
      mockCacheService.delete = jest.fn().mockResolvedValue(true);

      await notificationChannelsService.sendPendingNotifications(userId);

      expect(mockWebSocketService.sendToUser).toHaveBeenCalledTimes(2);
      expect(mockCacheService.delete).toHaveBeenCalledWith(`pending:notifications:${userId}`);
    });

    it('should handle WebSocket disconnection events', async () => {
      const userId = 'user-123';
      const connectionId = 'conn-123';

      // Simulate disconnection
      await notificationChannelsService.handleDisconnection(userId, connectionId);

      // Future notifications should be queued
      const notification = {
        id: 'offline-notif',
        type: 'info',
        message: 'User is offline'
      };

      mockWebSocketService.isConnected = jest.fn().mockReturnValue(false);
      mockCacheService.get = jest.fn().mockResolvedValue([]);
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      await notificationChannelsService.queueOfflineNotification(userId, notification);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `pending:notifications:${userId}`,
        expect.arrayContaining([notification]),
        expect.any(Number)
      );
    });

    it('should handle channel subscription via WebSocket', async () => {
      const message = {
        type: 'subscribe',
        channelId: 'channel-123',
        userId: 'user-123'
      };

      const channel = {
        id: 'channel-123',
        userId: 'user-123',
        active: true
      };

      mockCacheService.get = jest.fn().mockResolvedValue(channel);
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      await notificationChannelsService.handleWebSocketMessage(message);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `subscription:${message.userId}:${message.channelId}`,
        expect.any(Object),
        expect.any(Number)
      );

      expect(mockWebSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        expect.objectContaining({
          type: 'subscription_confirmed',
          channelId: message.channelId
        })
      );
    });

    it('should handle channel unsubscription via WebSocket', async () => {
      const message = {
        type: 'unsubscribe',
        channelId: 'channel-123',
        userId: 'user-123'
      };

      mockCacheService.delete = jest.fn().mockResolvedValue(true);

      await notificationChannelsService.handleWebSocketMessage(message);

      expect(mockCacheService.delete).toHaveBeenCalledWith(
        `subscription:${message.userId}:${message.channelId}`
      );

      expect(mockWebSocketService.sendToUser).toHaveBeenCalledWith(
        message.userId,
        expect.objectContaining({
          type: 'unsubscription_confirmed',
          channelId: message.channelId
        })
      );
    });

    it('should broadcast to channel subscribers', async () => {
      const channelId = 'channel-broadcast';
      const notification = {
        id: 'broadcast-notif',
        type: 'announcement',
        message: 'System announcement'
      };

      const subscribers = [
        { userId: 'user-1', subscriptionId: 'sub-1' },
        { userId: 'user-2', subscriptionId: 'sub-2' },
        { userId: 'user-3', subscriptionId: 'sub-3' }
      ];

      mockCacheService.scan = jest.fn().mockResolvedValue(
        subscribers.map(s => ({
          key: `subscription:${s.userId}:${channelId}`,
          value: s
        }))
      );

      await notificationChannelsService.broadcastToChannel(channelId, notification);

      expect(mockWebSocketService.sendToUser).toHaveBeenCalledTimes(3);
      subscribers.forEach(subscriber => {
        expect(mockWebSocketService.sendToUser).toHaveBeenCalledWith(
          subscriber.userId,
          expect.objectContaining({
            type: 'channel_notification',
            channelId,
            notification
          })
        );
      });
    });
  });

  describe('Priority and Rate Limiting', () => {
    it('should prioritize high priority notifications', async () => {
      const notifications = [
        { id: '1', priority: 'low', timestamp: new Date() },
        { id: '2', priority: 'high', timestamp: new Date() },
        { id: '3', priority: 'medium', timestamp: new Date() },
        { id: '4', priority: 'critical', timestamp: new Date() }
      ];

      const sorted = await notificationChannelsService.sortByPriority(notifications);

      expect(sorted[0].id).toBe('4'); // critical
      expect(sorted[1].id).toBe('2'); // high
      expect(sorted[2].id).toBe('3'); // medium
      expect(sorted[3].id).toBe('1'); // low
    });

    it('should apply rate limiting per channel', async () => {
      const channelId = 'channel-ratelimit';
      const userId = 'user-123';

      // Configure rate limit
      mockConfigService.get = jest.fn().mockReturnValue(5); // 5 messages per minute

      // Send notifications up to limit
      for (let i = 0; i < 5; i++) {
        const result = await notificationChannelsService.checkRateLimit(channelId, userId);
        expect(result.allowed).toBe(true);
      }

      // Next notification should be rate limited
      const result = await notificationChannelsService.checkRateLimit(channelId, userId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle channel creation errors', async () => {
      mockCacheService.set = jest.fn().mockRejectedValue(new Error('Cache error'));

      const channelConfig = {
        id: 'channel-error',
        name: 'Error Channel',
        userId: 'user-123'
      };

      await expect(notificationChannelsService.createChannel(channelConfig))
        .rejects.toThrow('Failed to create notification channel');
    });

    it('should handle notification routing errors gracefully', async () => {
      const notification = {
        id: 'error-notif',
        type: 'alert',
        priority: 'high'
      };

      mockCacheService.scan = jest.fn().mockRejectedValue(new Error('Scan error'));

      // Should not throw, but log error
      await expect(notificationChannelsService.routeNotification(notification))
        .resolves.not.toThrow();
    });

    it('should recover from WebSocket failures', async () => {
      mockWebSocketService.sendToChannel = jest.fn()
        .mockRejectedValue(new Error('WebSocket error'));

      const channelId = 'channel-ws-error';
      const notification = {
        id: 'ws-error-notif',
        type: 'info'
      };

      // Should fallback to offline queue
      mockCacheService.set = jest.fn().mockResolvedValue(true);

      await notificationChannelsService.deliverNotification(channelId, notification);

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track notification metrics', async () => {
      const channelId = 'channel-metrics';
      
      await notificationChannelsService.recordMetric(channelId, 'delivered', 1);
      await notificationChannelsService.recordMetric(channelId, 'failed', 1);
      await notificationChannelsService.recordMetric(channelId, 'bundled', 3);

      const metrics = await notificationChannelsService.getChannelMetrics(channelId);

      expect(metrics).toMatchObject({
        delivered: 1,
        failed: 1,
        bundled: 3,
        deliveryRate: 0.5
      });
    });

    it('should emit events for monitoring', async () => {
      const eventHandler = jest.fn();
      mockEventEmitter.on('notification:delivered', eventHandler);

      const notification = {
        id: 'event-notif',
        type: 'info'
      };

      await notificationChannelsService.emitDeliveryEvent('channel-123', notification, 'delivered');

      expect(eventHandler).toHaveBeenCalledWith({
        channelId: 'channel-123',
        notification,
        status: 'delivered',
        timestamp: expect.any(Date)
      });
    });
  });
});