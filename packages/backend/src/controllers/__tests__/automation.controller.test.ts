import request from 'supertest';
import express from 'express';
import { AutomationController } from '../automation.controller';
import { AutomationEngine } from '../../services/automation-engine.service';
import { AutomationRulesSQLiteSchema } from '../../database/schemas/automation-rules-sqlite.schema';

// Mock the dependencies
jest.mock('../../services/automation-engine.service');
jest.mock('../../database/schemas/automation-rules-sqlite.schema');

describe('Automation Controller', () => {
  let app: express.Application;
  let controller: AutomationController;
  let mockAutomationEngine: jest.Mocked<AutomationEngine>;
  let mockSchema: jest.Mocked<AutomationRulesSQLiteSchema>;

  beforeEach(() => {
    // Create mocks
    mockAutomationEngine = new AutomationEngine(null as any, null as any, null as any) as jest.Mocked<AutomationEngine>;
    mockSchema = new AutomationRulesSQLiteSchema(null as any) as jest.Mocked<AutomationRulesSQLiteSchema>;

    // Set up mock methods
    mockAutomationEngine.evaluateCustomer = jest.fn();
    mockAutomationEngine.activateRule = jest.fn();
    mockAutomationEngine.deactivateRule = jest.fn();
    mockAutomationEngine.getRuleStatistics = jest.fn();
    mockAutomationEngine.testRule = jest.fn();
    mockSchema.createRule = jest.fn();
    mockSchema.getRule = jest.fn();
    mockSchema.getActiveRules = jest.fn();
    mockSchema.updateRuleStatus = jest.fn();
    mockSchema.deleteRule = jest.fn();
    mockSchema.getExecutionsByRule = jest.fn();

    // Create controller
    controller = new AutomationController(mockAutomationEngine, mockSchema);

    // Set up Express app
    app = express();
    app.use(express.json());
    
    // Set up routes
    app.post('/api/automation/rules', controller.createRule.bind(controller));
    app.get('/api/automation/rules', controller.getAllRules.bind(controller));
    app.get('/api/automation/rules/:id', controller.getRule.bind(controller));
    app.put('/api/automation/rules/:id', controller.updateRule.bind(controller));
    app.delete('/api/automation/rules/:id', controller.deleteRule.bind(controller));
    app.post('/api/automation/rules/:id/activate', controller.activateRule.bind(controller));
    app.post('/api/automation/rules/:id/deactivate', controller.deactivateRule.bind(controller));
    app.post('/api/automation/rules/:id/test', controller.testRule.bind(controller));
    app.get('/api/automation/rules/:id/statistics', controller.getRuleStatistics.bind(controller));
    app.get('/api/automation/rules/:id/executions', controller.getRuleExecutions.bind(controller));
    app.post('/api/automation/evaluate', controller.evaluateCustomer.bind(controller));
  });

  describe('POST /api/automation/rules', () => {
    test('should create new automation rule', async () => {
      // Arrange
      const ruleData = {
        name: 'High-value customer at risk',
        conditions: {
          operator: 'AND',
          rules: [
            { field: 'customerLifetimeValue', operator: 'greaterThan', value: 1000 },
            { field: 'sentimentScore', operator: 'lessThan', value: 40 }
          ]
        },
        actions: [
          { type: 'email', config: { to: 'manager@company.com' } }
        ],
        is_active: true
      };

      const createdRuleId = 'rule-123';
      mockSchema.createRule.mockReturnValue(createdRuleId);
      mockSchema.getRule.mockReturnValue({
        id: createdRuleId,
        name: ruleData.name,
        conditions: JSON.stringify(ruleData.conditions),
        actions: JSON.stringify(ruleData.actions),
        is_active: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });

      // Act
      const response = await request(app)
        .post('/api/automation/rules')
        .send(ruleData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdRuleId);
      expect(response.body.data.name).toBe(ruleData.name);
      expect(mockSchema.createRule).toHaveBeenCalledWith({
        name: ruleData.name,
        conditions: JSON.stringify(ruleData.conditions),
        actions: JSON.stringify(ruleData.actions),
        is_active: 1
      });
    });

    test('should return 400 for invalid rule data', async () => {
      // Arrange
      const invalidRuleData = {
        // Missing required fields
        conditions: {}
      };

      // Act
      const response = await request(app)
        .post('/api/automation/rules')
        .send(invalidRuleData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('GET /api/automation/rules', () => {
    test('should return all rules', async () => {
      // Arrange
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Rule 1',
          conditions: '{}',
          actions: '[]',
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'rule-2',
          name: 'Rule 2',
          conditions: '{}',
          actions: '[]',
          is_active: 0,
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockSchema.getActiveRules.mockReturnValue([mockRules[0]]);

      // Act
      const response = await request(app)
        .get('/api/automation/rules');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('rule-1');
    });

    test('should return active rules when includeInactive is true (current limitation)', async () => {
      // Arrange
      const mockRules = [
        { 
          id: 'rule-1', 
          name: 'Active Rule', 
          conditions: '{}',
          actions: '[]',
          is_active: 1,
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSchema.getActiveRules.mockReturnValue(mockRules);

      // Act
      const response = await request(app)
        .get('/api/automation/rules?includeInactive=true');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/automation/rules/:id', () => {
    test('should return specific rule', async () => {
      // Arrange
      const ruleId = 'rule-123';
      const mockRule = {
        id: ruleId,
        name: 'Test Rule',
        conditions: '{"operator":"AND","rules":[]}',
        actions: '[{"type":"email","config":{}}]',
        is_active: 1,
        created_at: '2024-01-01T00:00:00Z'
      };

      mockSchema.getRule.mockReturnValue(mockRule);

      // Act
      const response = await request(app)
        .get(`/api/automation/rules/${ruleId}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(ruleId);
      expect(response.body.data.conditions).toEqual(JSON.parse(mockRule.conditions));
      expect(response.body.data.actions).toEqual(JSON.parse(mockRule.actions));
    });

    test('should return 404 for non-existent rule', async () => {
      // Arrange
      mockSchema.getRule.mockReturnValue(undefined);

      // Act
      const response = await request(app)
        .get('/api/automation/rules/non-existent');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/automation/rules/:id/activate', () => {
    test('should activate rule', async () => {
      // Arrange
      const ruleId = 'rule-123';
      mockAutomationEngine.activateRule.mockResolvedValue();

      // Act
      const response = await request(app)
        .post(`/api/automation/rules/${ruleId}/activate`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockAutomationEngine.activateRule).toHaveBeenCalledWith(ruleId);
    });
  });

  describe('POST /api/automation/rules/:id/test', () => {
    test('should test rule with provided data', async () => {
      // Arrange
      const ruleId = 'rule-123';
      const testData = {
        customerId: 'TEST-001',
        customerLifetimeValue: 5000,
        sentimentScore: 30
      };

      const mockResult = {
        ruleId,
        ruleName: 'Test Rule',
        triggered: true
      };

      mockAutomationEngine.testRule.mockResolvedValue(mockResult);

      // Act
      const response = await request(app)
        .post(`/api/automation/rules/${ruleId}/test`)
        .send(testData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.triggered).toBe(true);
      expect(mockAutomationEngine.testRule).toHaveBeenCalledWith(ruleId, testData);
    });
  });

  describe('GET /api/automation/rules/:id/statistics', () => {
    test('should return rule statistics', async () => {
      // Arrange
      const ruleId = 'rule-123';
      const mockStats = {
        totalExecutions: 100,
        successfulExecutions: 85,
        failedExecutions: 15,
        successRate: 0.85
      };

      mockAutomationEngine.getRuleStatistics.mockResolvedValue(mockStats);

      // Act
      const response = await request(app)
        .get(`/api/automation/rules/${ruleId}/statistics`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('POST /api/automation/evaluate', () => {
    test('should evaluate customer data against all rules', async () => {
      // Arrange
      const customerData = {
        customerId: 'CUST-001',
        customerLifetimeValue: 5000,
        sentimentScore: 25
      };

      const mockResults = [
        {
          ruleId: 'rule-1',
          ruleName: 'High-value at risk',
          triggered: true,
          actions: [{ success: true }]
        }
      ];

      mockAutomationEngine.evaluateCustomer.mockResolvedValue(mockResults);

      // Act
      const response = await request(app)
        .post('/api/automation/evaluate')
        .send(customerData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResults);
      expect(mockAutomationEngine.evaluateCustomer).toHaveBeenCalledWith(customerData);
    });

    test('should return 400 for missing customer data', async () => {
      // Act
      const response = await request(app)
        .post('/api/automation/evaluate')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('customerId');
    });
  });

  describe('Error handling', () => {
    test('should handle service errors gracefully', async () => {
      // Arrange
      mockSchema.createRule.mockImplementation(() => {
        throw new Error('Database error');
      });

      const ruleData = {
        name: 'Test Rule',
        conditions: { operator: 'AND', rules: [] },
        actions: [],
        is_active: true
      };

      // Act
      const response = await request(app)
        .post('/api/automation/rules')
        .send(ruleData);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database error');
    });
  });
});