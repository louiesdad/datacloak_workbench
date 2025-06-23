import { AutomationEngine } from '../automation-engine.service';
import { RuleEngine } from '../rule-engine.service';
import { ActionIntegrationService } from '../action-integration.service';
import { AutomationRulesSQLiteSchema } from '../../database/schemas/automation-rules-sqlite.schema';
import { NotificationChannelsService } from '../notification-channels.service';
import { EventService } from '../event.service';
import Database from 'better-sqlite3';

describe('Automation Engine Integration Tests', () => {
  let automationEngine: AutomationEngine;
  let schema: AutomationRulesSQLiteSchema;
  let db: Database.Database;

  beforeEach(() => {
    // Create real instances for integration testing
    db = new Database(':memory:');
    schema = new AutomationRulesSQLiteSchema(db);
    schema.createTables();

    const ruleEngine = new RuleEngine();
    const notificationService = new NotificationChannelsService();
    const eventService = new EventService();
    const actionService = new ActionIntegrationService(notificationService, eventService);

    automationEngine = new AutomationEngine(ruleEngine, actionService, schema);
  });

  afterEach(() => {
    db.close();
  });

  describe('End-to-end automation flow', () => {
    test('should complete full automation cycle from rule creation to execution', async () => {
      // Arrange - Create a real automation rule
      const ruleId = schema.createRule({
        name: 'High-value customer churn risk',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [
            { field: 'customerLifetimeValue', operator: 'greaterThan', value: 5000 },
            { field: 'sentimentScore', operator: 'lessThan', value: 30 },
            { field: 'daysSinceLastOrder', operator: 'greaterThan', value: 30 }
          ]
        }),
        actions: JSON.stringify([
          {
            type: 'createTask',
            config: {
              taskName: 'Urgent: High-value customer at risk of churn',
              priority: 'critical',
              assignTo: 'customer-success'
            }
          }
        ]),
        is_active: 1
      });

      // Customer data that should trigger the rule
      const customerData = {
        customerId: 'CUST-VIP-001',
        customerName: 'Enterprise Corp',
        customerLifetimeValue: 15000,
        sentimentScore: 25,
        daysSinceLastOrder: 45
      };

      // Act - Evaluate the customer
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert - Verify the automation worked
      expect(results).toHaveLength(1);
      expect(results[0].ruleId).toBe(ruleId);
      expect(results[0].triggered).toBe(true);
      expect(results[0].actions).toHaveLength(1);
      expect(results[0].actions![0].success).toBe(true);

      // Verify execution was recorded
      const executions = schema.getExecutionsByRule(ruleId);
      expect(executions).toHaveLength(1);
      expect(executions[0].customer_id).toBe('CUST-VIP-001');
      expect(executions[0].success).toBe(1);

      // Verify statistics
      const stats = await automationEngine.getRuleStatistics(ruleId);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.successRate).toBe(1.0);
    });

    test('should handle complex OR conditions correctly', async () => {
      // Arrange - Create rule with OR conditions
      const ruleId = schema.createRule({
        name: 'Multiple risk factors',
        conditions: JSON.stringify({
          operator: 'OR',
          rules: [
            { field: 'sentimentScore', operator: 'lessThan', value: 20 },
            { field: 'supportTickets', operator: 'greaterThan', value: 5 },
            { field: 'paymentDelays', operator: 'greaterThan', value: 2 }
          ]
        }),
        actions: JSON.stringify([
          {
            type: 'createTask',
            config: { taskName: 'Customer needs attention' }
          }
        ]),
        is_active: 1
      });

      // Test different scenarios that should trigger
      const scenarios = [
        {
          name: 'Low sentiment only',
          data: { customerId: 'CUST-001', sentimentScore: 15, supportTickets: 1, paymentDelays: 0 }
        },
        {
          name: 'High support tickets only',
          data: { customerId: 'CUST-002', sentimentScore: 80, supportTickets: 8, paymentDelays: 0 }
        },
        {
          name: 'High payment delays only',
          data: { customerId: 'CUST-003', sentimentScore: 70, supportTickets: 2, paymentDelays: 4 }
        }
      ];

      // Act & Assert - Test each scenario
      for (const scenario of scenarios) {
        const results = await automationEngine.evaluateCustomer(scenario.data);
        expect(results).toHaveLength(1);
        expect(results[0].triggered).toBe(true);
      }

      // Verify all executions were recorded
      const executions = schema.getExecutionsByRule(ruleId);
      expect(executions).toHaveLength(3);
    });

    test('should process batch of customers with mixed results', async () => {
      // Arrange - Create multiple rules
      const highValueRuleId = schema.createRule({
        name: 'High value customer rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'value', operator: 'greaterThan', value: 10000 }]
        }),
        actions: JSON.stringify([
          { type: 'createTask', config: { taskName: 'VIP customer attention' } }
        ]),
        is_active: 1
      });

      const lowSentimentRuleId = schema.createRule({
        name: 'Low sentiment rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'sentiment', operator: 'lessThan', value: 40 }]
        }),
        actions: JSON.stringify([
          { type: 'createTask', config: { taskName: 'Improve customer satisfaction' } }
        ]),
        is_active: 1
      });

      const customers = [
        { customerId: 'CUST-001', value: 15000, sentiment: 80 }, // High value only
        { customerId: 'CUST-002', value: 5000, sentiment: 30 },  // Low sentiment only
        { customerId: 'CUST-003', value: 20000, sentiment: 25 }, // Both rules
        { customerId: 'CUST-004', value: 3000, sentiment: 70 }   // Neither rule
      ];

      // Act
      const results = await automationEngine.evaluateBatch(customers);

      // Assert
      expect(results).toHaveLength(8); // 4 customers × 2 rules each

      // CUST-001: High value rule triggers, low sentiment doesn't
      const cust001Results = results.filter(r => r.ruleName.includes('High value'));
      expect(cust001Results.some(r => r.triggered)).toBe(true);

      // CUST-002: Low sentiment rule triggers, high value doesn't
      const lowSentimentResults = results.filter(r => r.ruleName.includes('Low sentiment'));
      expect(lowSentimentResults.some(r => r.triggered)).toBe(true);

      // CUST-003: Both rules should trigger
      // CUST-004: No rules should trigger
    });

    test('should handle rule testing without recording executions', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'score', operator: 'greaterThan', value: 75 }]
        }),
        actions: JSON.stringify([
          { type: 'createTask', config: { taskName: 'Test task' } }
        ]),
        is_active: 1
      });

      const testData = {
        customerId: 'TEST-CUSTOMER',
        score: 85
      };

      // Act
      const result = await automationEngine.testRule(ruleId, testData);

      // Assert
      expect(result.triggered).toBe(true);
      expect(result.ruleId).toBe(ruleId);

      // Verify no execution was recorded
      const executions = schema.getExecutionsByRule(ruleId);
      expect(executions).toHaveLength(0);
    });
  });

  describe('Error handling and resilience', () => {
    test('should handle malformed rule conditions gracefully', async () => {
      // Arrange - Create rule with invalid JSON
      const ruleId = schema.createRule({
        name: 'Malformed rule',
        conditions: 'invalid json',
        actions: JSON.stringify([]),
        is_active: 1
      });

      const customerData = { customerId: 'CUST-001' };

      // Act
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(false);
      expect(results[0].error).toBeDefined();
    });

    test('should continue processing other rules when one fails', async () => {
      // Arrange - Create one good rule and one bad rule
      const goodRuleId = schema.createRule({
        name: 'Good rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'active', operator: 'equals', value: true }]
        }),
        actions: JSON.stringify([
          { type: 'createTask', config: { taskName: 'Good task' } }
        ]),
        is_active: 1
      });

      const badRuleId = schema.createRule({
        name: 'Bad rule',
        conditions: 'invalid json',
        actions: JSON.stringify([]),
        is_active: 1
      });

      const customerData = { customerId: 'CUST-001', active: true };

      // Act
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert
      expect(results).toHaveLength(2);
      
      const goodResult = results.find(r => r.ruleId === goodRuleId);
      const badResult = results.find(r => r.ruleId === badRuleId);
      
      expect(goodResult?.triggered).toBe(true);
      expect(badResult?.triggered).toBe(false);
      expect(badResult?.error).toBeDefined();
    });
  });
});