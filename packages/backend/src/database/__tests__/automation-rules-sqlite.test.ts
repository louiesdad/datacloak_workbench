import Database from 'better-sqlite3';
import { AutomationRulesSQLiteSchema } from '../schemas/automation-rules-sqlite.schema';
import path from 'path';
import fs from 'fs';

describe('Automation Rules SQLite Schema', () => {
  let db: Database.Database;
  let schema: AutomationRulesSQLiteSchema;
  const testDbPath = path.join(__dirname, 'test-automation-rules.db');

  beforeEach(() => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create new test database
    db = new Database(testDbPath);
    schema = new AutomationRulesSQLiteSchema(db);
  });

  afterEach(() => {
    db.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Table creation', () => {
    test('should create automation_rules table', () => {
      // Act
      schema.createTables();

      // Assert
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='automation_rules'
      `).all();
      
      expect(tables).toHaveLength(1);
    });

    test('should create trigger_executions table', () => {
      // Act
      schema.createTables();

      // Assert
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='trigger_executions'
      `).all();
      
      expect(tables).toHaveLength(1);
    });
  });

  describe('Rule operations', () => {
    beforeEach(() => {
      schema.createTables();
    });

    test('should insert and retrieve automation rule', () => {
      // Arrange
      const rule = {
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
      };

      // Act
      const id = schema.createRule(rule);
      const retrieved = schema.getRule(id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe(rule.name);
      expect(retrieved.is_active).toBe(1);
      expect(JSON.parse(retrieved.conditions)).toEqual(JSON.parse(rule.conditions));
    });

    test('should update rule status', () => {
      // Arrange
      const rule = {
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      };
      const id = schema.createRule(rule);

      // Act
      schema.updateRuleStatus(id, 0);
      const updated = schema.getRule(id);

      // Assert
      expect(updated.is_active).toBe(0);
    });

    test('should get all active rules', () => {
      // Arrange
      schema.createRule({
        name: 'Active rule 1',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      schema.createRule({
        name: 'Inactive rule',
        conditions: '{}',
        actions: '[]',
        is_active: 0
      });

      schema.createRule({
        name: 'Active rule 2',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      // Act
      const activeRules = schema.getActiveRules();

      // Assert
      expect(activeRules).toHaveLength(2);
      expect(activeRules.every(rule => rule.is_active === 1)).toBe(true);
    });
  });

  describe('Execution tracking', () => {
    beforeEach(() => {
      schema.createTables();
    });

    test('should record trigger execution', () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      const execution = {
        rule_id: ruleId,
        customer_id: 'CUST-12345',
        actions_taken: JSON.stringify([
          { type: 'email', status: 'sent' }
        ]),
        success: 1
      };

      // Act
      const execId = schema.recordExecution(execution);
      const retrieved = schema.getExecution(execId);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.rule_id).toBe(ruleId);
      expect(retrieved.customer_id).toBe('CUST-12345');
      expect(retrieved.success).toBe(1);
    });

    test('should get executions by rule', () => {
      // Arrange
      const ruleId = schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: 1
      });

      // Create multiple executions
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
      const executions = schema.getExecutionsByRule(ruleId);

      // Assert
      expect(executions).toHaveLength(2);
      expect(executions[0].rule_id).toBe(ruleId);
      expect(executions[1].rule_id).toBe(ruleId);
    });
  });
});