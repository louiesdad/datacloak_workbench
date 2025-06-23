import { AutomationEngine } from '../automation-engine.service';
import { RuleEngine } from '../rule-engine.service';
import { ActionIntegrationService } from '../action-integration.service';
import { AutomationRulesSQLiteSchema } from '../../database/schemas/automation-rules-sqlite.schema';
import Database from 'better-sqlite3';

// Mock the dependencies
jest.mock('../rule-engine.service');
jest.mock('../action-integration.service');

describe('Automation Engine', () => {
  let automationEngine: AutomationEngine;
  let mockRuleEngine: jest.Mocked<RuleEngine>;
  let mockActionService: jest.Mocked<ActionIntegrationService>;
  let schema: AutomationRulesSQLiteSchema;
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory test database
    db = new Database(':memory:');
    schema = new AutomationRulesSQLiteSchema(db);
    schema.createTables();

    // Create mock instances
    mockRuleEngine = new RuleEngine() as jest.Mocked<RuleEngine>;
    mockActionService = new ActionIntegrationService(null as any, null as any) as jest.Mocked<ActionIntegrationService>;

    // Set up mock methods
    mockRuleEngine.evaluate = jest.fn();
    mockActionService.executeBatch = jest.fn();

    // Create automation engine
    automationEngine = new AutomationEngine(
      mockRuleEngine,
      mockActionService,
      schema
    );
  });

  afterEach(() => {
    db.close();
  });

  describe('Rule evaluation', () => {
    test('should evaluate customer data against active rules', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'High-value customer at risk',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [
            { field: 'customerLifetimeValue', operator: 'greaterThan', value: 1000 },
            { field: 'sentimentScore', operator: 'lessThan', value: 40 }
          ]
        }),
        actions: JSON.stringify([
          { type: 'email', config: { to: 'manager@company.com' } }
        ]),
        is_active: 1
      });

      const customerData = {
        customerId: 'CUST-12345',
        customerLifetimeValue: 1500,
        sentimentScore: 35
      };

      mockRuleEngine.evaluate.mockReturnValue(true);
      mockActionService.executeBatch.mockResolvedValue([{ success: true }]);

      // Act
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].ruleId).toBe(ruleId);
      expect(results[0].triggered).toBe(true);
      expect(mockRuleEngine.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: expect.any(Object)
        }),
        customerData
      );
    });

    test('should not trigger actions when conditions not met', async () => {
      // Arrange
      schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'score', operator: 'greaterThan', value: 80 }]
        }),
        actions: JSON.stringify([
          { type: 'email', config: { to: 'test@example.com' } }
        ]),
        is_active: 1
      });

      const customerData = {
        customerId: 'CUST-12345',
        score: 60 // Doesn't meet condition
      };

      mockRuleEngine.evaluate.mockReturnValue(false);

      // Act
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(false);
      expect(mockActionService.executeBatch).not.toHaveBeenCalled();
    });

    test('should skip inactive rules', async () => {
      // Arrange
      schema.createRule({
        name: 'Inactive rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'score', operator: 'greaterThan', value: 50 }]
        }),
        actions: JSON.stringify([
          { type: 'email', config: { to: 'test@example.com' } }
        ]),
        is_active: 0 // Inactive
      });

      const customerData = {
        customerId: 'CUST-12345',
        score: 80
      };

      // Act
      const results = await automationEngine.evaluateCustomer(customerData);

      // Assert
      expect(results).toHaveLength(0);
      expect(mockRuleEngine.evaluate).not.toHaveBeenCalled();
      expect(mockActionService.executeBatch).not.toHaveBeenCalled();
    });
  });

  describe('Execution tracking', () => {
    test('should record successful execution', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({ operator: 'AND', rules: [] }),
        actions: JSON.stringify([{ type: 'email', config: {} }]),
        is_active: 1
      });

      const customerData = { customerId: 'CUST-12345' };

      mockRuleEngine.evaluate.mockReturnValue(true);
      mockActionService.executeBatch.mockResolvedValue([{ success: true }]);

      // Act
      await automationEngine.evaluateCustomer(customerData);

      // Assert
      const executions = schema.getExecutionsByRule(ruleId);
      expect(executions).toHaveLength(1);
      expect(executions[0].customer_id).toBe('CUST-12345');
      expect(executions[0].success).toBe(1);
    });

    test('should record failed execution', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({ operator: 'AND', rules: [] }),
        actions: JSON.stringify([{ type: 'email', config: {} }]),
        is_active: 1
      });

      const customerData = { customerId: 'CUST-12345' };

      mockRuleEngine.evaluate.mockReturnValue(true);
      mockActionService.executeBatch.mockResolvedValue([{ success: false, error: 'Email failed' }]);

      // Act
      await automationEngine.evaluateCustomer(customerData);

      // Assert
      const executions = schema.getExecutionsByRule(ruleId);
      expect(executions).toHaveLength(1);
      expect(executions[0].success).toBe(0);
      expect(JSON.parse(executions[0].actions_taken)).toContainEqual(
        expect.objectContaining({ success: false, error: 'Email failed' })
      );
    });
  });

  describe('Batch processing', () => {
    test('should process multiple customers', async () => {
      // Arrange
      schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({
          operator: 'AND',
          rules: [{ field: 'score', operator: 'greaterThan', value: 70 }]
        }),
        actions: JSON.stringify([{ type: 'email', config: {} }]),
        is_active: 1
      });

      const customers = [
        { customerId: 'CUST-001', score: 80 },
        { customerId: 'CUST-002', score: 60 },
        { customerId: 'CUST-003', score: 90 }
      ];

      mockRuleEngine.evaluate
        .mockReturnValueOnce(true)  // CUST-001
        .mockReturnValueOnce(false) // CUST-002
        .mockReturnValueOnce(true); // CUST-003

      mockActionService.executeBatch.mockResolvedValue([{ success: true }]);

      // Act
      const results = await automationEngine.evaluateBatch(customers);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].triggered).toBe(true);  // CUST-001
      expect(results[1].triggered).toBe(false); // CUST-002
      expect(results[2].triggered).toBe(true);  // CUST-003
      expect(mockActionService.executeBatch).toHaveBeenCalledTimes(2);
    });

    test('should handle errors gracefully in batch processing', async () => {
      // Arrange
      schema.createRule({
        name: 'Test rule',
        conditions: JSON.stringify({ operator: 'AND', rules: [] }),
        actions: JSON.stringify([{ type: 'email', config: {} }]),
        is_active: 1
      });

      const customers = [
        { customerId: 'CUST-001' },
        { customerId: 'CUST-002' }
      ];

      mockRuleEngine.evaluate.mockReturnValue(true);
      mockActionService.executeBatch
        .mockResolvedValueOnce([{ success: true }])
        .mockRejectedValueOnce(new Error('Service unavailable'));

      // Act
      const results = await automationEngine.evaluateBatch(customers);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].triggered).toBe(true);
      expect(results[0].error).toBeUndefined();
      expect(results[1].triggered).toBe(false);
      expect(results[1].error).toBe('Service unavailable');
    });
  });

  describe('Rule management', () => {
    test('should activate rule', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 0
      });

      // Act
      await automationEngine.activateRule(ruleId);

      // Assert
      const rule = schema.getRule(ruleId);
      expect(rule?.is_active).toBe(1);
    });

    test('should deactivate rule', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      // Act
      await automationEngine.deactivateRule(ruleId);

      // Assert
      const rule = schema.getRule(ruleId);
      expect(rule?.is_active).toBe(0);
    });

    test('should get rule statistics', async () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      // Add some executions
      schema.recordExecution({
        rule_id: ruleId,
        customer_id: 'CUST-001',
        actions_taken: '[]',
        success: 1
      });

      schema.recordExecution({
        rule_id: ruleId,
        customer_id: 'CUST-002',
        actions_taken: '[]',
        success: 0
      });

      // Act
      const stats = await automationEngine.getRuleStatistics(ruleId);

      // Assert
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successRate).toBe(0.5);
    });
  });
});