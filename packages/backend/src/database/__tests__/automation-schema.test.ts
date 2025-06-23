import { Database } from 'duckdb-async';
import { AutomationRulesSchema } from '../schemas/automation-rules.schema';

describe('Automation Rules Database Schema', () => {
  let db: Database;
  let schema: AutomationRulesSchema;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = await Database.create(':memory:');
    schema = new AutomationRulesSchema(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Table creation', () => {
    test('should create automation_rules table', async () => {
      // Act
      await schema.createTables();

      // Assert
      const result = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='automation_rules'
      `);
      expect(result).toHaveLength(1);
    });

    test('should create trigger_executions table', async () => {
      // Act
      await schema.createTables();

      // Assert
      const result = await db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='trigger_executions'
      `);
      expect(result).toHaveLength(1);
    });

    test('automation_rules table should have correct columns', async () => {
      // Act
      await schema.createTables();

      // Assert
      const columns = await db.all(`PRAGMA table_info(automation_rules)`);
      const columnNames = columns.map((col: any) => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('conditions');
      expect(columnNames).toContain('actions');
      expect(columnNames).toContain('is_active');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    test('trigger_executions table should have correct columns', async () => {
      // Act
      await schema.createTables();

      // Assert
      const columns = await db.all(`PRAGMA table_info(trigger_executions)`);
      const columnNames = columns.map((col: any) => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('rule_id');
      expect(columnNames).toContain('triggered_at');
      expect(columnNames).toContain('customer_id');
      expect(columnNames).toContain('actions_taken');
      expect(columnNames).toContain('success');
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      await schema.createTables();
    });

    test('should insert and retrieve automation rule', async () => {
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
        is_active: true
      };

      // Act
      const id = await schema.createRule(rule);
      const retrieved = await schema.getRule(id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe(rule.name);
      expect(retrieved.is_active).toBe(true);
      expect(JSON.parse(retrieved.conditions)).toEqual(JSON.parse(rule.conditions));
    });

    test('should update rule status', async () => {
      // Arrange
      const rule = {
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: true
      };
      const id = await schema.createRule(rule);

      // Act
      await schema.updateRuleStatus(id, false);
      const updated = await schema.getRule(id);

      // Assert
      expect(updated.is_active).toBe(false);
    });

    test('should record trigger execution', async () => {
      // Arrange
      const ruleId = await schema.createRule({
        name: 'Test rule',
        conditions: '{}',
        actions: '[]',
        is_active: true
      });

      const execution = {
        rule_id: ruleId,
        customer_id: 'CUST-12345',
        actions_taken: JSON.stringify([
          { type: 'email', status: 'sent' }
        ]),
        success: true
      };

      // Act
      const execId = await schema.recordExecution(execution);
      const retrieved = await schema.getExecution(execId);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.rule_id).toBe(ruleId);
      expect(retrieved.customer_id).toBe('CUST-12345');
      expect(retrieved.success).toBe(true);
    });

    test('should get all active rules', async () => {
      // Arrange
      await schema.createRule({
        name: 'Active rule 1',
        conditions: '{}',
        actions: '[]',
        is_active: true
      });

      await schema.createRule({
        name: 'Inactive rule',
        conditions: '{}',
        actions: '[]',
        is_active: false
      });

      await schema.createRule({
        name: 'Active rule 2',
        conditions: '{}',
        actions: '[]',
        is_active: true
      });

      // Act
      const activeRules = await schema.getActiveRules();

      // Assert
      expect(activeRules).toHaveLength(2);
      expect(activeRules.every(rule => rule.is_active)).toBe(true);
    });
  });
});