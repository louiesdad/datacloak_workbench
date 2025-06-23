import { NotificationChannelsService } from './notification-channels.service';
import { EventService } from './event.service';
import { v4 as uuidv4 } from 'uuid';

export interface ActionConfig {
  type: string;
  config: any;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  taskId?: string;
  response?: any;
}

export interface EmailConfig {
  to: string;
  subject?: string;
  template?: string;
}

export interface TaskConfig {
  taskName: string;
  priority?: string;
  assignTo?: string;
}

export interface SlackConfig {
  channel: string;
  message: string;
}

export interface WebhookConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class ActionIntegrationService {
  constructor(
    private notificationService: NotificationChannelsService,
    private eventService: EventService
  ) {}

  async executeAction(action: ActionConfig, context: any): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'email':
          return await this.executeEmailAction(action.config, context);
        
        case 'createTask':
          return await this.executeTaskAction(action.config, context);
        
        case 'slack':
          return await this.executeSlackAction(action.config, context);
        
        case 'webhook':
          return await this.executeWebhookAction(action.config, context);
        
        default:
          return {
            success: false,
            error: `Unknown action type: ${action.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async executeBatch(actions: ActionConfig[], context: any): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    for (const action of actions) {
      const result = await this.executeAction(action, context);
      results.push(result);
    }
    
    return results;
  }

  private async executeEmailAction(config: EmailConfig, context: any): Promise<ActionResult> {
    try {
      // Build email body from template or default
      const body = this.buildEmailBody(config, context);
      
      const result = await this.notificationService.sendEmail({
        to: config.to,
        subject: config.subject || 'Automation Alert',
        body,
        data: context
      });
      
      return {
        success: result.success,
        response: result
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeTaskAction(config: TaskConfig, context: any): Promise<ActionResult> {
    const taskId = uuidv4();
    
    // Emit event for task creation
    this.eventService.emit('automation.taskCreated', {
      taskId,
      customerId: context.customerId,
      taskName: config.taskName,
      priority: config.priority || 'medium',
      assignTo: config.assignTo,
      context
    });
    
    return {
      success: true,
      taskId
    };
  }

  private async executeSlackAction(config: SlackConfig, context: any): Promise<ActionResult> {
    try {
      // Interpolate message with context
      const message = this.interpolateTemplate(config.message, context);
      
      const result = await this.notificationService.sendSlack({
        channel: config.channel,
        message
      });
      
      return {
        success: result.success,
        response: result
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeWebhookAction(config: WebhookConfig, context: any): Promise<ActionResult> {
    try {
      const controller = new AbortController();
      const timeout = config.timeout || 30000; // Default 30 seconds
      
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(context),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        response: data
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private buildEmailBody(config: EmailConfig, context: any): string {
    if (config.template === 'customer-at-risk') {
      return `
        Customer Alert: ${context.customerName || context.customerId}
        
        Sentiment Score: ${context.sentimentScore}%
        Lifetime Value: $${context.lifetimeValue}
        
        This customer requires immediate attention based on automation rules.
      `;
    }
    
    // Default template
    return `Automation alert triggered for customer ${context.customerId}`;
  }

  interpolateTemplate(template: string, context: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }
}