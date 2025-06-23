import { ActionIntegrationService } from '../action-integration.service';
import { NotificationChannelsService } from '../notification-channels.service';
import { EventService } from '../event.service';

// Mock the dependencies
jest.mock('../notification-channels.service');
jest.mock('../event.service');

describe('Action Integration Service', () => {
  let actionService: ActionIntegrationService;
  let mockNotificationService: jest.Mocked<NotificationChannelsService>;
  let mockEventService: jest.Mocked<EventService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockNotificationService = new NotificationChannelsService() as jest.Mocked<NotificationChannelsService>;
    mockEventService = new EventService() as jest.Mocked<EventService>;
    
    // Add mock methods
    mockNotificationService.sendEmail = jest.fn();
    mockNotificationService.sendSlack = jest.fn();
    mockEventService.emit = jest.fn();
    
    // Create action service with mocked dependencies
    actionService = new ActionIntegrationService(
      mockNotificationService,
      mockEventService
    );
  });

  describe('Email actions', () => {
    test('should send email notification', async () => {
      // Arrange
      const action = {
        type: 'email',
        config: {
          to: 'manager@company.com',
          subject: 'High-value customer at risk',
          template: 'customer-at-risk'
        }
      };
      
      const context = {
        customerId: 'CUST-12345',
        customerName: 'Acme Corp',
        sentimentScore: 35,
        lifetimeValue: 15000
      };

      mockNotificationService.sendEmail.mockResolvedValue({ success: true });

      // Act
      const result = await actionService.executeAction(action, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNotificationService.sendEmail).toHaveBeenCalledWith({
        to: 'manager@company.com',
        subject: 'High-value customer at risk',
        body: expect.stringContaining('Acme Corp'),
        data: context
      });
    });

    test('should handle email failure gracefully', async () => {
      // Arrange
      const action = {
        type: 'email',
        config: { to: 'invalid-email' }
      };

      mockNotificationService.sendEmail.mockRejectedValue(new Error('Invalid email'));

      // Act
      const result = await actionService.executeAction(action, {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });
  });

  describe('CRM task actions', () => {
    test('should create CRM task', async () => {
      // Arrange
      const action = {
        type: 'createTask',
        config: {
          taskName: 'Follow up with high-value customer',
          priority: 'high',
          assignTo: 'sales-team'
        }
      };
      
      const context = {
        customerId: 'CUST-12345',
        customerName: 'Acme Corp'
      };

      // Act
      const result = await actionService.executeAction(action, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(mockEventService.emit).toHaveBeenCalledWith('automation.taskCreated', {
        taskId: expect.any(String),
        customerId: 'CUST-12345',
        taskName: 'Follow up with high-value customer',
        priority: 'high',
        assignTo: 'sales-team',
        context: {
          customerId: 'CUST-12345',
          customerName: 'Acme Corp'
        }
      });
    });
  });

  describe('Slack notifications', () => {
    test('should send Slack message', async () => {
      // Arrange
      const action = {
        type: 'slack',
        config: {
          channel: '#customer-success',
          message: 'Customer {{customerName}} needs attention'
        }
      };
      
      const context = {
        customerName: 'Acme Corp'
      };

      mockNotificationService.sendSlack.mockResolvedValue({ success: true });

      // Act
      const result = await actionService.executeAction(action, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNotificationService.sendSlack).toHaveBeenCalledWith({
        channel: '#customer-success',
        message: 'Customer Acme Corp needs attention'
      });
    });
  });

  describe('Webhook actions', () => {
    test('should call webhook endpoint', async () => {
      // Arrange
      const action = {
        type: 'webhook',
        config: {
          url: 'https://api.example.com/webhooks/customer-alert',
          method: 'POST',
          headers: {
            'Authorization': 'Bearer secret-token'
          }
        }
      };
      
      const context = {
        customerId: 'CUST-12345',
        alert: 'sentiment-drop'
      };

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ received: true })
      });

      // Act
      const result = await actionService.executeAction(action, context);

      // Assert
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/webhooks/customer-alert',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer secret-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(context),
          signal: expect.any(AbortSignal)
        })
      );
    });

    test('should handle webhook timeout', async () => {
      // Arrange
      const action = {
        type: 'webhook',
        config: {
          url: 'https://api.example.com/slow-endpoint',
          timeout: 1000 // 1 second
        }
      };

      // Mock slow fetch
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 2000)
        )
      );

      // Act
      const result = await actionService.executeAction(action, {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Batch actions', () => {
    test('should execute multiple actions in sequence', async () => {
      // Arrange
      const actions = [
        {
          type: 'email',
          config: { to: 'manager@company.com' }
        },
        {
          type: 'createTask',
          config: { taskName: 'Follow up' }
        },
        {
          type: 'slack',
          config: { channel: '#alerts', message: 'Alert' }
        }
      ];

      // Mock all action responses
      mockNotificationService.sendEmail.mockResolvedValue({ success: true });
      mockNotificationService.sendSlack.mockResolvedValue({ success: true });
      mockEventService.emit.mockReturnValue(undefined);

      // Act
      const results = await actionService.executeBatch(actions, {});

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true); // email
      expect(results[1].success).toBe(true); // createTask
      expect(results[2].success).toBe(true); // slack
      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.sendSlack).toHaveBeenCalledTimes(1);
    });

    test('should continue batch execution on individual failures', async () => {
      // Arrange
      const actions = [
        {
          type: 'email',
          config: { to: 'invalid-email' }
        },
        {
          type: 'slack',
          config: { channel: '#alerts', message: 'Alert' }
        }
      ];

      mockNotificationService.sendEmail.mockRejectedValue(new Error('Invalid email'));
      mockNotificationService.sendSlack.mockResolvedValue({ success: true });

      // Act
      const results = await actionService.executeBatch(actions, {});

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
      expect(mockNotificationService.sendSlack).toHaveBeenCalled();
    });
  });

  describe('Template interpolation', () => {
    test('should interpolate variables in messages', () => {
      // Arrange
      const template = 'Hello {{customerName}}, your score is {{score}}%';
      const context = {
        customerName: 'Acme Corp',
        score: 85
      };

      // Act
      const result = actionService.interpolateTemplate(template, context);

      // Assert
      expect(result).toBe('Hello Acme Corp, your score is 85%');
    });

    test('should handle missing variables gracefully', () => {
      // Arrange
      const template = 'Customer {{customerName}} from {{city}}';
      const context = {
        customerName: 'Acme Corp'
        // city is missing
      };

      // Act
      const result = actionService.interpolateTemplate(template, context);

      // Assert
      expect(result).toBe('Customer Acme Corp from {{city}}');
    });
  });
});